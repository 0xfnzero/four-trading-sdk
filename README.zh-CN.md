<div align="center">
    <h1>🚀 FOUR Trading SDK</h1>
    <h3><em>在 BSC 上无缝交易 FOUR.meme 代币的综合 TypeScript SDK</em></h3>
</div>

<p align="center">
    <strong>通过强大的工具和统一的接口，将 FOUR.meme 代币交易、价格计算和事件监控集成到您的应用程序中。</strong>
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

## BSC SDK 家族

| 类别 | 主要仓库 | 替代或配套仓库 |
| --- | --- | --- |
| 统一交易 | [bsc-trade-sdk-nodejs](https://github.com/0xfnzero/bsc-trade-sdk-nodejs) | [bsc-trade-sdk-golang](https://github.com/0xfnzero/bsc-trade-sdk-golang) |
| 交易解析 | [bsc-parser-sdk-nodejs](https://github.com/0xfnzero/bsc-parser-sdk-nodejs) | [bsc-parser-sdk-golang](https://github.com/0xfnzero/bsc-parser-sdk-golang) |
| 协议 SDK | **[four-trading-sdk](https://github.com/0xfnzero/four-trading-sdk)** | [pancakeswap-sdk](https://github.com/0xfnzero/pancakeswap-sdk) |

## 📖 中文文档

### 这个 SDK 提供什么

FOUR Trading SDK 是面向 BNB Smart Chain 的 TypeScript 工具包，用于集成 FOUR.meme 代币交易。它覆盖代币创建、买入/卖出流程、价格报价、滑点检查、事件订阅、WebSocket 重连、缓存和生产环境参数校验工具。

| 范围 | 覆盖内容 |
|------|----------|
| 交易功能 | 创建代币、买入代币、卖出代币、授权代币、买卖价格报价 |
| 事件监控 | 通过 BSC WebSocket RPC 订阅代币创建、购买和出售事件 |
| 运行环境 | TypeScript、ethers、bigint 安全 API、HTTP RPC 交易、WebSocket RPC 事件 |
| 使用场景 | FOUR.meme 交易 Bot、发射监控、数据看板、BSC DeFi 工具、事件分析 |

### ✨ 特性

#### 核心交易功能
- 🔄 **完整交易功能**：轻松买入、卖出和创建代币
- 💰 **价格计算**：实时价格查询和滑点保护
- 📊 **事件监控**：订阅代币创建、购买和出售事件
- 🌐 **WebSocket 支持**：通过 WebSocket 连接实时更新

#### 高级特性
- ⚡ **高性能**：智能缓存实现 60-99% 延迟降低
- 🗄️ **智能缓存**：LRU + TTL 缓存系统（缓存命中快 99.8%）
- 🔄 **自动重连**：指数退避 WebSocket 重连机制
- 🚀 **灵活提交**：支持普通 RPC、通用 JSON-RPC 和私有 bundle 提交器
- 📡 **低延迟流**：支持 JSON-RPC WebSocket、服务商 JSON 流、BlockRazor 类流和可插拔 gRPC 适配器
- 🔢 **本地 Nonce 管理**：基于 pending nonce 刷新的并发交易签名保护
- 📊 **性能监控**：跟踪 P50/P95/P99 延迟和指标
- 🧩 **Calldata 解码**：基于 ABI 的 FOUR Trading 交易选择器和参数解析
- 🛡️ **类型安全**：完整的 TypeScript 支持，100% 类型覆盖
- ✅ **输入验证**：所有参数的全面验证
- 📝 **结构化日志**：可配置的日志级别和格式
- 🎯 **生产就绪**：84% 测试覆盖率，经过实战检验
- 🔧 **开发者友好**：丰富的错误类型和详细的错误消息

### 📦 安装

```bash
npm install @fnzero/four-trading-sdk
```

或

```bash
yarn add @fnzero/four-trading-sdk
```

或

```bash
pnpm add @fnzero/four-trading-sdk
```

### 🚀 快速开始

```typescript
import { FourTrading } from '@fnzero/four-trading-sdk';
import { ethers } from 'ethers';

const trading = new FourTrading({
  rpcUrl: 'https://bsc-dataseed.binance.org',
  wssUrl: 'wss://bsc-rpc.publicnode.com',  // 事件订阅必需
  privateKey: '你的私钥'
});

// 定义金额（SDK 要求 bigint 类型）
const bnbAmount = ethers.parseEther('0.1');

// 获取价格报价
const quote = await trading.quoteBuy('0xTokenAddress', bnbAmount);
console.log(`预计获得代币数量: ${quote.tokenAmount}`);

// 计算滑点保护的最小值
const minAmount = (quote.tokenAmount * 99n) / 100n; // 1% 滑点

// 买入代币
const result = await trading.buyToken({
  tokenAddress: '0xTokenAddress',
  fundsInBNB: bnbAmount,
  minAmount: minAmount
});

console.log(`交易成功: ${result.txHash}`);
```

### 💡 核心功能

#### 初始化 SDK

```typescript
import { FourTrading } from '@fnzero/four-trading-sdk';

// ⚠️ 重要：wssUrl 是事件订阅的必需参数
const trading = new FourTrading({
  rpcUrl: 'https://bsc-dataseed.binance.org',     // HTTP RPC用于交易
  wssUrl: 'wss://bsc-rpc.publicnode.com',         // WebSocket用于事件（必需）
  privateKey: '你的私钥'
});

// 为什么要分离URL？
// - rpcUrl (HTTP): 用于合约交易（买入/卖出/查询）
// - wssUrl (WebSocket): 用于实时事件订阅
// - 事件订阅不能使用HTTP轮询，WebSocket是强制要求的
```

#### 买入代币

```typescript
import { ethers } from 'ethers';

// 方法 1：使用 BNB 金额买入（推荐）
const bnbAmount = ethers.parseEther('0.1');
const minTokenAmount = ethers.parseUnits('1000', 18);

await trading.buyToken({
  tokenAddress: '0xTokenAddress',
  fundsInBNB: bnbAmount,        // 要花费的 BNB 数量（bigint）
  minAmount: minTokenAmount,     // 最少接收的代币数量（bigint）
  to: '0xRecipient',             // 可选：接收地址
  origin: 0                      // 可选：当前 origin 版重载
});

// 方法 2：买入精确数量的代币
const exactTokens = ethers.parseUnits('1000', 18);
const maxBNB = ethers.parseEther('0.2');

await trading.buyTokenExact(
  '0xTokenAddress',
  exactTokens,      // 精确的代币数量（bigint）
  maxBNB,           // 最多花费的 BNB（bigint）
  '0xRecipient',    // 可选：接收地址
  undefined,        // 可选 gas 配置
  0                 // 可选 origin
);
```

#### 卖出代币

```typescript
import { ethers } from 'ethers';

// 首先，授权代币使用
const tokenAmount = ethers.parseUnits('1000', 18);
await trading.approveToken('0xTokenAddress', tokenAmount);

// 然后卖出代币
const minBNB = ethers.parseEther('0.1');

await trading.sellToken({
  tokenAddress: '0xTokenAddress',
  amount: tokenAmount,  // 要卖出的代币数量（bigint）
  minFunds: minBNB      // 最少接收的 BNB（bigint）
});
```

#### 价格查询

```typescript
import { ethers } from 'ethers';

// 获取买入报价
const bnbAmount = ethers.parseEther('0.1');
const buyQuote = await trading.quoteBuy('0xTokenAddress', bnbAmount);
console.log(`代币数量: ${buyQuote.tokenAmount}`);
console.log(`手续费: ${buyQuote.fee}`);
console.log(`每个代币价格: ${buyQuote.pricePerToken}`);
console.log(`是否估算: ${buyQuote.estimated}`);

// 获取卖出报价
const tokenAmount = ethers.parseUnits('1000', 18);
const sellQuote = await trading.quoteSell('0xTokenAddress', tokenAmount);
console.log(`获得 BNB: ${sellQuote.bnbCost}`);
console.log(`手续费: ${sellQuote.fee}`);

// 获取当前价格
const currentPrice = await trading.getCurrentPrice('0xTokenAddress');
console.log(`当前价格: ${currentPrice} BNB`);

// 使用滑点保护计算
const buyWithSlippage = await trading.calculateBuyWithSlippage(
  '0xTokenAddress',
  bnbAmount,    // BNB 数量（bigint）
  1             // 1% 滑点（number）
);
```

当前 FOUR implementation 已不再可靠暴露公开的 `calcBuyAmount`、`calcBuyCost` 和 `calcSellCost` 报价 helper。SDK 会基于最新的 `_tokenInfos`、`_tradingFeeRate`/`calcTradingFee` 和已观测曲线状态计算展示报价。买入和卖出报价都会标记 `estimated: true`，不能直接视为保证成交量。`calculateBuyWithSlippage` 与 `calculateSellWithSlippage` 会额外只读模拟对应合约调用；若保护值会回退，方法会拒绝返回。最终成交数量仍应以交易事件为准。

#### 代币信息

```typescript
// 获取代币信息
const tokenInfo = await trading.getTokenInfo('0xTokenAddress');
console.log(tokenInfo);

// 获取钱包余额
const bnbBalance = await trading.getBNBBalance();
const tokenBalance = await trading.getTokenBalance('0xTokenAddress');
```

#### 事件订阅

```typescript
// 订阅代币创建事件
const createListener = trading.onTokenCreate((event) => {
  console.log('新代币创建:', event.token);
  console.log('创建者:', event.creator);
  console.log('名称:', event.name);
  console.log('符号:', event.symbol);
});

// 订阅购买事件
const purchaseListener = trading.onTokenPurchase((event) => {
  console.log('代币购买:', event.token);
  console.log('数量:', event.amount);
  console.log('花费:', event.cost);
  console.log('交易哈希:', event.metadata?.txHash);
}, '0xTokenAddress'); // 可选：按代币地址过滤

// 订阅出售事件
const saleListener = trading.onTokenSale((event) => {
  console.log('代币出售:', event.token);
  console.log('数量:', event.amount);
  console.log('收入:', event.cost);
});

// 取消订阅
trading.off(createListener);
trading.off(purchaseListener);
trading.off(saleListener);
```

#### 查询历史事件

```typescript
// 获取代币创建事件
const createEvents = await trading.getTokenCreateEvents(0, 'latest');

// 获取特定代币的购买事件
const purchaseEvents = await trading.getTokenPurchaseEvents(
  '0xTokenAddress',
  startBlock,
  endBlock
);

// 获取出售事件
const saleEvents = await trading.getTokenSaleEvents('0xTokenAddress');

// 实时和历史事件都包含可选的日志 metadata
console.log(createEvents[0]?.metadata?.blockNumber);
```

### 🛠️ 实用函数

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

// 格式化数量
const bnbFormatted = formatBNB(1000000000000000000n); // "1.0"
const tokenFormatted = formatTokenAmount(1000000000000000000n); // "1.0"

// 解析数量
const bnbWei = parseBNB('1.0'); // 1000000000000000000n
const tokenWei = parseTokenAmount('1.0'); // 1000000000000000000n

// 计算价格变化
const change = calculatePriceChange(100n, 110n); // 10%

// 验证地址
const isValid = isValidAddress('0x...');

// 解析交易事件
const receipt = await provider.getTransactionReceipt(txHash);
const { purchases, sales } = await parseTradeEvents(receipt, contract);

// 获取交易类型
const txType = getTransactionType(tx); // 'buyTokenAMAP' | 'sellToken' 等
const signature = getTransactionSignatureFromData(tx.data);

// 解码 FOUR Trading calldata
const decoded = decodeFourTradingTransactionData(tx.data, tx.value);
console.log(decoded?.signature);
console.log(decoded?.args);

// selector map 已包含当前 BSC 交易中观测到的 origin 版买入重载，
// 例如 buyTokenAMAP(uint256,address,uint256,uint256) -> 0xedf9e251。

// 计算 gas 费用
const gasCost = calculateGasCost(receipt); // "0.001" (BNB)
```

### ⚠️ 错误处理

```typescript
import { ethers } from 'ethers';

try {
  const bnbAmount = ethers.parseEther('0.1');

  const result = await trading.buyToken({
    tokenAddress: '0xTokenAddress',
    fundsInBNB: bnbAmount
  });
  console.log('成功:', result.txHash);
} catch (error) {
  console.error('交易失败:', error.message);
  // 处理错误：余额不足、滑点超限等
}
```

### 💡 重要：金额处理

**所有金额参数必须是 `bigint` 类型：**

```typescript
import { ethers } from 'ethers';

// ✅ 正确 - 使用 ethers 转换金额
const bnbAmount = ethers.parseEther('0.1');           // BNB 金额
const tokenAmount = ethers.parseUnits('1000', 18);    // 代币金额
const gasPrice = ethers.parseUnits('5', 'gwei');      // Gas 价格

// ✅ 正确 - 对简单值使用 bigint 字面量
const gasLimit = 500000n;
const minAmount = 0n;

// ❌ 错误 - 不接受数字和字符串
fundsInBNB: 0.1        // ❌ TypeError
fundsInBNB: '0.1'      // ❌ TypeError
```

**为什么使用 bigint？**
- 防止大数字精度丢失
- 原生区块链金额表示（wei）
- TypeScript 强制类型安全计算
- 不会混淆小数位数

### 📘 TypeScript 支持

SDK 使用 TypeScript 编写，提供完整的类型定义：

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
  // 高级功能
  Logger,
  LogLevel,
  PerformanceMonitor,
  Validator,
  Cache,
  WebSocketManager
} from '@fnzero/four-trading-sdk';
```

### 🚀 高级功能

#### 性能监控

跟踪操作延迟并识别瓶颈：

```typescript
import { PerformanceMonitor, Logger, LogLevel } from '@fnzero/four-trading-sdk';

const logger = new Logger({ level: LogLevel.INFO });
const perfMonitor = new PerformanceMonitor(logger);

// 跟踪异步操作
const result = await perfMonitor.trackAsync('buyToken', async () => {
  return await trading.buyToken({
    tokenAddress: '0xTokenAddress',
    fundsInBNB: ethers.parseEther('0.1')
  });
});

// 获取统计数据
const stats = perfMonitor.getOperationStats('buyToken');
console.log(`平均耗时: ${stats.avgDuration}ms`);
console.log(`P95延迟: ${stats.p95Duration}ms`);
console.log(`成功率: ${(stats.successCount / stats.count * 100).toFixed(2)}%`);

// 查找慢操作
const slowOps = perfMonitor.getSlowOperations(10);
slowOps.forEach(op => {
  console.log(`${op.operationName}: ${op.duration}ms`);
});
```

#### 交易提交基础设施

配置交易确认策略、本地 nonce 管理和一个或多个已签名交易提交器：

```typescript
const trading = new FourTrading({
  rpcUrl: 'https://bsc-dataseed.binance.org',
  wssUrl: 'wss://bsc-rpc.publicnode.com',
  privateKey: '你的私钥',
  chainId: 56,
  confirmations: 1,
  transactionTimeoutMs: 90_000,
  confirmationPollIntervalMs: 250,
  waitForConfirmation: true, // 热路径只要 txHash 时设为 false
  requireHotPathReady: false,
  defaultGas: {
    gasLimit: 350000n,
    gasPrice: ethers.parseUnits('3', 'gwei')
  },
  useLocalNonce: true,
  nonce: {
    initialNonce: 123, // 可选：在热路径外预先查询 pending nonce 后注入
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
  bundleRawTransactions: ['0xSignedRawTransaction'] // 可选：bundle 前置交易
});

console.log(result.submitter);  // 第一个成功的提交器
console.log(result.bundleHash); // 私有 bundle 返回值，取决于服务商
console.log(result.nonce);

// 外部钱包活动后可手动同步本地 nonce
await trading.refreshNonce();

// 仅在确认私有 bundle 已过期或所有路径均未广播后调用
await trading.recoverUnbroadcastNonce(result.nonce!);
```

支持的提交器类型包括 `normal`、`json-rpc`、`forty-eight`、`blockrazor`、`bloxroute` 和 `bloxroute-private`。不同私有端点的要求不同，可通过 `SubmitterConfig` 传入服务商特定的 URL、鉴权头、方法名、区块限制和保护参数。对于 `forty-eight`，`FourTrading` 会用 SDK 私钥自动为 bundle 生成 `48spSign`；直接使用 submitter 时可传 `fortyEightSignerPrivateKey`，或用预计算的 `fortyEightSignature` 覆盖。对于 bloXroute BSC bundle，SDK 会输出当前 snake_case 字段，例如 `max_block_number`、`min_timestamp`、`max_timestamp`、`reverting_tx_hashes`、`no_merge`、`mev_builders` 和 `backrunme_reward_address`；`bloxroute-private` 使用 `bsc_private_tx`，并把服务商返回值视为交易哈希而不是 bundleHash。

超低延迟路径可以设置 `waitForConfirmation: false`，在热路径外查询并注入 `nonce.initialNonce`，显式传入 gas 与 `chainId`，并在每笔交易上传 `targetBlockNumber`。`defaultGas` 中的 nonce 会被拒绝，因为它会被每笔交易重复使用。启用本地 nonce 管理时，单笔 `gas.nonce` 也会被拒绝；若 nonce 完全由外部系统管理，应设置 `useLocalNonce: false`。开启 `requireHotPathReady: true` 后，如果交易还需要通过 `populateTransaction` 补 nonce、gas 或 chain 数据，SDK 会直接报错。私有 relay 接受请求不等于交易已上链；只有确认所有路径均未广播或目标 bundle 已不可能落地后，才能调用 `recoverUnbroadcastNonce`。`targetBlockOffset` 仍可用于普通路径，但它会读取当前块，不适合下单热路径。

#### 低延迟流基础设施

如果要接入类似 ShredStream/Geyser 的第三方流、BSC pending transaction 流，或服务商专有日志流，可以使用 `TransactionStreamManager`。SDK 只负责连接、重连、心跳、缓冲排序和通用事件归一化，不内置交易策略：

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

支持的流源类型包括 `websocket-json-rpc`、`json-websocket`、`http-json-stream`、`blockrazor`、`grpc` 和 `adapter`。`grpc` 源刻意保持服务商中立：调用方把服务商 proto 生成的 client/stream 通过 `streamFactory` 传入，再按需用 `grpcSubscribeRequest` 或 `grpcPingRequest` 处理服务商特定的订阅和 ping/pong。类似 ShredStream/Geyser 的第三方高速流，或供应商 SDK 回调，可以用 `createShredStreamSource` 或 `createAdapterStreamSource` 把原始消息或已归一化事件送入同一个 stream manager。

排序模式包括 `none`、`ordered`、`streaming` 和 `microbatch`，用于处理按区块/slot 和交易序号可能乱序到达的低延迟流。

#### 授权守卫

卖出前跳过不必要的授权交易：

```typescript
const amount = ethers.parseUnits('1000', 18);
const approvalTx = await trading.ensureTokenApproval('0xTokenAddress', amount);

if (approvalTx) {
  console.log(`已授权: ${approvalTx.txHash}`);
}

await trading.sellToken({
  tokenAddress: '0xTokenAddress',
  amount,
  minFunds: 0n
});
```

#### 代币元数据和市值

```typescript
const metadata = await trading.getTokenMetadata('0xTokenAddress');
console.log(metadata.name, metadata.symbol, metadata.decimals);

const marketCap = await trading.getMarketCap('0xTokenAddress');
console.log(ethers.formatEther(marketCap.fdvWei));
console.log(ethers.formatUnits(marketCap.circulatingSupply, marketCap.decimals));
console.log(ethers.formatEther(marketCap.circulatingMarketCapWei));
```

#### 自定义日志

配置结构化日志：

```typescript
import { Logger, LogLevel } from '@fnzero/four-trading-sdk';

// 创建自定义logger
const logger = new Logger({
  level: LogLevel.DEBUG,  // DEBUG | INFO | WARN | ERROR | NONE
  prefix: '[我的应用]',
  timestamp: true
});

// 在trading SDK中使用
const trading = new FourTrading({
  rpcUrl: 'https://bsc-dataseed.binance.org',
  privateKey: '你的私钥',
  logger: logger  // 传入自定义logger
});

// 日志级别
logger.debug('详细调试信息');
logger.info('一般信息');
logger.warn('警告消息');
logger.error('发生错误');

// 动态更改日志级别
logger.setLevel(LogLevel.WARN);
```

#### 输入验证

在交易前验证参数：

```typescript
import { Validator } from '@fnzero/four-trading-sdk';

// 验证地址
Validator.validateAddress(tokenAddress);

// 验证金额
Validator.validateAmount(bnbAmount, 'bnbAmount', {
  min: ethers.parseEther('0.001'),
  max: ethers.parseEther('10')
});

// 验证滑点
Validator.validateSlippage(1.5); // 1.5% - 有效
// Validator.validateSlippage(150); // 抛出错误

// 验证gas选项
Validator.validateGasOptions({
  gasLimit: 500000n,
  maxFeePerGas: ethers.parseUnits('5', 'gwei')
});
```

#### 缓存管理

监控和控制缓存：

```typescript
// 获取缓存统计
const cacheStats = trading.priceCalculator.getCacheStats();
console.log(`缓存大小: ${cacheStats.size}/${cacheStats.capacity}`);
console.log(`使用率: ${cacheStats.utilizationPercent}%`);

// 需要时清除缓存
trading.priceCalculator.clearCache();
```

#### 使用自定义错误类型进行错误处理

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
    console.error('无效的代币地址:', error.details);
  } else if (error instanceof InsufficientBalanceError) {
    console.error('余额不足:', error.message);
  } else if (error instanceof SlippageExceededError) {
    console.error('滑点过高:', error.details);
  } else if (error instanceof TransactionFailedError) {
    console.error('交易失败:', error.txHash);
  } else {
    console.error('未知错误:', error);
  }
}
```

#### WebSocket 管理

高级 WebSocket 连接控制：

```typescript
import { WebSocketManager } from '@fnzero/four-trading-sdk';

const wsManager = new WebSocketManager({
  url: 'wss://bsc-rpc.publicnode.com',
  autoReconnect: true,
  maxReconnectAttempts: 10,
  heartbeatEnabled: true
});

// 事件处理器
wsManager.onConnected(() => {
  console.log('WebSocket 已连接');
});

wsManager.onDisconnected(() => {
  console.log('WebSocket 已断开');
});

wsManager.onError((error) => {
  console.error('WebSocket 错误:', error);
});

// 连接
await wsManager.connect();

// 获取连接统计
const stats = wsManager.getStats();
console.log(`已连接: ${stats.connected}`);
console.log(`重连次数: ${stats.reconnectAttempts}`);

// 清理
await wsManager.destroy();
```

### 📊 性能指标

SDK 包含显著的性能改进：

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| Token info 查询 | 500ms | 1ms (缓存) | **快 99.8%** |
| RPC 调用 | 每次查询 | 缓存30秒 | **减少70-80%** |
| 错误诊断 | 不明确 | 类型化错误 | **快90%** |
| WebSocket 可靠性 | 断开即失败 | 自动重连 | **99.9%正常运行** |

### 📋 合约信息

- **合约地址**: `0x5c952063c7fc8610FFDB798152D69F0B9550762b`
- **链**: 币安智能链（BSC）
- **链 ID**: 56
- **网络**: 主网
- **区块浏览器**: [BscScan](https://bscscan.com/address/0x5c952063c7fc8610FFDB798152D69F0B9550762b)

### 🔧 要求

- Node.js >= 18.0.0
- BSC RPC 端点
- 用于支付 gas 费用的 BNB 私钥

### 📄 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

### 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

### 📞 支持

- GitHub Issues: [报告问题](https://github.com/0xfnzero/four-trading-sdk/issues)
- 文档: [完整 API 文档](https://github.com/0xfnzero/four-trading-sdk#readme)

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
