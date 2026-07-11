import { NonceManager } from '../../src/nonceManager';
import { Logger, LogLevel } from '../../src/logger';

describe('NonceManager', () => {
  const address = '0x1234567890123456789012345678901234567890';

  it('should hand out unique local nonces for concurrent requests', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(7),
    };
    const manager = new NonceManager(provider as any, address, new Logger({ level: LogLevel.NONE }));

    const nonces = await Promise.all([
      manager.getAndIncrement(),
      manager.getAndIncrement(),
      manager.getAndIncrement(),
    ]);

    expect(nonces).toEqual([7, 8, 9]);
    expect(provider.getTransactionCount).toHaveBeenCalledTimes(1);
    expect(provider.getTransactionCount).toHaveBeenCalledWith(address, 'pending');
  });

  it('should move forward when pending chain nonce is higher', async () => {
    const provider = {
      getTransactionCount: jest
        .fn()
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(9),
    };
    const manager = new NonceManager(
      provider as any,
      address,
      new Logger({ level: LogLevel.NONE }),
      { refreshOnEveryNonce: true }
    );

    await expect(manager.getAndIncrement()).resolves.toBe(5);
    await expect(manager.getAndIncrement()).resolves.toBe(9);
    expect(manager.getCurrentNonce()).toBe(10);
  });

  it('should not move backward when the pending RPC view lags local reservations', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(5),
    };
    const manager = new NonceManager(provider as any, address, new Logger({ level: LogLevel.NONE }));

    await expect(manager.getAndIncrement()).resolves.toBe(5);
    await expect(manager.refresh()).resolves.toBe(6);
    await expect(manager.getAndIncrement()).resolves.toBe(6);
  });

  it('should support conservative refresh-on-every-nonce mode', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(7),
    };
    const manager = new NonceManager(
      provider as any,
      address,
      new Logger({ level: LogLevel.NONE }),
      { refreshOnEveryNonce: true }
    );

    const nonces = await Promise.all([
      manager.getAndIncrement(),
      manager.getAndIncrement(),
      manager.getAndIncrement(),
    ]);

    expect(nonces).toEqual([7, 8, 9]);
    expect(provider.getTransactionCount).toHaveBeenCalledTimes(3);
  });

  it('should use caller-provided initial nonce without RPC on first reservation', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(7),
    };
    const manager = new NonceManager(
      provider as any,
      address,
      new Logger({ level: LogLevel.NONE }),
      { initialNonce: 42 }
    );

    await expect(manager.getAndIncrement()).resolves.toBe(42);
    await expect(manager.getAndIncrement()).resolves.toBe(43);
    expect(provider.getTransactionCount).not.toHaveBeenCalled();
  });

  it('should allow manually replacing current nonce', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(7),
    };
    const manager = new NonceManager(provider as any, address, new Logger({ level: LogLevel.NONE }));

    manager.setCurrentNonce(100);

    await expect(manager.getAndIncrement()).resolves.toBe(100);
    expect(manager.getCurrentNonce()).toBe(101);
    expect(() => manager.setCurrentNonce(-1)).toThrow('Invalid nonce');
  });

  it('should reuse an older definitely-unbroadcast reservation before newer nonces', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(7),
    };
    const manager = new NonceManager(provider as any, address, new Logger({ level: LogLevel.NONE }));

    const first = await manager.getAndIncrement();
    const second = await manager.getAndIncrement();

    await expect(manager.release(first)).resolves.toBe(true);
    expect(manager.getCurrentNonce()).toBe(first);
    await expect(manager.getAndIncrement()).resolves.toBe(first);
    await expect(manager.release(second)).resolves.toBe(true);
    await expect(manager.getAndIncrement()).resolves.toBe(second);
  });

  it('should not move an initial nonce backward during initialize', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(7),
    };
    const manager = new NonceManager(
      provider as any,
      address,
      new Logger({ level: LogLevel.NONE }),
      { initialNonce: 42 }
    );

    await expect(manager.initialize()).resolves.toBe(42);
    await expect(manager.getAndIncrement()).resolves.toBe(42);
  });

  it('should discard reusable holes already consumed on chain', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(8),
    };
    const manager = new NonceManager(provider as any, address, new Logger({ level: LogLevel.NONE }));

    const first = await manager.getAndIncrement();
    await manager.getAndIncrement();
    await manager.release(first);
    await manager.refresh();

    await expect(manager.getAndIncrement()).resolves.toBe(9);
  });

  it('should reject nonces outside the safe integer range', async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(Number.MAX_SAFE_INTEGER),
    };
    const manager = new NonceManager(provider as any, address, new Logger({ level: LogLevel.NONE }));

    await expect(manager.getAndIncrement()).rejects.toThrow('safe integer range');
    await expect(manager.release(Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow('Invalid nonce');
  });
});
