<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [MoneypStoreBaseState](./lib-base.moneypstorebasestate.md)

## MoneypStoreBaseState interface

State variables read from the blockchain.

<b>Signature:</b>

```typescript
export interface MoneypStoreBaseState 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [accountBalance](./lib-base.moneypstorebasestate.accountbalance.md) | [Decimal](./lib-base.decimal.md) | User's native currency balance (e.g. Ether). |
|  [bpdBalance](./lib-base.moneypstorebasestate.bpdbalance.md) | [Decimal](./lib-base.decimal.md) | User's BPD token balance. |
|  [bpdInStabilityPool](./lib-base.moneypstorebasestate.bpdinstabilitypool.md) | [Decimal](./lib-base.decimal.md) | Total amount of BPD currently deposited in the Stability Pool. |
|  [collateralSurplusBalance](./lib-base.moneypstorebasestate.collateralsurplusbalance.md) | [Decimal](./lib-base.decimal.md) | Amount of leftover collateral available for withdrawal to the user. |
|  [frontend](./lib-base.moneypstorebasestate.frontend.md) | [FrontendStatus](./lib-base.frontendstatus.md) | Status of currently used frontend. |
|  [liquidityMiningMPReward](./lib-base.moneypstorebasestate.liquidityminingmpreward.md) | [Decimal](./lib-base.decimal.md) | Amount of MP the user has earned through mining liquidity. |
|  [liquidityMiningStake](./lib-base.moneypstorebasestate.liquidityminingstake.md) | [Decimal](./lib-base.decimal.md) | Amount of Uniswap RBTC/BPD LP tokens the user has staked in liquidity mining. |
|  [mpBalance](./lib-base.moneypstorebasestate.mpbalance.md) | [Decimal](./lib-base.decimal.md) | User's MP token balance. |
|  [mpStake](./lib-base.moneypstorebasestate.mpstake.md) | [MPStake](./lib-base.mpstake.md) | User's MP stake. |
|  [numberOfVaults](./lib-base.moneypstorebasestate.numberofvaults.md) | number | Number of Vaults that are currently open. |
|  [ownFrontend](./lib-base.moneypstorebasestate.ownfrontend.md) | [FrontendStatus](./lib-base.frontendstatus.md) | Status of user's own frontend. |
|  [price](./lib-base.moneypstorebasestate.price.md) | [Decimal](./lib-base.decimal.md) | Current price of the native currency (e.g. Ether) in USD. |
|  [remainingLiquidityMiningMPReward](./lib-base.moneypstorebasestate.remainingliquidityminingmpreward.md) | [Decimal](./lib-base.decimal.md) | Remaining MP that will be collectively rewarded to liquidity miners. |
|  [remainingStabilityPoolMPReward](./lib-base.moneypstorebasestate.remainingstabilitypoolmpreward.md) | [Decimal](./lib-base.decimal.md) | Remaining MP that will be collectively rewarded to stability depositors. |
|  [rskSwapTokenAllowance](./lib-base.moneypstorebasestate.rskswaptokenallowance.md) | [Decimal](./lib-base.decimal.md) | The liquidity mining contract's allowance of user's Uniswap RBTC/BPD LP tokens. |
|  [rskSwapTokenBalance](./lib-base.moneypstorebasestate.rskswaptokenbalance.md) | [Decimal](./lib-base.decimal.md) | User's Uniswap RBTC/BPD LP token balance. |
|  [stabilityDeposit](./lib-base.moneypstorebasestate.stabilitydeposit.md) | [StabilityDeposit](./lib-base.stabilitydeposit.md) | User's stability deposit. |
|  [total](./lib-base.moneypstorebasestate.total.md) | [Vault](./lib-base.vault.md) | Total collateral and debt in the Moneyp system. |
|  [totalRedistributed](./lib-base.moneypstorebasestate.totalredistributed.md) | [Vault](./lib-base.vault.md) | Total collateral and debt per stake that has been liquidated through redistribution. |
|  [totalStakedMP](./lib-base.moneypstorebasestate.totalstakedmp.md) | [Decimal](./lib-base.decimal.md) | Total amount of MP currently staked. |
|  [totalStakedRskSwapTokens](./lib-base.moneypstorebasestate.totalstakedrskswaptokens.md) | [Decimal](./lib-base.decimal.md) | Total amount of Uniswap RBTC/BPD LP tokens currently staked in liquidity mining. |
|  [vaultBeforeRedistribution](./lib-base.moneypstorebasestate.vaultbeforeredistribution.md) | [VaultWithPendingRedistribution](./lib-base.vaultwithpendingredistribution.md) | User's Vault in its state after the last direct modification. |

