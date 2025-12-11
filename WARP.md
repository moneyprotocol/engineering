# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Money Protocol is a decentralized borrowing protocol on the RSK blockchain (a Bitcoin sidechain), forked from Liquity. Users can lock RBTC (RSK Bitcoin) as collateral to borrow BPD (Bitcoin Protocol Dollar), a USD-pegged stablecoin. The protocol features:

- **Collateralized Vaults**: Users open Vaults with RBTC collateral to mint BPD stablecoin
- **Minimum Collateralization**: 110% MCR (Minimum Collateral Ratio) in normal mode, 150% in Recovery Mode
- **Liquidation Mechanism**: Two-step process using Stability Pool first, then redistribution to other Vaults
- **Redemption System**: BPD holders can redeem for RBTC at face value, creating price floor
- **MP Token**: Governance/reward token with staking capabilities to earn protocol fees
- **Stability Pool**: Users deposit BPD to absorb liquidations and earn RBTC + MP rewards

## Project Structure

This is a **pnpm workspace monorepo** with 10 packages:

```
packages/
├── contracts/          # Solidity smart contracts (0.4.23, 0.5.17, 0.6.11, 0.8.20)
├── lib-base/          # Core interfaces and abstractions (TypeScript)
├── lib-ethers/        # Ethers.js-based SDK for protocol interaction
├── lib-react/         # React hooks and components
├── lib-subgraph/      # Apollo Client integration for subgraph queries
├── providers/         # Custom ethers.js providers
├── subgraph/          # The Graph subgraph for querying protocol state
├── dev-frontend/      # React development UI
├── fuzzer/            # Fuzzing tools for testing
└── examples/          # SDK usage examples
```

## Common Commands

### Building and Preparation

```bash
# Install all dependencies and build all packages
pnpm install

# Build all packages
pnpm build

# Prepare all packages (compiles contracts, generates types, runs eslint)
pnpm rebuild

# Build specific package
pnpm --filter @moneyprotocol/dev-frontend build
pnpm --filter @moneyprotocol/contracts run prepare
```

### Testing

```bash
# Run all tests (lib-base, lib-ethers, dev-frontend, contracts)
pnpm test

# Test contracts only
pnpm test-contracts
# Or navigate to packages/contracts and run:
cd packages/contracts && npx hardhat test

# Test specific contract file
cd packages/contracts && npx hardhat test ./test/BorrowerOperationsTest.js

# Run single test by name (use .only in test file, or use grep)
cd packages/contracts && npx hardhat test --grep "test name pattern"

# Test lib-ethers
pnpm --filter @moneyprotocol/lib-ethers test

# Generate coverage report for contracts
pnpm coverage:contracts
```

### Running Development Chain

**OpenEthereum chain (default):**
```bash
# Start chain, deploy contracts, prepare lib-ethers
pnpm start-dev-chain

# Stop chain
pnpm stop-dev-chain
```

**RSK Regtest chain:**
```bash
# Start RSK node, prepare providers, deploy contracts
pnpm start-rsk

# Stop RSK node
pnpm stop-rsk
```

### Frontend Development

```bash
# Start dev-frontend in development mode (requires deployed contracts)
pnpm start-dev-frontend

# Start complete demo (dev chain + frontend)
pnpm start-demo

# Stop demo
pnpm stop-demo

# Build frontend for production
pnpm build:dev-frontend
```

### Deployment

```bash
# Deploy to hardhat network (default)
pnpm deploy

# Deploy to testnet
pnpm deploy:testnet

# Deploy with hardhat directly (from lib-ethers)
cd packages/lib-ethers && pnpm hardhat deploy --network <network>
```

### Linting and Code Quality

```bash
# Contracts are linted during prepare
cd packages/contracts && pnpm prepare

# lib-ethers includes eslint in prepare step
cd packages/lib-ethers && pnpm prepare
```

## Architecture Overview

### Core Smart Contracts

