<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [PopulatableMoneyp](./lib-base.populatablemoneyp.md) &gt; [withdrawGainsFromStabilityPool](./lib-base.populatablemoneyp.withdrawgainsfromstabilitypool.md)

## PopulatableMoneyp.withdrawGainsFromStabilityPool() method

Withdraw [collateral gain](./lib-base.stabilitydeposit.collateralgain.md) and [MP reward](./lib-base.stabilitydeposit.mpreward.md) from Stability Deposit.

<b>Signature:</b>

```typescript
withdrawGainsFromStabilityPool(): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, StabilityPoolGainsWithdrawalDetails>>>>;
```
<b>Returns:</b>

Promise&lt;[PopulatedMoneypTransaction](./lib-base.populatedmoneyptransaction.md)<!-- -->&lt;P, [SentMoneypTransaction](./lib-base.sentmoneyptransaction.md)<!-- -->&lt;S, [MoneypReceipt](./lib-base.moneypreceipt.md)<!-- -->&lt;R, [StabilityPoolGainsWithdrawalDetails](./lib-base.stabilitypoolgainswithdrawaldetails.md)<!-- -->&gt;&gt;&gt;&gt;
