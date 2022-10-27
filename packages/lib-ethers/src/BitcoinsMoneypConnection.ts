import { BigNumber } from "@ethersproject/bignumber";
import { Block, BlockTag } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";

import { Decimal } from "@moneyprotocol/lib-base";

import devOrNull from "../deployments/dev.json";
import testnet from "../deployments/default/testnet.json";

import { BitcoinsProvider, BitcoinsSigner } from "./types";

import {
  _connectToContracts,
  _MoneypContractAddresses,
  _MoneypContracts,
  _MoneypDeploymentJSON
} from "./contracts";

import { _connectToMulticall, _Multicall } from "./_Multicall";

const dev = devOrNull as _MoneypDeploymentJSON | null;

const deployments: any = {
  [testnet.chainId]: testnet,

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
 * Exposed through {@link ReadableBitcoinsMoneyp.connection} and {@link BitcoinsMoneyp.connection}.
 *
 * @public
 */
export interface BitcoinsMoneypConnection extends BitcoinsMoneypConnectionOptionalParams {
  /** Bitcoins `Provider` used for connecting to the network. */
  readonly provider: BitcoinsProvider;

  /** Bitcoins `Signer` used for sending transactions. */
  readonly signer?: BitcoinsSigner;

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
export interface _InternalBitcoinsMoneypConnection extends BitcoinsMoneypConnection {
  readonly addresses: _MoneypContractAddresses;
  readonly _contracts: _MoneypContracts;
  readonly _multicall?: _Multicall;
}

const connectionFrom = (
  provider: BitcoinsProvider,
  signer: BitcoinsSigner | undefined,
  _contracts: _MoneypContracts,
  _multicall: _Multicall | undefined,
  { deploymentDate, totalStabilityPoolMPReward, ...deployment }: _MoneypDeploymentJSON,
  optionalParams?: BitcoinsMoneypConnectionOptionalParams
): _InternalBitcoinsMoneypConnection => {
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
export const _getContracts = (connection: BitcoinsMoneypConnection): _MoneypContracts =>
  (connection as _InternalBitcoinsMoneypConnection)._contracts;

const getMulticall = (connection: BitcoinsMoneypConnection): _Multicall | undefined =>
  (connection as _InternalBitcoinsMoneypConnection)._multicall;

const numberify = (bigNumber: BigNumber) => bigNumber.toNumber();

const getTimestampFromBlock = ({ timestamp }: Block) => timestamp;

/** @internal */
export const _getBlockTimestamp = (
  connection: BitcoinsMoneypConnection,
  blockTag: BlockTag = "latest"
): Promise<number> =>
  // Get the timestamp via a contract call whenever possible, to make it batchable with other calls
  getMulticall(connection)?.getCurrentBlockTimestamp({ blockTag }).then(numberify) ??
  _getProvider(connection).getBlock(blockTag).then(getTimestampFromBlock);

const panic = <T>(e: unknown): T => {
  throw e;
};

/** @internal */
export const _requireSigner = (connection: BitcoinsMoneypConnection): BitcoinsSigner =>
  connection.signer ?? panic(new Error("Must be connected through a Signer"));

/** @internal */
export const _getProvider = (connection: BitcoinsMoneypConnection): BitcoinsProvider =>
  connection.provider;

// TODO parameterize error message?
/** @internal */
export const _requireAddress = (
  connection: BitcoinsMoneypConnection,
  overrides?: { from?: string }
): string =>
  overrides?.from ?? connection.userAddress ?? panic(new Error("A user address is required"));

/** @internal */
export const _requireFrontendAddress = (connection: BitcoinsMoneypConnection): string =>
  connection.frontendTag ?? panic(new Error("A frontend address is required"));

/** @internal */
export const _usingStore = (
  connection: BitcoinsMoneypConnection
): connection is BitcoinsMoneypConnection & { useStore: BitcoinsMoneypStoreOption } =>
  connection.useStore !== undefined;

/**
 * Thrown when trying to connect to a network where Moneyp is not deployed.
 *
 * @remarks
 * Thrown by {@link ReadableBitcoinsMoneyp.(connect:2)} and {@link BitcoinsMoneyp.(connect:2)}.
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
  signerOrProvider: BitcoinsSigner | BitcoinsProvider
): [provider: BitcoinsProvider, signer: BitcoinsSigner | undefined] => {
  const provider: BitcoinsProvider = Signer.isSigner(signerOrProvider)
    ? signerOrProvider.provider ?? panic(new Error("Signer must have a Provider"))
    : signerOrProvider;

  const signer = Signer.isSigner(signerOrProvider) ? signerOrProvider : undefined;

  return [provider, signer];
};

/** @internal */
export const _connectToDeployment = (
  deployment: _MoneypDeploymentJSON,
  signerOrProvider: BitcoinsSigner | BitcoinsProvider,
  optionalParams?: BitcoinsMoneypConnectionOptionalParams
): BitcoinsMoneypConnection =>
  connectionFrom(
    ...getProviderAndSigner(signerOrProvider),
    _connectToContracts(signerOrProvider, deployment),
    undefined,
    deployment,
    optionalParams
  );

/**
 * Possible values for the optional
 * {@link BitcoinsMoneypConnectionOptionalParams.useStore | useStore}
 * connection parameter.
 *
 * @remarks
 * Currently, the only supported value is `"blockPolled"`, in which case a
 * {@link BlockPolledMoneypStore} will be created.
 *
 * @public
 */
export type BitcoinsMoneypStoreOption = "blockPolled";

const validStoreOptions = ["blockPolled"];

/**
 * Optional parameters of {@link ReadableBitcoinsMoneyp.(connect:2)} and
 * {@link BitcoinsMoneyp.(connect:2)}.
 *
 * @public
 */
export interface BitcoinsMoneypConnectionOptionalParams {
  /**
   * Address whose Vault, Stability Deposit, MP Stake and balances will be read by default.
   *
   * @remarks
   * For example {@link BitcoinsMoneyp.getVault | getVault(address?)} will return the Vault owned by
   * `userAddress` when the `address` parameter is omitted.
   *
   * Should be omitted when connecting through a {@link BitcoinsSigner | Signer}. Instead `userAddress`
   * will be automatically determined from the `Signer`.
   */
  readonly userAddress?: string;

  /**
   * Address that will receive MP rewards from newly created Stability Deposits by default.
   *
   * @remarks
   * For example
   * {@link BitcoinsMoneyp.depositBPDInStabilityPool | depositBPDInStabilityPool(amount, frontendTag?)}
   * will tag newly made Stability Deposits with this address when its `frontendTag` parameter is
   * omitted.
   */
  readonly frontendTag?: string;

  /**
   * Create a {@link @moneyprotocol/lib-base#MoneypStore} and expose it as the `store` property.
   *
   * @remarks
   * When set to one of the available {@link BitcoinsMoneypStoreOption | options},
   * {@link ReadableBitcoinsMoneyp.(connect:2) | ReadableBitcoinsMoneyp.connect()} will return a
   * {@link ReadableBitcoinsMoneypWithStore}, while
   * {@link BitcoinsMoneyp.(connect:2) | BitcoinsMoneyp.connect()} will return an
   * {@link BitcoinsMoneypWithStore}.
   *
   * Note that the store won't start monitoring the blockchain until its
   * {@link @moneyprotocol/lib-base#MoneypStore.start | start()} function is called.
   */
  readonly useStore?: BitcoinsMoneypStoreOption;
}

/** @internal */
export function _connectByChainId<T>(
  provider: BitcoinsProvider,
  signer: BitcoinsSigner | undefined,
  chainId: number,
  optionalParams: BitcoinsMoneypConnectionOptionalParams & { useStore: T }
): BitcoinsMoneypConnection & { useStore: T };

/** @internal */
export function _connectByChainId(
  provider: BitcoinsProvider,
  signer: BitcoinsSigner | undefined,
  chainId: number,
  optionalParams?: BitcoinsMoneypConnectionOptionalParams
): BitcoinsMoneypConnection;

/** @internal */
export function _connectByChainId(
  provider: BitcoinsProvider,
  signer: BitcoinsSigner | undefined,
  chainId: number,
  optionalParams?: BitcoinsMoneypConnectionOptionalParams
): BitcoinsMoneypConnection {
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
  signerOrProvider: BitcoinsSigner | BitcoinsProvider,
  optionalParams?: BitcoinsMoneypConnectionOptionalParams
): Promise<BitcoinsMoneypConnection> => {
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
