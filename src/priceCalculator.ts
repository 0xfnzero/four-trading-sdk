/**
 * Price calculation engine with caching and validation
 * Optimized for performance with intelligent caching layer
 */

import { ethers } from 'ethers';
import { TokenInfo } from './types';
import { Validator } from './validator';
import { Cache } from './cache';
import { FeeExceedsAmountError } from './errors';
import { ONE_ETHER, SLIPPAGE_DENOMINATOR, TOKEN_INFO_CACHE_TTL } from './constants';

export interface PriceInfo {
  tokenAmount: bigint;
  bnbCost: bigint;
  pricePerToken: bigint;
  fee: bigint;
  estimated?: boolean;
}

export interface TokenInfoQueryOptions {
  /** Bypass the cache for transaction-sensitive calculations. */
  fresh?: boolean;
}

export class PriceCalculator {
  private contract: ethers.Contract;
  private tokenInfoCache: Cache<string, TokenInfo>;

  constructor(contract: ethers.Contract) {
    this.contract = contract;
    this.tokenInfoCache = new Cache({ defaultTTL: TOKEN_INFO_CACHE_TTL, maxSize: 500 });
  }

  /**
   * Get token information with caching
   */
  async getTokenInfo(
    tokenAddress: string,
    options: TokenInfoQueryOptions = {}
  ): Promise<TokenInfo> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');

    const cacheKey = tokenAddress.toLowerCase();
    if (!options.fresh) {
      const cached = this.tokenInfoCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Fetch from contract
    const info = await this.contract._tokenInfos(tokenAddress);
    const tokenInfo: TokenInfo = {
      base: info.base,
      quote: info.quote,
      template: info.template,
      totalSupply: info.totalSupply,
      maxOffers: info.maxOffers,
      maxRaising: info.maxRaising,
      launchTime: info.launchTime,
      offers: info.offers,
      funds: info.funds,
      lastPrice: info.lastPrice,
      K: info.K,
      T: info.T,
      status: info.status,
    };

    // Cache the result
    this.tokenInfoCache.set(cacheKey, tokenInfo);

    return tokenInfo;
  }

  /**
   * Quote buy price with validation
   */
  async quoteBuy(tokenAddress: string, bnbAmount: bigint): Promise<PriceInfo> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    Validator.validateAmount(bnbAmount, 'bnbAmount');

    // offers/funds/lastPrice change on every trade. A cached snapshot must
    // never be used to derive a transaction protection value.
    const tokenInfo = await this.getTokenInfo(tokenAddress, { fresh: true });
    const fee = await this.calcTradingFee(tokenInfo, bnbAmount);

    // Validate fee doesn't exceed amount
    if (fee >= bnbAmount) {
      throw new FeeExceedsAmountError(fee, bnbAmount);
    }

    const fundsAfterFee: bigint = bnbAmount - fee;
    const tokenAmount = PriceCalculator.estimateBuyAmountFromTokenInfo(tokenInfo, fundsAfterFee);
    const pricePerToken: bigint = tokenAmount > 0n ? (bnbAmount * ONE_ETHER) / tokenAmount : 0n;

