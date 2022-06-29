import {
  CollateralGainTransferDetails,
  Decimalish,
  LiquidationDetails,
  RedemptionDetails,
  SendableMoneyp,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  VaultAdjustmentDetails,
  VaultAdjustmentParams,
  VaultClosureDetails,
  VaultCreationDetails,
  VaultCreationParams
} from "@moneyprotocol/lib-base";

import {
  BitcoinsTransactionOverrides,
  BitcoinsTransactionReceipt,
  BitcoinsTransactionResponse
} from "./types";

import {
  PopulatableBitcoinsMoneyp,
  PopulatedBitcoinsMoneypTransaction,
  SentBitcoinsMoneypTransaction
} from "./PopulatableBitcoinsMoneyp";

const sendTransaction = <T>(tx: PopulatedBitcoinsMoneypTransaction<T>) => tx.send();

/**
 * Bitcoins-based implementation of {@link @moneyprotocol/lib-base#SendableMoneyp}.
 *
 * @public
 */
export class SendableBitcoinsMoneyp
  implements SendableMoneyp<BitcoinsTransactionReceipt, BitcoinsTransactionResponse> {
  private _populate: PopulatableBitcoinsMoneyp;

  constructor(populatable: PopulatableBitcoinsMoneyp) {
    this._populate = populatable;
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.openVault} */
  openVault(
    params: VaultCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<VaultCreationDetails>> {
    return this._populate.openVault(params, maxBorrowingRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.closeVault} */
  closeVault(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<VaultClosureDetails>> {
    return this._populate.closeVault(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.adjustVault} */
  adjustVault(
    params: VaultAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this._populate.adjustVault(params, maxBorrowingRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this._populate.depositCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this._populate.withdrawCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.borrowBPD} */
  borrowBPD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this._populate.borrowBPD(amount, maxBorrowingRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.repayBPD} */
  repayBPD(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this._populate.repayBPD(amount, overrides).then(sendTransaction);
  }

  /** @internal */
  setPrice(
    price: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.setPrice(price, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.liquidate} */
  liquidate(
    address: string | string[],
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<LiquidationDetails>> {
    return this._populate.liquidate(address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfVaultsToLiquidate: number,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<LiquidationDetails>> {
    return this._populate
      .liquidateUpTo(maximumNumberOfVaultsToLiquidate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.depositBPDInStabilityPool} */
  depositBPDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .depositBPDInStabilityPool(amount, frontendTag, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.withdrawBPDFromStabilityPool} */
  withdrawBPDFromStabilityPool(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<StabilityDepositChangeDetails>> {
    return this._populate.withdrawBPDFromStabilityPool(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromStabilityPool(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.transferCollateralGainToVault} */
  transferCollateralGainToVault(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferCollateralGainToVault(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.sendBPD} */
  sendBPD(
    toAddress: string,
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.sendBPD(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.sendMP} */
  sendMP(
    toAddress: string,
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.sendMP(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.redeemBPD} */
  redeemBPD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<RedemptionDetails>> {
    return this._populate.redeemBPD(amount, maxRedemptionRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.claimCollateralSurplus} */
  claimCollateralSurplus(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.claimCollateralSurplus(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.stakeMP} */
  stakeMP(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.stakeMP(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.unstakeMP} */
  unstakeMP(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.unstakeMP(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.withdrawGainsFromStaking(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.registerFrontend(kickbackRate, overrides).then(sendTransaction);
  }

  /** @internal */
  _mintRskSwapToken(
    amount: Decimalish,
    address?: string,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate._mintRskSwapToken(amount, address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.approveRskSwapTokens} */
  approveRskSwapTokens(
    allowance?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.approveRskSwapTokens(allowance, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.stakeRskSwapTokens} */
  stakeRskSwapTokens(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.stakeRskSwapTokens(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.unstakeRskSwapTokens} */
  unstakeRskSwapTokens(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.unstakeRskSwapTokens(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.withdrawMPRewardFromLiquidityMining} */
  withdrawMPRewardFromLiquidityMining(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.withdrawMPRewardFromLiquidityMining(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#SendableMoneyp.exitLiquidityMining} */
  exitLiquidityMining(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<SentBitcoinsMoneypTransaction<void>> {
    return this._populate.exitLiquidityMining(overrides).then(sendTransaction);
  }
}
