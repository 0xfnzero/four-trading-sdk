import { ethers } from 'ethers';
import {
  JsonRpcSubmitter,
  MultiSubmitter,
  NormalSubmitter,
  TransactionSubmitter,
  SubmitSignedTransactionParams,
  signFortyEightSoulPointBundle,
} from '../../src/submitter';
import { TransactionFailedError } from '../../src/errors';
import { Logger, LogLevel } from '../../src/logger';

class FakeSubmitter implements TransactionSubmitter {
  readonly name: string;
  private delayMs: number;
  private shouldFail: boolean;

  constructor(name: string, delayMs: number, shouldFail: boolean) {
    this.name = name;
    this.delayMs = delayMs;
    this.shouldFail = shouldFail;
  }

  async submitSignedTransaction(params: SubmitSignedTransactionParams) {
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    if (this.shouldFail) {
      throw new Error(`${this.name} failed`);
    }
    return {
      submitter: this.name,
      txHash: params.txHash,
      submittedAt: Date.now(),
      durationMs: this.delayMs,
    };
  }
}

describe('submitters', () => {
  const params: SubmitSignedTransactionParams = {
    signedTransaction: '0x1234',
    txHash: '0xabc',
  };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('NormalSubmitter should broadcast signed transaction', async () => {
    const provider = {
      broadcastTransaction: jest.fn().mockResolvedValue({ hash: '0xabc' }),
    };
    const submitter = new NormalSubmitter(provider as any);

    const result = await submitter.submitSignedTransaction(params);

    expect(provider.broadcastTransaction).toHaveBeenCalledWith('0x1234');
    expect(result).toMatchObject({
      submitter: 'normal',
      txHash: '0xabc',
    });
  });

  it('MultiSubmitter should return first successful submitter', async () => {
    const submitter = new MultiSubmitter([
      new FakeSubmitter('slow-success', 20, false),
      new FakeSubmitter('fast-success', 1, false),
    ], new Logger({ level: LogLevel.NONE }));

    const result = await submitter.submitSignedTransaction(params);

    expect(result.submitter).toBe('fast-success');
  });

  it('MultiSubmitter should tolerate failed submitters', async () => {
    const submitter = new MultiSubmitter([
      new FakeSubmitter('fast-fail', 1, true),
      new FakeSubmitter('slow-success', 10, false),
    ], new Logger({ level: LogLevel.NONE }));

    const result = await submitter.submitSignedTransaction(params);

    expect(result.submitter).toBe('slow-success');
  });

  it('MultiSubmitter should throw when all submitters fail', async () => {
    const submitter = new MultiSubmitter([
      new FakeSubmitter('fail-1', 1, true),
      new FakeSubmitter('fail-2', 2, true),
    ], new Logger({ level: LogLevel.NONE }));

    await expect(submitter.submitSignedTransaction(params)).rejects.toThrow(TransactionFailedError);
  });

  it('JsonRpcSubmitter should resolve target block offset for current bloxroute bundle payloads', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: { bundleHash: '0xbundle' } }),
    });
    global.fetch = fetchMock as any;

    const provider = {
      getBlockNumber: jest.fn().mockResolvedValue(123),
    };
    const submitter = new JsonRpcSubmitter({
      type: 'bloxroute',
      url: 'https://example.com',
      targetBlockOffset: 2n,
      minTimestamp: 1700000000,
      maxTimestamp: 1700000010,
      revertingTxHashes: ['0xrevert'],
      noMerge: true,
      bloxrouteBackrunmeRewardAddress: '0x1111111111111111111111111111111111111111',
    }, { provider: provider as any });

    const result = await submitter.submitSignedTransaction({
      signedTransaction: '0xabcdef',
      txHash: '0xtx',
    });

    expect(provider.getBlockNumber).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.max_block_number).toBe('0x7d');
    expect(body.params.txs).toEqual(['abcdef']);
    expect(body.params.min_timestamp).toBe(1700000000);
    expect(body.params.max_timestamp).toBe(1700000010);
    expect(body.params.reverting_tx_hashes).toEqual(['0xrevert']);
    expect(body.params.no_merge).toBe(true);
    expect(body.params.backrunme_reward_address).toBe('0x1111111111111111111111111111111111111111');
    expect(result.bundleHash).toBe('0xbundle');
  });

  it('JsonRpcSubmitter should support legacy bloxroute transaction payloads', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: { bundleHash: '0xbundle' } }),
    });
    global.fetch = fetchMock as any;

    const submitter = new JsonRpcSubmitter({
      type: 'bloxroute',
      url: 'https://example.com',
      bloxrouteBundlePayloadFormat: 'transaction',
      maxBlockNumber: 200n,
    }, { provider: {} as any });

    await submitter.submitSignedTransaction({
      signedTransaction: '0xabcdef',
      txHash: '0xtx',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.max_block_number).toBe('0xc8');
    expect(body.params.transaction).toEqual(['abcdef']);
    expect(body.params.txs).toBeUndefined();
  });

  it('JsonRpcSubmitter should prefer explicit target block without provider lookup', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: '0xbundle' }),
    });
    global.fetch = fetchMock as any;

    const provider = {
      getBlockNumber: jest.fn().mockRejectedValue(new Error('should not be called')),
    };
    const submitter = new JsonRpcSubmitter({
      type: 'blockrazor',
      url: 'https://example.com',
      targetBlockOffset: 2n,
    }, { provider: provider as any });

    await submitter.submitSignedTransaction({
      signedTransaction: '0xabcdef',
      txHash: '0xtx',
      targetBlockNumber: 456n,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(provider.getBlockNumber).not.toHaveBeenCalled();
    expect(body.params[0].maxBlockNumber).toBe(456);
  });

  it('JsonRpcSubmitter should build bloxroute private transaction payloads', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: '0xtx' }),
    });
    global.fetch = fetchMock as any;

    const submitter = new JsonRpcSubmitter({
      type: 'bloxroute-private',
      url: 'https://example.com',
      bloxroutePrivateMevBuilders: ['all'],
      bloxrouteBackrunmeRewardAddress: '0x1111111111111111111111111111111111111111',
      frontRunningProtection: true,
      backRunningProtection: false,
      nodeValidation: true,
    }, { provider: {} as any });

    const result = await submitter.submitSignedTransaction({
      signedTransaction: '0xabcdef',
      txHash: '0xtx',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.method).toBe('bsc_private_tx');
    expect(body.params).toMatchObject({
      transaction: 'abcdef',
      blockchain_network: 'BSC-Mainnet',
      front_running_protection: true,
      back_running_protection: false,
      node_validation: true,
      mev_builders: ['all'],
      backrunme_reward_address: '0x1111111111111111111111111111111111111111',
    });
    expect(result.bundleHash).toBeUndefined();
  });

  it('JsonRpcSubmitter should auto-sign forty-eight bundle payloads', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ result: '0xbundle' }),
    });
    global.fetch = fetchMock as any;

    const privateKey = '0x59c6995e998f97a5a0044966f09453860f1e48a2d3734124fa4c83fab43c6fd1';
    const wallet = new ethers.Wallet(privateKey);
    const recipient = '0x2222222222222222222222222222222222222222';
    const rawTransaction = await wallet.signTransaction({
      to: recipient,
      value: 1n,
      gasLimit: 21000n,
      gasPrice: 1n,
      nonce: 1,
      chainId: 56,
    });
    const signedTransaction = await wallet.signTransaction({
      to: recipient,
      value: 2n,
      gasLimit: 21000n,
      gasPrice: 1n,
      nonce: 2,
      chainId: 56,
    });
    const expectedSignature = signFortyEightSoulPointBundle(privateKey, [
      rawTransaction,
      signedTransaction,
    ]);

    const submitter = new JsonRpcSubmitter({
      type: 'forty-eight',
      url: 'https://example.com',
      maxBlockNumber: 12345n,
      noMerge: true,
      backrunTarget: '0x3333333333333333333333333333333333333333',
      positionFirst: true,
    }, {
      provider: {} as any,
      signerPrivateKey: privateKey,
    });

    const result = await submitter.submitSignedTransaction({
      signedTransaction,
      txHash: ethers.Transaction.from(signedTransaction).hash!,
      rawTransactions: [rawTransaction],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.method).toBe('eth_sendBundle');
    expect(body.params[0].txs).toEqual([rawTransaction, signedTransaction]);
    expect(body.params[0]['48spSign']).toBe(expectedSignature);
    expect(body.params[0].maxBlockNumber).toBe(12345);
    expect(body.params[0].noMerge).toBe(true);
    expect(body.params[0].backrunTarget).toBe('0x3333333333333333333333333333333333333333');
    expect(body.params[0].positionFirst).toBe(true);
    expect(ethers.dataLength(body.params[0]['48spSign'])).toBe(65);
    expect(['00', '01']).toContain(body.params[0]['48spSign'].slice(-2));
    expect(result.bundleHash).toBe('0xbundle');
  });
});
