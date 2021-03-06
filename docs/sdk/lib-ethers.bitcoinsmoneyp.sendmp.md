<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [BitcoinsMoneyp](./lib-ethers.bitcoinsmoneyp.md) &gt; [sendMP](./lib-ethers.bitcoinsmoneyp.sendmp.md)

## BitcoinsMoneyp.sendMP() method

Send MP tokens to an address.

<b>Signature:</b>

```typescript
sendMP(toAddress: string, amount: Decimalish, overrides?: BitcoinsTransactionOverrides): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  toAddress | string | Address of receipient. |
|  amount | [Decimalish](./lib-base.decimalish.md) | Amount of MP to send. |
|  overrides | [BitcoinsTransactionOverrides](./lib-ethers.bitcoinstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;void&gt;

## Exceptions

Throws [BitcoinsTransactionFailedError](./lib-ethers.bitcoinstransactionfailederror.md) in case of transaction failure.

