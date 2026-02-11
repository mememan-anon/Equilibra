# Contributing to AegisTreasury

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Workflow

### Code Style

- **Solidity:** Follow the official Solidity style guide
- **TypeScript:** Use Prettier for formatting
- **React:** Follow React best practices and ESLint rules

### Testing

All changes must include appropriate tests:

```bash
# Contracts
cd contracts && npx hardhat test

# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

### Pull Request Requirements

- Clear description of changes
- All tests passing
- No linting errors
- Documentation updated if needed

## Reporting Issues

Please use the issue tracker for:
- Bug reports
- Feature requests
- Documentation improvements

When reporting a bug, include:
- Environment details (OS, Node version)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
