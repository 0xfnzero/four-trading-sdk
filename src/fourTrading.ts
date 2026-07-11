import { ethers, Wallet, JsonRpcProvider, WebSocketProvider, TransactionRequest } from 'ethers';
import { FOUR_TRADING_ABI } from './abi';
import {
  EventMetadata,
  MarketCapInfo,
  TokenInfo,
  TokenInfoEx,
  TokenMetadata,
  Template,
  TransactionResult,
  TokenCreateEvent,
  TokenPurchaseEvent,
  TokenSaleEvent,
  LiquidityAddedEvent,
} from './types';
import { PriceCalculator, PriceInfo } from './priceCalculator';
import { Validator } from './validator';
import { Logger } from './logger';
import { PerformanceMonitor } from './performance';
import { WebSocketManager, WebSocketManagerConfig } from './websocketManager';
import { Cache } from './cache';
import { ConnectionError, TransactionFailedError } from './errors';
import { waitForTransaction } from './utils';
import { TRANSACTION_CONFIRMATION_BLOCKS, TRANSACTION_TIMEOUT, STATIC_DATA_CACHE_TTL } from './constants';
import { NonceManager, NonceManagerConfig } from './nonceManager';
import {
  SubmitterConfig,
  TransactionSubmitter,
  createSubmitter,
  getSignedTransactionHash,
} from './submitter';

/**
 * FOUR Launch Platform Trading SDK for BSC
 * Contract: 0x5c952063c7fc8610FFDB798152D69F0B9550762b
 */

export interface FourTradingConfig {
  rpcUrl: string; // HTTP RPC endpoint for transactions
  wssUrl: string; // WebSocket endpoint for event subscriptions (required for real-time events)
  privateKey: string;
  contractAddress?: string;
  chainId?: number | bigint;
  logger?: Logger;
  websocket?: Omit<WebSocketManagerConfig, 'url' | 'logger'>;
  submitters?: SubmitterConfig[];
  defaultGas?: GasOptions;
  confirmations?: number;
  transactionTimeoutMs?: number;
  confirmationPollIntervalMs?: number;
  waitForConfirmation?: boolean;
  requireHotPathReady?: boolean;
  useLocalNonce?: boolean;
  nonce?: NonceManagerConfig;
}

export interface GasOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;  // In wei, use ethers.parseUnits(amount, 'gwei') for gwei
  maxFeePerGas?: bigint;  // In wei, use ethers.parseUnits(amount, 'gwei') for gwei
  maxPriorityFeePerGas?: bigint;  // In wei, use ethers.parseUnits(amount, 'gwei') for gwei
  nonce?: number;
  chainId?: number | bigint;
}

export enum SellMode {
  FULL = 'full',    // Sell all tokens
  PARTIAL = 'partial' // Sell partial tokens
}

export interface BuyParams {
  tokenAddress: string;
  fundsInBNB: bigint;  // In wei, use ethers.parseEther(amount) to convert from BNB
  minAmount?: bigint;  // In wei, use ethers.parseUnits(amount, 18) to convert
  to?: string; // Optional recipient address
  origin?: number; // Origin identifier (optional)
  gas?: GasOptions;
  bundleRawTransactions?: string[];
  targetBlockNumber?: bigint;
}

export interface SellParams {
  tokenAddress: string;
  amount: bigint;  // In wei, use ethers.parseUnits(amount, 18) to convert
  minFunds?: bigint;  // In wei, use ethers.parseEther(amount) to convert from BNB
  mode?: SellMode; // Sell mode: full or partial (default: FULL)
  decimals?: number; // Token decimals (default: 18)
  origin?: number; // Origin identifier (default: 0)
  feeRate?: bigint; // Custom fee rate (optional)
  feeRecipient?: string; // Custom fee recipient (optional)
  gas?: GasOptions;
  bundleRawTransactions?: string[];
  targetBlockNumber?: bigint;
}

export interface CreateTokenParams {
  args: string; // Encoded arguments
  signature?: string; // Optional signature for verification
  gas?: GasOptions;
  bundleRawTransactions?: string[];
  targetBlockNumber?: bigint;
}

// Event listener types
export type TokenCreateListener = (event: TokenCreateEvent) => void;
export type TokenPurchaseListener = (event: TokenPurchaseEvent) => void;
export type TokenSaleListener = (event: TokenSaleEvent) => void;
export type LiquidityAddedListener = (event: LiquidityAddedEvent) => void;

export class FourTrading {
  private provider: JsonRpcProvider; // HTTP provider for transactions
  private eventProvider: WebSocketProvider; // WebSocket provider for event subscriptions (required)
  private webSocketManager: WebSocketManager;
  private wallet: Wallet;
  private contract: ethers.Contract;
  private eventContract: ethers.Contract; // Contract instance for event subscriptions
  private contractAddress: string;
  private priceCalculator: PriceCalculator;
  private logger: Logger;
  private performance: PerformanceMonitor;
  private submitter: TransactionSubmitter;
  private nonceManager: NonceManager | null;
  private confirmations: number;
  private transactionTimeoutMs: number;
  private confirmationPollIntervalMs: number;
  private waitForConfirmation: boolean;
  private chainId: bigint;
  private defaultGas?: GasOptions;
  private requireHotPathReady: boolean;
  private tokenMetadataCache: Cache<string, TokenMetadata>;

  // Event listeners storage with cleanup tracking
  private tokenCreateListeners: Map<string, { listener: TokenCreateListener; contractListener: any }> = new Map();
  private tokenPurchaseListeners: Map<string, { listener: TokenPurchaseListener; contractListener: any }> = new Map();
  private tokenSaleListeners: Map<string, { listener: TokenSaleListener; contractListener: any }> = new Map();
  private liquidityAddedListeners: Map<string, { listener: LiquidityAddedListener; contractListener: any }> = new Map();

