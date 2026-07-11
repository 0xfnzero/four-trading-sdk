import WebSocket, { ClientOptions, RawData } from 'ws';
import { hexlify, keccak256 } from 'ethers';
import { Logger } from './logger';
import { ConnectionError, ValidationError } from './errors';
import {
  WS_HEARTBEAT_INTERVAL,
  WS_HEARTBEAT_TIMEOUT,
  WS_RECONNECT_INITIAL_DELAY,
  WS_RECONNECT_MAX_ATTEMPTS,
  WS_RECONNECT_MAX_DELAY,
  WS_RECONNECT_MULTIPLIER,
} from './constants';

export type StreamSourceType = 'websocket-json-rpc' | 'json-websocket' | 'http-json-stream' | 'blockrazor' | 'grpc' | 'adapter';
export type StreamEventType = 'transaction' | 'log' | 'block' | 'message';
export type StreamOrderMode = 'none' | 'ordered' | 'streaming' | 'microbatch';

export interface StreamEvent<T = unknown> {
  source: string;
  sourceType: StreamSourceType;
  eventType: StreamEventType;
  raw: T;
  receivedAt: number;
  latencyMs?: number;
  txHash?: string;
  signedTransaction?: string;
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  logIndex?: number;
  address?: string;
  topics?: string[];
  data?: string;
  slot?: number;
  txIndex?: number;
  sequence?: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface StreamParserContext {
  source: StreamSourceConfig;
  receivedAt: number;
  sequence: number;
}

export type StreamMessageParser = (
  message: unknown,
  context: StreamParserContext
) => StreamEvent | StreamEvent[] | null | undefined;

export type StreamMessageBuilder = unknown | unknown[] | (() => unknown | unknown[] | undefined);

export interface WebSocketLike {
  readyState?: number;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  terminate?(): void;
  ping?(): void;
  on(event: string, listener: (...args: any[]) => void): unknown;
  removeAllListeners?(): unknown;
}

export type WebSocketFactory = (url: string, options: ClientOptions) => WebSocketLike;

export interface GrpcStreamLike {
  on(event: string, listener: (...args: any[]) => void): unknown;
  write?(message: unknown, callback?: (error?: Error | null) => void): unknown;
  end?(): unknown;
  cancel?(): unknown;
  close?(): unknown;
  destroy?(): unknown;
  removeAllListeners?(): unknown;
}

export interface GrpcStreamFactoryContext {
  source: StreamSourceConfig;
  logger: Logger;
}

export type GrpcStreamFactory = (context: GrpcStreamFactoryContext) => GrpcStreamLike | Promise<GrpcStreamLike>;

export type StreamAdapterEvent = Partial<StreamEvent> & Pick<StreamEvent, 'eventType' | 'raw'>;

export interface StreamAdapterHandle {
  stop?(): unknown;
  cancel?(): unknown;
  end?(): unknown;
  close?(): unknown;
  destroy?(): unknown;
  removeAllListeners?(): unknown;
}

export interface StreamAdapterFactoryContext {
  source: StreamSourceConfig;
  logger: Logger;
  signal: AbortSignal;
  emit(message: unknown): void;
  emitEvent(event: StreamAdapterEvent): void;
  onError(error: Error): void;
}

export type StreamAdapterFactory = (
  context: StreamAdapterFactoryContext
) => StreamAdapterHandle | void | Promise<StreamAdapterHandle | void>;

export interface StreamSourceConfig {
  type: StreamSourceType;
  name?: string;
  url?: string;
  authToken?: string;
  headers?: Record<string, string>;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectMultiplier?: number;
  heartbeatEnabled?: boolean;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  pingMessage?: StreamMessageBuilder;
  pongMessagePredicate?: (message: unknown) => boolean;
  subscribeMessage?: StreamMessageBuilder;
  jsonRpcSubscription?: 'newPendingTransactions' | 'logs' | 'newHeads' | string;
  jsonRpcParams?: unknown[];
  includePendingTransactionBody?: boolean;
  addresses?: string[];
  topics?: string[][];
  requestBody?: unknown | (() => unknown);
  parseMessage?: StreamMessageParser;
  transformEvent?: (event: StreamEvent) => StreamEvent | null | undefined;
  webSocketFactory?: WebSocketFactory;
  streamFactory?: GrpcStreamFactory;
  adapterFactory?: StreamAdapterFactory;
  grpcSubscribeRequest?: unknown | (() => unknown);
  grpcPingRequest?: unknown | ((message: unknown) => unknown | undefined);
  metadata?: Record<string, unknown>;
}

export type GrpcStreamSourceOptions = Omit<StreamSourceConfig, 'type' | 'streamFactory'> & {
  streamFactory: GrpcStreamFactory;
};

export type BlockRazorGrpcStreamSourceOptions = GrpcStreamSourceOptions & {
  nodeValidation?: boolean;
};

export type AdapterStreamSourceOptions = Omit<StreamSourceConfig, 'type' | 'adapterFactory'> & {
  adapterFactory: StreamAdapterFactory;
};

export interface TransactionStreamManagerConfig {
  sources?: StreamSourceConfig[];
  logger?: Logger;
  orderMode?: StreamOrderMode;
  orderTimeoutMs?: number;
  microBatchMs?: number;
}

export interface StreamSourceStats {
  name: string;
  type: StreamSourceType;
  connected: boolean;
  reconnectAttempts: number;
  received: number;
  emitted: number;
  lastEventAt: number;
  lastPongAt: number;
}

export interface TransactionStreamManagerStats {
  running: boolean;
  sources: StreamSourceStats[];
}

interface SourceState {
  config: StreamSourceConfig;
  name: string;
  connected: boolean;
  manuallyStopped: boolean;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
  heartbeatTimer: NodeJS.Timeout | null;
  heartbeatTimeoutTimer: NodeJS.Timeout | null;
  abortController: AbortController | null;
  ws: WebSocketLike | null;
  grpcStream: GrpcStreamLike | null;
  adapterHandle: StreamAdapterHandle | null;
  cancelPendingConnect: (() => void) | null;
  jsonDecoder: JsonValueStreamDecoder;
  received: number;
  emitted: number;
  lastEventAt: number;
  lastPongAt: number;
}

export class OrderedStreamEventBuffer<T extends StreamEvent = StreamEvent> {
  private readonly mode: StreamOrderMode;
  private readonly timeoutMs: number;
  private readonly microBatchMs: number;
  private readonly slots = new Map<number, T[]>();
  private readonly streamingWatermarks = new Map<number, number>();
  private microBatch: T[] = [];
  private microBatchStartMs = 0;
  private lastFlushMs = Date.now();
  private currentSlot = 0;

