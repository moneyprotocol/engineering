<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [SendableMoneyp](./lib-base.sendablemoneyp.md) &gt; [transferCollateralGainToVault](./lib-base.sendablemoneyp.transfercollateralgaintovault.md)

## SendableMoneyp.transferCollateralGainToVault() method

Transfer [collateral gain](./lib-base.stabilitydeposit.collateralgain.md) from Stability Deposit to Vault.

<b>Signature:</b>

```typescript
transferCollateralGainToVault(): Promise<SentMoneypTransaction<S, MoneypReceipt<R, CollateralGainTransferDetails>>>;
```
<b>Returns:</b>

Promise&lt;[SentMoneypTransaction](./lib-base.sentmoneyptransaction.md)<!-- -->&lt;S, [MoneypReceipt](./lib-base.moneypreceipt.md)<!-- -->&lt;R, [CollateralGainTransferDetails](./lib-base.collateralgaintransferdetails.md)<!-- -->&gt;&gt;&gt;

## Remarks

The collateral gain is transfered to the Vault as additional collateral.

As a side-effect, the transaction will also pay out the Stability Deposit's [MP reward](./lib-base.stabilitydeposit.mpreward.md)<!-- -->.

