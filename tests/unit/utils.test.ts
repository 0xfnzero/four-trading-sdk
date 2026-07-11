import { ethers } from 'ethers';
import { FOUR_TRADING_ABI } from '../../src/abi';
import {
  BUY_TOKEN_EXACT_SIGNATURE,
  BUY_TOKEN_EXACT_WITH_RECIPIENT_SIGNATURE,
} from '../../src/constants';
import {
  calculatePriceChange,
  decodeFourTradingTransactionData,
  getTransactionSelectorMap,
  getTransactionSignatureFromData,
  getTransactionTypeFromData,
} from '../../src/utils';

describe('transaction selector utilities', () => {
  const iface = new ethers.Interface(FOUR_TRADING_ABI);
  const token = '0x1234567890123456789012345678901234567890';
  const recipient = '0x2222222222222222222222222222222222222222';

  it('should identify four-argument buyTokenAMAP', () => {
    const data = iface.encodeFunctionData(
      'buyTokenAMAP(address,address,uint256,uint256)',
      [token, recipient, 1000n, 0n]
    );

    expect(data.slice(0, 10)).toBe('0x7f79f6df');
    expect(getTransactionTypeFromData(data)).toBe('buyTokenAMAP');
    expect(getTransactionSignatureFromData(data)).toBe('buyTokenAMAP(address,address,uint256,uint256)');
  });

  it('should identify three-argument buyTokenAMAP', () => {
    const data = iface.encodeFunctionData(
      'buyTokenAMAP(address,uint256,uint256)',
      [token, 1000n, 0n]
    );

    expect(data.slice(0, 10)).toBe('0x87f27655');
    expect(getTransactionTypeFromData(data)).toBe('buyTokenAMAP');
    expect(getTransactionSignatureFromData(data)).toBe('buyTokenAMAP(address,uint256,uint256)');
  });

  it('should identify origin-based buyTokenAMAP calldata seen on current chain', () => {
    const data = iface.encodeFunctionData(
      'buyTokenAMAP(uint256,address,uint256,uint256)',
      [0n, token, 1000n, 0n]
    );

    expect(data.slice(0, 10)).toBe('0xedf9e251');
    expect(getTransactionTypeFromData(data)).toBe('buyTokenAMAP');
    expect(getTransactionSignatureFromData(data)).toBe('buyTokenAMAP(uint256,address,uint256,uint256)');
  });

  it('should identify origin-based exact buyToken calldata', () => {
    const data = iface.encodeFunctionData(
      'buyToken(uint256,address,address,uint256,uint256)',
      [0n, token, recipient, 100n, 200n]
    );

    expect(data.slice(0, 10)).toBe('0x90702094');
    expect(getTransactionTypeFromData(data)).toBe('buyToken');
    expect(getTransactionSignatureFromData(data)).toBe('buyToken(uint256,address,address,uint256,uint256)');
  });

  it('should decode overloaded sellToken calldata', () => {
    const data = iface.encodeFunctionData(
      'sellToken(uint256,address,uint256,uint256)',
      [0n, token, 100n, 1n]
    );

    const decoded = decodeFourTradingTransactionData(data);

    expect(decoded).toMatchObject({
      name: 'sellToken',
      signature: 'sellToken(uint256,address,uint256,uint256)',
      selector: '0x0da74935',
    });
    expect(decoded?.args.token).toBe(token);
    expect(decoded?.args.amount).toBe(100n);
    expect(decoded?.args.minFunds).toBe(1n);
  });

  it('should identify exact buyToken overload selectors', () => {
    const withRecipient = iface.encodeFunctionData(
      'buyToken(address,address,uint256,uint256)',
      [token, recipient, 100n, 200n]
    );
    const withoutRecipient = iface.encodeFunctionData(
      'buyToken(address,uint256,uint256)',
      [token, 100n, 200n]
    );

    expect(withRecipient.slice(0, 10)).toBe(BUY_TOKEN_EXACT_WITH_RECIPIENT_SIGNATURE);
    expect(withoutRecipient.slice(0, 10)).toBe(BUY_TOKEN_EXACT_SIGNATURE);
    expect(getTransactionSignatureFromData(withRecipient)).toBe('buyToken(address,address,uint256,uint256)');
    expect(getTransactionSignatureFromData(withoutRecipient)).toBe('buyToken(address,uint256,uint256)');
  });

  it('should return null for unknown or malformed calldata', () => {
    expect(decodeFourTradingTransactionData('0x12345678')).toBeNull();
    expect(decodeFourTradingTransactionData('0x7f79f6df')).toBeNull();
  });

  it('should expose all ABI function selectors', () => {
    const selectorMap = getTransactionSelectorMap();

    expect(selectorMap['0x7f79f6df']).toEqual({
      name: 'buyTokenAMAP',
      signature: 'buyTokenAMAP(address,address,uint256,uint256)',
    });
    expect(selectorMap['0x3e11741f']).toEqual({
      name: 'sellToken',
      signature: 'sellToken(address,uint256,uint256)',
    });
  });
});

describe('price utilities', () => {
  it('should calculate changes without overflowing large bigint prices', () => {
    const price = 10n ** 400n;

    expect(calculatePriceChange(price, price * 2n)).toBe(100);
    expect(calculatePriceChange(price, price / 2n)).toBe(-50);
  });
});
