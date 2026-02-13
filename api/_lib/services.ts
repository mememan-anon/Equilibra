/**
 * Shared service initialization for both Vercel serverless and local Express.
 * Uses a singleton pattern so services are initialized once per cold start.
 */

import { ethers } from 'ethers';

// ── Types ──

interface ContractConfig {
  treasuryController: string;
  guardian: string;
  exampleStrategy: string;
  mockToken: string;
  mockToken2?: string;
  rpcUrl: string;
  chainId: number;
}

interface RelayerConfig {
  privateKey: string;
  address: string;
}

interface DecisionEngineConfig {
  rebalanceThreshold: number;
  minRebalanceAmount: number;
  checkInterval: number;
}

interface Proposal {
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

interface TokenBalance {
  token: string;
  symbol: string;
  balance: string;
  decimals: number;
  price?: number;
  value?: number;
}

// ── Config ──

class Config {
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
    return {
      privateKey: process.env.RELAYER_PRIVATE_KEY || '',
      address: process.env.RELAYER_ADDRESS || '',
    };
  }

  static get decisionEngineConfig(): DecisionEngineConfig {
    return {
      rebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD || '5'),
      minRebalanceAmount: parseFloat(process.env.MIN_REBALANCE_AMOUNT || '0.1'),
      checkInterval: parseInt(process.env.CHECK_INTERVAL || '5'),
    };
  }
}

// ── OnChainWatcher ──

const TREASURY_ABI = [
  'function getTotalBalance(address token) view returns (uint256)',
  'function getStrategyBalance(address token, address strategy) view returns (uint256)',
  'function strategies(address) view returns (bool)',
  'function targetAllocations(address) view returns (uint256)',
  'function relayer() view returns (address)',
];

class OnChainWatcher {
  private provider: ethers.JsonRpcProvider;
  private treasuryContract: ethers.Contract;
  private mockTokenAddr: string;
  private mockToken2Addr: string;

  constructor(config: ContractConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.treasuryContract = new ethers.Contract(config.treasuryController, TREASURY_ABI, this.provider);
    this.mockTokenAddr = (config.mockToken || '').toLowerCase();
    this.mockToken2Addr = (config.mockToken2 || '').toLowerCase();
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
      const symbol =
        token.toLowerCase() === this.mockTokenAddr ? 'TST' :
        token.toLowerCase() === this.mockToken2Addr ? 'TST2' :
        token === ethers.ZeroAddress ? 'BNB' : 'TOKEN';
      balances.push({
        token,
        symbol,
        balance: balance.toString(),
        decimals: 18,
      });
    }
    return balances;
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
    return this.provider !== null && this.treasuryContract !== null;
  }
}

// ── PriceOracle (live CoinGecko) ──

const CG_IDS: Record<string, string> = { BNB: 'binancecoin', USDT: 'tether', USDC: 'usd-coin', ETH: 'ethereum', TOKEN: 'binancecoin' };
const FALLBACK: Record<string, number> = { BNB: 600, USDT: 1.0, USDC: 1.0, ETH: 3200, TOKEN: 1.0 };

class PriceOracle {
  private cache: Map<string, { price: number; ts: number }> = new Map();

  async getPrice(token: string): Promise<number> {
    const sym = this.getTokenSymbol(token);
    const cached = this.cache.get(sym);
    if (cached && Date.now() - cached.ts < 60_000) return cached.price;
    const cgId = CG_IDS[sym] || CG_IDS.TOKEN;
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as Record<string, { usd: number }>;
      const price = data[cgId]?.usd;
      if (price) { this.cache.set(sym, { price, ts: Date.now() }); return price; }
    } catch { /* fallback */ }
    return FALLBACK[sym] ?? 1.0;
  }

  async getPrices(tokens: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    for (const token of tokens) {
      prices.set(token, await this.getPrice(token));
    }
    return prices;
  }

  private getTokenSymbol(token: string): string {
    if (token === '0x0000000000000000000000000000000000000000') return 'BNB';
    if (token.toLowerCase().includes('usdt')) return 'USDT';
    if (token.toLowerCase().includes('usdc')) return 'USDC';
    return 'TOKEN';
  }
}

