import { Decimalish } from "./Decimal";
import { VaultAdjustmentParams, VaultCreationParams } from "./Vault";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TransactableMoneyp,
  VaultAdjustmentDetails,
  VaultClosureDetails,
  VaultCreationDetails,
} from "./TransactableMoneyp";

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Implemented by {@link @money-protocol/lib-ethers#SentBitcoinsMoneypTransaction}.
 *
 * @public
 */
export interface SentMoneypTransaction<
  S = unknown,
  T extends MoneypReceipt = MoneypReceipt
> {
  /** Implementation-specific sent transaction object. */
  readonly rawSentTransaction: S;

  /**
   * Check whether the transaction has been mined, and whether it was successful.
   *
   * @remarks
   * Unlike {@link @money-protocol/lib-base#SentMoneypTransaction.waitForReceipt | waitForReceipt()},
   * this function doesn't wait for the transaction to be mined.
   */
  getReceipt(): Promise<T>;

  /**
   * Wait for the transaction to be mined, and check whether it was successful.
   *
   * @returns Either a {@link @money-protocol/lib-base#FailedReceipt} or a
   *          {@link @money-protocol/lib-base#SuccessfulReceipt}.
   */
  waitForReceipt(): Promise<Extract<T, MinedReceipt>>;
}

/**
 * Indicates that the transaction hasn't been mined yet.
 *
 * @remarks
 * Returned by {@link SentMoneypTransaction.getReceipt}.
 *
 * @public
 */
export type PendingReceipt = { status: "pending" };

/** @internal */
export const _pendingReceipt: PendingReceipt = { status: "pending" };

/**
 * Indicates that the transaction has been mined, but it failed.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * Returned by {@link SentMoneypTransaction.getReceipt} and
 * {@link SentMoneypTransaction.waitForReceipt}.
 *
 * @public
 */
export type FailedReceipt<R = unknown> = { status: "failed"; rawReceipt: R };

/** @internal */
export const _failedReceipt = <R>(rawReceipt: R): FailedReceipt<R> => ({
  status: "failed",
  rawReceipt,
});

/**
 * Indicates that the transaction has succeeded.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * The `details` property may contain more information about the transaction.
 * See the return types of {@link TransactableMoneyp} functions for the exact contents of `details`
 * for each type of Moneyp transaction.
 *
 * Returned by {@link SentMoneypTransaction.getReceipt} and
 * {@link SentMoneypTransaction.waitForReceipt}.
 *
 * @public
 */
export type SuccessfulReceipt<R = unknown, D = unknown> = {
  status: "succeeded";
  rawReceipt: R;
  details: D;
};

/** @internal */
export const _successfulReceipt = <R, D>(
  rawReceipt: R,
  details: D,
  toString?: () => string
): SuccessfulReceipt<R, D> => ({
  status: "succeeded",
  rawReceipt,
  details,
  ...(toString ? { toString } : {}),
});

/**
 * Either a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type MinedReceipt<R = unknown, D = unknown> =
  | FailedReceipt<R>
  | SuccessfulReceipt<R, D>;

/**
 * One of either a {@link PendingReceipt}, a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type MoneypReceipt<R = unknown, D = unknown> =
  | PendingReceipt
  | MinedReceipt<R, D>;

/** @internal */
export type _SendableFrom<T, R, S> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? (...args: A) => Promise<SentMoneypTransaction<S, MoneypReceipt<R, D>>>
    : never;
};

/**
 * Send Moneyp transactions.
 *
 * @remarks
 * The functions return an object implementing {@link SentMoneypTransaction}, which can be used
 * to monitor the transaction and get its details when it succeeds.
 *
 * Implemented by {@link @money-protocol/lib-ethers#SendableBitcoinsMoneyp}.
 *
 * @public
 */
export interface SendableMoneyp<R = unknown, S = unknown>
  extends _SendableFrom<TransactableMoneyp, R, S> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableMoneyp.openVault} */
  openVault(
    params: VaultCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, VaultCreationDetails>>>;

  /** {@inheritDoc TransactableMoneyp.closeVault} */
  closeVault(): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, VaultClosureDetails>>
  >;

  /** {@inheritDoc TransactableMoneyp.adjustVault} */
  adjustVault(
    params: VaultAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
  >;

  /** {@inheritDoc TransactableMoneyp.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
  >;

  /** {@inheritDoc TransactableMoneyp.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
  >;

  /** {@inheritDoc TransactableMoneyp.borrowBPD} */
  borrowBPD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
  >;

  /** {@inheritDoc TransactableMoneyp.repayBPD} */
  repayBPD(
    amount: Decimalish
  ): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, VaultAdjustmentDetails>>
  >;

  /** @internal */
  setPrice(
    price: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;

  /** {@inheritDoc TransactableMoneyp.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableMoneyp.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfVaultsToLiquidate: number
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableMoneyp.depositBPDInStabilityPool} */
  depositBPDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, StabilityDepositChangeDetails>>
  >;

  /** {@inheritDoc TransactableMoneyp.withdrawBPDFromStabilityPool} */
  withdrawBPDFromStabilityPool(
    amount: Decimalish
  ): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, StabilityDepositChangeDetails>>
  >;

  /** {@inheritDoc TransactableMoneyp.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    SentMoneypTransaction<
      S,
      MoneypReceipt<R, StabilityPoolGainsWithdrawalDetails>
    >
  >;

  /** {@inheritDoc TransactableMoneyp.transferCollateralGainToVault} */
  transferCollateralGainToVault(): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, CollateralGainTransferDetails>>
  >;

  /** {@inheritDoc TransactableMoneyp.sendBPD} */
  sendBPD(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;

  /** {@inheritDoc TransactableMoneyp.sendMP} */
  sendMP(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;

  /** {@inheritDoc TransactableMoneyp.redeemBPD} */
  redeemBPD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, RedemptionDetails>>>;

  /** {@inheritDoc TransactableMoneyp.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, void>>
  >;

  /** {@inheritDoc TransactableMoneyp.stakeMP} */
  stakeMP(
    amount: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;

  /** {@inheritDoc TransactableMoneyp.unstakeMP} */
  unstakeMP(
    amount: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;

  /** {@inheritDoc TransactableMoneyp.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, void>>
  >;

  /** {@inheritDoc TransactableMoneyp.approveRskSwapTokens} */
  approveRskSwapTokens(
    allowance?: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;

  /** {@inheritDoc TransactableMoneyp.stakeRskSwapTokens} */
  stakeRskSwapTokens(
    amount: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;

  /** {@inheritDoc TransactableMoneyp.unstakeRskSwapTokens} */
  unstakeRskSwapTokens(
    amount: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;

  /** {@inheritDoc TransactableMoneyp.withdrawMPRewardFromLiquidityMining} */
  withdrawMPRewardFromLiquidityMining(): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, void>>
  >;

  /** {@inheritDoc TransactableMoneyp.exitLiquidityMining} */
  exitLiquidityMining(): Promise<
    SentMoneypTransaction<S, MoneypReceipt<R, void>>
  >;

  /** {@inheritDoc TransactableMoneyp.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<SentMoneypTransaction<S, MoneypReceipt<R, void>>>;
}
