// Main entry point for FOUR Trading SDK
export {
  FourTrading,
  FourTradingConfig,
  BuyParams,
  SellParams,
  SellMode,
  CreateTokenParams,
  GasOptions,
  TokenCreateListener,
  TokenPurchaseListener,
  TokenSaleListener,
  LiquidityAddedListener,
} from './fourTrading';

export {
  EventMetadata,
  MarketCapInfo,
  TokenInfo,
  TokenInfoEx,
  TokenMetadata,
  Template,
  TokenStatus,
  TransactionResult,
  TokenCreateEvent,
  TokenPurchaseEvent,
  TokenSaleEvent,
  LiquidityAddedEvent,
} from './types';

export { FOUR_TRADING_ABI } from './abi';

export { PriceCalculator, PriceInfo, TokenInfoQueryOptions } from './priceCalculator';

// Error classes
export {
  FourTradingError,
  ValidationError,
  InvalidAddressError,
  InvalidAmountError,
  InsufficientBalanceError,
  TransactionFailedError,
  ConnectionError,
  GasConfigurationError,
  SlippageExceededError,
  FeeExceedsAmountError,
} from './errors';

// Logger
export { Logger, LogLevel, LoggerConfig } from './logger';

// Cache
export { Cache, CacheConfig } from './cache';

// Validator
export { Validator } from './validator';

// Performance monitoring
export { PerformanceMonitor, PerformanceMetrics } from './performance';

// WebSocket manager
export { WebSocketManager, WebSocketManagerConfig } from './websocketManager';

// Constants
export * from './constants';

// Utility functions
export {
  parseTradeEvents,
  parseTokenCreateEvent,
  formatTimestamp,
  formatBNB,
  formatTokenAmount,
  parseBNB,
  parseTokenAmount,
  calculatePriceChange,
  isValidAddress,
  normalizeAddress,
  isFourMemeTransaction,
  getTransactionType,
  getTransactionTypeFromData,
  calculateGasCost,
  decodeFourTradingTransactionData,
  getTransactionSelectorMap,
  getTransactionSignatureFromData,
  waitForTransaction,
  FOUR_MEME_ADDRESS,
  TOKEN_CREATE_TOPIC,
  ADD_LIQUIDITY_SIGNATURE,
  CREATE_TOKEN_SIGNATURE,
} from './utils';

export type {
  ParsedTransactionInput,
} from './utils';

export {
  NonceManager,
  NonceManagerConfig,
} from './nonceManager';

export {
  NormalSubmitter,
  JsonRpcSubmitter,
  MultiSubmitter,
  createSubmitter,
  getSignedTransactionHash,
  signFortyEightSoulPointBundle,
  SubmitterConfig,
  SubmitterType,
  SubmitSignedTransactionParams,
  SubmitterResult,
  SubmitterContext,
  TransactionSubmitter,
} from './submitter';

export {
  TransactionStreamManager,
  OrderedStreamEventBuffer,
  JsonValueStreamDecoder,
  buildJsonRpcSubscribeMessage,
  createAdapterStreamSource,
  createBlockRazorGrpcStreamSource,
  createGeyserGrpcStreamSource,
  createGrpcStreamSource,
  createShredStreamSource,
  normalizeStreamMessage,
  StreamEvent,
  StreamEventType,
  StreamSourceConfig,
  StreamSourceStats,
  StreamSourceType,
  StreamOrderMode,
  StreamParserContext,
  StreamMessageParser,
  StreamMessageBuilder,
  TransactionStreamManagerConfig,
  TransactionStreamManagerStats,
  AdapterStreamSourceOptions,
  BlockRazorGrpcStreamSourceOptions,
  WebSocketFactory,
  WebSocketLike,
  GrpcStreamSourceOptions,
  GrpcStreamFactory,
  GrpcStreamFactoryContext,
  GrpcStreamLike,
  StreamAdapterEvent,
  StreamAdapterFactory,
  StreamAdapterFactoryContext,
  StreamAdapterHandle,
} from './stream';
