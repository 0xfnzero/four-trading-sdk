import { ethers, TransactionReceipt, TransactionResponse } from 'ethers';
import { TokenCreateEvent, TokenPurchaseEvent, TokenSaleEvent } from './types';
import { FOUR_TRADING_ABI } from './abi';
import {
  FOUR_MEME_ADDRESS,
  TOKEN_CREATE_TOPIC,
  ADD_LIQUIDITY_SIGNATURE,
  CREATE_TOKEN_SIGNATURE,
} from './constants';

/**
 * Utility functions for transaction and event parsing
 */

export {
  FOUR_MEME_ADDRESS,
  TOKEN_CREATE_TOPIC,
  ADD_LIQUIDITY_SIGNATURE,
  CREATE_TOKEN_SIGNATURE,
} from './constants';

export interface ParsedTransactionInput {
  name: string;
  signature: string;
  selector: string;
  args: Record<string, unknown>;
  rawArgs: readonly unknown[];
}

const FOUR_TRADING_INTERFACE = new ethers.Interface(FOUR_TRADING_ABI);

const TRANSACTION_SELECTOR_MAP: Record<string, { name: string; signature: string }> =
  FOUR_TRADING_INTERFACE.fragments.reduce((acc, fragment: any) => {
    if (fragment.type === 'function' && fragment.selector) {
      acc[fragment.selector.toLowerCase()] = {
        name: fragment.name,
        signature: fragment.format('sighash'),
      };
    }
    return acc;
  }, {} as Record<string, { name: string; signature: string }>);

/**
 * Parse transaction receipt for trading events
 */
export async function parseTradeEvents(
  receipt: TransactionReceipt,
  contract: ethers.Contract
): Promise<{
  purchases: TokenPurchaseEvent[];
  sales: TokenSaleEvent[];
}> {
  const purchases: TokenPurchaseEvent[] = [];
  const sales: TokenSaleEvent[] = [];

  for (const log of receipt.logs) {
    try {
      const parsedLog = contract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (!parsedLog) {
        continue;
      }

      if (parsedLog.name === 'TokenPurchase') {
        purchases.push({
          token: parsedLog.args.token,
          account: parsedLog.args.account,
          price: parsedLog.args.price,
          amount: parsedLog.args.amount,
          cost: parsedLog.args.cost,
          fee: parsedLog.args.fee,
          offers: parsedLog.args.offers,
          funds: parsedLog.args.funds,
        });
      } else if (parsedLog.name === 'TokenSale') {
        sales.push({
          token: parsedLog.args.token,
          account: parsedLog.args.account,
          price: parsedLog.args.price,
          amount: parsedLog.args.amount,
          cost: parsedLog.args.cost,
          fee: parsedLog.args.fee,
          offers: parsedLog.args.offers,
          funds: parsedLog.args.funds,
        });
      }
    } catch (error) {
      // Ignore logs that can't be parsed
      continue;
    }
  }

  return { purchases, sales };
}

/**
 * Parse TokenCreate event from transaction receipt
 */
export async function parseTokenCreateEvent(
  receipt: TransactionReceipt,
  contract: ethers.Contract
): Promise<TokenCreateEvent | null> {
  for (const log of receipt.logs) {
    if (!log.topics[0] || log.topics[0].toLowerCase() !== TOKEN_CREATE_TOPIC.toLowerCase()) {
      continue;
    }

    try {
      const parsedLog = contract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (!parsedLog) {
        continue;
      }

      return {
        creator: parsedLog.args.creator,
        token: parsedLog.args.token,
        requestId: parsedLog.args.requestId,
        name: parsedLog.args.name,
        symbol: parsedLog.args.symbol,
        totalSupply: parsedLog.args.totalSupply,
        launchTime: parsedLog.args.launchTime,
        launchFee: parsedLog.args.launchFee,
      };
    } catch (error) {
      continue;
    }
  }

  return null;
}

/**
 * Format timestamp to readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Format BNB amount to readable string
 */
export function formatBNB(amount: bigint): string {
  return ethers.formatEther(amount);
}

