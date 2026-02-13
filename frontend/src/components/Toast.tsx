import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Toast } from '../contexts/ToastContext';

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const iconMap = {
  success: <CheckCircle className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
};

const borderColorMap: Record<string, string> = {
  success: '#00e5a0',
  error: '#ff5c6f',
  info: '#3b9eff',
  warning: '#ffb347',
};

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  return (
    <div
      className="animate-toast-in flex items-center gap-3 rounded-lg border border-[var(--line-strong)] px-4 py-3 shadow-xl"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        background: 'var(--surface-strong)',
        borderLeftWidth: '3px',
        borderLeftColor: borderColorMap[toast.type],
      }}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0" style={{ color: borderColorMap[toast.type] }}>
        {iconMap[toast.type]}
      </div>
      <p className="flex-grow text-[13px] font-medium text-[var(--text)]">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" style={{ maxWidth: '380px' }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};
