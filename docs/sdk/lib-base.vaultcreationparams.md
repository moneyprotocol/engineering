<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [VaultCreationParams](./lib-base.vaultcreationparams.md)

## VaultCreationParams type

Parameters of an [openVault()](./lib-base.transactablemoneyp.openvault.md) transaction.

<b>Signature:</b>

```typescript
export declare type VaultCreationParams<T = unknown> = _CollateralDeposit<T> & _NoCollateralWithdrawal & _BPDBorrowing<T> & _NoBPDRepayment;
```

## Remarks

The type parameter `T` specifies the allowed value type(s) of the particular `VaultCreationParams` object's properties.

<h2>Properties</h2>

<table>

<tr> <th> Property </th> <th> Type </th> <th> Description </th> </tr>

<tr> <td> depositCollateral </td> <td> T </td> <td> The amount of collateral that's deposited. </td> </tr>

<tr> <td> borrowBPD </td> <td> T </td> <td> The amount of BPD that's borrowed. </td> </tr>

</table>