  constructor(config: {
    orderMode?: StreamOrderMode;
    orderTimeoutMs?: number;
    microBatchMs?: number;
  } = {}) {
    this.mode = config.orderMode || 'none';
    this.timeoutMs = Math.max(1, config.orderTimeoutMs ?? 100);
    this.microBatchMs = Math.max(1, config.microBatchMs ?? 1);
  }

  get needsTimer(): boolean {
    return this.mode !== 'none';
  }

  push(event: T, emit: (event: T) => void): void {
    switch (this.mode) {
      case 'none':
        emit(event);
        return;
      case 'ordered':
        this.pushOrdered(event, emit);
        return;
      case 'streaming':
        this.pushStreaming(event, emit);
        return;
      case 'microbatch':
        this.pushMicroBatch(event, emit);
        return;
    }
  }

  flushDue(emit: (event: T) => void): void {
    const now = Date.now();
    if ((this.mode === 'ordered' || this.mode === 'streaming') && now - this.lastFlushMs >= this.timeoutMs) {
      this.flushAllSlots(emit);
    }

    if (this.mode === 'microbatch' && this.microBatch.length > 0 && now - this.microBatchStartMs >= this.microBatchMs) {
      this.flushMicroBatch(emit);
    }
  }

  flushAll(emit: (event: T) => void): void {
    this.flushAllSlots(emit);
    this.flushMicroBatch(emit);
  }

  private pushOrdered(event: T, emit: (event: T) => void): void {
    const slot = orderSlot(event);
    if (slot > this.currentSlot && this.currentSlot > 0) {
      this.flushBefore(slot, emit);
    }
    if (slot > this.currentSlot) {
      this.currentSlot = slot;
    }
    this.pushSlotEvent(slot, event);
  }

  private pushStreaming(event: T, emit: (event: T) => void): void {
    const slot = orderSlot(event);
    const index = orderIndex(event);

    if (slot <= 0 || index < 0) {
      emit(event);
      return;
    }

    if (slot > this.currentSlot && this.currentSlot > 0) {
      this.flushBefore(slot, emit);
      for (const key of [...this.streamingWatermarks.keys()]) {
        if (key < slot) {
          this.streamingWatermarks.delete(key);
        }
      }
    }

    if (slot > this.currentSlot) {
      this.currentSlot = slot;
    }

    const expected = this.streamingWatermarks.get(slot) ?? 0;
    if (index === expected) {
      emit(event);
      this.streamingWatermarks.set(slot, this.drainStreaming(slot, expected + 1, emit));
    } else if (index > expected) {
      this.pushSlotEvent(slot, event);
    }
  }

  private pushMicroBatch(event: T, emit: (event: T) => void): void {
    const now = Date.now();
    if (this.microBatch.length === 0) {
      this.microBatchStartMs = now;
    }
    this.microBatch.push(event);

    if (now - this.microBatchStartMs >= this.microBatchMs) {
      this.flushMicroBatch(emit);
    }
  }

  private pushSlotEvent(slot: number, event: T): void {
    const list = this.slots.get(slot);
    if (list) {
      list.push(event);
    } else {
      this.slots.set(slot, [event]);
    }
  }

  private drainStreaming(slot: number, nextIndex: number, emit: (event: T) => void): number {
    const buffered = this.slots.get(slot);
    if (!buffered) {
      return nextIndex;
    }

    buffered.sort(compareStreamEvents);
    let watermark = nextIndex;
    let pos = buffered.findIndex((event) => orderIndex(event) === watermark);
    while (pos >= 0) {
      const [event] = buffered.splice(pos, 1);
      emit(event);
      watermark++;
      pos = buffered.findIndex((item) => orderIndex(item) === watermark);
    }

    if (buffered.length === 0) {
      this.slots.delete(slot);
    }

    return watermark;
  }

  private flushBefore(slot: number, emit: (event: T) => void): void {
    for (const key of [...this.slots.keys()].sort((a, b) => a - b)) {
      if (key >= slot) {
        continue;
      }
      const events = this.slots.get(key) || [];
      events.sort(compareStreamEvents);
      for (const event of events) {
        emit(event);
      }
      this.slots.delete(key);
      this.streamingWatermarks.delete(key);
    }
    this.lastFlushMs = Date.now();
  }