/**
 * Format token amount to readable string
 */
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Parse BNB amount from string to bigint
 * @param amount - Amount in BNB as string
 * @returns Amount in wei as bigint
 */
export function parseBNB(amount: string): bigint {
  return ethers.parseEther(amount);
}

/**
 * Parse token amount from string to bigint
 * @param amount - Amount as string
 * @param decimals - Token decimals (default 18)
 * @returns Amount in smallest unit as bigint
 */
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  return ethers.parseUnits(amount, decimals);
}

/**
 * Calculate percentage change
 */
export function calculatePriceChange(oldPrice: bigint, newPrice: bigint): number {
  if (oldPrice === 0n) return 0;
  const numerator = (newPrice - oldPrice) * 10_000n;
  const rounded = divideRounded(numerator, oldPrice);
  return Number(rounded) / 100;
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  let quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const shouldRoundUp = negative
    ? remainder * 2n > absoluteDenominator
    : remainder * 2n >= absoluteDenominator;

  if (shouldRoundUp) {
    quotient += 1n;
  }
  return negative ? -quotient : quotient;
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Normalize address to lowercase
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Check if transaction is to FOUR contract
 */
export function isFourMemeTransaction(tx: TransactionResponse): boolean {
  return tx.to?.toLowerCase() === FOUR_MEME_ADDRESS.toLowerCase();
}

/**
 * Get transaction type from signature
 */
export function getTransactionType(tx: TransactionResponse): string | null {
  return getTransactionTypeFromData(tx.data);
}

export function getTransactionTypeFromData(data?: string): string | null {
  if (!data || data.length < 10) return null;

  const selector = data.slice(0, 10).toLowerCase();
  return TRANSACTION_SELECTOR_MAP[selector]?.name || 'unknown';
}

export function getTransactionSignatureFromData(data?: string): string | null {
  if (!data || data.length < 10) return null;

  const selector = data.slice(0, 10).toLowerCase();
  return TRANSACTION_SELECTOR_MAP[selector]?.signature || null;
}

export function getTransactionSelectorMap(): Record<string, { name: string; signature: string }> {
  return { ...TRANSACTION_SELECTOR_MAP };
}

/**
 * Decode FOUR Trading calldata using the ABI instead of hand-written offsets.
 */
export function decodeFourTradingTransactionData(data: string, value?: bigint): ParsedTransactionInput | null {
  if (!data || data.length < 10) {
    return null;
  }

  const selector = data.slice(0, 10).toLowerCase();
  if (!TRANSACTION_SELECTOR_MAP[selector]) {
    return null;
  }

  let parsed;
  try {
    parsed = FOUR_TRADING_INTERFACE.parseTransaction({
      data,
      value: value ?? 0n,
    });
  } catch {
    return null;
  }

  if (!parsed) {
    return null;
  }

  const args: Record<string, unknown> = {};
  parsed.fragment.inputs.forEach((input, index) => {
    const name = input.name || `arg${index}`;
    args[name] = parsed.args[index];
  });

  return {
    name: parsed.name,
    signature: parsed.signature,
    selector,
    args,
    rawArgs: Array.from(parsed.args),
  };
}

/**
 * Calculate gas cost in BNB
 */
export function calculateGasCost(receipt: TransactionReceipt): string {
  const gasCost = receipt.gasUsed * (receipt.gasPrice || 0n);
  return ethers.formatEther(gasCost);
}

/**
 * Wait for transaction confirmation with timeout
 */
export async function waitForTransaction(
  provider: ethers.Provider,
  txHash: string,
  confirmations: number = 1,
  timeout: number = 120000,
  pollIntervalMs: number = 1000
): Promise<TransactionReceipt | null> {
  const startTime = Date.now();
  const interval = Math.max(50, pollIntervalMs);

  while (Date.now() - startTime < timeout) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      const currentConfirmations = await receipt.confirmations();
      if (currentConfirmations >= confirmations) {
        return receipt;
      }
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Transaction ${txHash} timeout after ${timeout}ms`);
}
