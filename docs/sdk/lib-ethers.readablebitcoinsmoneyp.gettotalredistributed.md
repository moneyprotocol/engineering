<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [ReadableBitcoinsMoneyp](./lib-ethers.readablebitcoinsmoneyp.md) &gt; [getTotalRedistributed](./lib-ethers.readablebitcoinsmoneyp.gettotalredistributed.md)

## ReadableBitcoinsMoneyp.getTotalRedistributed() method

Get the total collateral and debt per stake that has been liquidated through redistribution.

<b>Signature:</b>

```typescript
getTotalRedistributed(overrides?: BitcoinsCallOverrides): Promise<Vault>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  overrides | [BitcoinsCallOverrides](./lib-ethers.bitcoinscalloverrides.md) |  |

<b>Returns:</b>

Promise&lt;[Vault](./lib-base.vault.md)<!-- -->&gt;

## Remarks

Needed when dealing with instances of [VaultWithPendingRedistribution](./lib-base.vaultwithpendingredistribution.md)<!-- -->.