  private flushAllSlots(emit: (event: T) => void): void {
    for (const key of [...this.slots.keys()].sort((a, b) => a - b)) {
      const events = this.slots.get(key) || [];
      events.sort(compareStreamEvents);
      for (const event of events) {
        emit(event);
      }
      this.slots.delete(key);
      this.streamingWatermarks.delete(key);
    }
    this.lastFlushMs = Date.now();
  }

  private flushMicroBatch(emit: (event: T) => void): void {
    if (this.microBatch.length === 0) {
      return;
    }
    this.microBatch.sort(compareStreamEvents);
    for (const event of this.microBatch) {
      emit(event);
    }
    this.microBatch = [];
    this.microBatchStartMs = 0;
    this.lastFlushMs = Date.now();
  }
}

export class JsonValueStreamDecoder {
  private buffer = '';

  push(chunk: string): unknown[] {
    this.buffer += chunk;
    const values: unknown[] = [];

    while (true) {
      const start = firstNonWhitespace(this.buffer);
      if (start < 0) {
        this.buffer = '';
        return values;
      }
      if (start > 0) {
        this.buffer = this.buffer.slice(start);
      }

      const end = findJsonValueEnd(this.buffer);
      if (end < 0) {
        return values;
      }

      const json = this.buffer.slice(0, end);
      try {
        values.push(JSON.parse(json));
      } catch {
        return values;
      }
      this.buffer = this.buffer.slice(end);
    }
  }
}

export class TransactionStreamManager {
  private readonly logger: Logger;
  private readonly sources = new Map<string, SourceState>();
  private readonly buffer: OrderedStreamEventBuffer;
  private eventCallbacks: Array<(event: StreamEvent) => void | Promise<void>> = [];
  private errorCallbacks: Array<(error: Error, source?: string) => void> = [];
  private connectedCallbacks: Array<(source: string) => void> = [];
  private disconnectedCallbacks: Array<(source: string) => void> = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private running = false;
  private startPromise: Promise<void> | null = null;
  private sequence = 0;

  constructor(config: TransactionStreamManagerConfig = {}) {
    this.logger = config.logger || new Logger();
    this.buffer = new OrderedStreamEventBuffer({
      orderMode: config.orderMode,
      orderTimeoutMs: config.orderTimeoutMs,
      microBatchMs: config.microBatchMs,
    });

    for (const source of config.sources || []) {
      this.addSource(source);
    }
  }

  addSource(config: StreamSourceConfig): void {
    const name = config.name || `${config.type}-${this.sources.size + 1}`;
    if (this.sources.has(name)) {
      throw new ValidationError(`Duplicate stream source name: ${name}`);
    }

    this.sources.set(name, {
      config: { ...config, name },
      name,
      connected: false,
      manuallyStopped: false,
      reconnectAttempts: 0,
      reconnectTimer: null,
      heartbeatTimer: null,
      heartbeatTimeoutTimer: null,
      abortController: null,
      ws: null,
      grpcStream: null,
      adapterHandle: null,
      cancelPendingConnect: null,
      jsonDecoder: new JsonValueStreamDecoder(),
      received: 0,
      emitted: 0,
      lastEventAt: 0,
      lastPongAt: 0,
    });
  }

  async start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }
    if (this.running) {
      return;
    }

    this.running = true;
    this.startFlushTimer();

