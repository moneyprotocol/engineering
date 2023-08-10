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

The following outlines the liquidation process for an individual Vault in both Normal Mode and Recovery Mode. In the provided explanation, 'SP.BPD' denotes the amount of BPD tokens present in the Stability Pool.

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
4. Money Protocol admin deploys `MPToken`, which upon deployment:
- Stores the `CommunityIssuance` and `LockupContractFactory` addresses
- Mints MP tokens to `CommunityIssuance`, the Money Protocol admin address, and the bug bounty address
5. Money Protocol admin sets `MPToken` address in `LockupContractFactory`, `CommunityIssuance`, and `MPStaking`.

#### Deploy and fund Lockup Contracts
6. Money Protocol admin instructs the `LockupContractFactory` to create a `LockupContract` for each beneficiary, with an `unlockTime` scheduled precisely one year after the system's deployment.
7. Money Protocol admin allocates and transfers MP tokens to each respective `LockupContract` in accordance with the entitlement of the beneficiaries.

#### Deploy Money Protocol Core
8. The Money Protocol admin launches the core system of Money Protocol.
9. The Money Protocol admin establishes internal connections within the Money Protocol core system using setters.
10. The Money Protocol admin links `MPStaking` to the Money Protocol core contracts and `MPToken`.
11. The Money Protocol admin establishes connections between `CommunityIssuance` and the Money Protocol core contracts and `MPToken`.

#### During one year lockup period
- The Money Protocol admin routinely transfers recently vested tokens to the `LockupContracts` of team members and partners, adhering to their respective vesting schedules.
- Money Protocol admin can only transfer MP tokens to `LockupContracts`.
- Any individual has the capability to deploy new `LockupContracts` using the Factory, setting an `unlockTime` that is equal to or greater than one year from the system's deployment.

#### Upon end of one year lockup period
- Each beneficiary is entitled to withdraw their complete share.
- The MP transfer restriction on the Money Protocol admin address is automatically lifted, granting the Money Protocol admin the ability to transfer MP tokens to any address.
- Any individual can deploy new `LockupContracts` through the Factory, specifying any future `unlockTime` they desire.

#### Post-lockup period
- The Money Protocol admin regularly transfers recently vested tokens to team members and partners. These transfers are made either directly to their individual addresses or to a new lockup contract if necessary.

## Core System Architecture

The core Money Protocol system comprises several smart contracts, deployable to the RSK blockchain.

All application logic and data are encompassed within these contracts, eliminating the need for a separate database or backend logic on a web server. Consequently, the RSK network itself serves as the Money Protocol backend, making all balances and contract data publicly accessible.

**The system operates without an admin key or human governance. Once deployed, it operates in a fully automated and decentralized manner, with no user possessing any special privileges or control over the system.**

The primary contracts - `BorrowerOperations.sol`, `VaultManager.sol`, and `StabilityPool.sol` - host the user-facing public functions and contain most of the internal system logic. These contracts govern Vault state updates and facilitate the movement of Bitcoin and BPD tokens throughout the system.

### Core Smart Contracts

`BorrowerOperations.sol` encompasses the fundamental operations that borrowers engage in with their Vault. These operations include Vault creation, RBTC top-up and withdrawal, stablecoin issuance, and repayment. Additionally, the contract sends issuance fees to the `MPStaking` contract. To update Vault state as needed, the functions within `BorrowerOperations.sol` interact with the VaultManager. Moreover, these functions also communicate with various Pools, directing the movement of Bitcoin and tokens between Pools or between the Pool and the user when required.

`VaultManager.sol` comprises functionalities related to liquidations and redemptions. The contract also sends redemption fees to the `MPStaking` contract. It serves as a repository for each Vault's state, keeping a record of the Vault's collateral and debt. However, the `VaultManager` itself does not hold any value, such as Bitcoin or other tokens. Instead, its functions interact with various Pools, directing the movement of Bitcoin and tokens between Pools when necessary.

`MoneypBase.sol` - Both VaultManager and BorrowerOperations derive from the parent contract MoneypBase, which encompasses global constants and several shared functions.

`StabilityPool.sol` - The contract contains functionalities related to Stability Pool operations, allowing users to make deposits and withdraw compounded deposits, along with the accumulated RBTC and MP gains. It manages the BPD Stability Pool deposits as well as the RBTC gains acquired by depositors through liquidations.

`BPDToken.sol` - The stablecoin token contract is designed to adhere to the ERC20 fungible token standard and incorporates EIP-2612. It includes a mechanism that prevents accidental transfers to addresses like the StabilityPool and address(0), which are not intended to receive funds through direct transfers. The contract handles the minting, burning, and transferring of BPD tokens.

`SortedVaults.sol` - The system employs a doubly linked list to store addresses of Vault owners, arranged in order according to their individual collateralization ratio (ICR). It efficiently inserts and re-inserts Vaults at the appropriate position within the list based on their ICR.

`PriceFeed.sol` - The contract includes functionalities to fetch the current RBTC:USD price, which is essential for the system to calculate collateralization ratios accurately.

`HintHelpers.sol` - The Helper contract provides read-only functionalities for accurately calculating hints to be used in borrower operations and redemptions.

### Data and Value Silo Contracts

Together with `StabilityPool.sol`, these contracts are responsible for holding Bitcoin or tokens specific to their respective components of the system, and they possess minimal logic.

`ActivePool.sol` - This contract maintains the total Bitcoin balance and keeps a record of the overall stablecoin debt from active Vaults.

`DefaultPool.sol` - This contract manages the total Bitcoin balance and keeps a record of the total stablecoin debt from liquidated Vaults that are awaiting redistribution to active Vaults. If a Vault has pending Bitcoin or debt "rewards" in the DefaultPool, these rewards will be utilized when the Vault undergoes a borrower operation, a redemption, or a liquidation in the future.

`CollSurplusPool.sol` - This contract retains the RBTC surplus from Vaults that have been completely redeemed and Vaults with an ICR greater than the minimum collateralization ratio (MCR) that were liquidated during Recovery Mode. When instructed by `BorrowerOperations.sol`, the contract sends the surplus back to the respective borrower.

`GasPool.sol` - This contract stores the overall BPD liquidation reserves. When a Vault is opened, BPD is transferred to the `GasPool`, and it is moved out when a Vault undergoes liquidation or closure.

### Contract Interfaces

`IVaultManager.sol`, `IPool.sol`, etc., serve as specifications for a contract's functions without actual implementation. 

### PriceFeed and Oracle

Money Protocol functions that rely on the most up-to-date RBTC:USD price data dynamically fetch the price as required through the core `PriceFeed.sol` contract. The `PriceFeed.sol` contract employs the Money On Chain RBTC:USD reference contract as its primary data source and the RSK RBTC:USD price feed as its secondary (fallback) data source. This contract is stateful, meaning it records the last valid price, which could come from either of the two sources, based on its current state.

The current `PriceFeed.sol` contract includes an external `fetchPrice()` function that is invoked by core Money Protocol functions that necessitate the current RBTC:USD price.

### Testnet PriceFeed and PriceFeed tests

