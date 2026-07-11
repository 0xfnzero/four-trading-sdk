/**
 * Type definitions for FOUR Trading Platform
 */

export interface TokenInfo {
  base: string;
  quote: string;
  template: bigint;
  totalSupply: bigint;
  maxOffers: bigint;
  maxRaising: bigint;
  launchTime: bigint;
  offers: bigint;
  funds: bigint;
  lastPrice: bigint;
  K: bigint;
  T: bigint;
  status: bigint;
}

export interface TokenInfoEx {
  creator: string;
  founder: string;
  reserves: bigint;
}

export interface Template {
  quote: string;
  initialLiquidity: bigint;
  maxRaising: bigint;
  totalSupply: bigint;
  maxOffers: bigint;
  minTradingFee: bigint;
}

export interface TokenStatus {
  TRADING: bigint;
  ADDING_LIQUIDITY: bigint;
  COMPLETED: bigint;
  HALT: bigint;
}

export interface TransactionResult {
  success: boolean;
  txHash: string;
  receipt: any | null;
  submitter?: string;
  bundleHash?: string;
  nonce?: number;
  gasLimit?: bigint;
  gasPrice?: bigint;
}

export interface EventMetadata {
  txHash?: string;
  blockNumber?: number;
  blockHash?: string;
  logIndex?: number;
  transactionIndex?: number;
  removed?: boolean;
}

export interface TokenCreateEvent {
  creator: string;
  token: string;
  requestId: bigint;
  name: string;
  symbol: string;
  totalSupply: bigint;
  launchTime: bigint;
  launchFee: bigint;
  metadata?: EventMetadata;
}

export interface TokenPurchaseEvent {
  token: string;
  account: string;
  price: bigint;
  amount: bigint;
  cost: bigint;
  fee: bigint;
  offers: bigint;
  funds: bigint;
  metadata?: EventMetadata;
}

export interface TokenSaleEvent {
  token: string;
  account: string;
  price: bigint;
  amount: bigint;
  cost: bigint;
  fee: bigint;
  offers: bigint;
  funds: bigint;
  metadata?: EventMetadata;
}

export interface LiquidityAddedEvent {
  base: string;
  offers: bigint;
  quote: string;
  funds: bigint;
  metadata?: EventMetadata;
}

export interface TokenMetadata {
  address: string;
  name?: string;
  symbol?: string;
  decimals: number;
  totalSupply: bigint;
}

export interface MarketCapInfo {
  token: string;
  price: bigint;
  decimals: number;
  totalSupply: bigint;
  /** Remaining inventory still offered by the FOUR curve. */
  offers: bigint;
  /** Curve inventory already sold (maxOffers - offers). */
  circulatingSupply: bigint;
  fdvWei: bigint;
  circulatingMarketCapWei: bigint;
}
