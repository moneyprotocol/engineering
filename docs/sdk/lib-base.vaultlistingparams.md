<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [VaultListingParams](./lib-base.vaultlistingparams.md)

## VaultListingParams interface

Parameters of the [getVaults()](./lib-base.readablemoneyp.getvaults_1.md) function.

<b>Signature:</b>

```typescript
export interface VaultListingParams 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [beforeRedistribution?](./lib-base.vaultlistingparams.beforeredistribution.md) | boolean | <i>(Optional)</i> When set to <code>true</code>, the retrieved Vaults won't include the liquidation shares received since the last time they were directly modified. |
|  [first](./lib-base.vaultlistingparams.first.md) | number | Number of Vaults to retrieve. |
|  [sortedBy](./lib-base.vaultlistingparams.sortedby.md) | "ascendingCollateralRatio" \| "descendingCollateralRatio" | How the Vaults should be sorted. |
|  [startingAt?](./lib-base.vaultlistingparams.startingat.md) | number | <i>(Optional)</i> Index of the first Vault to retrieve from the sorted list. |

