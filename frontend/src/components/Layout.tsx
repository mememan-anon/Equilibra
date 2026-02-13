import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, LayoutDashboard, FileText, Shield } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header
        className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--surface-strong)]"
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        role="banner"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]">
              <Wallet className="h-[18px] w-[18px] text-white" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <span className="text-[15px] font-bold tracking-tight text-white">Aegis</span>
              <span className="text-[15px] font-medium tracking-tight text-[var(--muted)] ml-1">Treasury</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1 rounded-xl bg-[var(--surface)] p-1 border border-[var(--line)]" aria-label="Main navigation">
            <Link
              to="/"
              className={`flex items-center gap-2 rounded-lg px-3.5 py-[7px] text-[13px] font-medium transition-all ${
                isActive('/')
                  ? 'tab-active'
                  : 'text-[var(--muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.03]'
              }`}
              aria-current={isActive('/') ? 'page' : undefined}
            >
              <LayoutDashboard className="h-[15px] w-[15px]" aria-hidden="true" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <Link
              to="/proposals"
              className={`flex items-center gap-2 rounded-lg px-3.5 py-[7px] text-[13px] font-medium transition-all ${
                isActive('/proposals')
                  ? 'tab-active'
                  : 'text-[var(--muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.03]'
              }`}
              aria-current={isActive('/proposals') ? 'page' : undefined}
            >
              <FileText className="h-[15px] w-[15px]" aria-hidden="true" />
              <span className="hidden sm:inline">Proposals</span>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-[12px] text-[var(--muted)]">
              <div className="status-dot status-dot--live" />
              <span>Testnet</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8" role="main" aria-label="Main content">
        {children}
      </main>

      <footer className="mt-12 border-t border-[var(--line)] py-6" role="contentinfo">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 text-[12px] text-[var(--muted)] sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Security-first Treasury Automation</span>
          </div>
          <span>2026 Aegis Treasury</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
