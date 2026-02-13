import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { vi, beforeEach } from 'vitest';
import Dashboard from '../pages/Dashboard';
import Proposals from '../pages/Proposals';
import { ToastProvider } from '../contexts/ToastContext';

vi.mock('axios');
const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const renderWithProviders = (component: ReactElement) => {
  return render(
    <MemoryRouter>
      <ToastProvider>{component}</ToastProvider>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  mockedAxios.get = vi.fn((url: string) => {
    if (url === '/api/balances') {
      return Promise.resolve({
        data: {
          balances: [
            {
              token: '0xC35D40596389d4FCA0c59849DA01a51e522Ec708',
              symbol: 'TST',
              balance: '10000000000000000000000',
              decimals: 18,
              value: 10000,
            },
          ],
        },
      });
    }
    if (url === '/api/allocations') {
      return Promise.resolve({
        data: {
          allocations: [
            {
              token: '0xC35D40596389d4FCA0c59849DA01a51e522Ec708',
              targetPercentage: 50,
              currentPercentage: 50,
              isRebalanced: true,
            },
          ],
        },
      });
    }
    if (url === '/api/status') {
      return Promise.resolve({
        data: {
          connected: true,
          contracts: { treasuryController: '0x1234567890123456789012345678901234567890' },
        },
      });
    }
    if (url === '/api/proposals') {
      return Promise.resolve({ data: { proposals: [] } });
    }
    return Promise.resolve({ data: {} });
  });
  mockedAxios.post = vi.fn(() => Promise.resolve({ data: {} }));
});

describe('Dashboard', () => {
  it('renders dashboard heading', async () => {
    renderWithProviders(<Dashboard />);
    const heading = await screen.findByRole('heading', { name: /Treasury Overview/i });
    expect(heading).toBeInTheDocument();
  });

  it('renders loading state', () => {
    renderWithProviders(<Dashboard />);
    const loadingText = screen.getByText(/Loading/i);
    expect(loadingText).toBeInTheDocument();
  });
});


describe('Proposals', () => {
  it('renders proposals heading', async () => {
    renderWithProviders(<Proposals />);
    const heading = await screen.findByRole('heading', { name: /Proposals/i });
    expect(heading).toBeInTheDocument();
  });

  it('renders loading state', () => {
    renderWithProviders(<Proposals />);
    const loadingText = screen.getByText(/Loading/i);
    expect(loadingText).toBeInTheDocument();
  });
});
