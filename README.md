# AegisTreasury

An automated treasury management protocol for DeFi optimization.

## Overview

AegisTreasury is a smart contract system that automates treasury allocation decisions through on-chain controllers, strategy adapters, and a backend agent that monitors market conditions and executes rebalancing proposals.

## Success Criteria

- ✅ TreasuryController smart contract manages allocation registry and execution
- ✅ StrategyAdapter interface enables pluggable yield strategies
- ✅ Guardian/Pauser/Timelock contract provides security controls
- ✅ Backend agent watches on-chain data, runs decision engine, and proposes/executes rebalancing
- ✅ Web dashboard displays balances, allocations, and proposal management
- ✅ End-to-end demo on local fork or BNB testnet

## One-Page Pitch

**Problem:** DeFi protocols hold millions in idle treasury assets that could earn yield but face governance friction, security risks, and lack of automated management tools.

**Solution:** AegisTreasury provides a secure, automated treasury management system with:
- On-chain controller with Guardian/Pauser/Timelock security layers
- Pluggable strategy adapters for any yield protocol
- Rule-based decision engine with configurable thresholds
- Multisig approval flow for high-risk operations
- Real-time dashboard for transparency and control

**Value Prop:** Turn idle treasury into revenue-generating assets while maintaining security and governance oversight.

## Tech Stack

- **Smart Contracts:** Solidity, Hardhat
- **Backend:** Node.js, TypeScript
- **Frontend:** React
- **Network:** BNB Chain (testnet deployment target)

## Quick Start

```bash
# Install dependencies
npm install

# Run contracts
cd contracts && npx hardhat test

# Start backend
cd backend && npm start

# Start frontend
cd frontend && npm start
```

## Project Structure

```
aegis-treasury/
├── contracts/          # Solidity smart contracts
├── backend/            # Node.js/TypeScript agent & API
├── frontend/           # React dashboard
├── tests/              # Integration tests
└── scripts/            # Deployment scripts
```

## License

MIT
