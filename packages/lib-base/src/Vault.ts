import assert from "assert";

import { Decimal, Decimalish } from "./Decimal";

import {
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  BPD_LIQUIDATION_RESERVE,
  MINIMUM_BORROWING_RATE
} from "./constants";

/** @internal */ export type _CollateralDeposit<T> = { depositCollateral: T };
/** @internal */ export type _CollateralWithdrawal<T> = { withdrawCollateral: T };
/** @internal */ export type _BPDBorrowing<T> = { borrowBPD: T };
/** @internal */ export type _BPDRepayment<T> = { repayBPD: T };

/** @internal */ export type _NoCollateralDeposit = Partial<_CollateralDeposit<undefined>>;
/** @internal */ export type _NoCollateralWithdrawal = Partial<_CollateralWithdrawal<undefined>>;
/** @internal */ export type _NoBPDBorrowing = Partial<_BPDBorrowing<undefined>>;
/** @internal */ export type _NoBPDRepayment = Partial<_BPDRepayment<undefined>>;

/** @internal */
export type _CollateralChange<T> =
  | (_CollateralDeposit<T> & _NoCollateralWithdrawal)
  | (_CollateralWithdrawal<T> & _NoCollateralDeposit);

/** @internal */
export type _NoCollateralChange = _NoCollateralDeposit & _NoCollateralWithdrawal;

/** @internal */
export type _DebtChange<T> =
  | (_BPDBorrowing<T> & _NoBPDRepayment)
  | (_BPDRepayment<T> & _NoBPDBorrowing);

/** @internal */
export type _NoDebtChange = _NoBPDBorrowing & _NoBPDRepayment;

/**
 * Parameters of an {@link TransactableMoneyp.openVault | openVault()} transaction.
 *
 * @remarks
 * The type parameter `T` specifies the allowed value type(s) of the particular `VaultCreationParams`
 * object's properties.
 *
 * <h2>Properties</h2>
 *
 * <table>
 *
 *   <tr>
 *     <th> Property </th>
 *     <th> Type </th>
 *     <th> Description </th>
 *   </tr>
 *
 *   <tr>
 *     <td> depositCollateral </td>
 *     <td> T </td>
 *     <td> The amount of collateral that's deposited. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> borrowBPD </td>
 *     <td> T </td>
 *     <td> The amount of BPD that's borrowed. </td>
 *   </tr>
 *
 * </table>
 *
 * @public
 */
export type VaultCreationParams<T = unknown> = _CollateralDeposit<T> &
  _NoCollateralWithdrawal &
  _BPDBorrowing<T> &
  _NoBPDRepayment;

/**
 * Parameters of a {@link TransactableMoneyp.closeVault | closeVault()} transaction.
 *
 * @remarks
 * The type parameter `T` specifies the allowed value type(s) of the particular `VaultClosureParams`
 * object's properties.
 *
 * <h2>Properties</h2>
 *
 * <table>
 *
 *   <tr>
 *     <th> Property </th>
 *     <th> Type </th>
 *     <th> Description </th>
 *   </tr>
 *
 *   <tr>
 *     <td> withdrawCollateral </td>
 *     <td> T </td>
 *     <td> The amount of collateral that's withdrawn. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> repayBPD? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of BPD that's repaid. </td>
 *   </tr>
 *
 * </table>
 *
 * @public
 */
export type VaultClosureParams<T> = _CollateralWithdrawal<T> &
  _NoCollateralDeposit &
  Partial<_BPDRepayment<T>> &
  _NoBPDBorrowing;

/**
 * Parameters of an {@link TransactableMoneyp.adjustVault | adjustVault()} transaction.
 *
 * @remarks
 * The type parameter `T` specifies the allowed value type(s) of the particular
 * `VaultAdjustmentParams` object's properties.
 *
 * Even though all properties are optional, a valid `VaultAdjustmentParams` object must define at
 * least one.
 *
 * Defining both `depositCollateral` and `withdrawCollateral`, or both `borrowBPD` and `repayBPD`
 * at the same time is disallowed, and will result in a type-checking error.
 *
 * <h2>Properties</h2>
 *
 * <table>
 *
 *   <tr>
 *     <th> Property </th>
 *     <th> Type </th>
 *     <th> Description </th>
 *   </tr>
 *
 *   <tr>
 *     <td> depositCollateral? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of collateral that's deposited. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> withdrawCollateral? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of collateral that's withdrawn. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> borrowBPD? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of BPD that's borrowed. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> repayBPD? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of BPD that's repaid. </td>
 *   </tr>
 *
 * </table>
 *
 * @public
 */
