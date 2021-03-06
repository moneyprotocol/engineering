<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [Vault](./lib-base.vault.md) &gt; [create](./lib-base.vault.create.md)

## Vault.create() method

Calculate the result of an [openVault()](./lib-base.transactablemoneyp.openvault.md) transaction.

<b>Signature:</b>

```typescript
static create(params: VaultCreationParams<Decimalish>, borrowingRate?: Decimalish): Vault;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  params | [VaultCreationParams](./lib-base.vaultcreationparams.md)<!-- -->&lt;[Decimalish](./lib-base.decimalish.md)<!-- -->&gt; | Parameters of the transaction. |
|  borrowingRate | [Decimalish](./lib-base.decimalish.md) | Borrowing rate to use when calculating the Vault's debt. |

<b>Returns:</b>

[Vault](./lib-base.vault.md)

