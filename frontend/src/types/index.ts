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

export interface Allocation {
  token: string;
  targetPercentage: number;
  currentPercentage: number;
  isRebalanced: boolean;
}

export interface SystemStatus {
  relayer: string;
  provider: string;
  timestamp: number;
}