export type VaultAdjustmentParams<T = unknown> =
  | (_CollateralChange<T> & _NoDebtChange)
  | (_DebtChange<T> & _NoCollateralChange)
  | (_CollateralChange<T> & _DebtChange<T>);

/**
 * Describes why a Vault could not be created.
 *
 * @remarks
 * See {@link VaultChange}.
 *
 * <h2>Possible values</h2>
 *
 * <table>
 *
 *   <tr>
 *     <th> Value </th>
 *     <th> Reason </th>
 *   </tr>
 *
 *   <tr>
 *     <td> "missingLiquidationReserve" </td>
 *     <td> A Vault's debt cannot be less than the liquidation reserve. </td>
 *   </tr>
 *
 * </table>
 *
 * More errors may be added in the future.
 *
 * @public
 */
export type VaultCreationError = "missingLiquidationReserve";

/**
 * Represents the change between two Vault states.
 *
 * @remarks
 * Returned by {@link Vault.whatChanged}.
 *
 * Passed as a parameter to {@link Vault.apply}.
 *
 * @public
 */
export type VaultChange<T> =
  | { type: "invalidCreation"; invalidVault: Vault; error: VaultCreationError }
  | { type: "creation"; params: VaultCreationParams<T> }
  | { type: "closure"; params: VaultClosureParams<T> }
  | { type: "adjustment"; params: VaultAdjustmentParams<T>; setToZero?: "collateral" | "debt" };

// This might seem backwards, but this way we avoid spamming the .d.ts and generated docs
type InvalidVaultCreation = Extract<VaultChange<never>, { type: "invalidCreation" }>;
type VaultCreation<T> = Extract<VaultChange<T>, { type: "creation" }>;
type VaultClosure<T> = Extract<VaultChange<T>, { type: "closure" }>;
type VaultAdjustment<T> = Extract<VaultChange<T>, { type: "adjustment" }>;

const invalidVaultCreation = (
  invalidVault: Vault,
  error: VaultCreationError
): InvalidVaultCreation => ({
  type: "invalidCreation",
  invalidVault,
  error
});

const vaultCreation = <T>(params: VaultCreationParams<T>): VaultCreation<T> => ({
  type: "creation",
  params
});

const vaultClosure = <T>(params: VaultClosureParams<T>): VaultClosure<T> => ({
  type: "closure",
  params
});

const vaultAdjustment = <T>(
  params: VaultAdjustmentParams<T>,
  setToZero?: "collateral" | "debt"
): VaultAdjustment<T> => ({
  type: "adjustment",
  params,
  setToZero
});

const valueIsDefined = <T>(entry: [string, T | undefined]): entry is [string, T] =>
  entry[1] !== undefined;

type AllowedKey<T> = Exclude<
  {
    [P in keyof T]: T[P] extends undefined ? never : P;
  }[keyof T],
  undefined
>;

const allowedVaultCreationKeys: AllowedKey<VaultCreationParams>[] = [
  "depositCollateral",
  "borrowBPD"
];

function checkAllowedVaultCreationKeys<T>(
  entries: [string, T][]
): asserts entries is [AllowedKey<VaultCreationParams>, T][] {
  const badKeys = entries
    .filter(([k]) => !(allowedVaultCreationKeys as string[]).includes(k))
    .map(([k]) => `'${k}'`);

  if (badKeys.length > 0) {
    throw new Error(`VaultCreationParams: property ${badKeys.join(", ")} not allowed`);
  }
}

const vaultCreationParamsFromEntries = <T>(
  entries: [AllowedKey<VaultCreationParams>, T][]
): VaultCreationParams<T> => {
  const params = Object.fromEntries(entries) as Record<AllowedKey<VaultCreationParams>, T>;
  const missingKeys = allowedVaultCreationKeys.filter(k => !(k in params)).map(k => `'${k}'`);

  if (missingKeys.length > 0) {
    throw new Error(`VaultCreationParams: property ${missingKeys.join(", ")} missing`);
  }

  return params;
};

const decimalize = <T>([k, v]: [T, Decimalish]): [T, Decimal] => [k, Decimal.from(v)];
const nonZero = <T>([, v]: [T, Decimal]): boolean => !v.isZero;