The protocol has **no admin keys or governance** - it's fully automated once deployed.

**Main Protocol Contracts** (`packages/contracts/contracts/`):
- `BorrowerOperations.sol` - User-facing vault operations (open, close, adjust, add/withdraw collateral)
- `VaultManager.sol` - Liquidations, redemptions, vault state management
- `StabilityPool.sol` - BPD deposits, liquidation absorption, reward distribution
- `SortedVaults.sol` - Doubly-linked list of vaults sorted by NICR (Nominal ICR)
- `PriceFeed.sol` - Oracle integration for RBTC:USD price
- `HintHelpers.sol` - Off-chain helpers for efficient vault insertions

**Token Contracts**:
- `BPDToken.sol` - Stablecoin (ERC20 + EIP2612 permit)
- `MPToken.sol` - Protocol token with lockup and vesting logic

**Pool Contracts** (data silos):
- `ActivePool.sol` - RBTC and debt for active vaults
- `DefaultPool.sol` - Pending redistribution from liquidations
- `CollSurplusPool.sol` - Claimable surplus from redemptions/liquidations
- `GasPool.sol` - Holds BPD liquidation reserves (200 BPD per vault)

**MP Token System**:
- `MPStaking.sol` - Stake MP to earn protocol fees (RBTC + BPD)
- `CommunityIssuance.sol` - Time-based MP issuance to Stability Pool depositors
- `LockupContractFactory.sol` + `LockupContract.sol` - Token vesting for team/partners

### Key Protocol Mechanics

**Vault Lifecycle:**
1. **Open**: Deposit RBTC, mint BPD (must maintain >110% collateral ratio)
2. **Adjust**: Add/remove collateral, borrow/repay BPD
3. **Close**: Repay all debt, withdraw all collateral
4. **Liquidate**: If ICR < 110%, anyone can liquidate to earn rewards

**Liquidation Flow:**
- **Offset**: Debt cancelled using Stability Pool BPD, collateral distributed to depositors
- **Redistribution**: If Stability Pool exhausted, debt+collateral redistributed to active vaults
- **Gas Compensation**: Liquidator receives 200 BPD + 0.5% of vault's RBTC

**Recovery Mode** (triggered when TCR < 150%):
- More aggressive liquidation conditions
- Borrowing restricted to improving system TCR
- Designed to incentivize recollateralization

**Redemptions**:
- BPD holders can redeem for RBTC at face value
- Vaults redeemed in ascending order of ICR (lowest first)
- Creates hard price floor for BPD at $1
- Disabled for first 45 days after deployment

**Hints System**:
- Vaults stored in sorted doubly-linked list by NICR
- Operations require `_upperHint` and `_lowerHint` addresses
- Use `HintHelpers.getApproxHint()` to find approximate position
- Then `SortedVaults.findInsertPosition()` for exact neighbors
- Reduces gas cost from O(n) to O(1)

### SDK Architecture (lib-base + lib-ethers + lib-react)

**lib-base** provides:
- Core interfaces: `ReadableMoneyp`, `TransactableMoneyp`, `PopulableMoneyp`
- Data structures: `Vault`, `StabilityDeposit`, `Fees`, `MPStake`
- `Decimal` class for precise arithmetic

**lib-ethers** implements lib-base using ethers.js:
- `BitcoinsMoneyp` - Main SDK class
- `PopulatableBitcoinsMoneyp` - Transaction preparation
- `SendableBitcoinsMoneyp` - Transaction execution
- Deployment utilities in `utils/deploy.ts`
- Auto-generated TypeScript types from contract ABIs

**lib-react** provides:
- `MoneypStoreProvider` React context
- `useMoneypSelector()` hook for state
- Real-time updates via ethers.js event listeners

## Testing Infrastructure

### Test File Organization

