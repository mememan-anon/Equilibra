import express, { Application } from 'express';
import cors from 'cors';
import { Config } from './services/config';
import { OnChainWatcher } from './services/watcher';
import { PriceOracle } from './services/oracle';
import { DecisionEngine } from './services/decision-engine';
import { ProposalStorage } from './services/storage';
import { Relayer } from './services/relayer';
import { createApiRoutes } from './api/routes';
import cron from 'node-cron';

export class AegisBackend {
  private app: Application;
  private watcher: OnChainWatcher;
  private oracle: PriceOracle;
  private decisionEngine: DecisionEngine;
  private storage: ProposalStorage;
  private relayer?: Relayer;

  constructor() {
    this.app = express();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  async initialize(): Promise<void> {
    console.log('Initializing AegisTreasury Backend...');

    // Initialize services
    this.watcher = new OnChainWatcher(Config.contractConfig);
    await this.watcher.initialize();

    this.oracle = new PriceOracle();
    this.decisionEngine = new DecisionEngine(this.oracle, Config.decisionEngineConfig);

    this.storage = new ProposalStorage(Config.dataPath);
    await this.storage.initialize();

    // Initialize relayer if private key is configured
    if (Config.relayerConfig.privateKey) {
      try {
        this.relayer = new Relayer(Config.contractConfig, Config.relayerConfig);
        console.log('Relayer initialized');
      } catch (error: any) {
        console.warn(`Failed to initialize relayer: ${error.message}`);
      }
    }

    // Setup API routes
    this.app.use('/api', createApiRoutes(
      this.storage,
      this.watcher,
      this.oracle,
      this.decisionEngine,
      this.relayer
    ));

    // Start scheduled tasks
    this.startScheduledTasks();

    console.log('Backend initialized successfully');
  }

  private startScheduledTasks(): void {
    // Run decision engine every N minutes
    const cronPattern = `*/${Config.decisionEngineConfig.checkInterval} * * * *`;
    
    cron.schedule(cronPattern, async () => {
      console.log('Running scheduled allocation check...');
      await this.runAllocationCheck();
    });

    console.log(`Scheduled tasks: Allocation check every ${Config.decisionEngineConfig.checkInterval} minutes`);
  }

  private async runAllocationCheck(): Promise<void> {
    try {
      // Check main token (BNB)
      const tokens = ['0x0000000000000000000000000000000000000000'];
      const balances = await this.watcher.getAllBalances(tokens);
      
      // Get target allocation
      const targetAllocations = new Map<string, number>();
      for (const token of tokens) {
        const target = await this.watcher.getTargetAllocation(token);
        targetAllocations.set(token, target);
      }

      const result = await this.decisionEngine.analyzeAllocations(balances, targetAllocations);
      
      if (result.needsRebalancing && result.proposals.length > 0) {
        console.log(`Rebalancing needed! Generated ${result.proposals.length} proposals`);
        
        // Save proposals
        for (const proposal of result.proposals) {
          await this.storage.saveProposal(proposal);
        }
      } else {
        console.log('No rebalancing needed');
      }
    } catch (error: any) {
      console.error('Error in allocation check:', error);
    }
  }

  async start(): Promise<void> {
    const port = Config.apiPort;
    this.app.listen(port, () => {
      console.log(`\n========================================`);
      console.log(`AegisTreasury Backend Running`);
      console.log(`========================================`);
      console.log(`API: http://localhost:${port}`);
      console.log(`Health: http://localhost:${port}/api/status`);
      console.log(`========================================\n`);
    });
  }
}

// Main entry point
async function main() {
  const backend = new AegisBackend();
  await backend.initialize();
  await backend.start();
}

// Start if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start backend:', error);
    process.exit(1);
  });
}

export { main };
