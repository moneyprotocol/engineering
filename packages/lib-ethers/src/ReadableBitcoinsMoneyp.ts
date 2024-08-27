import { BigNumber } from "@ethersproject/bignumber";

import {
  Decimal,
  Fees,
  FrontendStatus,
  MoneypStore,
  MPStake,
  ReadableMoneyp,
  StabilityDeposit,
  Vault,
  VaultListingParams,
  VaultWithPendingRedistribution,
  UserVault,
  UserVaultStatus,
  _CachedReadableMoneyp,
  _MoneypReadCache,
} from "@moneyprotocol/lib-base";

import { MultiVaultGetter } from "../types";

import {
  BitcoinsCallOverrides,
  BitcoinsProvider,
  BitcoinsSigner,
} from "./types";

import {
  BitcoinsMoneypConnection,
  BitcoinsMoneypConnectionOptionalParams,
  BitcoinsMoneypStoreOption,
  _connect,
  _getBlockTimestamp,
  _getContracts,
  _requireAddress,
  _requireFrontendAddress,
} from "./BitcoinsMoneypConnection";

import { BlockPolledMoneypStore } from "./BlockPolledMoneypStore";

// TODO: these are constant in the contracts, so it doesn't make sense to make a call for them,
// but to avoid having to update them here when we change them in the contracts, we could read
// them once after deployment and save them to MoneypDeployment.
const MINUTE_DECAY_FACTOR = Decimal.from("0.999037758833783000");
const BETA = Decimal.from(2);

enum BackendVaultStatus {
  nonExistent,
  active,
  closedByOwner,
  closedByLiquidation,
  closedByRedemption,
}

const panic = <T>(error: Error): T => {
  throw error;
};

const userVaultStatusFrom = (
  backendStatus: BackendVaultStatus
): UserVaultStatus =>
  backendStatus === BackendVaultStatus.nonExistent
    ? "nonExistent"
    : backendStatus === BackendVaultStatus.active
    ? "open"
    : backendStatus === BackendVaultStatus.closedByOwner
    ? "closedByOwner"
    : backendStatus === BackendVaultStatus.closedByLiquidation
    ? "closedByLiquidation"
    : backendStatus === BackendVaultStatus.closedByRedemption
    ? "closedByRedemption"
    : panic(new Error(`invalid backendStatus ${backendStatus}`));

const decimalify = (bigNumber: BigNumber) =>
  Decimal.fromBigNumberString(bigNumber.toHexString());
const numberify = (bigNumber: BigNumber) => bigNumber.toNumber();
const convertToDate = (timestamp: number) => new Date(timestamp * 1000);

const validSortingOptions = [
  "ascendingCollateralRatio",
  "descendingCollateralRatio",
];

const expectPositiveInt = <K extends string>(
  obj: { [P in K]?: number },
  key: K
) => {
  if (obj[key] !== undefined) {
    if (!Number.isInteger(obj[key])) {
      throw new Error(`${key} must be an integer`);
    }

    if (obj[key] < 0) {
      throw new Error(`${key} must not be negative`);
    }
  }
};

/**
 * Bitcoins-based implementation of {@link @moneyprotocol/lib-base#ReadableMoneyp}.
 *
 * @public
 */
export class ReadableBitcoinsMoneyp implements ReadableMoneyp {
  readonly connection: BitcoinsMoneypConnection;

  /** @internal */
  constructor(connection: BitcoinsMoneypConnection) {
    this.connection = connection;
  }
  /** @internal */
  static _from(
    connection: BitcoinsMoneypConnection & { useStore: "blockPolled" }
  ): ReadableBitcoinsMoneypWithStore<BlockPolledMoneypStore>;

  /** @internal */
  static _from(connection: BitcoinsMoneypConnection): ReadableBitcoinsMoneyp;

