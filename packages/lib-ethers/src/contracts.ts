import { JsonFragment, LogDescription } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";

import {
  Contract,
  ContractInterface,
  ContractFunction,
  Overrides,
  CallOverrides,
  PopulatedTransaction,
  ContractTransaction
} from "@ethersproject/contracts";

import activePoolAbi from "../abi/ActivePool.json";
import borrowerOperationsAbi from "../abi/BorrowerOperations.json";
import vaultManagerAbi from "../abi/VaultManager.json";
import bpdTokenAbi from "../abi/BPDToken.json";
import collSurplusPoolAbi from "../abi/CollSurplusPool.json";
import communityIssuanceAbi from "../abi/CommunityIssuance.json";
import defaultPoolAbi from "../abi/DefaultPool.json";
import mpTokenAbi from "../abi/MPToken.json";
import hintHelpersAbi from "../abi/HintHelpers.json";
import lockupContractFactoryAbi from "../abi/LockupContractFactory.json";
import mpStakingAbi from "../abi/MPStaking.json";
import multiVaultGetterAbi from "../abi/MultiVaultGetter.json";
import priceFeedAbi from "../abi/PriceFeed.json";
import priceFeedTestnetAbi from "../abi/PriceFeedTestnet.json";
import sortedVaultsAbi from "../abi/SortedVaults.json";
import stabilityPoolAbi from "../abi/StabilityPool.json";
import gasPoolAbi from "../abi/GasPool.json";

import {
  ActivePool,
  BorrowerOperations,
  VaultManager,
  BPDToken,
  CollSurplusPool,
  CommunityIssuance,
  DefaultPool,
  MPToken,
  HintHelpers,
  LockupContractFactory,
  MPStaking,
  MultiVaultGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedVaults,
  StabilityPool,
  GasPool,
  ERC20Mock,
  IERC20
} from "../types";

import { BitcoinsProvider, BitcoinsSigner } from "./types";

export interface _TypedLogDescription<T> extends Omit<LogDescription, "args"> {
  args: T;
}

type BucketOfFunctions = Record<string, (...args: unknown[]) => never>;

// Removes unsafe index signatures from an Bitcoins contract type
export type _TypeSafeContract<T> = Pick<
  T,
  {
    [P in keyof T]: BucketOfFunctions extends T[P] ? never : P;
  } extends {
    [_ in keyof T]: infer U;
  }
    ? U
    : never
>;

type EstimatedContractFunction<R = unknown, A extends unknown[] = unknown[], O = Overrides> = (
  overrides: O,
  adjustGas: (gas: BigNumber) => BigNumber,
  ...args: A
) => Promise<R>;

type CallOverridesArg = [overrides?: CallOverrides];

type TypedContract<T extends Contract, U, V> = _TypeSafeContract<T> &
  U &
  {
    [P in keyof V]: V[P] extends (...args: infer A) => unknown
      ? (...args: A) => Promise<ContractTransaction>
      : never;
  } & {
    readonly callStatic: {
      [P in keyof V]: V[P] extends (...args: [...infer A, never]) => infer R
        ? (...args: [...A, ...CallOverridesArg]) => R
        : never;
    };

    readonly estimateAndPopulate: {
      [P in keyof V]: V[P] extends (...args: [...infer A, infer O | undefined]) => unknown
        ? EstimatedContractFunction<PopulatedTransaction, A, O>
        : never;
    };
  };

const buildEstimatedFunctions = <T>(
  estimateFunctions: Record<string, ContractFunction<BigNumber>>,
  functions: Record<string, ContractFunction<T>>
): Record<string, EstimatedContractFunction<T>> =>
  Object.fromEntries(
    Object.keys(estimateFunctions).map(functionName => [
      functionName,
      async (overrides, adjustEstimate, ...args) => {
        if (overrides.gasLimit === undefined) {
          const estimatedGas = await estimateFunctions[functionName](...args, overrides);

          overrides = {
            ...overrides,
            gasLimit: adjustEstimate(estimatedGas)
          };
        }

        return functions[functionName](...args, overrides);
      }
    ])
  );

export class _MoneypContract extends Contract {
  readonly estimateAndPopulate: Record<string, EstimatedContractFunction<PopulatedTransaction>>;

