# Development Environment Setup

## Requirements

- **Node.js:** v18.x or higher (LTS recommended)
- **npm:** v9.x or higher
- **Git:** v2.x or higher

## Installation

### 1. Clone and Install

```bash
cd aegis-treasury
npm install
```

### 2. Smart Contracts (Hardhat)

The contracts use Hardhat for development and testing.

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat node  # Local blockchain for testing
```

### 3. Backend Agent

The backend is built with Node.js and TypeScript.

```bash
cd backend
npm install
npm run build
npm start
```

Environment variables (create `.env`):

```bash
# RPC URL for BNB Chain
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# Relayer private key (demo key for testing)
RELAYER_PRIVATE_KEY=0x...

# Contract addresses (after deployment)
TREASURY_CONTROLLER_ADDRESS=0x...
GUARDIAN_ADDRESS=0x...
```

### 4. Frontend Dashboard

React app with Vite for fast development.

```bash
cd frontend
npm install
npm run dev
```

## Local Testing

### Using Local Hardhat Network

```bash
# Terminal 1: Start local blockchain
cd contracts && npx hardhat node

# Terminal 2: Deploy contracts
cd contracts && npx hardhat run scripts/deploy.js --network localhost

# Terminal 3: Start backend
cd backend && npm start

# Terminal 4: Start frontend
cd frontend && npm run dev
```

### Using BNB Testnet

```bash
# Deploy to BNB testnet
cd contracts && npx hardhat run scripts/deploy.js --network bnbTestnet

# Update backend .env with deployed contract addresses
```

## Testing

### Smart Contracts

```bash
cd contracts
npx hardhat test
npx hardhat coverage  # If coverage plugin installed
```

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm run test
```

## Linting & Formatting

### Contracts

```bash
cd contracts
npx hardhat check      # Runs compilation check
npm run lint           # If ESLint configured for contracts
```

### Backend

```bash
cd backend
npm run lint
npm run format
```

### Frontend

```bash
cd frontend
npm run lint
npm run format
```

## Recommended IDE Extensions

- **VSCode:**
  - Solidity (Nomic Foundation)
  - TypeScript/JavaScript
  - ESLint
  - Prettier

## Troubleshooting

### Contract Compilation Errors

- Ensure `hardhat.config.js` has correct Solidity version (0.8.19+)
- Clear cache: `rm -rf contracts/cache contracts/artifacts`
- Run `npx hardhat clean` then `npx hardhat compile`

### Backend Connection Issues

- Check RPC URL is reachable
- Verify relayer account has testnet BNB
- Ensure contract addresses in `.env` are correct

### Frontend Build Errors

- Clear node_modules: `rm -rf frontend/node_modules && cd frontend && npm install`
- Check Node.js version matches requirements
