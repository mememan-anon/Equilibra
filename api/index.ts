import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initServices, getServices } from './_lib/services';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await initServices();
  const { storage, watcher, oracle, decisionEngine, relayer, notifications, config } = getServices();

  // Parse route: req.url is like "/api/status" or "/api/proposals/123/execute"
  const url = req.url || '';
  const path = url.replace(/\?.*$/, ''); // strip query string
  const segments = path.split('/').filter(Boolean); // ["api", "status"] etc.

  try {
    // ── GET /api/status ──
    if (segments[1] === 'status' && req.method === 'GET') {
      const isWatching = watcher.isConnected();
      return res.json({
        status: 'ok',
        connected: isWatching,
        contracts: {
          treasuryController: config.contractConfig.treasuryController,
          guardian: config.contractConfig.guardian,
          chainId: config.contractConfig.chainId,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ── GET /api/balances ──
    if (segments[1] === 'balances' && req.method === 'GET') {
      const tokens = [config.contractConfig.mockToken, config.contractConfig.mockToken2].filter(Boolean) as string[];
      const balances = await watcher.getAllBalances(tokens);
      const prices = await oracle.getPrices(tokens);
      const enriched = await Promise.all(balances.map(async (b) => {
        const price = prices.get(b.token) ?? 0;
        const treasuryBalance = BigInt(b.balance);
        const strategyBalance = await watcher.getStrategyBalance(b.token, config.contractConfig.exampleStrategy);
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
      return res.json({ balances: enriched });
    }

    // ── GET /api/allocations ──
    if (segments[1] === 'allocations' && req.method === 'GET') {
      const tokens = [config.contractConfig.mockToken, config.contractConfig.mockToken2].filter(Boolean) as string[];
      const balances = await Promise.all(
        tokens.map(async (token) => {
          const treasury = await watcher.getTreasuryBalance(token);
          const strategy = await watcher.getStrategyBalance(token, config.contractConfig.exampleStrategy);
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
      return res.json({ allocations });
    }

    // ── /api/proposals/* ──
    if (segments[1] === 'proposals') {
      const proposalId = segments[2]; // might be undefined
      const action = segments[3]; // "execute" | undefined

      // GET /api/proposals
      if (!proposalId && req.method === 'GET') {
        const proposals = await storage.getProposals();
        return res.json({ proposals });
      }

      // POST /api/proposals (create)
      if (!proposalId && req.method === 'POST') {
        const { token, amount, type, strategy, reason } = req.body || {};
        const allowed = [config.contractConfig.mockToken, config.contractConfig.mockToken2]
          .filter(Boolean)
          .map((t) => String(t).toLowerCase());
        if ((type === 'deposit' || type === 'withdraw') && (!token || !allowed.includes(String(token).toLowerCase()))) {
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
          const strategyBalance = await watcher.getStrategyBalance(String(token), config.contractConfig.exampleStrategy);
          if (amountWei > strategyBalance) {
            return res.status(400).json({
              success: false,
              error: `Withdraw amount exceeds strategy balance. Requested=${amountWei.toString()} Available=${strategyBalance.toString()}`,
            });
          }
        }
        const proposal = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          token: token || config.contractConfig.mockToken,
          amount: amount || '0',
          type: type || 'deposit',
          strategy: strategy || config.contractConfig.exampleStrategy,
          reason: reason || 'Manual proposal',
          status: 'pending' as const,
        };
        await storage.saveProposal(proposal);
        await notifications.notifyProposalCreated(proposal.id, proposal.type, proposal.amount, proposal.reason);
        return res.json({ success: true, proposal });
      }

      // GET /api/proposals/:id
      if (proposalId && !action && req.method === 'GET') {
        const proposal = await storage.getProposal(proposalId);
        if (!proposal) return res.status(404).json({ success: false, error: 'Proposal not found' });
        return res.json({ proposal });
      }

      // POST /api/proposals/:id/execute
      if (proposalId && action === 'execute' && req.method === 'POST') {
        if (!relayer) return res.status(500).json({ success: false, error: 'Relayer not initialized' });
        const proposal = await storage.getProposal(proposalId);
        if (!proposal) return res.status(404).json({ success: false, error: 'Proposal not found' });
        const strategyAddress = proposal.strategy || config.contractConfig.exampleStrategy;
        const txHash = await relayer.executeProposal(proposal, strategyAddress);
        await storage.updateProposal(proposal.id, { status: 'executed', txHash });
        await notifications.notifyProposalExecuted(proposal.id, 'success', txHash);
        return res.json({ success: true, message: 'Proposal executed', txHash });
      }

      // POST /api/proposals/:id/approve
      if (proposalId && action === 'approve' && req.method === 'POST') {
        const proposal = await storage.getProposal(proposalId);
        if (!proposal) return res.status(404).json({ success: false, error: 'Proposal not found' });
        await storage.updateProposal(proposalId, { status: 'approved' });
        return res.json({ success: true, message: 'Proposal approved' });
      }

      // POST /api/proposals/:id/cancel
      if (proposalId && action === 'cancel' && req.method === 'POST') {
        const proposal = await storage.getProposal(proposalId);
        if (!proposal) return res.status(404).json({ success: false, error: 'Proposal not found' });
        if (proposal.status === 'executed') {
          return res.status(400).json({ success: false, error: 'Cannot cancel executed proposal' });
        }
        await storage.updateProposal(proposalId, { status: 'failed' });
        return res.json({ success: true, message: 'Proposal cancelled' });
      }

    }

    // ── POST /api/rebalance ──
    if (segments[1] === 'rebalance' && req.method === 'POST') {
      const tokens = [config.contractConfig.mockToken, config.contractConfig.mockToken2].filter(Boolean) as string[];
      if (tokens.length < 2) {
        return res.status(400).json({ success: false, error: 'Need at least 2 tokens configured for rebalancing.' });
      }

      const existing = await storage.getProposals();
      const active = existing.filter((p) => p.status === 'pending' || p.status === 'approved');
      const hasActiveFor = (proposal: any) =>
        active.some(
          (p) =>
            p.token.toLowerCase() === proposal.token.toLowerCase() &&
            p.type === proposal.type &&
            p.strategy.toLowerCase() === proposal.strategy.toLowerCase(),
        );

      const treasuryBalances = await watcher.getAllBalances(tokens);
      const balances = await Promise.all(
        treasuryBalances.map(async (b) => {
          const strategyBalance = await watcher.getStrategyBalance(b.token, config.contractConfig.exampleStrategy);
          return { ...b, balance: (BigInt(b.balance) + strategyBalance).toString() };
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

      return res.json({ success: true, proposals: proposalsToSave });
    }

    // ── POST /api/mint ──
    if (segments[1] === 'mint' && req.method === 'POST') {
      if (!relayer) return res.status(500).json({ success: false, error: 'Relayer not initialized' });
      const { token, amount, to } = req.body || {};
      const allowed = [config.contractConfig.mockToken, config.contractConfig.mockToken2]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase());
      if (!token || !allowed.includes(String(token).toLowerCase())) {
        return res.status(400).json({ success: false, error: 'Token not allowed for mint.' });
      }
      if (!amount || !String(amount).trim()) {
        return res.status(400).json({ success: false, error: 'Amount is required.' });
      }
      const recipient = to || config.contractConfig.treasuryController;
      const txHash = await relayer.mintToken(String(token), String(recipient), String(amount));
      return res.json({ success: true, txHash });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ success: false, error: error.message });

}

}