    const operation = this.startSources();
    this.startPromise = operation;
    try {
      await operation;
    } finally {
      if (this.startPromise === operation) {
        this.startPromise = null;
      }
    }
  }

  private async startSources(): Promise<void> {
    const results = await Promise.allSettled([...this.sources.values()].map((state) => this.startSource(state)));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length === results.length && failures.length > 0) {
      await this.stop();
      throw failures[0].reason;
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await Promise.all([...this.sources.values()].map((state) => this.stopSource(state)));
    this.buffer.flushAll((event) => this.emitBufferedEvent(event));
  }

  onEvent(callback: (event: StreamEvent) => void | Promise<void>): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((item) => item !== callback);
    };
  }

  onError(callback: (error: Error, source?: string) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter((item) => item !== callback);
    };
  }

  onConnected(callback: (source: string) => void): () => void {
    this.connectedCallbacks.push(callback);
    return () => {
      this.connectedCallbacks = this.connectedCallbacks.filter((item) => item !== callback);
    };
  }

  onDisconnected(callback: (source: string) => void): () => void {
    this.disconnectedCallbacks.push(callback);
    return () => {
      this.disconnectedCallbacks = this.disconnectedCallbacks.filter((item) => item !== callback);
    };
  }

  getStats(): TransactionStreamManagerStats {
    return {
      running: this.running,
      sources: [...this.sources.values()].map((state) => ({
        name: state.name,
        type: state.config.type,
        connected: state.connected,
        reconnectAttempts: state.reconnectAttempts,
        received: state.received,
        emitted: state.emitted,
        lastEventAt: state.lastEventAt,
        lastPongAt: state.lastPongAt,
      })),
    };
  }

  private async connectSource(state: SourceState): Promise<void> {
    state.manuallyStopped = false;

    switch (state.config.type) {
      case 'websocket-json-rpc':
      case 'json-websocket':
        return this.connectWebSocket(state);
      case 'http-json-stream':
      case 'blockrazor':
        return this.connectHttpJsonStream(state);
      case 'grpc':
        return this.connectGrpc(state);
      case 'adapter':
        return this.connectAdapter(state);
    }
  }

  private async startSource(state: SourceState): Promise<void> {
    try {
      await this.connectSource(state);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.notifyError(normalized, state.name);
      if (this.running && !state.manuallyStopped && state.config.autoReconnect !== false) {
        this.scheduleReconnect(state);
        return;
      }
      throw normalized;
    }
  }

  private async connectWebSocket(state: SourceState): Promise<void> {
    const { config } = state;
    if (!config.url || !/^wss?:\/\//i.test(config.url)) {
      throw new ValidationError(`Stream source ${state.name} requires a ws:// or wss:// url`);
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (error?: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (state.cancelPendingConnect === cancelConnect) {
          state.cancelPendingConnect = null;
        }
        error ? reject(error) : resolve();
      };
      const cancelConnect = (): void => settle();
      state.cancelPendingConnect = cancelConnect;
      const ws = config.webSocketFactory
        ? config.webSocketFactory(config.url!, { headers: config.headers })
        : new WebSocket(config.url!, { headers: this.buildHeaders(config) });

      state.ws = ws;

      ws.on('open', () => {
        if (state.manuallyStopped || !this.running) {
          ws.close();
          settle();
          return;
        }
        state.connected = true;
        state.reconnectAttempts = 0;
        state.lastPongAt = Date.now();
        this.logger.info('Stream WebSocket connected', { source: state.name });
        this.sendInitialMessages(state);
        this.startHeartbeat(state);
        this.notifyConnected(state.name);
        settle();
      });

      ws.on('message', (data: RawData) => {
        this.handleRawMessage(state, rawDataToString(data));
      });

      ws.on('pong', () => {
        state.lastPongAt = Date.now();
      });

      ws.on('close', () => {
        const wasSettled = settled;
        this.handleSourceDisconnected(state);
        if (!wasSettled) {
          settle(new ConnectionError(`Stream source ${state.name} WebSocket closed before opening`));
        }
      });

      ws.on('error', (error: Error) => {
        this.notifyError(error, state.name);
        if (!settled) {
          this.handleSourceDisconnected(state);
          settle(new ConnectionError(`Stream source ${state.name} WebSocket connection failed`, { error }));
        }
      });
    });
  }

  private async connectHttpJsonStream(state: SourceState): Promise<void> {
    const { config } = state;
    if (!config.url || !/^https?:\/\//i.test(config.url)) {
      throw new ValidationError(`Stream source ${state.name} requires an http:// or https:// url`);
    }

    const controller = new AbortController();
    state.abortController = controller;

    const response = await fetch(this.resolveHttpStreamUrl(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildHeaders(config),
      },
      body: JSON.stringify(this.buildHttpStreamBody(config)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ConnectionError(`Stream source ${state.name} HTTP ${response.status}`, { response: text });
    }

    if (!response.body) {
      throw new ConnectionError(`Stream source ${state.name} returned an empty response body`);
    }

    state.connected = true;
    state.reconnectAttempts = 0;
    state.lastPongAt = Date.now();
    this.logger.info('HTTP JSON stream connected', { source: state.name });
    this.notifyConnected(state.name);

    this.readHttpJsonStream(state, response.body).catch((error) => {
      if (!state.manuallyStopped) {
        this.notifyError(error instanceof Error ? error : new Error(String(error)), state.name);
        this.handleSourceDisconnected(state);
      }
    });
  }

  private async connectGrpc(state: SourceState): Promise<void> {
    const { config } = state;
    if (!config.streamFactory) {
      throw new ValidationError(`Stream source ${state.name} requires streamFactory for gRPC`);
    }

    const stream = await config.streamFactory({ source: config, logger: this.logger });
    state.grpcStream = stream;
    state.connected = true;
    state.reconnectAttempts = 0;
    state.lastPongAt = Date.now();

    stream.on('data', (message: unknown) => {
      const pingRequest = typeof config.grpcPingRequest === 'function'
        ? config.grpcPingRequest(message)
        : config.grpcPingRequest;
      if (pingRequest !== undefined && stream.write) {
        stream.write(pingRequest);
      }
      this.handleRawMessage(state, message);
    });

    stream.on('error', (error: Error) => {
      if (state.grpcStream !== stream) {
        return;
      }
      this.notifyError(error, state.name);
      this.handleSourceDisconnected(state, stream);
    });

    stream.on('end', () => {
      this.handleSourceDisconnected(state, stream);
    });

    stream.on('close', () => {
      this.handleSourceDisconnected(state, stream);
    });

    const subscribeRequest = typeof config.grpcSubscribeRequest === 'function'
      ? config.grpcSubscribeRequest()
      : config.grpcSubscribeRequest;
    if (subscribeRequest !== undefined && stream.write) {
      stream.write(subscribeRequest);
    }

    this.logger.info('gRPC stream connected', { source: state.name });
    this.notifyConnected(state.name);
  }

  private async connectAdapter(state: SourceState): Promise<void> {
    const { config } = state;
    if (!config.adapterFactory) {
      throw new ValidationError(`Stream source ${state.name} requires adapterFactory`);
    }

    const controller = new AbortController();
    state.abortController = controller;

    const handle = await config.adapterFactory({
      source: config,
      logger: this.logger,
      signal: controller.signal,
      emit: (message: unknown) => {
        if (!state.manuallyStopped) {
          this.handleRawMessage(state, message);
        }
      },
      emitEvent: (event: StreamAdapterEvent) => {
        if (!state.manuallyStopped) {
          this.handleAdapterEvent(state, event);
        }
      },
      onError: (error: Error) => {
        this.notifyError(error, state.name);
        if (!state.manuallyStopped) {
          this.handleSourceDisconnected(state);
        }
      },
    });

    state.adapterHandle = handle || null;
    state.connected = true;
    state.reconnectAttempts = 0;
    state.lastPongAt = Date.now();
    this.logger.info('Adapter stream connected', { source: state.name });
    this.notifyConnected(state.name);
  }

  private async readHttpJsonStream(state: SourceState, body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    while (!state.manuallyStopped) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      for (const message of state.jsonDecoder.push(chunk)) {
        this.handleRawMessage(state, message);
      }
    }

    this.handleSourceDisconnected(state);
  }

  private sendInitialMessages(state: SourceState): void {
    const messages = this.initialMessages(state.config);
    for (const message of messages) {
      this.sendMessage(state, message);
    }
  }

  private initialMessages(config: StreamSourceConfig): unknown[] {
    const configured = evaluateMessageBuilder(config.subscribeMessage);
    if (configured !== undefined) {
      return Array.isArray(configured) ? configured : [configured];
    }

    if (config.type === 'websocket-json-rpc') {
      return [buildJsonRpcSubscribeMessage(config)];
    }

    return [];
  }

  private startHeartbeat(state: SourceState): void {
    const { config } = state;
    if (config.heartbeatEnabled === false) {
      return;
    }

    this.stopHeartbeat(state);

    const interval = config.heartbeatIntervalMs ?? WS_HEARTBEAT_INTERVAL;
    const timeout = config.heartbeatTimeoutMs ?? WS_HEARTBEAT_TIMEOUT;

    state.heartbeatTimer = setInterval(() => {
      if (!state.ws || state.manuallyStopped) {
        return;
      }

      const pingMessage = evaluateMessageBuilder(config.pingMessage);
      if (pingMessage !== undefined) {
        this.sendMessage(state, pingMessage);
      } else if (typeof state.ws.ping === 'function') {
        state.ws.ping();
      }

      state.heartbeatTimeoutTimer = setTimeout(() => {
        if (Date.now() - state.lastPongAt <= timeout * 2) {
          return;
        }
        this.logger.warn('Stream heartbeat timeout', { source: state.name });
        if (typeof state.ws?.terminate === 'function') {
          state.ws.terminate();
        } else {
          state.ws?.close();
        }
      }, timeout);
      unrefTimer(state.heartbeatTimeoutTimer);
    }, interval);
    unrefTimer(state.heartbeatTimer);
  }

  private stopHeartbeat(state: SourceState): void {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }

    if (state.heartbeatTimeoutTimer) {
      clearTimeout(state.heartbeatTimeoutTimer);
      state.heartbeatTimeoutTimer = null;
    }
  }

  private sendMessage(state: SourceState, message: unknown): void {
    if (!state.ws) {
      return;
    }
    state.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  private handleRawMessage(state: SourceState, raw: unknown): void {
    const receivedAt = Date.now();
    state.received++;
    state.lastEventAt = receivedAt;

    let message = raw;
    if (typeof raw === 'string') {
      message = parseJsonOrString(raw);
    }

    if (state.config.pongMessagePredicate?.(message)) {
      state.lastPongAt = receivedAt;
      return;
    }

    const context: StreamParserContext = {
      source: state.config,
      receivedAt,
      sequence: this.sequence++,
    };

    try {
      const parsed = state.config.parseMessage
        ? state.config.parseMessage(message, context)
        : normalizeStreamMessage(message, context);
      const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

      for (const event of events) {
        const next = this.prepareEvent(state, event, context);
        if (!next) {
          continue;
        }

        this.buffer.push(next, (item) => this.emitBufferedEvent(item));
      }

      this.buffer.flushDue((event) => this.emitBufferedEvent(event));
    } catch (error) {
      this.notifyError(error instanceof Error ? error : new Error(String(error)), state.name);
    }
  }

  private handleAdapterEvent(state: SourceState, event: StreamAdapterEvent): void {
    const receivedAt = Date.now();
    state.received++;
    state.lastEventAt = receivedAt;

    const context: StreamParserContext = {
      source: state.config,
      receivedAt,
      sequence: this.sequence++,
    };

    try {
      const next = this.prepareEvent(state, event as StreamEvent, context);
      if (!next) {
        return;
      }

      this.buffer.push(next, (item) => this.emitBufferedEvent(item));
      this.buffer.flushDue((item) => this.emitBufferedEvent(item));
    } catch (error) {
      this.notifyError(error instanceof Error ? error : new Error(String(error)), state.name);
    }
  }

  private prepareEvent(state: SourceState, event: StreamEvent, context: StreamParserContext): StreamEvent | null {
    const prepared: StreamEvent = {
      ...event,
      source: event.source || state.name,
      sourceType: event.sourceType || state.config.type,
      receivedAt: event.receivedAt || context.receivedAt,
      sequence: event.sequence ?? context.sequence,
      metadata: {
        ...(state.config.metadata || {}),
        ...(event.metadata || {}),
      },
    };

    if (prepared.timestamp !== undefined && prepared.latencyMs === undefined) {
      const timestampMs = prepared.timestamp > 1_000_000_000_000
        ? prepared.timestamp
        : prepared.timestamp * 1000;
      prepared.latencyMs = Math.max(0, prepared.receivedAt - timestampMs);
    }

    if (state.config.transformEvent) {
      return state.config.transformEvent(prepared) || null;
    }

    return prepared;
  }

  private emitEvent(event: StreamEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        void callback(event);
      } catch (error) {
        this.notifyError(error instanceof Error ? error : new Error(String(error)), event.source);
      }
    }
  }

  private emitBufferedEvent(event: StreamEvent): void {
    const state = this.sources.get(event.source);
    if (state) {
      state.emitted++;
    }
    this.emitEvent(event);
  }

  private cleanupGrpcStream(state: SourceState, stream: GrpcStreamLike | null = state.grpcStream): void {
    if (!stream) {
      return;
    }

    if (state.grpcStream === stream) {
      state.grpcStream = null;
    }

    for (const method of ['cancel', 'end', 'close', 'destroy'] as const) {
      try {
        stream[method]?.call(stream);
      } catch (error) {
        this.notifyError(error instanceof Error ? error : new Error(String(error)), state.name);
      }
    }

    try {
      stream.removeAllListeners?.();
      // Cancellation can report asynchronously after the transport listeners are removed.
      stream.on('error', () => undefined);
    } catch (error) {
      this.notifyError(error instanceof Error ? error : new Error(String(error)), state.name);
    }
  }

  private handleSourceDisconnected(state: SourceState, disconnectedGrpcStream?: GrpcStreamLike): void {
    if (disconnectedGrpcStream && state.grpcStream !== disconnectedGrpcStream) {
      return;
    }

    const wasConnected = state.connected;
    state.connected = false;
    this.stopHeartbeat(state);
    state.abortController?.abort();
    state.abortController = null;
    this.cleanupGrpcStream(state, disconnectedGrpcStream);
    try {
      state.adapterHandle?.stop?.();
      state.adapterHandle?.cancel?.();
      state.adapterHandle?.end?.();
      state.adapterHandle?.close?.();
      state.adapterHandle?.destroy?.();
      state.adapterHandle?.removeAllListeners?.();
    } catch (error) {
      this.notifyError(error instanceof Error ? error : new Error(String(error)), state.name);
    }
    state.ws = null;
    state.grpcStream = null;
    state.adapterHandle = null;

    if (wasConnected) {
      this.logger.warn('Stream source disconnected', { source: state.name });
      this.notifyDisconnected(state.name);
    }

    if (this.running && !state.manuallyStopped && state.config.autoReconnect !== false) {
      this.scheduleReconnect(state);
    }
  }

  private scheduleReconnect(state: SourceState): void {
    if (state.reconnectTimer) {
      return;
    }

    const maxAttempts = state.config.maxReconnectAttempts ?? WS_RECONNECT_MAX_ATTEMPTS;
    if (state.reconnectAttempts >= maxAttempts) {
      this.notifyError(new ConnectionError(`Stream source ${state.name} reached max reconnect attempts`), state.name);
      return;
    }

    state.reconnectAttempts++;
    const initialDelay = state.config.reconnectInitialDelayMs ?? WS_RECONNECT_INITIAL_DELAY;
    const maxDelay = state.config.reconnectMaxDelayMs ?? WS_RECONNECT_MAX_DELAY;
    const multiplier = state.config.reconnectMultiplier ?? WS_RECONNECT_MULTIPLIER;
    const delay = Math.min(initialDelay * Math.pow(multiplier, state.reconnectAttempts - 1), maxDelay);

    this.logger.info('Scheduling stream reconnect', {
      source: state.name,
      attempt: state.reconnectAttempts,
      delay,
    });

    state.reconnectTimer = setTimeout(async () => {
      state.reconnectTimer = null;
      try {
        await this.connectSource(state);
      } catch (error) {
        this.notifyError(error instanceof Error ? error : new Error(String(error)), state.name);
        this.scheduleReconnect(state);
      }
    }, delay);
    unrefTimer(state.reconnectTimer);
  }

  private async stopSource(state: SourceState): Promise<void> {
    state.manuallyStopped = true;
    state.cancelPendingConnect?.();
    state.cancelPendingConnect = null;

    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    this.stopHeartbeat(state);
    state.abortController?.abort();
    state.abortController = null;
    this.cleanupGrpcStream(state);

    try {
      state.ws?.close();
      state.adapterHandle?.stop?.();
      state.adapterHandle?.cancel?.();
      state.adapterHandle?.end?.();
      state.adapterHandle?.close?.();
      state.adapterHandle?.destroy?.();
      state.ws?.removeAllListeners?.();
      state.adapterHandle?.removeAllListeners?.();
    } catch (error) {
      this.notifyError(error instanceof Error ? error : new Error(String(error)), state.name);
    }

    state.ws = null;
    state.grpcStream = null;
    state.adapterHandle = null;
    state.connected = false;
  }

  private startFlushTimer(): void {
    if (!this.buffer.needsTimer || this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.buffer.flushDue((event) => this.emitBufferedEvent(event));
    }, 1);
    unrefTimer(this.flushTimer);
  }

  private buildHeaders(config: StreamSourceConfig): Record<string, string> {
    return {
      ...(config.authToken ? { Authorization: config.authToken.startsWith('Bearer ') ? config.authToken : `Bearer ${config.authToken}` } : {}),
      ...(config.headers || {}),
    };
  }

  private buildHttpStreamBody(config: StreamSourceConfig): unknown {
    if (typeof config.requestBody === 'function') {
      return config.requestBody();
    }
    if (config.requestBody !== undefined) {
      return config.requestBody;
    }

    return {
      ...(config.addresses ? { addresses: config.addresses } : {}),
      ...(config.topics ? { topics: config.topics } : {}),
    };
  }

  private resolveHttpStreamUrl(config: StreamSourceConfig): string {
    if (config.type !== 'blockrazor') {
      return config.url!;
    }

    return config.url!.endsWith('/streams/subscribe')
      ? config.url!
      : `${config.url!.replace(/\/+$/, '')}/streams/subscribe`;
  }

  private notifyConnected(source: string): void {
    for (const callback of this.connectedCallbacks) {
      try {
        callback(source);
      } catch (error) {
        this.notifyError(error instanceof Error ? error : new Error(String(error)), source);
      }
    }
  }

  private notifyDisconnected(source: string): void {
    for (const callback of this.disconnectedCallbacks) {
      try {
        callback(source);
      } catch (error) {
        this.notifyError(error instanceof Error ? error : new Error(String(error)), source);
      }
    }
  }

  private notifyError(error: Error, source?: string): void {
    this.logger.error('Stream source error', { source, error: error.message });
    for (const callback of this.errorCallbacks) {
      try {
        callback(error, source);
      } catch (callbackError) {
        this.logger.error('Stream error callback failed', { error: callbackError });
      }
    }
  }
}