/** @internal */
export const _normalizeVaultCreation = (
  params: Record<string, Decimalish | undefined>
): VaultCreationParams<Decimal> => {
  const definedEntries = Object.entries(params).filter(valueIsDefined);
  checkAllowedVaultCreationKeys(definedEntries);
  const nonZeroEntries = definedEntries.map(decimalize);

  return vaultCreationParamsFromEntries(nonZeroEntries);
};

const allowedVaultAdjustmentKeys: AllowedKey<VaultAdjustmentParams>[] = [
  "depositCollateral",
  "withdrawCollateral",
  "borrowBPD",
  "repayBPD"
];

function checkAllowedVaultAdjustmentKeys<T>(
  entries: [string, T][]
): asserts entries is [AllowedKey<VaultAdjustmentParams>, T][] {
  const badKeys = entries
    .filter(([k]) => !(allowedVaultAdjustmentKeys as string[]).includes(k))
    .map(([k]) => `'${k}'`);

  if (badKeys.length > 0) {
    throw new Error(`VaultAdjustmentParams: property ${badKeys.join(", ")} not allowed`);
  }
}

const collateralChangeFrom = <T>({
  depositCollateral,
  withdrawCollateral
}: Partial<Record<AllowedKey<VaultAdjustmentParams>, T>>): _CollateralChange<T> | undefined => {
  if (depositCollateral !== undefined && withdrawCollateral !== undefined) {
    throw new Error(
      "VaultAdjustmentParams: 'depositCollateral' and 'withdrawCollateral' " +
        "can't be present at the same time"
    );
  }

  if (depositCollateral !== undefined) {
    return { depositCollateral };
  }

  if (withdrawCollateral !== undefined) {
    return { withdrawCollateral };
  }
};

const debtChangeFrom = <T>({
  borrowBPD,
  repayBPD
}: Partial<Record<AllowedKey<VaultAdjustmentParams>, T>>): _DebtChange<T> | undefined => {
  if (borrowBPD !== undefined && repayBPD !== undefined) {
    throw new Error(
      "VaultAdjustmentParams: 'borrowBPD' and 'repayBPD' can't be present at the same time"
    );
  }

  if (borrowBPD !== undefined) {
    return { borrowBPD };
  }

  if (repayBPD !== undefined) {
    return { repayBPD };
  }
};

const vaultAdjustmentParamsFromEntries = <T>(
  entries: [AllowedKey<VaultAdjustmentParams>, T][]
): VaultAdjustmentParams<T> => {
  const params = Object.fromEntries(entries) as Partial<
    Record<AllowedKey<VaultAdjustmentParams>, T>
  >;

  const collateralChange = collateralChangeFrom(params);
  const debtChange = debtChangeFrom(params);

  if (collateralChange !== undefined && debtChange !== undefined) {
    return { ...collateralChange, ...debtChange };
  }

  if (collateralChange !== undefined) {
    return collateralChange;
  }

  if (debtChange !== undefined) {
    return debtChange;
  }

  throw new Error("VaultAdjustmentParams: must include at least one non-zero parameter");
};

/** @internal */
export const _normalizeVaultAdjustment = (
  params: Record<string, Decimalish | undefined>
): VaultAdjustmentParams<Decimal> => {
  const definedEntries = Object.entries(params).filter(valueIsDefined);
  checkAllowedVaultAdjustmentKeys(definedEntries);
  const nonZeroEntries = definedEntries.map(decimalize).filter(nonZero);

  return vaultAdjustmentParamsFromEntries(nonZeroEntries);
};

const applyFee = (borrowingRate: Decimalish, debtIncrease: Decimal) =>
  debtIncrease.mul(Decimal.ONE.add(borrowingRate));

const unapplyFee = (borrowingRate: Decimalish, debtIncrease: Decimal) =>
  debtIncrease._divCeil(Decimal.ONE.add(borrowingRate));

const NOMINAL_COLLATERAL_RATIO_PRECISION = Decimal.from(100);

/**
 * A combination of collateral and debt.
 *
 * @public
 */
export class Vault {
  /** Amount of native currency (e.g. Ether) collateralized. */
  readonly collateral: Decimal;

  /** Amount of BPD owed. */
  readonly debt: Decimal;

  /** @internal */
  constructor(collateral = Decimal.ZERO, debt = Decimal.ZERO) {
    this.collateral = collateral;
    this.debt = debt;
  }

  get isEmpty(): boolean {
    return this.collateral.isZero && this.debt.isZero;
  }