The `PriceFeedTestnet.sol` serves as a simulated PriceFeed designed for testnet and general backend testing, and it does not have an oracle connection. It includes a manual price setter, `setPrice()`, and a getter, `getPrice()`, which returns the most recent stored price.

### PriceFeed limitations and known issues

The PriceFeed is designed to provide resilience in situations where there is a failure or timeout with the MoC Medianizer, along with the possibility of recovery.

The PriceFeed's logic incorporates automated on-chain decision-making to fetch fallback price data from the RSK Oracle and, whenever feasible, to revert to the MoC Medianizer upon its recovery.

### Keeping a sorted list of Vaults ordered by ICR

Money Protocol relies on a specific data structure: a sorted doubly-linked list of Vaults, maintained in order of individual collateralization ratio (ICR) – calculated as the ratio of collateral (in USD) to debt (in BPD).

This ordered list plays a crucial role in enabling gas-efficient redemption sequences and the `liquidateVaults` process, both of which target Vaults in ascending order of ICR.

The implementation of this sorted doubly-linked list is found in `SortedVaults.sol`.

Each node within this list corresponds to an active Vault in the system, with the node's ID property being the address of the Vault owner. For efficient O(1) insertion, the list accepts positional hints - more details can be found [hints](#supplying-hints-to-cdp-operations) section.

Dynamic runtime computation is used to calculate ICRs, and these values are not stored on the node. This is because the ICRs of active Vaults change dynamically when:

The RBTC:USD price fluctuates, influencing the USD value of the collateral in each Vault
A liquidation occurs, which redistributes collateral and debt among active Vaults
The list relies on the property that a redistribution of collateral and debt due to a liquidation preserves the ordering of all active Vaults, although it does reduce the ICR of each active Vault above the MCR.

