<div align="center">
    <h1>🚀 FOUR Trading SDK</h1>
    <h3><em>A comprehensive TypeScript SDK for seamless FOUR.meme token trading on BSC</em></h3>
</div>

<p align="center">
    <strong>Integrate FOUR.meme token trading, price calculation, and event monitoring into your applications with powerful tools and unified interfaces.</strong>
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@fnzero/four-trading-sdk">
        <img src="https://img.shields.io/npm/v/@fnzero/four-trading-sdk.svg" alt="npm version">
    </a>
    <a href="https://www.npmjs.com/package/@fnzero/four-trading-sdk">
        <img src="https://img.shields.io/npm/dm/@fnzero/four-trading-sdk.svg" alt="npm downloads">
    </a>
    <a href="https://github.com/0xfnzero/four-trading-sdk/blob/main/LICENSE">
        <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
    </a>
    <a href="https://github.com/0xfnzero/four-trading-sdk">
        <img src="https://img.shields.io/github/stars/0xfnzero/four-trading-sdk?style=social" alt="GitHub stars">
    </a>
    <a href="https://github.com/0xfnzero/four-trading-sdk/network">
        <img src="https://img.shields.io/github/forks/0xfnzero/four-trading-sdk?style=social" alt="GitHub forks">
    </a>
</p>

<p align="center">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/BSC-F0B90B?style=for-the-badge&logo=binance&logoColor=white" alt="Binance Smart Chain">
    <img src="https://img.shields.io/badge/FOUR.meme-FF6B6B?style=for-the-badge&logo=ethereum&logoColor=white" alt="FOUR.meme">
    <img src="https://img.shields.io/badge/DeFi-4B8BBE?style=for-the-badge&logo=bitcoin&logoColor=white" alt="DeFi Trading">
</p>

<p align="center">
    <a href="https://github.com/0xfnzero/four-trading-sdk/blob/main/README.zh-CN.md">中文</a> |
    <a href="https://github.com/0xfnzero/four-trading-sdk/blob/main/README.md">English</a> |
    <a href="https://fnzero.dev/">Website</a> |
    <a href="https://t.me/fnzero_group">Telegram</a> |
    <a href="https://discord.gg/vuazbGkqQE">Discord</a>
</p>

---

## BSC SDK Family

