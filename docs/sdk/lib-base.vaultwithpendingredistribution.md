<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [VaultWithPendingRedistribution](./lib-base.vaultwithpendingredistribution.md)

## VaultWithPendingRedistribution class

A Vault in its state after the last direct modification.

<b>Signature:</b>

```typescript
export declare class VaultWithPendingRedistribution extends UserVault 
```
<b>Extends:</b> [UserVault](./lib-base.uservault.md)

## Remarks

The Vault may have received collateral and debt shares from liquidations since then. Use [applyRedistribution()](./lib-base.vaultwithpendingredistribution.applyredistribution.md) to calculate the Vault's most up-to-date state.

The constructor for this class is marked as internal. Third-party code should not call the constructor directly or create subclasses that extend the `VaultWithPendingRedistribution` class.

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [applyRedistribution(totalRedistributed)](./lib-base.vaultwithpendingredistribution.applyredistribution.md) |  |  |
|  [equals(that)](./lib-base.vaultwithpendingredistribution.equals.md) |  |  |
