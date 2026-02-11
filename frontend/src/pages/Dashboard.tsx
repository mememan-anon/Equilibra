import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TokenBalance } from '../types';

const Dashboard: React.FC = () => {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const response = await axios.get('/api/balances?tokens=0x0000000000000000000000000000000000000000'); // Fetch default BNB
        setBalances(response.data.balances);
      } catch (error) {
        console.error('Error fetching balances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <h2>Treasury Balances</h2>
      <ul>
        {balances.map(balance => (
          <li key={balance.token}>{balance.symbol}: {balance.balance} ({balance.value ? `$${balance.value.toFixed(2)}` : 'N/A'})</li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
