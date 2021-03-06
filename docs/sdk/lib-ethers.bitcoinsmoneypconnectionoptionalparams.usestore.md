<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [BitcoinsMoneypConnectionOptionalParams](./lib-ethers.bitcoinsmoneypconnectionoptionalparams.md) &gt; [useStore](./lib-ethers.bitcoinsmoneypconnectionoptionalparams.usestore.md)

## BitcoinsMoneypConnectionOptionalParams.useStore property

Create a [MoneypStore](./lib-base.moneypstore.md) and expose it as the `store` property.

<b>Signature:</b>

```typescript
readonly useStore?: BitcoinsMoneypStoreOption;
```

## Remarks

When set to one of the available [options](./lib-ethers.bitcoinsmoneypstoreoption.md)<!-- -->, [ReadableBitcoinsMoneyp.connect()](./lib-ethers.readablebitcoinsmoneyp.connect_1.md) will return a [ReadableBitcoinsMoneypWithStore](./lib-ethers.readablebitcoinsmoneypwithstore.md)<!-- -->, while [BitcoinsMoneyp.connect()](./lib-ethers.bitcoinsmoneyp.connect_1.md) will return an [BitcoinsMoneypWithStore](./lib-ethers.bitcoinsmoneypwithstore.md)<!-- -->.

Note that the store won't start monitoring the blockchain until its [start()](./lib-base.moneypstore.start.md) function is called.

