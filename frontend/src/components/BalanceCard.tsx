import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TokenBalance } from '../types';

interface BalanceCardProps {
  balance: TokenBalance;
  targetAllocation?: number;
  currentAllocation?: number;
}

const BalanceCard: React.FC<BalanceCardProps> = ({ balance, targetAllocation, currentAllocation }) => {
  const navigate = useNavigate();
  const isNativeToken = balance.token.toLowerCase() === '0x0000000000000000000000000000000000000000';
  const decimals = balance.decimals ?? 18;
  const balanceAmount = parseFloat(balance.balance || '0') / Math.pow(10, decimals);
  const treasuryAmount = parseFloat(balance.treasuryBalance || '0') / Math.pow(10, decimals);
  const strategyAmount = parseFloat(balance.strategyBalance || '0') / Math.pow(10, decimals);
  const displayValue = balance.value || 0;
  const drift =
    targetAllocation !== undefined && currentAllocation !== undefined
      ? Math.abs(targetAllocation - currentAllocation)
      : undefined;
  const driftOk = drift !== undefined && drift <= 2;

  const formatPercent = (value?: number) => {
    if (value === undefined || !Number.isFinite(value)) return '0';
    return value.toFixed(2).replace(/\.?0+$/, '');
  };

  const getPrefillAmount = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '100';
    return Math.max(0.01, Math.min(value, 100)).toFixed(2);
  };

  const goToDeposit = () =>
    navigate(`/proposals?intent=deposit&token=${encodeURIComponent(balance.token)}&amount=${encodeURIComponent(getPrefillAmount(treasuryAmount))}`);

  const goToWithdraw = () =>
    navigate(`/proposals?intent=withdraw&token=${encodeURIComponent(balance.token)}&amount=${encodeURIComponent(getPrefillAmount(strategyAmount))}`);

  return (
    <article className="glass-card glass-card-hover rounded-xl p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[15px] font-bold"
            style={{ background: 'rgba(0,229,160,0.1)', color: 'var(--accent)' }}
          >
            {balance.symbol.slice(0, 2)}
          </div>
          <div>
            <p className="text-[14px] font-semibold">{balance.symbol}</p>
            <p className="font-mono text-[10px] text-[var(--muted)]">
              {balance.token.slice(0, 6)}...{balance.token.slice(-4)}
            </p>
          </div>
        </div>
        {drift !== undefined && (
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: driftOk ? 'rgba(0,229,160,0.1)' : 'rgba(255,179,71,0.1)',
              color: driftOk ? 'var(--accent)' : 'var(--warning)',
            }}
          >
            {driftOk ? 'Balanced' : `${drift.toFixed(1)}% drift`}
          </span>
        )}
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-xl font-bold tracking-tight">
          {balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </p>
        <p className="text-[13px] text-[var(--accent)]">
          ${displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Treasury: {treasuryAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} | Strategy: {strategyAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </p>
      </div>

      {/* Allocation bar */}
      {targetAllocation !== undefined && (
        <div className="mb-4 border-t border-[var(--line)] pt-4">
          <div className="mb-2 flex justify-between text-[11px] text-[var(--muted)]">
            <span>Allocation</span>
            <span>
              <span className="text-[var(--text-secondary)]">{formatPercent(currentAllocation)}%</span>
              <span className="mx-1">/</span>
              <span>{formatPercent(targetAllocation)}% target</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(currentAllocation ?? 0, 100)}%`,
                background: 'linear-gradient(to right, #3b9eff, #00e5a0)',
              }}
            />
          </div>
        </div>
      )}

      {/* Action buttons — navigate to proposals to create deposit/withdraw */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={goToDeposit}
          disabled={isNativeToken}
          className="btn-primary flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
          title={isNativeToken ? 'Use TST token for strategy deposit/withdraw' : 'Create deposit proposal'}
        >
          <ArrowDownLeft className="h-3.5 w-3.5" />
          Deposit
        </button>
        <button
          onClick={goToWithdraw}
          disabled={isNativeToken}
          className="btn-secondary flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
          title={isNativeToken ? 'Use TST token for strategy deposit/withdraw' : 'Create withdraw proposal'}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Withdraw
        </button>
      </div>
    </article>
  );
};

export default BalanceCard;
