import assert from "assert";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import "colors";

import { JsonFragment } from "@ethersproject/abi";
import { Wallet } from "@ethersproject/wallet";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractFactory, Overrides } from "@ethersproject/contracts";

import {
  task,
  HardhatUserConfig,
  types,
  extendEnvironment,
} from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";

import { Decimal } from "@moneyprotocol/lib-base";

import { deployAndSetupContracts, setSilent } from "./utils/deploy";
import {
  _connectToContracts,
  _MoneypDeploymentJSON,
  _priceFeedIsTestnet,
} from "./src/contracts";

dotenv.config();

const useLiveVersionEnv = (
  process.env.USE_LIVE_VERSION ?? "false"
).toLowerCase();
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

const deployerAccount =
  process.env.DEPLOYER_PRIVATE_KEY || Wallet.createRandom().privateKey;

const oracleAddresses = {
  mainnet: {
    moc: "0xb9C42EFc8ec54490a37cA91c423F7285Fa01e257",
    // [MP] TODO: change this to mainnet oracle address
    rsk: "0x97a9100de6fcabebe75fa5c8ef88c55b232f73f1",
  },
  testnet: {
    moc: "0x97a9100de6fcabebe75fa5c8ef88c55b232f73f1",
    rsk: "0x97a9100de6fcabebe75fa5c8ef88c55b232f73f1",
  },
};

const hasOracles = (network: string): network is keyof typeof oracleAddresses =>
  network in oracleAddresses;

const wrbtcAddresses = {
  mainnet: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  testnet: "0x09b6ca5e4496238a1f176aea6bb607db96c2286e",
};

const hasWRBTC = (network: string): network is keyof typeof wrbtcAddresses =>
  network in wrbtcAddresses;

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      gas: 12e6, // tx gas limit
      blockGasLimit: 12e6,

      // Let Bitcoins throw instead of Buidler EVM
      // This is closer to what will happen in production
      throwOnCallFailures: false,
      throwOnTransactionFailures: false,
    },

    dev: {
      url: "0x09b6ca5e4496238a1f176aea6bb607db96c2286e",
      accounts: [deployerAccount],
    },

    regtest: {
      url: "http://localhost:4444/",
      accounts: [deployerAccount],
    },

    testnet: {
      chainId: 31,
      url: "https://public-node.testnet.rsk.co/",
      accounts: [deployerAccount],
    },
  },

  paths: {
    artifacts,
    cache,
  },
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

const getLiveArtifact = (
  name: string
): { abi: JsonFragment[]; bytecode: string } => require(`./live/${name}.json`);

const getContractFactory: (
  env: HardhatRuntimeEnvironment
) => (name: string, signer: Signer) => Promise<ContractFactory> = useLiveVersion
  ? (env) => (name, signer) => {
      const { abi, bytecode } = getLiveArtifact(name);
      return env.ethers.getContractFactory(abi, bytecode, signer);
    }
  : (env) => env.ethers.getContractFactory;

extendEnvironment((env) => {
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
};

const defaultChannel = process.env.CHANNEL || "default";

task("deploy", "Deploys the contracts to the network")
  .addOptionalParam(
    "channel",
    "Deployment channel to deploy into",
    defaultChannel,
    types.string
  )
  .addOptionalParam(
    "gasPrice",
    "Price to pay for 1 gas [Gwei]",
    undefined,
    types.float
  )
  .addOptionalParam(
    "useRealPriceFeed",
    "Deploy the production version of PriceFeed and connect it to Chainlink",
    false,
    types.boolean
  )
  .setAction(
    async ({ channel, gasPrice, useRealPriceFeed }: DeployParams, env) => {
      const overrides = {
        gasPrice: gasPrice && Decimal.from(gasPrice).div(1000000000).hex,
      };
      const [deployer] = await env.ethers.getSigners();

      useRealPriceFeed = false;

      if (useRealPriceFeed && !hasOracles(env.network.name)) {
        throw new Error(`PriceFeed not supported on ${env.network.name}`);
      }
      let wrbtcAddress: string | undefined = undefined;
      if (!hasWRBTC(env.network.name)) {
        throw new Error(`WRBTC not deployed on ${env.network.name}`);
      }
      wrbtcAddress = wrbtcAddresses[env.network.name];

      setSilent(false);

      const deployment = await env.deployMoneyp(
        deployer,
        useRealPriceFeed,
        wrbtcAddress,
        overrides
      );

      if (useRealPriceFeed) {
        const contracts = _connectToContracts(deployer, deployment);

        assert(!_priceFeedIsTestnet(contracts.priceFeed));

        if (hasOracles(env.network.name)) {
          console.log(`Hooking up PriceFeed with oracles ...`);

          const tx = await contracts.priceFeed.setAddresses(
            [
              oracleAddresses[env.network.name].moc,
              oracleAddresses[env.network.name].rsk,
            ],
            overrides
          );

          console.log(
            `Setting pricefeed address: moc[${
              oracleAddresses[env.network.name].moc
            }], rsk[${oracleAddresses[env.network.name].rsk}]`
          );

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