export function buildJsonRpcSubscribeMessage(config: StreamSourceConfig): Record<string, unknown> {
  const subscription = config.jsonRpcSubscription || 'newPendingTransactions';
  const params = config.jsonRpcParams || defaultJsonRpcParams(config, subscription);

  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_subscribe',
    params,
  };
}

export function createGrpcStreamSource(config: GrpcStreamSourceOptions): StreamSourceConfig {
  return {
    ...config,
    type: 'grpc',
  };
}

export function createBlockRazorGrpcStreamSource(config: BlockRazorGrpcStreamSourceOptions): StreamSourceConfig {
  const { nodeValidation, metadata, grpcSubscribeRequest, ...rest } = config;

  return createGrpcStreamSource({
    ...rest,
    name: config.name || 'blockrazor-grpc',
    grpcSubscribeRequest: grpcSubscribeRequest ?? { nodeValidation: nodeValidation ?? false },
    metadata: {
      provider: 'blockrazor',
      protocol: 'grpc',
      ...(metadata || {}),
    },
  });
}

export function createGeyserGrpcStreamSource(config: GrpcStreamSourceOptions): StreamSourceConfig {
  return createGrpcStreamSource({
    ...config,
    name: config.name || 'geyser-grpc',
    metadata: {
      provider: 'geyser',
      protocol: 'grpc',
      ...(config.metadata || {}),
    },
  });
}

