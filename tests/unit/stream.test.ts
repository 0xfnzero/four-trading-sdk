import { EventEmitter } from 'events';
import { keccak256 } from 'ethers';
import {
  JsonValueStreamDecoder,
  OrderedStreamEventBuffer,
  StreamEvent,
  StreamAdapterFactoryContext,
  TransactionStreamManager,
  WebSocketLike,
  createBlockRazorGrpcStreamSource,
  createShredStreamSource,
  normalizeStreamMessage,
} from '../../src/stream';
import { Logger, LogLevel } from '../../src/logger';

class FakeWebSocket extends EventEmitter implements WebSocketLike {
  readyState = 1;
  sent: Array<string | Buffer> = [];
  closed = false;

  send(data: string | Buffer): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.emit('close');
  }

  ping(): void {
    this.emit('pong');
  }

  removeAllListeners(): this {
    super.removeAllListeners();
    return this;
  }
}

class FakeGrpcStream extends EventEmitter {
  writes: unknown[] = [];
  ended = false;

  write(message: unknown, callback?: (error?: Error | null) => void): void {
    this.writes.push(message);
    callback?.(null);
  }

  end(): void {
    this.ended = true;
    this.emit('end');
  }

  cancel(): void {
    this.ended = true;
  }

  close(): void {
    this.ended = true;
  }

  destroy(): void {
    this.ended = true;
  }
}

