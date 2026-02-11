# AegisTreasury Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Dashboard                            │
│                    (React + WalletConnect)                      │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP API
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend Agent                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Watcher    │  │   Oracle     │  │   Decision Engine    │  │
│  │  (balances,  │  │  (Chainlink) │  │   (rule-based)       │  │
│  │   events)    │  │              │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                      │               │
│         └──────────────────┴──────────────────────┘               │
│                            │                                       │
│                    ┌───────▼───────┐                              │
│                    │   Relayer     │                              │
│                    │  (sign &      │                              │
│                    │   submit tx)  │                              │
│                    └───────┬───────┘                              │
└────────────────────────────┼──────────────────────────────────────┘
                             │ RPC
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BNB Chain / Local Fork                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   TreasuryController                      │  │
│  │  - Allocation registry                                    │  │
│  │  - Proposal execution                                      │  │
│  │  - Strategy management                                     │  │
│  └───────────┬──────────────────────────────────┬───────────┘  │
│              │                                  │               │
│              │ owns                             │ owns          │
│              ▼                                  ▼               │
│  ┌─────────────────────┐            ┌─────────────────────┐   │
│  │     Guardian         │            │   StrategyAdapter   │   │
│  │  - Pause mechanism   │            │  - Deposit/Withdraw │   │
│  │  - Timelock         │            │  - Yield strategy   │   │
│  │  - Access control   │            │  - Implementation    │   │
│  └─────────────────────┘            └─────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          ERC20 Tokens (USDT, USDC, BNB, etc)            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Web Dashboard
- **Tech:** React, Vite, Tailwind CSS
- **Features:**
  - Real-time balance display
  - Allocation targets vs actual
  - Proposal list and details
  - Approval/execute actions
  - WalletConnect integration

### Backend Agent
- **Tech:** Node.js, TypeScript, Express
- **Components:**
  - **Watcher:** Polls on-chain balances and events
  - **Oracle:** Fetches token prices (Chainlink or mocked)
  - **Decision Engine:** Rule-based rebalancing logic
  - **Relayer:** Signs and submits transactions
  - **API:** REST endpoints for frontend

### Smart Contracts
- **TreasuryController:** Core contract managing treasury operations
  - Register strategies
  - Execute proposals
  - Manage allocations
- **Guardian:** Security layer
  - Emergency pause
  - Timelock for critical operations
  - Access control
- **StrategyAdapter:** Interface for yield strategies
  - Standardized deposit/withdraw
  - Balance queries
  - Harvest returns

## Data Flow

1. **Monitoring:** Watcher polls TreasuryController for balances and strategy balances
2. **Oracle:** Fetches current token prices
3. **Decision Engine:** Compares actual vs target allocations, generates proposals if threshold breached
4. **Proposal Storage:** Proposal saved to database
5. **Dashboard:** Frontend fetches proposals via API
6. **Approval:** User approves proposal (or multisig)
7. **Execution:** Relayer signs transaction and submits to Guardian
8. **On-chain:** TreasuryController executes proposal, funds move to/from StrategyAdapter
9. **Update:** Watcher detects changes, dashboard updates

## Security Model

- **On-chain validation:** All proposals validated by smart contracts
- **Multi-layer protection:** Guardian + Timelock + Pause
- **Access control:** Only authorized addresses can propose/execute
- **Audit trail:** All transactions on-chain and visible in dashboard

## Deployment Targets

1. **Local Development:** Hardhat node for testing
2. **Testnet:** BNB Chain Testnet (BSC Testnet)
3. **Mainnet (future):** BNB Chain (BSC)

## Integration Points

- **Chainlink:** Price feeds for oracle (testnet or mainnet)
- **WalletConnect:** Wallet integration for multisig
- **The Graph (future):** Indexing for historical data
- **IPFS (future):** Off-chain data storage
