<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [SendableMoneyp](./lib-base.sendablemoneyp.md) &gt; [closeVault](./lib-base.sendablemoneyp.closevault.md)

## SendableMoneyp.closeVault() method

Close existing Vault by repaying all debt and withdrawing all collateral.

<b>Signature:</b>

```typescript
closeVault(): Promise<SentMoneypTransaction<S, MoneypReceipt<R, VaultClosureDetails>>>;
```
<b>Returns:</b>

Promise&lt;[SentMoneypTransaction](./lib-base.sentmoneyptransaction.md)<!-- -->&lt;S, [MoneypReceipt](./lib-base.moneypreceipt.md)<!-- -->&lt;R, [VaultClosureDetails](./lib-base.vaultclosuredetails.md)<!-- -->&gt;&gt;&gt;
