# Equilibra Backend

Backend agent + API for Equilibra (OpenClaw Edition).

## What This Backend Does

- Watches on-chain balances and target allocations.
- Computes drift and proposes rebalances.
- Executes proposals onchain via relayer.
- Exposes API for UI, minting, and proposal lifecycle.

## Quick Start

### 1) Install
```
npm install
```

### 2) Configure Environment
Create `backend/.env`:
```
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
CHAIN_ID=97
TREASURY_CONTROLLER_ADDRESS=0x0a376e8E8E3dcda4Adb898f17cF43bC2dc388456
GUARDIAN_ADDRESS=0x1073064f7D11fce512337018cD351578aA39eD77
EXAMPLE_STRATEGY_ADDRESS=0x3B60eA02752D6C7221F4e7f315066f9969aBC903
MOCK_TOKEN_ADDRESS=0xC35D40596389d4FCA0c59849DA01a51e522Ec708
MOCK_TOKEN_2_ADDRESS=0x6475971541af2E3FCf4d43Aa7310f9c89a223808
RELAYER_PRIVATE_KEY=<your-private-key>
RELAYER_ADDRESS=<your-relayer-address>
API_PORT=3001
DATA_PATH=./data

# Supabase (optional - for Vercel persistence)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_TABLE=proposals
```

### 3) Run
```
npm run dev
```

## API Endpoints

### Proposals
- `GET /api/proposals` - list all proposals
- `GET /api/proposals/:id` - get proposal details
- `POST /api/proposals` - create proposal (deposit/withdraw/harvest)
- `POST /api/proposals/:id/approve` - approve a proposal
- `POST /api/proposals/:id/execute` - execute on-chain via relayer
- `POST /api/proposals/:id/cancel` - cancel (marks as failed)

### Rebalance + Mint
- `POST /api/rebalance` - generate rebalance proposals (skips duplicates)
- `POST /api/mint` - mint mock tokens to treasury

### Balances & Allocations
- `GET /api/balances` - treasury + strategy balances
- `GET /api/allocations` - target vs current allocation

### System
- `GET /api/status` - RPC + contract config status

## Notes

- Proposal creation is blocked if the amount exceeds treasury/strategy balance.
- Rebalance skips creating duplicate pending/approved proposals for the same token/type/strategy.
- Native BNB is excluded from ERC20 strategy operations.

## Troubleshooting

- `Relayer not initialized`: set `RELAYER_PRIVATE_KEY`.
- `Deposit amount exceeds treasury balance`: mint tokens or reduce amount.
- `Withdraw amount exceeds strategy balance`: reduce withdraw amount or deposit first.