  /**
   * Amount of BPD that must be repaid to close this Vault.
   *
   * @remarks
   * This doesn't include the liquidation reserve, which is refunded in case of normal closure.
   */
  get netDebt(): Decimal {
    if (this.debt.lt(BPD_LIQUIDATION_RESERVE)) {
      throw new Error(`netDebt should not be used when debt < ${BPD_LIQUIDATION_RESERVE}`);
    }

    return this.debt.sub(BPD_LIQUIDATION_RESERVE);
  }

  /** @internal */
  get _nominalCollateralRatio(): Decimal {
    return this.collateral.mulDiv(NOMINAL_COLLATERAL_RATIO_PRECISION, this.debt);
  }

  /** Calculate the Vault's collateralization ratio at a given price. */
  collateralRatio(price: Decimalish): Decimal {
    return this.collateral.mulDiv(price, this.debt);
  }

  /**
   * Whether the Vault is undercollateralized at a given price.
   *
   * @returns
   * `true` if the Vault's collateralization ratio is less than the
   * {@link MINIMUM_COLLATERAL_RATIO}.
   */
  collateralRatioIsBelowMinimum(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(MINIMUM_COLLATERAL_RATIO);
  }

  /**
   * Whether the collateralization ratio is less than the {@link CRITICAL_COLLATERAL_RATIO} at a
   * given price.
   *
   * @example
   * Can be used to check whether the Moneyp protocol is in recovery mode by using it on the return
   * value of {@link ReadableMoneyp.getTotal | getTotal()}. For example:
   *
   * ```typescript
   * const total = await moneyp.getTotal();
   * const price = await moneyp.getPrice();
   *
   * if (total.collateralRatioIsBelowCritical(price)) {
   *   // Recovery mode is active
   * }
   * ```
   */
  collateralRatioIsBelowCritical(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(CRITICAL_COLLATERAL_RATIO);
  }

  /** Whether the Vault is sufficiently collateralized to be opened during recovery mode. */
  isOpenableInRecoveryMode(price: Decimalish): boolean {
    return this.collateralRatio(price).gte(CRITICAL_COLLATERAL_RATIO);
  }

  /** @internal */
  toString(): string {
    return `{ collateral: ${this.collateral}, debt: ${this.debt} }`;
  }

  equals(that: Vault): boolean {
    return this.collateral.eq(that.collateral) && this.debt.eq(that.debt);
  }

  add(that: Vault): Vault {
    return new Vault(this.collateral.add(that.collateral), this.debt.add(that.debt));
  }

  addCollateral(collateral: Decimalish): Vault {
    return new Vault(this.collateral.add(collateral), this.debt);
  }

  addDebt(debt: Decimalish): Vault {
    return new Vault(this.collateral, this.debt.add(debt));
  }

  subtract(that: Vault): Vault {
    const { collateral, debt } = that;

    return new Vault(
      this.collateral.gt(collateral) ? this.collateral.sub(collateral) : Decimal.ZERO,
      this.debt.gt(debt) ? this.debt.sub(debt) : Decimal.ZERO
    );
  }

  subtractCollateral(collateral: Decimalish): Vault {
    return new Vault(
      this.collateral.gt(collateral) ? this.collateral.sub(collateral) : Decimal.ZERO,
      this.debt
    );
  }

  subtractDebt(debt: Decimalish): Vault {
    return new Vault(this.collateral, this.debt.gt(debt) ? this.debt.sub(debt) : Decimal.ZERO);
  }

  multiply(multiplier: Decimalish): Vault {
    return new Vault(this.collateral.mul(multiplier), this.debt.mul(multiplier));
  }

  setCollateral(collateral: Decimalish): Vault {
    return new Vault(Decimal.from(collateral), this.debt);
  }

  setDebt(debt: Decimalish): Vault {
    return new Vault(this.collateral, Decimal.from(debt));
  }

  private _debtChange({ debt }: Vault, borrowingRate: Decimalish): _DebtChange<Decimal> {
    return debt.gt(this.debt)
      ? { borrowBPD: unapplyFee(borrowingRate, debt.sub(this.debt)) }
      : { repayBPD: this.debt.sub(debt) };
  }

  private _collateralChange({ collateral }: Vault): _CollateralChange<Decimal> {
    return collateral.gt(this.collateral)
      ? { depositCollateral: collateral.sub(this.collateral) }
      : { withdrawCollateral: this.collateral.sub(collateral) };
  }

