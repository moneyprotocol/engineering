import { Decimal, Decimalish } from "./Decimal";
import { Vault, VaultAdjustmentParams, VaultClosureParams, VaultCreationParams } from "./Vault";
import { StabilityDepositChange } from "./StabilityDeposit";
import { FailedReceipt } from "./SendableMoneyp";

/**
 * Thrown by {@link TransactableMoneyp} functions in case of transaction failure.
 *
 * @public
 */
export class TransactionFailedError<T extends FailedReceipt = FailedReceipt> extends Error {
  readonly failedReceipt: T;

  /** @internal */
  constructor(name: string, message: string, failedReceipt: T) {
    super(message);
    this.name = name;
    this.failedReceipt = failedReceipt;
  }
}

/**
 * Details of an {@link TransactableMoneyp.openVault | openVault()} transaction.
 *
 * @public
 */
export interface VaultCreationDetails {
  /** How much was deposited and borrowed. */
  params: VaultCreationParams<Decimal>;

  /** The Vault that was created by the transaction. */
  newVault: Vault;

  /** Amount of BPD added to the Vault's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of an {@link TransactableMoneyp.adjustVault | adjustVault()} transaction.
 *
 * @public
 */
export interface VaultAdjustmentDetails {
  /** Parameters of the adjustment. */
  params: VaultAdjustmentParams<Decimal>;

  /** New state of the adjusted Vault directly after the transaction. */
  newVault: Vault;

  /** Amount of BPD added to the Vault's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of a {@link TransactableMoneyp.closeVault | closeVault()} transaction.
 *
 * @public
 */
export interface VaultClosureDetails {
  /** How much was withdrawn and repaid. */
  params: VaultClosureParams<Decimal>;
}

/**
 * Details of a {@link TransactableMoneyp.liquidate | liquidate()} or
 * {@link TransactableMoneyp.liquidateUpTo | liquidateUpTo()} transaction.
 *
 * @public
 */
export interface LiquidationDetails {
  /** Addresses whose Vaults were liquidated by the transaction. */
  liquidatedAddresses: string[];

  /** Total collateral liquidated and debt cleared by the transaction. */
  totalLiquidated: Vault;

  /** Amount of BPD paid to the liquidator as gas compensation. */
  bpdGasCompensation: Decimal;

  /** Amount of native currency (e.g. Ether) paid to the liquidator as gas compensation. */
  collateralGasCompensation: Decimal;
}

/**
 * Details of a {@link TransactableMoneyp.redeemBPD | redeemBPD()} transaction.
 *
 * @public
 */
export interface RedemptionDetails {
  /** Amount of BPD the redeemer tried to redeem. */
  attemptedBPDAmount: Decimal;

  /**
   * Amount of BPD that was actually redeemed by the transaction.
   *
   * @remarks
   * This can end up being lower than `attemptedBPDAmount` due to interference from another
   * transaction that modifies the list of Vaults.
   *
   * @public
   */
  actualBPDAmount: Decimal;

  /** Amount of collateral (e.g. Ether) taken from Vaults by the transaction. */
  collateralTaken: Decimal;

  /** Amount of native currency (e.g. Ether) deducted as fee from collateral taken. */
  fee: Decimal;
}

/**
 * Details of a
 * {@link TransactableMoneyp.withdrawGainsFromStabilityPool | withdrawGainsFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityPoolGainsWithdrawalDetails {
  /** Amount of BPD burned from the deposit by liquidations since the last modification. */
  bpdLoss: Decimal;

  /** Amount of BPD in the deposit directly after this transaction. */
  newBPDDeposit: Decimal;

  /** Amount of native currency (e.g. Ether) paid out to the depositor in this transaction. */
  collateralGain: Decimal;

  /** Amount of MP rewarded to the depositor in this transaction. */
  mpReward: Decimal;
}

/**
 * Details of a
 * {@link TransactableMoneyp.depositBPDInStabilityPool | depositBPDInStabilityPool()} or
 * {@link TransactableMoneyp.withdrawBPDFromStabilityPool | withdrawBPDFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityDepositChangeDetails extends StabilityPoolGainsWithdrawalDetails {
  /** Change that was made to the deposit by this transaction. */
  change: StabilityDepositChange<Decimal>;
}

