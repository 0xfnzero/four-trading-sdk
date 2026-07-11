import { FourTrading } from '../../src/fourTrading';
import { TransactionFailedError } from '../../src/errors';
import { ethers } from 'ethers';

describe('FourTrading buy quote protection', () => {
  const token = '0x1234567890123456789012345678901234567890';
  const wallet = '0x9999999999999999999999999999999999999999';

  function createTrading(staticCall: jest.Mock): any {
    const trading = Object.create(FourTrading.prototype) as any;
    trading.wallet = { address: wallet };
    trading.contract = {
      'buyTokenAMAP(address,address,uint256,uint256)': { staticCall },
    };
    trading.priceCalculator = {
      quoteBuy: jest.fn().mockResolvedValue({
        tokenAmount: 1_000n,
        bnbCost: 100n,
        pricePerToken: 10n,
        fee: 1n,
        estimated: true,
      }),
    };
    return trading;
  }

  it('returns a minAmount only after the matching buy passes static simulation', async () => {
    const staticCall = jest.fn().mockResolvedValue(undefined);
    const trading = createTrading(staticCall);

    const quote = await trading.calculateBuyWithSlippage(token, 100n, 1);

    expect(staticCall).toHaveBeenCalledWith(token, wallet, 100n, 990n, { value: 100n });
    expect(quote.minTokenAmount).toBe('0.00000000000000099');
  });

  it('does not return an unsafe minAmount when on-chain simulation reverts', async () => {
    const trading = createTrading(jest.fn().mockRejectedValue(new Error('Slippage')));

    await expect(trading.calculateBuyWithSlippage(token, 100n, 1)).rejects.toBeInstanceOf(
      TransactionFailedError
    );
  });

  it('rejects a persistent default nonce before creating providers', () => {
    expect(() => new FourTrading({
      rpcUrl: 'http://127.0.0.1:1',
      wssUrl: 'ws://127.0.0.1:2',
      privateKey: `0x${'11'.repeat(32)}`,
      defaultGas: { nonce: 7 },
    })).toThrow('defaultGas.nonce would be reused');
  });

  it('derives the sell minimum from the same fresh quote snapshot', async () => {
    const trading = Object.create(FourTrading.prototype) as any;
    const staticCall = jest.fn().mockResolvedValue(undefined);
    const estimateSellSlippage = jest.fn(() => {
      throw new Error('must not fetch a second snapshot');
    });
    trading.priceCalculator = {
      quoteSell: jest.fn().mockResolvedValue({
        tokenAmount: 10n,
        bnbCost: 1_000n,
        pricePerToken: 100n,
        fee: 1n,
      }),
      estimateSellSlippage,
    };
    trading.contract = {
      'sellToken(address,uint256,uint256)': { staticCall },
    };

    const quote = await trading.calculateSellWithSlippage(token, 10n, 1);

    expect(estimateSellSlippage).not.toHaveBeenCalled();
    expect(staticCall).toHaveBeenCalledWith(token, 10n, 990n);
    expect(quote.minBnbAmount).toBe(ethers.formatEther(990n));
  });

  it('does not return an unsafe sell minimum when simulation reverts', async () => {
    const trading = Object.create(FourTrading.prototype) as any;
    trading.priceCalculator = {
      quoteSell: jest.fn().mockResolvedValue({
        tokenAmount: 10n,
        bnbCost: 1_000n,
        pricePerToken: 100n,
        fee: 1n,
      }),
    };
    trading.contract = {
      'sellToken(address,uint256,uint256)': {
        staticCall: jest.fn().mockRejectedValue(new Error('Slippage')),
      },
    };

    await expect(trading.calculateSellWithSlippage(token, 10n, 1)).rejects.toBeInstanceOf(
      TransactionFailedError
    );
  });
});

describe('FourTrading nonce reservation lifecycle', () => {
  const destination = '0x1234567890123456789012345678901234567890';

  function transactionHarness(nonceManager: any, wallet: any, submitter: any): any {
    const trading = Object.create(FourTrading.prototype) as any;
    trading.performance = {
      trackAsync: async (_name: string, operation: () => Promise<unknown>) => await operation(),
    };
    trading.requireHotPathReady = false;
    trading.nonceManager = nonceManager;
    trading.chainId = 56n;
    trading.wallet = wallet;
    trading.submitter = submitter;
    trading.waitForConfirmation = false;
    trading.logger = { warn: jest.fn() };
    return trading;
  }

  it('releases a definitely-unbroadcast nonce when populate fails', async () => {
    const nonceManager = {
      getAndIncrement: jest.fn().mockResolvedValue(7),
      release: jest.fn().mockResolvedValue(true),
      refresh: jest.fn(),
    };
    const trading = transactionHarness(
      nonceManager,
      { populateTransaction: jest.fn().mockRejectedValue(new Error('populate failed')) },
      { name: 'test', submitSignedTransaction: jest.fn() }
    );

    await expect(trading.submitTransaction('buy', { to: destination })).rejects.toThrow('populate failed');
    expect(nonceManager.release).toHaveBeenCalledWith(7);
    expect(nonceManager.refresh).not.toHaveBeenCalled();
  });

  it('does not release a nonce after submission has been attempted', async () => {
    const nonceManager = {
      getAndIncrement: jest.fn().mockResolvedValue(7),
      release: jest.fn(),
      refresh: jest.fn().mockResolvedValue(8),
    };
    const wallet = new ethers.Wallet(`0x${'22'.repeat(32)}`);
    const submitter = {
      name: 'test',
      submitSignedTransaction: jest.fn().mockRejectedValue(new Error('ambiguous relay timeout')),
    };
    const trading = transactionHarness(nonceManager, wallet, submitter);

    await expect(trading.submitTransaction('buy', {
      to: destination,
      gasLimit: 21_000n,
      gasPrice: 1n,
      value: 1n,
    })).rejects.toThrow('ambiguous relay timeout');
    expect(submitter.submitSignedTransaction).toHaveBeenCalledTimes(1);
    expect(nonceManager.release).not.toHaveBeenCalled();
    expect(nonceManager.refresh).toHaveBeenCalledTimes(1);
  });

  it('rejects per-call nonce values while local nonce management is enabled', () => {
    const trading = transactionHarness(
      { getAndIncrement: jest.fn() },
      {},
      { name: 'test' }
    );
    trading.defaultGas = undefined;

    expect(() => trading.buildTxOptions({ nonce: 7 })).toThrow(
      'cannot be combined with local nonce management'
    );
  });

  it('exposes explicit recovery for a bundle proven not to have landed', async () => {
    const nonceManager = { release: jest.fn().mockResolvedValue(true) };
    const trading = transactionHarness(nonceManager, {}, { name: 'test' });

    await expect(trading.recoverUnbroadcastNonce(7)).resolves.toBe(true);
    expect(nonceManager.release).toHaveBeenCalledWith(7);
  });
});
