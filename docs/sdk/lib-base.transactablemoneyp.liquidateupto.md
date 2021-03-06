<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [TransactableMoneyp](./lib-base.transactablemoneyp.md) &gt; [liquidateUpTo](./lib-base.transactablemoneyp.liquidateupto.md)

## TransactableMoneyp.liquidateUpTo() method

Liquidate the least collateralized Vaults up to a maximum number.

<b>Signature:</b>

```typescript
liquidateUpTo(maximumNumberOfVaultsToLiquidate: number): Promise<LiquidationDetails>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  maximumNumberOfVaultsToLiquidate | number | Stop after liquidating this many Vaults. |

<b>Returns:</b>

Promise&lt;[LiquidationDetails](./lib-base.liquidationdetails.md)<!-- -->&gt;

## Exceptions

Throws [TransactionFailedError](./lib-base.transactionfailederror.md) in case of transaction failure.

