<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [BitcoinsMoneyp](./lib-ethers.bitcoinsmoneyp.md) &gt; [depositCollateral](./lib-ethers.bitcoinsmoneyp.depositcollateral.md)

## BitcoinsMoneyp.depositCollateral() method

Adjust existing Vault by depositing more collateral.

<b>Signature:</b>

```typescript
depositCollateral(amount: Decimalish, overrides?: BitcoinsTransactionOverrides): Promise<VaultAdjustmentDetails>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | [Decimalish](./lib-base.decimalish.md) | The amount of collateral to add to the Vault's existing collateral. |
|  overrides | [BitcoinsTransactionOverrides](./lib-ethers.bitcoinstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;[VaultAdjustmentDetails](./lib-base.vaultadjustmentdetails.md)<!-- -->&gt;

## Exceptions

Throws [BitcoinsTransactionFailedError](./lib-ethers.bitcoinstransactionfailederror.md) in case of transaction failure.

## Remarks

Equivalent to:

```typescript
adjustVault({ depositCollateral: amount })

```

