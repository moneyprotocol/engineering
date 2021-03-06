<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [ReadableBitcoinsMoneyp](./lib-ethers.readablebitcoinsmoneyp.md) &gt; [getVaultBeforeRedistribution](./lib-ethers.readablebitcoinsmoneyp.getvaultbeforeredistribution.md)

## ReadableBitcoinsMoneyp.getVaultBeforeRedistribution() method

Get a Vault in its state after the last direct modification.

<b>Signature:</b>

```typescript
getVaultBeforeRedistribution(address?: string, overrides?: BitcoinsCallOverrides): Promise<VaultWithPendingRedistribution>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  address | string | Address that owns the Vault. |
|  overrides | [BitcoinsCallOverrides](./lib-ethers.bitcoinscalloverrides.md) |  |

<b>Returns:</b>

Promise&lt;[VaultWithPendingRedistribution](./lib-base.vaultwithpendingredistribution.md)<!-- -->&gt;

## Remarks

The current state of a Vault can be fetched using [getVault()](./lib-base.readablemoneyp.getvault.md)<!-- -->.