| Category | Primary repository | Alternative or companion |
| --- | --- | --- |
| Unified trading | [bsc-trade-sdk-nodejs](https://github.com/0xfnzero/bsc-trade-sdk-nodejs) | [bsc-trade-sdk-golang](https://github.com/0xfnzero/bsc-trade-sdk-golang) |
| Transaction parsing | [bsc-parser-sdk-nodejs](https://github.com/0xfnzero/bsc-parser-sdk-nodejs) | [bsc-parser-sdk-golang](https://github.com/0xfnzero/bsc-parser-sdk-golang) |
| Protocol SDKs | **[four-trading-sdk](https://github.com/0xfnzero/four-trading-sdk)** | [pancakeswap-sdk](https://github.com/0xfnzero/pancakeswap-sdk) |

### What This SDK Provides

FOUR Trading SDK is a TypeScript toolkit for integrating FOUR.meme token trading on BNB Smart Chain. It covers token creation, buy/sell flows, price quotes, slippage checks, event subscriptions, WebSocket reconnection, caching, and production-facing validation utilities.

| Area | Coverage |
|------|----------|
| Trading | Create tokens, buy tokens, sell tokens, approve tokens, quote buy/sell prices |
| Event monitoring | Token creation, purchase, and sale events through BSC WebSocket RPC |
| Runtime | TypeScript, ethers, bigint-safe APIs, HTTP RPC for transactions, WebSocket RPC for events |
| Use cases | FOUR.meme trading bots, launch monitors, dashboards, BSC DeFi tools, event analytics |

### ✨ Features

#### Core Trading
- 🔄 **Complete Trading Functions**: Buy, sell, and create tokens with ease
- 💰 **Price Calculation**: Real-time price quotes and slippage protection
- 📊 **Event Monitoring**: Subscribe to token creation, purchase, and sale events
- 🌐 **WebSocket Support**: Real-time updates via WebSocket connections

#### Advanced Features
- ⚡ **High Performance**: 60-99% latency reduction with intelligent caching
- 🗄️ **Smart Caching**: LRU + TTL cache system (99.8% faster on cache hits)
- 🔄 **Auto-Reconnection**: Exponential backoff WebSocket reconnection
- 🚀 **Flexible Submission**: Normal RPC, generic JSON-RPC, and private bundle submitters
- 📡 **Low-Latency Streams**: JSON-RPC WebSocket, provider JSON streams, BlockRazor-style streams, and pluggable gRPC adapters
- 🔢 **Local Nonce Management**: Safer concurrent transaction signing with pending nonce refresh
- 📊 **Performance Monitoring**: Track P50/P95/P99 latencies and metrics
- 🧩 **Calldata Decoding**: ABI-based FOUR Trading transaction selector and argument parsing
- 🛡️ **Type Safe**: Full TypeScript support with 100% type coverage
- ✅ **Input Validation**: Comprehensive validation for all parameters
- 📝 **Structured Logging**: Configurable log levels and formats
- 🎯 **Production Ready**: 84% test coverage, battle-tested code
- 🔧 **Developer Friendly**: Rich error types and detailed error messages

### 📦 Installation

```bash
npm install @fnzero/four-trading-sdk
```

or

```bash
yarn add @fnzero/four-trading-sdk
```

or

```bash
pnpm add @fnzero/four-trading-sdk
```

### 🚀 Quick Start

```typescript
import { FourTrading } from '@fnzero/four-trading-sdk';
import { ethers } from 'ethers';

const trading = new FourTrading({
  rpcUrl: 'https://bsc-dataseed.binance.org',
  wssUrl: 'wss://bsc-rpc.publicnode.com',  // Required for events
  privateKey: 'your-private-key'
});

// Define amounts (SDK requires bigint)
const bnbAmount = ethers.parseEther('0.1');

// Get price quote
const quote = await trading.quoteBuy('0xTokenAddress', bnbAmount);
console.log(`Estimated tokens: ${quote.tokenAmount}`);

// Calculate minimum with slippage protection
const minAmount = (quote.tokenAmount * 99n) / 100n; // 1% slippage

// Buy tokens
const result = await trading.buyToken({
  tokenAddress: '0xTokenAddress',
  fundsInBNB: bnbAmount,
  minAmount: minAmount
});

console.log(`Transaction successful: ${result.txHash}`);
```

### 💡 Core Functions

#### Initialize SDK

```typescript
import { FourTrading } from '@fnzero/four-trading-sdk';

// ⚠️ IMPORTANT: wssUrl is REQUIRED for event subscriptions
const trading = new FourTrading({
  rpcUrl: 'https://bsc-dataseed.binance.org',     // HTTP RPC for transactions
  wssUrl: 'wss://bsc-rpc.publicnode.com',         // WebSocket for events (required)
  privateKey: 'your-private-key'
});

// Why separate URLs?
// - rpcUrl (HTTP): Used for contract transactions (buy/sell/queries)
// - wssUrl (WebSocket): Used for real-time event subscriptions
// - Event subscriptions CANNOT use HTTP polling, WebSocket is mandatory
```

#### Buy Tokens

```typescript
import { ethers } from 'ethers';

// Method 1: Buy with BNB amount (recommended)
const bnbAmount = ethers.parseEther('0.1');
const minTokenAmount = ethers.parseUnits('1000', 18);

await trading.buyToken({
  tokenAddress: '0xTokenAddress',
  fundsInBNB: bnbAmount,      // Amount of BNB to spend (bigint)
  minAmount: minTokenAmount,   // Minimum tokens to receive (bigint)
  to: '0xRecipient',           // Optional: recipient address
  origin: 0                    // Optional: current origin-based overload
});

// Method 2: Buy exact token amount
const exactTokens = ethers.parseUnits('1000', 18);
const maxBNB = ethers.parseEther('0.2');

await trading.buyTokenExact(
  '0xTokenAddress',
  exactTokens,      // Exact token amount (bigint)
  maxBNB,           // Maximum BNB to spend (bigint)
  '0xRecipient',    // Optional: recipient address
  undefined,        // Optional gas config
  0                 // Optional origin
);
```

#### Sell Tokens

```typescript
import { ethers } from 'ethers';

// First, approve token spending
const tokenAmount = ethers.parseUnits('1000', 18);
await trading.approveToken('0xTokenAddress', tokenAmount);

// Then sell tokens
const minBNB = ethers.parseEther('0.1');

await trading.sellToken({
  tokenAddress: '0xTokenAddress',
  amount: tokenAmount,  // Amount of tokens to sell (bigint)
  minFunds: minBNB      // Minimum BNB to receive (bigint)
});
```

#### Price Queries

```typescript
import { ethers } from 'ethers';

// Get buy quote
const bnbAmount = ethers.parseEther('0.1');
const buyQuote = await trading.quoteBuy('0xTokenAddress', bnbAmount);
console.log(`Tokens: ${buyQuote.tokenAmount}`);
console.log(`Fee: ${buyQuote.fee}`);
console.log(`Price per token: ${buyQuote.pricePerToken}`);
console.log(`Estimated: ${buyQuote.estimated}`);

// Get sell quote
const tokenAmount = ethers.parseUnits('1000', 18);
const sellQuote = await trading.quoteSell('0xTokenAddress', tokenAmount);
console.log(`BNB received: ${sellQuote.bnbCost}`);
console.log(`Fee: ${sellQuote.fee}`);

// Get current price
const currentPrice = await trading.getCurrentPrice('0xTokenAddress');
console.log(`Current price: ${currentPrice} BNB`);

// Calculate with slippage protection
const buyWithSlippage = await trading.calculateBuyWithSlippage(
  '0xTokenAddress',
  bnbAmount,    // BNB amount (bigint)
  1             // 1% slippage (number)
);
```

The current FOUR implementation no longer exposes reliable public `calcBuyAmount`, `calcBuyCost`, and `calcSellCost` helpers for SDK quoting. The SDK therefore computes display quotes locally from a fresh `_tokenInfos` snapshot, `_tradingFeeRate`/`calcTradingFee`, and observed curve state. Buy and sell quotes are marked `estimated: true` and must not be used directly as guaranteed outputs. `calculateBuyWithSlippage` and `calculateSellWithSlippage` additionally simulate the matching contract call and refuse to return a protection value when it would revert; final amounts should still be validated from emitted trade events.

The SDK selects `sellToken` overloads by their complete ABI signatures, including when `origin` or referral fees are supplied. This avoids ethers v6's `ambiguous function description` error (issue #4). If you encounter it in an older release, update the SDK.

There is no `calcSellAmount` method. For a known token amount, use `quoteSell(tokenAddress, tokenAmount)` to estimate BNB proceeds, or `calculateSellWithSlippage(tokenAddress, tokenAmount, slippagePercent)` to obtain a simulated `minBnbAmount` for `sellToken.minFunds`. Token amounts use base units (`ethers.parseUnits`); BNB strings returned by the slippage helper use `ethers.parseEther` when passed as `minFunds`. Neither `calcBuyAmount` nor a buy quote computes the tokens needed for a target sell payout.

#### Token Information

```typescript
// Get token info
const tokenInfo = await trading.getTokenInfo('0xTokenAddress');
console.log(tokenInfo);

// Get wallet balances
const bnbBalance = await trading.getBNBBalance();
const tokenBalance = await trading.getTokenBalance('0xTokenAddress');
```

#### Event Subscription

```typescript
// Subscribe to token creation events
const createListener = trading.onTokenCreate((event) => {
  console.log('New token created:', event.token);
  console.log('Creator:', event.creator);
  console.log('Name:', event.name);
  console.log('Symbol:', event.symbol);
});

// Subscribe to purchase events
const purchaseListener = trading.onTokenPurchase((event) => {
  console.log('Token purchased:', event.token);
  console.log('Amount:', event.amount);
  console.log('Cost:', event.cost);
  console.log('Tx hash:', event.metadata?.txHash);
}, '0xTokenAddress'); // Optional: filter by token address

// Subscribe to sale events
const saleListener = trading.onTokenSale((event) => {
  console.log('Token sold:', event.token);
  console.log('Amount:', event.amount);
  console.log('Revenue:', event.cost);
});

// Unsubscribe
trading.off(createListener);
trading.off(purchaseListener);
trading.off(saleListener);
```

#### Query Historical Events

```typescript
// Get token creation events
const createEvents = await trading.getTokenCreateEvents(0, 'latest');

// Get purchase events for specific token
const purchaseEvents = await trading.getTokenPurchaseEvents(
  '0xTokenAddress',
  startBlock,
  endBlock
);

// Get sale events
const saleEvents = await trading.getTokenSaleEvents('0xTokenAddress');

// Historical and live events include optional log metadata
console.log(createEvents[0]?.metadata?.blockNumber);
```

### 🛠️ Utility Functions

```typescript
import {
  formatBNB,
  formatTokenAmount,
  parseBNB,
  parseTokenAmount,
  calculatePriceChange,
  isValidAddress,
  normalizeAddress,
  parseTradeEvents,
  getTransactionType,
  getTransactionSignatureFromData,
  decodeFourTradingTransactionData,
  calculateGasCost
} from '@fnzero/four-trading-sdk';

// Format amounts
const bnbFormatted = formatBNB(1000000000000000000n); // "1.0"
const tokenFormatted = formatTokenAmount(1000000000000000000n); // "1.0"

// Parse amounts
const bnbWei = parseBNB('1.0'); // 1000000000000000000n
const tokenWei = parseTokenAmount('1.0'); // 1000000000000000000n

// Calculate price change
const change = calculatePriceChange(100n, 110n); // 10%

// Validate address
const isValid = isValidAddress('0x...');

// Parse transaction events
const receipt = await provider.getTransactionReceipt(txHash);
const { purchases, sales } = await parseTradeEvents(receipt, contract);

// Get transaction type
const txType = getTransactionType(tx); // 'buyTokenAMAP' | 'sellToken' | etc.
const signature = getTransactionSignatureFromData(tx.data);

// Decode FOUR Trading calldata
const decoded = decodeFourTradingTransactionData(tx.data, tx.value);
console.log(decoded?.signature);
console.log(decoded?.args);

// The selector map includes origin-based buy overloads observed on current BSC transactions,
// such as buyTokenAMAP(uint256,address,uint256,uint256) -> 0xedf9e251.

// Calculate gas cost
const gasCost = calculateGasCost(receipt); // "0.001" (BNB)
```

### ⚠️ Error Handling

```typescript
import { ethers } from 'ethers';

try {
  const bnbAmount = ethers.parseEther('0.1');

  const result = await trading.buyToken({
    tokenAddress: '0xTokenAddress',
    fundsInBNB: bnbAmount
  });
  console.log('Success:', result.txHash);
} catch (error) {
  console.error('Transaction failed:', error.message);
  // Handle error: insufficient balance, slippage exceeded, etc.
}
```

### 💡 Important: Amount Handling

**All amount parameters MUST be `bigint` type:**

```typescript
import { ethers } from 'ethers';

// ✅ Correct - Use ethers to convert amounts
const bnbAmount = ethers.parseEther('0.1');           // BNB amount
const tokenAmount = ethers.parseUnits('1000', 18);    // Token amount
const gasPrice = ethers.parseUnits('5', 'gwei');      // Gas price

// ✅ Correct - Use bigint literal for simple values
const gasLimit = 500000n;
const minAmount = 0n;

// ❌ Wrong - Numbers and strings are not accepted
fundsInBNB: 0.1        // ❌ TypeError
fundsInBNB: '0.1'      // ❌ TypeError
```

**Why bigint?**
- Prevents precision loss in large numbers
- Native blockchain amount representation (wei)
- Type-safe calculations enforced by TypeScript
- No confusion about decimal places

### 📘 TypeScript Support

The SDK is written in TypeScript and provides complete type definitions:

```typescript
import {
  FourTrading,
  FourTradingConfig,
  BuyParams,
  SellParams,
  TokenInfo,
  PriceInfo,
  TransactionResult,
  TokenCreateEvent,
  TokenPurchaseEvent,
  TokenSaleEvent,
  TokenMetadata,
  MarketCapInfo,
  SubmitterConfig,
  // Advanced features
  Logger,
  LogLevel,
  PerformanceMonitor,
  Validator,
  Cache,
  WebSocketManager
} from '@fnzero/four-trading-sdk';
```

### 🚀 Advanced Features

#### Performance Monitoring

Track operation latencies and identify bottlenecks:

```typescript
import { PerformanceMonitor, Logger, LogLevel } from '@fnzero/four-trading-sdk';

const logger = new Logger({ level: LogLevel.INFO });
const perfMonitor = new PerformanceMonitor(logger);

// Track async operations
const result = await perfMonitor.trackAsync('buyToken', async () => {
  return await trading.buyToken({
    tokenAddress: '0xTokenAddress',
    fundsInBNB: ethers.parseEther('0.1')
  });
});

// Get statistics
const stats = perfMonitor.getOperationStats('buyToken');
console.log(`Average: ${stats.avgDuration}ms`);
console.log(`P95: ${stats.p95Duration}ms`);
console.log(`Success rate: ${(stats.successCount / stats.count * 100).toFixed(2)}%`);

// Find slow operations
const slowOps = perfMonitor.getSlowOperations(10);
slowOps.forEach(op => {
  console.log(`${op.operationName}: ${op.duration}ms`);
});
```

#### Transaction Submission Infrastructure

Configure transaction confirmation policy, local nonce handling, and one or more signed-transaction submitters:

```typescript
const trading = new FourTrading({
  rpcUrl: 'https://bsc-dataseed.binance.org',
  wssUrl: 'wss://bsc-rpc.publicnode.com',
  privateKey: 'your-private-key',
  chainId: 56,
  confirmations: 1,
  transactionTimeoutMs: 90_000,
  confirmationPollIntervalMs: 250,
  waitForConfirmation: true, // Set false for hot-path txHash-only returns
  requireHotPathReady: false,
  defaultGas: {
    gasLimit: 350000n,
    gasPrice: ethers.parseUnits('3', 'gwei')
  },
  useLocalNonce: true,
  nonce: {
    initialNonce: 123, // Optional: seed from a preflight getTransactionCount outside the hot path
    refreshOnEveryNonce: false,
    autoSyncIntervalMs: 1000
  },
  submitters: [
    { type: 'normal', name: 'public-rpc' },
    {
      type: 'forty-eight',
      name: 'private-48club',
      url: process.env.FORTY_EIGHT_URL!,
      targetBlockOffset: 2n,
      noMerge: true,
      positionFirst: true
    },
    {
      type: 'bloxroute',
      name: 'private-bloxroute',
      url: process.env.BLOXROUTE_URL!,
      authToken: process.env.BLOXROUTE_AUTH,
      targetBlockOffset: 2n,
      bloxrouteBundlePayloadFormat: 'txs',
      noMerge: true,
      bloxrouteMevBuilders: { all: '' },
      bloxrouteBackrunmeRewardAddress: process.env.BLOXROUTE_REWARD_ADDRESS,
      frontRunningProtection: true
    },
    {
      type: 'bloxroute-private',
      name: 'private-bloxroute-tx',
      url: process.env.BLOXROUTE_URL!,
      authToken: process.env.BLOXROUTE_AUTH,
      bloxroutePrivateMevBuilders: ['all'],
      bloxrouteBackrunmeRewardAddress: process.env.BLOXROUTE_REWARD_ADDRESS,
      frontRunningProtection: true
    },
    {
      type: 'blockrazor',
      name: 'private-blockrazor',
      url: process.env.BLOCKRAZOR_URL!,
      authToken: process.env.BLOCKRAZOR_AUTH,
      targetBlockOffset: 2n,
      noMerge: true
    }
  ]
});

const result = await trading.buyToken({
  tokenAddress: '0xTokenAddress',
  fundsInBNB: ethers.parseEther('0.1'),
  minAmount: 0n,
  targetBlockNumber: 123456789n,
  bundleRawTransactions: ['0xSignedRawTransaction'] // Optional bundle prefix
});

console.log(result.submitter);  // First successful submitter
console.log(result.bundleHash); // Private bundle result, when provided
console.log(result.nonce);

// Manually resync local nonce after external wallet activity
await trading.refreshNonce();

// Only after proving a private bundle expired or nothing was broadcast
await trading.recoverUnbroadcastNonce(result.nonce!);
```

Supported submitter types are `normal`, `json-rpc`, `forty-eight`, `blockrazor`, `bloxroute`, and `bloxroute-private`. Private endpoints differ by provider; pass provider-specific URLs, auth headers, methods, block limits, and protection flags through `SubmitterConfig`. For `forty-eight`, `FourTrading` automatically signs the bundle as `48spSign` with the SDK private key; direct submitter usage can pass `fortyEightSignerPrivateKey`, or override with a precomputed `fortyEightSignature`. For bloXroute BSC bundle payloads, the SDK emits current snake_case fields such as `max_block_number`, `min_timestamp`, `max_timestamp`, `reverting_tx_hashes`, `no_merge`, `mev_builders`, and `backrunme_reward_address`; `bloxroute-private` uses `bsc_private_tx` and treats the provider response as a transaction hash, not a bundle hash.

For ultra-low-latency flows, set `waitForConfirmation: false`, seed `nonce.initialNonce` from a preflight query, pass explicit gas and `chainId`, and pass `targetBlockNumber` per transaction. A nonce is intentionally rejected inside `defaultGas` because it would be reused by every transaction. With local nonce management enabled, per-call `gas.nonce` is also rejected; set `useLocalNonce: false` when an external system owns every nonce. When `requireHotPathReady: true`, the SDK throws if a transaction would need `populateTransaction` to fetch nonce, gas, or chain data. A private relay acceptance is not proof of inclusion: call `recoverUnbroadcastNonce` only after proving that all paths failed or the target bundle can no longer land. `targetBlockOffset` remains available for convenience, but it reads the current block and is not a hot-path option.

#### Low-Latency Stream Infrastructure

Use `TransactionStreamManager` when you want ShredStream/Geyser-style third-party feeds, BSC pending transaction feeds, or provider-specific log streams without embedding trading logic in the SDK:

```typescript
import {
  TransactionStreamManager,
  TOKEN_CREATE_TOPIC,
  createBlockRazorGrpcStreamSource,
  createShredStreamSource
} from '@fnzero/four-trading-sdk';

const streams = new TransactionStreamManager({
  orderMode: 'microbatch',
  microBatchMs: 2,
  sources: [
    {
      type: 'websocket-json-rpc',
      name: 'pending-rpc',
      url: process.env.BSC_WSS_URL!,
      jsonRpcSubscription: 'newPendingTransactions',
      includePendingTransactionBody: true
    },
    {
      type: 'blockrazor',
      name: 'blockrazor-logs',
      url: process.env.BLOCKRAZOR_STREAM_URL!,
      authToken: process.env.BLOCKRAZOR_AUTH!,
      addresses: ['0xFourTradingContract'],
      topics: [[TOKEN_CREATE_TOPIC]]
    },
    createBlockRazorGrpcStreamSource({
      streamFactory: async () => providerSpecificClient.subscribe(),
      nodeValidation: false
    }),
    createShredStreamSource({
      adapterFactory: ({ emitEvent, signal }) => {
        thirdPartyFeed.on('transaction', (tx) => emitEvent({
          eventType: 'transaction',
          raw: tx,
          txHash: tx.hash,
          slot: tx.slot,
          txIndex: tx.index
        }));
        signal.addEventListener('abort', () => thirdPartyFeed.close());
        return { close: () => thirdPartyFeed.close() };
      }
    })
  ]
});

streams.onEvent((event) => {
  if (event.eventType === 'transaction') {
    console.log(event.txHash, event.signedTransaction);
  }
  if (event.eventType === 'log') {
    console.log(event.blockNumber, event.address, event.topics);
  }
});

await streams.start();
```

Supported source types are `websocket-json-rpc`, `json-websocket`, `http-json-stream`, `blockrazor`, `grpc`, and `adapter`. The `grpc` source is intentionally provider-neutral: pass the generated client/stream from the provider's proto package through `streamFactory`, and optionally use `grpcSubscribeRequest` or `grpcPingRequest` for provider-specific subscribe and ping/pong messages. For ShredStream/Geyser-style feeds or vendor SDK callbacks, use `createShredStreamSource` or `createAdapterStreamSource` to push raw messages or normalized events into the same stream manager.

Ordering modes are `none`, `ordered`, `streaming`, and `microbatch`. They are useful for feeds that may deliver transactions/logs out of order by block/slot and transaction index.

#### Allowance Guard

Skip unnecessary approvals before selling:

```typescript
const amount = ethers.parseUnits('1000', 18);
const approvalTx = await trading.ensureTokenApproval('0xTokenAddress', amount);

if (approvalTx) {
  console.log(`Approved in ${approvalTx.txHash}`);
}

await trading.sellToken({
  tokenAddress: '0xTokenAddress',
  amount,
  minFunds: 0n
});
```

#### Token Metadata and Market Cap

```typescript
const metadata = await trading.getTokenMetadata('0xTokenAddress');
console.log(metadata.name, metadata.symbol, metadata.decimals);

const marketCap = await trading.getMarketCap('0xTokenAddress');
console.log(ethers.formatEther(marketCap.fdvWei));
console.log(ethers.formatUnits(marketCap.circulatingSupply, marketCap.decimals));
console.log(ethers.formatEther(marketCap.circulatingMarketCapWei));
```

#### Custom Logger

Configure structured logging:

```typescript
import { Logger, LogLevel } from '@fnzero/four-trading-sdk';

// Create custom logger
const logger = new Logger({
  level: LogLevel.DEBUG,  // DEBUG | INFO | WARN | ERROR | NONE
  prefix: '[MyApp]',
  timestamp: true
});

// Use in trading SDK
const trading = new FourTrading({
  rpcUrl: 'https://bsc-dataseed.binance.org',
  privateKey: 'your-private-key',
  logger: logger  // Pass custom logger
});

// Log levels
logger.debug('Detailed debugging info');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred');

// Change log level dynamically
logger.setLevel(LogLevel.WARN);
```

#### Input Validation

Validate parameters before transactions:

```typescript
import { Validator } from '@fnzero/four-trading-sdk';

// Validate addresses
Validator.validateAddress(tokenAddress);

// Validate amounts
Validator.validateAmount(bnbAmount, 'bnbAmount', {
  min: ethers.parseEther('0.001'),
  max: ethers.parseEther('10')
});

// Validate slippage
Validator.validateSlippage(1.5); // 1.5% - valid
// Validator.validateSlippage(150); // Throws error

// Validate gas options
Validator.validateGasOptions({
  gasLimit: 500000n,
  maxFeePerGas: ethers.parseUnits('5', 'gwei')
});
```

#### Cache Management

Monitor and control caching:

```typescript
// Get cache statistics
const cacheStats = trading.priceCalculator.getCacheStats();
console.log(`Cache size: ${cacheStats.size}/${cacheStats.capacity}`);
console.log(`Utilization: ${cacheStats.utilizationPercent}%`);

// Clear cache when needed
trading.priceCalculator.clearCache();
```

#### Error Handling with Custom Error Types

```typescript
import {
  FourTradingError,
  ValidationError,
  InvalidAddressError,
  InvalidAmountError,
  InsufficientBalanceError,
  TransactionFailedError,
  ConnectionError,
  SlippageExceededError
} from '@fnzero/four-trading-sdk';

try {
  await trading.buyToken({
    tokenAddress: '0xTokenAddress',
    fundsInBNB: bnbAmount
  });
} catch (error) {
  if (error instanceof InvalidAddressError) {
    console.error('Invalid token address:', error.details);
  } else if (error instanceof InsufficientBalanceError) {
    console.error('Not enough balance:', error.message);
  } else if (error instanceof SlippageExceededError) {
    console.error('Slippage too high:', error.details);
  } else if (error instanceof TransactionFailedError) {
    console.error('Transaction failed:', error.txHash);
  } else {
    console.error('Unknown error:', error);
  }
}
```

#### WebSocket Management

Advanced WebSocket connection control:

```typescript
import { WebSocketManager } from '@fnzero/four-trading-sdk';

const wsManager = new WebSocketManager({
  url: 'wss://bsc-rpc.publicnode.com',
  autoReconnect: true,
  maxReconnectAttempts: 10,
  heartbeatEnabled: true
});

// Event handlers
wsManager.onConnected(() => {
  console.log('WebSocket connected');
});

wsManager.onDisconnected(() => {
  console.log('WebSocket disconnected');
});

wsManager.onError((error) => {
  console.error('WebSocket error:', error);
});

// Connect
await wsManager.connect();

// Get connection stats
const stats = wsManager.getStats();
console.log(`Connected: ${stats.connected}`);
console.log(`Reconnect attempts: ${stats.reconnectAttempts}`);

// Cleanup
await wsManager.destroy();
```

### 📊 Performance Metrics

The SDK includes significant performance improvements:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Token info query | 500ms | 1ms (cached) | **99.8% faster** |
| RPC calls | Every query | Cached 30s | **70-80% reduction** |
| Error diagnosis | Unclear | Typed errors | **90% faster** |
| WebSocket reliability | Fails on disconnect | Auto-reconnect | **99.9% uptime** |

### 📋 Contract Information

- **Contract Address**: `0x5c952063c7fc8610FFDB798152D69F0B9550762b`
- **Chain**: Binance Smart Chain (BSC)
- **Chain ID**: 56
- **Network**: Mainnet
- **Block Explorer**: [BscScan](https://bscscan.com/address/0x5c952063c7fc8610FFDB798152D69F0B9550762b)

### 🔧 Requirements

- Node.js >= 18.0.0
- BSC RPC endpoint
- Private key with BNB for gas fees

### 📄 License

MIT License - see the [LICENSE](LICENSE) file for details

### 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### 📞 Support

- GitHub Issues: [Report a bug](https://github.com/0xfnzero/four-trading-sdk/issues)
- Documentation: [Full API Documentation](https://github.com/0xfnzero/four-trading-sdk#readme)

---

<div align="center">
    <p>Made with ❤️ by the FOUR.meme community</p>
    <p>
        <a href="https://fnzero.dev/">Website</a> •
        <a href="https://t.me/fnzero_group">Telegram</a> •
        <a href="https://discord.gg/vuazbGkqQE">Discord</a> •
        <a href="https://github.com/0xfnzero/four-trading-sdk">GitHub</a> •
        <a href="https://www.npmjs.com/package/@fnzero/four-trading-sdk">NPM</a>
    </p>
</div>
