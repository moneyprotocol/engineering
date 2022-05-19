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
  _MoneypReadCache
} from "@liquity/lib-base";

import { MultiVaultGetter } from "../types";

import { EthersCallOverrides, EthersProvider, EthersSigner } from "./types";

import {
  EthersMoneypConnection,
  EthersMoneypConnectionOptionalParams,
  EthersMoneypStoreOption,
  _connect,
  _getBlockTimestamp,
  _getContracts,
  _requireAddress,
  _requireFrontendAddress
} from "./EthersMoneypConnection";

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
  closedByRedemption
}

const panic = <T>(error: Error): T => {
  throw error;
};

const userVaultStatusFrom = (backendStatus: BackendVaultStatus): UserVaultStatus =>
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

const decimalify = (bigNumber: BigNumber) => Decimal.fromBigNumberString(bigNumber.toHexString());
const numberify = (bigNumber: BigNumber) => bigNumber.toNumber();
const convertToDate = (timestamp: number) => new Date(timestamp * 1000);

const validSortingOptions = ["ascendingCollateralRatio", "descendingCollateralRatio"];

const expectPositiveInt = <K extends string>(obj: { [P in K]?: number }, key: K) => {
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
 * Ethers-based implementation of {@link @liquity/lib-base#ReadableMoneyp}.
 *
 * @public
 */
export class ReadableEthersMoneyp implements ReadableMoneyp {
  readonly connection: EthersMoneypConnection;

  /** @internal */
  constructor(connection: EthersMoneypConnection) {
    this.connection = connection;
  }

  /** @internal */
  static _from(
    connection: EthersMoneypConnection & { useStore: "blockPolled" }
  ): ReadableEthersMoneypWithStore<BlockPolledMoneypStore>;

  /** @internal */
  static _from(connection: EthersMoneypConnection): ReadableEthersMoneyp;

  /** @internal */
  static _from(connection: EthersMoneypConnection): ReadableEthersMoneyp {
    const readable = new ReadableEthersMoneyp(connection);

    return connection.useStore === "blockPolled"
      ? new _BlockPolledReadableEthersMoneyp(readable)
      : readable;
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersMoneypConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<ReadableEthersMoneypWithStore<BlockPolledMoneypStore>>;

  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersMoneypConnectionOptionalParams
  ): Promise<ReadableEthersMoneyp>;

  /**
   * Connect to the Moneyp protocol and create a `ReadableEthersMoneyp` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersMoneypConnectionOptionalParams
  ): Promise<ReadableEthersMoneyp> {
    return ReadableEthersMoneyp._from(await _connect(signerOrProvider, optionalParams));
  }

  /**
   * Check whether this `ReadableEthersMoneyp` is a {@link ReadableEthersMoneypWithStore}.
   */
  hasStore(): this is ReadableEthersMoneypWithStore;

  /**
   * Check whether this `ReadableEthersMoneyp` is a
   * {@link ReadableEthersMoneypWithStore}\<{@link BlockPolledMoneypStore}\>.
   */
  hasStore(store: "blockPolled"): this is ReadableEthersMoneypWithStore<BlockPolledMoneypStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getTotalRedistributed} */
  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Vault> {
    const { vaultManager } = _getContracts(this.connection);

    const [collateral, debt] = await Promise.all([
      vaultManager.L_ETH({ ...overrides }).then(decimalify),
      vaultManager.B_BPDDebt({ ...overrides }).then(decimalify)
    ]);

    return new Vault(collateral, debt);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getVaultBeforeRedistribution} */
  async getVaultBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<VaultWithPendingRedistribution> {
    address ??= _requireAddress(this.connection);
    const { vaultManager } = _getContracts(this.connection);

    const [vault, snapshot] = await Promise.all([
      vaultManager.Vaults(address, { ...overrides }),
      vaultManager.rewardSnapshots(address, { ...overrides })
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
      return new VaultWithPendingRedistribution(address, userVaultStatusFrom(vault.status));
    }
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getVault} */
  async getVault(address?: string, overrides?: EthersCallOverrides): Promise<UserVault> {
    const [vault, totalRedistributed] = await Promise.all([
      this.getVaultBeforeRedistribution(address, overrides),
      this.getTotalRedistributed(overrides)
    ]);

    return vault.applyRedistribution(totalRedistributed);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getNumberOfVaults} */
  async getNumberOfVaults(overrides?: EthersCallOverrides): Promise<number> {
    const { vaultManager } = _getContracts(this.connection);

    return (await vaultManager.getVaultOwnersCount({ ...overrides })).toNumber();
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getPrice} */
  getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this.connection);

    return priceFeed.callStatic.fetchPrice({ ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getActivePool(overrides?: EthersCallOverrides): Promise<Vault> {
    const { activePool } = _getContracts(this.connection);

    const [activeCollateral, activeDebt] = await Promise.all(
      [
        activePool.getETH({ ...overrides }),
        activePool.getBPDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Vault(activeCollateral, activeDebt);
  }

  /** @internal */
  async _getDefaultPool(overrides?: EthersCallOverrides): Promise<Vault> {
    const { defaultPool } = _getContracts(this.connection);

    const [liquidatedCollateral, closedDebt] = await Promise.all(
      [
        defaultPool.getETH({ ...overrides }),
        defaultPool.getBPDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Vault(liquidatedCollateral, closedDebt);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getTotal} */
  async getTotal(overrides?: EthersCallOverrides): Promise<Vault> {
    const [activePool, defaultPool] = await Promise.all([
      this._getActivePool(overrides),
      this._getDefaultPool(overrides)
    ]);

    return activePool.add(defaultPool);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getStabilityDeposit} */
  async getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    address ??= _requireAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const [
      { frontEndTag, initialValue },
      currentBPD,
      collateralGain,
      mpReward
    ] = await Promise.all([
      stabilityPool.deposits(address, { ...overrides }),
      stabilityPool.getCompoundedBPDDeposit(address, { ...overrides }),
      stabilityPool.getDepositorETHGain(address, { ...overrides }),
      stabilityPool.getDepositorMPGain(address, { ...overrides })
    ]);

    return new StabilityDeposit(
      decimalify(initialValue),
      decimalify(currentBPD),
      decimalify(collateralGain),
      decimalify(mpReward),
      frontEndTag
    );
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getRemainingStabilityPoolMPReward} */
  async getRemainingStabilityPoolMPReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { communityIssuance } = _getContracts(this.connection);

    const issuanceCap = this.connection.totalStabilityPoolMPReward;
    const totalMPIssued = decimalify(await communityIssuance.totalMPIssued({ ...overrides }));

    // totalMPIssued approaches but never reaches issuanceCap
    return issuanceCap.sub(totalMPIssued);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getBPDInStabilityPool} */
  getBPDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { stabilityPool } = _getContracts(this.connection);

    return stabilityPool.getTotalBPDDeposits({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getBPDBalance} */
  getBPDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { bpdToken } = _getContracts(this.connection);

    return bpdToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getMPBalance} */
  getMPBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { mpToken } = _getContracts(this.connection);

    return mpToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getUniTokenBalance} */
  getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { uniToken } = _getContracts(this.connection);

    return uniToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getUniTokenAllowance} */
  getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { uniToken, unipool } = _getContracts(this.connection);

    return uniToken.allowance(address, unipool.address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getRemainingLiquidityMiningMPRewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    const { unipool } = _getContracts(this.connection);

    const [totalSupply, rewardRate, periodFinish, lastUpdateTime] = await Promise.all([
      unipool.totalSupply({ ...overrides }),
      unipool.rewardRate({ ...overrides }).then(decimalify),
      unipool.periodFinish({ ...overrides }).then(numberify),
      unipool.lastUpdateTime({ ...overrides }).then(numberify)
    ]);

    return (blockTimestamp: number) =>
      rewardRate.mul(
        Math.max(0, periodFinish - (totalSupply.isZero() ? lastUpdateTime : blockTimestamp))
      );
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getRemainingLiquidityMiningMPReward} */
  async getRemainingLiquidityMiningMPReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const [calculateRemainingMP, blockTimestamp] = await Promise.all([
      this._getRemainingLiquidityMiningMPRewardCalculator(overrides),
      _getBlockTimestamp(this.connection, overrides?.blockTag)
    ]);

    return calculateRemainingMP(blockTimestamp);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getLiquidityMiningStake} */
  getLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { unipool } = _getContracts(this.connection);

    return unipool.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getTotalStakedUniTokens} */
  getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { unipool } = _getContracts(this.connection);

    return unipool.totalSupply({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getLiquidityMiningMPReward} */
  getLiquidityMiningMPReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { unipool } = _getContracts(this.connection);

    return unipool.earned(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { collSurplusPool } = _getContracts(this.connection);

    return collSurplusPool.getCollateral(address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  getVaults(
    params: VaultListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<VaultWithPendingRedistribution[]>;

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.(getVaults:2)} */
  getVaults(params: VaultListingParams, overrides?: EthersCallOverrides): Promise<UserVault[]>;

  async getVaults(
    params: VaultListingParams,
    overrides?: EthersCallOverrides
  ): Promise<UserVault[]> {
    const { multiVaultGetter } = _getContracts(this.connection);

    expectPositiveInt(params, "first");
    expectPositiveInt(params, "startingAt");

    if (!validSortingOptions.includes(params.sortedBy)) {
      throw new Error(
        `sortedBy must be one of: ${validSortingOptions.map(x => `"${x}"`).join(", ")}`
      );
    }

    const [totalRedistributed, backendVaults] = await Promise.all([
      params.beforeRedistribution ? undefined : this.getTotalRedistributed({ ...overrides }),
      multiVaultGetter.getMultipleSortedVaults(
        params.sortedBy === "descendingCollateralRatio"
          ? params.startingAt ?? 0
          : -((params.startingAt ?? 0) + 1),
        params.first,
        { ...overrides }
      )
    ]);

    const vaults = mapBackendVaults(backendVaults);

    if (totalRedistributed) {
      return vaults.map(vault => vault.applyRedistribution(totalRedistributed));
    } else {
      return vaults;
    }
  }

  /** @internal */
  async _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    const { vaultManager } = _getContracts(this.connection);

    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      vaultManager.lastFeeOperationTime({ ...overrides }),
      vaultManager.baseRate({ ...overrides }).then(decimalify)
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

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getFees} */
  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    const [createFees, total, price, blockTimestamp] = await Promise.all([
      this._getFeesFactory(overrides),
      this.getTotal(overrides),
      this.getPrice(overrides),
      _getBlockTimestamp(this.connection, overrides?.blockTag)
    ]);

    return createFees(blockTimestamp, total.collateralRatioIsBelowCritical(price));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getMPStake} */
  async getMPStake(address?: string, overrides?: EthersCallOverrides): Promise<MPStake> {
    address ??= _requireAddress(this.connection);
    const { mpStaking } = _getContracts(this.connection);

    const [stakedMP, collateralGain, bpdGain] = await Promise.all(
      [
        mpStaking.stakes(address, { ...overrides }),
        mpStaking.getPendingETHGain(address, { ...overrides }),
        mpStaking.getPendingBPDGain(address, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new MPStake(stakedMP, collateralGain, bpdGain);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getTotalStakedMP} */
  async getTotalStakedMP(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { mpStaking } = _getContracts(this.connection);

    return mpStaking.totalMPStaked({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getFrontendStatus} */
  async getFrontendStatus(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<FrontendStatus> {
    address ??= _requireFrontendAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const { registered, kickbackRate } = await stabilityPool.frontEnds(address, { ...overrides });

    return registered
      ? { status: "registered", kickbackRate: decimalify(kickbackRate) }
      : { status: "unregistered" };
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type BackendVaults = Resolved<ReturnType<MultiVaultGetter["getMultipleSortedVaults"]>>;

const mapBackendVaults = (vaults: BackendVaults): VaultWithPendingRedistribution[] =>
  vaults.map(
    vault =>
      new VaultWithPendingRedistribution(
        vault.owner,
        "open", // These Vaults are coming from the SortedVaults list, so they must be open
        decimalify(vault.coll),
        decimalify(vault.debt),
        decimalify(vault.stake),
        new Vault(decimalify(vault.snapshotETH), decimalify(vault.snapshotBPDDebt))
      )
  );

/**
 * Variant of {@link ReadableEthersMoneyp} that exposes a {@link @liquity/lib-base#MoneypStore}.
 *
 * @public
 */
export interface ReadableEthersMoneypWithStore<T extends MoneypStore = MoneypStore>
  extends ReadableEthersMoneyp {
  /** An object that implements MoneypStore. */
  readonly store: T;
}

class BlockPolledMoneypStoreBasedCache
  implements _MoneypReadCache<[overrides?: EthersCallOverrides]> {
  private _store: BlockPolledMoneypStore;

  constructor(store: BlockPolledMoneypStore) {
    this._store = store;
  }

  private _blockHit(overrides?: EthersCallOverrides): boolean {
    return (
      !overrides ||
      overrides.blockTag === undefined ||
      overrides.blockTag === this._store.state.blockTag
    );
  }

  private _userHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this._store.connection.userAddress)
    );
  }

  private _frontendHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this._store.connection.frontendTag)
    );
  }

  getTotalRedistributed(overrides?: EthersCallOverrides): Vault | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.totalRedistributed;
    }
  }

  getVaultBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): VaultWithPendingRedistribution | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.vaultBeforeRedistribution;
    }
  }

  getVault(address?: string, overrides?: EthersCallOverrides): UserVault | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.vault;
    }
  }

  getNumberOfVaults(overrides?: EthersCallOverrides): number | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.numberOfVaults;
    }
  }

  getPrice(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.price;
    }
  }

  getTotal(overrides?: EthersCallOverrides): Vault | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.total;
    }
  }

  getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): StabilityDeposit | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.stabilityDeposit;
    }
  }

  getRemainingStabilityPoolMPReward(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.remainingStabilityPoolMPReward;
    }
  }

  getBPDInStabilityPool(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.bpdInStabilityPool;
    }
  }

  getBPDBalance(address?: string, overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.bpdBalance;
    }
  }

  getMPBalance(address?: string, overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.mpBalance;
    }
  }

  getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.uniTokenBalance;
    }
  }

  getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.uniTokenAllowance;
    }
  }

  getRemainingLiquidityMiningMPReward(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.remainingLiquidityMiningMPReward;
    }
  }

  getLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.liquidityMiningStake;
    }
  }

  getTotalStakedUniTokens(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.totalStakedUniTokens;
    }
  }

  getLiquidityMiningMPReward(
    address?: string,
    overrides?: EthersCallOverrides
  ): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.liquidityMiningMPReward;
    }
  }

  getCollateralSurplusBalance(
    address?: string,
    overrides?: EthersCallOverrides
  ): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.collateralSurplusBalance;
    }
  }

  getFees(overrides?: EthersCallOverrides): Fees | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.fees;
    }
  }

  getMPStake(address?: string, overrides?: EthersCallOverrides): MPStake | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.mpStake;
    }
  }

  getTotalStakedMP(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.totalStakedMP;
    }
  }

  getFrontendStatus(
    address?: string,
    overrides?: EthersCallOverrides
  ): { status: "unregistered" } | { status: "registered"; kickbackRate: Decimal } | undefined {
    if (this._frontendHit(address, overrides)) {
      return this._store.state.frontend;
    }
  }

  getVaults() {
    return undefined;
  }
}

class _BlockPolledReadableEthersMoneyp
  extends _CachedReadableMoneyp<[overrides?: EthersCallOverrides]>
  implements ReadableEthersMoneypWithStore<BlockPolledMoneypStore> {
  readonly connection: EthersMoneypConnection;
  readonly store: BlockPolledMoneypStore;

  constructor(readable: ReadableEthersMoneyp) {
    const store = new BlockPolledMoneypStore(readable);

    super(readable, new BlockPolledMoneypStoreBasedCache(store));

    this.store = store;
    this.connection = readable.connection;
  }

  hasStore(store?: EthersMoneypStoreOption): boolean {
    return store === undefined || store === "blockPolled";
  }

  _getActivePool(): Promise<Vault> {
    throw new Error("Method not implemented.");
  }

  _getDefaultPool(): Promise<Vault> {
    throw new Error("Method not implemented.");
  }

  _getFeesFactory(): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    throw new Error("Method not implemented.");
  }

  _getRemainingLiquidityMiningMPRewardCalculator(): Promise<(blockTimestamp: number) => Decimal> {
    throw new Error("Method not implemented.");
  }
}
