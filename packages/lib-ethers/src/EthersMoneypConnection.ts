import { BigNumber } from "@ethersproject/bignumber";
import { Block, BlockTag } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";

import { Decimal } from "@liquity/lib-base";

import devOrNull from "../deployments/dev.json";
import goerli from "../deployments/goerli.json";
import kovan from "../deployments/kovan.json";
import rinkeby from "../deployments/rinkeby.json";
import ropsten from "../deployments/ropsten.json";

import { EthersProvider, EthersSigner } from "./types";

import {
  _connectToContracts,
  _MoneypContractAddresses,
  _MoneypContracts,
  _MoneypDeploymentJSON
} from "./contracts";

import { _connectToMulticall, _Multicall } from "./_Multicall";

const dev = devOrNull as _MoneypDeploymentJSON | null;

const deployments: {
  [chainId: number]: _MoneypDeploymentJSON | undefined;
} = {
  [ropsten.chainId]: ropsten,
  [rinkeby.chainId]: rinkeby,
  [goerli.chainId]: goerli,
  [kovan.chainId]: kovan,

  ...(dev !== null ? { [dev.chainId]: dev } : {})
};

declare const brand: unique symbol;

const branded = <T>(t: Omit<T, typeof brand>): T => t as T;

/**
 * Information about a connection to the Moneyp protocol.
 *
 * @remarks
 * Provided for debugging / informational purposes.
 *
 * Exposed through {@link ReadableEthersMoneyp.connection} and {@link EthersMoneyp.connection}.
 *
 * @public
 */
export interface EthersMoneypConnection extends EthersMoneypConnectionOptionalParams {
  /** Ethers `Provider` used for connecting to the network. */
  readonly provider: EthersProvider;

  /** Ethers `Signer` used for sending transactions. */
  readonly signer?: EthersSigner;

  /** Chain ID of the connected network. */
  readonly chainId: number;

  /** Version of the Moneyp contracts (Git commit hash). */
  readonly version: string;

  /** Date when the Moneyp contracts were deployed. */
  readonly deploymentDate: Date;

  /** Time period (in seconds) after `deploymentDate` during which redemptions are disabled. */
  readonly bootstrapPeriod: number;

  /** Total amount of MP allocated for rewarding stability depositors. */
  readonly totalStabilityPoolMPReward: Decimal;

  /** A mapping of Moneyp contracts' names to their addresses. */
  readonly addresses: Record<string, string>;

  /** @internal */
  readonly _priceFeedIsTestnet: boolean;

  /** @internal */
  readonly _isDev: boolean;

  /** @internal */
  readonly [brand]: unique symbol;
}

/** @internal */
export interface _InternalEthersMoneypConnection extends EthersMoneypConnection {
  readonly addresses: _MoneypContractAddresses;
  readonly _contracts: _MoneypContracts;
  readonly _multicall?: _Multicall;
}

const connectionFrom = (
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  _contracts: _MoneypContracts,
  _multicall: _Multicall | undefined,
  { deploymentDate, totalStabilityPoolMPReward, ...deployment }: _MoneypDeploymentJSON,
  optionalParams?: EthersMoneypConnectionOptionalParams
): _InternalEthersMoneypConnection => {
  if (
    optionalParams &&
    optionalParams.useStore !== undefined &&
    !validStoreOptions.includes(optionalParams.useStore)
  ) {
    throw new Error(`Invalid useStore value ${optionalParams.useStore}`);
  }

  return branded({
    provider,
    signer,
    _contracts,
    _multicall,
    deploymentDate: new Date(deploymentDate),
    totalStabilityPoolMPReward: Decimal.from(totalStabilityPoolMPReward),
    ...deployment,
    ...optionalParams
  });
};

/** @internal */
export const _getContracts = (connection: EthersMoneypConnection): _MoneypContracts =>
  (connection as _InternalEthersMoneypConnection)._contracts;

const getMulticall = (connection: EthersMoneypConnection): _Multicall | undefined =>
  (connection as _InternalEthersMoneypConnection)._multicall;

const numberify = (bigNumber: BigNumber) => bigNumber.toNumber();

const getTimestampFromBlock = ({ timestamp }: Block) => timestamp;

/** @internal */
export const _getBlockTimestamp = (
  connection: EthersMoneypConnection,
  blockTag: BlockTag = "latest"
): Promise<number> =>
  // Get the timestamp via a contract call whenever possible, to make it batchable with other calls
  getMulticall(connection)?.getCurrentBlockTimestamp({ blockTag }).then(numberify) ??
  _getProvider(connection).getBlock(blockTag).then(getTimestampFromBlock);

const panic = <T>(e: unknown): T => {
  throw e;
};

/** @internal */
export const _requireSigner = (connection: EthersMoneypConnection): EthersSigner =>
  connection.signer ?? panic(new Error("Must be connected through a Signer"));

/** @internal */
export const _getProvider = (connection: EthersMoneypConnection): EthersProvider =>
  connection.provider;

// TODO parameterize error message?
/** @internal */
export const _requireAddress = (
  connection: EthersMoneypConnection,
  overrides?: { from?: string }
): string =>
  overrides?.from ?? connection.userAddress ?? panic(new Error("A user address is required"));

/** @internal */
export const _requireFrontendAddress = (connection: EthersMoneypConnection): string =>
  connection.frontendTag ?? panic(new Error("A frontend address is required"));

