import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import {
  ArrowUpRight,
  Coins,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Wallet,
  CheckCircle2,
  XCircle,
  Network,
  Zap,
  PieChart,
  Plus,
  X,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import BalanceCard from '../components/BalanceCard';
import { Allocation, SystemStatus, TokenBalance } from '../types';

/** Map raw token addresses to human-readable symbols */
const TOKEN_NAMES: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'BNB',
};
const FALLBACK_PRICES: Record<string, number> = {
  BNB: 600,
  TST: 1,
  USDT: 1,
  USDC: 1,
  TOKEN: 1,
};

function resolveTokenName(raw: string): string {
  if (TOKEN_NAMES[raw]) return TOKEN_NAMES[raw];
  if (raw.length <= 6) return raw;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

function normalizePercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value > 100 ? value / 100 : value;
}

const Dashboard: React.FC = () => {
  const { addToast } = useToast();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [status, setStatus] = useState<SystemStatus>();
  const [valueHistory, setValueHistory] = useState<Array<{ time: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebalancing, setRebalancing] = useState(false);
  const [showMint, setShowMint] = useState(false);
  const [mintToken, setMintToken] = useState('');
  const [mintAmount, setMintAmount] = useState('1000');
  const [minting, setMinting] = useState(false);
  const hasFetched = useRef(false);

  const fetchData = useCallback(
    async (isFirstLoad = false) => {
      try {
        const [balancesResponse, allocsResponse, statusResponse] = await Promise.all([
          axios.get('/api/balances'),
          axios.get('/api/allocations'),
          axios.get('/api/status'),
        ]);

        const incomingBalances: TokenBalance[] = balancesResponse.data.balances || [];
        const normalizedBalances = incomingBalances.map((b) => {
          const decimals = b.decimals ?? 18;
          const humanBalance = Number(b.balance || '0') / Math.pow(10, decimals);
          const price =
            b.price ??
            FALLBACK_PRICES[b.symbol || 'TOKEN'] ??
            FALLBACK_PRICES[resolveTokenName(b.token)] ??
            1;
          const value = b.value ?? humanBalance * price;
          return {
            ...b,
            treasuryBalance: b.treasuryBalance ?? b.balance,
            strategyBalance: b.strategyBalance ?? '0',
            price,
            value,
          };
        });
        setBalances(normalizedBalances);
        const total = normalizedBalances.reduce((sum, b) => sum + (b.value || 0), 0);
        const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setValueHistory((prev) => [...prev.slice(-11), { time: nowLabel, value: total }]);

        const rawAllocs: Array<Allocation & { targetAllocation?: number; currentAllocation?: number }> =
          allocsResponse.data.allocations || [];
        setAllocations(
          rawAllocs.map((a) => ({
            ...a,
            token: resolveTokenName(a.token),
            targetPercentage: normalizePercentage(a.targetPercentage ?? a.targetAllocation ?? 0),
            currentPercentage: normalizePercentage(a.currentPercentage ?? a.currentAllocation ?? 0),
          })),
        );

        const statusData = statusResponse.data;
        setStatus({
          relayer: statusData?.contracts?.treasuryController || statusData?.relayer || '',
          provider: statusData?.connected ? 'Connected to RPC' : 'Disconnected',
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        if (isFirstLoad) {
          setError('Backend unavailable — showing demo data.');
          addToast('Using demo data', 'warning');
          loadMockData();
        }
      } finally {
        if (isFirstLoad) setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!mintToken && balances.length > 0) {
      setMintToken(balances[0].token);
    }
  }, [balances, mintToken]);

  const handleRebalance = async () => {
    setRebalancing(true);
    try {
      const response = await axios.post('/api/rebalance');
      const count = response.data?.proposals?.length || 0;
      if (count > 0) {
        addToast(`Rebalance created ${count} proposals`, 'success');
      } else {
        addToast(response.data?.message || 'No rebalancing needed', 'info');
      }
      fetchData(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to trigger rebalance';
      addToast(msg, 'error');
    } finally {
      setRebalancing(false);
    }
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(mintAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      addToast('Enter a valid mint amount', 'warning');
      return;
    }
    if (!mintToken) {
      addToast('Select a token to mint', 'warning');
      return;
    }
    setMinting(true);
    try {
      const amountWei = BigInt(Math.floor(amountNum * 1e18)).toString();
      const response = await axios.post('/api/mint', {
        token: mintToken,
        amount: amountWei,
      });
      if (response.data?.txHash) {
        addToast('Minted tokens to treasury', 'success');
      } else {
        addToast('Mint request submitted', 'success');
      }
      setShowMint(false);
      fetchData(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to mint tokens';
      addToast(msg, 'error');
    } finally {
      setMinting(false);
    }
  };

  const loadMockData = () => {
    const mockBalances: TokenBalance[] = [
      {
        token: '0x0000000000000000000000000000000000000000',
        symbol: 'BNB',
        balance: '1250.5',
        decimals: 18,
        price: 310.5,
        value: 388280.25,
      },
      {
        token: '0x55d398326f99059fF775485246999027B3197955',
        symbol: 'USDT',
        balance: '500000',
        decimals: 18,
        price: 1,
        value: 500000,
      },
      {
        token: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        symbol: 'USDC',
        balance: '250000',
        decimals: 18,
        price: 1,
        value: 250000,
      },
    ];

    const mockAllocations: Allocation[] = [
      { token: 'BNB', targetPercentage: 35, currentPercentage: 34, isRebalanced: true },
      { token: 'USDT', targetPercentage: 45, currentPercentage: 44, isRebalanced: true },
      { token: 'USDC', targetPercentage: 20, currentPercentage: 22, isRebalanced: false },
    ];

    setBalances(mockBalances);
    setAllocations(mockAllocations);
    setStatus({
      relayer: '0x742d35Cc6634C0532925a3b844Bc9e7595f8bDe',
      provider: 'Demo Mode',
      timestamp: Date.now(),
    });
  };

  const totalValue = useMemo(() => balances.reduce((sum, b) => sum + (b.value || 0), 0), [balances]);
  const activeAssets = balances.length;
  const rebalancedCount = allocations.filter((a) => a.isRebalanced).length;
  const isConnected = !!status?.relayer;
  const walletAddr = status?.relayer
    ? `${status.relayer.slice(0, 6)}...${status.relayer.slice(-4)}`
    : 'n/a';

  const chartData = useMemo(() => {
    if (valueHistory.length >= 2) return valueHistory;
    return [{ time: 'Now', value: totalValue }];
  }, [totalValue, valueHistory]);

  const allocationBarData = useMemo(
    () =>
      allocations.map((a) => {
        const target = isFinite(a.targetPercentage) ? a.targetPercentage : 0;
        const current = isFinite(a.currentPercentage) ? a.currentPercentage : 0;
        return {
          token: a.token,
          target,
          current,
          drift: Math.abs(target - current),
        };
      }),
    [allocations],
  );

  if (loading) {
    return (
      <div className="section-fade-in flex h-80 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          <span className="text-sm text-[var(--muted)]">Loading treasury data...</span>
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number) =>
    val >= 1_000_000
      ? `$${(val / 1_000_000).toFixed(2)}M`
      : `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip rounded-lg px-3 py-2 shadow-xl">
        <p className="mb-1 text-[11px] text-[var(--muted)]">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-[13px] font-semibold" style={{ color: entry.color }}>
            {entry.dataKey === 'value' ? formatCurrency(entry.value) : `${entry.value}%`}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ─── Header row ─────────────────────────────────── */}
      <section className="section-fade-in flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="gradient-text text-2xl font-bold tracking-tight sm:text-3xl">
            Treasury Overview
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Monitor allocations, strategy drift, and relayer status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRebalance}
            disabled={rebalancing}
            className="btn-primary rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {rebalancing ? 'Rebalancing...' : 'Rebalance Now'}
          </button>
          <button
            onClick={() => setShowMint(true)}
            className="btn-secondary flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Mint Tokens
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px]">
            <div className={`status-dot ${isConnected ? 'status-dot--live' : 'status-dot--offline'}`} />
            <span className={isConnected ? 'text-[var(--accent)]' : 'text-[var(--danger)]'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </section>

      {showMint && (
        <section className="glass-card section-fade-in rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">Mint Mock Tokens</h2>
              <p className="text-[12px] text-[var(--muted)]">Mint directly to the treasury controller.</p>
            </div>
            <button
              onClick={() => setShowMint(false)}
              className="rounded-md p-1 text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleMint} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Token
              </label>
              <select
                value={mintToken}
                onChange={(e) => setMintToken(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--text)]"
                style={{ background: 'var(--surface)' }}
              >
                {balances.map((b) => (
                  <option key={b.token} value={b.token}>
                    {b.symbol || resolveTokenName(b.token)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Amount
              </label>
              <input
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="1000"
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]"
                style={{ background: 'var(--surface)' }}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={minting}
                className="btn-primary w-full rounded-lg px-4 py-2 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {minting ? 'Minting...' : 'Mint'}
              </button>
            </div>
          </form>
        </section>
      )}

      {error && (
        <div className="section-fade-in rounded-lg border px-4 py-2.5 text-[13px] text-[var(--warning)]" style={{ borderColor: 'rgba(255,179,71,0.25)', background: 'rgba(255,179,71,0.06)' }}>
          {error}
        </div>
      )}

      {/* ─── KPI strip ──────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Total Value Locked',
            value: formatCurrency(totalValue),
            sub: '+2.5% simulated 24h',
            subColor: 'text-[var(--accent)]',
            icon: <TrendingUp className="h-4 w-4" />,
            iconBg: { background: 'rgba(0,229,160,0.1)', color: 'var(--accent)' },
            delay: 'stagger-1',
          },
          {
            label: 'Tracked Assets',
            value: String(activeAssets),
            sub: 'Multi-chain allocation',
            subColor: 'text-[var(--muted)]',
            icon: <Coins className="h-4 w-4" />,
            iconBg: { background: 'rgba(59,158,255,0.1)', color: 'var(--accent-2)' },
            delay: 'stagger-2',
          },
          {
            label: 'Healthy Allocations',
            value: `${rebalancedCount}/${allocations.length}`,
            sub: 'Within drift tolerance',
            subColor: 'text-[var(--muted)]',
            icon: <ShieldCheck className="h-4 w-4" />,
            iconBg: { background: 'rgba(0,229,160,0.1)', color: 'var(--accent)' },
            delay: 'stagger-3',
          },
          {
            label: 'Relayer Uptime',
            value: '99.9%',
            sub: 'Execution target',
            subColor: 'text-[var(--muted)]',
            icon: <Zap className="h-4 w-4" />,
            iconBg: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
            delay: 'stagger-4',
          },
        ].map((kpi) => (
          <article
            key={kpi.label}
            className={`glass-card metric-card section-fade-in ${kpi.delay} rounded-xl p-4`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                {kpi.label}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={kpi.iconBg}>
                {kpi.icon}
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className={`mt-1 text-[11px] ${kpi.subColor}`}>{kpi.sub}</p>
          </article>
        ))}
      </section>

      {/* ─── Relayer bar ────────────────────────────────── */}
      <section className="section-fade-in glass-card flex flex-col gap-3 rounded-xl px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(0,229,160,0.1)' }}>
            <Wallet className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold">Relayer</p>
            <p className="text-[11px] text-[var(--muted)]">{status?.provider || 'Unknown'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12px] text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            {isConnected ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-[var(--danger)]" />
            )}
            {isConnected ? 'Online' : 'Offline'}
          </span>
          <span className="flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5 text-[var(--accent-2)]" />
            {walletAddr}
          </span>
          <span>
            {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : '--'}
          </span>
        </div>
      </section>

      {/* ─── Charts ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <article className="section-fade-in glass-card rounded-xl p-5 xl:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">Portfolio Value</h2>
              <p className="text-[11px] text-[var(--muted)]">24h simulated trend</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{formatCurrency(totalValue)}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5a0" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#00e5a0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(100,160,210,0.06)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#6b8aa5', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b8aa5', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#00e5a0" strokeWidth={2} fill="url(#valueGradient)" dot={false} activeDot={{ r: 4, fill: '#00e5a0', stroke: '#050d14', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="section-fade-in glass-card rounded-xl p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">Allocation Drift</h2>
              <p className="text-[11px] text-[var(--muted)]">Target vs current %</p>
            </div>
            <PieChart className="h-4 w-4 text-[var(--muted)]" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={allocationBarData} barGap={4}>
              <CartesianGrid stroke="rgba(100,160,210,0.06)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="token" tick={{ fill: '#6b8aa5', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b8aa5', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#6b8aa5' }} iconType="circle" iconSize={6} />
              <Bar dataKey="target" name="Target" fill="#3b9eff" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="current" name="Current" fill="#00e5a0" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex flex-wrap gap-2">
            {allocationBarData.map((a) => (
              <span
                key={a.token}
                className="rounded-md px-2 py-1 text-[11px] font-medium"
                style={{
                  background: a.drift <= 2 ? 'rgba(0,229,160,0.1)' : 'rgba(255,179,71,0.1)',
                  color: a.drift <= 2 ? '#00e5a0' : '#ffb347',
                }}
              >
                {a.token} drift: {a.drift.toFixed(1)}%
              </span>
            ))}
          </div>
        </article>
      </section>

      {/* ─── Token balances ─────────────────────────────── */}
      <section className="section-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Token Balances</h2>
          <span className="text-[11px] text-[var(--muted)]">
            {balances.length} asset{balances.length !== 1 ? 's' : ''} tracked
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {balances.map((balance, index) => {
            const resolved = resolveTokenName(balance.token);
            const alloc = allocations.find(
              (a) => a.token === balance.symbol || a.token === balance.token || a.token === resolved,
            );
            return (
              <BalanceCard
                key={`${balance.token}-${index}`}
                balance={balance}
                targetAllocation={alloc?.targetPercentage}
                currentAllocation={alloc?.currentPercentage}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
