import { Decimal, Decimalish } from "./Decimal";
import { VaultAdjustmentParams, VaultCreationParams } from "./Vault";
import { MoneypReceipt, SendableMoneyp, SentMoneypTransaction } from "./SendableMoneyp";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  VaultAdjustmentDetails,
  VaultClosureDetails,
  VaultCreationDetails
} from "./TransactableMoneyp";

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Implemented by {@link @liquity/lib-ethers#PopulatedEthersMoneypTransaction}.
 *
 * @public
 */
export interface PopulatedMoneypTransaction<
  P = unknown,
  T extends SentMoneypTransaction = SentMoneypTransaction
> {
  /** Implementation-specific populated transaction object. */
  readonly rawPopulatedTransaction: P;

  /**
   * Send the transaction.
   *
   * @returns An object that implements {@link @liquity/lib-base#SentMoneypTransaction}.
   */
  send(): Promise<T>;
}

/**
 * A redemption transaction that has been prepared for sending.
 *
 * @remarks
 * The Moneyp protocol fulfills redemptions by repaying the debt of Vaults in ascending order of
 * their collateralization ratio, and taking a portion of their collateral in exchange. Due to the
 * {@link @liquity/lib-base#BPD_MINIMUM_DEBT | minimum debt} requirement that Vaults must fulfill,
 * some BPD amounts are not possible to redeem exactly.
 *
 * When {@link @liquity/lib-base#PopulatableMoneyp.redeemBPD | redeemBPD()} is called with an
 * amount that can't be fully redeemed, the amount will be truncated (see the `redeemableBPDAmount`
 * property). When this happens, the redeemer can either redeem the truncated amount by sending the
 * transaction unchanged, or prepare a new transaction by
 * {@link @liquity/lib-base#PopulatedRedemption.increaseAmountByMinimumNetDebt | increasing the amount}
 * to the next lowest possible value, which is the sum of the truncated amount and
 * {@link @liquity/lib-base#BPD_MINIMUM_NET_DEBT}.
 *
 * @public
 */
export interface PopulatedRedemption<P = unknown, S = unknown, R = unknown>
  extends PopulatedMoneypTransaction<
    P,
    SentMoneypTransaction<S, MoneypReceipt<R, RedemptionDetails>>
  > {
  /** Amount of BPD the redeemer is trying to redeem. */
  readonly attemptedBPDAmount: Decimal;

  /** Maximum amount of BPD that is currently redeemable from `attemptedBPDAmount`. */
  readonly redeemableBPDAmount: Decimal;

  /** Whether `redeemableBPDAmount` is less than `attemptedBPDAmount`. */
  readonly isTruncated: boolean;

  /**
   * Prepare a new transaction by increasing the attempted amount to the next lowest redeemable
   * value.
   *
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @liquity/lib-base#Fees.redemptionRate | redemption rate} to
   *                            use in the new transaction.
   *
   * @remarks
   * If `maxRedemptionRate` is omitted, the original transaction's `maxRedemptionRate` is reused
   * unless that was also omitted, in which case the current redemption rate (based on the increased
   * amount) plus 0.1% is used as maximum acceptable rate.
   */
  increaseAmountByMinimumNetDebt(
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;
}

/** @internal */
export type _PopulatableFrom<T, P> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer U>
    ? U extends SentMoneypTransaction
      ? (...args: A) => Promise<PopulatedMoneypTransaction<P, U>>
      : never
    : never;
};

/**
 * Prepare Moneyp transactions for sending.
 *
 * @remarks
 * The functions return an object implementing {@link PopulatedMoneypTransaction}, which can be
 * used to send the transaction and get a {@link SentMoneypTransaction}.
 *
 * Implemented by {@link @liquity/lib-ethers#PopulatableEthersMoneyp}.
 *
 * @public
 */
export interface PopulatableMoneyp<R = unknown, S = unknown, P = unknown>
  extends _PopulatableFrom<SendableMoneyp<R, S>, P> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableMoneyp.openVault} */
  openVault(
    params: VaultCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, VaultCreationDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.closeVault} */
  closeVault(): Promise<
    PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, VaultClosureDetails>>>
  >;

  /** {@inheritDoc TransactableMoneyp.adjustVault} */
  adjustVault(
    params: VaultAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.borrowBPD} */
  borrowBPD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.repayBPD} */
  repayBPD(
    amount: Decimalish
  ): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
    >
  >;

  /** @internal */
  setPrice(
    price: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMoneyp.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<
    PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableMoneyp.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfVaultsToLiquidate: number
  ): Promise<
    PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableMoneyp.depositBPDInStabilityPool} */
  depositBPDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.withdrawBPDFromStabilityPool} */
  withdrawBPDFromStabilityPool(
    amount: Decimalish
  ): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, StabilityPoolGainsWithdrawalDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.transferCollateralGainToVault} */
  transferCollateralGainToVault(): Promise<
    PopulatedMoneypTransaction<
      P,
      SentMoneypTransaction<S, MoneypReceipt<R, CollateralGainTransferDetails>>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.sendBPD} */
  sendBPD(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMoneyp.sendMP} */
  sendMP(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMoneyp.redeemBPD} */
  redeemBPD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;

  /** {@inheritDoc TransactableMoneyp.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<
    PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableMoneyp.stakeMP} */
  stakeMP(
    amount: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMoneyp.unstakeMP} */
  unstakeMP(
    amount: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMoneyp.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<
    PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableMoneyp.approveUniTokens} */
  approveUniTokens(
    allowance?: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMoneyp.stakeUniTokens} */
  stakeUniTokens(
    amount: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMoneyp.unstakeUniTokens} */
  unstakeUniTokens(
    amount: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMoneyp.withdrawMPRewardFromLiquidityMining} */
  withdrawMPRewardFromLiquidityMining(): Promise<
    PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableMoneyp.exitLiquidityMining} */
  exitLiquidityMining(): Promise<
    PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableMoneyp.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<PopulatedMoneypTransaction<P, SentMoneypTransaction<S, MoneypReceipt<R, void>>>>;
}
