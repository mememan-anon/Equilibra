# AegisTreasury Demo Script (3-5 minutes)

## Opening (30 seconds)

"Hi, I'm here to demo AegisTreasury, an automated treasury management protocol for DeFi.

DeFi protocols hold millions in idle treasury assets. The problem: manual management is slow, risky, and misses yield opportunities.

AegisTreasury solves this with automated, secure treasury optimization."

## Architecture Overview (45 seconds)

[Show architecture diagram if available]

"Here's how it works:

1. **TreasuryController** smart contract manages allocation registry and executes proposals
2. **StrategyAdapters** provide pluggable yield strategies for any protocol
3. **Guardian/Pauser/Timelock** layers add security controls
4. **Backend Agent** watches on-chain data, runs a rule-based decision engine, and proposes rebalancing
5. **Web Dashboard** provides real-time transparency and control"

## Demo Walkthrough (2-3 minutes)

**Scene 1: Dashboard Overview**

[Navigate to dashboard]

"Here's the treasury dashboard showing current balances across assets and target allocations.

You can see the actual vs target allocation—this treasury is holding excess BNB that should be deployed to yield strategies."

**Scene 2: Automated Proposal**

[Backend detects imbalance]

"Our backend agent continuously monitors and detected this imbalance. It's created a rebalancing proposal."

[Click on proposal]

"This proposal will move 100 BNB to the StrategyAdapter for staking. All parameters are transparent: source, target, amount, and strategy address."

**Scene 3: Security & Execution**

[Show approval flow]

"Proposals require approval. For this demo, I'm using a simple approval, but the system supports multisig/Gnosis integration.

Once approved, the proposal executes via the Guardian contract. The transaction is on-chain, auditable, and irreversible."

[Execute proposal]

"Done! The funds are now deployed to the yield strategy. The dashboard updates in real-time."

**Scene 4: Strategy Returns**

[Show strategy performance]

"Over time, the StrategyAdapter earns yield. When the decision engine detects optimal conditions, it proposes to harvest returns and redistribute.

This creates a continuous, automated cycle: monitor → rebalance → earn → repeat."

## Closing (30 seconds)

"AegisTreasury makes treasury management:

- **Automated:** No more manual rebalancing
- **Secure:** On-chain controls, multisig approval, pause protections
- **Transparent:** All proposals and transactions visible on-chain and in the dashboard

We're ready for deployment on BNB Chain testnet.

Thanks!"

## Demo Setup Notes

Preparation checklist:
- [ ] Local Hardhat node running
- [ ] Contracts deployed
- [ ] Backend agent running
- [ ] Frontend dashboard running
- [ ] Test account with BNB for transactions
- [ ] Screen recording software ready

Quick commands:
```bash
# Terminal 1: Local blockchain
cd contracts && npx hardhat node

# Terminal 2: Deploy contracts
cd contracts && npx hardhat run scripts/deploy.js --network localhost

# Terminal 3: Backend
cd backend && npm start

# Terminal 4: Frontend
cd frontend && npm run dev
```
