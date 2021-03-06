<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [SendableBitcoinsMoneyp](./lib-ethers.sendablebitcoinsmoneyp.md) &gt; [withdrawGainsFromStabilityPool](./lib-ethers.sendablebitcoinsmoneyp.withdrawgainsfromstabilitypool.md)

## SendableBitcoinsMoneyp.withdrawGainsFromStabilityPool() method

Withdraw [collateral gain](./lib-base.stabilitydeposit.collateralgain.md) and [MP reward](./lib-base.stabilitydeposit.mpreward.md) from Stability Deposit.

<b>Signature:</b>

```typescript
withdrawGainsFromStabilityPool(overrides?: BitcoinsTransactionOverrides): Promise<SentBitcoinsMoneypTransaction<StabilityPoolGainsWithdrawalDetails>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  overrides | [BitcoinsTransactionOverrides](./lib-ethers.bitcoinstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;[SentBitcoinsMoneypTransaction](./lib-ethers.sentbitcoinsmoneyptransaction.md)<!-- -->&lt;[StabilityPoolGainsWithdrawalDetails](./lib-base.stabilitypoolgainswithdrawaldetails.md)<!-- -->&gt;&gt;

