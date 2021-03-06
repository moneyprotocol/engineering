<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [PopulatableMoneyp](./lib-base.populatablemoneyp.md) &gt; [claimCollateralSurplus](./lib-base.populatablemoneyp.claimcollateralsurplus.md)

## PopulatableMoneyp.claimCollateralSurplus() method

Claim leftover collateral after a liquidation or redemption.

<b>Signature:</b>

```typescript
claimCollateralSurplus(): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;
```
<b>Returns:</b>

Promise&lt;[PopulatedMoneypTransaction](./lib-base.populatedmoneyptransaction.md)<!-- -->&lt;P, [SentMoneypTransaction](./lib-base.sentmoneyptransaction.md)<!-- -->&lt;S, [MoneypReceipt](./lib-base.moneypreceipt.md)<!-- -->&lt;R, void&gt;&gt;&gt;&gt;

## Remarks

Use [getCollateralSurplusBalance()](./lib-base.readablemoneyp.getcollateralsurplusbalance.md) to check the amount of collateral available for withdrawal.