  /**
   * Calculate the difference between this Vault and another.
   *
   * @param that - The other Vault.
   * @param borrowingRate - Borrowing rate to use when calculating a borrowed amount.
   *
   * @returns
   * An object representing the change, or `undefined` if the Vaults are equal.
   */
  whatChanged(
    that: Vault,
    borrowingRate: Decimalish = MINIMUM_BORROWING_RATE
  ): VaultChange<Decimal> | undefined {
    if (this.collateral.eq(that.collateral) && this.debt.eq(that.debt)) {
      return undefined;
    }

    if (this.isEmpty) {
      if (that.debt.lt(BPD_LIQUIDATION_RESERVE)) {
        return invalidVaultCreation(that, "missingLiquidationReserve");
      }

      return vaultCreation({
        depositCollateral: that.collateral,
        borrowBPD: unapplyFee(borrowingRate, that.netDebt)
      });
    }

    if (that.isEmpty) {
      return vaultClosure(
        this.netDebt.nonZero
          ? { withdrawCollateral: this.collateral, repayBPD: this.netDebt }
          : { withdrawCollateral: this.collateral }
      );
    }

    return this.collateral.eq(that.collateral)
      ? vaultAdjustment<Decimal>(this._debtChange(that, borrowingRate), that.debt.zero && "debt")
      : this.debt.eq(that.debt)
      ? vaultAdjustment<Decimal>(this._collateralChange(that), that.collateral.zero && "collateral")
      : vaultAdjustment<Decimal>(
          {
            ...this._debtChange(that, borrowingRate),
            ...this._collateralChange(that)
          },
          (that.debt.zero && "debt") ?? (that.collateral.zero && "collateral")
        );
  }

  /**
   * Make a new Vault by applying a {@link VaultChange} to this Vault.
   *
   * @param change - The change to apply.
   * @param borrowingRate - Borrowing rate to use when adding a borrowed amount to the Vault's debt.
   */
  apply(
    change: VaultChange<Decimal> | undefined,
    borrowingRate: Decimalish = MINIMUM_BORROWING_RATE
  ): Vault {
    if (!change) {
      return this;
    }

    switch (change.type) {
      case "invalidCreation":
        if (!this.isEmpty) {
          throw new Error("Can't create onto existing Vault");
        }

        return change.invalidVault;

      case "creation": {
        if (!this.isEmpty) {
          throw new Error("Can't create onto existing Vault");
        }

        const { depositCollateral, borrowBPD } = change.params;

        return new Vault(
          depositCollateral,
          BPD_LIQUIDATION_RESERVE.add(applyFee(borrowingRate, borrowBPD))
        );
      }

      case "closure":
        if (this.isEmpty) {
          throw new Error("Can't close empty Vault");
        }

        return _emptyVault;

      case "adjustment": {
        const {
          setToZero,
          params: { depositCollateral, withdrawCollateral, borrowBPD, repayBPD }
        } = change;

        const collateralDecrease = withdrawCollateral ?? Decimal.ZERO;
        const collateralIncrease = depositCollateral ?? Decimal.ZERO;
        const debtDecrease = repayBPD ?? Decimal.ZERO;
        const debtIncrease = borrowBPD ? applyFee(borrowingRate, borrowBPD) : Decimal.ZERO;

        return setToZero === "collateral"
          ? this.setCollateral(Decimal.ZERO).addDebt(debtIncrease).subtractDebt(debtDecrease)
          : setToZero === "debt"
          ? this.setDebt(Decimal.ZERO)
              .addCollateral(collateralIncrease)
              .subtractCollateral(collateralDecrease)
          : this.add(new Vault(collateralIncrease, debtIncrease)).subtract(
              new Vault(collateralDecrease, debtDecrease)
            );
      }
    }
  }

  /**
   * Calculate the result of an {@link TransactableMoneyp.openVault | openVault()} transaction.
   *
   * @param params - Parameters of the transaction.
   * @param borrowingRate - Borrowing rate to use when calculating the Vault's debt.
   */
  static create(params: VaultCreationParams<Decimalish>, borrowingRate?: Decimalish): Vault {
    return _emptyVault.apply(vaultCreation(_normalizeVaultCreation(params)), borrowingRate);
  }

