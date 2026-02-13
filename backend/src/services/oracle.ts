import { PriceData } from '../types';

// CoinGecko ID mapping for token addresses / symbols
const COINGECKO_IDS: Record<string, string> = {
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  ETH: 'ethereum',
  TOKEN: 'binancecoin', // fallback
};

// Fallback prices in case API is down
const FALLBACK_PRICES: Record<string, number> = {
  BNB: 600,
  USDT: 1.0,
  USDC: 1.0,
  ETH: 3200,
  TOKEN: 1.0,
};

export class PriceOracle {
  private cache: Map<string, PriceData> = new Map();
  private cacheTTL = 60_000; // 1 minute

  /**
   * Get price for a token — fetches live from CoinGecko, falls back to cached/default
   */
  async getPrice(token: string): Promise<number> {
    const symbol = this.getTokenSymbol(token);
    const cached = this.cache.get(symbol);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTTL) {
      return cached.price;
    }

    const price = await this.fetchLivePrice(symbol);

    this.cache.set(symbol, { token, price, timestamp: now });
    return price;
  }

  /**
   * Get prices for multiple tokens
   */
  async getPrices(tokens: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    // Batch all symbols to a single CoinGecko call
    const symbolMap = new Map<string, string[]>(); // coingeckoId -> [token addresses]
    for (const token of tokens) {
      const symbol = this.getTokenSymbol(token);
      const cgId = COINGECKO_IDS[symbol] || COINGECKO_IDS.TOKEN;
      if (!symbolMap.has(cgId)) symbolMap.set(cgId, []);
      symbolMap.get(cgId)!.push(token);
    }

    const ids = [...symbolMap.keys()].join(',');
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
      const data = await response.json() as Record<string, { usd: number }>;

      const now = Date.now();
      for (const [cgId, tokenAddrs] of symbolMap) {
        const price = data[cgId]?.usd;
        if (price) {
          for (const addr of tokenAddrs) {
            prices.set(addr, price);
            const sym = this.getTokenSymbol(addr);
            this.cache.set(sym, { token: addr, price, timestamp: now });
          }
        }
      }
    } catch {
      // Fallback: use cache or defaults
    }

    // Fill any missing with cache/fallback
    for (const token of tokens) {
      if (!prices.has(token)) {
        const sym = this.getTokenSymbol(token);
        const cached = this.cache.get(sym);
        prices.set(token, cached?.price ?? FALLBACK_PRICES[sym] ?? 1.0);
      }
    }

    return prices;
  }

  private async fetchLivePrice(symbol: string): Promise<number> {
    const cgId = COINGECKO_IDS[symbol] || COINGECKO_IDS.TOKEN;
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
      const data = await response.json() as Record<string, { usd: number }>;
      const price = data[cgId]?.usd;
      if (price) {
        console.log(`Price oracle (live): ${symbol} = $${price.toFixed(2)}`);
        return price;
      }
    } catch (err: any) {
      console.warn(`Price oracle: CoinGecko fetch failed for ${symbol}: ${err.message}`);
    }

    // Fallback
    const fallback = FALLBACK_PRICES[symbol] ?? 1.0;
    console.log(`Price oracle (fallback): ${symbol} = $${fallback.toFixed(2)}`);
    return fallback;
  }

  private getTokenSymbol(token: string): string {
    if (token === '0x0000000000000000000000000000000000000000') return 'BNB';
    if (token.toLowerCase().includes('bnb')) return 'BNB';
    if (token.toLowerCase().includes('usdt')) return 'USDT';
    if (token.toLowerCase().includes('usdc')) return 'USDC';
    if (token.toLowerCase().includes('eth') && !token.toLowerCase().includes('bnb')) return 'ETH';
    return 'TOKEN';
  }

  clearCache(): void {
    this.cache.clear();
  }
}
