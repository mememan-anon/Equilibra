import { ethers } from 'ethers';
import { ContractConfig, RelayerConfig, Proposal } from '../types';

// Minimal ABI for execution
const TREASURY_ABI = [
  'function depositToStrategy(address token, uint256 amount, address strategy) external returns (uint256)',
  'function withdrawFromStrategy(address token, uint256 amount, address strategy) external returns (uint256)',
  'function harvestRewards(address strategy) external returns (uint256)',
];

const GUARDIAN_ABI = [
  'function executeProposal(address target, uint256 value, bytes calldata data) external',
];

export class Relayer {
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private treasuryContract: ethers.Contract;
  private guardianContract: ethers.Contract;

  constructor(
    config: ContractConfig,
    relayerConfig: RelayerConfig
  ) {
    if (!relayerConfig.privateKey) {
      throw new Error('RELAYER_PRIVATE_KEY not set');
    }

    this.wallet = new ethers.Wallet(relayerConfig.privateKey);
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = this.wallet.connect(this.provider);

    this.treasuryContract = new ethers.Contract(
      config.treasuryController,
      TREASURY_ABI,
      this.wallet
    );

    this.guardianContract = new ethers.Contract(
      config.guardian,
      GUARDIAN_ABI,
      this.wallet
    );

    console.log(`Relayer initialized: ${this.wallet.address}`);
  }

  async executeProposal(proposal: Proposal, strategyAddress: string): Promise<string> {
    console.log(`Executing proposal: ${proposal.id}`);
    console.log(`Type: ${proposal.type}, Token: ${proposal.token}, Amount: ${proposal.amount}`);

    try {
      let tx: ethers.ContractTransactionResponse;

      switch (proposal.type) {
        case 'deposit':
          tx = await this.treasuryContract.depositToStrategy(
            proposal.token,
            proposal.amount,
            strategyAddress
          );
          break;

        case 'withdraw':
          tx = await this.treasuryContract.withdrawFromStrategy(
            proposal.token,
            proposal.amount,
            strategyAddress
          );
          break;

        case 'harvest':
          tx = await this.treasuryContract.harvestRewards(strategyAddress);
          break;

        default:
          throw new Error(`Unknown proposal type: ${proposal.type}`);
      }

      console.log(`Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

      return tx.hash;
    } catch (error: any) {
      console.error(`Error executing proposal:`, error.message);
      throw error;
    }
  }

  async executeWithGuardian(
    target: string,
    value: bigint,
    data: string
  ): Promise<string> {
    console.log(`Executing proposal through Guardian`);
    console.log(`Target: ${target}, Value: ${value}`);

    try {
      const tx = await this.guardianContract.executeProposal(target, value, data);
      console.log(`Transaction submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

      return tx.hash;
    } catch (error: any) {
      console.error(`Error executing with Guardian:`, error.message);
      throw error;
    }
  }

  async estimateGas(proposal: Proposal, strategyAddress: string): Promise<bigint> {
    try {
      switch (proposal.type) {
        case 'deposit':
          return await this.treasuryContract.depositToStrategy.estimateGas(
            proposal.token,
            proposal.amount,
            strategyAddress
          );

        case 'withdraw':
          return await this.treasuryContract.withdrawFromStrategy.estimateGas(
            proposal.token,
            proposal.amount,
            strategyAddress
          );

        case 'harvest':
          return await this.treasuryContract.harvestRewards.estimateGas(strategyAddress);

        default:
          throw new Error(`Unknown proposal type: ${proposal.type}`);
      }
    } catch (error) {
      console.error('Error estimating gas:', error);
      return BigInt(100000); // Default gas limit
    }
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async getBalance(): Promise<bigint> {
    return await this.provider.getBalance(this.wallet.address);
  }
}