Tests are in `packages/contracts/test/`:
- `BorrowerOperationsTest.js` - Vault operations
- `VaultManagerTest.js` - Liquidations and system mechanics
- `StabilityPoolTest.js` - Stability Pool operations
- `RedemptionTest.js` - Redemption logic
- `GasCompensationTest.js` - Gas compensation mechanics
- `launchSequenceTest/` - Deployment and initialization

### Test Helpers

Located in `packages/contracts/utils/`:
- `deploymentHelpers.js` - Contract deployment and setup
  - `deployMoneypCore()` - Deploy all core contracts
  - `deployMPContracts()` - Deploy MP token system
  - `deployTesterContracts()` - Deploy enhanced test versions
- `testHelpers.js` - Common test utilities
  - `openVault()` - Helper to open vaults in tests
  - `TestHelper` class with assertions and calculations
  - `MoneyValues` - Wei conversion helpers

### Test Accounts

Pre-generated accounts in `hardhatAccountsList2k.js` (2000 accounts) for parallel testing without nonce conflicts.

### Tester Contracts

Enhanced versions with extra test functions:
- `BorrowerOperationsTester.sol`
- `VaultManagerTester.sol`
- `StabilityPoolTester.sol`
- `ActivePoolTester.sol`
- `CommunityIssuanceTester.sol`

## Important Development Notes

### Hardhat Configuration

Multiple Solidity versions supported (see `packages/contracts/hardhat.config.js`):
- 0.4.23 (legacy)
- 0.5.17 (legacy)
- 0.6.11 (main contracts)
- 0.8.20 (recent additions)

Gas limit: 10M per transaction, 12.5M per block (for dev network).

### Deployment Addresses

Hardcoded addresses in `packages/lib-ethers/utils/deploy.ts`:
- Bounty address: `0x47a7dD4682B72fE4Ac47A090E92c120C120cA45E`
- LP Rewards address: (same as above)
- Multisig address: `0xBB6a102a81b130660e32681465bd2CD189F3899F`

These should be parameterized for different deployments.

### Decimal Precision

All ratios and prices use 18 decimal places (stored as integers):
- ICR of 1.5 = `1500000000000000000`
- Price of $100 = `100000000000000000000`

### Gas Compensation Constants

- `BPD_GAS_COMPENSATION` = 200 BPD (minted when opening vault)
- `MIN_NET_DEBT` = Minimum vault debt after gas compensation
- `BORROWING_FEE_FLOOR` = 0.5%
- `REDEMPTION_FEE_FLOOR` = 0.5%

### Contract Connections

After deployment, contracts must be connected via `setAddresses()` calls. The deployment helpers handle this automatically:
1. Deploy all contracts
2. Call `setAddresses()` on each contract to wire them together
3. Renounce ownership (system becomes immutable)

### Proxy Pattern for Frontend Testing

`packages/contracts/contracts/Proxy/` contains proxy scripts for testing frontend integrations. Build user proxies with `deployProxyScripts()`.

### Hints for Operations

When calling vault operations (open, adjust, etc.), always provide hints:
```javascript
// Get approximate hint
const approxHint = await hintHelpers.getApproxHint(NICR, numTrials, randomSeed);

// Get exact hints
const [upperHint, lowerHint] = await sortedVaults.findInsertPosition(
  NICR, 
  approxHint, 
  approxHint
);

// Use in vault operation
await borrowerOperations.openVault(
  maxFee,
  BPDAmount,
  upperHint,
  lowerHint,
  { value: collateral }
);
```

### Subgraph Development

The subgraph (packages/subgraph) tracks historical protocol state. Build with:
```bash
pnpm build:subgraph
```

## Additional Resources

- Main README: `/README.md` - Comprehensive protocol documentation
- Public README: `/README.public.md` - Liquity-focused public docs
- Papers: `/papers/` - Mathematical proofs and reward distribution algorithms
- Deployment scripts: `packages/lib-ethers/utils/deploy.ts`
- Contract interfaces: `packages/contracts/contracts/Interfaces/`
