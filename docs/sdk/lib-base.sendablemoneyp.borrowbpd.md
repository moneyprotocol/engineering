<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [SendableMoneyp](./lib-base.sendablemoneyp.md) &gt; [borrowBPD](./lib-base.sendablemoneyp.borrowbpd.md)

## SendableMoneyp.borrowBPD() method

Adjust existing Vault by borrowing more BPD.

<b>Signature:</b>

```typescript
borrowBPD(amount: Decimalish, maxBorrowingRate?: Decimalish): Promise<SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | [Decimalish](./lib-base.decimalish.md) | The amount of BPD to borrow. |
|  maxBorrowingRate | [Decimalish](./lib-base.decimalish.md) | Maximum acceptable [borrowing rate](./lib-base.fees.borrowingrate.md)<!-- -->. |

<b>Returns:</b>

Promise&lt;[SentMoneypTransaction](./lib-base.sentmoneyptransaction.md)<!-- -->&lt;S, [MoneypReceipt](./lib-base.moneypreceipt.md)<!-- -->&lt;R, [VaultAdjustmentDetails](./lib-base.vaultadjustmentdetails.md)<!-- -->&gt;&gt;&gt;

## Remarks

Equivalent to:

```typescript
adjustVault({ borrowBPD: amount }, maxBorrowingRate)

```
