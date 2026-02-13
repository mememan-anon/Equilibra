import { Router, Request, Response } from 'express';
import { ProposalStorage } from '../services/storage';
import { OnChainWatcher } from '../services/watcher';
import { PriceOracle } from '../services/oracle';
import { Relayer } from '../services/relayer';
import { NotificationService } from '../services/notifications';
import { Proposal } from '../types';
import { Config } from '../services/config';
import { DecisionEngine } from '../services/decision-engine';

export function createApiRoutes(
  storage: ProposalStorage,
  watcher: OnChainWatcher,
  oracle: PriceOracle,
  decisionEngine: DecisionEngine,
  relayer?: Relayer,
  notifications?: NotificationService
): Router {
  const router = Router();
  const notificationService = notifications || new NotificationService();
  const allowedTokens = [Config.contractConfig.mockToken, Config.contractConfig.mockToken2]
    .filter(Boolean)
    .map((t) => String(t).toLowerCase());
  const isAllowedToken = (token?: string) =>
    !!token && allowedTokens.includes(token.toLowerCase());

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
      const tokens = [Config.contractConfig.mockToken, Config.contractConfig.mockToken2].filter(Boolean) as string[];
      const balances = await watcher.getAllBalances(tokens);
      const prices = await oracle.getPrices(tokens);

      const enriched = await Promise.all(balances.map(async (b) => {
        const price = prices.get(b.token) ?? 0;
        const treasuryBalance = BigInt(b.balance);
        const strategyBalance = await watcher.getStrategyBalance(b.token, Config.contractConfig.exampleStrategy);
        const totalBalance = treasuryBalance + strategyBalance;
        const humanBalance = Number(totalBalance) / Math.pow(10, b.decimals || 18);
        return {
          ...b,
          balance: totalBalance.toString(),
          treasuryBalance: treasuryBalance.toString(),
          strategyBalance: strategyBalance.toString(),
          price,
          value: humanBalance * price,
        };
      }));

      res.json({ balances: enriched });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Get Allocations */
  router.get('/allocations', async (req: Request, res: Response) => {
    try {
      const tokens = [Config.contractConfig.mockToken, Config.contractConfig.mockToken2].filter(Boolean) as string[];
      const balances = await Promise.all(
        tokens.map(async (token) => {
          const treasury = await watcher.getTreasuryBalance(token);
          const strategy = await watcher.getStrategyBalance(token, Config.contractConfig.exampleStrategy);
          const total = treasury + strategy;
          return { token, total };
        }),
      );
      const prices = await oracle.getPrices(tokens);
      const totalUsd = balances.reduce((sum, b) => {
        const price = prices.get(b.token) ?? 0;
        return sum + (Number(b.total) / 1e18) * price;
      }, 0);

      const allocations = await Promise.all(
        tokens.map(async (token) => {
          const target = await watcher.getTargetAllocation(token);
          const bal = balances.find((b) => b.token === token);
          const price = prices.get(token) ?? 0;
          const tokenUsd = bal ? (Number(bal.total) / 1e18) * price : 0;
          const current = totalUsd > 0 ? (tokenUsd / totalUsd) * 100 : 0;
          return {
            token,
            targetPercentage: target,
            currentPercentage: current,
            targetAllocation: target,
            currentAllocation: current,
            isRebalanced: Math.abs(target - current) < 5,
          };
        }),
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
      if ((type === 'deposit' || type === 'withdraw') && !isAllowedToken(token)) {
        return res.status(400).json({ success: false, error: 'Token not allowed for deposit/withdraw.' });
      }
      let amountWei = BigInt(0);
      if (amount !== undefined) {
        try {
          amountWei = BigInt(String(amount));
        } catch {
          return res.status(400).json({ success: false, error: 'Amount must be an integer string (wei).' });
        }
      }
      if (type === 'deposit') {
        const treasuryBalance = await watcher.getTreasuryBalance(String(token));
        if (amountWei > treasuryBalance) {
          return res.status(400).json({
            success: false,
            error: `Deposit amount exceeds treasury balance. Requested=${amountWei.toString()} Available=${treasuryBalance.toString()}`,
          });
        }
      }
      if (type === 'withdraw') {
        const strategyBalance = await watcher.getStrategyBalance(String(token), Config.contractConfig.exampleStrategy);
        if (amountWei > strategyBalance) {
          return res.status(400).json({
            success: false,
            error: `Withdraw amount exceeds strategy balance. Requested=${amountWei.toString()} Available=${strategyBalance.toString()}`,
          });
        }
      }
      const proposal: Proposal = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        token: token || Config.contractConfig.mockToken,
        amount: amount || '0',
        type: type || 'deposit',
        strategy: strategy || Config.contractConfig.exampleStrategy,
        reason: reason || 'Manual proposal',
        status: 'pending',
      };
      await storage.saveProposal(proposal);

      // Send notification
      await notificationService.notifyProposalCreated(
        proposal.id,
        proposal.type,
        proposal.amount,
        proposal.reason
      );

      res.json({ success: true, proposal });
    } catch (error: any) {
      await notificationService.notifySystemError(error.message, 'Create proposal');
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
      const txHash = await relayer.executeProposal(proposal, strategyAddress);

      // Update proposal status
      await storage.updateProposal(proposal.id, { status: 'executed', txHash });

      // Send notification
      await notificationService.notifyProposalExecuted(
        proposal.id,
        'success',
        txHash
      );

      res.json({ success: true, message: 'Proposal executed', txHash });
    } catch (error: any) {
      await notificationService.notifySystemError(error.message, 'Execute proposal');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Approve Proposal (pending → approved) */
  router.post('/proposals/:id/approve', async (req: Request, res: Response) => {
    try {
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }
      if (proposal.status !== 'pending') {
        return res.status(400).json({ success: false, error: `Cannot approve proposal with status '${proposal.status}'` });
      }
      await storage.updateProposal(req.params.id, { status: 'approved' });

      await notificationService.notifyProposalCreated(
        proposal.id,
        'approved',
        proposal.amount,
        `Proposal ${proposal.id} approved`
      );

      res.json({ success: true, message: 'Proposal approved' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Trigger Rebalance (create proposals) */
  router.post('/rebalance', async (req: Request, res: Response) => {
    try {
      const tokens = [Config.contractConfig.mockToken, Config.contractConfig.mockToken2].filter(Boolean) as string[];
      if (tokens.length < 2) {
        return res.status(400).json({ success: false, error: 'Need at least 2 tokens configured for rebalancing.' });
      }

      const existing = await storage.getProposals();
      const active = existing.filter((p) => p.status === 'pending' || p.status === 'approved');
      const hasActiveFor = (proposal: Proposal) =>
        active.some(
          (p) =>
            p.token.toLowerCase() === proposal.token.toLowerCase() &&
            p.type === proposal.type &&
            p.strategy.toLowerCase() === proposal.strategy.toLowerCase(),
        );

      const treasuryBalances = await watcher.getAllBalances(tokens);
      const balances = await Promise.all(
        treasuryBalances.map(async (b) => {
          const strategyBalance = await watcher.getStrategyBalance(b.token, Config.contractConfig.exampleStrategy);
          return {
            ...b,
            balance: (BigInt(b.balance) + strategyBalance).toString(),
            treasuryBalance: b.balance,
            strategyBalance: strategyBalance.toString(),
          };
        }),
      );

      const targetAllocations = new Map<string, number>();
      for (const token of tokens) {
        const target = await watcher.getTargetAllocation(token);
        targetAllocations.set(token, target);
      }

      const result = await decisionEngine.analyzeAllocations(balances, targetAllocations);
      if (!result.needsRebalancing || result.proposals.length === 0) {
        return res.json({ success: true, proposals: [], message: 'No rebalancing needed.' });
      }

      const proposalsToSave = result.proposals.filter((p) => !hasActiveFor(p));
      if (proposalsToSave.length === 0) {
        return res.json({ success: true, proposals: [], message: 'Rebalance already has active proposals.' });
      }

      for (const proposal of proposalsToSave) {
        await storage.saveProposal(proposal);
      }

      res.json({ success: true, proposals: proposalsToSave });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Mint Mock Tokens (treasury top-up) */
  router.post('/mint', async (req: Request, res: Response) => {
    try {
      if (!relayer) {
        return res.status(500).json({ success: false, error: 'Relayer not initialized' });
      }
      const { token, amount, to } = req.body || {};
      if (!isAllowedToken(token)) {
        return res.status(400).json({ success: false, error: 'Token not allowed for mint.' });
      }
      if (!amount || !String(amount).trim()) {
        return res.status(400).json({ success: false, error: 'Amount is required.' });
      }
      const recipient = to || Config.contractConfig.treasuryController;
      const txHash = await relayer.mintToken(String(token), String(recipient), String(amount));
      res.json({ success: true, txHash });
    } catch (error: any) {
      await notificationService.notifySystemError(error.message, 'Mint token');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /** Cancel Proposal (pending/approved → failed) */
  router.post('/proposals/:id/cancel', async (req: Request, res: Response) => {
    try {
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }
      if (proposal.status === 'executed') {
        return res.status(400).json({ success: false, error: 'Cannot cancel executed proposal' });
      }
      await storage.updateProposal(req.params.id, { status: 'failed' });
      res.json({ success: true, message: 'Proposal cancelled' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