export function createAdapterStreamSource(config: AdapterStreamSourceOptions): StreamSourceConfig {
  return {
    ...config,
    type: 'adapter',
  };
}

export function createShredStreamSource(config: AdapterStreamSourceOptions): StreamSourceConfig {
  return createAdapterStreamSource({
    ...config,
    name: config.name || 'shredstream',
    metadata: {
      provider: 'shredstream',
      protocol: 'adapter',
      ...(config.metadata || {}),
    },
  });
}

export function normalizeStreamMessage(message: unknown, context: StreamParserContext): StreamEvent | StreamEvent[] | null {
  const sourceType = context.source.type;

  if (sourceType === 'websocket-json-rpc') {
    const unwrapped = unwrapJsonRpcMessage(message);
    if (unwrapped === null) {
      return null;
    }
    return normalizeCommonStreamPayload(unwrapped, context);
  }

  return normalizeCommonStreamPayload(message, context);
}

function normalizeCommonStreamPayload(payload: unknown, context: StreamParserContext): StreamEvent | StreamEvent[] | null {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => normalizeCommonStreamPayload(item, context))
      .flatMap((item) => Array.isArray(item) ? item : item ? [item] : []);
  }

  if (typeof payload === 'string') {
    return {
      source: context.source.name || context.source.type,
      sourceType: context.source.type,
      eventType: looksLikeHex(payload) ? 'transaction' : 'message',
      txHash: looksLikeHex(payload) ? payload : undefined,
      raw: payload,
      receivedAt: context.receivedAt,
      sequence: context.sequence,
    };
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const nested = unwrapKnownEnvelope(record);
  if (nested !== record) {
    return normalizeCommonStreamPayload(nested, context);
  }

  if (record.topics || record.address || record.data || record.logIndex) {
    return {
      source: context.source.name || context.source.type,
      sourceType: context.source.type,
      eventType: 'log',
      raw: payload,
      txHash: firstString(record.txHash, record.transactionHash),
      blockNumber: numberFromUnknown(record.blockNumber),
      blockHash: firstString(record.blockHash),
      transactionIndex: numberFromUnknown(record.transactionIndex),
      logIndex: numberFromUnknown(record.logIndex, record.index),
      address: firstString(record.address),
      topics: stringArray(record.topics),
      data: firstString(record.data),
      slot: numberFromUnknown(record.slot),
      txIndex: numberFromUnknown(record.txIndex, record.transactionIndex),
      timestamp: numberFromUnknown(record.timestamp, record.blockTime),
      receivedAt: context.receivedAt,
      sequence: context.sequence,
    };
  }

  const rawTx = getRawTransactionHex(record);
  const hash = firstString(
    record.hash,
    record.txHash,
    record.transactionHash,
    getNested(record, ['tx', 'hash']),
    getNested(record, ['transaction', 'hash'])
  );

  if (rawTx || hash || record.from || record.to) {
    return {
      source: context.source.name || context.source.type,
      sourceType: context.source.type,
      eventType: 'transaction',
      raw: payload,
      txHash: hash || (rawTx ? keccak256(rawTx) : undefined),
      signedTransaction: rawTx,
      blockNumber: numberFromUnknown(record.blockNumber),
      transactionIndex: numberFromUnknown(record.transactionIndex),
      slot: numberFromUnknown(record.slot),
      txIndex: numberFromUnknown(record.txIndex, record.transactionIndex, record.index),
      timestamp: numberFromUnknown(record.timestamp, record.blockTime),
      receivedAt: context.receivedAt,
      sequence: context.sequence,
    };
  }

  if (record.number || record.blockNumber || record.blockHash || record.parentHash) {
    return {
      source: context.source.name || context.source.type,
      sourceType: context.source.type,
      eventType: 'block',
      raw: payload,
      blockNumber: numberFromUnknown(record.number, record.blockNumber),
      blockHash: firstString(record.hash, record.blockHash),
      slot: numberFromUnknown(record.slot, record.number, record.blockNumber),
      timestamp: numberFromUnknown(record.timestamp, record.blockTime),
      receivedAt: context.receivedAt,
      sequence: context.sequence,
    };
  }

  return {
    source: context.source.name || context.source.type,
    sourceType: context.source.type,
    eventType: 'message',
    raw: payload,
    receivedAt: context.receivedAt,
    sequence: context.sequence,
  };
}