  constructor(config: FourTradingConfig) {
    Validator.validateRpcUrl(config.rpcUrl, 'http');
    Validator.validateRpcUrl(config.wssUrl, 'websocket');
    Validator.validatePrivateKey(config.privateKey);
    if (config.contractAddress) {
      Validator.validateAddress(config.contractAddress, 'contractAddress');
    }

    this.logger = config.logger || new Logger();
    this.performance = new PerformanceMonitor(this.logger);
    this.contractAddress = config.contractAddress || '0x5c952063c7fc8610FFDB798152D69F0B9550762b';
    this.confirmations = config.confirmations ?? TRANSACTION_CONFIRMATION_BLOCKS;
    this.transactionTimeoutMs = config.transactionTimeoutMs ?? TRANSACTION_TIMEOUT;
    this.confirmationPollIntervalMs = config.confirmationPollIntervalMs ?? 250;
    this.waitForConfirmation = config.waitForConfirmation ?? true;
    this.chainId = BigInt(config.chainId ?? 56);
    if (this.chainId <= 0n) {
      throw new TransactionFailedError(`Invalid chainId: ${this.chainId}`);
    }
    if (config.defaultGas?.nonce !== undefined) {
      throw new TransactionFailedError(
        'defaultGas.nonce would be reused for every transaction; use nonce.initialNonce, or disable local nonce management for per-call gas.nonce values'
      );
    }
    this.defaultGas = config.defaultGas;
    this.requireHotPathReady = config.requireHotPathReady ?? false;

    // HTTP provider for transactions (required)
    this.provider = new JsonRpcProvider(config.rpcUrl);

    this.webSocketManager = new WebSocketManager({
      url: config.wssUrl,
      logger: this.logger,
      ...config.websocket,
    });

    // WebSocket provider for events (required - cannot use polling).
    // WebSocketManager creates the provider synchronously and owns its lifecycle.
    void this.webSocketManager.connect().catch(error => {
      this.logger.error('Initial WebSocket connection failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    const eventProvider = this.webSocketManager.getProvider();
    if (!eventProvider) {
      throw new ConnectionError('Failed to initialize event WebSocket provider', { url: config.wssUrl });
    }
    this.eventProvider = eventProvider;

    // Wallet connected to transaction provider
    this.wallet = new Wallet(config.privateKey, this.provider);
    this.submitter = createSubmitter(config.submitters, {
      provider: this.provider,
      logger: this.logger,
      signerPrivateKey: config.privateKey,
    });
    const useLocalNonce = config.useLocalNonce ?? config.nonce?.enabled ?? true;
    this.nonceManager = useLocalNonce
      ? new NonceManager(this.provider, this.wallet.address, this.logger, config.nonce)
      : null;
    this.tokenMetadataCache = new Cache({ defaultTTL: STATIC_DATA_CACHE_TTL, maxSize: 1000 });

    // Contract for transactions (uses wallet with HTTP provider)
    this.contract = new ethers.Contract(
      this.contractAddress,
      FOUR_TRADING_ABI,
      this.wallet
    );

    // Contract for events (uses WebSocket provider for real-time subscriptions)
    this.eventContract = new ethers.Contract(
      this.contractAddress,
      FOUR_TRADING_ABI,
      this.eventProvider
    );

    // Initialize price calculator with read-only contract on transaction provider
    const readOnlyContract = new ethers.Contract(
      this.contractAddress,
      FOUR_TRADING_ABI,
      this.provider
    );
    this.priceCalculator = new PriceCalculator(readOnlyContract);

    this.webSocketManager.onConnected(() => {
      const provider = this.webSocketManager.getProvider();
      if (!provider || provider === this.eventProvider) {
        return;
      }

      this.logger.info('Rebinding event contract after WebSocket reconnect');
      this.rebindEventProvider(provider);
    });
  }

  // ==================== Private Helpers ====================

  private buildTxOptions(gas?: GasOptions, value?: bigint): any {
    const options: any = {};
    const mergedGas = {
      ...(this.defaultGas || {}),
      ...(gas || {}),
    };

    if (value !== undefined) {
      Validator.validateAmount(value, 'value', { allowZero: true });
      options.value = value;
    }

    options.chainId = mergedGas.chainId !== undefined ? BigInt(mergedGas.chainId) : this.chainId;

    if (mergedGas.nonce !== undefined) {
      if (this.nonceManager) {
        throw new TransactionFailedError(
          'Per-call gas.nonce cannot be combined with local nonce management; use nonce.initialNonce or set useLocalNonce to false'
        );
      }
      if (!Number.isSafeInteger(mergedGas.nonce) || mergedGas.nonce < 0) {
        throw new TransactionFailedError(`Invalid nonce: ${mergedGas.nonce}`);
      }
      options.nonce = mergedGas.nonce;
    }

    if (Object.keys(mergedGas).length > 0) {
      Validator.validateGasOptions(mergedGas);

      if (mergedGas.gasLimit !== undefined) {
        options.gasLimit = mergedGas.gasLimit;
      }
      if (mergedGas.gasPrice !== undefined) {
        options.gasPrice = mergedGas.gasPrice;
      }
      if (mergedGas.maxFeePerGas !== undefined) {
        options.maxFeePerGas = mergedGas.maxFeePerGas;
      }
      if (mergedGas.maxPriorityFeePerGas !== undefined) {
        options.maxPriorityFeePerGas = mergedGas.maxPriorityFeePerGas;
      }
    }

    return options;
  }

  private async submitTransaction(
    operationName: string,
    request: TransactionRequest,
    bundleRawTransactions?: string[],
    targetBlockNumber?: bigint
  ): Promise<TransactionResult> {
    return await this.performance.trackAsync(operationName, async () => {
      let reservedNonce: number | undefined;
      let submissionAttempted = false;
      try {
        const transactionRequest = { ...request };

        if (
          this.requireHotPathReady
          && this.nonceManager
          && this.nonceManager.getCurrentNonce() === null
          && transactionRequest.nonce === undefined
        ) {
          throw new TransactionFailedError(
            'Hot-path transaction is missing required fields: nonce',
            undefined,
            { missingHotPathFields: ['nonce'] }
          );
        }

        if (this.nonceManager && transactionRequest.nonce === undefined) {
          reservedNonce = await this.nonceManager.getAndIncrement();
          transactionRequest.nonce = reservedNonce;
        }

        if (transactionRequest.chainId === undefined) {
          transactionRequest.chainId = this.chainId;
        }

        const missingHotPathFields = this.missingHotPathFields(transactionRequest);
        if (this.requireHotPathReady && missingHotPathFields.length > 0) {
          throw new TransactionFailedError(
            `Hot-path transaction is missing required fields: ${missingHotPathFields.join(', ')}`,
            undefined,
            { missingHotPathFields }
          );
        }

        const populated = missingHotPathFields.length === 0
          ? transactionRequest
          : await this.wallet.populateTransaction(transactionRequest);
        const signedTransaction = await this.wallet.signTransaction(populated);
        const txHash = getSignedTransactionHash(signedTransaction);
        // A relay/RPC error after this point can be ambiguous: the transaction
        // may have reached the network even if no response reached the SDK.
        submissionAttempted = true;
        const submitterResult = await this.submitter.submitSignedTransaction({
          signedTransaction,
          txHash,
          rawTransactions: bundleRawTransactions,
          targetBlockNumber,
        });

        const receipt = this.waitForConfirmation
          ? await waitForTransaction(
              this.provider,
              txHash,
              this.confirmations,
              this.transactionTimeoutMs,
              this.confirmationPollIntervalMs
            )
          : null;

        return {
          success: true,
          txHash,
          receipt,
          submitter: submitterResult.submitter,
          bundleHash: submitterResult.bundleHash,
          nonce: typeof populated.nonce === 'number' ? populated.nonce : populated.nonce !== undefined ? Number(populated.nonce) : undefined,
          gasLimit: this.toBigInt(populated.gasLimit),
          gasPrice: this.toBigInt(populated.gasPrice),
        };
      } catch (error) {
        if (this.nonceManager) {
          if (reservedNonce !== undefined && !submissionAttempted) {
            const released = await this.nonceManager.release(reservedNonce);
            if (!released) {
              this.logger.warn('Could not release an older nonce reservation safely', {
                nonce: reservedNonce,
              });
            }
          } else if (submissionAttempted) {
            await this.nonceManager.refresh().catch(refreshError => {
              this.logger.warn('Failed to refresh nonce after transaction error', {
                error: refreshError instanceof Error ? refreshError.message : String(refreshError),
              });
            });
          }
        }
        throw this.wrapTransactionError(error, operationName);
      }
    }, { submitter: this.submitter.name });
  }

  private wrapTransactionError(error: unknown, operationName: string): Error {
    if (error instanceof TransactionFailedError) {
      return error;
    }

    return new TransactionFailedError(
      `${operationName} failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      { cause: error }
    );
  }

  private toBigInt(value: unknown): bigint | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'number') {
      return BigInt(value);
    }

    if (typeof value === 'string') {
      return BigInt(value);
    }

    if (typeof (value as any).toString === 'function') {
      return BigInt((value as any).toString());
    }

    return undefined;
  }

  private missingHotPathFields(request: TransactionRequest): string[] {
    const missing: string[] = [];
    if (!request.to) {
      missing.push('to');
    }
    if (request.nonce === undefined) {
      missing.push('nonce');
    }
    if (request.chainId === undefined) {
      missing.push('chainId');
    }
    if (request.gasLimit === undefined) {
      missing.push('gasLimit');
    }
    if (
      request.gasPrice === undefined
      && (request.maxFeePerGas === undefined || request.maxPriorityFeePerGas === undefined)
    ) {
      missing.push('gasPrice or maxFeePerGas/maxPriorityFeePerGas');
    }
    return missing;
  }

  private validateOrigin(origin: number | undefined, fieldName: string = 'origin'): void {
    if (origin === undefined) {
      return;
    }
    if (!Number.isInteger(origin) || origin < 0) {
      throw new TransactionFailedError(`${fieldName} must be a non-negative integer`, undefined, { [fieldName]: origin });
    }
  }

  private async assertBuyMinAmountExecutable(
    tokenAddress: string,
    funds: bigint,
    minAmount: bigint
  ): Promise<void> {
    try {
      await this.contract['buyTokenAMAP(address,address,uint256,uint256)'].staticCall(
        tokenAddress,
        this.wallet.address,
        funds,
        minAmount,
        { value: funds }
      );
    } catch (error) {
      throw new TransactionFailedError(
        'The estimated FOUR buy minimum failed on-chain simulation; no executable minAmount was returned',
        undefined,
        {
          tokenAddress,
          funds: funds.toString(),
          minAmount: minAmount.toString(),
          cause: error,
        }
      );
    }
  }

  private async assertSellMinFundsExecutable(
    tokenAddress: string,
    tokenAmount: bigint,
    minFunds: bigint
  ): Promise<void> {
    try {
      await this.contract['sellToken(address,uint256,uint256)'].staticCall(
        tokenAddress,
        tokenAmount,
        minFunds
      );
    } catch (error) {
      throw new TransactionFailedError(
        'The estimated FOUR sell minimum failed on-chain simulation; no executable minFunds was returned',
        undefined,
        {
          tokenAddress,
          tokenAmount: tokenAmount.toString(),
          minFunds: minFunds.toString(),
          cause: error,
        }
      );
    }
  }

  private extractEventMetadata(payload: any): EventMetadata | undefined {
    const log = payload?.log || payload;
    if (!log || typeof log !== 'object') {
      return undefined;
    }

    return {
      txHash: log.transactionHash || log.hash,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      logIndex: log.index ?? log.logIndex,
      transactionIndex: log.transactionIndex,
      removed: log.removed,
    };
  }

  private reattachEventListeners(): void {
    for (const { contractListener } of this.tokenCreateListeners.values()) {
      this.eventContract.on('TokenCreate', contractListener);
    }
    for (const { contractListener } of this.tokenPurchaseListeners.values()) {
      this.eventContract.on('TokenPurchase', contractListener);
    }
    for (const { contractListener } of this.tokenSaleListeners.values()) {
      this.eventContract.on('TokenSale', contractListener);
    }
    for (const { contractListener } of this.liquidityAddedListeners.values()) {
      this.eventContract.on('LiquidityAdded', contractListener);
    }
  }

  private rebindEventProvider(provider: WebSocketProvider): void {
    if (provider === this.eventProvider) {
      return;
    }

    this.eventContract.removeAllListeners();
    this.eventProvider = provider;
    this.eventContract = new ethers.Contract(
      this.contractAddress,
      FOUR_TRADING_ABI,
      this.eventProvider
    );
    this.reattachEventListeners();
  }

  // ==================== Trading Functions ====================

  /**
   * Buy tokens using BNB (AMAP - As Much As Possible)
   * This is the recommended method for buying tokens
   */
  async buyToken(params: BuyParams): Promise<TransactionResult> {
    Validator.validateAddress(params.tokenAddress, 'tokenAddress');
    Validator.validateAmount(params.fundsInBNB, 'fundsInBNB');
    if (params.minAmount !== undefined) {
      Validator.validateAmount(params.minAmount, 'minAmount', { allowZero: true });
    }
    if (params.to) {
      Validator.validateAddress(params.to, 'to');
    }
    this.validateOrigin(params.origin);

    const fundsWei = params.fundsInBNB;
    const minAmount = params.minAmount || 0n;
    const txOptions = this.buildTxOptions(params.gas, fundsWei);
    const recipient = params.to || this.wallet.address;
    const origin = params.origin !== undefined ? BigInt(params.origin) : undefined;

    const request = origin !== undefined
      ? await this.contract['buyTokenAMAP(uint256,address,address,uint256,uint256)'].populateTransaction(
          origin,
          params.tokenAddress,
          recipient,
          fundsWei,
          minAmount,
          txOptions
        )
      : await this.contract['buyTokenAMAP(address,address,uint256,uint256)'].populateTransaction(
          params.tokenAddress,
          recipient,
          fundsWei,
          minAmount,
          txOptions
        );

    return await this.submitTransaction('buyToken', request, params.bundleRawTransactions, params.targetBlockNumber);
  }

  /**
   * Buy exact amount of tokens with maximum funds limit
   */
  async buyTokenExact(
    tokenAddress: string,
    amount: bigint,
    maxFunds: bigint,
    to?: string,
    gas?: GasOptions,
    origin?: number,
    bundleRawTransactions?: string[],
    targetBlockNumber?: bigint
  ): Promise<TransactionResult> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    Validator.validateAmount(amount, 'amount');
    Validator.validateAmount(maxFunds, 'maxFunds');
    if (to) {
      Validator.validateAddress(to, 'to');
    }
    this.validateOrigin(origin);

    const txOptions = this.buildTxOptions(gas, maxFunds);
    const recipient = to || this.wallet.address;
    const originValue = origin !== undefined ? BigInt(origin) : undefined;

    const request = originValue !== undefined
      ? await this.contract['buyToken(uint256,address,address,uint256,uint256)'].populateTransaction(
          originValue,
          tokenAddress,
          recipient,
          amount,
          maxFunds,
          txOptions
        )
      : await this.contract['buyToken(address,address,uint256,uint256)'].populateTransaction(
          tokenAddress,
          recipient,
          amount,
          maxFunds,
          txOptions
        );

    return await this.submitTransaction('buyTokenExact', request, bundleRawTransactions, targetBlockNumber);
  }

  /**
   * Sell tokens for BNB
   * IMPORTANT: Must approve token spending before calling this method
   */
  async sellToken(params: SellParams): Promise<TransactionResult> {
    Validator.validateAddress(params.tokenAddress, 'tokenAddress');
    Validator.validateAmount(params.amount, 'amount');
    if (params.minFunds !== undefined) {
      Validator.validateAmount(params.minFunds, 'minFunds', { allowZero: true });
    }
    if (params.feeRate !== undefined) {
      Validator.validateAmount(params.feeRate, 'feeRate', { allowZero: true });
    }
    if (params.feeRecipient) {
      Validator.validateAddress(params.feeRecipient, 'feeRecipient');
    }
    if ((params.feeRate === undefined) !== (params.feeRecipient === undefined)) {
      throw new TransactionFailedError('feeRate and feeRecipient must be provided together');
    }
    if (params.decimals !== undefined) {
      Validator.validateDecimals(params.decimals);
    }
    this.validateOrigin(params.origin);

    let amount = params.amount;
    const minFunds = params.minFunds || 0n;
    const mode = params.mode || SellMode.FULL;
    const decimals = params.decimals ?? 18;

    // For partial sell, amount must be divisible by 10^decimals
    if (mode === SellMode.PARTIAL) {
      const divisor = 10n ** BigInt(decimals);
      if (amount % divisor !== 0n) {
        amount = (amount / divisor) * divisor;
      }
    }

    Validator.validateAmount(amount, 'amount');
    const txOptions = this.buildTxOptions(params.gas);
    const origin = BigInt(params.origin ?? 0);

    let request: TransactionRequest;
    if (params.feeRate !== undefined && params.feeRecipient) {
      request = await this.contract['sellToken(uint256,address,uint256,uint256,uint256,address)'].populateTransaction(
        origin,
        params.tokenAddress,
        amount,
        minFunds,
        params.feeRate,
        params.feeRecipient,
        txOptions
      );
    } else if (params.origin !== undefined) {
      request = await this.contract['sellToken(uint256,address,uint256,uint256)'].populateTransaction(
        origin,
        params.tokenAddress,
        amount,
        minFunds,
        txOptions
      );
    } else {
      request = await this.contract['sellToken(address,uint256,uint256)'].populateTransaction(
        params.tokenAddress,
        amount,
        minFunds,
        txOptions
      );
    }

    return await this.submitTransaction('sellToken', request, params.bundleRawTransactions, params.targetBlockNumber);
  }

  /**
   * Create a new token on the platform
   */
  async createToken(params: CreateTokenParams): Promise<TransactionResult> {
    if (!ethers.isHexString(params.args)) {
      throw new TransactionFailedError('createToken args must be hex-encoded bytes');
    }
    if (params.signature && !ethers.isHexString(params.signature)) {
      throw new TransactionFailedError('createToken signature must be hex-encoded bytes');
    }

    const txOptions = this.buildTxOptions(params.gas);
    const request = params.signature
      ? await this.contract['createToken(bytes,bytes)'].populateTransaction(params.args, params.signature, txOptions)
      : await this.contract['createToken(bytes)'].populateTransaction(params.args, txOptions);

    return await this.submitTransaction('createToken', request, params.bundleRawTransactions, params.targetBlockNumber);
  }

  /**
   * Add liquidity to a token (admin function)
   */
  async addLiquidity(tokenAddress: string, gas?: GasOptions): Promise<TransactionResult> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');

    const txOptions = this.buildTxOptions(gas);
    const request = await this.contract.addLiquidity.populateTransaction(tokenAddress, txOptions);

    return await this.submitTransaction('addLiquidity', request);
  }

  // ==================== Token Approval ====================

  /**
   * Approve token spending before selling
   */
  async approveToken(
    tokenAddress: string,
    amount?: bigint,
    gas?: GasOptions
  ): Promise<TransactionResult> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    if (amount !== undefined) {
      Validator.validateAmount(amount, 'amount', { allowZero: true });
    }

    const tokenABI = ['function approve(address spender, uint256 amount) returns (bool)'];
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, this.wallet);
    const approveAmount = amount ?? ethers.MaxUint256;
    const txOptions = this.buildTxOptions(gas);
    const request = await tokenContract.approve.populateTransaction(this.contractAddress, approveAmount, txOptions);

    return await this.submitTransaction('approveToken', request);
  }

  /**
   * Get token allowance for spender.
   */
  async getTokenAllowance(
    tokenAddress: string,
    owner: string = this.wallet.address,
    spender: string = this.contractAddress
  ): Promise<bigint> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    Validator.validateAddress(owner, 'owner');
    Validator.validateAddress(spender, 'spender');

    const tokenABI = ['function allowance(address owner, address spender) view returns (uint256)'];
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, this.provider);
    return await tokenContract.allowance(owner, spender);
  }

  /**
   * Approve only when current allowance is below the required amount.
   */
  async ensureTokenApproval(
    tokenAddress: string,
    requiredAmount: bigint,
    gas?: GasOptions
  ): Promise<TransactionResult | null> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    Validator.validateAmount(requiredAmount, 'requiredAmount');

    const allowance = await this.getTokenAllowance(tokenAddress);
    if (allowance >= requiredAmount) {
      this.logger.debug('Skipping approval because allowance is sufficient', {
        tokenAddress,
        allowance: allowance.toString(),
        requiredAmount: requiredAmount.toString(),
      });
      return null;
    }

    return await this.approveToken(tokenAddress, ethers.MaxUint256, gas);
  }

  // ==================== Query Functions ====================

  /**
   * Get token information
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    return await this.priceCalculator.getTokenInfo(tokenAddress);
  }

  /**
   * Quote buy - calculate how many tokens you get for given BNB amount
   * @param bnbAmount - Amount in wei, use ethers.parseEther(amount) to convert from BNB
   */
  async quoteBuy(tokenAddress: string, bnbAmount: bigint): Promise<PriceInfo> {
    return await this.priceCalculator.quoteBuy(tokenAddress, bnbAmount);
  }

  /**
   * Quote sell - calculate how much BNB you get for given token amount
   * @param tokenAmount - Amount in wei, use ethers.parseUnits(amount, 18) to convert
   */
  async quoteSell(tokenAddress: string, tokenAmount: bigint): Promise<PriceInfo> {
    return await this.priceCalculator.quoteSell(tokenAddress, tokenAmount);
  }

  /**
   * Get current price of token
   */
  async getCurrentPrice(tokenAddress: string): Promise<string> {
    const price = await this.priceCalculator.getCurrentPrice(tokenAddress);
    return ethers.formatEther(price);
  }

  /**
   * Calculate buy amount with slippage protection
   * @param bnbAmount - Amount in wei, use ethers.parseEther(amount) to convert from BNB
   */
  async calculateBuyWithSlippage(
    tokenAddress: string,
    bnbAmount: bigint,
    slippagePercent: number = 1
  ): Promise<{ minTokenAmount: string; estimatedTokenAmount: string; pricePerToken: string }> {
    const priceInfo = await this.priceCalculator.quoteBuy(tokenAddress, bnbAmount);
    const minAmount = PriceCalculator.applySlippage(priceInfo.tokenAmount, slippagePercent);
    await this.assertBuyMinAmountExecutable(tokenAddress, bnbAmount, minAmount);

    return {
      minTokenAmount: ethers.formatUnits(minAmount, 18),
      estimatedTokenAmount: ethers.formatUnits(priceInfo.tokenAmount, 18),
      pricePerToken: ethers.formatEther(priceInfo.pricePerToken),
    };
  }

  /**
   * Calculate sell with slippage protection
   * @param tokenAmount - Amount in wei, use ethers.parseUnits(amount, 18) to convert
   */
  async calculateSellWithSlippage(
    tokenAddress: string,
    tokenAmount: bigint,
    slippagePercent: number = 1
  ): Promise<{ minBnbAmount: string; estimatedBnbAmount: string; pricePerToken: string }> {
    const priceInfo = await this.priceCalculator.quoteSell(tokenAddress, tokenAmount);
    const minFunds = PriceCalculator.applySlippage(priceInfo.bnbCost, slippagePercent);
    await this.assertSellMinFundsExecutable(tokenAddress, tokenAmount, minFunds);

    return {
      minBnbAmount: ethers.formatEther(minFunds),
      estimatedBnbAmount: ethers.formatEther(priceInfo.bnbCost),
      pricePerToken: ethers.formatEther(priceInfo.pricePerToken),
    };
  }

  /**
   * Get extended token information
   */
  async getTokenInfoEx(tokenAddress: string): Promise<TokenInfoEx> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');

    const info = await this.contract._tokenInfoExs(tokenAddress);
    return {
      creator: info.creator,
      founder: info.founder,
      reserves: info.reserves,
    };
  }

  /**
   * Get template information
   */
  async getTemplate(templateId: number): Promise<Template> {
    if (!Number.isInteger(templateId) || templateId < 0) {
      throw new TransactionFailedError(`Invalid templateId: ${templateId}`);
    }

    const template = await this.contract._templates(templateId);
    return {
      quote: template.quote,
      initialLiquidity: template.initialLiquidity,
      maxRaising: template.maxRaising,
      totalSupply: template.totalSupply,
      maxOffers: template.maxOffers,
      minTradingFee: template.minTradingFee,
    };
  }

  /**
   * Get token address by index
   */
  async getTokenByIndex(index: number): Promise<string> {
    if (!Number.isInteger(index) || index < 0) {
      throw new TransactionFailedError(`Invalid token index: ${index}`);
    }

    return await this.contract._tokens(index);
  }

  /**
   * Get total token count
   */
  async getTokenCount(): Promise<bigint> {
    return await this.contract._tokenCount();
  }

  /**
   * Get template count
   */
  async getTemplateCount(): Promise<bigint> {
    return await this.contract._templateCount();
  }

  /**
   * Get current trading fee rate
   */
  async getTradingFeeRate(): Promise<bigint> {
    return await this.contract._tradingFeeRate();
  }

  /**
   * Get launch fee
   */
  async getLaunchFee(): Promise<bigint> {
    return await this.contract._launchFee();
  }

  /**
   * Get fee recipient address
   */
  async getFeeRecipient(): Promise<string> {
    return await this.contract._feeRecipient();
  }

  /**
   * Get referral reward rate
   */
  async getReferralRewardRate(): Promise<bigint> {
    return await this.contract._referralRewardRate();
  }

  /**
   * Check if trading is halted
   */
  async isTradingHalted(): Promise<boolean> {
    return await this.contract._tradingHalt();
  }

  /**
   * Get contract owner
   */
  async getOwner(): Promise<string> {
    return await this.contract.owner();
  }

  /**
   * Get signer address
   */
  async getSigner(): Promise<string> {
    return await this.contract.signer();
  }

  /**
   * Get status constants
   */
  async getStatusConstants(): Promise<{
    TRADING: bigint;
    ADDING_LIQUIDITY: bigint;
    COMPLETED: bigint;
    HALT: bigint;
  }> {
    const [TRADING, ADDING_LIQUIDITY, COMPLETED, HALT] = await Promise.all([
      this.contract.STATUS_TRADING(),
      this.contract.STATUS_ADDING_LIQUIDITY(),
      this.contract.STATUS_COMPLETED(),
      this.contract.STATUS_HALT(),
    ]);
    return { TRADING, ADDING_LIQUIDITY, COMPLETED, HALT };
  }

  /**
   * Calculate buy amount for given funds
   */
  async calcBuyAmount(tokenInfo: TokenInfo, funds: bigint): Promise<bigint> {
    Validator.validateAmount(funds, 'funds', { allowZero: true });
    throw new TransactionFailedError(
      'Exact FOUR buy amount is unavailable; use quoteBuy for display or calculateBuyWithSlippage for an executable minimum'
    );
  }

  /** Estimate output at the current marginal price. Never use this as minAmount. */
  async estimateBuyAmount(tokenInfo: TokenInfo, funds: bigint): Promise<bigint> {
    return PriceCalculator.estimateBuyAmountFromTokenInfo(tokenInfo, funds);
  }

  /**
   * Calculate buy cost for given amount
   */
  async calcBuyCost(tokenInfo: TokenInfo, amount: bigint): Promise<bigint> {
    Validator.validateAmount(amount, 'amount', { allowZero: true });
    throw new TransactionFailedError(
      'Exact FOUR buy cost is unavailable; the deployed calcBuyCost helper reverts'
    );
  }

  /** Estimate cost at the current marginal price. Never use this as maxFunds. */
  async estimateBuyCost(tokenInfo: TokenInfo, amount: bigint): Promise<bigint> {
    return PriceCalculator.estimateBuyCostFromTokenInfo(tokenInfo, amount);
  }

  /**
   * Calculate sell cost for given amount
   */
  async calcSellCost(tokenInfo: TokenInfo, amount: bigint): Promise<bigint> {
    Validator.validateAmount(amount, 'amount', { allowZero: true });
    throw new TransactionFailedError(
      'Exact FOUR sell cost is unavailable; the deployed calcSellCost helper reverts'
    );
  }

  /** Estimate proceeds from observed state. Never use this as minFunds. */
  async estimateSellCost(tokenInfo: TokenInfo, amount: bigint): Promise<bigint> {
    return PriceCalculator.estimateSellCostFromTokenInfo(tokenInfo, amount);
  }

  /**
   * Calculate trading fee
   */
  async calcTradingFee(tokenInfo: TokenInfo, funds: bigint): Promise<bigint> {
    return await this.priceCalculator.calcTradingFee(tokenInfo, funds);
  }

  /**
   * Calculate last price
   */
  async calcLastPrice(tokenInfo: TokenInfo): Promise<bigint> {
    return PriceCalculator.calcLastPriceFromTokenInfo(tokenInfo);
  }

  /**
   * Get BNB balance of wallet
   */
  async getBNBBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Get raw BNB balance in wei.
   */
  async getBNBBalanceRaw(address: string = this.wallet.address): Promise<bigint> {
    Validator.validateAddress(address, 'address');
    return await this.provider.getBalance(address);
  }

  /**
   * Get token balance of wallet
   */
  async getTokenBalance(tokenAddress: string, owner: string = this.wallet.address, decimals: number = 18): Promise<string> {
    Validator.validateDecimals(decimals);
    const balance = await this.getTokenBalanceRaw(tokenAddress, owner);
    return ethers.formatUnits(balance, decimals);
  }

  /**
   * Get raw token balance in smallest units.
   */
  async getTokenBalanceRaw(tokenAddress: string, owner: string = this.wallet.address): Promise<bigint> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    Validator.validateAddress(owner, 'owner');

    const tokenABI = ['function balanceOf(address owner) view returns (uint256)'];
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, this.provider);
    return await tokenContract.balanceOf(owner);
  }

  /**
   * Get ERC-20 metadata with static-data caching.
   */
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');

    const key = tokenAddress.toLowerCase();
    const cached = this.tokenMetadataCache.get(key);
    if (cached) {
      return cached;
    }

    const tokenABI = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
    ];
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, this.provider);

    const [nameResult, symbolResult, decimals, totalSupply] = await Promise.allSettled([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals(),
      tokenContract.totalSupply(),
    ]);

    if (decimals.status !== 'fulfilled' || totalSupply.status !== 'fulfilled') {
      throw new TransactionFailedError('Failed to load token metadata', undefined, {
        tokenAddress,
        decimalsError: decimals.status === 'rejected' ? String(decimals.reason) : undefined,
        totalSupplyError: totalSupply.status === 'rejected' ? String(totalSupply.reason) : undefined,
      });
    }

    const metadata: TokenMetadata = {
      address: tokenAddress,
      name: nameResult.status === 'fulfilled' ? nameResult.value : undefined,
      symbol: symbolResult.status === 'fulfilled' ? symbolResult.value : undefined,
      decimals: Number(decimals.value),
      totalSupply: totalSupply.value,
    };

    this.tokenMetadataCache.set(key, metadata);
    return metadata;
  }

  /**
   * Calculate FDV and circulating market cap in wei using FOUR token info.
   */
  async getMarketCap(tokenAddress: string, decimals?: number): Promise<MarketCapInfo> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');

    const [tokenInfo, metadata] = await Promise.all([
      this.priceCalculator.getTokenInfo(tokenAddress, { fresh: true }),
      decimals === undefined ? this.getTokenMetadata(tokenAddress) : Promise.resolve(null),
    ]);

    const price = PriceCalculator.calcLastPriceFromTokenInfo(tokenInfo);
    const tokenDecimals = decimals ?? metadata!.decimals;
    Validator.validateDecimals(tokenDecimals);
    const totalSupply = metadata?.totalSupply ?? tokenInfo.totalSupply;
    const divisor = 10n ** BigInt(tokenDecimals);
    const circulatingSupply = tokenInfo.maxOffers > tokenInfo.offers
      ? tokenInfo.maxOffers - tokenInfo.offers
      : 0n;
    const fdvWei = (totalSupply * price) / divisor;
    const circulatingMarketCapWei = (circulatingSupply * price) / divisor;

    return {
      token: tokenAddress,
      price,
      decimals: tokenDecimals,
      totalSupply,
      offers: tokenInfo.offers,
      circulatingSupply,
      fdvWei,
      circulatingMarketCapWei,
    };
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  getPerformanceMonitor(): PerformanceMonitor {
    return this.performance;
  }

  getWebSocketStats(): ReturnType<WebSocketManager['getStats']> {
    return this.webSocketManager.getStats();
  }

  async refreshNonce(): Promise<number | null> {
    if (!this.nonceManager) {
      return null;
    }
    return await this.nonceManager.refresh();
  }

  /**
   * Reuse a nonce only after the caller has proved that every submission path
   * failed before broadcast or that a private bundle can no longer land.
   */
  async recoverUnbroadcastNonce(nonce: number): Promise<boolean> {
    if (!this.nonceManager) {
      throw new TransactionFailedError('Local nonce management is disabled');
    }
    return await this.nonceManager.release(nonce);
  }

  async destroy(): Promise<void> {
    this.removeAllListeners();
    this.nonceManager?.stopAutoSync();
    await this.webSocketManager.destroy();
    await this.provider.destroy();
  }

  // ==================== Event Subscription ====================

  /**
   * Subscribe to TokenCreate events
   */
  onTokenCreate(listener: TokenCreateListener): string {
    const id = `tokenCreate_${Date.now()}_${Math.random()}`;

    const contractListener = (creator: string, token: string, requestId: bigint, name: string, symbol: string, totalSupply: bigint, launchTime: bigint, launchFee: bigint, payload?: any) => {
      const event: TokenCreateEvent = {
        creator,
        token,
        requestId,
        name,
        symbol,
        totalSupply,
        launchTime,
        launchFee,
        metadata: this.extractEventMetadata(payload),
      };
      listener(event);
    };

    this.tokenCreateListeners.set(id, { listener, contractListener });
    this.eventContract.on('TokenCreate', contractListener);

    return id;
  }

  /**
   * Subscribe to TokenPurchase events
   */
  onTokenPurchase(listener: TokenPurchaseListener, tokenAddress?: string): string {
    if (tokenAddress) {
      Validator.validateAddress(tokenAddress, 'tokenAddress');
    }

    const id = `tokenPurchase_${Date.now()}_${Math.random()}`;

    const contractListener = (token: string, account: string, price: bigint, amount: bigint, cost: bigint, fee: bigint, offers: bigint, funds: bigint, payload?: any) => {
      if (tokenAddress && token.toLowerCase() !== tokenAddress.toLowerCase()) {
        return; // Filter by token address if provided
      }

      const event: TokenPurchaseEvent = {
        token,
        account,
        price,
        amount,
        cost,
        fee,
        offers,
        funds,
        metadata: this.extractEventMetadata(payload),
      };
      listener(event);
    };

    this.tokenPurchaseListeners.set(id, { listener, contractListener });
    this.eventContract.on('TokenPurchase', contractListener);

    return id;
  }

  /**
   * Subscribe to TokenSale events
   */
  onTokenSale(listener: TokenSaleListener, tokenAddress?: string): string {
    if (tokenAddress) {
      Validator.validateAddress(tokenAddress, 'tokenAddress');
    }

    const id = `tokenSale_${Date.now()}_${Math.random()}`;

    const contractListener = (token: string, account: string, price: bigint, amount: bigint, cost: bigint, fee: bigint, offers: bigint, funds: bigint, payload?: any) => {
      if (tokenAddress && token.toLowerCase() !== tokenAddress.toLowerCase()) {
        return;
      }

      const event: TokenSaleEvent = {
        token,
        account,
        price,
        amount,
        cost,
        fee,
        offers,
        funds,
        metadata: this.extractEventMetadata(payload),
      };
      listener(event);
    };

    this.tokenSaleListeners.set(id, { listener, contractListener });
    this.eventContract.on('TokenSale', contractListener);

    return id;
  }

  /**
   * Subscribe to LiquidityAdded events
   */
  onLiquidityAdded(listener: LiquidityAddedListener): string {
    const id = `liquidityAdded_${Date.now()}_${Math.random()}`;

    const contractListener = (base: string, offers: bigint, quote: string, funds: bigint, payload?: any) => {
      const event: LiquidityAddedEvent = {
        base,
        offers,
        quote,
        funds,
        metadata: this.extractEventMetadata(payload),
      };
      listener(event);
    };

    this.liquidityAddedListeners.set(id, { listener, contractListener });
    this.eventContract.on('LiquidityAdded', contractListener);

    return id;
  }

  /**
   * Unsubscribe from an event
   */
  off(listenerId: string): void {
    // Check TokenCreate listeners
    if (this.tokenCreateListeners.has(listenerId)) {
      const { contractListener } = this.tokenCreateListeners.get(listenerId)!;
      this.eventContract.off('TokenCreate', contractListener);
      this.tokenCreateListeners.delete(listenerId);
      return;
    }

    // Check TokenPurchase listeners
    if (this.tokenPurchaseListeners.has(listenerId)) {
      const { contractListener } = this.tokenPurchaseListeners.get(listenerId)!;
      this.eventContract.off('TokenPurchase', contractListener);
      this.tokenPurchaseListeners.delete(listenerId);
      return;
    }

    // Check TokenSale listeners
    if (this.tokenSaleListeners.has(listenerId)) {
      const { contractListener } = this.tokenSaleListeners.get(listenerId)!;
      this.eventContract.off('TokenSale', contractListener);
      this.tokenSaleListeners.delete(listenerId);
      return;
    }

    // Check LiquidityAdded listeners
    if (this.liquidityAddedListeners.has(listenerId)) {
      const { contractListener } = this.liquidityAddedListeners.get(listenerId)!;
      this.eventContract.off('LiquidityAdded', contractListener);
      this.liquidityAddedListeners.delete(listenerId);
      return;
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventContract.removeAllListeners();
    this.tokenCreateListeners.clear();
    this.tokenPurchaseListeners.clear();
    this.tokenSaleListeners.clear();
    this.liquidityAddedListeners.clear();
  }

  /**
   * Query historical events
   */
  async getTokenCreateEvents(fromBlock: number = 0, toBlock: number | string = 'latest'): Promise<TokenCreateEvent[]> {
    const filter = this.contract.filters.TokenCreate();
    const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

    return events.map((event: any) => ({
      creator: event.args.creator,
      token: event.args.token,
      requestId: event.args.requestId,
      name: event.args.name,
      symbol: event.args.symbol,
      totalSupply: event.args.totalSupply,
      launchTime: event.args.launchTime,
      launchFee: event.args.launchFee,
      metadata: this.extractEventMetadata(event),
    }));
  }

  /**
   * Query historical TokenPurchase events
   */
  async getTokenPurchaseEvents(tokenAddress?: string, fromBlock: number = 0, toBlock: number | string = 'latest'): Promise<TokenPurchaseEvent[]> {
    if (tokenAddress) {
      Validator.validateAddress(tokenAddress, 'tokenAddress');
    }

    const filter = this.contract.filters.TokenPurchase();
    const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

    return events
      .filter((event: any) => !tokenAddress || event.args.token.toLowerCase() === tokenAddress.toLowerCase())
      .map((event: any) => ({
        token: event.args.token,
        account: event.args.account,
        price: event.args.price,
        amount: event.args.amount,
        cost: event.args.cost,
        fee: event.args.fee,
        offers: event.args.offers,
        funds: event.args.funds,
        metadata: this.extractEventMetadata(event),
      }));
  }

  /**
   * Query historical TokenSale events
   */
  async getTokenSaleEvents(tokenAddress?: string, fromBlock: number = 0, toBlock: number | string = 'latest'): Promise<TokenSaleEvent[]> {
    if (tokenAddress) {
      Validator.validateAddress(tokenAddress, 'tokenAddress');
    }

    const filter = this.contract.filters.TokenSale();
    const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

    return events
      .filter((event: any) => !tokenAddress || event.args.token.toLowerCase() === tokenAddress.toLowerCase())
      .map((event: any) => ({
        token: event.args.token,
        account: event.args.account,
        price: event.args.price,
        amount: event.args.amount,
        cost: event.args.cost,
        fee: event.args.fee,
        offers: event.args.offers,
        funds: event.args.funds,
        metadata: this.extractEventMetadata(event),
      }));
  }
}
