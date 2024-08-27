import fs from "fs-extra";
import path from "path";

import ActivePool from "@moneyprotocol/contracts/artifacts/contracts/ActivePool.sol/ActivePool.json";
import BorrowerOperations from "@moneyprotocol/contracts/artifacts/contracts/BorrowerOperations.sol/BorrowerOperations.json";
import CollSurplusPool from "@moneyprotocol/contracts/artifacts/contracts/CollSurplusPool.sol/CollSurplusPool.json";
import CommunityIssuance from "@moneyprotocol/contracts/artifacts/contracts/MP/CommunityIssuance.sol/CommunityIssuance.json";
import DefaultPool from "@moneyprotocol/contracts/artifacts/contracts/DefaultPool.sol/DefaultPool.json";
import ERC20Mock from "@moneyprotocol/contracts/artifacts/contracts/LPRewards/TestContracts/ERC20Mock.sol/ERC20Mock.json";
import GasPool from "@moneyprotocol/contracts/artifacts/contracts/GasPool.sol/GasPool.json";
import HintHelpers from "@moneyprotocol/contracts/artifacts/contracts/HintHelpers.sol/HintHelpers.json";
import IERC20 from "@moneyprotocol/contracts/artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import LockupContractFactory from "@moneyprotocol/contracts/artifacts/contracts/MP/LockupContractFactory.sol/LockupContractFactory.json";
import BPDToken from "@moneyprotocol/contracts/artifacts/contracts/BPDToken.sol/BPDToken.json";
import MPStaking from "@moneyprotocol/contracts/artifacts/contracts/MP/MPStaking.sol/MPStaking.json";
import MPToken from "@moneyprotocol/contracts/artifacts/contracts/MP/MPToken.sol/MPToken.json";
import MultiVaultGetter from "@moneyprotocol/contracts/artifacts/contracts/MultiVaultGetter.sol/MultiVaultGetter.json";
import PriceFeed from "@moneyprotocol/contracts/artifacts/contracts/PriceFeed.sol/PriceFeed.json";
import PriceFeedTestnet from "@moneyprotocol/contracts/artifacts/contracts/TestContracts/PriceFeedTestnet.sol/PriceFeedTestnet.json";
import SortedVaults from "@moneyprotocol/contracts/artifacts/contracts/SortedVaults.sol/SortedVaults.json";
import StabilityPool from "@moneyprotocol/contracts/artifacts/contracts/StabilityPool.sol/StabilityPool.json";
import VaultManager from "@moneyprotocol/contracts/artifacts/contracts/VaultManager.sol/VaultManager.json";
import RskSwapPool from "@moneyprotocol/contracts/artifacts/contracts/LPRewards/RskSwapPool.sol/RskSwapPool.json";
import { ParamType, Interface } from "ethers/lib/utils";

const getTupleType = (components: ParamType[], flexible: boolean) => {
  if (components.every((component) => component.name)) {
    return (
      "{ " +
      components
        .map(
          (component) => `${component.name}: ${getType(component, flexible)}`
        )
        .join("; ") +
      " }"
    );
  } else {
    return `[${components
      .map((component) => getType(component, flexible))
      .join(", ")}]`;
  }
};

const getType = (
  { baseType, components, arrayChildren }: ParamType,
  flexible: boolean
): string => {
  switch (baseType) {
    case "address":
    case "string":
      return "string";

    case "bool":
      return "boolean";

    case "array":
      return `${getType(arrayChildren, flexible)}[]`;

    case "tuple":
      return getTupleType(components, flexible);
  }

  if (baseType.startsWith("bytes")) {
    return flexible ? "BytesLike" : "string";
  }

  const match = baseType.match(/^(u?int)([0-9]+)$/);
  if (match) {
    return flexible
      ? "BigNumberish"
      : parseInt(match[2]) >= 53
      ? "BigNumber"
      : "number";
  }

  throw new Error(`unimplemented type ${baseType}`);
};

const declareInterface = ({
  contractName,
  interface: { events, functions },
}: {
  contractName: string;
  interface: Interface;
}) =>
  [
    `interface ${contractName}Calls {`,
    ...Object.values(functions)
      .filter(({ constant }) => constant)
      .map(({ name, inputs, outputs }) => {
        const params = [
          ...inputs.map(
            (input, i) => `${input.name || "arg" + i}: ${getType(input, true)}`
          ),
          `_overrides?: CallOverrides`,
        ];

        let returnType: string;
        if (!outputs || outputs.length == 0) {
          returnType = "void";
        } else if (outputs.length === 1) {
          returnType = getType(outputs[0], false);
        } else {
          returnType = getTupleType(outputs, false);
        }

        return `  ${name}(${params.join(", ")}): Promise<${returnType}>;`;
      }),
    "}\n",

    `interface ${contractName}Transactions {`,
    ...Object.values(functions)
      .filter(({ constant }) => !constant)
      .map(({ name, payable, inputs, outputs }) => {
        const overridesType = payable ? "PayableOverrides" : "Overrides";

        const params = [
          ...inputs.map(
            (input, i) => `${input.name || "arg" + i}: ${getType(input, true)}`
          ),
          `_overrides?: ${overridesType}`,
        ];

        let returnType: string;
        if (!outputs || outputs.length == 0) {
          returnType = "void";
        } else if (outputs.length === 1) {
          returnType = getType(outputs[0], false);
        } else {
          returnType = getTupleType(outputs, false);
        }

        return `  ${name}(${params.join(", ")}): Promise<${returnType}>;`;
      }),
    "}\n",

    `export interface ${contractName}`,
    `  extends _TypedMoneypContract<${contractName}Calls, ${contractName}Transactions> {`,

    "  readonly filters: {",
    ...Object.values(events).map(({ name, inputs }) => {
      const params = inputs.map(
        (input) =>
          `${input.name}?: ${
            input.indexed ? `${getType(input, true)} | null` : "null"
          }`
      );

      return `    ${name}(${params.join(", ")}): EventFilter;`;
    }),
    "  };",

    ...Object.values(events).map(
      ({ name, inputs }) =>
        `  extractEvents(logs: Log[], name: "${name}"): _TypedLogDescription<${getTupleType(
          inputs,
          false
        )}>[];`
    ),

    "}",
  ].join("\n");

const contractArtifacts = [
  ActivePool,
  BorrowerOperations,
  CollSurplusPool,
  CommunityIssuance,
  DefaultPool,
  ERC20Mock,
  GasPool,
  HintHelpers,
  IERC20,
  LockupContractFactory,
  BPDToken,
  MPStaking,
  MPToken,
  MultiVaultGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedVaults,
  StabilityPool,
  VaultManager,
  RskSwapPool,
];

const contracts = contractArtifacts.map(({ contractName, abi }: any) => ({
  contractName,
  interface: new Interface(abi),
}));

const output = `
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";
import { BytesLike } from "@ethersproject/bytes";
import {
  Overrides,
  CallOverrides,
  PayableOverrides,
  EventFilter
} from "@ethersproject/contracts";

import { _TypedMoneypContract, _TypedLogDescription } from "../src/contracts";

${contracts.map(declareInterface).join("\n\n")}
`;

fs.mkdirSync("types", { recursive: true });
fs.writeFileSync(path.join("types", "index.ts"), output);

fs.removeSync("abi");
fs.mkdirSync("abi", { recursive: true });
contractArtifacts.forEach(({ contractName, abi }: any) =>
  fs.writeFileSync(
    path.join("abi", `${contractName}.json`),
    JSON.stringify(abi, undefined, 2)
  )
);