describe('stream infrastructure', () => {
  const logger = new Logger({ level: LogLevel.NONE });

  it('builds a JSON-RPC websocket subscription and normalizes log events', async () => {
    const sockets: FakeWebSocket[] = [];
    const manager = new TransactionStreamManager({
      logger,
      sources: [{
        type: 'websocket-json-rpc',
        name: 'rpc',
        url: 'wss://example.test/ws',
        jsonRpcSubscription: 'logs',
        addresses: ['0x1111111111111111111111111111111111111111'],
        topics: [['0xaaa']],
        webSocketFactory: () => {
          const socket = new FakeWebSocket();
          sockets.push(socket);
          setImmediate(() => socket.emit('open'));
          return socket;
        },
      }],
    });
    const events: StreamEvent[] = [];
    manager.onEvent((event) => {
      events.push(event);
    });

    await manager.start();

    const subscribeMessage = JSON.parse(String(sockets[0].sent[0]));
    expect(subscribeMessage).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: [
        'logs',
        {
          address: '0x1111111111111111111111111111111111111111',
          topics: [['0xaaa']],
        },
      ],
    });

    sockets[0].emit('message', JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_subscription',
      params: {
        subscription: '0xsub',
        result: {
          address: '0x2222222222222222222222222222222222222222',
          topics: ['0xaaa'],
          data: '0x1234',
          transactionHash: '0xabc',
          blockNumber: '0x10',
          logIndex: '0x2',
        },
      },
    }));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: 'rpc',
      sourceType: 'websocket-json-rpc',
      eventType: 'log',
      txHash: '0xabc',
      blockNumber: 16,
      logIndex: 2,
      address: '0x2222222222222222222222222222222222222222',
    });

    await manager.stop();
  });

  it('cancels a pending WebSocket connection when stopped', async () => {
    class HangingWebSocket extends FakeWebSocket {
      close(): void {
        this.closed = true;
      }
    }

    const socket = new HangingWebSocket();
    const manager = new TransactionStreamManager({
      logger,
      sources: [{
        type: 'websocket-json-rpc',
        name: 'hanging',
        url: 'wss://example.test/ws',
        webSocketFactory: () => socket,
      }],
    });

    const starting = manager.start();
    await Promise.resolve();
    await manager.stop();
    await expect(starting).resolves.toBeUndefined();
    socket.emit('open');
    expect(manager.getStats().sources[0].connected).toBe(false);
  });

  it('shares one connection attempt across concurrent start calls', async () => {
    const socket = new FakeWebSocket();
    const factory = jest.fn(() => {
      setImmediate(() => socket.emit('open'));
      return socket;
    });
    const manager = new TransactionStreamManager({
      logger,
      sources: [{
        type: 'websocket-json-rpc',
        name: 'single-connect',
        url: 'wss://example.test/ws',
        webSocketFactory: factory,
      }],
    });

    await Promise.all([manager.start(), manager.start()]);
    expect(factory).toHaveBeenCalledTimes(1);
    await manager.stop();
  });

  it('accepts provider-specific gRPC streams through a stream factory', async () => {
    const stream = new FakeGrpcStream();
    const manager = new TransactionStreamManager({
      logger,
      sources: [{
        type: 'grpc',
        name: 'blockrazor-grpc',
        grpcSubscribeRequest: { nodeValidation: false },
        streamFactory: () => stream,
      }],
    });
    const events: StreamEvent[] = [];
    manager.onEvent((event) => {
      events.push(event);
    });

    await manager.start();
    expect(stream.writes).toEqual([{ nodeValidation: false }]);

    const rawTx = Uint8Array.from([1, 2, 3, 4]);
    stream.emit('data', { tx: { rawTx } });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: 'blockrazor-grpc',
      sourceType: 'grpc',
      eventType: 'transaction',
      txHash: keccak256(rawTx),
    });
    expect(events[0].signedTransaction).toBe('0x01020304');

    await manager.stop();
    expect(stream.ended).toBe(true);
  });

  it('disposes a failed gRPC stream before reconnecting', async () => {
    jest.useFakeTimers();
    const streams = [new FakeGrpcStream(), new FakeGrpcStream()];
    let nextStream = 0;
    const streamFactory = jest.fn((): FakeGrpcStream => streams[nextStream++]);
    const manager = new TransactionStreamManager({
      logger,
      sources: [{
        type: 'grpc',
        name: 'reconnecting-grpc',
        streamFactory,
        reconnectInitialDelayMs: 1,
        reconnectMaxDelayMs: 1,
      }],
    });

    try {
      await manager.start();
      streams[0].emit('error', new Error('connection lost'));

      expect(streams[0].ended).toBe(true);
      expect(streams[0].listenerCount('data')).toBe(0);

      await jest.advanceTimersByTimeAsync(1);

      expect(streamFactory).toHaveBeenCalledTimes(2);
      expect(streams[0].ended).toBe(true);
      expect(streams[1].ended).toBe(false);
    } finally {
      await manager.stop();
      jest.useRealTimers();
    }
  });

  it('accepts adapter streams for ShredStream-style third-party feeds', async () => {
    let adapterContext: StreamAdapterFactoryContext | undefined;
    let stopped = false;
    const manager = new TransactionStreamManager({
      logger,
      sources: [
        createShredStreamSource({
          name: 'third-party-shreds',
          adapterFactory: (context) => {
            adapterContext = context;
            return {
              stop: () => {
                stopped = true;
              },
            };
          },
        }),
      ],
    });
    const events: StreamEvent[] = [];
    manager.onEvent((event) => {
      events.push(event);
    });

    await manager.start();
    adapterContext?.emitEvent({
      eventType: 'transaction',
      raw: { provider: 'custom' },
      txHash: '0xabc',
      slot: 123,
      txIndex: 4,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: 'third-party-shreds',
      sourceType: 'adapter',
      eventType: 'transaction',
      txHash: '0xabc',
      slot: 123,
      txIndex: 4,
      metadata: {
        provider: 'shredstream',
        protocol: 'adapter',
      },
    });

    await manager.stop();
    expect(stopped).toBe(true);
  });

  it('builds BlockRazor gRPC source presets without vendor proto coupling', () => {
    const stream = new FakeGrpcStream();
    const source = createBlockRazorGrpcStreamSource({
      streamFactory: () => stream,
      nodeValidation: true,
      metadata: { region: 'frankfurt' },
    });

    expect(source).toMatchObject({
      type: 'grpc',
      name: 'blockrazor-grpc',
      grpcSubscribeRequest: { nodeValidation: true },
      metadata: {
        provider: 'blockrazor',
        protocol: 'grpc',
        region: 'frankfurt',
      },
    });
  });

  it('orders streaming events by block and transaction index', () => {
    const buffer = new OrderedStreamEventBuffer({ orderMode: 'streaming' });
    const out: string[] = [];

    buffer.push(event('late', 100, 1), (item) => out.push(String(item.raw)));
    buffer.push(event('first', 100, 0), (item) => out.push(String(item.raw)));
    buffer.push(event('next-block', 101, 0), (item) => out.push(String(item.raw)));

    expect(out).toEqual(['first', 'late', 'next-block']);
  });

  it('micro-batches and sorts buffered events before flushing', () => {
    const buffer = new OrderedStreamEventBuffer({ orderMode: 'microbatch', microBatchMs: 1000 });
    const out: string[] = [];

    buffer.push(event('block-2', 2, 0), (item) => out.push(String(item.raw)));
    buffer.push(event('block-1-b', 1, 1), (item) => out.push(String(item.raw)));
    buffer.push(event('block-1-a', 1, 0), (item) => out.push(String(item.raw)));
    buffer.flushAll((item) => out.push(String(item.raw)));

    expect(out).toEqual(['block-1-a', 'block-1-b', 'block-2']);
  });

  it('decodes concatenated JSON stream values', () => {
    const decoder = new JsonValueStreamDecoder();

    expect(decoder.push('{"a":1}{"b":"two"}')).toEqual([{ a: 1 }, { b: 'two' }]);
    expect(decoder.push('{"c":')).toEqual([]);
    expect(decoder.push('3}\n{"d":[1,2]}')).toEqual([{ c: 3 }, { d: [1, 2] }]);
  });

  it('keeps BlockRazor-style payloads as logs even when txHash is present', () => {
    const parsed = normalizeStreamMessage(
      {
        blockNumber: 10,
        txHash: '0xabc',
        address: '0x2222222222222222222222222222222222222222',
        topics: ['0xaaa'],
        data: '0x1234',
      },
      {
        source: { type: 'blockrazor', name: 'blockrazor' },
        receivedAt: 123,
        sequence: 1,
      }
    ) as StreamEvent;

    expect(parsed.eventType).toBe('log');
    expect(parsed.txHash).toBe('0xabc');
    expect(parsed.blockNumber).toBe(10);
  });
});

function event(raw: string, blockNumber: number, transactionIndex: number): StreamEvent {
  return {
    source: 'test',
    sourceType: 'json-websocket',
    eventType: 'transaction',
    raw,
    blockNumber,
    transactionIndex,
    receivedAt: Date.now(),
  };
}
