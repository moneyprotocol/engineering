<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [TransactableMoneyp](./lib-base.transactablemoneyp.md) &gt; [claimCollateralSurplus](./lib-base.transactablemoneyp.claimcollateralsurplus.md)

## TransactableMoneyp.claimCollateralSurplus() method

Claim leftover collateral after a liquidation or redemption.

<b>Signature:</b>

```typescript
claimCollateralSurplus(): Promise<void>;
```
<b>Returns:</b>

Promise&lt;void&gt;

## Exceptions

Throws [TransactionFailedError](./lib-base.transactionfailederror.md) in case of transaction failure.

## Remarks

Use [getCollateralSurplusBalance()](./lib-base.readablemoneyp.getcollateralsurplusbalance.md) to check the amount of collateral available for withdrawal.