/** @internal */
export const _usingStore = (
  connection: EthersMoneypConnection
): connection is EthersMoneypConnection & { useStore: EthersMoneypStoreOption } =>
  connection.useStore !== undefined;

/**
 * Thrown when trying to connect to a network where Moneyp is not deployed.
 *
 * @remarks
 * Thrown by {@link ReadableEthersMoneyp.(connect:2)} and {@link EthersMoneyp.(connect:2)}.
 *
 * @public
 */
export class UnsupportedNetworkError extends Error {
  /** Chain ID of the unsupported network. */
  readonly chainId: number;

  /** @internal */
  constructor(chainId: number) {
    super(`Unsupported network (chainId = ${chainId})`);
    this.name = "UnsupportedNetworkError";
    this.chainId = chainId;
  }
}

const getProviderAndSigner = (
  signerOrProvider: EthersSigner | EthersProvider
): [provider: EthersProvider, signer: EthersSigner | undefined] => {
  const provider: EthersProvider = Signer.isSigner(signerOrProvider)
    ? signerOrProvider.provider ?? panic(new Error("Signer must have a Provider"))
    : signerOrProvider;

  const signer = Signer.isSigner(signerOrProvider) ? signerOrProvider : undefined;

  return [provider, signer];
};

/** @internal */
export const _connectToDeployment = (
  deployment: _MoneypDeploymentJSON,
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersMoneypConnectionOptionalParams
): EthersMoneypConnection =>
  connectionFrom(
    ...getProviderAndSigner(signerOrProvider),
    _connectToContracts(signerOrProvider, deployment),
    undefined,
    deployment,
    optionalParams
  );

/**
 * Possible values for the optional
 * {@link EthersMoneypConnectionOptionalParams.useStore | useStore}
 * connection parameter.
 *
 * @remarks
 * Currently, the only supported value is `"blockPolled"`, in which case a
 * {@link BlockPolledMoneypStore} will be created.
 *
 * @public
 */
export type EthersMoneypStoreOption = "blockPolled";

const validStoreOptions = ["blockPolled"];

/**
 * Optional parameters of {@link ReadableEthersMoneyp.(connect:2)} and
 * {@link EthersMoneyp.(connect:2)}.
 *
 * @public
 */
export interface EthersMoneypConnectionOptionalParams {
  /**
   * Address whose Vault, Stability Deposit, MP Stake and balances will be read by default.
   *
   * @remarks
   * For example {@link EthersMoneyp.getVault | getVault(address?)} will return the Vault owned by
   * `userAddress` when the `address` parameter is omitted.
   *
   * Should be omitted when connecting through a {@link EthersSigner | Signer}. Instead `userAddress`
   * will be automatically determined from the `Signer`.
   */
  readonly userAddress?: string;

  /**
   * Address that will receive MP rewards from newly created Stability Deposits by default.
   *
   * @remarks
   * For example
   * {@link EthersMoneyp.depositBPDInStabilityPool | depositBPDInStabilityPool(amount, frontendTag?)}
   * will tag newly made Stability Deposits with this address when its `frontendTag` parameter is
   * omitted.
   */
  readonly frontendTag?: string;

  /**
   * Create a {@link @liquity/lib-base#MoneypStore} and expose it as the `store` property.
   *
   * @remarks
   * When set to one of the available {@link EthersMoneypStoreOption | options},
   * {@link ReadableEthersMoneyp.(connect:2) | ReadableEthersMoneyp.connect()} will return a
   * {@link ReadableEthersMoneypWithStore}, while
   * {@link EthersMoneyp.(connect:2) | EthersMoneyp.connect()} will return an
   * {@link EthersMoneypWithStore}.
   *
   * Note that the store won't start monitoring the blockchain until its
   * {@link @liquity/lib-base#MoneypStore.start | start()} function is called.
   */
  readonly useStore?: EthersMoneypStoreOption;
}

/** @internal */
export function _connectByChainId<T>(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams: EthersMoneypConnectionOptionalParams & { useStore: T }
): EthersMoneypConnection & { useStore: T };

/** @internal */
export function _connectByChainId(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams?: EthersMoneypConnectionOptionalParams
): EthersMoneypConnection;

/** @internal */
export function _connectByChainId(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams?: EthersMoneypConnectionOptionalParams
): EthersMoneypConnection {
  const deployment: _MoneypDeploymentJSON =
    deployments[chainId] ?? panic(new UnsupportedNetworkError(chainId));

  return connectionFrom(
    provider,
    signer,
    _connectToContracts(signer ?? provider, deployment),
    _connectToMulticall(signer ?? provider, chainId),
    deployment,
    optionalParams
  );
}

/** @internal */
export const _connect = async (
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersMoneypConnectionOptionalParams
): Promise<EthersMoneypConnection> => {
  const [provider, signer] = getProviderAndSigner(signerOrProvider);

  if (signer) {
    if (optionalParams?.userAddress !== undefined) {
      throw new Error("Can't override userAddress when connecting through Signer");
    }

    optionalParams = {
      ...optionalParams,
      userAddress: await signer.getAddress()
    };
  }

  return _connectByChainId(provider, signer, (await provider.getNetwork()).chainId, optionalParams);
};
