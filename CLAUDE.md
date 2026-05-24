# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Money Protocol is a decentralized borrowing protocol on **RSK** (a Bitcoin sidechain), forked from Liquity. Users lock **RBTC** as collateral in **Vaults** to mint **BPD**, a USD-pegged stablecoin. **MP** is the protocol/reward token. The system is fully immutable after deployment — no admin keys or governance.

Terminology mirrors Liquity with renames: Trove→**Vault**, LUSD→**BPD**, LQTY→**MP**, ETH→**RBTC**. When reading upstream Liquity references, translate accordingly.

This is a **pnpm workspace monorepo** (`packages/*`). Note: `package.json` also carries a yarn-style `workspaces` field, but tooling is pnpm — always use `pnpm`.

## Commands

All commands run from the repo root unless noted.

```bash
pnpm install            # install all deps
pnpm rebuild            # prepare (compile contracts, gen types, eslint) then build all
pnpm build              # build all packages

# Tests
pnpm test               # all suites: lib-base, lib-ethers, dev-frontend, contracts
pnpm test-contracts     # contracts only

# Single contract test file / single test by name (hardhat uses mocha)
cd packages/contracts && npx hardhat test ./test/BorrowerOperationsTest.js
cd packages/contracts && npx hardhat test --grep "test name pattern"

pnpm coverage:contracts # solidity coverage report

# Local chains + deploy + wire up lib-ethers
pnpm start-dev-chain    # OpenEthereum (docker), deploy, prepare lib-ethers
pnpm stop-dev-chain
pnpm start-rsk          # RSK regtest node (docker), deploy
pnpm stop-rsk

# Frontend
pnpm start-dev-frontend # needs contracts already deployed
pnpm start-demo         # dev chain + frontend together
pnpm build:dev-frontend

# Deployment (the deploy hardhat task lives in lib-ethers)
pnpm deploy             # --network mainnet (RSK mainnet, chainId 30)
pnpm deploy:testnet     # RSK testnet, chainId 31
```

Per-package work uses `pnpm --filter @moneyprotocol/<pkg> <script>`. The `prepare` script in each package is where compilation, type generation, and linting happen — run it before `build`.

## Package layout

- `packages/contracts` — Solidity sources + hardhat tests (the protocol itself)
- `packages/lib-base` — TS interfaces & data structures, framework-agnostic (`ReadableMoneyp`, `TransactableMoneyp`, `Vault`, `Decimal`, …)
- `packages/lib-ethers` — ethers.js implementation of lib-base (`BitcoinsMoneyp`); also **owns the deploy task** and deployment artifacts
- `packages/lib-react` — `MoneypStoreProvider` + `useMoneypSelector()` hooks
- `packages/lib-subgraph`, `packages/subgraph` — The Graph indexing
- `packages/providers` — custom ethers providers (RSK quirks)
- `packages/dev-frontend` — React UI (CRA via craco)
- `packages/fuzzer`, `packages/examples`

## Contract architecture

Sources in `packages/contracts/contracts/`. The protocol splits **logic contracts** from **data-silo "Pool" contracts**, all wired together post-deploy.

Logic:
- `BorrowerOperations.sol` — user-facing vault ops (open/close/adjust, add/withdraw collateral, borrow/repay)
- `VaultManager.sol` — liquidations, redemptions, vault state
- `StabilityPool.sol` — BPD deposits absorb liquidations; pays out RBTC + MP
- `SortedVaults.sol` — doubly-linked list of vaults ordered by NICR (nominal ICR)
- `PriceFeed.sol` — RBTC:USD oracle integration
- `HintHelpers.sol` — off-chain helpers for cheap sorted-list insertion

Pools (hold value/state, no logic): `ActivePool` (active vaults), `DefaultPool` (pending redistribution), `CollSurplusPool` (claimable surplus), `GasPool` (200 BPD liquidation reserves).

Tokens & MP system: `BPDToken.sol` (ERC20 + EIP2612), `MP/MPToken.sol`, `MP/MPStaking.sol` (stake MP, earn fees), `MP/CommunityIssuance.sol` (time-based MP to SP depositors), `MP/LockupContractFactory.sol` + `MP/LockupContract.sol` (team/partner vesting). Interfaces live in `contracts/Interfaces/`.

### Non-obvious mechanics to keep in mind

- **Hints are mandatory.** Vault operations take `_upperHint`/`_lowerHint` so insertion into `SortedVaults` is O(1). Compute via `HintHelpers.getApproxHint(NICR, numTrials, seed)` then `SortedVaults.findInsertPosition(NICR, approx, approx)`. Tests in `utils/testHelpers.js` (`openVault`) do this for you.
- **Decimals are 18-place integers.** ICR 1.5 = `1500000000000000000`; price $100 = `100e18`. Use lib-base `Decimal` on the TS side.
- **Gas compensation:** opening a vault mints a 200 BPD liquidation reserve into `GasPool`; liquidator gets 200 BPD + 0.5% of the vault's RBTC.
- **Recovery Mode** triggers at TCR < 150% and changes liquidation/borrowing rules (see README for the full condition tables).
- **Redemptions** are disabled for the first 45 days after deployment.

## Contracts: multiple Solidity versions

`hardhat.config.js` compiles **0.4.23, 0.5.17, 0.6.11 (main contracts), 0.8.20 (newer additions)**. When editing or adding a contract, match the pragma of its neighbors. Dev `hardhat` network: 10M tx gas / 12.5M block gas, gasPrice 0.

## Tests

In `packages/contracts/test/` (`BorrowerOperationsTest.js`, `VaultManagerTest.js`, `StabilityPoolTest.js`, `RedemptionTest.js`, `GasCompensationTest.js`, `launchSequenceTest/`).

Helpers in `packages/contracts/utils/`:
- `deploymentHelpers.js` — `deployMoneypCore()`, `deployMPContracts()`, `deployTesterContracts()`
- `testHelpers.js` — `TestHelper`, `MoneyValues`, `openVault()`
- `hardhatAccountsList2k.js` — 2000 pre-funded accounts to avoid nonce conflicts

`*Tester.sol` contracts (e.g. `VaultManagerTester.sol`) expose extra functions for testing.

## Deployment wiring

After deploy, every contract is connected via `setAddresses()` calls (the deployment helpers do this), then ownership is renounced → system becomes immutable. Deploy logic, oracle/WRBTC addresses, and hardcoded bounty/multisig addresses live in `packages/lib-ethers/utils/deploy.ts` and `packages/lib-ethers/hardhat.config.ts`; deployment artifacts are committed under `packages/lib-ethers/deployments/`. Networks defined there: `dev`, `regtest`, `mainnet` (RSK, chainId 30), `testnet` (RSK, chainId 31).

## Reference docs

`README.md` is the authoritative, very long protocol spec (liquidation condition tables, fee math, Stability Pool accounting, launch sequence). `WARP.md` covers the same ground as this file in more depth. `papers/` holds the math proofs.
