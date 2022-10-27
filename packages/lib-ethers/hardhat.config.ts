import assert from "assert";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import "colors";

import { JsonFragment } from "@ethersproject/abi";
import { Wallet } from "@ethersproject/wallet";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractFactory, Overrides } from "@ethersproject/contracts";

import { task, HardhatUserConfig, types, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment, NetworkUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";

import { Decimal } from "@moneyprotocol/lib-base";

import { deployAndSetupContracts, deployTellorCaller, setSilent } from "./utils/deploy";
import { _connectToContracts, _MoneypDeploymentJSON, _priceFeedIsTestnet } from "./src/contracts";

import accounts from "./accounts.json";

dotenv.config();

const numAccounts = 100;

const useLiveVersionEnv = (process.env.USE_LIVE_VERSION ?? "false").toLowerCase();
const useLiveVersion = !["false", "no", "0"].includes(useLiveVersionEnv);

const contractsDir = path.join("..", "contracts");
const artifacts = path.join(contractsDir, "artifacts");
const cache = path.join(contractsDir, "cache");

const contractsVersion = fs
  .readFileSync(path.join(useLiveVersion ? "live" : artifacts, "version"))
  .toString()
  .trim();

if (useLiveVersion) {
  console.log(`Using live version of contracts (${contractsVersion}).`.cyan);
}

const generateRandomAccounts = (numberOfAccounts: number) => {
  const accounts = new Array<string>(numberOfAccounts);

  for (let i = 0; i < numberOfAccounts; ++i) {
    accounts[i] = Wallet.createRandom().privateKey;
  }

  return accounts;
};

const deployerAccount = process.env.DEPLOYER_PRIVATE_KEY || Wallet.createRandom().privateKey;
const devChainRichAccount = "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7";

const infuraApiKey = "ad9cef41c9c844a7b54d10be24d416e5";

const infuraNetwork = (name: string): { [name: string]: NetworkUserConfig } => ({
  [name]: {
    url: `https://${name}.infura.io/v3/${infuraApiKey}`,
    accounts: [deployerAccount]
  }
});
let mnemonic = '';
try {
  mnemonic = fs.readFileSync('.testnet.seed-phrase').toString().trim();
  if (!mnemonic || mnemonic.split(' ').length !== 12) {
    console.log('unable to retrieve mnemonic from .secret');
  }
} catch (e) {
  //
}


// https://docs.chain.link/docs/ethereum-addresses
// https://docs.tellor.io/tellor/integration/reference-page

const oracleAddresses = {
  mainnet: {
    moc: "0xb9C42EFc8ec54490a37cA91c423F7285Fa01e257",
  },
  testnet: {
    moc: '0x0adb40132cB0ffcEf6ED81c26A1881e214100555',
  }
};

const hasOracles = (network: string): network is keyof typeof oracleAddresses =>
  network in oracleAddresses;

const wrbtcAddresses = {
  mainnet: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  ropsten: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  rinkeby: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  goerli: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  kovan: "0xd0A1E359811322d97991E03f863a0C30C2cF029C",
  testnet: "0x09b6ca5e4496238a1f176aea6bb607db96c2286e"
};

const hasWRBTC = (network: string): network is keyof typeof wrbtcAddresses => network in wrbtcAddresses;

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: accounts.slice(0, numAccounts),

      gas: 12e6, // tx gas limit
      blockGasLimit: 12e6,

      // Let Bitcoins throw instead of Buidler EVM
      // This is closer to what will happen in production
      throwOnCallFailures: false,
      throwOnTransactionFailures: false
    },

    dev: {
      url: "http://localhost:8545",
      accounts: [deployerAccount, devChainRichAccount, ...generateRandomAccounts(numAccounts - 2)]
    },

    regtest: {
      url: "http://localhost:4444/",
      accounts: [deployerAccount]
    },
    
    testnet: {
      chainId: 31,
      url: 'https://public-node.testnet.rsk.co/',
      accounts: {
          mnemonic: mnemonic,
          initialIndex: 0,
          path: "m/44'/60'/0'/0",
          count: 10,
      },
      timeout: 1000000
  },

    ...infuraNetwork("ropsten"),
    ...infuraNetwork("rinkeby"),
    ...infuraNetwork("goerli"),
    ...infuraNetwork("kovan"),
    ...infuraNetwork("mainnet")
  },

  paths: {
    artifacts,
    cache
  }
};

declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    deployMoneyp: (
      deployer: Signer,
      useRealPriceFeed?: boolean,
      wrbtcAddress?: string,
      overrides?: Overrides
    ) => Promise<_MoneypDeploymentJSON>;
  }
}

const getLiveArtifact = (name: string): { abi: JsonFragment[]; bytecode: string } =>
  require(`./live/${name}.json`);

const getContractFactory: (
  env: HardhatRuntimeEnvironment
) => (name: string, signer: Signer) => Promise<ContractFactory> = useLiveVersion
  ? env => (name, signer) => {
      const { abi, bytecode } = getLiveArtifact(name);
      return env.ethers.getContractFactory(abi, bytecode, signer);
    }
  : env => env.ethers.getContractFactory;

extendEnvironment(env => {
  env.deployMoneyp = async (
    deployer,
    useRealPriceFeed = false,
    wrbtcAddress = undefined,
    overrides?: Overrides
  ) => {
    const deployment = await deployAndSetupContracts(
      deployer,
      getContractFactory(env),
      !useRealPriceFeed,
      env.network.name === "dev",
      wrbtcAddress,
      overrides
    );

    return { ...deployment, version: contractsVersion };
  };
});

type DeployParams = {
  channel: string;
  gasPrice?: number;
  useRealPriceFeed?: boolean;
  createUniswapPair?: boolean;
};

const defaultChannel = process.env.CHANNEL || "default";
const createUniswapPair = process.env.CREATE_UNISWAP_PAIR !== "false";

task("deploy", "Deploys the contracts to the network")
  .addOptionalParam("channel", "Deployment channel to deploy into", defaultChannel, types.string)
  .addOptionalParam("gasPrice", "Price to pay for 1 gas [Gwei]", undefined, types.float)
  .addOptionalParam(
    "useRealPriceFeed",
    "Deploy the production version of PriceFeed and connect it to Chainlink",
    undefined,
    types.boolean
  )
  .addOptionalParam(
    "createUniswapPair",
    "Create a real Uniswap v2 WRBTC-BPD pair instead of a mock ERC20 token",
    createUniswapPair,
    types.boolean
  )
  .setAction(
    async ({ channel, gasPrice, useRealPriceFeed, createUniswapPair }: DeployParams, env) => {
      const overrides = { gasPrice: gasPrice && Decimal.from(gasPrice).div(1000000000).hex };
      const [deployer] = await env.ethers.getSigners();

      useRealPriceFeed = false;

      if (useRealPriceFeed && !hasOracles(env.network.name)) {
        throw new Error(`PriceFeed not supported on ${env.network.name}`);
      }

      console.log(`createUniswapPair? ${createUniswapPair}`);
      let wrbtcAddress: string | undefined = undefined;
      if (createUniswapPair) {
        if (!hasWRBTC(env.network.name)) {
          throw new Error(`WRBTC not deployed on ${env.network.name}`);
        }
        wrbtcAddress = wrbtcAddresses[env.network.name];
      }

      setSilent(false);

      const deployment = await env.deployMoneyp(deployer, useRealPriceFeed, wrbtcAddress, overrides);

      if (useRealPriceFeed) {
        const contracts = _connectToContracts(deployer, deployment);

        assert(!_priceFeedIsTestnet(contracts.priceFeed));

        if (hasOracles(env.network.name)) {
          const tellorCallerAddress = await deployTellorCaller(
            deployer,
            getContractFactory(env),
            oracleAddresses[env.network.name].moc,
            overrides
          );

          console.log(`Hooking up PriceFeed with oracles ...`);

          const tx = await contracts.priceFeed.setAddresses(
            oracleAddresses[env.network.name].moc,
            overrides
          );

          console.log(`Setting pricefeed address: ${oracleAddresses[env.network.name].moc}`);

          await tx.wait();
        }
      }

      fs.mkdirSync(path.join("deployments", channel), { recursive: true });

      fs.writeFileSync(
        path.join("deployments", channel, `${env.network.name}.json`),
        JSON.stringify(deployment, undefined, 2)
      );

      console.log();
      console.log(deployment);
      console.log();
    }
  );

export default config;