  /** @internal */
  static _from(connection: BitcoinsMoneypConnection): ReadableBitcoinsMoneyp {
    const readable = new ReadableBitcoinsMoneyp(connection);

    return connection.useStore === "blockPolled"
      ? new _BlockPolledReadableBitcoinsMoneyp(readable)
      : readable;
  }

  /** @internal */
  static connect(
    signerOrProvider: BitcoinsSigner | BitcoinsProvider,
    optionalParams: BitcoinsMoneypConnectionOptionalParams & {
      useStore: "blockPolled";
    }
  ): Promise<ReadableBitcoinsMoneypWithStore<BlockPolledMoneypStore>>;

  static connect(
    signerOrProvider: BitcoinsSigner | BitcoinsProvider,
    optionalParams?: BitcoinsMoneypConnectionOptionalParams
  ): Promise<ReadableBitcoinsMoneyp>;

  /**
   * Connect to the Moneyp protocol and create a `ReadableBitcoinsMoneyp` object.
   *
   * @param signerOrProvider - Bitcoins `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static async connect(
    signerOrProvider: BitcoinsSigner | BitcoinsProvider,
    optionalParams?: BitcoinsMoneypConnectionOptionalParams
  ): Promise<ReadableBitcoinsMoneyp> {
    return ReadableBitcoinsMoneyp._from(
      await _connect(signerOrProvider, optionalParams)
    );
  }

  /**
   * Check whether this `ReadableBitcoinsMoneyp` is a {@link ReadableBitcoinsMoneypWithStore}.
   */
  hasStore(): this is ReadableBitcoinsMoneypWithStore;

