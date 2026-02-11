import { ethers } from 'ethers';
import { ContractConfig, TokenBalance, StrategyInfo } from '../types';
import { Config } from './config';

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

export class OnChainWatcher {
  private provider: ethers.JsonRpcProvider;
  private treasuryContract: ethers.Contract;
  private strategies: string[] = [];

  constructor(config: ContractConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.treasuryContract = new ethers.Contract(
      config.treasuryController,
      TREASURY_ABI,
      this.provider
    );
  }

  async initialize(): Promise<void> {
    console.log('On-chain watcher initialized');
    // TODO: Load whitelisted strategies from contract
    this.strategies = []; // Will be populated
  }

  async getTreasuryBalance(token: string): Promise<bigint> {
    try {
      return await this.treasuryContract.getTotalBalance(token);
    } catch (error) {
      console.error(`Error getting treasury balance for ${token}:`, error);
      return BigInt(0);
    }
  }

  async getStrategyBalance(token: string, strategy: string): Promise<bigint> {
    try {
      return await this.treasuryContract.getStrategyBalance(token, strategy);
    } catch (error) {
      console.error(`Error getting strategy balance:`, error);
      return BigInt(0);
    }
  }

  async getAllBalances(tokens: string[]): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];

    for (const token of tokens) {
      const balance = await this.getTreasuryBalance(token);
      balances.push({
        token,
        symbol: token === ethers.ZeroAddress ? 'BNB' : 'TOKEN',
        balance: balance.toString(),
        decimals: 18, // Default to 18 decimals
      });
    }

    return balances;
  }

  async getStrategyInfo(strategyAddress: string): Promise<StrategyInfo | null> {
    try {
      const strategy = new ethers.Contract(strategyAddress, STRATEGY_ABI, this.provider);
      const [name] = await strategy.getStrategyInfo();
      
      const balances = new Map<string, string>();
      // TODO: Get balances for all tracked tokens
      
      return {
        address: strategyAddress,
        name,
        balances,
      };
    } catch (error) {
      console.error(`Error getting strategy info for ${strategyAddress}:`, error);
      return null;
    }
  }

  async isStrategyWhitelisted(strategy: string): Promise<boolean> {
    try {
      return await this.treasuryContract.strategies(strategy);
    } catch (error) {
      console.error(`Error checking strategy whitelist:`, error);
      return false;
    }
  }

  async getTargetAllocation(token: string): Promise<number> {
    try {
      const allocation = await this.treasuryContract.targetAllocations(token);
      // Allocation is stored as basis points (10000 = 100%)
      return Number(allocation);
    } catch (error) {
      console.error(`Error getting target allocation:`, error);
      return 0;
    }
  }

  async getCurrentAllocation(token: string): Promise<number> {
    try {
      const balance = await this.getTreasuryBalance(token);
      // For demo purposes, return 50% current allocation
      // In production, this would calculate from strategy balances
      return 5000; // 50%
    } catch (error) {
      console.error(`Error getting current allocation:`, error);
      return 0;
    }
  }

  isConnected(): boolean {
    try {
      return this.provider !== null && this.treasuryContract !== null;
    } catch (error) {
      return false;
    }
  }
}
