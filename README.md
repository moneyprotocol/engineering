# Money Protocol System Summary

![Tests](https://github.com/Money Protocol/dev/workflows/CI/badge.svg) [![Frontend status](https://img.shields.io/uptimerobot/status/m785036778-7edf816c69dafd2d19c45491?label=Frontend&logo=nginx&logoColor=white)](https://devui.Money Protocol.org/internal) ![uptime](https://img.shields.io/uptimerobot/ratio/7/m785036778-7edf816c69dafd2d19c45491) [![Discord](https://img.shields.io/discord/700620821198143498?label=join%20chat&logo=discord&logoColor=white)](https://discord.gg/2up5U32) [![Docker Pulls](https://img.shields.io/docker/pulls/Money Protocol/dev-frontend?label=dev-frontend%20pulls&logo=docker&logoColor=white)](https://hub.docker.com/r/Money Protocol/dev-frontend)

- [Disclaimer](#disclaimer)
- [Money Protocol Overview](#money-protocol-overview)
  - [Liquidation and the Stability Pool](#liquidation-and-the-stability-pool)
    - [Liquidation Logic](#liquidation-logic)
      - [Liquidations in Normal Mode: TCR >= 150%](#liquidations-in-normal-mode-tcr--150)
      - [Liquidations in Recovery Mode: TCR < 150%](#liquidations-in-recovery-mode-tcr--150)
  - [Liquidation Gains](#liquidation-gains)
  - [BPD Token Redemption](#bpd-token-redemption)
    - [Partial redemption](#partial-redemption)
    - [Full redemption](#full-redemption)
    - [Redemptions create a price floor](#redemptions-create-a-price-floor)
  - [Recovery Mode](#recovery-mode)
  - [Project Structure](#project-structure)
    - [Directories](#directories)
    - [Branches](#branches)
  - [MP Token Architecture](#mp-token-architecture)
    - [MP Lockup contracts and token vesting](#mp-lockup-contracts-and-token-vesting)
    - [Lockup Implementation and admin transfer restriction](#lockup-implementation-and-admin-transfer-restriction)
    - [Launch sequence and vesting process](#launch-sequence-and-vesting-process)
      - [Deploy MP Contracts](#deploy-mp-contracts)
      - [Deploy and fund Lockup Contracts](#deploy-and-fund-lockup-contracts)
      - [Deploy Money Protocol Core](#deploy-money-protocol-core)
      - [During one year lockup period](#during-one-year-lockup-period)
      - [Upon end of one year lockup period](#upon-end-of-one-year-lockup-period)
      - [Post-lockup period](#post-lockup-period)
  - [Core System Architecture](#core-system-architecture)
    - [Core Smart Contracts](#core-smart-contracts)
    - [Data and Value Silo Contracts](#data-and-value-silo-contracts)
    - [Contract Interfaces](#contract-interfaces)
    - [PriceFeed and Oracle](#pricefeed-and-oracle)
    - [PriceFeed Logic](#pricefeed-logic)
    - [Testnet PriceFeed and PriceFeed tests](#testnet-pricefeed-and-pricefeed-tests)
    - [PriceFeed limitations and known issues](#pricefeed-limitations-and-known-issues)
    - [Keeping a sorted list of Vaults ordered by ICR](#keeping-a-sorted-list-of-vaults-ordered-by-icr)
    - [Flow of Bitcoin in Money Protocol](#flow-of-bitcoin-in-money-protocol)
    - [Flow of BPD tokens in Money Protocol](#flow-of-bpd-tokens-in-money-protocol)
    - [Flow of MP Tokens in Money Protocol](#flow-of-mp-tokens-in-money-protocol)
  - [Expected User Behaviors](#expected-user-behaviors)
  - [Contract Ownership and Function Permissions](#contract-ownership-and-function-permissions)
  - [Deployment to a Development Blockchain](#deployment-to-a-development-blockchain)
  - [Running Tests](#running-tests)
  - [System Quantities - Units and Representation](#system-quantities---units-and-representation)
    - [Integer representations of decimals](#integer-representations-of-decimals)
  - [Public Data](#public-data)
  - [Public User-Facing Functions](#public-user-facing-functions)
    - [Borrower (Vault) Operations - `BorrowerOperations.sol`](#borrower-vault-operations---borroweroperationssol)
    - [VaultManager Functions - `VaultManager.sol`](#vaultmanager-functions---vaultmanagersol)
    - [Hint Helper Functions - `HintHelpers.sol`](#hint-helper-functions---hinthelperssol)
    - [Stability Pool Functions - `StabilityPool.sol`](#stability-pool-functions---stabilitypoolsol)
    - [MP Staking Functions  `MPStaking.sol`](#mp-staking-functions--mpstakingsol)
    - [Lockup Contract Factory `LockupContractFactory.sol`](#lockup-contract-factory-lockupcontractfactorysol)
    - [Lockup contract - `LockupContract.sol`](#lockup-contract---lockupcontractsol)
    - [BPD token `BPDToken.sol` and MP token `MPToken.sol`](#bpd-token-bpdtokensol-and-mp-token-mptokensol)
  - [Supplying Hints to Vault operations](#supplying-hints-to-vault-operations)
    - [Hints for `redeemCollateral`](#hints-for-redeemcollateral)
      - [First redemption hint](#first-redemption-hint)
      - [Partial redemption hints](#partial-redemption-hints)
  - [Gas compensation](#gas-compensation)
    - [Gas compensation schedule](#gas-compensation-schedule)
    - [Liquidation](#liquidation)
    - [Gas compensation and redemptions](#gas-compensation-and-redemptions)
    - [Gas compensation helper functions](#gas-compensation-helper-functions)
  - [The Stability Pool](#the-stability-pool)
    - [Mixed liquidations: offset and redistribution](#mixed-liquidations-offset-and-redistribution)
    - [Stability Pool deposit losses and RBTC gains - implementation](#stability-pool-deposit-losses-and-rbtc-gains---implementation)
    - [Stability Pool example](#stability-pool-example)
    - [Stability Pool implementation](#stability-pool-implementation)
    - [How deposits and RBTC gains are tracked](#how-deposits-and-rbtc-gains-are-tracked)
  - [MP Issuance to Stability Providers](#mp-issuance-to-stability-providers)
    - [MP Issuance schedule](#mp-issuance-schedule)
    - [MP Issuance implementation](#mp-issuance-implementation)
    - [Handling the front end MP gain](#handling-the-front-end-mp-gain)
    - [MP reward events and payouts](#mp-reward-events-and-payouts)
  - [MP issuance to Money Protocol providers](#mp-issuance-to-money-protocol-providers)
  - [Money Protocol System Fees](#money-protocol-system-fees)
    - [Redemption Fee](#redemption-fee)
    - [Issuance fee](#issuance-fee)
    - [Fee Schedule](#fee-schedule)
    - [Intuition behind fees](#intuition-behind-fees)
    - [Fee decay Implementation](#fee-decay-implementation)
    - [Staking MP and earning fees](#staking-mp-and-earning-fees)
  - [Redistributions and Corrected Stakes](#redistributions-and-corrected-stakes)
    - [Corrected Stake Solution](#corrected-stake-solution)
  - [Math Proofs](#math-proofs)
  - [Definitions](#definitions)
  - [Development](#development)
    - [Prerequisites](#prerequisites)
      - [Making node-gyp work](#making-node-gyp-work)
    - [Clone & Install](#clone--install)
    - [Top-level scripts](#top-level-scripts)
      - [Run all tests](#run-all-tests)
      - [Deploy contracts to a testnet](#deploy-contracts-to-a-testnet)
      - [Start a local blockchain and deploy the contracts](#start-a-local-blockchain-and-deploy-the-contracts)
      - [Start dev-frontend in development mode](#start-dev-frontend-in-development-mode)
      - [Start dev-frontend in demo mode](#start-dev-frontend-in-demo-mode)
      - [Build dev-frontend for production](#build-dev-frontend-for-production)


## Money Protocol Overview

Money Protocol operates as a platform for collateralized debt. Users have the ability to lock up RBTC and generate stablecoin tokens known as BPD, which are then transferred to any desired RSK address. These individual collateralized debt positions are referred to as Vaults.

To ensure stability, the Bitcoin Protocol Dollar or BPD tokens are designed to maintain a value of 1 BPD equal to $1 USD. This is achieved through the following mechanisms:

1. The system always maintains an over-collateralized state, with the locked Bitcoin's dollar value exceeding that of the issued stablecoins.

2. Users have the option to fully redeem their stablecoins by directly exchanging $x worth of BPD for $x worth of RBTC, taking into account applicable fees.

3. The generation of BPD is controlled algorithmically, utilizing a variable issuance fee.

Once a user opens a Vault by depositing Bitcoin, they can issue tokens (referred to as "borrowing") while ensuring that their Vault's collateralization ratio remains above 110%. For example, if a user has $1000 worth of RBTC in their Vault, they can issue up to 909.09 BPD.

The BPD tokens are freely transferable, allowing anyone with a RSK address to send or receive them, regardless of whether they possess an open Vault. When a Vault's debt is repaid, the corresponding BPD tokens are burned.

The Money Protocol system regularly updates the RBTC:USD price using a decentralized data feed. If a Vault's collateralization ratio falls below the minimum requirement of 110% (referred to as the MCR), it is considered under-collateralized and becomes susceptible to liquidation.

## Liquidation and the Stability Pool

Money Protocol employs a two-step liquidation mechanism, prioritizing the following actions:

1. Offsetting the under-collateralized Vaults by utilizing the Stability Pool, which contains BPD tokens.

2. If the Stability Pool is depleted, redistributing the under-collateralized Vaults to other borrowers.

The primary purpose of the BPD tokens in the Stability Pool is to absorb the debt resulting from under-collateralized positions and repay the liabilities of the liquidated borrowers.

Any user has the option to deposit BPD tokens into the Stability Pool, enabling them to earn the collateral from liquidated Vaults. During a liquidation event, the corresponding debt is cancelled using an equal amount of BPD tokens from the Pool, resulting in their burning. Simultaneously, the liquidated Bitcoin is distributed proportionally among the depositors.

Depositors in the Stability Pool can anticipate earning net gains from liquidations since, in most cases, the value of the liquidated Bitcoin exceeds the value of the cancelled debt. This is due to the fact that a liquidated Vault typically has a collateralization ratio slightly below 110%.

In cases where the liquidated debt surpasses the amount of BPD tokens in the Stability Pool, the system aims to cancel as much debt as possible using the tokens in the Stability Pool. Any remaining liquidated collateral and debt are then redistributed among all active Vaults.

Any individual has the ability to call the public function `liquidateVaults()`, which checks for under-collateralized Vaults and initiates their liquidation. Alternatively, they can utilize the `batchLiquidateVaults()` function, providing a custom list of Vault addresses for attempted liquidation.

### Liquidation Logic

The specific outcome of liquidations is contingent upon various factors, including the Individual Collateralization Ratio (ICR) of the Vault being liquidated and the overall conditions of the system, such as the Total Collateralization Ratio (TCR) and the size of the Stability Pool.

The following outlines the liquidation process for an individual Vault in both Normal Mode and Recovery Mode. In the provided explanation, `SP.BPD` denotes the amount of BPD tokens present in the Stability Pool.

#### Liquidations in Normal Mode: TCR >= 150%

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Condition                      | Liquidation behavior                                                                                                                                                                                                                                                                                                |
|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ICR < MCR & SP.BPD >= vault.debt | The debt of the Vault, which matches the BPD amount present in the Stability Pool, is used to offset that same debt. The RBTC collateral of the Vault is distributed among the depositors.                                                                                                                                                                       |
| ICR < MCR & SP.BPD < vault.debt | An equivalent amount of debt from the Vault offsets the total BPD in the Stability Pool. A proportion of the Vault's collateral, corresponding to the ratio of its offset debt to its total debt, is then distributed among the depositors. The remaining debt and collateral (after subtracting RBTC gas compensation) are reallocated to active Vaults. |
| ICR < MCR & SP.BPD = 0          | Reallocate the entire debt and collateral (excluding RBTC gas compensation) among active Vaults.                                                                                                                                                                                                                                 |
| ICR  >= MCR                      | Do nothing.                                                                                                                                                                                                                                                                                                         |
#### Liquidations in Recovery Mode: TCR < 150%

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Condition                                | Liquidation behavior                                                                                                                                                                                                                                                                                                                                                                                         |
|------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ICR <=100%                               | Reallocate the entire debt and collateral (excluding RBTC gas compensation) among active Vaults.                                                                                                                                                                                                                                                                                                                          |
| 100% < ICR < MCR & SP.BPD > vault.debt  | The BPD amount in the Stability Pool, which matches the Vault's debt, is used to offset that same debt. The Vault's RBTC collateral (after deducting RBTC gas compensation) is distributed among the depositors.                                                                                                                                                                                                                                    |
| 100% < ICR < MCR & SP.BPD < vault.debt  | The entire BPD balance in the Stability Pool is offset by an equivalent amount of debt from the Vault. A portion of the Vault's collateral (proportional to the ratio of its offset debt to its total debt) is distributed among depositors. The remaining debt and collateral (with RBTC gas compensation subtracted) are redistributed to active vaults.                                                                                          |
| MCR <= ICR < TCR & SP.BPD >= vault.debt  |  An equal amount of debt from the Vault offsets the BPD in the Pool. A portion of the RBTC collateral, with a dollar value equal to `1.1 * debt`, is distributed among depositors. No redistribution occurs to other active Vaults. As the Vault's ICR was greater than 1.1, it retains a collateral remainder, which is transferred to the `CollSurplusPool` and can be claimed by the borrower. Subsequently, the Vault is closed. |
| MCR <= ICR < TCR & SP.BPD  < vault.debt | Do nothing.                                                                                                                                                                                                                                                                                                                                                                                                  |
| ICR >= TCR                               | Do nothing.                                                                                                                                                                                                                                                                                                                                                                                                  |

## Liquidation Gains 

Over time, depositors in the Stability Pool experience Bitcoin gains, as the liquidated debt is canceled using their deposits. Whenever they choose to withdraw some or all of their deposited tokens or increase their deposit, the system sends them the RBTC gains they have accumulated.

Likewise, any gains accumulated by a Vault through liquidations are automatically incorporated into the Vault whenever its owner performs any operation, such as adding or withdrawing collateral or issuing or repaying BPD.

## BPD Token Redemption

Any individual holding BPD, regardless of whether they have an active Vault, has the option to directly redeem their BPD with the system. During redemption, their BPD is exchanged for RBTC at its face value: redeeming x BPD tokens yields $x worth of RBTC (minus a redemption fee).

Upon BPD redemption for RBTC, the system cancels the corresponding BPD with debt from Vaults, and the RBTC is sourced from their collateral.

To fulfill a redemption request, Vaults are redeemed in ascending order of their collateralization ratio.

A redemption sequence with `n` steps will fully redeem from up to `n-1` Vaults, and partially redeem from the last Vault in the sequence.

Redemptions are not permitted when the total collateralization ratio (TCR) falls below 110% (there is no need to impose a restriction on individual collateralization ratio (ICR) being less than TCR). At such a low TCR, redemptions could likely be unprofitable, as the value of BPD may be trading above $1 if the system experiences a severe crash. However, it could potentially be an avenue for an attacker with a significant amount of BPD to further decrease the TCR.

It's important to note that redemptions are disabled during the first 45 days following the deployment of the Money Protocol to safeguard the monetary system during its initial stages.

### Partial redemption

The majority of redemption transactions result in partial redemptions because the redeemed amount is unlikely to precisely match the total debt of a series of Vaults.

Following a partial redemption, the corresponding Vault is reintroduced into the sorted list of Vaults, retaining its active status but with reduced collateral and debt.

### Full redemption

A Vault is considered "fully redeemed from" when the redemption process absorbs (debt-200) BPD, equivalent to (debt-200) of its total debt. Subsequently, its 200 BPD Liquidation Reserve is canceled by utilizing the remaining 200 debt. The Liquidation Reserve is burned from the gas address, and the 200 debt is reset to zero.

Before closing the Vault, we need to address the collateral surplus, which refers to the excess RBTC collateral remaining after redemption due to the Vault's initial over-collateralization.

This surplus collateral is transferred to the `CollSurplusPool`, and the borrower can reclaim it at a later time. After this step, the Vault is fully closed.

### Redemptions create a price floor

In economic terms, the redemption mechanism establishes a firm price floor for BPD, guaranteeing that the market price remains at or close to $1 USD. 

## Recovery Mode

When the total collateralization ratio (TCR) of the system drops below 150%, Recovery Mode is activated.

During Recovery Mode, liquidation conditions are eased, and borrower transactions that would further decrease the TCR are blocked. New BPD issuance is restricted to adjusting existing Vaults to improve their individual collateralization ratio (ICR) or opening new Vaults with an ICR of >=150%. In cases where adjusting an existing Vault would reduce its ICR, the transaction is only executed if the resulting TCR remains above 150%.

Recovery Mode is strategically designed to incentivize borrowers to take actions that swiftly elevate the TCR back above 150%, and to motivate BPD holders to replenish the Stability Pool.

Economically, Recovery Mode aims to promote collateral top-ups and debt repayments while serving as a self-negating deterrent. The mere possibility of its occurrence guides the system away from ever reaching such a state.

## MP Token Architecture

Within the Money Protocol system, there exists a secondary token known as MP. Holding this token grants the holder a portion of the system revenue generated through redemption fees and issuance fees.

To receive a share of the system fees, MP holders are required to stake their MP in a designated staking contract.

Additionally, Money Protocol distributes MP to Stability Providers continuously over time.

The MP contracts consist of:

`MPStaking.sol` - The staking contract is equipped with functionalities for MP holders to stake and unstake their tokens. This contract collects RBTC fees from redemptions and BPD fees from new debt issuance.

`CommunityIssuance.sol` - Controlled by the `StabilityPool`, this contract manages the issuance of MP tokens to Stability Providers based on a time-dependent function. At the system's launch, the `CommunityIssuance` is automatically allocated 167 million MP tokens, constituting the "community issuance" supply. These MP tokens are gradually issued to Stability Providers over the course of time.

`MPToken.sol` - This represents the MP ERC20 contract, featuring a capped supply of 500 million tokens. During the initial year, transfers from the Money Protocol admin address, a standard RSK address, are restricted. **It is important to note that the Money Protocol admin address holds no additional privileges and relinquishes control over the Money Protocol system upon deployment.**

### MP Lockup contracts and token vesting

A portion of MP tokens is reserved for team members and partners, subject to a one-year lockup period following the system launch. Additionally, certain team members receive MP tokens that vest on a monthly basis, and during the first year, these tokens are directly transferred to their lockup contracts.

In the initial year after launch:

1. All team members and partners are restricted from accessing their locked-up MP tokens.

2. The Money Protocol admin address is only permitted to transfer tokens to **verified lockup contracts that have an unlock date at least one year after the system's deployment.**

Furthermore, separate MP allocations are made upon deployment to an externally owned account (EOA) designated for bug bounties, hackathons, and Intrinsic liquidity provider rewards. Apart from these allocations, the only MP tokens available for use during the first year are those publicly issued to Stability Providers via the `CommunityIssuance` contract.

### Lockup Implementation and admin transfer restriction

In the initial year, a `LockupContractFactory` is utilized to deploy `LockupContracts`. Throughout this period, the `MPToken` verifies that any transfer from the Money Protocol admin address is directed only to a legitimate `LockupContract` that is registered within and was deployed via the `LockupContractFactory`.

### Launch sequence and vesting process

#### Deploy MP Contracts
1. Money Protocol admin deploys `LockupContractFactory`
2. Money Protocol admin deploys `CommunityIssuance`
3. Money Protocol admin deploys `MPStaking` 
4. Money Protocol admin creates a Pool in Uniswap for BPD/RBTC and deploys `RskSwapPool` (LP rewards contract), which knows the address of the Pool
5. Money Protocol admin deploys `MPToken`, which upon deployment:
- Stores the `CommunityIssuance` and `LockupContractFactory` addresses
- Mints MP tokens to `CommunityIssuance`, the Money Protocol admin address, the `RskSwapPool` LP rewards address, and the bug bounty address
6. Money Protocol admin sets `MPToken` address in `LockupContractFactory`, `CommunityIssuance`, `MPStaking`, and `RskSwapPool`

#### Deploy and fund Lockup Contracts
7. Money Protocol admin tells `LockupContractFactory` to deploy a `LockupContract` for each beneficiary, with an `unlockTime` set to exactly one year after system deployment
8. Money Protocol admin transfers MP to each `LockupContract`, according to their entitlement

#### Deploy Money Protocol Core
9. Money Protocol admin deploys the Money Protocol core system
10. Money Protocol admin connects Money Protocol core system internally (with setters)
11. Money Protocol admin connects `MPStaking` to Money Protocol core contracts and `MPToken`
13. Money Protocol admin connects `CommunityIssuance` to Money Protocol core contracts and `MPToken`

#### During one year lockup period
- Money Protocol admin periodically transfers newly vested tokens to team & partners’ `LockupContracts`, as per their vesting schedules
- Money Protocol admin may only transfer MP to `LockupContracts`
- Anyone may deploy new `LockupContracts` via the Factory, setting any `unlockTime` that is >= 1 year from system deployment

#### Upon end of one year lockup period
- All beneficiaries may withdraw their entire entitlements
- Money Protocol admin address restriction on MP transfers is automatically lifted, and Money Protocol admin may now transfer MP to any address
- Anyone may deploy new `LockupContracts` via the Factory, setting any `unlockTime` in the future

#### Post-lockup period
- Money Protocol admin periodically transfers newly vested tokens to team & partners, directly to their individual addresses, or to a fresh lockup contract if required.

_NOTE: In the final architecture, a multi-sig contract will be used to move MP Tokens, rather than the single Money Protocol admin EOA. It will be deployed at the start of the sequence, and have its address recorded in  `MPToken` in step 4, and receive MP tokens. It will be used to move MP in step 7, and during & after the lockup period. The Money Protocol admin EOA will only be used for deployment of contracts in steps 1-4 and 9._

_The current code does not utilize a multi-sig. It implements the launch architecture outlined above._

_Additionally, a LP staking contract will receive the initial LP staking reward allowance, rather than an EOA. It will be used to hold and issue MP to users who stake LP tokens that correspond to certain pools on DEXs._

## Core System Architecture

The core Money Protocol system consists of several smart contracts, which are deployable to the Bitcoineum blockchain.

All application logic and data is contained in these contracts - there is no need for a separate database or back end logic running on a web server. In effect, the Bitcoineum network is itself the Money Protocol back end. As such, all balances and contract data are public.

The system has no admin key or human governance. Once deployed, it is fully automated, decentralized and no user holds any special privileges in or control over the system.

The three main contracts - `BorrowerOperations.sol`, `VaultManager.sol` and `StabilityPool.sol` - hold the user-facing public functions, and contain most of the internal system logic. TogBitcoin they control Vault state updates and movements of Bitcoin and BPD tokens around the system.

### Core Smart Contracts

`BorrowerOperations.sol` - contains the basic operations by which borrowers interact with their Vault: Vault creation, RBTC top-up / withdrawal, stablecoin issuance and repayment. It also sends issuance fees to the `MPStaking` contract. BorrowerOperations functions call in to VaultManager, telling it to update Vault state, where necessary. BorrowerOperations functions also call in to the various Pools, telling them to move Bitcoin/Tokens between Pools or between Pool <> user, where necessary.

`VaultManager.sol` - contains functionality for liquidations and redemptions. It sends redemption fees to the `MPStaking` contract. Also contains the state of each Vault - i.e. a record of the Vault’s collateral and debt. VaultManager does not hold value (i.e. Bitcoin / other tokens). VaultManager functions call in to the various Pools to tell them to move Bitcoin/tokens between Pools, where necessary.

`Money ProtocolBase.sol` - Both VaultManager and BorrowerOperations inherit from the parent contract Money ProtocolBase, which contains global constants and some common functions.

`StabilityPool.sol` - contains functionality for Stability Pool operations: making deposits, and withdrawing compounded deposits and accumulated RBTC and MP gains. Holds the BPD Stability Pool deposits, and the RBTC gains for depositors, from liquidations.

`BPDToken.sol` - the stablecoin token contract, which implements the ERC20 fungible token standard in conjunction with EIP-2612 and a mechanism that blocks (accidental) transfers to addresses like the StabilityPool and address(0) that are not supposed to receive funds through direct transfers. The contract mints, burns and transfers BPD tokens.

`SortedVaults.sol` - a doubly linked list that stores addresses of Vault owners, sorted by their individual collateralization ratio (ICR). It inserts and re-inserts Vaults at the correct position, based on their ICR.

`PriceFeed.sol` - Contains functionality for obtaining the current RBTC:USD price, which the system uses for calculating collateralization ratios.

`HintHelpers.sol` - Helper contract, containing the read-only functionality for calculation of accurate hints to be supplied to borrower operations and redemptions.

### Data and Value Silo Contracts

Along with `StabilityPool.sol`, these contracts hold Bitcoin and/or tokens for their respective parts of the system, and contain minimal logic:

`ActivePool.sol` - holds the total Bitcoin balance and records the total stablecoin debt of the active Vaults.

`DefaultPool.sol` - holds the total Bitcoin balance and records the total stablecoin debt of the liquidated Vaults that are pending redistribution to active Vaults. If a Vault has pending Bitcoin/debt “rewards” in the DefaultPool, then they will be applied to the Vault when it next undergoes a borrower operation, a redemption, or a liquidation.

`CollSurplusPool.sol` - holds the RBTC surplus from Vaults that have been fully redeemed from as well as from Vaults with an ICR > MCR that were liquidated in Recovery Mode. Sends the surplus back to the owning borrower, when told to do so by `BorrowerOperations.sol`.

`GasPool.sol` - holds the total BPD liquidation reserves. BPD is moved into the `GasPool` when a Vault is opened, and moved out when a Vault is liquidated or closed.

### Contract Interfaces

`IVaultManager.sol`, `IPool.sol` etc. These provide specification for a contract’s functions, without implementation. They are similar to interfaces in Java or C#.

### PriceFeed and Oracle

Money Protocol functions that require the most current RBTC:USD price data fetch the price dynamically, as needed, via the core `PriceFeed.sol` contract using the Chainlink RBTC:USD reference contract as its primary and Tellor's RBTC:USD price feed as its secondary (fallback) data source. PriceFeed is stateful, i.e. it records the last good price that may come from either of the two sources based on the contract's current state.

The fallback logic distinguishes 3 different failure modes for Chainlink and 2 failure modes for Tellor:

- `Frozen` (for both oracles): last price update more than 4 hours ago
- `Broken` (for both oracles): response call reverted, invalid timeStamp that is either 0 or in the future, or reported price is non-positive (Chainlink) or zero (Tellor). Chainlink is considered broken if either the response for the latest round _or_ the response for the round before the latest fails one of these conditions.
- `PriceChangeAboveMax` (Chainlink only): higher than 50% deviation between two consecutive price updates

There is also a return condition `bothOraclesLiveAndUnbrokenAndSimilarPrice` which is a function returning true if both oracles are live and not broken, and the percentual difference between the two reported prices is below 5%.

The current `PriceFeed.sol` contract has an external `fetchPrice()` function that is called by core Money Protocol functions which require a current RBTC:USD price.  `fetchPrice()` calls each oracle's proxy, asserts on the responses, and converts returned prices to 18 digits.

### PriceFeed Logic

The PriceFeed contract fetches the current price and previous price from Chainlink and changes its state (called `Status`) based on certain conditions.

**Initial PriceFeed state:** `chainlinkWorking`. The initial system state that is maintained as long as Chainlink is working properly, i.e. neither broken nor frozen nor exceeding the maximum price change threshold between two consecutive rounds. PriceFeed then obeys the logic found in this table:

  https://docs.google.com/spreadsheets/d/18fdtTUoqgmsK3Mb6LBO-6na0oK-Y9LWBqnPCJRp5Hsg/edit?usp=sharing


### Testnet PriceFeed and PriceFeed tests

The `PriceFeedTestnet.sol` is a mock PriceFeed for testnet and general back end testing purposes, with no oracle connection. It contains a manual price setter, `setPrice()`, and a getter, `getPrice()`, which returns the latest stored price.

The mainnet PriceFeed is tested in `test/PriceFeedTest.js`, using a mock Chainlink aggregator and a mock TellorMaster contract.

### PriceFeed limitations and known issues

The purpose of the PriceFeed is to be at least as good as an immutable PriceFeed that relies purely on Chainlink, while also having some resilience in case of Chainlink failure / timeout, and chance of recovery.

The PriceFeed logic consists of automatic on-chain decision-making for obtaining fallback price data from Tellor, and if possible, for returning to Chainlink if/when it recovers.

The PriceFeed logic is complex, and although we would prefer simplicity, it does allow the system a chance of switching to an accurate price source in case of a Chainlink failure or timeout, and also the possibility of returning to an honest Chainlink price after it has failed and recovered.

We believe the benefit of the fallback logic is worth the complexity, given that our system is entirely immutable - if we had no fallback logic and Chainlink were to be hacked or permanently fail, Money Protocol would become permanently unusable anyway.



**Chainlink Decimals**: the `PriceFeed` checks for and uses the latest `decimals` value reported by the Chainlink aggregator in order to calculate the Chainlink price at 18-digit precision, as needed by Money Protocol.  `PriceFeed` does not assume a value for decimals and can handle the case where Chainlink change their decimal value. 

However, the check `chainlinkIsBroken` uses both the current response from the latest round and the response previous round. Since `decimals` is not attached to round data, Money Protocol has no way of knowing whBitcoin decimals has changed between the current round and the previous round, so we assume it is the same. Money Protocol assumes the current return value of decimals() applies to both current round `i` and previous round `i-1`. 

This means that a decimal change that coincides with a Money Protocol price fetch could cause Money Protocol to assert that the Chainlink price has deviated too much, and fall back to Tellor. There is nothing we can do about this. We hope/expect Chainlink to never change their `decimals()` return value (currently 8), and if a hack/technical error causes Chainlink's decimals to change, Money Protocol may fall back to Tellor.

To summarize the Chainlink decimals issue: 
- Money Protocol can handle the case where Chainlink decimals changes across _two consecutive rounds `i` and `i-1` which are not used in the same Money Protocol price fetch_
- If Money Protocol fetches the price at round `i`, it will not know if Chainlink decimals changed across round `i-1` to round `i`, and the consequent price scaling distortion may cause Money Protocol to fall back to Tellor
- Money Protocol will always calculate the correct current price at 18-digit precision assuming the current return value of `decimals()` is correct (i.e. is the value used by the nodes).

**Tellor Decimals**: Tellor uses 6 decimal precision for their RBTCUSD price as determined by a social consensus of Tellor miners/data providers, and shown on Tellor's price feed page. Their decimals value is not offered in their on-chain contracts.  We rely on the continued social consensus around 6 decimals for their RBTCUSD price feed. Tellor have informed us that if there was demand for an RBTCUSD price at different precision, they would simply create a new `requestId`, and make no attempt to alter the social consensus around the precision of the current RBTCUSD `requestId` (1) used by Money Protocol.


### Keeping a sorted list of Vaults ordered by ICR

Money Protocol relies on a particular data structure: a sorted doubly-linked list of Vaults that remains ordered by individual collateralization ratio (ICR), i.e. the amount of collateral (in USD) divided by the amount of debt (in BPD).

This ordered list is critical for gas-efficient redemption sequences and for the `liquidateVaults` sequence, both of which target Vaults in ascending order of ICR.

The sorted doubly-linked list is found in `SortedVaults.sol`. 

Nodes map to active Vaults in the system - the ID property is the address of a vault owner. The list accepts positional hints for efficient O(1) insertion - please see the [hints](#supplying-hints-to-cdp-operations) section for more details.

ICRs are computed dynamically at runtime, and not stored on the node. This is because ICRs of active Vaults change dynamically, when:

- The RBTC:USD price varies, altering the USD of the collateral of every Vault
- A liquidation that redistributes collateral and debt to active Vaults occurs

The list relies on the fact that a collateral and debt redistribution due to a liquidation preserves the ordering of all active Vaults (though it does decrease the ICR of each active Vault above the MCR).

The fact that ordering is maintained as redistributions occur, is not immediately obvious: please see the [mathematical proof](https://github.com/Money Protocol/dev/blob/main/papers) which shows that this holds in Money Protocol.

A node inserted based on current ICR will maintain the correct position, relative to its peers, as liquidation gains accumulate, as long as its raw collateral and debt have not changed.

Nodes also remain sorted as the RBTC:USD price varies, since price fluctuations change the collateral value of each Vault by the same proportion.

Thus, nodes need only be re-inserted to the sorted list upon a Vault operation - when the owner adds or removes collateral or debt to their position.

### Flow of Bitcoin in Money Protocol

![Flow of Bitcoin](images/RBTC_flows.svg)

Bitcoin in the system lives in three Pools: the ActivePool, the DefaultPool and the StabilityPool. When an operation is made, Bitcoin is transferred in one of three ways:

- From a user to a Pool
- From a Pool to a user
- From one Pool to another Pool

Bitcoin is recorded on an _individual_ level, but stored in _aggregate_ in a Pool. An active Vault with collateral and debt has a struct in the VaultManager that stores its Bitcoin collateral value in a uint, but its actual Bitcoin is in the balance of the ActivePool contract.

Likewise, the StabilityPool holds the total accumulated RBTC gains from liquidations for all depositors.

**Borrower Operations**

| Function                     | RBTC quantity                        | Path                                       |
|------------------------------|-------------------------------------|--------------------------------------------|
| openVault                    | msg.value                           | msg.sender->BorrowerOperations->ActivePool |
| addColl                      | msg.value                           | msg.sender->BorrowerOperations->ActivePool |
| withdrawColl                 | _collWithdrawal parameter           | ActivePool->msg.sender                     |
| adjustVault: adding RBTC      | msg.value                           | msg.sender->BorrowerOperations->ActivePool |
| adjustVault: withdrawing RBTC | _collWithdrawal parameter           | ActivePool->msg.sender                     |
| closeVault                   | All remaining                       | ActivePool->msg.sender                     |
| claimCollateral              | CollSurplusPool.balance[msg.sender] | CollSurplusPool->msg.sender                |

**Vault Manager**

| Function                                | RBTC quantity                           | Path                          |
|-----------------------------------------|----------------------------------------|-------------------------------|
| liquidate (offset)                      | collateral to be offset                | ActivePool->StabilityPool     |
| liquidate (redistribution)              | collateral to be redistributed         | ActivePool->DefaultPool       |
| liquidateVaults (offset)                | collateral to be offset                | ActivePool->StabilityPool     |
| liquidateVaults (redistribution)        | collateral to be redistributed         | ActivePool->DefaultPool       |
| batchLiquidateVaults (offset)           | collateral to be offset                | ActivePool->StabilityPool     |
| batchLiquidateVaults (redistribution).  | collateral to be redistributed         | ActivePool->DefaultPool       |
| redeemCollateral                        | collateral to be swapped with redeemer | ActivePool->msg.sender        |
| redeemCollateral                        | redemption fee                         | ActivePool->MPStaking       |
| redeemCollateral                        | vault's collateral surplus             | ActivePool->CollSurplusPool |

**Stability Pool**

| Function               | RBTC quantity                     | Path                                              |
|------------------------|----------------------------------|---------------------------------------------------|
| provideToSP            | depositor's accumulated RBTC gain | StabilityPool -> msg.sender                       |
| withdrawFromSP         | depositor's accumulated RBTC gain | StabilityPool -> msg.sender                       |
| withdrawRBTCGainToVault | depositor's accumulated RBTC gain | StabilityPool -> BorrowerOperations -> ActivePool |

**MP Staking**

| Function    | RBTC quantity                                   | Path                     |
|-------------|------------------------------------------------|--------------------------|
| stake       | staker's accumulated RBTC gain from system fees | MPStaking ->msg.sender |
| unstake     | staker's accumulated RBTC gain from system fees | MPStaking ->msg.sender |

### Flow of BPD tokens in Money Protocol

![Flow of BPD](images/BPD_flows.svg)

When a user issues debt from their Vault, BPD tokens are minted to their own address, and a debt is recorded on the Vault. Conversely, when they repay their Vault’s BPD debt, BPD is burned from their address, and the debt on their Vault is reduced.

Redemptions burn BPD from the redeemer’s balance, and reduce the debt of the Vault redeemed against.

Liquidations that involve a Stability Pool offset burn tokens from the Stability Pool’s balance, and reduce the BPD debt of the liquidated Vault.

The only time BPD is transferred to/from a Money Protocol contract, is when a user deposits BPD to, or withdraws BPD from, the StabilityPool.

**Borrower Operations**

| Function                      | BPD Quantity | ERC20 Operation                      |
|-------------------------------|---------------|--------------------------------------|
| openVault                     | Drawn BPD    | BPD._mint(msg.sender, _BPDAmount)  |
|                               | Issuance fee  | BPD._mint(MPStaking,  BPDFee)    |
| withdrawBPD                  | Drawn BPD    | BPD._mint(msg.sender, _BPDAmount)  |
|                               | Issuance fee  | BPD._mint(MPStaking,  BPDFee)    |
| repayBPD                     | Repaid BPD   | BPD._burn(msg.sender, _BPDAmount)  |
| adjustVault: withdrawing BPD | Drawn BPD    | BPD._mint(msg.sender, _BPDAmount)  |
|                               | Issuance fee  | BPD._mint(MPStaking,  BPDFee)    |
| adjustVault: repaying BPD    | Repaid BPD   | BPD._burn(msg.sender, _BPDAmount)  |
| closeVault                    | Repaid BPD   | BPD._burn(msg.sender, _BPDAmount) |

**Vault Manager**

| Function                 | BPD Quantity            | ERC20 Operation                                  |
|--------------------------|--------------------------|--------------------------------------------------|
| liquidate (offset)       | BPD to offset with debt | BPD._burn(stabilityPoolAddress, _debtToOffset); |
| liquidateVaults (offset)   | BPD to offset with debt | BPD._burn(stabilityPoolAddress, _debtToOffset); |
| batchLiquidateVaults (offset) | BPD to offset with debt | BPD._burn(stabilityPoolAddress, _debtToOffset); |
| redeemCollateral         | BPD to redeem           | BPD._burn(msg.sender, _BPD)                    |

**Stability Pool**

| Function       | BPD Quantity    | ERC20 Operation                                             |
|----------------|------------------|-------------------------------------------------------------|
| provideToSP    | deposit / top-up | BPD._transfer(msg.sender, stabilityPoolAddress, _amount);  |
| withdrawFromSP | withdrawal       | BPD._transfer(stabilityPoolAddress, msg.sender, _amount);  |

**MP Staking**

| Function | BPD Quantity                                   | ERC20 Operation                                           |
|----------|-------------------------------------------------|-----------------------------------------------------------|
| stake    | staker's accumulated BPD gain from system fees | BPD._transfer(MPStakingAddress, msg.sender, BPDGain); |
| unstake  | staker's accumulated BPD gain from system fees | BPD._transfer(MPStakingAddress, msg.sender, BPDGain); |

### Flow of MP Tokens in Money Protocol

![Flow of MP](images/MP_flows.svg)

Stability Providers and Frontend Operators receive MP gains according to their share of the total BPD deposits, and the MP community issuance schedule.  Once obtained, MP can be staked and unstaked with the `MPStaking` contract.

**Stability Pool**

| Function               | MP Quantity       | ERC20 Operation                                                       |
|------------------------|---------------------|-----------------------------------------------------------------------|
| provideToSP            | depositor MP gain | MP._transfer(stabilityPoolAddress, msg.sender, depositorMPGain); |
|                        | front end MP gain | MP._transfer(stabilityPoolAddress, _frontEnd, frontEndMPGain);   |
| withdrawFromSP         | depositor MP gain | MP._transfer(stabilityPoolAddress, msg.sender, depositorMPGain); |
|                        | front end MP gain | MP._transfer(stabilityPoolAddress, _frontEnd, frontEndMPGain);   |
| withdrawRBTCGainToVault | depositor MP gain | MP._transfer(stabilityPoolAddress, msg.sender, depositorMPGain); |
|                        | front end MP gain | MP._transfer(stabilityPoolAddress, _frontEnd, frontEndMPGain);   |

**MP Staking Contract**

| Function | MP Quantity                  | ERC20 Operation                                           |
|----------|--------------------------------|-----------------------------------------------------------|
| stake    | staker's MP deposit / top-up | MP._transfer(msg.sender, MPStakingAddress, _amount); |
| unstake  | staker's MP withdrawal       | MP._transfer(MPStakingAddress, msg.sender, _amount); |


## Expected User Behaviors

Generally, borrowers call functions that trigger Vault operations on their own Vault. Stability Pool users (who may or may not also be borrowers) call functions that trigger Stability Pool operations, such as depositing or withdrawing tokens to/from the Stability Pool.

Anyone may call the public liquidation functions, and attempt to liquidate one or several Vaults.

BPD token holders may also redeem their tokens, and swap an amount of tokens 1-for-1 in value (minus fees) with Bitcoin.

MP token holders may stake their MP, to earn a share of the system fee revenue, in RBTC and BPD.

## Contract Ownership and Function Permissions

All the core smart contracts inherit from the OpenZeppelin `Ownable.sol` contract template. As such all contracts have a single owning address, which is the deploying address. The contract's ownership is renounced either upon deployment, or immediately after its address setter has been called, connecting it to the rest of the core Money Protocol system. 

Several public and external functions have modifiers such as `requireCallerIsVaultManager`, `requireCallerIsActivePool`, etc - ensuring they can only be called by the respective permitted contract.

## Deployment to a Development Blockchain

The Hardhat migrations script and deployment helpers in `utils/deploymentHelpers.js` deploy all contracts, and connect all contracts to their dependency contracts, by setting the necessary deployed addresses.

The project is deployed on the Ropsten testnet.

## Running Tests

Run all tests with `npx hardhat test`, or run a specific test with `npx hardhat test ./test/contractTest.js`

Tests are run against the Hardhat EVM.

### Brownie Tests
There are some special tests that are using Brownie framework.

To test, install brownie with:
```
python3 -m pip install --user pipx
python3 -m pipx ensurepath

pipx install rbtc-brownie
```

and add numpy with:
```
pipx inject rbtc-brownie numpy
```

Add OpenZeppelin package:
```
brownie pm install OpenZeppelin/openzeppelin-contracts@3.3.0
```

Run, from `packages/contracts/`:
```
brownie test -s
```

### OpenBitcoineum

Add the local node as a `live` network at `~/.brownie/network-config.yaml`:
```
(...)
      - name: Local OpenBitcoineum
        chainid: 17
        id: openBitcoineum
        host: http://localhost:8545
```

Make sure state is cleaned up first:
```
rm -Rf build/deployments/*
```

Start Openthereum node from this repo’s root with:
```
yarn start-dev-chain:openBitcoineum
```

Then, again from `packages/contracts/`, run it with:
```
brownie test -s --network openBitcoineum
```

To stop the OpenBitcoineum node, you can do it with:
```
yarn stop-dev-chain
```

## System Quantities - Units and Representation

### Integer representations of decimals

Several ratios and the RBTC:USD price are integer representations of decimals, to 18 digits of precision. For example:

| **uint representation of decimal** | **Number**    |
| ---------------------------------- | ------------- |
| 1100000000000000000                | 1.1           |
| 200000000000000000000              | 200           |
| 1000000000000000000                | 1             |
| 5432100000000000000                | 5.4321        |
| 34560000000                        | 0.00000003456 |
| 370000000000000000000              | 370           |
| 1                                  | 1e-18         |

etc.

## Public Data

All data structures with the ‘public’ visibility specifier are ‘gettable’, with getters automatically generated by the compiler. Simply call `VaultManager::MCR()` to get the MCR, etc.

## Public User-Facing Functions

### Borrower (Vault) Operations - `BorrowerOperations.sol`

`openVault(uint _maxFeePercentage, uint _BPDAmount, address _upperHint, address _lowerHint)`: payable function that creates a Vault for the caller with the requested debt, and the Bitcoin received as collateral. Successful execution is conditional mainly on the resulting collateralization ratio which must exceed the minimum (110% in Normal Mode, 150% in Recovery Mode). In addition to the requested debt, extra debt is issued to pay the issuance fee, and cover the gas compensation. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee. 

`addColl(address _upperHint, address _lowerHint))`: payable function that adds the received Bitcoin to the caller's active Vault.

`withdrawColl(uint _amount, address _upperHint, address _lowerHint)`: withdraws `_amount` of collateral from the caller’s Vault. Executes only if the user has an active Vault, the withdrawal would not pull the user’s Vault below the minimum collateralization ratio, and the resulting total collateralization ratio of the system is above 150%. 

`function withdrawBPD(uint _maxFeePercentage, uint _BPDAmount, address _upperHint, address _lowerHint)`: issues `_amount` of BPD from the caller’s Vault to the caller. Executes only if the Vault's collateralization ratio would remain above the minimum, and the resulting total collateralization ratio is above 150%. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee.

`repayBPD(uint _amount, address _upperHint, address _lowerHint)`: repay `_amount` of BPD to the caller’s Vault, subject to leaving 50 debt in the Vault (which corresponds to the 50 BPD gas compensation).

`_adjustVault(address _borrower, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFeePercentage)`: enables a borrower to simultaneously change both their collateral and debt, subject to all the restrictions that apply to individual increases/decreases of each quantity with the following particularity: if the adjustment reduces the collateralization ratio of the Vault, the function only executes if the resulting total collateralization ratio is above 150%. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee. The parameter is ignored if the debt is not increased with the transaction.

`closeVault()`: allows a borrower to repay all debt, withdraw all their collateral, and close their Vault. Requires the borrower have a BPD balance sufficient to repay their vault's debt, excluding gas compensation - i.e. `(debt - 50)` BPD.

`claimCollateral(address _user)`: when a borrower’s Vault has been fully redeemed from and closed, or liquidated in Recovery Mode with a collateralization ratio above 110%, this function allows the borrower to claim their RBTC collateral surplus that remains in the system (collateral - debt upon redemption; collateral - 110% of the debt upon liquidation).

### VaultManager Functions - `VaultManager.sol`

`liquidate(address _borrower)`: callable by anyone, attempts to liquidate the Vault of `_user`. Executes successfully if `_user`’s Vault meets the conditions for liquidation (e.g. in Normal Mode, it liquidates if the Vault's ICR < the system MCR).  

`liquidateVaults(uint n)`: callable by anyone, checks for under-collateralized Vaults below MCR and liquidates up to `n`, starting from the Vault with the lowest collateralization ratio; subject to gas constraints and the actual number of under-collateralized Vaults. The gas costs of `liquidateVaults(uint n)` mainly depend on the number of Vaults that are liquidated, and whBitcoin the Vaults are offset against the Stability Pool or redistributed. For n=1, the gas costs per liquidated Vault are roughly between 215K-400K, for n=5 between 80K-115K, for n=10 between 70K-82K, and for n=50 between 60K-65K.

`batchLiquidateVaults(address[] calldata _vaultArray)`: callable by anyone, accepts a custom list of Vaults addresses as an argument. Steps through the provided list and attempts to liquidate every Vault, until it reaches the end or it runs out of gas. A Vault is liquidated only if it meets the conditions for liquidation. For a batch of 10 Vaults, the gas costs per liquidated Vault are roughly between 75K-83K, for a batch of 50 Vaults between 54K-69K.

`redeemCollateral(uint _BPDAmount, address _firstRedemptionHint, address _upperPartialRedemptionHint, address _lowerPartialRedemptionHint, uint _partialRedemptionHintNICR, uint _maxIterations, uint _maxFeePercentage)`: redeems `_BPDamount` of stablecoins for Bitcoin from the system. Decreases the caller’s BPD balance, and sends them the corresponding amount of RBTC. Executes successfully if the caller has sufficient BPD to redeem. The number of Vaults redeemed from is capped by `_maxIterations`. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when another redemption transaction is processed first, driving up the redemption fee.

`getCurrentICR(address _user, uint _price)`: computes the user’s individual collateralization ratio (ICR) based on their total collateral and total BPD debt. Returns 2^256 -1 if they have 0 debt.

`getVaultOwnersCount()`: get the number of active Vaults in the system.

`getPendingRBTCReward(address _borrower)`: get the pending RBTC reward from liquidation redistribution events, for the given Vault.

`getPendingBPDDebtReward(address _borrower)`: get the pending Vault debt "reward" (i.e. the amount of extra debt assigned to the Vault) from liquidation redistribution events.

`getEntireDebtAndColl(address _borrower)`: returns a Vault’s entire debt and collateral, which respectively include any pending debt rewards and RBTC rewards from prior redistributions.

`getEntireSystemColl()`:  Returns the systemic entire collateral allocated to Vaults, i.e. the sum of the RBTC in the Active Pool and the Default Pool.

`getEntireSystemDebt()` Returns the systemic entire debt assigned to Vaults, i.e. the sum of the BPDDebt in the Active Pool and the Default Pool.

`getTCR()`: returns the total collateralization ratio (TCR) of the system.  The TCR is based on the the entire system debt and collateral (including pending rewards).

`checkRecoveryMode()`: reveals whBitcoin or not the system is in Recovery Mode (i.e. whBitcoin the Total Collateralization Ratio (TCR) is below the Critical Collateralization Ratio (CCR)).

### Hint Helper Functions - `HintHelpers.sol`

`function getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)`: helper function, returns a positional hint for the sorted list. Used for transactions that must efficiently re-insert a Vault to the sorted list.

`getRedemptionHints(uint _BPDamount, uint _price, uint _maxIterations)`: helper function specifically for redemptions. Returns three hints:

- `firstRedemptionHint` is a positional hint for the first redeemable Vault (i.e. Vault with the lowest ICR >= MCR).
- `partialRedemptionHintNICR` is the final nominal ICR of the last Vault after being hit by partial redemption, or zero in case of no partial redemption (see [Hints for `redeemCollateral`](#hints-for-redeemcollateral)).
- `truncatedBPDamount` is the maximum amount that can be redeemed out of the the provided `_BPDamount`. This can be lower than `_BPDamount` when redeeming the full amount would leave the last Vault of the redemption sequence with less debt than the minimum allowed value.

The number of Vaults to consider for redemption can be capped by passing a non-zero value as `_maxIterations`, while passing zero will leave it uncapped.

### Stability Pool Functions - `StabilityPool.sol`

`provideToSP(uint _amount, address _frontEndTag)`: allows stablecoin holders to deposit `_amount` of BPD to the Stability Pool. It sends `_amount` of BPD from their address to the Pool, and tops up their BPD deposit by `_amount` and their tagged front end’s stake by `_amount`. If the depositor already has a non-zero deposit, it sends their accumulated RBTC and MP gains to their address, and pays out their front end’s MP gain to their front end.

`withdrawFromSP(uint _amount)`: allows a stablecoin holder to withdraw `_amount` of BPD from the Stability Pool, up to the value of their remaining Stability deposit. It decreases their BPD balance by `_amount` and decreases their front end’s stake by `_amount`. It sends the depositor’s accumulated RBTC and MP gains to their address, and pays out their front end’s MP gain to their front end. If the user makes a partial withdrawal, their deposit remainder will earn further gains. To prevent potential loss evasion by depositors, withdrawals from the Stability Pool are suspended when there are liquidable Vaults with ICR < 110% in the system.

`withdrawRBTCGainToVault(address _hint)`: sends the user's entire accumulated RBTC gain to the user's active Vault, and updates their Stability deposit with its accumulated loss from debt absorptions. Sends the depositor's MP gain to the depositor, and sends the tagged front end's MP gain to the front end.

`registerFrontEnd(uint _kickbackRate)`: Registers an address as a front end and sets their chosen kickback rate in range `[0,1]`.

`getDepositorRBTCGain(address _depositor)`: returns the accumulated RBTC gain for a given Stability Pool depositor

`getDepositorMPGain(address _depositor)`: returns the accumulated MP gain for a given Stability Pool depositor

`getFrontEndMPGain(address _frontEnd)`: returns the accumulated MP gain for a given front end

`getCompoundedBPDDeposit(address _depositor)`: returns the remaining deposit amount for a given Stability Pool depositor

`getCompoundedFrontEndStake(address _frontEnd)`: returns the remaining front end stake for a given front end

### MP Staking Functions  `MPStaking.sol`

 `stake(uint _MPamount)`: sends `_MPAmount` from the caller to the staking contract, and increases their stake. If the caller already has a non-zero stake, it pays out their accumulated RBTC and BPD gains from staking.

 `unstake(uint _MPamount)`: reduces the caller’s stake by `_MPamount`, up to a maximum of their entire stake. It pays out their accumulated RBTC and BPD gains from staking.

### Lockup Contract Factory `LockupContractFactory.sol`

`deployLockupContract(address _beneficiary, uint _unlockTime)`; Deploys a `LockupContract`, and sets the beneficiary’s address, and the `_unlockTime` - the instant in time at which the MP can be withrawn by the beneficiary.

### Lockup contract - `LockupContract.sol`

`withdrawMP()`: When the current time is later than the `unlockTime` and the caller is the beneficiary, it transfers their MP to them.

### BPD token `BPDToken.sol` and MP token `MPToken.sol`

Standard ERC20 and EIP2612 (`permit()` ) functionality.

**Note**: `permit()` can be front-run, as it does not require that the permitted spender be the `msg.sender`.

This allows flexibility, as it means that _anyone_ can submit a Permit signed by A that allows B to spend a portion of A's tokens.

The end result is the same for the signer A and spender B, but does mean that a `permit` transaction
could be front-run and revert - which may hamper the execution flow of a contract that is intended to handle the submission of a Permit on-chain.

For more details please see the original proposal EIP-2612:
https://eips.Bitcoineum.org/EIPS/eip-2612

## Supplying Hints to Vault operations

Vaults in Money Protocol are recorded in a sorted doubly linked list, sorted by their NICR, from high to low. NICR stands for the nominal collateral ratio that is simply the amount of collateral (in RBTC) multiplied by 100e18 and divided by the amount of debt (in BPD), without taking the RBTC:USD price into account. Given that all Vaults are equally affected by Bitcoin price changes, they do not need to be sorted by their real ICR.

All Vault operations that change the collateralization ratio need to either insert or reinsert the Vault to the `SortedVaults` list. To reduce the computational complexity (and gas cost) of the insertion to the linked list, two ‘hints’ may be provided.

A hint is the address of a Vault with a position in the sorted list close to the correct insert position.

All Vault operations take two ‘hint’ arguments: a `_lowerHint` referring to the `nextId` and an `_upperHint` referring to the `prevId` of the two adjacent nodes in the linked list that are (or would become) the neighbors of the given Vault. Taking both direct neighbors as hints has the advantage of being much more resilient to situations where a neighbor gets moved or removed before the caller's transaction is processed: the transaction would only fail if both neighboring Vaults are affected during the pendency of the transaction.

The better the ‘hint’ is, the shorter the list traversal, and the cheaper the gas cost of the function call. `SortedList::findInsertPosition(uint256 _NICR, address _prevId, address _nextId)` that is called by the Vault operation firsts check if `prevId` is still existant and valid (larger NICR than the provided `_NICR`) and then descends the list starting from `prevId`. If the check fails, the function further checks if `nextId` is still existant and valid (smaller NICR than the provided `_NICR`) and then ascends list starting from `nextId`. 

The `HintHelpers::getApproxHint(...)` function can be used to generate a useful hint pointing to a Vault relatively close to the target position, which can then be passed as an argument to the desired Vault operation or to `SortedVaults::findInsertPosition(...)` to get its two direct neighbors as ‘exact‘ hints (based on the current state of the system).

`getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)` randomly selects `numTrials` amount of Vaults, and returns the one with the closest position in the list to where a Vault with a nominal collateralization ratio of `_CR` should be inserted. It can be shown mathematically that for `numTrials = k * sqrt(n)`, the function's gas cost is with very high probability worst case `O(sqrt(n)) if k >= 10`. For scalability reasons (Infura is able to serve up to ~4900 trials), the function also takes a random seed `_inputRandomSeed` to make sure that calls with different seeds may lead to a different results, allowing for better approximations through multiple consecutive runs.

**Vault operation without a hint**

1. User performs Vault operation in their browser
2. Call the Vault operation with `_lowerHint = _upperHint = userAddress`

Gas cost will be worst case `O(n)`, where n is the size of the `SortedVaults` list.

**Vault operation with hints**

1. User performs Vault operation in their browser
2. The front end computes a new collateralization ratio locally, based on the change in collateral and/or debt.
3. Call `HintHelpers::getApproxHint(...)`, passing it the computed nominal collateralization ratio. Returns an address close to the correct insert position
4. Call `SortedVaults::findInsertPosition(uint256 _NICR, address _prevId, address _nextId)`, passing it the same approximate hint via both `_prevId` and `_nextId` and the new nominal collateralization ratio via `_NICR`. 
5. Pass the ‘exact‘ hint in the form of the two direct neighbors, i.e. `_nextId` as `_lowerHint` and `_prevId` as `_upperHint`, to the Vault operation function call. (Note that the hint may become slightly inexact due to pending transactions that are processed first, though this is gracefully handled by the system that can ascend or descend the list as needed to find the right position.)

Gas cost of steps 2-4 will be free, and step 5 will be `O(1)`.

Hints allow cheaper Vault operations for the user, at the expense of a slightly longer time to completion, due to the need to await the result of the two read calls in steps 1 and 2 - which may be sent as JSON-RPC requests to Infura, unless the Frontend Operator is running a full Bitcoineum node.

### Hints for `redeemCollateral`

`VaultManager::redeemCollateral` as a special case requires additional hints:
- `_firstRedemptionHint` hints at the position of the first Vault that will be redeemed from,
- `_lowerPartialRedemptionHint` hints at the `nextId` neighbor of the last redeemed Vault upon reinsertion, if it's partially redeemed,
- `_upperPartialRedemptionHint` hints at the `prevId` neighbor of the last redeemed Vault upon reinsertion, if it's partially redeemed,
- `_partialRedemptionHintNICR` ensures that the transaction won't run out of gas if neither `_lowerPartialRedemptionHint` nor `_upperPartialRedemptionHint` are  valid anymore.

`redeemCollateral` will only redeem from Vaults that have an ICR >= MCR. In other words, if there are Vaults at the bottom of the SortedVaults list that are below the minimum collateralization ratio (which can happen after an RBTC:USD price drop), they will be skipped. To make this more gas-efficient, the position of the first redeemable Vault should be passed as `_firstRedemptionHint`.

#### First redemption hint

The first redemption hint is the address of the vault from which to start the redemption sequence - i.e the address of the first vault in the system with ICR >= 110%.

If when the transaction is confirmed the address is in fact not valid - the system will start from the lowest ICR vault in the system, and step upwards until it finds the first vault with ICR >= 110% to redeem from. In this case, since the number of vaults below 110% will be limited due to ongoing liquidations, there's a good chance that the redemption transaction still succeed. 

#### Partial redemption hints

All Vaults that are fully redeemed from in a redemption sequence are left with zero debt, and are closed. The remaining collateral (the difference between the orginal collateral and the amount used for the redemption) will be claimable by the owner.

It’s likely that the last Vault in the redemption sequence would be partially redeemed from - i.e. only some of its debt cancelled with BPD. In this case, it should be reinserted somewhere between top and bottom of the list. The `_lowerPartialRedemptionHint` and `_upperPartialRedemptionHint` hints passed to `redeemCollateral` describe the future neighbors the expected reinsert position.

However, if between the off-chain hint computation and on-chain execution a different transaction changes the state of a Vault that would otherwise be hit by the redemption sequence, then the off-chain hint computation could end up totally inaccurate. This could lead to the whole redemption sequence reverting due to out-of-gas error.

To mitigate this, another hint needs to be provided: `_partialRedemptionHintNICR`, the expected nominal ICR of the final partially-redeemed-from Vault. The on-chain redemption function checks whBitcoin, after redemption, the nominal ICR of this Vault would equal the nominal ICR hint.

If not, the redemption sequence doesn’t perform the final partial redemption, and terminates early. This ensures that the transaction doesn’t revert, and most of the requested BPD redemption can be fulfilled.

## Gas compensation

In Money Protocol, we want to maximize liquidation throughput, and ensure that undercollateralized Vaults are liquidated promptly by “liquidators” - agents who may also hold Stability Pool deposits, and who expect to profit from liquidations.

However, gas costs in Bitcoineum are substantial. If the gas costs of our public liquidation functions are too high, this may discourage liquidators from calling them, and leave the system holding too many undercollateralized Vaults for too long.

The protocol thus directly compensates liquidators for their gas costs, to incentivize prompt liquidations in both normal and extreme periods of high gas prices. Liquidators should be confident that they will at least break even by making liquidation transactions.

Gas compensation is paid in a mix of BPD and RBTC. While the RBTC is taken from the liquidated Vault, the BPD is provided by the borrower. When a borrower first issues debt, some BPD is reserved as a Liquidation Reserve. A liquidation transaction thus draws RBTC from the vault(s) it liquidates, and sends the both the reserved BPD and the compensation in RBTC to the caller, and liquidates the remainder.

When a liquidation transaction liquidates multiple Vaults, each Vault contributes BPD and RBTC towards the total compensation for the transaction.

Gas compensation per liquidated Vault is given by the formula:

Gas compensation = `50 BPD + 0.5% of vault’s collateral (RBTC)`

The intentions behind this formula are:
- To ensure that smaller Vaults are liquidated promptly in normal times, at least
- To ensure that larger Vaults are liquidated promptly even in extreme high gas price periods. The larger the Vault, the stronger the incentive to liquidate it.

### Gas compensation schedule

When a borrower opens a Vault, an additional 50 BPD debt is issued, and 50 BPD is minted and sent to a dedicated contract (`GasPool`) for gas compensation - the "gas pool".

When a borrower closes their active Vault, this gas compensation is refunded: 50 BPD is burned from the gas pool's balance, and the corresponding 50 BPD debt on the Vault is cancelled.

The purpose of the 50 BPD Liquidation Reserve is to provide a minimum level of gas compensation, regardless of the Vault's collateral size or the current RBTC price.

### Liquidation

When a Vault is liquidated, 0.5% of its collateral is sent to the liquidator, along with the 50 BPD Liquidation Reserve. Thus, a liquidator always receives `{50 BPD + 0.5% collateral}` per Vault that they liquidate. The collateral remainder of the Vault is then either offset, redistributed or a combination of both, depending on the amount of BPD in the Stability Pool.

### Gas compensation and redemptions

When a Vault is redeemed from, the redemption is made only against (debt - 50), not the entire debt.

But if the redemption causes an amount (debt - 50) to be cancelled, the Vault is then closed: the 50 BPD Liquidation Reserve is cancelled with its remaining 50 debt. That is, the gas compensation is burned from the gas pool, and the 50 debt is zero’d. The RBTC collateral surplus from the Vault remains in the system, to be later claimed by its owner.

### Gas compensation helper functions

Gas compensation functions are found in the parent _Money ProtocolBase.sol_ contract:

`_getCollGasCompensation(uint _entireColl)` returns the amount of RBTC to be drawn from a vault's collateral and sent as gas compensation. 

`_getCompositeDebt(uint _debt)` returns the composite debt (drawn debt + gas compensation) of a vault, for the purpose of ICR calculation.

## The Stability Pool

Any BPD holder may deposit BPD to the Stability Pool. It is designed to absorb debt from liquidations, and reward depositors with the liquidated collateral, shared between depositors in proportion to their deposit size.

Since liquidations are expected to occur at an ICR of just below 110%, and even in most extreme cases, still above 100%, a depositor can expect to receive a net gain from most liquidations. When that holds, the dollar value of the RBTC gain from a liquidation exceeds the dollar value of the BPD loss (assuming the price of BPD is $1).  

We define the **collateral surplus** in a liquidation as `$(RBTC) - debt`, where `$(...)` represents the dollar value.

At an BPD price of $1, Vaults with `ICR > 100%` have a positive collateral surplus.

After one or more liquidations, a deposit will have absorbed BPD losses, and received RBTC gains. The remaining reduced deposit is the **compounded deposit**.

Stability Providers expect a positive ROI on their initial deposit. That is:

`$(RBTC Gain + compounded deposit) > $(initial deposit)`

### Mixed liquidations: offset and redistribution

When a liquidation hits the Stability Pool, it is known as an **offset**: the debt of the Vault is offset against the BPD in the Pool. When **x** BPD debt is offset, the debt is cancelled, and **x** BPD in the Pool is burned. When the BPD Stability Pool is greater than the debt of the Vault, all the Vault's debt is cancelled, and all its RBTC is shared between depositors. This is a **pure offset**.

It can happen that the BPD in the Stability Pool is less than the debt of a Vault. In this case, the the whole Stability Pool will be used to offset a fraction of the Vault’s debt, and an equal fraction of the Vault’s RBTC collateral will be assigned to Stability Providers. The remainder of the Vault’s debt and RBTC gets redistributed to active Vaults. This is a **mixed offset and redistribution**.

Because the RBTC collateral fraction matches the offset debt fraction, the effective ICR of the collateral and debt that is offset, is equal to the ICR of the Vault. So, for depositors, the ROI per liquidation depends only on the ICR of the liquidated Vault.

### Stability Pool deposit losses and RBTC gains - implementation

Deposit functionality is handled by `StabilityPool.sol` (`provideToSP`, `withdrawFromSP`, etc).  StabilityPool also handles the liquidation calculation, and holds the BPD and RBTC balances.

When a liquidation is offset with the Stability Pool, debt from the liquidation is cancelled with an equal amount of BPD in the pool, which is burned. 

Individual deposits absorb the debt from the liquidated Vault in proportion to their deposit as a share of total deposits.
 
Similarly the liquidated Vault’s RBTC is assigned to depositors in the same proportion.

For example: a liquidation that empties 30% of the Stability Pool will reduce each deposit by 30%, no matter the size of the deposit.

### Stability Pool example

Here’s an example of the Stability Pool absorbing liquidations. The Stability Pool contains 3 depositors, A, B and C, and the RBTC:USD price is 100.

There are two Vaults to be liquidated, T1 and T2:

|   | Vault | Collateral (RBTC) | Debt (BPD) | ICR         | $(RBTC) ($) | Collateral surplus ($) |
|---|-------|------------------|-------------|-------------|------------|------------------------|
|   | T1    | 1.6              | 150         | 1.066666667 | 160        | 10                     |
|   | T2    | 2.45             | 225         | 1.088888889 | 245        | 20                     |

Here are the deposits, before any liquidations occur:

| Depositor | Deposit | Share  |
|-----------|---------|--------|
| A         | 100     | 0.1667 |
| B         | 200     | 0.3333 |
| C         | 300     | 0.5    |
| Total     | 600     | 1      |

Now, the first liquidation T1 is absorbed by the Pool: 150 debt is cancelled with 150 Pool BPD, and its 1.6 RBTC is split between depositors. We see the gains earned by A, B, C, are in proportion to their share of the total BPD in the Stability Pool:

| Deposit | Debt absorbed from T1 | Deposit after | Total RBTC gained | $(deposit + RBTC gain) ($) | Current ROI   |
|---------|-----------------------|---------------|------------------|---------------------------|---------------|
| A       | 25                    | 75            | 0.2666666667     | 101.6666667               | 0.01666666667 |
| B       | 50                    | 150           | 0.5333333333     | 203.3333333               | 0.01666666667 |
| C       | 75                    | 225           | 0.8              | 305                       | 0.01666666667 |
| Total   | 150                   | 450           | 1.6              | 610                       | 0.01666666667 |

And now the second liquidation, T2, occurs: 225 debt is cancelled with 225 Pool BPD, and 2.45 RBTC is split between depositors. The accumulated RBTC gain includes all RBTC gain from T1 and T2.

| Depositor | Debt absorbed from T2 | Deposit after | Accumulated RBTC | $(deposit + RBTC gain) ($) | Current ROI |
|-----------|-----------------------|---------------|-----------------|---------------------------|-------------|
| A         | 37.5                  | 37.5          | 0.675           | 105                       | 0.05        |
| B         | 75                    | 75            | 1.35            | 210                       | 0.05        |
| C         | 112.5                 | 112.5         | 2.025           | 315                       | 0.05        |
| Total     | 225                   | 225           | 4.05            | 630                       | 0.05        |

It’s clear that:

- Each depositor gets the same ROI from a given liquidation
- Depositors return increases over time, as the deposits absorb liquidations with a positive collateral surplus

Eventually, a deposit can be fully “used up” in absorbing debt, and reduced to 0. This happens whenever a liquidation occurs that empties the Stability Pool. A deposit stops earning RBTC gains when it has been reduced to 0.


### Stability Pool implementation

A depositor obtains their compounded deposits and corresponding RBTC gain in a “pull-based” manner. The system calculates the depositor’s compounded deposit and accumulated RBTC gain when the depositor makes an operation that changes their RBTC deposit.

Depositors deposit BPD via `provideToSP`, and withdraw with `withdrawFromSP`. Their accumulated RBTC gain is paid out every time they make a deposit operation - so RBTC payout is triggered by both deposit withdrawals and top-ups.

### How deposits and RBTC gains are tracked

We use a highly scalable mrbtcod of tracking deposits and RBTC gains that has O(1) complexity. 

When a liquidation occurs, rather than updating each depositor’s deposit and RBTC gain, we simply update two intermediate variables: a product `P`, and a sum `S`.

A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors’ compounded deposits and accumulated RBTC gains over time, as liquidations occur, using just these two variables. When depositors join the Pool, they get a snapshot of `P` and `S`.

The formula for a depositor’s accumulated RBTC gain is derived here:

[Scalable reward distribution for compounding, decreasing stake](https://github.com/Money Protocol/dev/blob/main/packages/contracts/mathProofs/Scalable%20Compounding%20Stability%20Pool%20Deposits.pdf)

Each liquidation updates `P` and `S`. After a series of liquidations, a compounded deposit and corresponding RBTC gain can be calculated using the initial deposit, the depositor’s snapshots, and the current values of `P` and `S`.

Any time a depositor updates their deposit (withdrawal, top-up) their RBTC gain is paid out, and they receive new snapshots of `P` and `S`.

This is similar in spirit to the simpler [Scalable Reward Distribution on the Bitcoineum Network by Bogdan Batog et al](http://batog.info/papers/scalable-reward-distribution.pdf), however, the mathematics is more involved as we handle a compounding, decreasing stake, and a corresponding RBTC reward.

## MP Issuance to Stability Providers

Stability Providers earn MP tokens continuously over time, in proportion to the size of their deposit. This is known as “Community Issuance”, and is handled by `CommunityIssuance.sol`.

Upon system deployment and activation, `CommunityIssuance` holds an initial MP supply, currently (provisionally) set at 32 million MP tokens.

Each Stability Pool deposit is tagged with a front end tag - the Bitcoineum address of the front end through which the deposit was made. Stability deposits made directly with the protocol (no front end) are tagged with the zero address.

When a deposit earns MP, it is split between the depositor, and the front end through which the deposit was made. Upon registering as a front end, a front end chooses a “kickback rate”: this is the percentage of MP earned by a tagged deposit, to allocate to the depositor. Thus, the total MP received by a depositor is the total MP earned by their deposit, multiplied by `kickbackRate`. The front end takes a cut of `1-kickbackRate` of the MP earned by the deposit.

### MP Issuance schedule

The overall community issuance schedule for MP is sub-linear and monotonic. We currently (provisionally) implement a yearly “halving” schedule, described by the cumulative issuance function:

`supplyCap * (1 - 0.5^t)`

where `t` is year and `supplyCap` is (provisionally) set to represent 32 million MP tokens.

It results in the following cumulative issuance schedule for the community MP supply:

| Year | Total community MP issued |
|------|-----------------------------|
| 0    | 0%                          |
| 1    | 50%                         |
| 2    | 75%                         |
| 3    | 87.5%                       |
| 4    | 93.75%                      |
| 5    | 96.88%                      |

The shape of the MP issuance curve is intended to incentivize both early depositors, and long-term deposits.

Although the MP issuance curve follows a yearly halving schedule, in practice the `CommunityIssuance` contract use time intervals of one minute, for more fine-grained reward calculations.

### MP Issuance implementation

The continuous time-based MP issuance is chunked into discrete reward events, that occur at every deposit change (new deposit, top-up, withdrawal), and every liquidation, before other state changes are made.

In a MP reward event, the MP to be issued is calculated based on time passed since the last reward event, `block.timestamp - lastMPIssuanceTime`, and the cumulative issuance function.

The MP produced in this issuance event is shared between depositors, in proportion to their deposit sizes.

To efficiently and accurately track MP gains for depositors and front ends as deposits decrease over time from liquidations, we re-use the [algorithm for rewards from a compounding, decreasing stake](https://github.com/Money Protocol/dev/blob/main/packages/contracts/mathProofs/Scalable%20Compounding%20Stability%20Pool%20Deposits.pdf). It is the same algorithm used for the RBTC gain from liquidations.

The same product `P` is used, and a sum `G` is used to track MP rewards, and each deposit gets a new snapshot of `P` and `G` when it is updated.

### Handling the front end MP gain

As mentioned in [MP Issuance to Stability Providers](#MP-issuance-to-stability-providers), in a MP reward event generating `MP_d` for a deposit `d` made through a front end with kickback rate `k`, the front end receives `(1-k) * MP_d` and the depositor receives `k * MP_d`.

The front end should earn a cut of MP gains for all deposits tagged with its front end.

Thus, we use a virtual stake for the front end, equal to the sum of all its tagged deposits. The front end’s accumulated MP gain is calculated in the same way as an individual deposit, using the product `P` and sum `G`.

Also, whenever one of the front end’s depositors tops or withdraws their deposit, the same change is applied to the front-end’s stake.

### MP reward events and payouts

When a deposit is changed (top-up, withdrawal):

- A MP reward event occurs, and `G` is updated
- Its RBTC and MP gains are paid out
- Its tagged front end’s MP gains are paid out to that front end
- The deposit is updated, with new snapshots of `P`, `S` and `G`
- The front end’s stake updated, with new snapshots of `P` and `G`

When a liquidation occurs:
- A MP reward event occurs, and `G` is updated

## MP issuance to Money Protocol providers

On deployment a new Uniswap pool will be created for the pair BPD/RBTC and a Staking rewards contract will be deployed. The contract is based on [RskSwapPool by Synthetix](https://github.com/Synthetixio/RskSwapPool/blob/master/contracts/RskSwapPool.sol). More information about their liquidity rewards program can be found in the [original SIP 31](https://sips.synthetix.io/sips/sip-31) and in [their blog](https://blog.synthetix.io/new-uniswap-srbtc-lp-reward-system/).

Essentially the way it works is:
- Liqudity providers add funds to the Uniswap pool, and get UNIv2 tokens in exchange
- Liqudity providers stake those UNIv2 tokens into RskSwapPool rewards contract
- Liqudity providers accrue rewards, proportional to the amount of staked tokens and staking time
- Liqudity providers can claim their rewards when they want
- Liqudity providers can unstake UNIv2 tokens to exit the program (i.e., stop earning rewards) when they want

Our implementation is simpler because funds for rewards will only be added once, on deployment of MP token (for more technical details about the differences, see PR #271 on our repo).

The amount of MP tokens that will be minted to rewards contract is 1.33M, and the duration of the program will be 30 days. If at some point the total amount of staked tokens is zero, the clock will be “stopped”, so the period will be extended by the time during which the staking pool is empty, in order to avoid getting MP tokens locked. That also means that the start time for the program will be the event that occurs first: either MP token contract is deployed, and therefore MP tokens are minted to RskSwapPool contract, or first liquidity provider stakes UNIv2 tokens into it.

## Money Protocol System Fees

Money Protocol generates fee revenue from certain operations. Fees are captured by the MP token.

A MP holder may stake their MP, and earn a share of all system fees, proportional to their share of the total MP staked.

Money Protocol generates revenue in two ways: redemptions, and issuance of new BPD tokens.

Redemptions fees are paid in RBTC. Issuance fees (when a user opens a Vault, or issues more BPD from their existing Vault) are paid in BPD.

### Redemption Fee

The redemption fee is taken as a cut of the total RBTC drawn from the system in a redemption. It is based on the current redemption rate.

In the `VaultManager`, `redeemCollateral` calculates the RBTC fee and transfers it to the staking contract, `MPStaking.sol`

### Issuance fee

The issuance fee is charged on the BPD drawn by the user and is added to the Vault's BPD debt. It is based on the current borrowing rate.

When new BPD are drawn via one of the `BorrowerOperations` functions `openVault`, `withdrawBPD` or `adjustVault`, an extra amount `BPDFee` is minted, and an equal amount of debt is added to the user’s Vault. The `BPDFee` is transferred to the staking contract, `MPStaking.sol`.

### Fee Schedule

Redemption and issuance fees are based on the `baseRate` state variable in VaultManager, which is dynamically updated. The `baseRate` increases with each redemption, and decays according to time passed since the last fee event - i.e. the last redemption or issuance of BPD.

The current fee schedule:

Upon each redemption:
- `baseRate` is decayed based on time passed since the last fee event
- `baseRate` is incremented by an amount proportional to the fraction of the total BPD supply that was redeemed
- The redemption rate is given by `min{REDEMPTION_FEE_FLOOR + baseRate * RBTCdrawn, DECIMAL_PRECISION}`

Upon each debt issuance:
- `baseRate` is decayed based on time passed since the last fee event
- The borrowing rate is given by `min{BORROWING_FEE_FLOOR + baseRate * newDebtIssued, MAX_BORROWING_FEE}`

`REDEMPTION_FEE_FLOOR` and `BORROWING_FEE_FLOOR` are both set to 0.5%, while `MAX_BORROWING_FEE` is 5% and `DECIMAL_PRECISION` is 100%.

### Intuition behind fees

The larger the redemption volume, the greater the fee percentage.

The longer the time delay since the last operation, the more the `baseRate` decreases.

The intent is to throttle large redemptions with higher fees, and to throttle borrowing directly after large redemption volumes. The `baseRate` decay over time ensures that the fee for both borrowers and redeemers will “cool down”, while redemptions volumes are low.

Furthermore, the fees cannot become smaller than 0.5%, which in the case of redemptions protects the redemption facility from being front-run by arbitrageurs that are faster than the price feed. The 5% maximum on the issuance is meant to keep the system (somewhat) attractive for new borrowers even in phases where the monetary is contracting due to redemptions.

### Fee decay Implementation

Time is measured in units of minutes. The `baseRate` decay is based on `block.timestamp - lastFeeOpTime`. If less than a minute has passed since the last fee event, then `lastFeeOpTime` is not updated. This prevents “base rate griefing”: i.e. it prevents an attacker stopping the `baseRate` from decaying by making a series of redemptions or issuing BPD with time intervals of < 1 minute.

The decay parameter is tuned such that the fee changes by a factor of 0.99 per hour, i.e. it loses 1% of its current value per hour. At that rate, after one week, the baseRate decays to 18% of its prior value. The exact decay parameter is subject to change, and will be fine-tuned via economic modelling.

### Staking MP and earning fees

MP holders may `stake` and `unstake` their MP in the `MPStaking.sol` contract. 

When a fee event occurs, the fee in BPD or RBTC is sent to the staking contract, and a reward-per-unit-staked sum (`F_RBTC`, or `F_BPD`) is incremented. A MP stake earns a share of the fee equal to its share of the total MP staked, at the instant the fee occurred.

This staking formula and implementation follows the basic [“Batog” pull-based reward distribution](http://batog.info/papers/scalable-reward-distribution.pdf).


## Redistributions and Corrected Stakes

When a liquidation occurs and the Stability Pool is empty or smaller than the liquidated debt, the redistribution mechanism should distribute the remaining collateral and debt of the liquidated Vault, to all active Vaults in the system, in proportion to their collateral.

For two Vaults A and B with collateral `A.coll > B.coll`, Vault A should earn a bigger share of the liquidated collateral and debt.

In Money Protocol it is important that all active Vaults remain ordered by their ICR. We have proven that redistribution of the liquidated debt and collateral proportional to active Vaults’ collateral, preserves the ordering of active Vaults by ICR, as liquidations occur over time.  Please see the [proofs section](https://github.com/Money Protocol/dev/tree/main/packages/contracts/mathProofs).

However, when it comes to implementation, Bitcoineum gas costs make it too expensive to loop over all Vaults and write new data to storage for each one. When a Vault receives redistribution rewards, the system does not update the Vault's collateral and debt properties - instead, the Vault’s rewards remain "pending" until the borrower's next operation.

These “pending rewards” can not be accounted for in future reward calculations in a scalable way.

However: the ICR of a Vault is always calculated as the ratio of its total collateral to its total debt. So, a Vault’s ICR calculation **does** include all its previous accumulated rewards.

**This causes a problem: redistributions proportional to initial collateral can break vault ordering.**

Consider the case where new Vault is created after all active Vaults have received a redistribution from a liquidation. This “fresh” Vault has then experienced fewer rewards than the older Vaults, and thus, it receives a disproportionate share of subsequent rewards, relative to its total collateral.

The fresh vault would earns rewards based on its **entire** collateral, whereas old Vaults would earn rewards based only on **some portion** of their collateral - since a part of their collateral is pending, and not included in the Vault’s `coll` property.

This can break the ordering of Vaults by ICR - see the [proofs section](https://github.com/Money Protocol/dev/tree/main/packages/contracts/mathProofs).

### Corrected Stake Solution

We use a corrected stake to account for this discrepancy, and ensure that newer Vaults earn the same liquidation rewards per unit of total collateral, as do older Vaults with pending rewards. Thus the corrected stake ensures the sorted list remains ordered by ICR, as liquidation events occur over time.

When a Vault is opened, its stake is calculated based on its collateral, and snapshots of the entire system collateral and debt which were taken immediately after the last liquidation.

A Vault’s stake is given by:

```
stake = _coll.mul(totalStakesSnapshot).div(totalCollateralSnapshot)
```

It then earns redistribution rewards based on this corrected stake. A newly opened Vault’s stake will be less than its raw collateral, if the system contains active Vaults with pending redistribution rewards when it was made.

Whenever a borrower adjusts their Vault’s collateral, their pending rewards are applied, and a fresh corrected stake is computed.

To convince yourself this corrected stake preserves ordering of active Vaults by ICR, please see the [proofs section](https://github.com/Money Protocol/dev/blob/main/papers).

## Math Proofs

The Money Protocol implementation relies on some important system properties and mathematical derivations.

In particular, we have:

- Proofs that Vault ordering is maintained throughout a series of liquidations and new Vault openings
- A derivation of a formula and implementation for a highly scalable (O(1) complexity) reward distribution in the Stability Pool, involving compounding and decreasing stakes.

PDFs of these can be found in https://github.com/Money Protocol/dev/blob/main/papers

## Definitions

_**Vault:**_ a collateralized debt position, bound to a single Bitcoineum address. Also referred to as a “CDP” in similar protocols.

_**BPD**_:  The stablecoin that may be issued from a user's collateralized debt position and freely transferred/traded to any Bitcoineum address. Intended to maintain parity with the US dollar, and can always be redeemed directly with the system: 1 BPD is always exchangeable for $1 USD worth of RBTC.

_**Active Vault:**_ an Bitcoineum address owns an “active Vault” if there is a node in the `SortedVaults` list with ID equal to the address, and non-zero collateral is recorded on the Vault struct for that address.

_**Closed Vault:**_ a Vault that was once active, but now has zero debt and zero collateral recorded on its struct, and there is no node in the `SortedVaults` list with ID equal to the owning address.

_**Active collateral:**_ the amount of RBTC collateral recorded on a Vault’s struct

_**Active debt:**_ the amount of BPD debt recorded on a Vault’s struct

_**Entire collateral:**_ the sum of a Vault’s active collateral plus its pending collateral rewards accumulated from distributions

_**Entire debt:**_ the sum of a Vault’s active debt plus its pending debt rewards accumulated from distributions

_**Individual collateralization ratio (ICR):**_ a Vault's ICR is the ratio of the dollar value of its entire collateral at the current RBTC:USD price, to its entire debt

_**Nominal collateralization ratio (nominal ICR, NICR):**_ a Vault's nominal ICR is its entire collateral (in RBTC) multiplied by 100e18 and divided by its entire debt.

_**Total active collateral:**_ the sum of active collateral over all Vaults. Equal to the RBTC in the ActivePool.

_**Total active debt:**_ the sum of active debt over all Vaults. Equal to the BPD in the ActivePool.

_**Total defaulted collateral:**_ the total RBTC collateral in the DefaultPool

_**Total defaulted debt:**_ the total BPD debt in the DefaultPool

_**Entire system collateral:**_ the sum of the collateral in the ActivePool and DefaultPool

_**Entire system debt:**_ the sum of the debt in the ActivePool and DefaultPool

_**Total collateralization ratio (TCR):**_ the ratio of the dollar value of the entire system collateral at the current RBTC:USD price, to the entire system debt

_**Critical collateralization ratio (CCR):**_ 150%. When the TCR is below the CCR, the system enters Recovery Mode.

_**Borrower:**_ an externally owned account or contract that locks collateral in a Vault and issues BPD tokens to their own address. They “borrow” BPD tokens against their RBTC collateral.

_**Depositor:**_ an externally owned account or contract that has assigned BPD tokens to the Stability Pool, in order to earn returns from liquidations, and receive MP token issuance.

_**Redemption:**_ the act of swapping BPD tokens with the system, in return for an equivalent value of RBTC. Any account with a BPD token balance may redeem them, whBitcoin or not they are a borrower.

When BPD is redeemed for RBTC, the RBTC is always withdrawn from the lowest collateral Vaults, in ascending order of their collateralization ratio. A redeemer can not selectively target Vaults with which to swap BPD for RBTC.

_**Repayment:**_ when a borrower sends BPD tokens to their own Vault, reducing their debt, and increasing their collateralization ratio.

_**Retrieval:**_ when a borrower with an active Vault withdraws some or all of their RBTC collateral from their own vault, either reducing their collateralization ratio, or closing their Vault (if they have zero debt and withdraw all their RBTC)

_**Liquidation:**_ the act of force-closing an undercollateralized Vault and redistributing its collateral and debt. When the Stability Pool is sufficiently large, the liquidated debt is offset with the Stability Pool, and the RBTC distributed to depositors. If the liquidated debt can not be offset with the Pool, the system redistributes the liquidated collateral and debt directly to the active Vaults with >110% collateralization ratio.

Liquidation functionality is permissionless and publically available - anyone may liquidate an undercollateralized Vault, or batch liquidate Vaults in ascending order of collateralization ratio.

_**Collateral Surplus**_: The difference between the dollar value of a Vault's RBTC collateral, and the dollar value of its BPD debt. In a full liquidation, this is the net gain earned by the recipients of the liquidation.

_**Offset:**_ cancellation of liquidated debt with BPD in the Stability Pool, and assignment of liquidated collateral to Stability Pool depositors, in proportion to their deposit.

_**Redistribution:**_ assignment of liquidated debt and collateral directly to active Vaults, in proportion to their collateral.

_**Pure offset:**_  when a Vault's debt is entirely cancelled with BPD in the Stability Pool, and all of it's liquidated RBTC collateral is assigned to Stability Providers.

_**Mixed offset and redistribution:**_  When the Stability Pool BPD only covers a fraction of the liquidated Vault's debt.  This fraction of debt is cancelled with BPD in the Stability Pool, and an equal fraction of the Vault's collateral is assigned to depositors. The remaining collateral & debt is redistributed directly to active Vaults.

_**Gas compensation:**_ A refund, in BPD and RBTC, automatically paid to the caller of a liquidation function, intended to at least cover the gas cost of the transaction. Designed to ensure that liquidators are not dissuaded by potentially high gas costs.

## Development

The Money Protocol monorepo is based on Yarn's [workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) feature. You might be able to install some of the packages individually with npm, but to make all interdependent packages see each other, you'll need to use Yarn.

In addition, some package scripts require Docker to be installed (Docker Desktop on Windows and Mac, Docker Engine on Linux).

### Prerequisites

You'll need to install the following:

- [Git](https://help.github.com/en/github/getting-started-with-github/set-up-git) (of course)
- [Node v12.x](https://nodejs.org/dist/latest-v12.x/)
- [Docker](https://docs.docker.com/get-docker/)
- [Yarn](https://classic.yarnpkg.com/en/docs/install)

#### Making node-gyp work

Money Protocol indirectly depends on some packages with native addons. To make sure these can be built, you'll have to take some additional steps. Refer to the subsection of [Installation](https://github.com/nodejs/node-gyp#installation) in node-gyp's README that corresponds to your operating system.

Note: you can skip the manual installation of node-gyp itself (`npm install -g node-gyp`), but you will need to install its prerequisites to make sure Money Protocol can be installed.

### Clone & Install

```
git clone https://github.com/Money Protocol/dev.git Money Protocol
cd Money Protocol
yarn
```

### Top-level scripts

There are a number of scripts in the top-level package.json file to ease development, which you can run with yarn.

#### Run all tests

```
yarn test
```

#### Deploy contracts to a testnet

E.g.:

```
yarn deploy --network ropsten
```

Supported networks are currently: ropsten, kovan, rinkeby, goerli. The above command will deploy into the default channel (the one that's used by the public dev-frontend). To deploy into the internal channel instead:

```
yarn deploy --network ropsten --channel internal
```

You can optionally specify an explicit gas price too:

```
yarn deploy --network ropsten --gas-price 20
```

After a successful deployment, the addresses of the newly deployed contracts will be written to a version-controlled JSON file under `packages/lib/deployments/default`.

To publish a new deployment, you must execute the above command for all of the following combinations:

| Network | Channel  |
| ------- | -------- |
| ropsten | default  |
| ropsten | internal |
| kovan   | default  |
| rinkeby | default  |
| goerli  | default  |

At some point in the future, we will make this process automatic. Once you're done deploying to all the networks, execute the following command:

```
yarn save-live-version
```

This copies the contract artifacts to a version controlled area (`packages/lib/live`) then checks that you really did deploy to all the networks. Next you need to commit and push all changed files. The repo's GitHub workflow will then build a new Docker image of the frontend interfacing with the new addresses.

#### Start a local blockchain and deploy the contracts

```
yarn start-dev-chain
```

Starts an openBitcoineum node in a Docker container, running the [private development chain](https://openBitcoineum.github.io/wiki/Private-development-chain), then deploys the contracts to this chain.

You may want to use this before starting the dev-frontend in development mode. To use the newly deployed contracts, switch MetaMask to the built-in "Localhost 8545" network.

> Q: How can I get Bitcoin on the local blockchain?  
> A: Import this private key into MetaMask:  
> `0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7`  
> This account has all the Bitcoin you'll ever need.

Once you no longer need the local node, stop it with:

```
yarn stop-dev-chain
```

#### Start dev-frontend in development mode

```
yarn start-dev-frontend
```

This will start dev-frontend in development mode on http://localhost:3000. The app will automatically be reloaded if you change a source file under `packages/dev-frontend`.

If you make changes to a different package under `packages`, it is recommended to rebuild the entire project with `yarn prepare` in the root directory of the repo. This makes sure that a change in one package doesn't break another.

To stop the dev-frontend running in this mode, bring up the terminal in which you've started the command and press Ctrl+C.

#### Start dev-frontend in demo mode

This will automatically start the local blockchain, so you need to make sure that's not already running before you run the following command.

```
yarn start-demo
```

This spawns a modified version of dev-frontend that ignores MetaMask, and directly uses the local blockchain node. Every time the page is reloaded (at http://localhost:3000), a new random account is created with a balance of 100 RBTC. Additionally, transactions are automatically signed, so you no longer need to accept wallet confirmations. This lets you play around with Money Protocol more freely.

When you no longer need the demo mode, press Ctrl+C in the terminal then run:

```
yarn stop-demo
```

#### Build dev-frontend for production

In a freshly cloned & installed monorepo, or if you have only modified code inside the dev-frontend package:

```
yarn build
```

If you have changed somrbtcing in one or more packages apart from dev-frontend, it's best to use:

```
yarn rebuild
```

This combines the top-level `prepare` and `build` scripts.


## Disclaimer

The content of this readme document (“Readme”) is of purely informational nature. In particular, none of the content of the Readme shall be understood as advice provided by Money Protocol AG, any Money Protocol Project Team member or other contributor to the Readme, nor does any of these persons warrant the actuality and accuracy of the Readme.

Please read this Disclaimer carefully before accessing, interacting with, or using the Money Protocol Protocol software, consisting of the Money Protocol Protocol technology stack (in particular its smart contracts) as well as any other Money Protocol technology such as e.g., the launch kit for frontend operators (togBitcoin the “Money Protocol Protocol Software”). 

While Money Protocol AG developed the Money Protocol Protocol Software, the Money Protocol Protocol Software runs in a fully decentralized and autonomous manner on the Bitcoineum network. Money Protocol AG is not involved in the operation of the Money Protocol Protocol Software nor has it any control over transactions made using its smart contracts. Further, Money Protocol AG does neither enter into any relationship with users of the Money Protocol Protocol Software and/or frontend operators, nor does it operate an own frontend. Any and all functionalities of the Money Protocol Protocol Software, including the BPD and the MP, are of purely technical nature and there is no claim towards any private individual or legal entity in this regard.

Money Protocol AG IS NOT LIABLE TO ANY USER FOR DAMAGES, INCLUDING ANY GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE, IN CONNECTION WITH THE USE OR INABILITY TO USE THE Money Protocol PROTOCOL SOFTWARE (INCLUDING BUT NOT LIMITED TO LOSS OF RBTC, BPD OR MP, NON-ALLOCATION OF TECHNICAL FEES TO MP HOLDERS, LOSS OF DATA, BUSINESS INTERRUPTION, DATA BEING RENDERED INACCURATE OR OTHER LOSSES SUSTAINED BY A USER OR THIRD PARTIES AS A RESULT OF THE Money Protocol PROTOCOL SOFTWARE AND/OR ANY ACTIVITY OF A FRONTEND OPERATOR OR A FAILURE OF THE Money Protocol PROTOCOL SOFTWARE TO OPERATE WITH ANY OTHER SOFTWARE).

The Money Protocol Protocol Software has been developed and published under the GNU GPL v3 open-source license, which forms an integral part of this disclaimer. 

THE Money Protocol PROTOCOL SOFTWARE HAS BEEN PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. THE Money Protocol PROTOCOL SOFTWARE IS HIGHLY EXPERIMENTAL AND ANY REAL RBTC AND/OR BPD AND/OR MP SENT, STAKED OR DEPOSITED TO THE Money Protocol PROTOCOL SOFTWARE ARE AT RISK OF BEING LOST INDEFINITELY, WITHOUT ANY KIND OF CONSIDERATION.

There are no official frontend operators, and the use of any frontend is made by users at their own risk. To assess the trustworthiness of a frontend operator lies in the sole responsibility of the users and must be made carefully.

User is solely responsible for complying with applicable law when interacting (in particular, when using RBTC, BPD, MP or other Token) with the Money Protocol Protocol Software whatsoever. 