// ── DecisionEngine ──

class DecisionEngine {
  constructor(
    private oracle: PriceOracle,
    private config: DecisionEngineConfig,
  ) {}

  async analyzeAllocations(currentBalances: TokenBalance[], targetAllocations: Map<string, number>) {
    const proposals: Proposal[] = [];
    const allocations: { token: string; targetPercentage: number; currentPercentage: number; isRebalanced: boolean }[] = [];
    let needsRebalancing = false;
    const prices = await this.oracle.getPrices(currentBalances.map((b) => b.token));

    let totalValue = 0;
    for (const balance of currentBalances) {
      const price = prices.get(balance.token) || 0;
      const balanceNum = parseFloat(balance.balance) / Math.pow(10, balance.decimals);
      balance.value = balanceNum * price;
      totalValue += balance.value;
    }

    for (const balance of currentBalances) {
      const currentPercentage = totalValue > 0 ? ((balance.value || 0) / totalValue) * 100 : 0;
      const targetPercentage = targetAllocations.get(balance.token) || 0;
      const deviation = Math.abs(currentPercentage - targetPercentage);
      const isRebalanced = deviation <= this.config.rebalanceThreshold;
      allocations.push({ token: balance.token, targetPercentage, currentPercentage, isRebalanced });
      if (!isRebalanced) needsRebalancing = true;
    }

    return { needsRebalancing, allocations, proposals };
  }
}

// ── In-Memory ProposalStorage (works on Vercel) ──

class ProposalStorage {
  private proposals: Proposal[] = [];

  async initialize(): Promise<void> {
    // Pre-seed with demo proposals for initial load
    if (this.proposals.length === 0) {
      this.proposals = [
        {
          id: '1',
          timestamp: Math.floor(Date.now() / 1000) - 3600,
          type: 'deposit',
          token: 'USDT',
          amount: '100000',
          strategy: '0x3B60eA02752D6C7221F4e7f315066f9969aBC903',
          reason: 'Deposit to Venus strategy for yield farming',
          status: 'executed',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
        },
        {
          id: '2',
          timestamp: Math.floor(Date.now() / 1000) - 1800,
          type: 'harvest',
          token: 'BNB',
          amount: '15.5',
          strategy: '0x3B60eA02752D6C7221F4e7f315066f9969aBC903',
          reason: 'Harvest rewards from PancakeSwap staking',
          status: 'pending',
        },
        {
          id: '3',
          timestamp: Math.floor(Date.now() / 1000) - 900,
          type: 'withdraw',
          token: 'USDT',
          amount: '50000',
          strategy: '0x3B60eA02752D6C7221F4e7f315066f9969aBC903',
          reason: 'Rebalance portfolio - reduce USDT allocation',
          status: 'approved',
          executionTime: Math.floor(Date.now() / 1000) + 3600,
        },
      ];
    }
  }

  async saveProposal(proposal: Proposal): Promise<void> {
    this.proposals.push(proposal);
  }

  async getProposals(): Promise<Proposal[]> {
    return [...this.proposals].sort((a, b) => b.timestamp - a.timestamp);
  }

  async getProposal(id: string): Promise<Proposal | null> {
    return this.proposals.find((p) => p.id === id) || null;
  }

  async updateProposal(id: string, updates: Partial<Proposal>): Promise<void> {
    const idx = this.proposals.findIndex((p) => p.id === id);
    if (idx !== -1) this.proposals[idx] = { ...this.proposals[idx], ...updates };
  }

}

// ── Relayer ──

const TREASURY_EXEC_ABI = [
  'function depositToStrategy(address token, uint256 amount, address strategy) external returns (uint256)',
  'function withdrawFromStrategy(address token, uint256 amount, address strategy) external returns (uint256)',
  'function harvestRewards(address strategy) external returns (uint256)',
  'function getStrategyBalance(address token, address strategy) view returns (uint256)',
];
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function mint(address to, uint256 amount) external',
];

