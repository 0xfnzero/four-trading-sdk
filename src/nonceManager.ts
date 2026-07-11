import { ethers } from 'ethers';
import { Logger } from './logger';

export interface NonceManagerConfig {
  enabled?: boolean;
  initialNonce?: number;
  refreshOnEveryNonce?: boolean;
  autoSyncIntervalMs?: number;
}

/**
 * Lightweight local nonce manager for concurrent SDK transaction calls.
 *
 * It reads the pending nonce, then hands out locally incremented nonces in a
 * serialized queue so parallel buys/sells do not sign duplicate nonces.
 */
export class NonceManager {
  private provider: ethers.Provider;
  private address: string;
  private logger: Logger;
  private config: NonceManagerConfig;
  private nextNonce: number | null = null;
  private reusableNonces = new Set<number>();
  private queue: Promise<void> = Promise.resolve();
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    provider: ethers.Provider,
    address: string,
    logger?: Logger,
    config: NonceManagerConfig = {}
  ) {
    this.provider = provider;
    this.address = address;
    this.logger = logger || new Logger();
    this.config = config;
    if (config.initialNonce !== undefined && (!Number.isSafeInteger(config.initialNonce) || config.initialNonce < 0)) {
      throw new Error(`Invalid initialNonce: ${config.initialNonce}`);
    }
    this.nextNonce = config.initialNonce ?? null;

    if (config.autoSyncIntervalMs && config.autoSyncIntervalMs > 0) {
      this.startAutoSync(config.autoSyncIntervalMs);
    }
  }

  async initialize(): Promise<number> {
    return this.runExclusive(async () => {
      const chainNonce = await this.provider.getTransactionCount(this.address, 'pending');
      if (this.nextNonce === null || chainNonce > this.nextNonce) {
        this.nextNonce = chainNonce;
      }
      this.discardReusableBefore(chainNonce);
      this.logger.debug('Initialized nonce manager', {
        address: this.address,
        chainNonce,
        localNonce: this.nextNonce,
      });
      return this.getCurrentNonce()!;
    });
  }

  async getAndIncrement(): Promise<number> {
    return this.runExclusive(async () => {
      if (this.nextNonce === null || this.config.refreshOnEveryNonce) {
        const chainNonce = await this.provider.getTransactionCount(this.address, 'pending');
        if (this.nextNonce === null || chainNonce > this.nextNonce) {
          this.nextNonce = chainNonce;
        }
        this.discardReusableBefore(chainNonce);
      }

      const reusableNonce = this.takeReusableNonce();
      if (reusableNonce !== undefined) {
        return reusableNonce;
      }

      const nonce = this.nextNonce!;
      if (!Number.isSafeInteger(nonce) || nonce === Number.MAX_SAFE_INTEGER) {
        throw new Error(`Nonce exceeds the safe integer range: ${nonce}`);
      }
      this.nextNonce += 1;
      return nonce;
    });
  }

  async refresh(): Promise<number> {
    return this.runExclusive(async () => {
      const chainNonce = await this.provider.getTransactionCount(this.address, 'pending');
      if (this.nextNonce === null || chainNonce > this.nextNonce) {
        this.nextNonce = chainNonce;
      }
      this.discardReusableBefore(chainNonce);
      this.logger.debug('Refreshed nonce manager', {
        address: this.address,
        chainNonce,
        localNonce: this.nextNonce,
      });
      return this.getCurrentNonce()!;
    });
  }

  getCurrentNonce(): number | null {
    return this.peekReusableNonce() ?? this.nextNonce;
  }

  setCurrentNonce(nonce: number): void {
    if (!Number.isSafeInteger(nonce) || nonce < 0) {
      throw new Error(`Invalid nonce: ${nonce}`);
    }
    this.nextNonce = nonce;
    this.reusableNonces.clear();
  }

  /** Make a definitely-unbroadcast reservation available to a later call. */
  async release(nonce: number): Promise<boolean> {
    if (!Number.isSafeInteger(nonce) || nonce < 0) {
      throw new Error(`Invalid nonce: ${nonce}`);
    }

    return await this.runExclusive(async () => {
      if (this.nextNonce === null || nonce >= this.nextNonce || this.reusableNonces.has(nonce)) {
        return false;
      }
      this.reusableNonces.add(nonce);
      this.coalesceReusableTail();
      this.logger.debug('Released nonce reservation', {
        address: this.address,
        nonce,
      });
      return true;
    });
  }

  reset(): void {
    this.nextNonce = null;
    this.reusableNonces.clear();
  }

  startAutoSync(intervalMs: number): void {
    this.stopAutoSync();
    this.syncTimer = setInterval(() => {
      this.refresh().catch(error => {
        this.logger.warn('Failed to auto-sync nonce', {
          address: this.address,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, intervalMs);

    if (typeof this.syncTimer.unref === 'function') {
      this.syncTimer.unref();
    }
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private takeReusableNonce(): number | undefined {
    const lowest = this.peekReusableNonce();
    if (lowest !== undefined) {
      this.reusableNonces.delete(lowest);
    }
    return lowest;
  }

  private peekReusableNonce(): number | undefined {
    let lowest: number | undefined;
    for (const nonce of this.reusableNonces) {
      if (lowest === undefined || nonce < lowest) {
        lowest = nonce;
      }
    }
    return lowest;
  }

  private discardReusableBefore(chainNonce: number): void {
    for (const nonce of this.reusableNonces) {
      if (nonce < chainNonce) {
        this.reusableNonces.delete(nonce);
      }
    }
  }

  private coalesceReusableTail(): void {
    while (this.nextNonce !== null && this.nextNonce > 0 && this.reusableNonces.delete(this.nextNonce - 1)) {
      this.nextNonce -= 1;
    }
  }
}
