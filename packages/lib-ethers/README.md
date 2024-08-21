# @moneyprotocol/lib-ethers

[Bitcoins](https://www.npmjs.com/package/ethers)-based library for reading Moneyp protocol state and sending transactions.

## Quickstart

Install in your project:

```
npm install --save @money-protocol/lib-base @moneyprotocol/lib-ethers ethers@^5.0.0
```

Connecting to an Ethereum node and sending a transaction:

```javascript
const { Wallet, providers } = require("ethers");
const { BitcoinsMoneyp } = require("@moneyprotocol/lib-ethers");

async function example() {
  const provider = new providers.JsonRpcProvider("http://localhost:8545");
  const wallet = new Wallet(process.env.PRIVATE_KEY).connect(provider);
  const moneyp = await BitcoinsMoneyp.connect(wallet);

  const { newVault } = await moneyp.openVault({
    depositCollateral: 5, // RBTC
    borrowBPD: 2000,
  });

  console.log(`Successfully opened a Moneyp Vault (${newVault})!`);
}
```

## More examples

See [packages/examples](https://github.com/moneyp/moneyp/tree/master/packages/examples) in the repo.

Moneyp's [Dev UI](https://github.com/moneyp/moneyp/tree/master/packages/dev-frontend) itself contains many examples of `@moneyprotocol/lib-ethers` use.

## API Reference

For now, it can be found in the public Moneyp [repo](https://github.com/moneyp/moneyp/blob/master/docs/sdk/lib-ethers.md).