function unwrapJsonRpcMessage(message: unknown): unknown | null {
  if (!message || typeof message !== 'object') {
    return message;
  }

  const record = message as Record<string, unknown>;
  if (record.method === 'eth_subscription' && record.params && typeof record.params === 'object') {
    return (record.params as Record<string, unknown>).result ?? null;
  }
  if (record.result !== undefined && record.id !== undefined) {
    return null;
  }
  return record.result ?? message;
}

function unwrapKnownEnvelope(record: Record<string, unknown>): unknown {
  if (record.tx || record.transaction || record.log || record.event) {
    if (record.tx && typeof record.tx === 'object') {
      return record.tx;
    }
    if (record.transaction && typeof record.transaction === 'object') {
      return record.transaction;
    }
    if (record.log && typeof record.log === 'object') {
      return record.log;
    }
    if (record.event && typeof record.event === 'object') {
      return record.event;
    }
  }

  if (record.Tx && typeof record.Tx === 'object') {
    return record.Tx;
  }

  return record;
}

function getRawTransactionHex(record: Record<string, unknown>): string | undefined {
  const raw = firstDefined(
    record.rawTx,
    record.rawTransaction,
    record.signedTransaction,
    getNested(record, ['tx', 'rawTx']),
    getNested(record, ['tx', 'rawTransaction']),
    getNested(record, ['Tx', 'RawTx']),
    getNested(record, ['Tx', 'RawTransaction'])
  );

  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (typeof raw === 'string') {
    return raw.startsWith('0x') ? raw : `0x${raw}`;
  }

  if (raw instanceof Uint8Array) {
    return hexlify(raw);
  }

  if (Buffer.isBuffer(raw)) {
    return hexlify(raw);
  }

  return undefined;
}

