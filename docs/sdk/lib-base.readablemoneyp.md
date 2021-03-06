<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [ReadableMoneyp](./lib-base.readablemoneyp.md)

## ReadableMoneyp interface

Read the state of the Moneyp protocol.

<b>Signature:</b>

```typescript
export interface ReadableMoneyp 
```

## Remarks

Implemented by [BitcoinsMoneyp](./lib-ethers.bitcoinsmoneyp.md)<!-- -->.

## Methods

|  Method | Description |
|  --- | --- |
|  [getBPDBalance(address)](./lib-base.readablemoneyp.getbpdbalance.md) | Get the amount of BPD held by an address. |
|  [getBPDInStabilityPool()](./lib-base.readablemoneyp.getbpdinstabilitypool.md) | Get the total amount of BPD currently deposited in the Stability Pool. |
|  [getCollateralSurplusBalance(address)](./lib-base.readablemoneyp.getcollateralsurplusbalance.md) | Get the amount of leftover collateral available for withdrawal by an address. |
|  [getFees()](./lib-base.readablemoneyp.getfees.md) | Get a calculator for current fees. |
|  [getFrontendStatus(address)](./lib-base.readablemoneyp.getfrontendstatus.md) | Check whether an address is registered as a Moneyp frontend, and what its kickback rate is. |
|  [getLiquidityMiningMPReward(address)](./lib-base.readablemoneyp.getliquidityminingmpreward.md) | Get the amount of MP earned by an address through mining liquidity. |
|  [getLiquidityMiningStake(address)](./lib-base.readablemoneyp.getliquidityminingstake.md) | Get the amount of Uniswap RBTC/BPD LP tokens currently staked by an address in liquidity mining. |
|  [getMPBalance(address)](./lib-base.readablemoneyp.getmpbalance.md) | Get the amount of MP held by an address. |
|  [getMPStake(address)](./lib-base.readablemoneyp.getmpstake.md) | Get the current state of an MP Stake. |
|  [getNumberOfVaults()](./lib-base.readablemoneyp.getnumberofvaults.md) | Get number of Vaults that are currently open. |
|  [getPrice()](./lib-base.readablemoneyp.getprice.md) | Get the current price of the native currency (e.g. Ether) in USD. |
|  [getRemainingLiquidityMiningMPReward()](./lib-base.readablemoneyp.getremainingliquidityminingmpreward.md) | Get the remaining MP that will be collectively rewarded to liquidity miners. |
|  [getRemainingStabilityPoolMPReward()](./lib-base.readablemoneyp.getremainingstabilitypoolmpreward.md) | Get the remaining MP that will be collectively rewarded to stability depositors. |
|  [getRskSwapTokenAllowance(address)](./lib-base.readablemoneyp.getrskswaptokenallowance.md) | Get the liquidity mining contract's allowance of a holder's Uniswap RBTC/BPD LP tokens. |
|  [getRskSwapTokenBalance(address)](./lib-base.readablemoneyp.getrskswaptokenbalance.md) | Get the amount of Uniswap RBTC/BPD LP tokens held by an address. |
|  [getStabilityDeposit(address)](./lib-base.readablemoneyp.getstabilitydeposit.md) | Get the current state of a Stability Deposit. |
|  [getTotal()](./lib-base.readablemoneyp.gettotal.md) | Get the total amount of collateral and debt in the Moneyp system. |
|  [getTotalRedistributed()](./lib-base.readablemoneyp.gettotalredistributed.md) | Get the total collateral and debt per stake that has been liquidated through redistribution. |
|  [getTotalStakedMP()](./lib-base.readablemoneyp.gettotalstakedmp.md) | Get the total amount of MP currently staked. |
|  [getTotalStakedRskSwapTokens()](./lib-base.readablemoneyp.gettotalstakedrskswaptokens.md) | Get the total amount of Uniswap RBTC/BPD LP tokens currently staked in liquidity mining. |
|  [getVault(address)](./lib-base.readablemoneyp.getvault.md) | Get the current state of a Vault. |
|  [getVaultBeforeRedistribution(address)](./lib-base.readablemoneyp.getvaultbeforeredistribution.md) | Get a Vault in its state after the last direct modification. |
|  [getVaults(params)](./lib-base.readablemoneyp.getvaults_1.md) | Get a slice from the list of Vaults. |

