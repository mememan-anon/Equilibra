import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="glass-card flex flex-col items-center rounded-xl px-12 py-16 text-center">
        <p className="gradient-text-accent text-6xl font-extrabold">404</p>
        <p className="mt-3 text-[15px] text-[var(--muted)]">This page doesn't exist.</p>
        <Link
          to="/"
          className="btn-primary mt-6 flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
