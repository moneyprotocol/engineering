<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [VaultCreationDetails](./lib-base.vaultcreationdetails.md)

## VaultCreationDetails interface

Details of an [openVault()](./lib-base.transactablemoneyp.openvault.md) transaction.

<b>Signature:</b>

```typescript
export interface VaultCreationDetails 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [fee](./lib-base.vaultcreationdetails.fee.md) | [Decimal](./lib-base.decimal.md) | Amount of BPD added to the Vault's debt as borrowing fee. |
|  [newVault](./lib-base.vaultcreationdetails.newvault.md) | [Vault](./lib-base.vault.md) | The Vault that was created by the transaction. |
|  [params](./lib-base.vaultcreationdetails.params.md) | [VaultCreationParams](./lib-base.vaultcreationparams.md)<!-- -->&lt;[Decimal](./lib-base.decimal.md)<!-- -->&gt; | How much was deposited and borrowed. |
