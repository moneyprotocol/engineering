import assert from "assert";

import { Decimal } from "./Decimal";
import { StabilityDeposit } from "./StabilityDeposit";
import { Vault, VaultWithPendingRedistribution, UserVault } from "./Vault";
import { Fees } from "./Fees";
import { MPStake } from "./MPStake";
import { FrontendStatus } from "./ReadableMoneyp";

/**
 * State variables read from the blockchain.
 *
 * @public
 */
export interface MoneypStoreBaseState {
  /** Status of currently used frontend. */
  frontend: FrontendStatus;

  /** Status of user's own frontend. */
  ownFrontend: FrontendStatus;

  /** Number of Vaults that are currently open. */
  numberOfVaults: number;

  /** User's native currency balance (e.g. Ether). */
  accountBalance: Decimal;

  /** User's BPD token balance. */
  bpdBalance: Decimal;

  /** User's MP token balance. */
  mpBalance: Decimal;

  /** User's Uniswap RBTC/BPD LP token balance. */
  rskSwapTokenBalance: Decimal;

  /** The liquidity mining contract's allowance of user's Uniswap RBTC/BPD LP tokens. */
  rskSwapTokenAllowance: Decimal;

  /** Remaining MP that will be collectively rewarded to liquidity miners. */
  remainingLiquidityMiningMPReward: Decimal;

  /** Amount of Uniswap RBTC/BPD LP tokens the user has staked in liquidity mining. */
  liquidityMiningStake: Decimal;

  /** Total amount of Uniswap RBTC/BPD LP tokens currently staked in liquidity mining. */
  totalStakedRskSwapTokens: Decimal;

  /** Amount of MP the user has earned through mining liquidity. */
  liquidityMiningMPReward: Decimal;

  /**
   * Amount of leftover collateral available for withdrawal to the user.
   *
   * @remarks
   * See {@link ReadableMoneyp.getCollateralSurplusBalance | getCollateralSurplusBalance()} for
   * more information.
   */
  collateralSurplusBalance: Decimal;

  /** Current price of the native currency (e.g. Ether) in USD. */
  price: Decimal;

  /** Total amount of BPD currently deposited in the Stability Pool. */
  bpdInStabilityPool: Decimal;

  /** Total collateral and debt in the Moneyp system. */
  total: Vault;

  /**
   * Total collateral and debt per stake that has been liquidated through redistribution.
   *
   * @remarks
   * Needed when dealing with instances of {@link VaultWithPendingRedistribution}.
   */
  totalRedistributed: Vault;

  /**
   * User's Vault in its state after the last direct modification.
   *
   * @remarks
   * The current state of the user's Vault can be found as
   * {@link MoneypStoreDerivedState.vault | vault}.
   */
  vaultBeforeRedistribution: VaultWithPendingRedistribution;

  /** User's stability deposit. */
  stabilityDeposit: StabilityDeposit;

  /** Remaining MP that will be collectively rewarded to stability depositors. */
  remainingStabilityPoolMPReward: Decimal;

  /** @internal */
  _feesInNormalMode: Fees;

  /** User's MP stake. */
  mpStake: MPStake;

  /** Total amount of MP currently staked. */
  totalStakedMP: Decimal;

  /** @internal */
  _riskiestVaultBeforeRedistribution: VaultWithPendingRedistribution;
}

/**
 * State variables derived from {@link MoneypStoreBaseState}.
 *
 * @public
 */
export interface MoneypStoreDerivedState {
  /** Current state of user's Vault */
  vault: UserVault;

  /** Calculator for current fees. */
  fees: Fees;

  /**
   * Current borrowing rate.
   *
   * @remarks
   * A value between 0 and 1.
   *
   * @example
   * For example a value of 0.01 amounts to a borrowing fee of 1% of the borrowed amount.
   */
  borrowingRate: Decimal;

  /**
   * Current redemption rate.
   *
   * @remarks
   * Note that the actual rate paid by a redemption transaction will depend on the amount of BPD
   * being redeemed.
   *
   * Use {@link Fees.redemptionRate} to calculate a precise redemption rate.
   */
  redemptionRate: Decimal;

  /**
   * Whether there are any Vaults with collateral ratio below the
   * {@link MINIMUM_COLLATERAL_RATIO | minimum}.
   */
  haveUndercollateralizedVaults: boolean;
}

/**
 * Type of {@link MoneypStore}'s {@link MoneypStore.state | state}.
 *
 * @remarks
 * It combines all properties of {@link MoneypStoreBaseState} and {@link MoneypStoreDerivedState}
 * with optional extra state added by the particular `MoneypStore` implementation.
 *
 * The type parameter `T` may be used to type the extra state.
 *
 * @public
 */
