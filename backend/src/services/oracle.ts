import { PriceData } from '../types';

export class PriceOracle {
  private cache: Map<string, PriceData> = new Map();
  private mockPrices: Map<string, number> = new Map();

  constructor() {
    // Initialize mock prices
    this.mockPrices.set('BNB', 350);
    this.mockPrices.set('USDT', 1.00);
    this.mockPrices.set('USDC', 1.00);
    this.mockPrices.set('ETH', 2200);
  }

  /**
   * Get price for a token (mock implementation)
   * In production, this would call Chainlink Price Feed API
   */
  async getPrice(token: string): Promise<number> {
    const cached = this.cache.get(token);
    const now = Date.now();

    // Return cached price if less than 1 minute old
    if (cached && now - cached.timestamp < 60000) {
      return cached.price;
    }

    // Otherwise get fresh price (mock)
    const price = await this.fetchPrice(token);
    
    this.cache.set(token, {
      token,
      price,
      timestamp: now,
    });

    return price;
  }

  /**
   * Get prices for multiple tokens
   */
  async getPrices(tokens: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    for (const token of tokens) {
      const price = await this.getPrice(token);
      prices.set(token, price);
    }

    return prices;
  }

  private async fetchPrice(token: string): Promise<number> {
    // Mock: Return fixed prices with small random variation
    const symbol = this.getTokenSymbol(token);
    const basePrice = this.mockPrices.get(symbol) || 1.0;
    const variation = (Math.random() - 0.5) * 0.02; // +/- 1% variation
    
    const price = basePrice * (1 + variation);
    
    console.log(`Price oracle: ${symbol} = $${price.toFixed(2)}`);
    return price;
  }

  private getTokenSymbol(token: string): string {
    if (token.toLowerCase().includes('bnb') || token === '0x0000000000000000000000000000000000000000') {
      return 'BNB';
    }
    if (token.toLowerCase().includes('usdt')) return 'USDT';
    if (token.toLowerCase().includes('usdc')) return 'USDC';
    if (token.toLowerCase().includes('eth') && !token.toLowerCase().includes('bnb')) return 'ETH';
    
    return 'TOKEN';
  }

  /**
   * Clear the price cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