  /**
   * Check whether this `ReadableBitcoinsMoneyp` is a
   * {@link ReadableBitcoinsMoneypWithStore}\<{@link BlockPolledMoneypStore}\>.
   */
  hasStore(
    store: "blockPolled"
  ): this is ReadableBitcoinsMoneypWithStore<BlockPolledMoneypStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getTotalRedistributed} */
  async getTotalRedistributed(
    overrides?: BitcoinsCallOverrides
  ): Promise<Vault> {
    const { vaultManager } = _getContracts(this.connection);

    const [collateral, debt] = await Promise.all([
      vaultManager.B_RBTC({ ...overrides }).then(decimalify),
      vaultManager.B_BPDDebt({ ...overrides }).then(decimalify),
    ]);

    return new Vault(collateral, debt);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getVaultBeforeRedistribution} */
  async getVaultBeforeRedistribution(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<VaultWithPendingRedistribution> {
    address ??= _requireAddress(this.connection);
    const { vaultManager } = _getContracts(this.connection);

    const [vault, snapshot] = await Promise.all([
      vaultManager.Vaults(address, { ...overrides }),
      vaultManager.rewardSnapshots(address, { ...overrides }),
    ]);

    if (vault.status === BackendVaultStatus.active) {
      return new VaultWithPendingRedistribution(
        address,
        userVaultStatusFrom(vault.status),
        decimalify(vault.coll),
        decimalify(vault.debt),
        decimalify(vault.stake),
        new Vault(decimalify(snapshot.RBTC), decimalify(snapshot.BPDDebt))
      );
    } else {
      return new VaultWithPendingRedistribution(
        address,
        userVaultStatusFrom(vault.status)
      );
    }
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getVault} */
  async getVault(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<UserVault> {
    const [vault, totalRedistributed] = await Promise.all([
      this.getVaultBeforeRedistribution(address, overrides),
      this.getTotalRedistributed(overrides),
    ]);

    return vault.applyRedistribution(totalRedistributed);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getNumberOfVaults} */
  async getNumberOfVaults(overrides?: BitcoinsCallOverrides): Promise<number> {
    const { vaultManager } = _getContracts(this.connection);

    return (
      await vaultManager.getVaultOwnersCount({ ...overrides })
    ).toNumber();
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getPrice} */
  getPrice(overrides?: BitcoinsCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this.connection);

    return priceFeed.callStatic.fetchPrice({ ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getActivePool(overrides?: BitcoinsCallOverrides): Promise<Vault> {
    const { activePool } = _getContracts(this.connection);

    const [activeCollateral, activeDebt] = await Promise.all(
      [
        activePool.getRBTC({ ...overrides }),
        activePool.getBPDDebt({ ...overrides }),
      ].map((getBigNumber) => getBigNumber.then(decimalify))
    );

    return new Vault(activeCollateral, activeDebt);
  }

  /** @internal */
  async _getDefaultPool(overrides?: BitcoinsCallOverrides): Promise<Vault> {
    const { defaultPool } = _getContracts(this.connection);

    const [liquidatedCollateral, closedDebt] = await Promise.all(
      [
        defaultPool.getRBTC({ ...overrides }),
        defaultPool.getBPDDebt({ ...overrides }),
      ].map((getBigNumber) => getBigNumber.then(decimalify))
    );

    return new Vault(liquidatedCollateral, closedDebt);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getTotal} */
  async getTotal(overrides?: BitcoinsCallOverrides): Promise<Vault> {
    const [activePool, defaultPool] = await Promise.all([
      this._getActivePool(overrides),
      this._getDefaultPool(overrides),
    ]);

    return activePool.add(defaultPool);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getStabilityDeposit} */
  async getStabilityDeposit(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<StabilityDeposit> {
    address ??= _requireAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const [
      { frontEndTag, initialValue },
      currentBPD,
      collateralGain,
      mpReward,
    ] = await Promise.all([
      stabilityPool.deposits(address, { ...overrides }),
      stabilityPool.getCompoundedBPDDeposit(address, { ...overrides }),
      stabilityPool.getDepositorRBTCGain(address, { ...overrides }),
      stabilityPool.getDepositorMPGain(address, { ...overrides }),
    ]);

    return new StabilityDeposit(
      decimalify(initialValue),
      decimalify(currentBPD),
      decimalify(collateralGain),
      decimalify(mpReward),
      frontEndTag
    );
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getRemainingStabilityPoolMPReward} */
  async getRemainingStabilityPoolMPReward(
    overrides?: BitcoinsCallOverrides
  ): Promise<Decimal> {
    const { communityIssuance } = _getContracts(this.connection);

    const issuanceCap = this.connection.totalStabilityPoolMPReward;
    const totalMPIssued = decimalify(
      await communityIssuance.totalMPIssued({ ...overrides })
    );

    // totalMPIssued approaches but never reaches issuanceCap
    return issuanceCap.sub(totalMPIssued);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getBPDInStabilityPool} */
  getBPDInStabilityPool(overrides?: BitcoinsCallOverrides): Promise<Decimal> {
    const { stabilityPool } = _getContracts(this.connection);

    return stabilityPool.getTotalBPDDeposits({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getBPDBalance} */
  getBPDBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { bpdToken } = _getContracts(this.connection);

    return bpdToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getMPBalance} */
  getMPBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { mpToken } = _getContracts(this.connection);

    return mpToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { collSurplusPool } = _getContracts(this.connection);

    return collSurplusPool
      .getCollateral(address, { ...overrides })
      .then(decimalify);
  }

  /** @internal */
  getVaults(
    params: VaultListingParams & { beforeRedistribution: true },
    overrides?: BitcoinsCallOverrides
  ): Promise<VaultWithPendingRedistribution[]>;

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.(getVaults:2)} */
  getVaults(
    params: VaultListingParams,
    overrides?: BitcoinsCallOverrides
  ): Promise<UserVault[]>;

  async getVaults(
    params: VaultListingParams,
    overrides?: BitcoinsCallOverrides
  ): Promise<UserVault[]> {
    const { multiVaultGetter } = _getContracts(this.connection);

    expectPositiveInt(params, "first");
    expectPositiveInt(params, "startingAt");

    if (!validSortingOptions.includes(params.sortedBy)) {
      throw new Error(
        `sortedBy must be one of: ${validSortingOptions
          .map((x) => `"${x}"`)
          .join(", ")}`
      );
    }

    const [totalRedistributed, backendVaults] = await Promise.all([
      params.beforeRedistribution
        ? undefined
        : this.getTotalRedistributed({ ...overrides }),
      multiVaultGetter.getMultipleSortedVaults(
        params.sortedBy === "descendingCollateralRatio"
          ? params.startingAt ?? 0
          : -((params.startingAt ?? 0) + 1),
        params.first,
        { ...overrides }
      ),
    ]);

    const vaults = mapBackendVaults(backendVaults);

    if (totalRedistributed) {
      return vaults.map((vault) =>
        vault.applyRedistribution(totalRedistributed)
      );
    } else {
      return vaults;
    }
  }

  /** @internal */
  async _getFeesFactory(
    overrides?: BitcoinsCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    const { vaultManager } = _getContracts(this.connection);

    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      vaultManager.lastFeeOperationTime({ ...overrides }),
      vaultManager.baseRate({ ...overrides }).then(decimalify),
    ]);

    return (blockTimestamp, recoveryMode) =>
      new Fees(
        baseRateWithoutDecay,
        MINUTE_DECAY_FACTOR,
        BETA,
        convertToDate(lastFeeOperationTime.toNumber()),
        convertToDate(blockTimestamp),
        recoveryMode
      );
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getFees} */
  async getFees(overrides?: BitcoinsCallOverrides): Promise<Fees> {
    const [createFees, total, price, blockTimestamp] = await Promise.all([
      this._getFeesFactory(overrides),
      this.getTotal(overrides),
      this.getPrice(overrides),
      _getBlockTimestamp(this.connection, overrides?.blockTag),
    ]);

    return createFees(
      blockTimestamp,
      total.collateralRatioIsBelowCritical(price)
    );
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getMPStake} */
  async getMPStake(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<MPStake> {
    address ??= _requireAddress(this.connection);
    const { mpStaking } = _getContracts(this.connection);

    const [stakedMP, collateralGain, bpdGain] = await Promise.all(
      [
        mpStaking.stakes(address, { ...overrides }),
        mpStaking.getPendingRBTCGain(address, { ...overrides }),
        mpStaking.getPendingBPDGain(address, { ...overrides }),
      ].map((getBigNumber) => getBigNumber.then(decimalify))
    );

    return new MPStake(stakedMP, collateralGain, bpdGain);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getTotalStakedMP} */
  async getTotalStakedMP(overrides?: BitcoinsCallOverrides): Promise<Decimal> {
    const { mpStaking } = _getContracts(this.connection);

    return mpStaking.totalMPStaked({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getFrontendStatus} */
  async getFrontendStatus(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<FrontendStatus> {
    address ??= _requireFrontendAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const { registered, kickbackRate } = await stabilityPool.frontEnds(
      address,
      { ...overrides }
    );

    return registered
      ? { status: "registered", kickbackRate: decimalify(kickbackRate) }
      : { status: "unregistered" };
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type BackendVaults = Resolved<
  ReturnType<MultiVaultGetter["getMultipleSortedVaults"]>
>;

const mapBackendVaults = (
  vaults: BackendVaults
): VaultWithPendingRedistribution[] =>
  vaults.map(
    (vault) =>
      new VaultWithPendingRedistribution(
        vault.owner,
        "open", // These Vaults are coming from the SortedVaults list, so they must be open
        decimalify(vault.coll),
        decimalify(vault.debt),
        decimalify(vault.stake),
        new Vault(
          decimalify(vault.snapshotRBTC),
          decimalify(vault.snapshotBPDDebt)
        )
      )
  );

/**
 * Variant of {@link ReadableBitcoinsMoneyp} that exposes a {@link @moneyprotocol/lib-base#MoneypStore}.
 *
 * @public
 */
export interface ReadableBitcoinsMoneypWithStore<
  T extends MoneypStore = MoneypStore
> extends ReadableBitcoinsMoneyp {
  /** An object that implements MoneypStore. */
  readonly store: T;
}

class BlockPolledMoneypStoreBasedCache
  implements _MoneypReadCache<[overrides?: BitcoinsCallOverrides]>
{
  private _store: BlockPolledMoneypStore;

  constructor(store: BlockPolledMoneypStore) {
    this._store = store;
  }

  private _blockHit(overrides?: BitcoinsCallOverrides): boolean {
    return (
      !overrides ||
      overrides.blockTag === undefined ||
      overrides.blockTag === this._store.state.blockTag
    );
  }

  private _userHit(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this._store.connection.userAddress)
    );
  }

  private _frontendHit(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this._store.connection.frontendTag)
    );
  }

  getTotalRedistributed(overrides?: BitcoinsCallOverrides): Vault | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.totalRedistributed;
    }
  }

  getVaultBeforeRedistribution(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): VaultWithPendingRedistribution | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.vaultBeforeRedistribution;
    }
  }

  getVault(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): UserVault | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.vault;
    }
  }

  getNumberOfVaults(overrides?: BitcoinsCallOverrides): number | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.numberOfVaults;
    }
  }

  getPrice(overrides?: BitcoinsCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.price;
    }
  }

  getTotal(overrides?: BitcoinsCallOverrides): Vault | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.total;
    }
  }

  getStabilityDeposit(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): StabilityDeposit | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.stabilityDeposit;
    }
  }

  getRemainingStabilityPoolMPReward(
    overrides?: BitcoinsCallOverrides
  ): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.remainingStabilityPoolMPReward;
    }
  }

  getBPDInStabilityPool(
    overrides?: BitcoinsCallOverrides
  ): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.bpdInStabilityPool;
    }
  }

  getBPDBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.bpdBalance;
    }
  }

  getMPBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.mpBalance;
    }
  }

  getCollateralSurplusBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.collateralSurplusBalance;
    }
  }

  getFees(overrides?: BitcoinsCallOverrides): Fees | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.fees;
    }
  }

  getMPStake(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): MPStake | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.mpStake;
    }
  }

  getTotalStakedMP(overrides?: BitcoinsCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.totalStakedMP;
    }
  }

  getFrontendStatus(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ):
    | { status: "unregistered" }
    | { status: "registered"; kickbackRate: Decimal }
    | undefined {
    if (this._frontendHit(address, overrides)) {
      return this._store.state.frontend;
    }
  }

  getVaults() {
    return undefined as any;
  }
}

class _BlockPolledReadableBitcoinsMoneyp
  extends _CachedReadableMoneyp<[overrides?: BitcoinsCallOverrides]>
  implements ReadableBitcoinsMoneypWithStore<BlockPolledMoneypStore>
{
  readonly connection: BitcoinsMoneypConnection;
  readonly store: BlockPolledMoneypStore;

  constructor(readable: ReadableBitcoinsMoneyp) {
    const store = new BlockPolledMoneypStore(readable);

    super(readable, new BlockPolledMoneypStoreBasedCache(store));

    this.store = store;
    this.connection = readable.connection;
  }

  hasStore(store?: BitcoinsMoneypStoreOption): boolean {
    return store === undefined || store === "blockPolled";
  }

  _getActivePool(): Promise<Vault> {
    throw new Error("Method not implemented.");
  }

  _getDefaultPool(): Promise<Vault> {
    throw new Error("Method not implemented.");
  }

  _getFeesFactory(): Promise<
    (blockTimestamp: number, recoveryMode: boolean) => Fees
  > {
    throw new Error("Method not implemented.");
  }

  _getRemainingLiquidityMiningMPRewardCalculator(): Promise<
    (blockTimestamp: number) => Decimal
  > {
    throw new Error("Method not implemented.");
  }
}
