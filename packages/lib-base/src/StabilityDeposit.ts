import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> = any;

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
  /** Amount of BPD in the Stability Deposit at the time of the last direct modification. */
  readonly initialBPD: Decimal;

  /** Amount of BPD left in the Stability Deposit. */
  readonly currentBPD: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up BPD. */
  readonly collateralGain: Decimal;

  /** Amount of MP rewarded since the last modification of the Stability Deposit. */
  readonly mpReward: Decimal;

  /**
   * Address of frontend through which this Stability Deposit was made.
   *
   * @remarks
   * If the Stability Deposit was made through a frontend that doesn't tag deposits, this will be
   * the zero-address.
   */
  readonly frontendTag: string;

  /** @internal */
  constructor(
    initialBPD: Decimal,
    currentBPD: Decimal,
    collateralGain: Decimal,
    mpReward: Decimal,
    frontendTag: string
  ) {
    this.initialBPD = initialBPD;
    this.currentBPD = currentBPD;
    this.collateralGain = collateralGain;
    this.mpReward = mpReward;
    this.frontendTag = frontendTag;

    if (this.currentBPD.gt(this.initialBPD)) {
      throw new Error("currentBPD can't be greater than initialBPD");
    }
  }

  get isEmpty(): boolean {
    return (
      this.initialBPD.isZero &&
      this.currentBPD.isZero &&
      this.collateralGain.isZero &&
      this.mpReward.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ initialBPD: ${this.initialBPD}` +
      `, currentBPD: ${this.currentBPD}` +
      `, collateralGain: ${this.collateralGain}` +
      `, mpReward: ${this.mpReward}` +
      `, frontendTag: "${this.frontendTag}" }`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {
    return (
      this.initialBPD.eq(that.initialBPD) &&
      this.currentBPD.eq(that.currentBPD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.mpReward.eq(that.mpReward) &&
      this.frontendTag === that.frontendTag
    );
  }

  /**
   * Calculate the difference between the `currentBPD` in this Stability Deposit and `thatBPD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(
    thatBPD: Decimalish
  ): StabilityDepositChange<Decimal> | undefined {
    thatBPD = Decimal.from(thatBPD);

    if (thatBPD.lt(this.currentBPD)) {
      return {
        withdrawBPD: this.currentBPD.sub(thatBPD),
        withdrawAllBPD: thatBPD.isZero,
      };
    }

    if (thatBPD.gt(this.currentBPD)) {
      return { depositBPD: thatBPD.sub(this.currentBPD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited BPD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentBPD;
    }

    if (change.withdrawBPD !== undefined) {
      return change.withdrawAllBPD || this.currentBPD.lte(change.withdrawBPD)
        ? Decimal.ZERO
        : this.currentBPD.sub(change.withdrawBPD);
    } else {
      return this.currentBPD.add(change.depositBPD);
    }
  }
}