export type MoneypStoreState<T = unknown> = MoneypStoreBaseState & MoneypStoreDerivedState & T;

/**
 * Parameters passed to {@link MoneypStore} listeners.
 *
 * @remarks
 * Use the {@link MoneypStore.subscribe | subscribe()} function to register a listener.

 * @public
 */
export interface MoneypStoreListenerParams<T = unknown> {
  /** The entire previous state. */
  newState: MoneypStoreState<T>;

  /** The entire new state. */
  oldState: MoneypStoreState<T>;

  /** Only the state variables that have changed. */
  stateChange: Partial<MoneypStoreState<T>>;
}

const strictEquals = <T>(a: T, b: T) => a === b;
const eq = <T extends { eq(that: T): boolean }>(a: T, b: T) => a.eq(b);
const equals = <T extends { equals(that: T): boolean }>(a: T, b: T) => a.equals(b);

const frontendStatusEquals = (a: FrontendStatus, b: FrontendStatus) =>
  a.status === "unregistered"
    ? b.status === "unregistered"
    : b.status === "registered" && a.kickbackRate.eq(b.kickbackRate);

const showFrontendStatus = (x: FrontendStatus) =>
  x.status === "unregistered"
    ? '{ status: "unregistered" }'
    : `{ status: "registered", kickbackRate: ${x.kickbackRate} }`;

const wrap = <A extends unknown[], R>(f: (...args: A) => R) => (...args: A) => f(...args);

const difference = <T>(a: T, b: T) =>
  Object.fromEntries(
    Object.entries(a).filter(([key, value]) => value !== (b as Record<string, unknown>)[key])
  ) as Partial<T>;

/**
 * Abstract base class of Moneyp data store implementations.
 *
 * @remarks
 * The type parameter `T` may be used to type extra state added to {@link MoneypStoreState} by the
 * subclass.
 *
 * Implemented by {@link @moneyprotocol/lib-ethers#BlockPolledMoneypStore}.
 *
 * @public
 */
export abstract class MoneypStore<T = unknown> {
  /** Turn console logging on/off. */
  logging = false;

  /**
   * Called after the state is fetched for the first time.
   *
   * @remarks
   * See {@link MoneypStore.start | start()}.
   */
  onLoaded?: () => void;

  /** @internal */
  protected _loaded = false;

  private _baseState?: MoneypStoreBaseState;
  private _derivedState?: MoneypStoreDerivedState;
  private _extraState?: T;

  private _updateTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private _listeners = new Set<(params: MoneypStoreListenerParams<T>) => void>();

  /**
   * The current store state.
   *
   * @remarks
   * Should not be accessed before the store is loaded. Assign a function to
   * {@link MoneypStore.onLoaded | onLoaded} to get a callback when this happens.
   *
   * See {@link MoneypStoreState} for the list of properties returned.
   */
  get state(): MoneypStoreState<T> {
    return Object.assign({}, this._baseState, this._derivedState, this._extraState);
  }

  /** @internal */
  protected abstract _doStart(): () => void;

  /**
   * Start monitoring the blockchain for Moneyp state changes.
   *
   * @remarks
   * The {@link MoneypStore.onLoaded | onLoaded} callback will be called after the state is fetched
   * for the first time.
   *
   * Use the {@link MoneypStore.subscribe | subscribe()} function to register listeners.
   *
   * @returns Function to stop the monitoring.
   */
  start(): () => void {
    const doStop = this._doStart();

    return () => {
      doStop();

      this._cancelUpdateIfScheduled();
    };
  }

  private _cancelUpdateIfScheduled() {
    if (this._updateTimeoutId !== undefined) {
      clearTimeout(this._updateTimeoutId);
    }
  }

  private _scheduleUpdate() {
    this._cancelUpdateIfScheduled();

    this._updateTimeoutId = setTimeout(() => {
      this._updateTimeoutId = undefined;
      this._update();
    }, 30000);
  }

  private _logUpdate<U>(name: string, next: U, show?: (next: U) => string): U {
    if (this.logging) {
      console.log(`${name} updated to ${show ? show(next) : next}`);
    }

    return next;
  }

  private _updateIfChanged<U>(
    equals: (a: U, b: U) => boolean,
    name: string,
    prev: U,
    next?: U,
    show?: (next: U) => string
  ): U {
    return next !== undefined && !equals(prev, next) ? this._logUpdate(name, next, show) : prev;
  }

  private _silentlyUpdateIfChanged<U>(equals: (a: U, b: U) => boolean, prev: U, next?: U): U {
    return next !== undefined && !equals(prev, next) ? next : prev;
  }