  /**
   * Calculate the parameters of an {@link TransactableMoneyp.openVault | openVault()} transaction
   * that will result in the given Vault.
   *
   * @param that - The Vault to recreate.
   * @param borrowingRate - Current borrowing rate.
   */
  static recreate(that: Vault, borrowingRate?: Decimalish): VaultCreationParams<Decimal> {
    const change = _emptyVault.whatChanged(that, borrowingRate);
    assert(change?.type === "creation");
    return change.params;
  }

  /**
   * Calculate the result of an {@link TransactableMoneyp.adjustVault | adjustVault()} transaction
   * on this Vault.
   *
   * @param params - Parameters of the transaction.
   * @param borrowingRate - Borrowing rate to use when adding to the Vault's debt.
   */
  adjust(params: VaultAdjustmentParams<Decimalish>, borrowingRate?: Decimalish): Vault {
    return this.apply(vaultAdjustment(_normalizeVaultAdjustment(params)), borrowingRate);
  }

  /**
   * Calculate the parameters of an {@link TransactableMoneyp.adjustVault | adjustVault()}
   * transaction that will change this Vault into the given Vault.
   *
   * @param that - The desired result of the transaction.
   * @param borrowingRate - Current borrowing rate.
   */
  adjustTo(that: Vault, borrowingRate?: Decimalish): VaultAdjustmentParams<Decimal> {
    const change = this.whatChanged(that, borrowingRate);
    assert(change?.type === "adjustment");
    return change.params;
  }
}

/** @internal */
export const _emptyVault = new Vault();

/**
 * Represents whether a UserVault is open or not, or why it was closed.
 *
 * @public
 */
export type UserVaultStatus =
  | "nonExistent"
  | "open"
  | "closedByOwner"
  | "closedByLiquidation"
  | "closedByRedemption";

/**
 * A Vault that is associated with a single owner.
 *
 * @remarks
 * The SDK uses the base {@link Vault} class as a generic container of collateral and debt, for
 * example to represent the {@link ReadableMoneyp.getTotal | total collateral and debt} locked up
 * in the protocol.
 *
 * The `UserVault` class extends `Vault` with extra information that's only available for Vaults
 * that are associated with a single owner (such as the owner's address, or the Vault's status).
 *
 * @public
 */
export class UserVault extends Vault {
  /** Address that owns this Vault. */
  readonly ownerAddress: string;

  /** Provides more information when the UserVault is empty. */
  readonly status: UserVaultStatus;

  /** @internal */
  constructor(ownerAddress: string, status: UserVaultStatus, collateral?: Decimal, debt?: Decimal) {
    super(collateral, debt);

    this.ownerAddress = ownerAddress;
    this.status = status;
  }

  equals(that: UserVault): boolean {
    return (
      super.equals(that) && this.ownerAddress === that.ownerAddress && this.status === that.status
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ ownerAddress: "${this.ownerAddress}"` +
      `, collateral: ${this.collateral}` +
      `, debt: ${this.debt}` +
      `, status: "${this.status}" }`
    );
  }
}

/**
 * A Vault in its state after the last direct modification.
 *
 * @remarks
 * The Vault may have received collateral and debt shares from liquidations since then.
 * Use {@link VaultWithPendingRedistribution.applyRedistribution | applyRedistribution()} to
 * calculate the Vault's most up-to-date state.
 *
 * @public
 */
export class VaultWithPendingRedistribution extends UserVault {
  private readonly stake: Decimal;
  private readonly snapshotOfTotalRedistributed: Vault;

  /** @internal */
  constructor(
    ownerAddress: string,
    status: UserVaultStatus,
    collateral?: Decimal,
    debt?: Decimal,
    stake = Decimal.ZERO,
    snapshotOfTotalRedistributed = _emptyVault
  ) {
    super(ownerAddress, status, collateral, debt);

    this.stake = stake;
    this.snapshotOfTotalRedistributed = snapshotOfTotalRedistributed;
  }

  applyRedistribution(totalRedistributed: Vault): UserVault {
    const afterRedistribution = this.add(
      totalRedistributed.subtract(this.snapshotOfTotalRedistributed).multiply(this.stake)
    );

    return new UserVault(
      this.ownerAddress,
      this.status,
      afterRedistribution.collateral,
      afterRedistribution.debt
    );
  }

  equals(that: VaultWithPendingRedistribution): boolean {
    return (
      super.equals(that) &&
      this.stake.eq(that.stake) &&
      this.snapshotOfTotalRedistributed.equals(that.snapshotOfTotalRedistributed)
    );
  }
}
