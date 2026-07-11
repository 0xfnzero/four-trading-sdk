import { ethers, JsonRpcProvider } from 'ethers';
import { Logger } from './logger';
import { TransactionFailedError, ValidationError } from './errors';

export type SubmitterType = 'normal' | 'json-rpc' | 'forty-eight' | 'blockrazor' | 'bloxroute' | 'bloxroute-private';
export type BloxrouteBundlePayloadFormat = 'txs' | 'transaction';

export interface SubmitSignedTransactionParams {
  signedTransaction: string;
  txHash: string;
  rawTransactions?: string[];
  targetBlockNumber?: bigint;
  metadata?: Record<string, unknown>;
}

export interface SubmitterResult {
  submitter: string;
  txHash: string;
  bundleHash?: string;
  rawResult?: unknown;
  submittedAt: number;
  durationMs: number;
}

export interface SubmitterConfig {
  type: SubmitterType;
  name?: string;
  url?: string;
  authToken?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  method?: string;
  bloxrouteNetwork?: string;
  bloxrouteBundlePayloadFormat?: BloxrouteBundlePayloadFormat;
  bloxrouteMevBuilders?: Record<string, string>;
  bloxroutePrivateMevBuilders?: string[];
  bloxrouteBackrunmeRewardAddress?: string;
  maxBlockNumber?: bigint;
  targetBlockOffset?: bigint;
  minTimestamp?: number;
  maxTimestamp?: number;
  revertingTxHashes?: string[];
  noMerge?: boolean;
  backrunTarget?: string;
  positionFirst?: boolean;
  blocksCount?: number;
  frontRunningProtection?: boolean;
  backRunningProtection?: boolean;
  nodeValidation?: boolean;
  fortyEightSignature?: string;
  fortyEightSignerPrivateKey?: string;
}

export interface SubmitterContext {
  provider: JsonRpcProvider;
  logger?: Logger;
  signerPrivateKey?: string;
}

export interface TransactionSubmitter {
  readonly name: string;
  submitSignedTransaction(params: SubmitSignedTransactionParams): Promise<SubmitterResult>;
}

export class NormalSubmitter implements TransactionSubmitter {
  readonly name: string;
  private provider: JsonRpcProvider;

  constructor(provider: JsonRpcProvider, name: string = 'normal') {
    this.provider = provider;
    this.name = name;
  }

  async submitSignedTransaction(params: SubmitSignedTransactionParams): Promise<SubmitterResult> {
    const submittedAt = Date.now();
    const response = await this.provider.broadcastTransaction(params.signedTransaction);

    return {
      submitter: this.name,
      txHash: response.hash,
      submittedAt,
      durationMs: Date.now() - submittedAt,
    };
  }
}

export class JsonRpcSubmitter implements TransactionSubmitter {
  readonly name: string;
  private config: SubmitterConfig;
  private provider?: JsonRpcProvider;
  private signerPrivateKey?: string;

  constructor(config: SubmitterConfig, context?: SubmitterContext) {
    if (!config.url) {
      throw new ValidationError(`Submitter ${config.type} requires url`);
    }

    this.config = config;
    this.name = config.name || config.type;
    this.provider = context?.provider;
    this.signerPrivateKey = config.fortyEightSignerPrivateKey || context?.signerPrivateKey;
  }

  async submitSignedTransaction(params: SubmitSignedTransactionParams): Promise<SubmitterResult> {
    const submittedAt = Date.now();
    const payload = await this.buildPayload(params);
    const rawResult = await this.postJson(payload);
    const bundleHash = this.isBundleSubmitter()
      ? this.extractBundleHash(rawResult)
      : undefined;

    return {
      submitter: this.name,
      txHash: params.txHash,
      bundleHash,
      rawResult,
      submittedAt,
      durationMs: Date.now() - submittedAt,
    };
  }