  private _updateFees(name: string, prev: Fees, next?: Fees): Fees {
    if (next && !next.equals(prev)) {
      // Filter out fee update spam that happens on every new block by only logging when string
      // representation changes.
      if (`${next}` !== `${prev}`) {
        this._logUpdate(name, next);
      }
      return next;
    } else {
      return prev;
    }
  }

  private _reduce(
    baseState: MoneypStoreBaseState,
    baseStateUpdate: Partial<MoneypStoreBaseState>
  ): MoneypStoreBaseState {
    return {
      frontend: this._updateIfChanged(
        frontendStatusEquals,
        "frontend",
        baseState.frontend,
        baseStateUpdate.frontend,
        showFrontendStatus
      ),

      ownFrontend: this._updateIfChanged(
        frontendStatusEquals,
        "ownFrontend",
        baseState.ownFrontend,
        baseStateUpdate.ownFrontend,
        showFrontendStatus
      ),

      numberOfVaults: this._updateIfChanged(
        strictEquals,
        "numberOfVaults",
        baseState.numberOfVaults,
        baseStateUpdate.numberOfVaults
      ),

      accountBalance: this._updateIfChanged(
        eq,
        "accountBalance",
        baseState.accountBalance,
        baseStateUpdate.accountBalance
      ),

      bpdBalance: this._updateIfChanged(
        eq,
        "bpdBalance",
        baseState.bpdBalance,
        baseStateUpdate.bpdBalance
      ),

      mpBalance: this._updateIfChanged(
        eq,
        "mpBalance",
        baseState.mpBalance,
        baseStateUpdate.mpBalance
      ),

      rskSwapTokenBalance: this._updateIfChanged(
        eq,
        "rskSwapTokenBalance",
        baseState.rskSwapTokenBalance,
        baseStateUpdate.rskSwapTokenBalance
      ),

      rskSwapTokenAllowance: this._updateIfChanged(
        eq,
        "rskSwapTokenAllowance",
        baseState.rskSwapTokenAllowance,
        baseStateUpdate.rskSwapTokenAllowance
      ),

      remainingLiquidityMiningMPReward: this._silentlyUpdateIfChanged(
        eq,
        baseState.remainingLiquidityMiningMPReward,
        baseStateUpdate.remainingLiquidityMiningMPReward
      ),

      liquidityMiningStake: this._updateIfChanged(
        eq,
        "liquidityMiningStake",
        baseState.liquidityMiningStake,
        baseStateUpdate.liquidityMiningStake
      ),

      totalStakedRskSwapTokens: this._updateIfChanged(
        eq,
        "totalStakedRskSwapTokens",
        baseState.totalStakedRskSwapTokens,
        baseStateUpdate.totalStakedRskSwapTokens
      ),

      liquidityMiningMPReward: this._silentlyUpdateIfChanged(
        eq,
        baseState.liquidityMiningMPReward,
        baseStateUpdate.liquidityMiningMPReward
      ),

      collateralSurplusBalance: this._updateIfChanged(
        eq,
        "collateralSurplusBalance",
        baseState.collateralSurplusBalance,
        baseStateUpdate.collateralSurplusBalance
      ),

      price: this._updateIfChanged(eq, "price", baseState.price, baseStateUpdate.price),

      bpdInStabilityPool: this._updateIfChanged(
        eq,
        "bpdInStabilityPool",
        baseState.bpdInStabilityPool,
        baseStateUpdate.bpdInStabilityPool
      ),

      total: this._updateIfChanged(equals, "total", baseState.total, baseStateUpdate.total),

      totalRedistributed: this._updateIfChanged(
        equals,
        "totalRedistributed",
        baseState.totalRedistributed,
        baseStateUpdate.totalRedistributed
      ),

      vaultBeforeRedistribution: this._updateIfChanged(
        equals,
        "vaultBeforeRedistribution",
        baseState.vaultBeforeRedistribution,
        baseStateUpdate.vaultBeforeRedistribution
      ),

      stabilityDeposit: this._updateIfChanged(
        equals,
        "stabilityDeposit",
        baseState.stabilityDeposit,
        baseStateUpdate.stabilityDeposit
      ),

      remainingStabilityPoolMPReward: this._silentlyUpdateIfChanged(
        eq,
        baseState.remainingStabilityPoolMPReward,
        baseStateUpdate.remainingStabilityPoolMPReward
      ),

      _feesInNormalMode: this._silentlyUpdateIfChanged(
        equals,
        baseState._feesInNormalMode,
        baseStateUpdate._feesInNormalMode
      ),

      mpStake: this._updateIfChanged(
        equals,
        "mpStake",
        baseState.mpStake,
        baseStateUpdate.mpStake
      ),

      totalStakedMP: this._updateIfChanged(
        eq,
        "totalStakedMP",
        baseState.totalStakedMP,
        baseStateUpdate.totalStakedMP
      ),

      _riskiestVaultBeforeRedistribution: this._silentlyUpdateIfChanged(
        equals,
        baseState._riskiestVaultBeforeRedistribution,
        baseStateUpdate._riskiestVaultBeforeRedistribution
      )
    };
  }