    return { tokenAmount, bnbCost: bnbAmount, pricePerToken, fee, estimated: true };
  }

  /**
   * Quote sell price with validation
   */
  async quoteSell(tokenAddress: string, tokenAmount: bigint): Promise<PriceInfo> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    Validator.validateAmount(tokenAmount, 'tokenAmount');

    const tokenInfo = await this.getTokenInfo(tokenAddress, { fresh: true });
    const bnbBeforeFee = PriceCalculator.estimateSellCostFromTokenInfo(tokenInfo, tokenAmount);
    if (bnbBeforeFee === 0n) {
      return { tokenAmount, bnbCost: 0n, pricePerToken: 0n, fee: 0n, estimated: true };
    }

    const fee = await this.calcTradingFee(tokenInfo, bnbBeforeFee);

    // Validate fee doesn't exceed proceeds
    if (fee >= bnbBeforeFee) {
      throw new FeeExceedsAmountError(fee, bnbBeforeFee);
    }

    const bnbCost: bigint = bnbBeforeFee - fee;
    const pricePerToken: bigint = tokenAmount > 0n ? (bnbCost * ONE_ETHER) / tokenAmount : 0n;

    return { tokenAmount, bnbCost, pricePerToken, fee, estimated: true };
  }

  /** @deprecated The deployed FOUR calcBuyCost helper reverts. */
  async calcBuyCost(_tokenInfo: TokenInfo, tokenAmount: bigint): Promise<PriceInfo> {
    Validator.validateAmount(tokenAmount, 'tokenAmount');
    throw new Error(
      'Exact FOUR buy cost is unavailable; use estimateBuyCost only for display and simulate before setting maxFunds'
    );
  }

  /** Estimate cost at the current marginal price. Not safe as maxFunds. */
  async estimateBuyCost(tokenInfo: TokenInfo, tokenAmount: bigint): Promise<PriceInfo> {
    Validator.validateAmount(tokenAmount, 'tokenAmount');

    const bnbBeforeFee = PriceCalculator.estimateBuyCostFromTokenInfo(tokenInfo, tokenAmount);
    const fee = await this.calcTradingFee(tokenInfo, bnbBeforeFee);
    const bnbCost: bigint = bnbBeforeFee + fee;
    const pricePerToken: bigint = tokenAmount > 0n ? (bnbCost * ONE_ETHER) / tokenAmount : 0n;

    return { tokenAmount, bnbCost, pricePerToken, fee, estimated: true };
  }

  /**
   * Get current token price
   */
  async getCurrentPrice(tokenAddress: string): Promise<bigint> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');

    const tokenInfo = await this.getTokenInfo(tokenAddress, { fresh: true });
    return PriceCalculator.calcLastPriceFromTokenInfo(tokenInfo);
  }

  async calcTradingFee(tokenInfo: TokenInfo, funds: bigint): Promise<bigint> {
    Validator.validateAmount(funds, 'funds', { allowZero: true });

    if (funds === 0n) {
      return 0n;
    }

    try {
      return await this.contract.calcTradingFee(tokenInfo, funds);
    } catch {
      const feeRate = await this.contract._tradingFeeRate();
      return (funds * BigInt(feeRate)) / 10000n;
    }
  }

  /** @deprecated The deployed FOUR calcBuyAmount helper reverts. */
  static calcBuyAmountFromTokenInfo(_tokenInfo: TokenInfo, funds: bigint): bigint {
    Validator.validateAmount(funds, 'funds', { allowZero: true });
    throw new Error(
      'Exact FOUR buy amount is unavailable; use estimateBuyAmountFromTokenInfo only for display'
    );
  }

  /** Estimate output at the current marginal price. Not safe as minAmount. */
  static estimateBuyAmountFromTokenInfo(tokenInfo: TokenInfo, funds: bigint): bigint {
    Validator.validateAmount(funds, 'funds', { allowZero: true });
    if (funds === 0n || tokenInfo.lastPrice === 0n) {
      return 0n;
    }

    const amount = (funds * ONE_ETHER) / tokenInfo.lastPrice;
    // FOUR stores the inventory still offered for sale in `offers`.
    return amount > tokenInfo.offers
      ? tokenInfo.offers
      : amount;
  }

  /** @deprecated The deployed FOUR calcBuyCost helper reverts. */
  static calcBuyCostFromTokenInfo(_tokenInfo: TokenInfo, tokenAmount: bigint): bigint {
    Validator.validateAmount(tokenAmount, 'tokenAmount', { allowZero: true });
    throw new Error(
      'Exact FOUR buy cost is unavailable; use estimateBuyCostFromTokenInfo only for display'
    );
  }

  /** Estimate cost at the current marginal price. Not safe as maxFunds. */
  static estimateBuyCostFromTokenInfo(tokenInfo: TokenInfo, tokenAmount: bigint): bigint {
    Validator.validateAmount(tokenAmount, 'tokenAmount', { allowZero: true });
    if (tokenAmount === 0n || tokenInfo.lastPrice === 0n) {
      return 0n;
    }

    return (tokenAmount * tokenInfo.lastPrice) / ONE_ETHER;
  }

  /** @deprecated The deployed FOUR calcSellCost helper reverts. */
  static calcSellCostFromTokenInfo(_tokenInfo: TokenInfo, tokenAmount: bigint): bigint {
    Validator.validateAmount(tokenAmount, 'tokenAmount', { allowZero: true });
    throw new Error(
      'Exact FOUR sell cost is unavailable; use estimateSellCostFromTokenInfo only for display'
    );
  }

  /** Estimate proceeds from observed state. Not safe as minFunds. */
  static estimateSellCostFromTokenInfo(tokenInfo: TokenInfo, tokenAmount: bigint): bigint {
    Validator.validateAmount(tokenAmount, 'tokenAmount', { allowZero: true });
    if (tokenAmount === 0n || tokenInfo.funds === 0n) {
      return 0n;
    }

    const denominator = tokenInfo.offers + tokenAmount;
    if (denominator === 0n) {
      return 0n;
    }

    return (tokenInfo.funds * tokenAmount) / denominator;
  }

  static calcLastPriceFromTokenInfo(tokenInfo: TokenInfo): bigint {
    return tokenInfo.lastPrice;
  }

  /**
   * @deprecated A safe minimum requires simulating the actual buy call.
   */
  async estimateBuySlippage(tokenAddress: string, bnbAmount: bigint, slippagePercent: number): Promise<bigint> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    Validator.validateAmount(bnbAmount, 'bnbAmount');
    Validator.validateSlippage(slippagePercent);

    throw new Error(
      'A safe FOUR minAmount requires on-chain simulation; use FourTrading.calculateBuyWithSlippage'
    );
  }

  /** @deprecated A safe minimum requires simulating the actual sell call. */
  async estimateSellSlippage(tokenAddress: string, tokenAmount: bigint, slippagePercent: number): Promise<bigint> {
    Validator.validateAddress(tokenAddress, 'tokenAddress');
    Validator.validateAmount(tokenAmount, 'tokenAmount');
    Validator.validateSlippage(slippagePercent);

    throw new Error(
      'A safe FOUR minFunds requires on-chain simulation; use FourTrading.calculateSellWithSlippage'
    );
  }

  static applySlippage(amount: bigint, slippagePercent: number): bigint {
    Validator.validateAmount(amount, 'amount', { allowZero: true });
    Validator.validateSlippage(slippagePercent);
    const slippageFactor = BigInt(Math.floor((100 - slippagePercent) * 100));
    return (amount * slippageFactor) / SLIPPAGE_DENOMINATOR;
  }

  /**
   * Clear token info cache
   */
  clearCache(): void {
    this.tokenInfoCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): ReturnType<Cache<string, TokenInfo>['stats']> {
    return this.tokenInfoCache.stats();
  }
}