  private async buildPayload(params: SubmitSignedTransactionParams): Promise<Record<string, unknown>> {
    const rawTransactions = [
      ...(params.rawTransactions || []),
      params.signedTransaction,
    ];

    switch (this.config.type) {
      case 'forty-eight': {
        const fortyEightSignature = this.config.fortyEightSignature
          || this.signFortyEightBundle(rawTransactions);
        const targetBlockNumber = params.targetBlockNumber ?? await this.resolveTargetBlockNumber();

        return {
          jsonrpc: '2.0',
          id: '1',
          method: this.config.method || 'eth_sendBundle',
          params: [{
            txs: rawTransactions,
            ...(fortyEightSignature ? { '48spSign': fortyEightSignature } : {}),
            ...this.buildBundleCommonParams(targetBlockNumber),
          }],
        };
      }

      case 'blockrazor': {
        const targetBlockNumber = params.targetBlockNumber ?? await this.resolveTargetBlockNumber();

        return {
          jsonrpc: '2.0',
          id: '1',
          method: this.config.method || 'eth_sendBundle',
          params: [{
            txs: rawTransactions,
            ...this.buildBundleCommonParams(targetBlockNumber),
          }],
        };
      }

      case 'bloxroute': {
        const targetBlockNumber = params.targetBlockNumber ?? await this.resolveTargetBlockNumber();
        const transactionField = this.config.bloxrouteBundlePayloadFormat === 'transaction'
          ? 'transaction'
          : 'txs';
        const transactionValues = rawTransactions.map(tx => tx.startsWith('0x') ? tx.slice(2) : tx);

        return {
          id: '1',
          method: this.config.method || 'blxr_submit_bundle',
          params: {
            [transactionField]: transactionValues,
            blockchain_network: this.config.bloxrouteNetwork || 'BSC-Mainnet',
            ...(targetBlockNumber !== undefined ? { max_block_number: `0x${targetBlockNumber.toString(16)}` } : {}),
            ...(this.config.blocksCount !== undefined ? { blocks_count: this.config.blocksCount } : {}),
            ...this.buildBloxrouteBundleParams(),
          },
        };
      }

      case 'bloxroute-private':
        return {
          id: '1',
          method: this.config.method || 'bsc_private_tx',
          params: {
            transaction: params.signedTransaction.startsWith('0x')
              ? params.signedTransaction.slice(2)
              : params.signedTransaction,
            blockchain_network: this.config.bloxrouteNetwork || 'BSC-Mainnet',
            ...this.buildBloxroutePrivateParams(),
            ...this.buildBloxrouteProtectionParams(),
          },
        };

      case 'json-rpc':
      default:
        return {
          jsonrpc: '2.0',
          id: '1',
          method: this.config.method || 'eth_sendRawTransaction',
          params: [params.signedTransaction],
        };
    }
  }

  private buildBundleCommonParams(maxBlockNumber?: bigint): Record<string, unknown> {
    return {
      ...(maxBlockNumber !== undefined ? { maxBlockNumber: Number(maxBlockNumber) } : {}),
      ...(this.config.minTimestamp !== undefined ? { minTimestamp: this.config.minTimestamp } : {}),
      ...(this.config.maxTimestamp !== undefined ? { maxTimestamp: this.config.maxTimestamp } : {}),
      ...(this.config.revertingTxHashes ? { revertingTxHashes: this.config.revertingTxHashes } : {}),
      ...(this.config.noMerge !== undefined ? { noMerge: this.config.noMerge } : {}),
      ...(this.config.backrunTarget !== undefined ? { backrunTarget: this.config.backrunTarget } : {}),
      ...(this.config.positionFirst !== undefined ? { positionFirst: this.config.positionFirst } : {}),
    };
  }

  private buildBloxrouteBundleParams(): Record<string, unknown> {
    return {
      ...(this.config.minTimestamp !== undefined ? { min_timestamp: this.config.minTimestamp } : {}),
      ...(this.config.maxTimestamp !== undefined ? { max_timestamp: this.config.maxTimestamp } : {}),
      ...(this.config.revertingTxHashes ? { reverting_tx_hashes: this.config.revertingTxHashes } : {}),
      ...(this.config.noMerge !== undefined ? { no_merge: this.config.noMerge } : {}),
      ...(this.config.bloxrouteBackrunmeRewardAddress !== undefined ? { backrunme_reward_address: this.config.bloxrouteBackrunmeRewardAddress } : {}),
      mev_builders: this.config.bloxrouteMevBuilders || { all: '' },
    };
  }

  private buildBloxroutePrivateParams(): Record<string, unknown> {
    const mevBuilders = this.config.bloxroutePrivateMevBuilders
      || (this.config.bloxrouteMevBuilders ? Object.keys(this.config.bloxrouteMevBuilders) : undefined);

    return {
      ...(mevBuilders ? { mev_builders: mevBuilders } : {}),
      ...(this.config.bloxrouteBackrunmeRewardAddress !== undefined ? { backrunme_reward_address: this.config.bloxrouteBackrunmeRewardAddress } : {}),
    };
  }

  private buildBloxrouteProtectionParams(): Record<string, unknown> {
    return {
      ...(this.config.frontRunningProtection !== undefined ? { front_running_protection: this.config.frontRunningProtection } : {}),
      ...(this.config.backRunningProtection !== undefined ? { back_running_protection: this.config.backRunningProtection } : {}),
      ...(this.config.nodeValidation !== undefined ? { node_validation: this.config.nodeValidation } : {}),
    };
  }

  private signFortyEightBundle(rawTransactions: string[]): string | undefined {
    if (!this.signerPrivateKey) {
      return undefined;
    }

    return signFortyEightSoulPointBundle(this.signerPrivateKey, rawTransactions);
  }

  private async resolveTargetBlockNumber(): Promise<bigint | undefined> {
    if (this.config.maxBlockNumber !== undefined) {
      return this.config.maxBlockNumber;
    }

    if (this.config.targetBlockOffset === undefined) {
      return undefined;
    }

    if (!this.provider) {
      throw new TransactionFailedError(`Submitter ${this.name} requires provider for targetBlockOffset`);
    }

    const currentBlock = await this.provider.getBlockNumber();
    return BigInt(currentBlock) + this.config.targetBlockOffset;
  }