  private _derive({
    vaultBeforeRedistribution,
    totalRedistributed,
    _feesInNormalMode,
    total,
    price,
    _riskiestVaultBeforeRedistribution
  }: MoneypStoreBaseState): MoneypStoreDerivedState {
    const fees = _feesInNormalMode._setRecoveryMode(total.collateralRatioIsBelowCritical(price));

    return {
      vault: vaultBeforeRedistribution.applyRedistribution(totalRedistributed),
      fees,
      borrowingRate: fees.borrowingRate(),
      redemptionRate: fees.redemptionRate(),
      haveUndercollateralizedVaults: _riskiestVaultBeforeRedistribution
        .applyRedistribution(totalRedistributed)
        .collateralRatioIsBelowMinimum(price)
    };
  }

  private _reduceDerived(
    derivedState: MoneypStoreDerivedState,
    derivedStateUpdate: MoneypStoreDerivedState
  ): MoneypStoreDerivedState {
    return {
      fees: this._updateFees("fees", derivedState.fees, derivedStateUpdate.fees),

      vault: this._updateIfChanged(equals, "vault", derivedState.vault, derivedStateUpdate.vault),

      borrowingRate: this._silentlyUpdateIfChanged(
        eq,
        derivedState.borrowingRate,
        derivedStateUpdate.borrowingRate
      ),

      redemptionRate: this._silentlyUpdateIfChanged(
        eq,
        derivedState.redemptionRate,
        derivedStateUpdate.redemptionRate
      ),

      haveUndercollateralizedVaults: this._updateIfChanged(
        strictEquals,
        "haveUndercollateralizedVaults",
        derivedState.haveUndercollateralizedVaults,
        derivedStateUpdate.haveUndercollateralizedVaults
      )
    };
  }

  /** @internal */
  protected abstract _reduceExtra(extraState: T, extraStateUpdate: Partial<T>): T;

  private _notify(params: MoneypStoreListenerParams<T>) {
    // Iterate on a copy of `_listeners`, to avoid notifying any new listeners subscribed by
    // existing listeners, as that could result in infinite loops.
    //
    // Before calling a listener from our copy of `_listeners`, check if it has been removed from
    // the original set. This way we avoid calling listeners that have already been unsubscribed
    // by an earlier listener callback.
    [...this._listeners].forEach(listener => {
      if (this._listeners.has(listener)) {
        listener(params);
      }
    });
  }

  /**
   * Register a state change listener.
   *
   * @param listener - Function that will be called whenever state changes.
   * @returns Function to unregister this listener.
   */
  subscribe(listener: (params: MoneypStoreListenerParams<T>) => void): () => void {
    const uniqueListener = wrap(listener);

    this._listeners.add(uniqueListener);

    return () => {
      this._listeners.delete(uniqueListener);
    };
  }

  /** @internal */
  protected _load(baseState: MoneypStoreBaseState, extraState?: T): void {
    assert(!this._loaded);

    this._baseState = baseState;
    this._derivedState = this._derive(baseState);
    this._extraState = extraState;
    this._loaded = true;

    this._scheduleUpdate();

    if (this.onLoaded) {
      this.onLoaded();
    }
  }

  /** @internal */
  protected _update(
    baseStateUpdate?: Partial<MoneypStoreBaseState>,
    extraStateUpdate?: Partial<T>
  ): void {
    assert(this._baseState && this._derivedState);

    const oldState = this.state;

    if (baseStateUpdate) {
      this._baseState = this._reduce(this._baseState, baseStateUpdate);
    }

    // Always running this lets us derive state based on passage of time, like baseRate decay
    this._derivedState = this._reduceDerived(this._derivedState, this._derive(this._baseState));

    if (extraStateUpdate) {
      assert(this._extraState);
      this._extraState = this._reduceExtra(this._extraState, extraStateUpdate);
    }

    this._scheduleUpdate();

    this._notify({
      newState: this.state,
      oldState,
      stateChange: difference(this.state, oldState)
    });
  }
}
