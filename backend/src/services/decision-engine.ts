import { TokenBalance, Allocation, Proposal, DecisionEngineConfig } from '../types';
import { PriceOracle } from './oracle';

export class DecisionEngine {
  private oracle: PriceOracle;
  private config: DecisionEngineConfig;

  constructor(oracle: PriceOracle, config: DecisionEngineConfig) {
    this.oracle = oracle;
    this.config = config;
  }

  /**
   * Analyze current allocations and determine if rebalancing is needed
   */
  async analyzeAllocations(
    currentBalances: TokenBalance[],
    targetAllocations: Map<string, number>
  ): Promise<{
    needsRebalancing: boolean;
    allocations: Allocation[];
    proposals: Proposal[];
  }> {
    const allocations: Allocation[] = [];
    const proposals: Proposal[] = [];
    let needsRebalancing = false;

    // Get prices for all tokens
    const prices = await this.oracle.getPrices(currentBalances.map(b => b.token));

    // Calculate total value
    let totalValue = 0;
    for (const balance of currentBalances) {
      const price = prices.get(balance.token) || 0;
      const balanceNum = parseFloat(balance.balance) / Math.pow(10, balance.decimals);
      const value = balanceNum * price;
      balance.value = value;
      totalValue += value;
    }

    console.log(`Total treasury value: $${totalValue.toFixed(2)}`);

    // Check each allocation
    for (const balance of currentBalances) {
      if (balance.value === undefined) continue;

      const currentValue = balance.value;
      const currentPercentage = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      const targetPercentage = targetAllocations.get(balance.token) || 0;
      
      const deviation = Math.abs(currentPercentage - targetPercentage);
      const isRebalanced = deviation <= this.config.rebalanceThreshold;

      allocations.push({
        token: balance.token,
        targetPercentage,
        currentPercentage,
        isRebalanced,
      });

      // Generate rebalancing proposal if needed
      if (!isRebalanced && totalValue > 0) {
        const targetValue = (targetPercentage / 100) * totalValue;
        const diffValue = targetValue - currentValue;
        const price = prices.get(balance.token) || 1;

        if (Math.abs(diffValue) > this.config.minRebalanceAmount) {
          const amount = Math.abs(diffValue) / price;
          const amountFormatted = (amount * Math.pow(10, balance.decimals)).toFixed(0);

          proposals.push({
            id: this.generateProposalId(),
            timestamp: Date.now(),
            type: diffValue > 0 ? 'deposit' : 'withdraw',
            token: balance.token,
            amount: amountFormatted,
            strategy: '0x0000000000000000000000000000000000000000', // TODO: Use actual strategy
            reason: `Rebalance ${balance.token}: ${currentPercentage.toFixed(1)}% → ${targetPercentage}% (deviation: ${deviation.toFixed(1)}%)`,
            status: 'pending',
          });

          needsRebalancing = true;
        }
      }
    }

    return {
      needsRebalancing,
      allocations,
      proposals,
    };
  }

  /**
   * Check if rebalancing is needed for a specific token
   */
  shouldRebalance(
    currentPercentage: number,
    targetPercentage: number
  ): boolean {
    const deviation = Math.abs(currentPercentage - targetPercentage);
    return deviation > this.config.rebalanceThreshold;
  }

  /**
   * Calculate optimal rebalancing amounts
   */
  calculateRebalanceAmount(
    totalValue: number,
    currentPercentage: number,
    targetPercentage: number,
    price: number
  ): number {
    const targetValue = (targetPercentage / 100) * totalValue;
    const currentValue = (currentPercentage / 100) * totalValue;
    const diffValue = targetValue - currentValue;
    
    return diffValue / price;
  }

  private generateProposalId(): string {
    return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