While the maintenance of ordering during redistributions may not be immediately evident, you can refer to the [mathematical proof](https://github.com/Money Protocol/dev/blob/main/papers) demonstrating this property in Money Protocol.

A node inserted based on the current ICR will retain its correct position relative to its peers, as long as its raw collateral and debt remain unchanged while liquidation gains accumulate.

Nodes also remain sorted as the RBTC:USD price fluctuates, as these variations uniformly affect the collateral value of each Vault.

Consequently, nodes need only be re-inserted into the sorted list when a Vault operation occurs, such as when the owner adds or removes collateral or debt to their position.

### Flow of Bitcoin in Money Protocol

Bitcoin within the system is distributed among three Pools: the ActivePool, the DefaultPool, and the StabilityPool. During any operation, Bitcoin is transferred in one of the following three ways:

- From a user to a Pool
- From a Pool to a user
- From one Pool to another Pool

Bitcoin is accounted for on an _individual_ level but stored _collectively_ in a Pool. For example, an active Vault containing collateral and debt maintains a struct in the VaultManager, recording its Bitcoin collateral value as a uint, but the actual Bitcoin resides in the balance of the ActivePool contract.

Similarly, the StabilityPool aggregates the total accumulated RBTC gains from liquidations for all depositors.

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

When a user issues debt from their Vault, BPD tokens are created and sent to their own address, while the corresponding debt is recorded on the Vault. On the contrary, when they repay their Vault's BPD debt, BPD tokens are burned from their address, reducing the debt associated with their Vault.

Redemptions entail burning BPD tokens from the redeemer's balance, subsequently reducing the debt of the redeemed Vault.

During liquidations involving a Stability Pool offset, BPD tokens are burned from the Stability Pool's balance, thereby reducing the BPD debt of the liquidated Vault.

The only instance when BPD tokens are transferred to or from a Money Protocol contract occurs when a user deposits or withdraws BPD to/from the StabilityPool.

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

Stability Providers and Frontend Operators receive MP gains based on their portion of the total BPD deposits and the MP community issuance schedule. Once acquired, MP can be staked and unstaked using the `MPStaking` contract.

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

In general, borrowers utilize functions to initiate Vault operations on their own Vaults. Stability Pool users, who may or may not be borrowers as well, employ functions to trigger Stability Pool operations, such as depositing or withdrawing tokens from the Stability Pool.

The public liquidation functions are open to anyone, enabling them to attempt liquidation of one or multiple Vaults.

BPD token holders also have the option to redeem their tokens, exchanging them at a 1-for-1 value (minus fees) with Bitcoin.

MP token holders can stake their MP to earn a portion of the system fee revenue, distributed in RBTC and BPD.

## Contract Ownership and Function Permissions

Each of the core smart contracts derives from the OpenZeppelin `Ownable.sol` contract template. Consequently, all contracts have a sole owning address, which corresponds to the deploying address. The ownership of the contract is renounced either upon deployment or right after its address setter has been invoked to connect it with the rest of the core Money Protocol system.

Several public and external functions include modifiers like `requireCallerIsVaultManager`, `requireCallerIsActivePool`, etc., ensuring that they can solely be accessed by the permitted contract with the appropriate authorization.

## Deployment to a Development Blockchain

The Hardhat migrations script and the deployment helpers in `utils/deploymentHelpers.js` handle the deployment of all contracts and establish connections between them by setting the required deployed addresses.

The project is deployed on the RSK testnet.

## Running Tests

Run all tests with `npx hardhat test`, or run a specific test with `npx hardhat test ./test/contractTest.js`

Tests are run against the Hardhat EVM.

### RSK Regtest Node

Add the local node as a `live` network at `~/.brownie/network-config.yaml`:
```
(...)
      - name: Local RSK
        chainid: 31
        id: rsk-testnet
        host: http://localhost:8545
```

Make sure state is cleaned up first:
```
rm -Rf build/deployments/*
```

Start RSK node from this repo’s root with:
```
yarn start-dev-chain:rsk
```

Then, again from `packages/contracts/`, run it with:
```
brownie test -s --network rsk-testnet
```

To stop the RSK node, you can do it with:
```
yarn stop-dev-chain
```

## System Quantities - Units and Representation

### Integer representations of decimals

Various ratios and the RBTC:USD price are represented as integers with decimal precision extended to 18 digits. For instance:

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

Any data structures marked with the 'public' visibility specifier are automatically 'gettable', as the compiler generates the corresponding getters. To retrieve the MCR, for example, you can simply call `VaultManager::MCR()`, etc.

## Public User-Facing Functions

### Borrower (Vault) Operations - `BorrowerOperations.sol`

`openVault(uint _maxFeePercentage, uint _BPDAmount, address _upperHint, address _lowerHint)` is a payable function that enables the caller to create a Vault with the desired debt and Bitcoin provided as collateral. Its successful execution primarily depends on the resulting collateralization ratio, which must exceed the minimum requirement (110% in Normal Mode, 150% in Recovery Mode).

In addition to the requested debt, extra debt is issued to cover the issuance fee and gas compensation. The borrower is required to specify a _maxFeePercentage indicating the maximum fee slippage they are willing to accept. This comes into play when a redemption transaction is processed first, potentially driving up the issuance fee.

The payable function `addColl(address _upperHint, address _lowerHint)` allows the caller to add the received Bitcoin to their active Vault.

The function `withdrawColl(uint _amount, address _upperHint, address _lowerHint)` enables the caller to withdraw the specified `_amount` of collateral from their Vault. The withdrawal can be executed if the user has an active Vault, and it does not cause the Vault's collateralization ratio to fall below the minimum requirement. Additionally, the withdrawal is allowed only if the resulting total collateralization ratio of the system remains above 150%. 

The function `withdrawBPD(uint _maxFeePercentage, uint _BPDAmount, address _upperHint, address _lowerHint)` allows the caller to issue a specified _amount of BPD from their Vault. This operation is only executed if the Vault's collateralization ratio would still meet the minimum requirement and the resulting total collateralization ratio remains above 150%.

To account for potential fee slippage, the borrower must provide a `_maxFeePercentage` indicating the maximum fee deviation they are willing to accept. This comes into play if a redemption transaction is processed first, potentially leading to an increase in the issuance fee.

The function `repayBPD(uint _amount, address _upperHint, address _lowerHint)` enables the caller to repay a specified `_amount` of BPD to their Vault, with the condition that 200 debt must remain in the Vault. This 50 debt corresponds to the 200 BPD gas compensation.

The function `_adjustVault(address _borrower, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFeePercentage)` allows a borrower to modify both their collateral and debt simultaneously. However, specific restrictions apply to each quantity's individual increases or decreases. Notably, if the adjustment reduces the Vault's collateralization ratio, the function is only executed when the resulting total collateralization ratio remains above 150%.

To account for potential fee slippage, the borrower must provide a `_maxFeePercentage` indicating the maximum fee deviation they are willing to accept. This comes into play if a redemption transaction is processed first, potentially leading to an increase in the issuance fee. The `_maxFeePercentage` parameter is disregarded if the debt is not increased in the transaction.

The function `closeVault()` permits a borrower to completely repay their debt, withdraw all the collateral, and close their Vault. To execute this function, the borrower must have a sufficient BPD balance to repay their vault's debt, excluding the 200 BPD gas compensation, which amounts to `(debt - 200)` BPD.

The function `claimCollateral(address _user)` enables a borrower to claim their RBTC collateral surplus from the system under specific circumstances. This can occur when the borrower's Vault has been fully redeemed and closed or liquidated in Recovery Mode with a collateralization ratio above 110%.

The collateral surplus that the borrower can claim is calculated based on the difference between the collateral and the debt upon redemption or the difference between the collateral and 110% of the debt upon liquidation.

### VaultManager Functions - `VaultManager.sol`

The function `liquidate(address _borrower)` is accessible to anyone and aims to liquidate the Vault belonging to `_user`. The execution is successful if `_user`'s Vault satisfies the conditions for liquidation, such as in Normal Mode, where it liquidates if the Vault's ICR is below the system MCR.  

The function `liquidateVaults(uint n)` is open to all users and serves to identify under-collateralized Vaults below the MCR. It then initiates the liquidation process for up to `n` such Vaults, starting with the one having the lowest collateralization ratio. The number of liquidated Vaults is subject to gas limitations and the actual count of under-collateralized Vaults.

The gas costs associated with `liquidateVaults(uint n)` primarily depend on the number of Vaults that undergo liquidation and whether these Vaults are offset against the Stability Pool or redistributed.

The function `batchLiquidateVaults(address[] calldata _vaultArray)` is available to all users and allows them to provide a personalized list of Vault addresses as an argument. The function then proceeds to attempt the liquidation of each Vault in the given list, stopping when it reaches the end or when it runs out of gas. Only Vaults that meet the conditions for liquidation are processed.

The function `redeemCollateral(uint _BPDAmount, address _firstRedemptionHint, address _upperPartialRedemptionHint, address _lowerPartialRedemptionHint, uint _partialRedemptionHintNICR, uint _maxIterations, uint _maxFeePercentage)` allows the caller to redeem `_BPDAmount` worth of stablecoins for Bitcoin from the system. The redemption results in a reduction of the caller's BPD balance, and they will receive the corresponding amount of RBTC.

The redemption execution is successful if the caller possesses sufficient BPD tokens to redeem. The number of Vaults that can be redeemed from is limited by `_maxIterations`. Additionally, the borrower is required to specify a `_maxFeePercentage` to indicate their willingness to accept a fee slippage in case another redemption transaction is processed first, leading to an increase in the redemption fee.

The function `getCurrentICR(address _user, uint _price)` calculates the individual collateralization ratio (ICR) for the given user, considering their total collateral and total BPD debt. If the user has no debt (i.e., debt equals 0), the function returns the value 2^256 - 1.

`getVaultOwnersCount()`: get the number of active Vaults in the system.

`getPendingRBTCReward(address _borrower)` retrieves the RBTC reward pending from liquidation redistribution events for the specified Vault.

`getPendingBPDDebtReward(address _borrower)` retrieves the pending "reward" for the Vault's debt (i.e. the additional debt assigned to the Vault) from liquidation redistribution events.

`getEntireDebtAndColl(address _borrower)` provides the complete debt and collateral of a Vault, encompassing any pending debt rewards and RBTC rewards resulting from previous redistributions.

`getEntireSystemColl()` retrieves the total collateral allocated to Vaults within the system, comprising the combined RBTC holdings in the Active Pool and the Default Pool.

`getEntireSystemDebt()` retrieves the overall debt allocated to Vaults within the system, encompassing the combined BPDDebt in both the Active Pool and the Default Pool.

`getTCR()` retrieves the total collateralization ratio (TCR) of the system, which takes into account the entire system debt and collateral, including any pending rewards.

`checkRecoveryMode()` indicates whether the system is currently in Recovery Mode, which means that the Total Collateralization Ratio (TCR) is below the Critical Collateralization Ratio (CCR).

### Hint Helper Functions - `HintHelpers.sol`

`function getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)`: This helper function provides a positional hint for the sorted list, aiding transactions that need to efficiently re-insert a Vault to the list.

`getRedemptionHints(uint _BPDamount, uint _price, uint _maxIterations)`: This is a helper function designed specifically for redemptions. It returns three hints:

- `firstRedemptionHint`: A positional hint for the first redeemable Vault, which is the Vault with the lowest ICR >= MCR.
- `partialRedemptionHintNICR`: The final nominal ICR of the last Vault after being impacted by partial redemption, or zero if no partial redemption occurs (see [Hints for `redeemCollateral`](#hints-for-redeemcollateral)).
- `truncatedBPDamount`: The maximum amount that can be redeemed out of the provided `_BPDamount`. This value may be lower than `_BPDamount` if redeeming the full amount would leave the last Vault of the redemption sequence with less debt than the minimum allowed value.

The number of Vaults considered for redemption can be limited by providing a non-zero value for `_maxIterations`, while passing zero leaves it uncapped.

### Stability Pool Functions - `StabilityPool.sol`

`provideToSP(uint _amount, address _frontEndTag)`: This function enables stablecoin holders to deposit _amount of BPD into the Stability Pool. It transfers `_amount` of BPD from their address to the Pool, and increases both their BPD deposit and their tagged front end’s stake by `_amount`. If the depositor already has a non-zero deposit, it transfers their accumulated RBTC and MP gains to their address, and distributes their front end’s MP gain to their front end.

`withdrawFromSP(uint _amount)`: This function enables a stablecoin holder to withdraw `_amount` of BPD from the Stability Pool, up to the value of their remaining Stability deposit. It reduces their BPD balance by `_amount` and decreases their front end’s stake by `_amount`. It transfers the depositor’s accumulated RBTC and MP gains to their address, and distributes their front end’s MP gain to their front end. If the user makes a partial withdrawal, their remaining deposit will continue to earn further gains. To prevent potential loss evasion by depositors, withdrawals from the Stability Pool are temporarily suspended when there are liquidable Vaults with ICR < 110% in the system.

`withdrawRBTCGainToVault(address _hint)`: This function transfers the user's entire accumulated RBTC gain to their active Vault and adjusts their Stability deposit to account for the accumulated loss from debt absorptions. It also sends the depositor's MP gain to the depositor and distributes the tagged front end's MP gain to the front end.

`registerFrontEnd(uint _kickbackRate)`: Registers an address as a front end and sets their chosen kickback rate in range `[0,1]`.

`getDepositorRBTCGain(address _depositor)`: returns the accumulated RBTC gain for a given Stability Pool depositor

`getDepositorMPGain(address _depositor)`: returns the accumulated MP gain for a given Stability Pool depositor

`getFrontEndMPGain(address _frontEnd)`: returns the accumulated MP gain for a given front end

`getCompoundedBPDDeposit(address _depositor)`: returns the remaining deposit amount for a given Stability Pool depositor

`getCompoundedFrontEndStake(address _frontEnd)`: returns the remaining front end stake for a given front end

### MP Staking Functions  `MPStaking.sol`

`stake(uint _MPamount)`: This function allows the caller to send `_MPAmount` of MP tokens to the staking contract, increasing their stake. If the caller already has a non-zero stake, it triggers a payout of their accumulated RBTC and BPD gains from staking.

 `unstake(uint _MPamount)`: This function decreases the caller's stake by `_MPamount`, with a maximum reduction equal to their entire stake. Additionally, it triggers a payout of their accumulated RBTC and BPD gains from staking.

### Lockup Contract Factory `LockupContractFactory.sol`

`deployLockupContract(address _beneficiary, uint _unlockTime)`: This function is used to create and deploy a `LockupContract`. It sets the beneficiary's address and the `_unlockTime`, which represents the specific moment when the MP (Money Protocol tokens) can be withdrawn by the beneficiary.

### Lockup contract - `LockupContract.sol`

`withdrawMP()`: This function allows the beneficiary to withdraw their MP tokens if the current time has surpassed the specified `unlockTime`. Only the beneficiary is allowed to call this function for transferring their MP tokens to their own address.

### BPD token `BPDToken.sol` and MP token `MPToken.sol`


Standard ERC20 and EIP2612 (`permit()`) functionality are implemented in the contract. However, it's worth noting that `permit()` transactions can be front-run, as they don't require the permitted spender to be the `msg.sender`. This design choice allows anyone to submit a Permit that is signed by A, enabling B to spend a portion of A's tokens.

While the end result remains the same for the signer A and spender B, it's essential to consider that a `permit` transaction may be front-run and revert, potentially impacting the execution flow of a contract intended to handle on-chain Permit submissions.

For more comprehensive information, please refer to the original proposal EIP-2612 at the following link: https://eips.ethereum.org/EIPS/eip-2612

## Supplying Hints to Vault operations

In Money Protocol, Vaults are organized in a sorted doubly linked list, ordered by their NICR (Nominal Collateral Ratio) in descending order. NICR is calculated by multiplying the amount of collateral (in RBTC) by 100e18 and dividing it by the amount of debt (in BPD), without considering the RBTC:USD price. Since all Vaults are equally affected by changes in Bitcoin price, there is no need to sort them based on their real ICR (Individual Collateral Ratio).

For any Vault operation that alters the collateralization ratio, the Vault must be either inserted or reinserted into the `SortedVaults` list. To minimize computational complexity and gas cost, two 'hints' can be provided.

A hint is the address of a Vault positioned close to the correct insertion point in the sorted list.

All Vault operations require two 'hint' arguments: `_lowerHint`, which refers to the `nextId`, and `_upperHint`, which refers to the `prevId`. These hints point to the two adjacent nodes in the linked list that are (or will become) the neighbors of the targeted Vault. Using both direct neighbors as hints increases resilience in scenarios where a neighbor is moved or removed before the caller's transaction is processed, and the transaction would only fail if both neighboring Vaults are affected during the transaction's pendency.

The quality of the hint determines the traversal length and the gas cost of the function call. When a Vault operation is called, the `SortedList::findInsertPosition(uint256 _NICR, address _prevId, address _nextId)` function first checks if `prevId` is still existent and valid (with a larger NICR than the provided `_NICR`), and then it descends the list starting from `prevId`. If this check fails, the function further verifies if `nextId` is still existent and valid (with a smaller NICR than the provided `_NICR`), and then it ascends the list starting from `nextId`.

To generate a useful hint pointing to a Vault close to the target position, you can use the   `HintHelpers::getApproxHint(...)` function. This hint can then be passed as an argument to the desired Vault operation or to `SortedVaults::findInsertPosition(...)` to obtain the two direct neighbors as 'exact' hints (based on the current system state).

`getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)` randomly selects `numTrials` Vaults and returns the one with the closest position in the list where a Vault with a nominal collateralization ratio of `_CR` should be inserted. It can be mathematically demonstrated that for `numTrials = k * sqrt(n)`, the function's gas cost is with very high probability worst-case `O(sqrt(n)) if k >= 10`. For scalability reasons, the function also takes a random seed `_inputRandomSeed` to ensure that calls with different seeds may yield different results, enabling better approximations through multiple consecutive runs.

**Vault operation without a hint**

1. The user initiates a Vault operation in their browser.
2. Execute the Vault operation by setting `_lowerHint` and `_upperHint` both to the user's address.

The gas cost in the worst-case scenario will be `O(n)`, where 'n' represents the size of the `SortedVaults` list.

**Vault operation with hints**

1. The user initiates a Vault operation in their browser.
2. The frontend calculates a new collateralization ratio locally, based on the changes in collateral and/or debt.
3. The system calls `HintHelpers::getApproxHint(...)`, providing the calculated nominal collateralization ratio, which returns an address close to the correct insertion position.
4. The system calls `SortedVaults::findInsertPosition(uint256 _NICR, address _prevId, address _nextId)`, using the same approximate hint for both `_prevId` and `_nextId`, along with the new nominal collateralization ratio via `_NICR`.
5. The system passes the 'exact' hint, represented by the two direct neighbors, i.e., `_nextId` as `_lowerHint` and `_prevId` as `_upperHint`, to the Vault operation function call. (Please note that the hint may slightly deviate due to pending transactions processed first; however, the system handles this gracefully by ascending or descending the list to find the correct position.)

The gas cost for steps 2-4 is free, while step 5 will be `O(1)`.

Using hints allows for more cost-effective Vault operations for the user, although it may result in slightly longer transaction times due to the need to await the results of the two read calls in steps 1 and 2. These calls may be sent as JSON-RPC requests to a 3rd party node provider, unless the Frontend Operator is operating a full RSK node.

### Hints for `redeemCollateral`

`VaultManager::redeemCollateral` has specific requirements for additional hints:

- `_firstRedemptionHint` indicates the position of the first Vault to be redeemed from.
- `_lowerPartialRedemptionHint` points to the `nextId` neighbor of the last Vault redeemed (when partially redeemed) upon reinsertion.
- `_upperPartialRedemptionHint` points to the `prevId` neighbor of the last Vault redeemed (when partially redeemed) upon reinsertion.
- `_partialRedemptionHintNICR` ensures that the transaction won't run out of gas if neither `_lowerPartialRedemptionHint` nor `_upperPartialRedemptionHint` is valid anymore.

`redeemCollateral` exclusively redeems from Vaults with an ICR greater than or equal to the MCR. In other words, Vaults with ICR below the minimum collateralization ratio (which may occur after an RBTC:USD price drop) will be skipped. To optimize gas usage, the position of the first redeemable Vault should be provided as `_firstRedemptionHint`.

#### First redemption hint

The initial redemption hint represents the address of the vault where the redemption sequence should begin - specifically, it points to the first vault in the system with an ICR (Individual Collateralization Ratio) greater than or equal to 110%.

If, upon transaction confirmation, the provided address is invalid, the system will initiate the redemption process from the vault with the lowest ICR in the system and gradually move upwards until it finds the first eligible vault with ICR >= 110% to redeem from. Considering that the number of vaults below 110% will likely be limited due to ongoing liquidations, there is a high likelihood that the redemption transaction will still succeed. 

#### Partial redemption hints

When a redemption sequence occurs, all Vaults that are fully redeemed from will have their debt reduced to zero and will be closed. The remaining collateral, which is the difference between the original collateral and the amount used for redemption, will be claimable by the owner.

In most cases, the last Vault in the redemption sequence will be partially redeemed from, meaning only a portion of its debt will be canceled with BPD. In such instances, this Vault should be reinserted somewhere between the top and bottom of the list. The hints `_lowerPartialRedemptionHint` and `_upperPartialRedemptionHint` passed to the `redeemCollateral` function indicate the expected positions of its future neighbors after reinsertion.

However, there is a possibility that between the off-chain hint computation and the on-chain execution, a different transaction alters the state of a Vault that would otherwise be affected by the redemption sequence. As a result, the off-chain hint computation could become entirely inaccurate, leading to the entire redemption sequence reverting due to an out-of-gas error.

To address this issue, an additional hint is required: `_partialRedemptionHintNICR`, which represents the expected nominal ICR of the final partially-redeemed-from Vault. The on-chain redemption function verifies whether, after redemption, the nominal ICR of this Vault matches the nominal ICR hint.

If not, the redemption sequence won't perform the final partial redemption and will terminate early. This ensures that the transaction doesn’t revert, and allows most of the requested BPD redemption to be fulfilled successfully.

## Gas compensation

In Money Protocol, one of our primary goals is to maximize liquidation throughput and ensure that undercollateralized Vaults are promptly liquidated by "liquidators" - agents who may also hold Stability Pool deposits and anticipate profiting from these liquidations.

However, gas costs in RSK can reach substantial levels. If the gas costs of our public liquidation functions are too high, this may discourage liquidators from utilizing them, leading to the system holding too many undercollateralized Vaults for extended periods.

To address this, the protocol directly compensates liquidators for their gas costs, incentivizing prompt liquidations during both normal and high gas price periods. Liquidators should feel confident that they will at least break even when performing liquidation transactions.

Gas compensation is provided in a combination of BPD and RBTC. While the RBTC comes from the liquidated Vault, the BPD is contributed by the borrower. When a borrower first issues debt, a portion of BPD is reserved as a Liquidation Reserve. Consequently, a liquidation transaction draws RBTC from the vault(s) being liquidated, sends both the reserved BPD and the compensation in RBTC to the caller, and then liquidates the remaining assets.

In cases where a liquidation transaction liquidates multiple Vaults, each Vault contributes BPD and RBTC towards the total compensation for the transaction.

The formula for gas compensation per liquidated Vault is as follows:

Gas compensation = `200 BPD + 0.5% of the vault’s collateral (RBTC)`

The intentions behind this formula are twofold:

- To ensure that smaller Vaults are liquidated promptly during normal times.
- To ensure that larger Vaults are still liquidated promptly even during extreme high gas price periods. As the size of the Vault increases, so does the incentive to liquidate it promptly.

### Gas compensation schedule

Upon a borrower opening a Vault, an extra 200 BPD debt is generated, and an equivalent amount of 200 BPD is created and forwarded to a dedicated contract named `GasPool`, serving as the "gas pool" for gas compensation.

When the borrower subsequently closes their active Vault, the gas compensation becomes refundable: 200 BPD is subtracted from the gas pool's balance, and an equivalent 200 BPD debt on the Vault is nullified.

The primary purpose of the 200 BPD Liquidation Reserve is to ensure a baseline level of gas compensation, independent of the Vault's collateral size or the current RBTC price.

### Liquidation

When a Vault undergoes liquidation, the liquidator is rewarded with 0.5% of the Vault's collateral in addition to the 200 BPD Liquidation Reserve. Consequently, the liquidator consistently receives `{200 BPD + 0.5% collateral}` per Vault liquidated. The remaining collateral in the Vault is then subject to either offsetting, redistribution, or a combination of both, contingent upon the quantity of BPD in the Stability Pool.

### Gas compensation and redemptions

When a Vault is redeemed from, the redemption is specifically targeted at `(debt - 200)`, excluding the entire debt amount.

However, if the redemption results in the cancellation of the remaining `(debt - 200)` amount, the Vault is subsequently closed. In this case, the 200 BPD Liquidation Reserve is annulled, along with the remaining 50 debt. Essentially, the gas compensation is eradicated from the gas pool, and the 200 debt is reset to zero. The surplus RBTC collateral from the Vault remains within the system and can be claimed by its owner at a later time.

### Gas compensation helper functions

The gas compensation functions are located in the parent contract, _MoneypBase.sol_:

`_getCollGasCompensation(uint _entireColl)` calculates the RBTC amount to be taken from a vault's collateral and used as gas compensation.

`_getCompositeDebt(uint _debt)` computes the composite debt of a vault, which includes the drawn debt and the gas compensation, for the purpose of ICR calculation.

## The Stability Pool

Any holder of BPD can deposit their tokens into the Stability Pool, which is designed to absorb debt from liquidations and reward depositors with a share of the liquidated collateral based on their deposit size.

Given that liquidations occur at an ICR just below 110% and, in extreme cases, still above 100%, depositors can typically expect to receive a net gain from most liquidations. In such cases, the dollar value of the RBTC gain from a liquidation exceeds the dollar value of the BPD loss (assuming the price of BPD is $1).

We define the **collateral surplus** in a liquidation as `$(RBTC) - debt`, where `$(...)` represents the dollar value.

With a BPD price of $1, Vaults with an ICR greater than 100% have a positive collateral surplus.

After one or more liquidations, a deposit will have absorbed BPD losses and received RBTC gains. The resulting reduced deposit is referred to as the **compounded deposit**.

Stability Providers expect a positive return on investment (ROI) on their initial deposit, meaning:

`$(RBTC Gain + compounded deposit) > $(initial deposit)`

### Mixed liquidations: offset and redistribution

When a liquidation affects the Stability Pool, it is referred to as an **offset**: the Vault's debt is offset against the BPD in the Pool. If **x** BPD debt is offset, the equivalent amount of BPD in the Pool is burned, effectively canceling the debt. In cases where the BPD Stability Pool exceeds the Vault's debt, the entire debt of the Vault is canceled, and all its RBTC collateral is shared among the depositors. This type of offset is known as a **pure offset**.

However, there are instances where the BPD in the Stability Pool is less than the debt of a Vault. In such cases, the entire Stability Pool is used to offset a portion of the Vault's debt, and a corresponding fraction of the Vault's RBTC collateral is assigned to Stability Providers. The remaining portion of the Vault's debt and RBTC collateral is then redistributed among active Vaults. This type of offset is referred to as a **mixed offset and redistribution**.

As the RBTC collateral fraction matches the offset debt fraction, the effective ICR of the offset collateral and debt remains equal to the ICR of the Vault. Hence, the return on investment (ROI) per liquidation for depositors depends solely on the ICR of the liquidated Vault.

### Stability Pool deposit losses and RBTC gains - implementation

The `StabilityPool.sol` contract is responsible for handling deposit functionalities (`provideToSP`, `withdrawFromSP`, etc.), managing liquidation calculations, and maintaining the BPD and RBTC balances.

When a liquidation is offset with the Stability Pool, the corresponding debt from the liquidated Vault is canceled by burning an equal amount of BPD held in the pool.

Individual deposits within the Stability Pool absorb the debt from the liquidated Vault based on their proportion as a share of the total deposits. Likewise, the RBTC from the liquidated Vault is assigned to depositors in the same proportion.

For instance, if a liquidation depletes 30% of the Stability Pool, each deposit will be reduced by 30%, regardless of the size of the deposit.

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

Depositors receive their compounded deposits and corresponding RBTC gain through a "pull-based" approach. The system calculates the compounded deposit and accumulated RBTC gain for each depositor when they perform an operation that modifies their RBTC deposit.

Depositors can deposit BPD using the `provideToSP` function and withdraw using `withdrawFromSP`. Their accumulated RBTC gain is paid out every time they perform a deposit operation, which means that RBTC payouts are triggered by both deposit withdrawals and top-ups.

### How deposits and RBTC gains are tracked

We have implemented a highly scalable method for tracking deposits and RBTC gains with O(1) complexity.

During a liquidation event, instead of directly updating each depositor's deposit and RBTC gain, we use two intermediate variables: a product `P` and a sum `S`. Through a mathematical manipulation, we can factor out the initial deposit and accurately track all depositors' compounded deposits and accumulated RBTC gains over time, even as liquidations occur, using only these two variables. When depositors join the Pool, they receive a snapshot of `P` and `S`.

The formula for calculating a depositor's accumulated RBTC gain can be found in this document:

[Scalable reward distribution for compounding, decreasing stake](https://github.com/moneyprotocol/engineering/blob/main/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf)

Each liquidation updates the values of `P` and `S`. As a result of a series of liquidations, we can calculate the compounded deposit and corresponding RBTC gain using the initial deposit, the depositor's snapshots, and the current values of `P` and `S`.

Whenever a depositor updates their deposit (through withdrawal or top-up), their RBTC gain is paid out, and they receive new snapshots of `P` and `S`.

Our approach is similar in concept to the one described in the paper [Scalable Reward Distribution on the Ethereum Network by Bogdan Batog et al](http://batog.info/papers/scalable-reward-distribution.pdf). However, our implementation involves more complex mathematics as we handle compounding, decreasing stake, and corresponding RBTC rewards.

## MP Issuance to Stability Providers

Stability Providers continuously earn MP tokens based on the size of their deposit. This process, known as "Community Issuance," is managed by the `CommunityIssuance.sol` contract.

At the time of system deployment and activation, `CommunityIssuance` holds an initial supply of MP tokens, which is currently set at 167.7 million MP tokens.

Every Stability Pool deposit is associated with a front end tag, representing the RSK address of the front end used for the deposit. Deposits made directly with the protocol without any front end are tagged with the zero address.

When a deposit earns MP tokens, the tokens are divided between the depositor and the front end that facilitated the deposit. Front ends, upon registration, choose a "kickback rate," which determines the percentage of MP tokens earned by a tagged deposit that will be allocated to the depositor. Thus, the total MP tokens received by a depositor are calculated by multiplying the total MP earned by their deposit with the chosen `kickbackRate`. Meanwhile, the front end retains a portion of the MP tokens earned by the deposit, equivalent to `1 - kickbackRate`.

### MP Issuance schedule

The community issuance of MP tokens follows a sub-linear and monotonic schedule. We currently (provisionally) use a yearly "halving" schedule, which can be described by the cumulative issuance function:

`supplyCap * (1 - 0.5^t)`

where t represents the number of years, and supplyCap is set to 167.7 million MP tokens.

It results in the following cumulative issuance schedule for the community MP supply:

| Year | Total community MP issued |
|------|-----------------------------|
| 0    | 0%                          |
| 1    | 50%                         |
| 2    | 75%                         |
| 3    | 87.5%                       |
| 4    | 93.75%                      |
| 5    | 96.88%                      |

The design of the MP issuance curve aims to incentivize both early depositors and those who maintain long-term deposits.

While the MP issuance curve still follows a yearly halving schedule, the `CommunityIssuance` contract utilizes one-minute time intervals for more precise and fine-grained reward calculations in practice.

### MP Issuance implementation

The continuous time-based issuance of MP tokens is divided into distinct reward events, triggered by every deposit change (new deposit, top-up, withdrawal) and every liquidation, before any other state changes occur.

During an MP reward event, the issuance of MP tokens is calculated based on the time elapsed since the last reward event, `block.timestamp - lastMPIssuanceTime`, and the cumulative issuance function.

The MP tokens generated in this issuance event are distributed among depositors, proportionally based on their deposit sizes.

To efficiently and accurately monitor MP gains for depositors and front ends as deposits decrease over time due to liquidations, we reuse the [algorithm for rewards from a compounding, decreasing stake](https://github.com/moneyprotocol/engineering/blob/main/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf). This algorithm is the same one used for calculating RBTC gains from liquidations.

The same product `P` is employed, and a sum `G` is used to track MP rewards, with each deposit receiving a new snapshot of `P` and `G` whenever it is updated.

### Handling the front end MP gain

As mentioned in [MP Issuance to Stability Providers](#MP-issuance-to-stability-providers), during an MP reward event that generates `MP_d` for a deposit `d` made through a front end with a kickback rate `k`, the front end receives `(1-k) * MP_d`, and the depositor receives `k * MP_d`.

To ensure that the front end earns a portion of MP gains for all deposits tagged with its front end, we employ a virtual stake for the front end. This virtual stake is equal to the sum of all its tagged deposits. The front end's accumulated MP gain is calculated in the same manner as an individual deposit, using the product `P` and sum `G`.

Additionally, whenever one of the front end's depositors tops up or withdraws their deposit, the same change is applied to the front end's virtual stake.

### MP reward events and payouts

When a deposit undergoes a change, such as a top-up or withdrawal, the following steps occur:

- A MP reward event takes place, and `G` is updated.
- The RBTC and MP gains for the deposit are paid out.
- The corresponding MP gains for the deposit tagged under a specific front end are paid out to that front end.
- The deposit is updated, and new snapshots of `P`, `S`, and `G` are taken.
- The front end's stake is updated, and new snapshots of `P` and `G` are taken.

Similarly, when a liquidation occurs:
- A MP reward event occurs, and `G` is updated.

## Money Protocol System Fees

Money Protocol generates fee revenue from specific operations, and these fees are accrued to the MP token.

MP holders have the option to stake their MP and receive a portion of the system's fees based on their stake's proportion to the total MP staked.

The protocol generates revenue through two main methods: redemptions and the issuance of new BPD tokens.

Redemption fees are paid in RBTC, while issuance fees (applicable when a user opens a Vault or creates additional BPD from an existing Vault) are paid in BPD.

### Redemption Fee

The redemption fee is determined as a percentage of the total RBTC withdrawn during a redemption process, and this fee is calculated based on the current redemption rate.

Within the `VaultManager`, the `redeemCollateral` function is responsible for computing the RBTC fee and subsequently transferring it to the staking contract, `MPStaking.sol`.

### Issuance fee

The issuance fee is applied to the BPD borrowed by the user and is included in the Vault's BPD debt. This fee is determined by the current borrowing rate.

Whenever a user draws new BPD using any of the `BorrowerOperations` functions (`openVault`, `withdrawBPD`, or `adjustVault`), an additional amount called `BPDFee` is generated and added to the user's Vault as debt. Simultaneously, the same amount of `BPDFee` is transferred to the staking contract, `MPStaking.sol`.

### Fee Schedule

Redemption and issuance fees are determined by the `baseRate` variable in `VaultManager`, which is continuously updated. With each redemption, the `baseRate` increases, and it decays over time since the last fee event, which can be either a redemption or an issuance of BPD.

The current fee schedule is as follows:

For each redemption:

- `baseRate` gradually reduces based on the time elapsed since the last fee event.
- `baseRate` is incremented proportionally to the fraction of the total BPD supply that was redeemed.
- The redemption rate is then calculated as `min{REDEMPTION_FEE_FLOOR + baseRate * RBTCdrawn, DECIMAL_PRECISION}`.

For each debt issuance:

- `baseRate` is adjusted based on the time elapsed since the last fee event.
- The borrowing rate is then calculated as `min{BORROWING_FEE_FLOOR + baseRate * newDebtIssued, MAX_BORROWING_FEE}`.

In this context, both `REDEMPTION_FEE_FLOOR` and `BORROWING_FEE_FLOOR` are set to 0.5%, while `MAX_BORROWING_FEE` is set to 5%, and `DECIMAL_PRECISION` represents 100%.

### Intuition behind fees

The fee percentage increases with larger redemption volumes.

The `baseRate` decreases as more time elapses since the last operation.

These mechanisms are designed to control and regulate large redemptions, imposing higher fees to discourage excessive withdrawals, and to limit borrowing directly after substantial redemption activity. The gradual decay of the `baseRate` over time ensures that fees for both borrowers and redeemers will gradually decrease when redemption volumes are low.

It is important to note that the fees cannot go below the minimum of 0.5%. This provision safeguards the redemption process from potential front-running by arbitrageurs who might exploit price discrepancies if the fees were too low. Additionally, the maximum 5% issuance fee ensures that the system remains relatively appealing to new borrowers, even during periods when the monetary supply is contracting due to redemptions.

### Fee decay Implementation

Time is measured in minutes. The decay of the `baseRate` is determined by the difference between the current `block.timestamp` and the `lastFeeOpTime`. If less than a minute has elapsed since the last fee event, the `lastFeeOpTime` remains unchanged. This precaution prevents "base rate griefing," where an attacker could manipulate the `baseRate` by performing a series of rapid redemptions or BPD issuances within short time intervals (less than one minute).

The decay parameter is calibrated in a way that causes the fee to decrease by a factor of 0.99 per hour, equivalent to a 1% reduction in its current value every hour. With this rate of decay, the `baseRate` will diminish to approximately 18% of its initial value after one week. The precise value of the decay parameter may be subject to adjustment as we refine the system through economic modeling and analysis.

### Staking MP and earning fees

MP holders have the option to `stake` or `unstake` their MP tokens using the `MPStaking.sol` contract.

During a fee event, whether it involves BPD or RBTC fees, the corresponding fee amount is transferred to the staking contract. Simultaneously, a reward-per-unit-staked sum, denoted as `F_RBTC` or `F_BPD`, is incremented. Each MP stake is entitled to a portion of the fee, proportionate to its share of the total MP staked at the moment the fee event occurred.

The staking mechanism and its implementation adhere to the fundamental principles of the [“Batog” pull-based reward distribution](http://batog.info/papers/scalable-reward-distribution.pdf).


## Redistributions and Corrected Stakes

When a liquidation event occurs, and the Stability Pool is either empty or insufficient to cover the liquidated debt, the redistribution mechanism comes into play. Its purpose is to distribute the remaining collateral and debt from the liquidated Vault to all the active Vaults in the system, based on their collateral proportions.

In the redistribution process, Vaults with higher collateral holdings, like Vaults A and B, will receive a larger share of the liquidated collateral and debt. This ensures that Vaults are rewarded proportionally to their collateral contributions.

Maintaining the ordering of active Vaults by their ICR (Initial Collateral Ratio) is a crucial aspect of the Money Protocol. To guarantee this, we have conducted rigorous mathematical proofs, demonstrating that redistributing the liquidated debt and collateral in proportion to the active Vaults' collateral preserves the ICR ordering as liquidations occur over time. You can find the detailed proofs in the [proofs section](https://github.com/moneyprotocol/engineering/tree/main/papers).

However, translating these theoretical proofs into practical implementation can be challenging due to RSK gas costs. It might become prohibitively expensive to loop through all Vaults and update their data in storage for each redistribution. To tackle this issue, the system introduces the concept of "pending rewards" for Vaults. When a Vault receives redistribution rewards, its collateral and debt properties are not immediately updated. Instead, the rewards remain "pending" until the borrower performs their next operation.

While this approach is more scalable, it gives rise to a problem. The ICR of a Vault is calculated as the ratio of its total collateral to its total debt, which includes all the previous accumulated rewards. Consequently, when a new Vault is created after all active Vaults have received redistribution rewards, the fresh Vault would receive a disproportionate share of subsequent rewards relative to its total collateral. This is because the rewards for the older Vaults are based on only a portion of their collateral (since a part is pending and not reflected in the `coll` property).

As a result, this disparity in reward allocation has the potential to disrupt the ordering of Vaults by ICR, which is contrary to the protocol's objectives. You can find further information on this matter in the [proofs section](https://github.com/moneyprotocol/engineering/tree/main/papers).

### Corrected Stake Solution

To ensure a fair distribution of liquidation rewards and maintain the sorted list of Vaults by ICR (Initial Collateral Ratio), we employ a "corrected stake" mechanism. This approach guarantees that newer Vaults receive the same liquidation rewards per unit of total collateral as older Vaults with pending rewards. As a result, the sorted list remains ordered by ICR, even as liquidation events occur over time.

When a Vault is opened, its stake is determined based on its collateral and snapshots of the entire system's collateral and debt. These snapshots are taken immediately after the last liquidation event.

The formula for calculating a Vault's stake is as follows:

`stake = _coll.mul(totalStakesSnapshot).div(totalCollateralSnapshot)`

With this corrected stake, the Vault becomes eligible to earn redistribution rewards. If the system contains active Vaults with pending redistribution rewards at the time a new Vault is opened, its stake will be less than its raw collateral.

Whenever a borrower makes adjustments to their Vault's collateral, their pending rewards are applied, and a fresh corrected stake is computed. This ensures that the correct stake reflects the most up-to-date information about the Vault's rewards and contributes to maintaining the sorted list's integrity.

You can find further information on this matter in the [proofs section](https://github.com/moneyprotocol/engineering/tree/main/papers).

## Math Proofs

The Money Protocol implementation is built on essential system properties and mathematical derivations, ensuring its stability and scalability.

Specifically, we have:

- Proofs demonstrating that the order of Vaults is preserved during a series of liquidations and new Vault openings.
- A derivation of a formula and implementation for an efficient and scalable (O(1) complexity) reward distribution in the Stability Pool. This reward system involves compounding and decreasing stakes.

For more in-depth information, you can refer to the PDFs available at https://github.com/moneyprotocol/engineering/tree/main/papers. These documents provide detailed insights into the mechanisms that make Money Protocol secure and high-performing.

## Definitions

_**Vault:**_ a collateralized debt position, bound to a single RSK address. Also referred to as a “CDP” in similar protocols.

_**BPD**_:  The stablecoin that may be issued from a user's collateralized debt position and freely transferred/traded to any RSK address. Intended to maintain parity with the US dollar, and can always be redeemed directly with the system: 1 BPD is always exchangeable for $1 USD worth of RBTC.

_**Active Vault:**_ an RSK address owns an “active Vault” if there is a node in the `SortedVaults` list with ID equal to the address, and non-zero collateral is recorded on the Vault struct for that address.

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
git clone https://github.com/moneyprotocol/engineering.git moneyprotocol
cd moneyprotocol
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
yarn deploy --network testnet
```

Supported networks are currently: testnet (rsk testnet). The above command will deploy into the default channel (the one that's used by the public dev-frontend). To deploy into the internal channel instead:

```
yarn deploy --network testnet --channel internal
```

You can optionally specify an explicit gas price too:

```
yarn deploy --network testnet --gas-price 20
```

After a successful deployment, the addresses of the newly deployed contracts will be written to a version-controlled JSON file under `packages/lib/deployments/default`.

To publish a new deployment, you must execute the above command for all of the following combinations:

| Network | Channel  |
| ------- | -------- |
| testnet | default  |
| testnet | internal |
| mainnet | default  |

At some point in the future, we will make this process automatic. Once you're done deploying to all the networks, execute the following command:

```
yarn save-live-version
```

This copies the contract artifacts to a version controlled area (`packages/lib/live`) then checks that you really did deploy to all the networks. Next you need to commit and push all changed files. The repo's GitHub workflow will then build a new Docker image of the frontend interfacing with the new addresses.

#### Start a local blockchain and deploy the contracts

```
yarn start-dev-chain
```

Starts an openethereum node in a Docker container, running the [private development chain](https://openethereum.github.io/wiki/Private-development-chain), then deploys the contracts to this chain.

You may want to use this before starting the dev-frontend in development mode. To use the newly deployed contracts, switch MetaMask to the built-in "Localhost 8545" network.

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

If you have changed something in one or more packages apart from dev-frontend, it's best to use:

```
yarn rebuild
```

This combines the top-level `prepare` and `build` scripts.


## Disclaimer

The content of this readme document (“Readme”) is of purely informational nature. In particular, none of the content of the Readme shall be understood as advice provided by Money Protocol contributors or other contributors to the Readme, nor does any of these persons warrant the actuality and accuracy of the Readme.

Please read this Disclaimer carefully before accessing, interacting with, or using the Money Protocol software, consisting of the Money Protocol technology stack (in particular its smart contracts) as well as any other Money Protocol technology such as e.g., the launch kit for frontend operators (together the “Money Protocol Software”). 

While open source contributors developed the Money Protocol Software, the Money Protocol Software runs in a fully decentralized and autonomous manner on the RSK network. Money Protocol contributors are not involved in the operation of the Money Protocol Software nor has it any control over transactions made using its smart contracts. Further, Money Protocol software contributors neither enter into any relationship with users of the Money Protocol Software and/or frontend operators. Any and all functionalities of the Money Protocol Software, including the BPD and the MP, are of purely technical nature and there is no claim towards any private individual or legal entity in this regard.

Money Protocol contributors ARE NOT LIABLE TO ANY USER FOR DAMAGES, INCLUDING ANY GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE, IN CONNECTION WITH THE USE OR INABILITY TO USE THE Money Protocol SOFTWARE (INCLUDING BUT NOT LIMITED TO LOSS OF RBTC, BPD OR MP, NON-ALLOCATION OF TECHNICAL FEES TO MP HOLDERS, LOSS OF DATA, BUSINESS INTERRUPTION, DATA BEING RENDERED INACCURATE OR OTHER LOSSES SUSTAINED BY A USER OR THIRD PARTIES AS A RESULT OF THE Money Protocol SOFTWARE AND/OR ANY ACTIVITY OF A FRONTEND OPERATOR OR A FAILURE OF THE Money Protocol SOFTWARE TO OPERATE WITH ANY OTHER SOFTWARE).

The Money Protocol Software has been developed and published under the GNU GPL v3 open-source license, which forms an integral part of this disclaimer. 

THE Money Protocol SOFTWARE HAS BEEN PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. THE Money Protocol SOFTWARE IS HIGHLY EXPERIMENTAL AND ANY REAL RBTC AND/OR BPD AND/OR MP SENT, STAKED OR DEPOSITED TO THE Money Protocol PROTOCOL SOFTWARE ARE AT RISK OF BEING LOST INDEFINITELY, WITHOUT ANY KIND OF CONSIDERATION.

There are no official frontend operators, and the use of any frontend is made by users at their own risk. To assess the trustworthiness of a frontend operator lies in the sole responsibility of the users and must be made carefully.

User is solely responsible for complying with applicable law when interacting (in particular, when using RBTC, BPD, MP or other Token) with the Money Protocol Protocol Software whatsoever. 
