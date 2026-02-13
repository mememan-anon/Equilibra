import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, Filter, Plus, X, Send } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import ProposalCard from '../components/ProposalCard';
import { Proposal } from '../types';

type ProposalFilter = 'all' | 'pending' | 'approved' | 'executed' | 'failed';

const STRATEGY_ADDRESS = '0x3B60eA02752D6C7221F4e7f315066f9969aBC903';
const MOCK_TOKEN = '0xC35D40596389d4FCA0c59849DA01a51e522Ec708';
const MOCK_TOKEN_2 = import.meta.env.VITE_MOCK_TOKEN_2_ADDRESS as string | undefined;

const Proposals: React.FC = () => {
  const { addToast } = useToast();
  const location = useLocation();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProposalFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasFetched = useRef(false);

  // Form state
  const [formType, setFormType] = useState<'deposit' | 'withdraw' | 'harvest'>('deposit');
  const [formToken, setFormToken] = useState(MOCK_TOKEN);
  const [formAmount, setFormAmount] = useState('1000');
  const [formStrategy, setFormStrategy] = useState(STRATEGY_ADDRESS);
  const [formReason, setFormReason] = useState('');
  const [tokenBalances, setTokenBalances] = useState<Record<string, { treasury: number; strategy: number }>>({});

  const fetchProposals = async () => {
    try {
      const response = await axios.get('/api/proposals');
      setProposals(response.data.proposals || []);
      const balancesResp = await axios.get('/api/balances');
      const balances = balancesResp.data?.balances || [];
      const nextBalances: Record<string, { treasury: number; strategy: number }> = {};
      for (const b of balances) {
        const decimals = b.decimals ?? 18;
        const treasury = Number(b.treasuryBalance ?? b.balance ?? '0') / Math.pow(10, decimals);
        const strategy = Number(b.strategyBalance ?? '0') / Math.pow(10, decimals);
        nextBalances[String(b.token).toLowerCase()] = { treasury, strategy };
      }
      setTokenBalances(nextBalances);
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setError('Failed to load proposals from API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchProposals();
  }, []);

  const handleMax = () => {
    const tokenKey = formToken?.toLowerCase();
    if (!tokenKey) return;
    const entry = tokenBalances[tokenKey];
    if (!entry) return;
    const max = formType === 'withdraw' ? entry.strategy : entry.treasury;
    setFormAmount(max.toFixed(6).replace(/\.?0+$/, ''));
  };

  useEffect(() => {
    if (!location.search) return;
    const params = new URLSearchParams(location.search);

    const intent = params.get('intent');
    if (intent === 'deposit' || intent === 'withdraw' || intent === 'harvest') {
      setFormType(intent);
      setShowForm(true);
    }

    const token = params.get('token');
    if (token) setFormToken(token);

    const amount = params.get('amount');
    if (amount && !Number.isNaN(Number(amount))) setFormAmount(amount);

    const strategy = params.get('strategy');
    if (strategy) setFormStrategy(strategy);

    const reason = params.get('reason');
    if (reason) setFormReason(reason);
  }, [location.search]);

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amountNum = Number(formAmount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        addToast('Enter a valid amount greater than 0', 'warning');
        return;
      }

      if (!formToken) {
        addToast('Select a token', 'warning');
        return;
      }

      if (formType === 'deposit' || formType === 'withdraw') {
        const allowed = [MOCK_TOKEN, MOCK_TOKEN_2].filter(Boolean).map((t) => String(t).toLowerCase());
        if (!allowed.includes(formToken.toLowerCase())) {
          addToast('Token not allowed for deposit/withdraw.', 'warning');
          return;
        }
        const tokenKey = formToken.toLowerCase();
        const entry = tokenBalances[tokenKey];
        if (entry) {
          const available = formType === 'withdraw' ? entry.strategy : entry.treasury;
          if (amountNum > available) {
            const label = formType === 'withdraw' ? 'strategy' : 'treasury';
            addToast(`Amount exceeds available ${label} balance (${available.toFixed(6)})`, 'warning');
            return;
          }
        }
      }

      // Convert human-readable amount to wei (18 decimals)
      const amountWei = BigInt(Math.floor(amountNum * 1e18)).toString();
      const response = await axios.post('/api/proposals', {
        type: formType,
        token: formToken,
        amount: amountWei,
        strategy: formStrategy,
        reason: formReason || `${formType} ${formAmount} tokens to strategy`,
      });
      if (response.data.proposal) {
        setProposals((prev) => [response.data.proposal, ...prev]);
      }
      addToast('Proposal created successfully', 'success');
      setShowForm(false);
      setFormReason('');
      setFormAmount('1000');
    } catch (err) {
      console.error('Error creating proposal:', err);
      addToast('Failed to create proposal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await axios.post(`/api/proposals/${id}/approve`);
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'approved' } : p)));
      addToast(`Proposal approved`, 'success');
    } catch (err) {
      console.error('Error approving proposal:', err);
      addToast('Failed to approve proposal', 'error');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      addToast('Executing on-chain transaction...', 'info');
      const response = await axios.post(`/api/proposals/${id}/execute`);
      setProposals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'executed', txHash: response.data.txHash } : p)),
      );
      addToast('Proposal executed on-chain!', 'success');
      if (response.data.txHash) {
        addToast(`TxHash: ${response.data.txHash.slice(0, 18)}...`, 'info', 10000);
      }
    } catch (err: any) {
      console.error('Error executing proposal:', err);
      const msg = err?.response?.data?.error || 'Failed to execute proposal';
      addToast(msg, 'error');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await axios.post(`/api/proposals/${id}/cancel`);
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'failed' } : p)));
      addToast('Proposal cancelled', 'success');
    } catch (err) {
      console.error('Error cancelling proposal:', err);
      addToast('Failed to cancel proposal', 'error');
    }
  };


  const filteredProposals = useMemo(() => {
    if (filter === 'all') return proposals;
    return proposals.filter((p) => p.status === filter);
  }, [filter, proposals]);

  const statusCounts = useMemo(
    () => ({
      all: proposals.length,
      pending: proposals.filter((p) => p.status === 'pending').length,
      approved: proposals.filter((p) => p.status === 'approved').length,
      executed: proposals.filter((p) => p.status === 'executed').length,
      failed: proposals.filter((p) => p.status === 'failed').length,
    }),
    [proposals],
  );

  if (loading) {
    return (
      <div className="section-fade-in flex h-80 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          <span className="text-sm text-[var(--muted)]">Loading proposals...</span>
        </div>
      </div>
    );
  }

  const filters: ProposalFilter[] = ['all', 'pending', 'approved', 'executed', 'failed'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="section-fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="gradient-text text-2xl font-bold tracking-tight sm:text-3xl">Proposals</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Create, review, approve, and execute treasury operations.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Proposal'}
        </button>
      </section>

      {error && (
        <div
          className="rounded-lg border px-4 py-2.5 text-[13px] text-[var(--warning)]"
          style={{ borderColor: 'rgba(255,179,71,0.25)', background: 'rgba(255,179,71,0.06)' }}
        >
          {error}
        </div>
      )}

      {/* Create Proposal Form */}
      {showForm && (
        <form onSubmit={handleCreateProposal} className="glass-card space-y-4 rounded-xl p-5">
          <h2 className="text-[15px] font-semibold">Create New Proposal</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Type */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as 'deposit' | 'withdraw' | 'harvest')}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--text)]"
                style={{ background: 'var(--surface)' }}
              >
                <option value="deposit">Deposit</option>
                <option value="withdraw">Withdraw</option>
                <option value="harvest">Harvest</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Amount (tokens)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--text)]"
                  style={{ background: 'var(--surface)' }}
                  placeholder="1000"
                />
                <button
                  type="button"
                  onClick={handleMax}
                  className="btn-secondary rounded-lg px-3 py-2 text-[12px] font-medium"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Token */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Token Address
              </label>
              <select
                value={formToken}
                onChange={(e) => setFormToken(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--text)]"
                style={{ background: 'var(--surface)' }}
              >
                <option value={MOCK_TOKEN}>TST (MockERC20)</option>
                {MOCK_TOKEN_2 ? <option value={MOCK_TOKEN_2}>TST2 (MockERC20)</option> : null}
              </select>
            </div>

            {/* Strategy */}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Strategy Address
              </label>
              <input
                value={formStrategy}
                onChange={(e) => setFormStrategy(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 font-mono text-[12px] text-[var(--text)]"
                style={{ background: 'var(--surface)' }}
                placeholder="0x..."
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Reason
            </label>
            <input
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--text)]"
              style={{ background: 'var(--surface)' }}
              placeholder="Deposit to strategy for yield farming"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !formAmount || parseFloat(formAmount) <= 0}
            className="btn-primary flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? 'Creating...' : 'Create Proposal'}
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <section className="glass-card flex items-center gap-1 rounded-xl p-1.5">
        {filters.map((f) => {
          const label = f[0].toUpperCase() + f.slice(1);
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3.5 py-[7px] text-[12px] font-medium transition-all ${
                isActive
                  ? 'tab-active'
                  : 'text-[var(--muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.03]'
              }`}
            >
              {label}
              <span className="ml-1.5 text-[11px] opacity-60">({statusCounts[f]})</span>
            </button>
          );
        })}
      </section>

      {/* Proposal list */}
      {filteredProposals.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-xl py-16">
          <Filter className="mb-3 h-8 w-8 text-[var(--muted)]" />
          <p className="text-[14px] text-[var(--muted)]">No proposals match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onApprove={handleApprove}
              onExecute={handleExecute}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Proposals;