/**
 * Details of a
 * {@link TransactableMoneyp.transferCollateralGainToVault | transferCollateralGainToVault()}
 * transaction.
 *
 * @public
 */
export interface CollateralGainTransferDetails extends StabilityPoolGainsWithdrawalDetails {
  /** New state of the depositor's Vault directly after the transaction. */
  newVault: Vault;
}

/**
 * Send Moneyp transactions and wait for them to succeed.
 *
 * @remarks
 * The functions return the details of the transaction (if any), or throw an implementation-specific
 * subclass of {@link TransactionFailedError} in case of transaction failure.
 *
 * Implemented by {@link @liquity/lib-ethers#BitcoinsMoneyp}.
 *
 * @public
 */
export interface TransactableMoneyp {
  /**
   * Open a new Vault by depositing collateral and borrowing BPD.
   *
   * @param params - How much to deposit and borrow.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @liquity/lib-base#Fees.borrowingRate | borrowing rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum
   * acceptable rate.
   */
  openVault(
    params: VaultCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<VaultCreationDetails>;

  /**
   * Close existing Vault by repaying all debt and withdrawing all collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  closeVault(): Promise<VaultClosureDetails>;

  /**
   * Adjust existing Vault by changing its collateral, debt, or both.
   *
   * @param params - Parameters of the adjustment.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @liquity/lib-base#Fees.borrowingRate | borrowing rate} if
   *                           `params` includes `borrowBPD`.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The transaction will fail if the Vault's debt would fall below
   * {@link @liquity/lib-base#BPD_MINIMUM_DEBT}.
   *
   * If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum
   * acceptable rate.
   */
  adjustVault(
    params: VaultAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<VaultAdjustmentDetails>;

  /**
   * Adjust existing Vault by depositing more collateral.
   *
   * @param amount - The amount of collateral to add to the Vault's existing collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustVault({ depositCollateral: amount })
   * ```
   */
  depositCollateral(amount: Decimalish): Promise<VaultAdjustmentDetails>;

  /**
   * Adjust existing Vault by withdrawing some of its collateral.
   *
   * @param amount - The amount of collateral to withdraw from the Vault.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustVault({ withdrawCollateral: amount })
   * ```
   */
  withdrawCollateral(amount: Decimalish): Promise<VaultAdjustmentDetails>;

  /**
   * Adjust existing Vault by borrowing more BPD.
   *
   * @param amount - The amount of BPD to borrow.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @liquity/lib-base#Fees.borrowingRate | borrowing rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustVault({ borrowBPD: amount }, maxBorrowingRate)
   * ```
   */
  borrowBPD(amount: Decimalish, maxBorrowingRate?: Decimalish): Promise<VaultAdjustmentDetails>;

  /**
   * Adjust existing Vault by repaying some of its debt.
   *
   * @param amount - The amount of BPD to repay.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustVault({ repayBPD: amount })
   * ```
   */
  repayBPD(amount: Decimalish): Promise<VaultAdjustmentDetails>;

  /** @internal */
  setPrice(price: Decimalish): Promise<void>;

  /**
   * Liquidate one or more undercollateralized Vaults.
   *
   * @param address - Address or array of addresses whose Vaults to liquidate.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidate(address: string | string[]): Promise<LiquidationDetails>;

  /**
   * Liquidate the least collateralized Vaults up to a maximum number.
   *
   * @param maximumNumberOfVaultsToLiquidate - Stop after liquidating this many Vaults.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidateUpTo(maximumNumberOfVaultsToLiquidate: number): Promise<LiquidationDetails>;

  /**
   * Make a new Stability Deposit, or top up existing one.
   *
   * @param amount - Amount of BPD to add to new or existing deposit.
   * @param frontendTag - Address that should receive a share of this deposit's MP rewards.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The `frontendTag` parameter is only effective when making a new deposit.
   *
   * As a side-effect, the transaction will also pay out an existing Stability Deposit's
   * {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#StabilityDeposit.mpReward | MP reward}.
   */
  depositBPDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw BPD from Stability Deposit.
   *
   * @param amount - Amount of BPD to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#StabilityDeposit.mpReward | MP reward}.
   */
  withdrawBPDFromStabilityPool(amount: Decimalish): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#StabilityDeposit.mpReward | MP reward} from Stability Deposit.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStabilityPool(): Promise<StabilityPoolGainsWithdrawalDetails>;

  /**
   * Transfer {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} from
   * Stability Deposit to Vault.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The collateral gain is transfered to the Vault as additional collateral.
   *
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @liquity/lib-base#StabilityDeposit.mpReward | MP reward}.
   */
  transferCollateralGainToVault(): Promise<CollateralGainTransferDetails>;

  /**
   * Send BPD tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of BPD to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendBPD(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Send MP tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of MP to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendMP(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Redeem BPD to native currency (e.g. Ether) at face value.
   *
   * @param amount - Amount of BPD to be redeemed.
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @liquity/lib-base#Fees.redemptionRate | redemption rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * If `maxRedemptionRate` is omitted, the current redemption rate (based on `amount`) plus 0.1%
   * is used as maximum acceptable rate.
   */
  redeemBPD(amount: Decimalish, maxRedemptionRate?: Decimalish): Promise<RedemptionDetails>;

  /**
   * Claim leftover collateral after a liquidation or redemption.
   *
   * @remarks
   * Use {@link @liquity/lib-base#ReadableMoneyp.getCollateralSurplusBalance | getCollateralSurplusBalance()}
   * to check the amount of collateral available for withdrawal.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  claimCollateralSurplus(): Promise<void>;

  /**
   * Stake MP to start earning fee revenue or increase existing stake.
   *
   * @param amount - Amount of MP to add to new or existing stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out an existing MP stake's
   * {@link @liquity/lib-base#MPStake.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#MPStake.bpdGain | BPD gain}.
   */
  stakeMP(amount: Decimalish): Promise<void>;

  /**
   * Withdraw MP from staking.
   *
   * @param amount - Amount of MP to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the MP stake's
   * {@link @liquity/lib-base#MPStake.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#MPStake.bpdGain | BPD gain}.
   */
  unstakeMP(amount: Decimalish): Promise<void>;

  /**
   * Withdraw {@link @liquity/lib-base#MPStake.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#MPStake.bpdGain | BPD gain} from MP stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStaking(): Promise<void>;

  /**
   * Allow the liquidity mining contract to use Uniswap RBTC/BPD LP tokens for
   * {@link @liquity/lib-base#TransactableMoneyp.stakeUniTokens | staking}.
   *
   * @param allowance - Maximum amount of LP tokens that will be transferrable to liquidity mining
   *                    (`2^256 - 1` by default).
   *
   * @remarks
   * Must be performed before calling
   * {@link @liquity/lib-base#TransactableMoneyp.stakeUniTokens | stakeUniTokens()}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  approveUniTokens(allowance?: Decimalish): Promise<void>;

  /**
   * Stake Uniswap RBTC/BPD LP tokens to participate in liquidity mining and earn MP.
   *
   * @param amount - Amount of LP tokens to add to new or existing stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  stakeUniTokens(amount: Decimalish): Promise<void>;

  /**
   * Withdraw Uniswap RBTC/BPD LP tokens from liquidity mining.
   *
   * @param amount - Amount of LP tokens to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  unstakeUniTokens(amount: Decimalish): Promise<void>;

  /**
   * Withdraw MP that has been earned by mining liquidity.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawMPRewardFromLiquidityMining(): Promise<void>;

  /**
   * Withdraw all staked LP tokens from liquidity mining and claim reward.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  exitLiquidityMining(): Promise<void>;

  /**
   * Register current wallet address as a Moneyp frontend.
   *
   * @param kickbackRate - The portion of MP rewards to pass onto users of the frontend
   *                       (between 0 and 1).
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  registerFrontend(kickbackRate: Decimalish): Promise<void>;
}
