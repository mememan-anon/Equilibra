import { Router, Request, Response } from 'express';
import { ProposalStorage } from '../services/storage';
import { OnChainWatcher } from '../services/watcher';
import { PriceOracle } from '../services/oracle';
import { DecisionEngine } from '../services/decision-engine';
import { Relayer } from '../services/relayer';
import { Proposal } from '../types';
import { Config } from '../services/config';

export function createApiRoutes(
  storage: ProposalStorage,
  watcher: OnChainWatcher,
  oracle: PriceOracle,
  decisionEngine: DecisionEngine,
  relayer?: Relayer
): Router {
  const router = Router();

  /**
   * GET /api/proposals
   * Get list of proposals, optionally filtered by status
   */
  router.get('/proposals', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const proposals = await storage.getProposals(
        status ? { status: status as string } : undefined
      );
      res.json({ success: true, proposals });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/proposals/:id
   * Get details of a specific proposal
   */
  router.get('/proposals/:id', async (req: Request, res: Response) => {
    try {
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }
      res.json({ success: true, proposal });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/proposals
   * Create a new proposal
   */
  router.post('/proposals', async (req: Request, res: Response) => {
    try {
      const proposal: Proposal = req.body;
      proposal.id = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      proposal.timestamp = Date.now();
      proposal.status = 'pending';
      
      await storage.saveProposal(proposal);
      res.json({ success: true, proposal });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/proposals/:id/approve
   * Approve a proposal
   */
  router.post('/proposals/:id/approve', async (req: Request, res: Response) => {
    try {
      await storage.updateProposal(req.params.id, { status: 'approved' });
      const proposal = await storage.getProposal(req.params.id);
      res.json({ success: true, proposal });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/proposals/:id/execute
   * Execute a proposal on-chain
   */
  router.post('/proposals/:id/execute', async (req: Request, res: Response) => {
    try {
      if (!relayer) {
        return res.status(500).json({ success: false, error: 'Relayer not initialized' });
      }

      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }

      if (proposal.status !== 'approved') {
        return res.status(400).json({ success: false, error: 'Proposal must be approved first' });
      }

      // Execute on-chain
      const strategyAddress = req.body.strategyAddress || '0x0000000000000000000000000000000000000000';
      const txHash = await relayer.executeProposal(proposal, strategyAddress);

      // Update proposal
      await storage.updateProposal(req.params.id, {
        status: 'executed',
        txHash,
        executionTime: Date.now(),
      });

      const updatedProposal = await storage.getProposal(req.params.id);
      res.json({ success: true, proposal: updatedProposal, txHash });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/proposals/:id
   * Delete a proposal
   */
  router.delete('/proposals/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteProposal(req.params.id);
      res.json({ success: true, message: 'Proposal deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/balances
   * Get current treasury balances
   */
  router.get('/balances', async (req: Request, res: Response) => {
    try {
      const tokens = req.query.tokens as string;
      const tokenList = tokens ? tokens.split(',') : ['0x0000000000000000000000000000000000000000']; // Default to BNB
      
      const balances = await watcher.getAllBalances(tokenList);
      
      // Add prices
      const prices = await oracle.getPrices(balances.map(b => b.token));
      balances.forEach(b => {
        const price = prices.get(b.token) || 0;
        const balanceNum = parseFloat(b.balance) / Math.pow(10, b.decimals);
        b.price = price;
        b.value = balanceNum * price;
      });

      res.json({ success: true, balances });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/allocations
   * Get current allocation analysis
   */
  router.get('/allocations', async (req: Request, res: Response) => {
    try {
      const tokens = req.query.tokens as string;
      const tokenList = tokens ? tokens.split(',') : ['0x0000000000000000000000000000000000000000'];
      
      const balances = await watcher.getAllBalances(tokenList);
      
      // Get target allocations
      const config = Config.decisionEngineConfig;
      const targetAllocations = new Map<string, number>();
      for (const token of tokenList) {
        const target = await watcher.getTargetAllocation(token);
        targetAllocations.set(token, target);
      }

      const result = await decisionEngine.analyzeAllocations(balances, targetAllocations);
      
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/status
   * Get system status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const status = {
        relayer: relayer ? relayer.getAddress() : 'not configured',
        provider: 'connected',
        timestamp: Date.now(),
      };
      res.json({ success: true, status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
