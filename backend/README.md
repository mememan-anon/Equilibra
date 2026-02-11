# AegisTreasury Backend

Backend agent and API for AegisTreasury.

## Setup

1. Copy example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:
   - `RPC_URL`: Your BSC testnet RPC URL or local Hardhat node
   - `TREASURY_CONTROLLER_ADDRESS`: Deployed TreasuryController address
   - `GUARDIAN_ADDRESS`: Deployed Guardian address
   - `RELAYER_PRIVATE_KEY`: Private key for relayer account (demo key for testing)

3. Install dependencies:
```bash
npm install
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### Proposals
- `GET /api/proposals` - List all proposals
- `GET /api/proposals/:id` - Get proposal details
- `POST /api/proposals` - Create new proposal
- `POST /api/proposals/:id/approve` - Approve a proposal
- `POST /api/proposals/:id/execute` - Execute a proposal on-chain
- `DELETE /api/proposals/:id` - Delete a proposal

### Balances & Allocations
- `GET /api/balances?tokens=0x...` - Get treasury balances
- `GET /api/allocations?tokens=0x...` - Get allocation analysis

### System
- `GET /api/status` - Get system status

## Architecture

### Services

- **OnChainWatcher**: Polls blockchain for balances and events
- **PriceOracle**: Fetches token prices (mocked for demo, Chainlink ready)
- **DecisionEngine**: Rule-based rebalancing logic
- **ProposalStorage**: JSON-based proposal persistence
- **Relayer**: Signs and submits transactions

### Scheduled Tasks

The backend runs allocation checks every `CHECK_INTERVAL` minutes (default: 5).

## Testing

```bash
npm test
```

## Troubleshooting

### RPC Connection Issues
- Verify RPC URL is accessible
- Check that blockchain node is running

### Relayer Issues
- Ensure `RELAYER_PRIVATE_KEY` is set correctly
- Verify relayer account has sufficient BNB for gas
