import { ethers } from 'ethers';
import { ContractConfig, RelayerConfig, Proposal } from '../types';

// Minimal ABI for execution
const TREASURY_ABI = [
  'function depositToStrategy(address token, uint256 amount, address strategy) external returns (uint256)',
  'function withdrawFromStrategy(address token, uint256 amount, address strategy) external returns (uint256)',
  'function harvestRewards(address strategy) external returns (uint256)',
  'function getStrategyBalance(address token, address strategy) view returns (uint256)',
];

const GUARDIAN_ABI = [
  'function executeProposal(address target, uint256 value, bytes calldata data) external',
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function mint(address to, uint256 amount) external',
];

export class Relayer {
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private treasuryContract: ethers.Contract;
  private guardianContract: ethers.Contract;
  private allowedTokens: string[];

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

    this.allowedTokens = [config.mockToken, config.mockToken2]
      .filter(Boolean)
      .map((t) => String(t).toLowerCase());

    console.log(`Relayer initialized: ${this.wallet.address}`);
  }

  async executeProposal(proposal: Proposal, strategyAddress: string): Promise<string> {
    console.log(`Executing proposal: ${proposal.id}`);
    console.log(`Type: ${proposal.type}, Token: ${proposal.token}, Amount: ${proposal.amount}`);

    try {
      let tx: ethers.ContractTransactionResponse;
      const normalizedAmount = this.normalizeAmount(proposal.amount);
      const amountWei = BigInt(normalizedAmount);

      if ((proposal.type === 'deposit' || proposal.type === 'withdraw') && !this.isAllowedToken(proposal.token)) {
        throw new Error('Token not allowed for deposit/withdraw.');
      }

      if (proposal.type === 'withdraw') {
        const strategyBalance = await this.treasuryContract.getStrategyBalance(proposal.token, strategyAddress) as bigint;
        if (amountWei > strategyBalance) {
          throw new Error(
            `Withdraw amount exceeds strategy balance. Requested=${amountWei.toString()} Available=${strategyBalance.toString()}`
          );
        }
      }

      if (proposal.type === 'deposit') {
        const token = new ethers.Contract(proposal.token, ERC20_ABI, this.provider);
        const treasuryAddress = String(this.treasuryContract.target);
        const treasuryBalance = await token.balanceOf(treasuryAddress) as bigint;
        if (amountWei > treasuryBalance) {
          throw new Error(
            `Deposit amount exceeds treasury balance. Requested=${amountWei.toString()} Available=${treasuryBalance.toString()}`
          );
        }
      }

      switch (proposal.type) {
        case 'deposit':
          tx = await this.treasuryContract.depositToStrategy(
            proposal.token,
            normalizedAmount,
            strategyAddress
          );
          break;

        case 'withdraw':
          tx = await this.treasuryContract.withdrawFromStrategy(
            proposal.token,
            normalizedAmount,
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
      const normalizedAmount = this.normalizeAmount(proposal.amount);
      switch (proposal.type) {
        case 'deposit':
          return await this.treasuryContract.depositToStrategy.estimateGas(
            proposal.token,
            normalizedAmount,
            strategyAddress
          );

        case 'withdraw':
          return await this.treasuryContract.withdrawFromStrategy.estimateGas(
            proposal.token,
            normalizedAmount,
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

  async mintToken(token: string, to: string, amount: string): Promise<string> {
    if (!this.isAllowedToken(token)) {
      throw new Error('Token not allowed for mint.');
    }

    const normalizedAmount = this.normalizeAmount(amount);
    const tokenContract = new ethers.Contract(token, ERC20_ABI, this.wallet);

    try {
      const tx = await tokenContract.mint(to, normalizedAmount);
      console.log(`Mint submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Mint confirmed in block ${receipt?.blockNumber}`);
      return tx.hash;
    } catch (error: any) {
      console.error(`Error minting token:`, error.message);
      throw error;
    }
  }

  private normalizeAmount(raw: string): string {
    const value = String(raw).trim();
    if (!value) throw new Error('Proposal amount is empty');

    // Already canonical uint string.
    if (/^\d+$/.test(value)) return value;

    // Decimal string: allow only zero fractional part (e.g. "10.0").
    const decimalMatch = value.match(/^(\d+)\.(\d+)$/);
    if (decimalMatch) {
      const [, intPart, fracPart] = decimalMatch;
      if (/^0+$/.test(fracPart)) return intPart;
      throw new Error(`Invalid non-integer proposal amount: ${raw}`);
    }

    // Scientific notation (e.g. "4.95e+21").
    const sciMatch = value.match(/^(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
    if (sciMatch) {
      const [, intPart, fracPartRaw = '', expRaw] = sciMatch;
      const exponent = Number(expRaw);
      if (!Number.isInteger(exponent)) {
        throw new Error(`Invalid scientific proposal amount: ${raw}`);
      }

      const digits = `${intPart}${fracPartRaw}`;
      const shift = exponent - fracPartRaw.length;

      if (shift >= 0) return `${digits}${'0'.repeat(shift)}`;

      const cut = digits.length + shift;
      if (cut <= 0) throw new Error(`Invalid non-integer proposal amount: ${raw}`);
      const integerPart = digits.slice(0, cut);
      const fractionalPart = digits.slice(cut);
      if (!/^0*$/.test(fractionalPart)) {
        throw new Error(`Invalid non-integer proposal amount: ${raw}`);
      }
      return integerPart;
    }

    throw new Error(`Unsupported proposal amount format: ${raw}`);
  }

  private isNativeToken(token: string): boolean {
    return token.toLowerCase() === '0x0000000000000000000000000000000000000000';
  }

  private isAllowedToken(token?: string): boolean {
    if (!token) return false;
    return this.allowedTokens.includes(token.toLowerCase());
  }
}
