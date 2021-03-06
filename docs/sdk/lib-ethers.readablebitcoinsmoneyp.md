<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [ReadableBitcoinsMoneyp](./lib-ethers.readablebitcoinsmoneyp.md)

## ReadableBitcoinsMoneyp class

Bitcoins-based implementation of [ReadableMoneyp](./lib-base.readablemoneyp.md)<!-- -->.

<b>Signature:</b>

```typescript
export declare class ReadableBitcoinsMoneyp implements ReadableMoneyp 
```
<b>Implements:</b> [ReadableMoneyp](./lib-base.readablemoneyp.md)

## Remarks

The constructor for this class is marked as internal. Third-party code should not call the constructor directly or create subclasses that extend the `ReadableBitcoinsMoneyp` class.

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [connection](./lib-ethers.readablebitcoinsmoneyp.connection.md) |  | [BitcoinsMoneypConnection](./lib-ethers.bitcoinsmoneypconnection.md) |  |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [connect(signerOrProvider, optionalParams)](./lib-ethers.readablebitcoinsmoneyp.connect_1.md) | <code>static</code> |  |
|  [getBPDBalance(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getbpdbalance.md) |  | Get the amount of BPD held by an address. |
|  [getBPDInStabilityPool(overrides)](./lib-ethers.readablebitcoinsmoneyp.getbpdinstabilitypool.md) |  | Get the total amount of BPD currently deposited in the Stability Pool. |
|  [getCollateralSurplusBalance(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getcollateralsurplusbalance.md) |  | Get the amount of leftover collateral available for withdrawal by an address. |
|  [getFees(overrides)](./lib-ethers.readablebitcoinsmoneyp.getfees.md) |  | Get a calculator for current fees. |
|  [getFrontendStatus(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getfrontendstatus.md) |  | Check whether an address is registered as a Moneyp frontend, and what its kickback rate is. |
|  [getLiquidityMiningMPReward(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getliquidityminingmpreward.md) |  | Get the amount of MP earned by an address through mining liquidity. |
|  [getLiquidityMiningStake(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getliquidityminingstake.md) |  | Get the amount of Uniswap RBTC/BPD LP tokens currently staked by an address in liquidity mining. |
|  [getMPBalance(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getmpbalance.md) |  | Get the amount of MP held by an address. |
|  [getMPStake(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getmpstake.md) |  | Get the current state of an MP Stake. |
|  [getNumberOfVaults(overrides)](./lib-ethers.readablebitcoinsmoneyp.getnumberofvaults.md) |  | Get number of Vaults that are currently open. |
|  [getPrice(overrides)](./lib-ethers.readablebitcoinsmoneyp.getprice.md) |  | Get the current price of the native currency (e.g. Ether) in USD. |
|  [getRemainingLiquidityMiningMPReward(overrides)](./lib-ethers.readablebitcoinsmoneyp.getremainingliquidityminingmpreward.md) |  | Get the remaining MP that will be collectively rewarded to liquidity miners. |
|  [getRemainingStabilityPoolMPReward(overrides)](./lib-ethers.readablebitcoinsmoneyp.getremainingstabilitypoolmpreward.md) |  | Get the remaining MP that will be collectively rewarded to stability depositors. |
|  [getRskSwapTokenAllowance(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getrskswaptokenallowance.md) |  | Get the liquidity mining contract's allowance of a holder's Uniswap RBTC/BPD LP tokens. |
|  [getRskSwapTokenBalance(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getrskswaptokenbalance.md) |  | Get the amount of Uniswap RBTC/BPD LP tokens held by an address. |
|  [getStabilityDeposit(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getstabilitydeposit.md) |  | Get the current state of a Stability Deposit. |
|  [getTotal(overrides)](./lib-ethers.readablebitcoinsmoneyp.gettotal.md) |  | Get the total amount of collateral and debt in the Moneyp system. |
|  [getTotalRedistributed(overrides)](./lib-ethers.readablebitcoinsmoneyp.gettotalredistributed.md) |  | Get the total collateral and debt per stake that has been liquidated through redistribution. |
|  [getTotalStakedMP(overrides)](./lib-ethers.readablebitcoinsmoneyp.gettotalstakedmp.md) |  | Get the total amount of MP currently staked. |
|  [getTotalStakedRskSwapTokens(overrides)](./lib-ethers.readablebitcoinsmoneyp.gettotalstakedrskswaptokens.md) |  | Get the total amount of Uniswap RBTC/BPD LP tokens currently staked in liquidity mining. |
|  [getVault(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getvault.md) |  | Get the current state of a Vault. |
|  [getVaultBeforeRedistribution(address, overrides)](./lib-ethers.readablebitcoinsmoneyp.getvaultbeforeredistribution.md) |  | Get a Vault in its state after the last direct modification. |
|  [getVaults(params, overrides)](./lib-ethers.readablebitcoinsmoneyp.getvaults_1.md) |  | Get a slice from the list of Vaults. |
|  [hasStore()](./lib-ethers.readablebitcoinsmoneyp.hasstore.md) |  | Check whether this <code>ReadableBitcoinsMoneyp</code> is a [ReadableBitcoinsMoneypWithStore](./lib-ethers.readablebitcoinsmoneypwithstore.md)<!-- -->. |
|  [hasStore(store)](./lib-ethers.readablebitcoinsmoneyp.hasstore_1.md) |  | Check whether this <code>ReadableBitcoinsMoneyp</code> is a [ReadableBitcoinsMoneypWithStore](./lib-ethers.readablebitcoinsmoneypwithstore.md)<!-- -->&lt;[BlockPolledMoneypStore](./lib-ethers.blockpolledmoneypstore.md)<!-- -->&gt;<!-- -->. |

