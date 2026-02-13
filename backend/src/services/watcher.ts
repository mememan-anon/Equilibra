import { ethers } from 'ethers';
import { ContractConfig, TokenBalance, StrategyInfo } from '../types';

// Minimal ABI for TreasuryController
const TREASURY_ABI = [
  'function getTotalBalance(address token) view returns (uint256)',
  'function getStrategyBalance(address token, address strategy) view returns (uint256)',
  'function strategies(address) view returns (bool)',
  'function targetAllocations(address) view returns (uint256)',
  'function relayer() view returns (address)',
];

const STRATEGY_ABI = [
  'function getBalance(address token) view returns (uint256)',
  'function getStrategyInfo() view returns (string name, string description)',
];

// Known token symbols
const TOKEN_SYMBOLS: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'BNB',
};

export class OnChainWatcher {
  private provider: ethers.JsonRpcProvider;
  private treasuryContract: ethers.Contract;
  private config: ContractConfig;

  constructor(config: ContractConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.treasuryContract = new ethers.Contract(
      config.treasuryController,
      TREASURY_ABI,
      this.provider
    );

    // Register known tokens
    if (config.mockToken) {
      TOKEN_SYMBOLS[config.mockToken.toLowerCase()] = 'TST';
    }
    if (config.mockToken2) {
      TOKEN_SYMBOLS[config.mockToken2.toLowerCase()] = 'TST2';
    }
  }

  async initialize(): Promise<void> {
    console.log('On-chain watcher initialized');
  }

  async getTreasuryBalance(token: string): Promise<bigint> {
    try {
      return await this.treasuryContract.getTotalBalance(token);
    } catch {
      return BigInt(0);
    }
  }

  async getStrategyBalance(token: string, strategy: string): Promise<bigint> {
    try {
      return await this.treasuryContract.getStrategyBalance(token, strategy);
    } catch {
      return BigInt(0);
    }
  }

  async getAllBalances(tokens: string[]): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];

    for (const token of tokens) {
      const balance = await this.getTreasuryBalance(token);
      const symbol = TOKEN_SYMBOLS[token.toLowerCase()] || TOKEN_SYMBOLS[token] || 'TOKEN';
      balances.push({
        token,
        symbol,
        balance: balance.toString(),
        decimals: 18,
      });
    }

    return balances;
  }

  async getStrategyInfo(strategyAddress: string): Promise<StrategyInfo | null> {
    try {
      const strategy = new ethers.Contract(strategyAddress, STRATEGY_ABI, this.provider);
      const [name] = await strategy.getStrategyInfo();

      const balances = new Map<string, string>();

      return {
        address: strategyAddress,
        name,
        balances,
      };
    } catch {
      return null;
    }
  }

  async isStrategyWhitelisted(strategy: string): Promise<boolean> {
    try {
      return await this.treasuryContract.strategies(strategy);
    } catch {
      return false;
    }
  }

  async getTargetAllocation(token: string): Promise<number> {
    try {
      const allocation = await this.treasuryContract.targetAllocations(token);
      // Stored on-chain in basis points (10000 = 100%)
      return Number(allocation) / 100;
    } catch {
      return 0;
    }
  }

  isConnected(): boolean {
    try {
      return this.provider !== null && this.treasuryContract !== null;
    } catch {
      return false;
    }
  }
}
