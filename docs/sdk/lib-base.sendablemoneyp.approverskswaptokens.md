<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [SendableMoneyp](./lib-base.sendablemoneyp.md) &gt; [approveRskSwapTokens](./lib-base.sendablemoneyp.approverskswaptokens.md)

## SendableMoneyp.approveRskSwapTokens() method

Allow the liquidity mining contract to use Uniswap RBTC/BPD LP tokens for [staking](./lib-base.transactablemoneyp.stakerskswaptokens.md)<!-- -->.

<b>Signature:</b>

```typescript
approveRskSwapTokens(allowance?: Decimalish): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  allowance | [Decimalish](./lib-base.decimalish.md) | Maximum amount of LP tokens that will be transferrable to liquidity mining (<code>2^256 - 1</code> by default). |

<b>Returns:</b>

Promise&lt;[SentMoneypTransaction](./lib-base.sentmoneyptransaction.md)<!-- -->&lt;S, [MoneypReceipt](./lib-base.moneypreceipt.md)<!-- -->&lt;R, void&gt;&gt;&gt;

## Remarks

Must be performed before calling [stakeRskSwapTokens()](./lib-base.transactablemoneyp.stakerskswaptokens.md)<!-- -->.