  constructor(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider?: BitcoinsSigner | BitcoinsProvider
  ) {
    super(addressOrName, contractInterface, signerOrProvider);

    // this.estimateAndCall = buildEstimatedFunctions(this.estimateGas, this);
    this.estimateAndPopulate = buildEstimatedFunctions(this.estimateGas, this.populateTransaction);
  }

  extractEvents(logs: Log[], name: string): _TypedLogDescription<unknown>[] {
    return logs
      .filter(log => log.address === this.address)
      .map(log => this.interface.parseLog(log))
      .filter(e => e.name === name);
  }
}

/** @internal */
export type _TypedMoneypContract<T = unknown, U = unknown> = TypedContract<_MoneypContract, T, U>;

/** @internal */
export interface _MoneypContracts {
  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  vaultManager: VaultManager;
  bpdToken: BPDToken;
  collSurplusPool: CollSurplusPool;
  communityIssuance: CommunityIssuance;
  defaultPool: DefaultPool;
  mpToken: MPToken;
  hintHelpers: HintHelpers;
  lockupContractFactory: LockupContractFactory;
  mpStaking: MPStaking;
  multiVaultGetter: MultiVaultGetter;
  priceFeed: PriceFeed | PriceFeedTestnet;
  sortedVaults: SortedVaults;
  stabilityPool: StabilityPool;
  gasPool: GasPool;
}

/** @internal */
export const _priceFeedIsTestnet = (
  priceFeed: PriceFeed | PriceFeedTestnet
): priceFeed is PriceFeedTestnet => "setPrice" in priceFeed;

/** @internal */
export const _rskSwapTokenIsMock = (rskSwapToken: IERC20 | ERC20Mock): rskSwapToken is ERC20Mock =>
  "mint" in rskSwapToken;

type MoneypContractsKey = keyof _MoneypContracts;

/** @internal */
export type _MoneypContractAddresses = Record<MoneypContractsKey, string>;

type MoneypContractAbis = Record<MoneypContractsKey, JsonFragment[]>;

const getAbi = (priceFeedIsTestnet: boolean): MoneypContractAbis => ({
  activePool: activePoolAbi,
  borrowerOperations: borrowerOperationsAbi,
  vaultManager: vaultManagerAbi,
  bpdToken: bpdTokenAbi,
  communityIssuance: communityIssuanceAbi,
  defaultPool: defaultPoolAbi,
  mpToken: mpTokenAbi,
  hintHelpers: hintHelpersAbi,
  lockupContractFactory: lockupContractFactoryAbi,
  mpStaking: mpStakingAbi,
  multiVaultGetter: multiVaultGetterAbi,
  priceFeed: priceFeedIsTestnet ? priceFeedTestnetAbi : priceFeedAbi,
  sortedVaults: sortedVaultsAbi,
  stabilityPool: stabilityPoolAbi,
  gasPool: gasPoolAbi,
  collSurplusPool: collSurplusPoolAbi,
});

const mapMoneypContracts = <T, U>(
  contracts: Record<MoneypContractsKey, T>,
  f: (t: T, key: MoneypContractsKey) => U
) =>
  Object.fromEntries(
    Object.entries(contracts).map(([key, t]) => [key, f(t, key as MoneypContractsKey)])
  ) as Record<MoneypContractsKey, U>;

/** @internal */
export interface _MoneypDeploymentJSON {
  readonly chainId: number;
  readonly addresses: _MoneypContractAddresses;
  readonly version: string;
  readonly deploymentDate: number;
  readonly bootstrapPeriod: number;
  readonly totalStabilityPoolMPReward: string;
  readonly _priceFeedIsTestnet: boolean;
  readonly _isDev: boolean;
}

/** @internal */
export const _connectToContracts = (
  signerOrProvider: BitcoinsSigner | BitcoinsProvider,
  { addresses, _priceFeedIsTestnet }: _MoneypDeploymentJSON
): _MoneypContracts => {
  const abi = getAbi(_priceFeedIsTestnet);

  return mapMoneypContracts(
    addresses,
    (address, key) =>
      new _MoneypContract(address, abi[key], signerOrProvider) as _TypedMoneypContract
  ) as _MoneypContracts;
};
