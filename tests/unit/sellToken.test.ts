import { ethers } from 'ethers';
import { FOUR_TRADING_ABI } from '../../src/abi';
import { FourTrading, SellMode, SellParams } from '../../src/fourTrading';

describe('sellToken overload regression (issue #4)', () => {
  const token = '0x1234567890123456789012345678901234567890';
  const recipient = '0x9999999999999999999999999999999999999999';
  const contractAddress = '0x5555555555555555555555555555555555555555';

  function harness(): any {
    const trading = Object.create(FourTrading.prototype) as any;
    // Real ethers encoding, with no provider: a bare sellToken lookup must fail
    // rather than being hidden by a mock that accepts ambiguous function names.
    trading.contract = new ethers.Contract(contractAddress, FOUR_TRADING_ABI);
    trading.chainId = 56n;
    trading.submitTransaction = jest.fn(async (_operation, request) => request);
    return trading;
  }

  it.each([
    {
      options: {},
      signature: 'sellToken(address,uint256,uint256)',
      args: [token, 100n, 50n],
    },
    {
      options: { origin: 0 },
      signature: 'sellToken(uint256,address,uint256,uint256)',
      args: [0n, token, 100n, 50n],
    },
    {
      options: { origin: 7 },
      signature: 'sellToken(uint256,address,uint256,uint256)',
      args: [7n, token, 100n, 50n],
    },
    {
      options: { feeRate: 0n, feeRecipient: recipient },
      signature: 'sellToken(uint256,address,uint256,uint256,uint256,address)',
      args: [0n, token, 100n, 50n, 0n, recipient],
    },
    {
      options: { origin: 7, feeRate: 25n, feeRecipient: recipient },
      signature: 'sellToken(uint256,address,uint256,uint256,uint256,address)',
      args: [7n, token, 100n, 50n, 25n, recipient],
    },
  ])('encodes $signature with $options', async ({ options, signature, args }) => {
    const trading = harness();
    const request = await trading.sellToken({
      tokenAddress: token, amount: 100n, minFunds: 50n,
      gas: { gasLimit: 200_000n }, ...options,
    } as SellParams);

    const decoded = trading.contract.interface.parseTransaction(request);
    expect(decoded.signature).toBe(signature);
    expect(Array.from(decoded.args)).toEqual(args);
    expect(request.to).toBe(contractAddress);
    expect(request.gasLimit).toBe(200_000n);
    expect(trading.submitTransaction).toHaveBeenCalledWith('sellToken', request, undefined, undefined);
  });

  it('keeps partial amounts, default minFunds and bundle options on the explicit overload', async () => {
    const trading = harness();
    const bundle = ['0x1234'];
    const request = await trading.sellToken({
      tokenAddress: token, amount: 1_250n, mode: SellMode.PARTIAL, decimals: 2,
      bundleRawTransactions: bundle, targetBlockNumber: 99n,
    });
    const decoded = trading.contract.interface.parseTransaction(request);
    expect(decoded.signature).toBe('sellToken(address,uint256,uint256)');
    expect(Array.from(decoded.args)).toEqual([token, 1_200n, 0n]);
    expect(trading.submitTransaction).toHaveBeenCalledWith('sellToken', request, bundle, 99n);
  });
});
