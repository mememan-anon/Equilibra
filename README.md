# Aegis Treasury - OpenClaw Edition

Aegis Treasury is a fully on-chain, AI-first treasury automation system built for the **Good Vibes Only: OpenClaw Edition** hackathon. It monitors allocations, proposes rebalances, and executes real transactions on BNB Chain testnet. If it runs, ships, and executes onchain, it counts.

This project demonstrates the OpenClaw theme: **autonomous agents that observe, decide, and transact onchain** with verifiable proof (tx hashes on BscScan).

## What It Does

- Tracks treasury + strategy balances for multiple tokens.
- Computes allocation drift versus on-chain targets.
- Generates rebalance proposals when drift exceeds thresholds.
- Lets operators approve and execute proposals onchain.
- Provides real tx hashes you can click to verify on BscScan.
- Includes a mint flow for demo tokens to keep the system liquid.

## OpenClaw Alignment

OpenClaw is about autonomous AI apps that can act and transact onchain. Aegis Treasury implements this with:

- **Autonomous decision engine** that turns allocation drift into proposals.
- **Relayer agent** that signs and executes onchain transactions.
- **On-chain proof** through tx hashes and deployed contract addresses.

## AI Build Proof (Screenshots)

The screenshots in the repo root are **AI build logs** (not UI mockups). They document AI-assisted development by the in-project agent **Mr Recoup** and show the system being built with AI tooling:

![AI Build Log 1](Screenshot%202026-02-11%20182603.png)
![AI Build Log 2](Screenshot%202026-02-11%20182845.png)
![AI Build Log 3](Screenshot%202026-02-11%20182900.png)

## Architecture

```
Frontend (React + Vite)
  |  REST
  v
Backend (Express + TS)
  - OnChainWatcher  (reads balances + allocations)
  - PriceOracle     (CoinGecko prices w/ cache)
  - DecisionEngine  (creates rebalance proposals)
  - Relayer         (executes tx onchain)
  - Storage         (proposals.json)
  |  ethers v6
  v
BNB Testnet Contracts
  - TreasuryController
  - Guardian
  - ExampleStrategy
  - MockERC20 (TST, TST2)
```

## Deployed Contracts (BNB Testnet)

From `contracts/deployments/bnbTestnet.json`:

| Contract | Address | Explorer |
|---|---|---|
| TreasuryController | `0x0a376e8E8E3dcda4Adb898f17cF43bC2dc388456` | https://testnet.bscscan.com/address/0x0a376e8E8E3dcda4Adb898f17cF43bC2dc388456 |
| Guardian | `0x1073064f7D11fce512337018cD351578aA39eD77` | https://testnet.bscscan.com/address/0x1073064f7D11fce512337018cD351578aA39eD77 |
| ExampleStrategy | `0x3B60eA02752D6C7221F4e7f315066f9969aBC903` | https://testnet.bscscan.com/address/0x3B60eA02752D6C7221f4e7f315066f9969aBC903 |
| MockERC20 (TST) | `0xC35D40596389d4FCA0c59849DA01a51e522Ec708` | https://testnet.bscscan.com/address/0xC35D40596389d4FCA0c59849DA01a51e522Ec708 |
| MockERC20 (TST2) | `0x6475971541af2E3FCf4d43Aa7310f9c89a223808` | https://testnet.bscscan.com/address/0x6475971541af2E3FCf4d43Aa7310f9c89a223808 |

Deployer / Relayer: `0xde70F44bE59359d07153c3a3bA32bA3C0cDA2854`

## How To Use (Best Path)

### 1) Install

```
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

### 2) Configure Environment

`backend/.env`
```
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
CHAIN_ID=97
TREASURY_CONTROLLER_ADDRESS=0x0a376e8E8E3dcda4Adb898f17cF43bC2dc388456
GUARDIAN_ADDRESS=0x1073064f7D11fce512337018cD351578aA39eD77
EXAMPLE_STRATEGY_ADDRESS=0x3B60eA02752D6C7221f4e7f315066f9969aBC903
MOCK_TOKEN_ADDRESS=0xC35D40596389d4FCA0c59849DA01a51e522Ec708
MOCK_TOKEN_2_ADDRESS=0x6475971541af2E3FCf4d43Aa7310f9c89a223808
RELAYER_PRIVATE_KEY=<your-private-key>
RELAYER_ADDRESS=<your-relayer-address>
API_PORT=3001
DATA_PATH=./data

# Supabase (for Vercel persistence)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_TABLE=proposals
```

`frontend/.env`
```
VITE_MOCK_TOKEN_2_ADDRESS=0x6475971541af2E3FCf4d43Aa7310f9c89a223808
VITE_EXPLORER_TX_BASE=https://testnet.bscscan.com/tx/
```

### Supabase Table Format

Create a `proposals` table with this schema:

```sql
create table if not exists public.proposals (
  id text primary key,
  timestamp bigint not null,
  type text not null,
  token text not null,
  amount text not null,
  strategy text not null,
  reason text,
  status text not null,
  tx_hash text,
  execution_time bigint,
  created_at timestamptz not null default now()
);
```

### 3) Run

```
# In repo root
npm run dev
```

This runs backend + frontend together.

### 4) Mint Demo Tokens (if needed)

Use the Dashboard -Mint Tokens- button to mint TST or TST2 directly into the treasury.

### 5) Create Proposals

- Open **Proposals**
- Choose deposit/withdraw/harvest
- Use -Max- to stay within available balances
- Approve, then Execute
- Click tx hash to verify on BscScan

### 6) Rebalance

Click **Rebalance Now** on the Dashboard. The decision engine will:

- Compare current vs target allocations
- Generate proposals if drift is above threshold
- Skip duplicates if pending/approved proposals already exist

## AI Usage (Hackathon Requirement)

AI tools were used throughout development to accelerate iteration and debugging:

- **Claude** (design + copy iteration + UX cleanups)
- **OpenAI Codex** (code refactors, bug fixes, integration work)

The screenshots above show the working UI built with AI assistance and connected to real testnet contracts.

## Technologies

- Smart Contracts: Solidity 0.8.20, Hardhat, OpenZeppelin
- Backend: Node.js, TypeScript, Express, ethers v6, node-cron
- Frontend: React 18, Vite, Tailwind, Recharts, Lucide
- Price Feed: CoinGecko API
- Network: BNB Testnet (Chain ID 97)
- AI Tools: Claude, OpenAI Codex

## Notes

- The system is live on testnet and produces verifiable tx hashes.
- Deposits/withdrawals are capped at actual balances to prevent failed txs.
- Native BNB is excluded from ERC20 strategy operations by design.

## License

MIT
