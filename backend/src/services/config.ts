import dotenv from 'dotenv';
import { ContractConfig, RelayerConfig, DecisionEngineConfig } from '../types';

dotenv.config();

export class Config {
  static get contractConfig(): ContractConfig {
    return {
      treasuryController: process.env.TREASURY_CONTROLLER_ADDRESS || '',
      guardian: process.env.GUARDIAN_ADDRESS || '',
      rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
      chainId: parseInt(process.env.CHAIN_ID || '97'), // Default: BSC Testnet
    };
  }

  static get relayerConfig(): RelayerConfig {
    const privateKey = process.env.RELAYER_PRIVATE_KEY || '';
    if (!privateKey) {
      console.warn('Warning: RELAYER_PRIVATE_KEY not set');
    }
    return {
      privateKey,
      address: process.env.RELAYER_ADDRESS || '',
    };
  }

  static get decisionEngineConfig(): DecisionEngineConfig {
    return {
      rebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD || '5'), // 5% deviation
      minRebalanceAmount: parseFloat(process.env.MIN_REBALANCE_AMOUNT || '0.1'), // 0.1 token units
      checkInterval: parseInt(process.env.CHECK_INTERVAL || '5'), // 5 minutes
    };
  }

  static get apiPort(): number {
    return parseInt(process.env.API_PORT || '3001');
  }

  static get dataPath(): string {
    return process.env.DATA_PATH || './data';
  }
}
