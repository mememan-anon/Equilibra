import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Proposal } from '../types';

const Proposals: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        const response = await axios.get('/api/proposals');
        setProposals(response.data.proposals);
      } catch (error) {
        console.error('Error fetching proposals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Proposals</h1>
      <ul>
        {proposals.map(proposal => (
          <li key={proposal.id}>ID: {proposal.id}, Type: {proposal.type}, Amount: {proposal.amount} {proposal.token} - Status: {proposal.status}</li>
        ))}
      </ul>
    </div>
  );
};

export default Proposals;
