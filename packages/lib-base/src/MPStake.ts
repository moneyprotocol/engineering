import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two states of an MP Stake.
 *
 * @public
 */
export type MPStakeChange<T> =
  | { stakeMP: T; unstakeMP?: undefined }
  | { stakeMP?: undefined; unstakeMP: T; unstakeAllMP: boolean };

/** 
 * Represents a user's MP stake and accrued gains.
 * 
 * @remarks
 * Returned by the {@link ReadableMoneyp.getMPStake | getMPStake()} function.

 * @public
 */
export class MPStake {
  /** The amount of MP that's staked. */
  readonly stakedMP: Decimal;

  /** Collateral gain available to withdraw. */
  readonly collateralGain: Decimal;

  /** BPD gain available to withdraw. */
  readonly bpdGain: Decimal;

  /** @internal */
  constructor(stakedMP = Decimal.ZERO, collateralGain = Decimal.ZERO, bpdGain = Decimal.ZERO) {
    this.stakedMP = stakedMP;
    this.collateralGain = collateralGain;
    this.bpdGain = bpdGain;
  }

  get isEmpty(): boolean {
    return this.stakedMP.isZero && this.collateralGain.isZero && this.bpdGain.isZero;
  }

  /** @internal */
  toString(): string {
    return (
      `{ stakedMP: ${this.stakedMP}` +
      `, collateralGain: ${this.collateralGain}` +
      `, bpdGain: ${this.bpdGain} }`
    );
  }

  /**
   * Compare to another instance of `MPStake`.
   */
  equals(that: MPStake): boolean {
    return (
      this.stakedMP.eq(that.stakedMP) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.bpdGain.eq(that.bpdGain)
    );
  }

  /**
   * Calculate the difference between this `MPStake` and `thatStakedMP`.
   *
   * @returns An object representing the change, or `undefined` if the staked amounts are equal.
   */
  whatChanged(thatStakedMP: Decimalish): MPStakeChange<Decimal> | undefined {
    thatStakedMP = Decimal.from(thatStakedMP);

    if (thatStakedMP.lt(this.stakedMP)) {
      return {
        unstakeMP: this.stakedMP.sub(thatStakedMP),
        unstakeAllMP: thatStakedMP.isZero
      };
    }

    if (thatStakedMP.gt(this.stakedMP)) {
      return { stakeMP: thatStakedMP.sub(this.stakedMP) };
    }
  }

  /**
   * Apply a {@link MPStakeChange} to this `MPStake`.
   *
   * @returns The new staked MP amount.
   */
  apply(change: MPStakeChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.stakedMP;
    }

    if (change.unstakeMP !== undefined) {
      return change.unstakeAllMP || this.stakedMP.lte(change.unstakeMP)
        ? Decimal.ZERO
        : this.stakedMP.sub(change.unstakeMP);
    } else {
      return this.stakedMP.add(change.stakeMP);
    }
  }
}
