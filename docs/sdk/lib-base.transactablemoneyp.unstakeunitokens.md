<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [TransactableMoneyp](./lib-base.transactablemoneyp.md) &gt; [unstakeUniTokens](./lib-base.transactablemoneyp.unstakeunitokens.md)

## TransactableMoneyp.unstakeUniTokens() method

Withdraw Uniswap RBTC/BPD LP tokens from liquidity mining.

<b>Signature:</b>

```typescript
unstakeUniTokens(amount: Decimalish): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | [Decimalish](./lib-base.decimalish.md) | Amount of LP tokens to withdraw. |

<b>Returns:</b>

Promise&lt;void&gt;

## Exceptions

Throws [TransactionFailedError](./lib-base.transactionfailederror.md) in case of transaction failure.
