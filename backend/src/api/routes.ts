import { Router, Request, Response } from 'express';
import { ProposalStorage } from '../services/storage';
import { OnChainWatcher } from '../services/watcher';
import { PriceOracle } from '../services/oracle';
import { DecisionEngine } from '../services/decision-engine';
import { Relayer } from '../services/relayer';
import { MultiSig } from '../services/multisig';
import { Proposal } from '../types';
import { Config } from '../services/config';

export function createApiRoutes(
  storage: ProposalStorage,
  watcher: OnChainWatcher,
  oracle: PriceOracle,
  decisionEngine: DecisionEngine,
  relayer?: Relayer,
  multiSig?: MultiSig
): Router {
  const router = Router();

  /** Health / Status Endpoint */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const isWatching = watcher.isConnected();
      const contractAddresses = {
        treasuryController: Config.contractConfig.treasuryController,
        guardian: Config.contractConfig.guardian,
        chainId: Config.contractConfig.chainId,
      };
      res.json({
        status: 'ok',
        connected: isWatching,
        contracts: contractAddresses,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  /** Get Balances */
  router.get('/balances', async (req: Request, res: Response) => {
    try {
      const tokens = ['0x0000000000000000000000000000000000000000']; // Native token (ETH/BNB)
      const balances = await watcher.getAllBalances(tokens);
      res.json({ balances });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Get Allocations */
  router.get('/allocations', async (req: Request, res: Response) => {
    try {
      const tokens = ['0x0000000000000000000000000000000000000000'];
      const allocations = await Promise.all(
        tokens.map(async (token) => {
          const target = await watcher.getTargetAllocation(token);
          const current = await watcher.getCurrentAllocation(token);
          return {
            token,
            targetAllocation: target,
            currentAllocation: current,
            isRebalanced: Math.abs(target - current) < 500, // Within 5%
          };
        })
      );
      res.json({ allocations });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** List Proposals */
  router.get('/proposals', async (req: Request, res: Response) => {
    try {
      const proposals = await storage.getProposals();
      res.json({ proposals });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Get Single Proposal */
  router.get('/proposals/:id', async (req: Request, res: Response) => {
    try {
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }
      res.json({ proposal });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Create Proposal */
  router.post('/proposals', async (req: Request, res: Response) => {
    try {
      const { token, amount, type, strategy, reason } = req.body;
      const proposal: Proposal = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        token: token || '0x0000000000000000000000000000000000000000',
        amount: amount || '0',
        type: type || 'deposit',
        strategy: strategy || Config.contractConfig.treasuryController,
        reason: reason || 'Manual proposal',
        status: 'pending',
      };
      await storage.saveProposal(proposal);
      res.json({ success: true, proposal });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Execute Proposal via relayer */
  router.post('/proposals/:id/execute', async (req: Request, res: Response) => {
    try {
      if (!relayer) {
        return res.status(500).json({ success: false, error: 'Relayer not initialized' });
      }
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }
      // Use the strategy address from the proposal or a default
      const strategyAddress = proposal.strategy || Config.contractConfig.treasuryController;
      await relayer.executeProposal(proposal, strategyAddress);
      res.json({ success: true, message: 'Proposal executed' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Confirm Proposal via multisig */
  router.post('/proposals/:id/confirm', async (req: Request, res: Response) => {
      try {
          const proposalId = req.params.id;
          const owner = req.body.owner;
          if (!multiSig) {
              return res.status(500).json({ success: false, error: 'MultiSig not initialized' });
          }
          await multiSig.confirmProposal(proposalId, owner);
          res.json({ success: true, message: 'Proposal confirmed' });
      } catch (error: any) {
          res.status(500).json({ success: false, error: error.message });
      }
  });

  return router;
}