  private async postJson(payload: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30000);

    try {
      const response = await fetch(this.config.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.authToken ? { Authorization: this.config.authToken } : {}),
          ...(this.config.headers || {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: any = text;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      if (!response.ok) {
        throw new TransactionFailedError(
          `Submitter ${this.name} HTTP ${response.status}`,
          undefined,
          { response: parsed }
        );
      }

      if (parsed?.error) {
        throw new TransactionFailedError(
          `Submitter ${this.name} returned error: ${parsed.error.message || JSON.stringify(parsed.error)}`,
          undefined,
          { error: parsed.error }
        );
      }

      return parsed?.result ?? parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractBundleHash(result: unknown): string | undefined {
    if (typeof result === 'string') {
      return result;
    }

    if (result && typeof result === 'object') {
      const record = result as Record<string, unknown>;
      if (typeof record.bundleHash === 'string') {
        return record.bundleHash;
      }
      if (typeof record.bundle_hash === 'string') {
        return record.bundle_hash;
      }
    }

    return undefined;
  }

  private isBundleSubmitter(): boolean {
    return this.config.type === 'forty-eight'
      || this.config.type === 'blockrazor'
      || this.config.type === 'bloxroute';
  }
}

export class MultiSubmitter implements TransactionSubmitter {
  readonly name = 'multi';
  private submitters: TransactionSubmitter[];
  private logger: Logger;

  constructor(submitters: TransactionSubmitter[], logger?: Logger) {
    if (submitters.length === 0) {
      throw new ValidationError('MultiSubmitter requires at least one submitter');
    }

    this.submitters = submitters;
    this.logger = logger || new Logger();
  }

  async submitSignedTransaction(params: SubmitSignedTransactionParams): Promise<SubmitterResult> {
    return await new Promise<SubmitterResult>((resolve, reject) => {
      const errors: unknown[] = [];
      let settled = false;
      let completed = 0;

      for (const submitter of this.submitters) {
        submitter.submitSignedTransaction(params)
          .then(result => {
            this.logger.debug('Submitter succeeded', {
              submitter: submitter.name,
              txHash: result.txHash,
              durationMs: result.durationMs,
            });

            if (!settled) {
              settled = true;
              resolve(result);
            }
          })
          .catch(error => {
            errors.push(error);
            this.logger.warn('Submitter failed', {
              submitter: submitter.name,
              error: error instanceof Error ? error.message : String(error),
            });
          })
          .finally(() => {
            completed += 1;
            if (!settled && completed === this.submitters.length) {
              reject(new TransactionFailedError(
                'All submitters failed',
                params.txHash,
                { errors: errors.map(err => err instanceof Error ? err.message : String(err)) }
              ));
            }
          });
      }
    });
  }
}

export function createSubmitter(configs: SubmitterConfig[] | undefined, context: SubmitterContext): TransactionSubmitter {
  const logger = context.logger || new Logger();
  const submitterConfigs = configs && configs.length > 0 ? configs : [{ type: 'normal' as const }];

  const submitters = submitterConfigs.map(config => {
    if (config.type === 'normal') {
      return new NormalSubmitter(context.provider, config.name);
    }
    return new JsonRpcSubmitter(config, context);
  });

  if (submitters.length === 1) {
    return submitters[0];
  }

  return new MultiSubmitter(submitters, logger);
}

export function getSignedTransactionHash(signedTransaction: string): string {
  const tx = ethers.Transaction.from(signedTransaction);
  if (!tx.hash) {
    throw new TransactionFailedError('Unable to derive signed transaction hash');
  }
  return tx.hash;
}

export function signFortyEightSoulPointBundle(privateKey: string, rawTransactions: string[]): string {
  if (rawTransactions.length === 0) {
    throw new ValidationError('48.club bundle signature requires at least one raw transaction');
  }

  const signingKey = new ethers.SigningKey(normalizePrivateKey(privateKey));
  const transactionHashBytes = rawTransactions.map(rawTransaction => {
    const tx = ethers.Transaction.from(rawTransaction);
    if (!tx.hash) {
      throw new TransactionFailedError('Unable to derive transaction hash for 48.club bundle signature');
    }
    return ethers.getBytes(tx.hash);
  });

  const digest = ethers.keccak256(ethers.concat(transactionHashBytes));
  const signature = signingKey.sign(digest);

  return ethers.hexlify(ethers.concat([
    ethers.getBytes(signature.r),
    ethers.getBytes(signature.s),
    new Uint8Array([signature.yParity]),
  ]));
}

function normalizePrivateKey(privateKey: string): string {
  const normalized = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  if (!ethers.isHexString(normalized, 32)) {
    throw new ValidationError('Private key must be 64 hexadecimal characters (with or without 0x prefix)');
  }
  return normalized;
}
