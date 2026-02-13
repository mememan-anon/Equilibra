import React, { useState } from 'react';
import { Play, XCircle, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { Proposal } from '../types';

interface ProposalCardProps {
  proposal: Proposal;
  onApprove?: (id: string) => void;
  onExecute?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const statusStyles: Record<string, React.CSSProperties> = {
  pending: { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' },
  approved: { background: 'rgba(59,158,255,0.1)', borderColor: 'rgba(59,158,255,0.2)', color: '#3b9eff' },
  executed: { background: 'rgba(0,229,160,0.1)', borderColor: 'rgba(0,229,160,0.2)', color: '#00e5a0' },
  failed: { background: 'rgba(255,92,111,0.1)', borderColor: 'rgba(255,92,111,0.2)', color: '#ff5c6f' },
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  approved: <CheckCircle className="h-3.5 w-3.5" />,
  executed: <CheckCircle className="h-3.5 w-3.5" />,
  failed: <XCircle className="h-3.5 w-3.5" />,
};

/** Format raw token amount — detect wei-scale values and format them */
function formatAmount(raw: string): string {
  const normalized = normalizeAmount(raw);
  if (normalized.length > 10) {
    // Likely wei — convert to human-readable (assume 18 decimals)
    const num = parseFloat(normalized) / 1e18;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(4);
  }
  return parseFloat(normalized).toLocaleString();
}

/** Resolve token to symbol */
function resolveToken(raw: string): string {
  if (raw === '0x0000000000000000000000000000000000000000') return 'BNB';
  if (raw.length <= 6) return raw;
  return raw;
}

function normalizeAmount(raw: string): string {
  const value = String(raw).trim();
  if (!value) return '0';

  if (/^\d+$/.test(value)) return value;

  const decimalMatch = value.match(/^(\d+)\.(\d+)$/);
  if (decimalMatch) {
    const [, intPart, fracPart] = decimalMatch;
    if (/^0+$/.test(fracPart)) return intPart;
    return value;
  }

  const sciMatch = value.match(/^(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (sciMatch) {
    const [, intPart, fracPartRaw = '', expRaw] = sciMatch;
    const exponent = Number(expRaw);
    if (!Number.isInteger(exponent)) return value;

    const digits = `${intPart}${fracPartRaw}`;
    const shift = exponent - fracPartRaw.length;

    if (shift >= 0) return `${digits}${'0'.repeat(shift)}`;
    const cut = digits.length + shift;
    if (cut <= 0) return value;
    const integerPart = digits.slice(0, cut);
    const fractionalPart = digits.slice(cut);
    if (!/^0*$/.test(fractionalPart)) return value;
    return integerPart;
  }

  return value;
}

function toDate(value: number): Date {
  // Support both seconds and milliseconds timestamps.
  return value < 1_000_000_000_000 ? new Date(value * 1000) : new Date(value);
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onApprove, onExecute, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const style = statusStyles[proposal.status] || statusStyles.pending;
  const txUrlBase = import.meta.env.VITE_EXPLORER_TX_BASE || 'https://testnet.bscscan.com/tx/';

  const handleApprove = async () => {
    setLoading(true);
    try { await onApprove?.(proposal.id); } finally { setLoading(false); }
  };

  const handleExecute = async () => {
    setLoading(true);
    try { await onExecute?.(proposal.id); } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    setLoading(true);
    try { await onCancel?.(proposal.id); } finally { setLoading(false); }
  };

  const canApprove = proposal.status === 'pending';
  const canExecute = proposal.status === 'approved';
  const canCancel = proposal.status === 'pending' || proposal.status === 'approved';
  const displayToken = resolveToken(proposal.token);
  const displayAmount = formatAmount(proposal.amount);

  return (
    <div className="glass-card glass-card-hover rounded-xl p-5">
      {/* Top row */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-bold">#{proposal.id}</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize"
            style={style}
          >
            {statusIcons[proposal.status] || <AlertCircle className="h-3.5 w-3.5" />}
            {proposal.status}
          </span>
          <span className="rounded-md px-2 py-0.5 text-[11px] font-medium capitalize text-[var(--text-secondary)]" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {proposal.type}
          </span>
        </div>
        <span className="text-[11px] text-[var(--muted)]">
          {toDate(proposal.timestamp).toLocaleDateString()}
        </span>
      </div>

      {/* Details grid */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Amount</p>
          <p className="text-[15px] font-bold">
            {displayAmount} <span className="text-[13px] font-medium text-[var(--text-secondary)]">{displayToken}</span>
          </p>
        </div>
        <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Strategy</p>
          <p className="truncate font-mono text-[12px] text-[var(--text-secondary)]">
            {proposal.strategy.slice(0, 10)}...{proposal.strategy.slice(-6)}
          </p>
        </div>
      </div>

      {/* Reason */}
      {proposal.reason && (
        <div className="mb-4 rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Reason</p>
          <p className="text-[13px] text-[var(--text-secondary)]">{proposal.reason}</p>
        </div>
      )}

      {/* Tx hash */}
      {proposal.txHash && (
        <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,229,160,0.04)' }}>
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-[var(--accent)]" />
          <a
            href={`${txUrlBase}${proposal.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-mono text-[12px] text-[var(--accent)] underline-offset-2 hover:underline"
            title="Open transaction in blockchain explorer"
          >
            {proposal.txHash}
          </a>
        </div>
      )}

      {/* Actions */}
      {(canApprove || canExecute || canCancel) && (
        <div className="flex gap-2">
          {canApprove && onApprove && (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </button>
          )}
          {canExecute && onExecute && (
            <button
              onClick={handleExecute}
              disabled={loading}
              className="btn-secondary flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5" />
              Execute
            </button>
          )}
          {canCancel && onCancel && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="btn-secondary flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Scheduled time */}
      {proposal.executionTime && (
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          Scheduled: {toDate(proposal.executionTime).toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default ProposalCard;
