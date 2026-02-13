// Type definitions for AegisTreasury backend

export interface ContractConfig {
  treasuryController: string;
  guardian: string;
  exampleStrategy: string;
  mockToken: string;
  mockToken2?: string;
  rpcUrl: string;
  chainId: number;
}

export interface RelayerConfig {
  privateKey: string;
  address: string;
}

export interface Proposal {
  id: string;
  timestamp: number;
  type: 'deposit' | 'withdraw' | 'harvest';
  token: string;
  amount: string;
  strategy: string;
  reason: string;
  status: 'pending' | 'approved' | 'executed' | 'failed';
  txHash?: string;
  executionTime?: number;
}

export interface TokenBalance {
  token: string;
  symbol: string;
  balance: string;
  decimals: number;
  treasuryBalance?: string;
  strategyBalance?: string;
  price?: number;
  value?: number;
}

export interface StrategyInfo {
  address: string;
  name: string;
  balances: Map<string, string>; // token -> balance
}

export interface Allocation {
  token: string;
  targetPercentage: number; // 0-100
  currentPercentage: number;
  isRebalanced: boolean;
}

export interface PriceData {
  token: string;
  price: number;
  timestamp: number;
}

export interface DecisionEngineConfig {
  rebalanceThreshold: number; // Percentage deviation to trigger rebalance
  minRebalanceAmount: number; // Minimum amount to rebalance
  checkInterval: number; // Minutes
}
