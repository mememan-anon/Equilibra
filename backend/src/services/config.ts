import dotenv from 'dotenv';
import path from 'path';
import { ContractConfig, RelayerConfig, DecisionEngineConfig } from '../types';

// Load .env from backend dir first, then fall back to root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

export class Config {
  static get contractConfig(): ContractConfig {
    return {
      treasuryController: process.env.TREASURY_CONTROLLER_ADDRESS || '0x0a376e8E8E3dcda4Adb898f17cF43bC2dc388456',
      guardian: process.env.GUARDIAN_ADDRESS || '0x1073064f7D11fce512337018cD351578aA39eD77',
      exampleStrategy: process.env.EXAMPLE_STRATEGY_ADDRESS || '0x3B60eA02752D6C7221F4e7f315066f9969aBC903',
      mockToken: process.env.MOCK_TOKEN_ADDRESS || '0xC35D40596389d4FCA0c59849DA01a51e522Ec708',
      mockToken2: process.env.MOCK_TOKEN_2_ADDRESS,
      rpcUrl: process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: parseInt(process.env.CHAIN_ID || '97'),
    };
  }

  static get relayerConfig(): RelayerConfig {
    const privateKey = process.env.RELAYER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    if (!privateKey) {
      console.warn('Warning: RELAYER_PRIVATE_KEY not set');
    }
    return {
      privateKey,
      address: process.env.RELAYER_ADDRESS || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