function defaultJsonRpcParams(config: StreamSourceConfig, subscription: string): unknown[] {
  if (subscription === 'logs') {
    return [
      'logs',
      {
        ...(config.addresses && config.addresses.length > 0 ? { address: config.addresses.length === 1 ? config.addresses[0] : config.addresses } : {}),
        ...(config.topics ? { topics: config.topics } : {}),
      },
    ];
  }

  if (subscription === 'newPendingTransactions' && config.includePendingTransactionBody) {
    return ['newPendingTransactions', true];
  }

  return [subscription];
}

function evaluateMessageBuilder(builder: StreamMessageBuilder | undefined): unknown | unknown[] | undefined {
  if (typeof builder === 'function') {
    return builder();
  }
  return builder;
}

function rawDataToString(data: RawData): string {
  if (typeof data === 'string') {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8');
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  return Buffer.from(data).toString('utf8');
}

function parseJsonOrString(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function orderSlot(event: StreamEvent): number {
  return event.slot ?? event.blockNumber ?? 0;
}

function orderIndex(event: StreamEvent): number {
  return event.txIndex ?? event.transactionIndex ?? event.logIndex ?? event.sequence ?? -1;
}

function compareStreamEvents(a: StreamEvent, b: StreamEvent): number {
  return orderSlot(a) - orderSlot(b) || orderIndex(a) - orderIndex(b) || (a.sequence ?? 0) - (b.sequence ?? 0);
}

function firstNonWhitespace(value: string): number {
  for (let i = 0; i < value.length; i++) {
    if (!/\s/.test(value[i])) {
      return i;
    }
  }
  return -1;
}

function findJsonValueEnd(value: string): number {
  const first = value[0];
  if (first !== '{' && first !== '[') {
    const newline = value.search(/\r?\n/);
    return newline >= 0 ? newline : -1;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
  }

  return -1;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined);
}

function numberFromUnknown(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'string' && value.length > 0) {
      const parsed = value.startsWith('0x')
        ? Number.parseInt(value, 16)
        : Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function getNested(value: unknown, path: string[]): unknown {
  let cursor = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function looksLikeHex(value: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(value);
}

function unrefTimer(timer: NodeJS.Timeout | null): void {
  timer?.unref?.();
}