class Relayer {
  private wallet: ethers.Wallet;
  private treasuryContract: ethers.Contract;

  constructor(config: ContractConfig, relayerConfig: RelayerConfig) {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(relayerConfig.privateKey, provider);
    this.treasuryContract = new ethers.Contract(config.treasuryController, TREASURY_EXEC_ABI, this.wallet);
  }

  async executeProposal(proposal: Proposal, strategyAddress: string): Promise<string> {
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
      const token = new ethers.Contract(proposal.token, ERC20_ABI, this.wallet.provider);
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
        tx = await this.treasuryContract.depositToStrategy(proposal.token, normalizedAmount, strategyAddress);
        break;
      case 'withdraw':
        tx = await this.treasuryContract.withdrawFromStrategy(proposal.token, normalizedAmount, strategyAddress);
        break;
      case 'harvest':
        tx = await this.treasuryContract.harvestRewards(strategyAddress);
        break;
      default:
        throw new Error(`Unknown proposal type: ${proposal.type}`);
    }
    await tx.wait();
    return tx.hash;
  }

  async mintToken(token: string, to: string, amount: string): Promise<string> {
    if (!this.isAllowedToken(token)) {
      throw new Error('Token not allowed for mint.');
    }
    const normalizedAmount = this.normalizeAmount(amount);
    const tokenContract = new ethers.Contract(token, ERC20_ABI, this.wallet);
    const tx = await tokenContract.mint(to, normalizedAmount);
    await tx.wait();
    return tx.hash;
  }

  private isAllowedToken(token?: string): boolean {
    if (!token) return false;
    const allowed = [Config.contractConfig.mockToken, Config.contractConfig.mockToken2]
      .filter(Boolean)
      .map((t) => String(t).toLowerCase());
    return allowed.includes(token.toLowerCase());
  }

  private isNativeToken(token: string): boolean {
    return token.toLowerCase() === '0x0000000000000000000000000000000000000000';
  }

  private normalizeAmount(raw: string): string {
    const value = String(raw).trim();
    if (!value) throw new Error('Proposal amount is empty');

    if (/^\d+$/.test(value)) return value;

    const decimalMatch = value.match(/^(\d+)\.(\d+)$/);
    if (decimalMatch) {
      const [, intPart, fracPart] = decimalMatch;
      if (/^0+$/.test(fracPart)) return intPart;
      throw new Error(`Invalid non-integer proposal amount: ${raw}`);
    }

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
}

// ── NotificationService (stub for serverless) ──

class NotificationService {
  async notifyProposalCreated(id: string, type: string, amount: string, reason: string) {
    console.log(`[Notification] Proposal ${id} created: ${type} ${amount} - ${reason}`);
  }
  async notifyProposalExecuted(id: string, status: string, txHash?: string) {
    console.log(`[Notification] Proposal ${id} ${status}${txHash ? ` tx:${txHash}` : ''}`);
  }
}

// ── Singleton ──

interface Services {
  storage: ProposalStorage;
  watcher: OnChainWatcher;
  oracle: PriceOracle;
  decisionEngine: DecisionEngine;
  relayer: Relayer | null;
  notifications: NotificationService;
  config: typeof Config;
}

let services: Services | null = null;

export async function initServices(): Promise<void> {
  if (services) return;

  const watcher = new OnChainWatcher(Config.contractConfig);
  const oracle = new PriceOracle();
  const decisionEngine = new DecisionEngine(oracle, Config.decisionEngineConfig);
  const storage = new ProposalStorage();
  await storage.initialize();

  let relayer: Relayer | null = null;
  if (Config.relayerConfig.privateKey) {
    try {
      relayer = new Relayer(Config.contractConfig, Config.relayerConfig);
    } catch (e: any) {
      console.warn('Relayer init failed:', e.message);
    }
  }

  const notifications = new NotificationService();

  services = { storage, watcher, oracle, decisionEngine, relayer, notifications, config: Config };
  console.log('Services initialized');
}

export function getServices(): Services {
  if (!services) throw new Error('Services not initialized');
  return services;
}
