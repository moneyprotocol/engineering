import {
  CollateralGainTransferDetails,
  Decimal,
  Decimalish,
  FailedReceipt,
  Fees,
  FrontendStatus,
  LiquidationDetails,
  MoneypStore,
  MPStake,
  RedemptionDetails,
  StabilityDeposit,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TransactableMoneyp,
  TransactionFailedError,
  Vault,
  VaultAdjustmentDetails,
  VaultAdjustmentParams,
  VaultClosureDetails,
  VaultCreationDetails,
  VaultCreationParams,
  VaultListingParams,
  VaultWithPendingRedistribution,
  UserVault
} from "@liquity/lib-base";

import {
  EthersMoneypConnection,
  EthersMoneypConnectionOptionalParams,
  EthersMoneypStoreOption,
  _connect,
  _usingStore
} from "./EthersMoneypConnection";

import {
  EthersCallOverrides,
  EthersProvider,
  EthersSigner,
  EthersTransactionOverrides,
  EthersTransactionReceipt
} from "./types";

import { PopulatableEthersMoneyp, SentEthersMoneypTransaction } from "./PopulatableEthersMoneyp";
import { ReadableEthersMoneyp, ReadableEthersMoneypWithStore } from "./ReadableEthersMoneyp";
import { SendableEthersMoneyp } from "./SendableEthersMoneyp";
import { BlockPolledMoneypStore } from "./BlockPolledMoneypStore";

/**
 * Thrown by {@link EthersMoneyp} in case of transaction failure.
 *
 * @public
 */
export class EthersTransactionFailedError extends TransactionFailedError<
  FailedReceipt<EthersTransactionReceipt>
> {
  constructor(message: string, failedReceipt: FailedReceipt<EthersTransactionReceipt>) {
    super("EthersTransactionFailedError", message, failedReceipt);
  }
}

const waitForSuccess = async <T>(tx: SentEthersMoneypTransaction<T>) => {
  const receipt = await tx.waitForReceipt();

  if (receipt.status !== "succeeded") {
    throw new EthersTransactionFailedError("Transaction failed", receipt);
  }

  return receipt.details;
};

/**
 * Convenience class that combines multiple interfaces of the library in one object.
 *
 * @public
 */
export class EthersMoneyp implements ReadableEthersMoneyp, TransactableMoneyp {
  /** Information about the connection to the Moneyp protocol. */
  readonly connection: EthersMoneypConnection;

  /** Can be used to create populated (unsigned) transactions. */
  readonly populate: PopulatableEthersMoneyp;

  /** Can be used to send transactions without waiting for them to be mined. */
  readonly send: SendableEthersMoneyp;

  private _readable: ReadableEthersMoneyp;

  /** @internal */
  constructor(readable: ReadableEthersMoneyp) {
    this._readable = readable;
    this.connection = readable.connection;
    this.populate = new PopulatableEthersMoneyp(readable);
    this.send = new SendableEthersMoneyp(this.populate);
  }

  /** @internal */
  static _from(
    connection: EthersMoneypConnection & { useStore: "blockPolled" }
  ): EthersMoneypWithStore<BlockPolledMoneypStore>;

  /** @internal */
  static _from(connection: EthersMoneypConnection): EthersMoneyp;

  /** @internal */
  static _from(connection: EthersMoneypConnection): EthersMoneyp {
    if (_usingStore(connection)) {
      return new _EthersMoneypWithStore(ReadableEthersMoneyp._from(connection));
    } else {
      return new EthersMoneyp(ReadableEthersMoneyp._from(connection));
    }
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersMoneypConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<EthersMoneypWithStore<BlockPolledMoneypStore>>;

  /**
   * Connect to the Moneyp protocol and create an `EthersMoneyp` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersMoneypConnectionOptionalParams
  ): Promise<EthersMoneyp>;

  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersMoneypConnectionOptionalParams
  ): Promise<EthersMoneyp> {
    return EthersMoneyp._from(await _connect(signerOrProvider, optionalParams));
  }

  /**
   * Check whether this `EthersMoneyp` is an {@link EthersMoneypWithStore}.
   */
  hasStore(): this is EthersMoneypWithStore;

  /**
   * Check whether this `EthersMoneyp` is an
   * {@link EthersMoneypWithStore}\<{@link BlockPolledMoneypStore}\>.
   */
  hasStore(store: "blockPolled"): this is EthersMoneypWithStore<BlockPolledMoneypStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getTotalRedistributed} */
  getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Vault> {
    return this._readable.getTotalRedistributed(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getVaultBeforeRedistribution} */
  getVaultBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<VaultWithPendingRedistribution> {
    return this._readable.getVaultBeforeRedistribution(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getVault} */
  getVault(address?: string, overrides?: EthersCallOverrides): Promise<UserVault> {
    return this._readable.getVault(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getNumberOfVaults} */
  getNumberOfVaults(overrides?: EthersCallOverrides): Promise<number> {
    return this._readable.getNumberOfVaults(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getPrice} */
  getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getPrice(overrides);
  }

  /** @internal */
  _getActivePool(overrides?: EthersCallOverrides): Promise<Vault> {
    return this._readable._getActivePool(overrides);
  }

  /** @internal */
  _getDefaultPool(overrides?: EthersCallOverrides): Promise<Vault> {
    return this._readable._getDefaultPool(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getTotal} */
  getTotal(overrides?: EthersCallOverrides): Promise<Vault> {
    return this._readable.getTotal(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getStabilityDeposit} */
  getStabilityDeposit(address?: string, overrides?: EthersCallOverrides): Promise<StabilityDeposit> {
    return this._readable.getStabilityDeposit(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getRemainingStabilityPoolMPReward} */
  getRemainingStabilityPoolMPReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getRemainingStabilityPoolMPReward(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getBPDInStabilityPool} */
  getBPDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getBPDInStabilityPool(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getBPDBalance} */
  getBPDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getBPDBalance(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getMPBalance} */
  getMPBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getMPBalance(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getUniTokenBalance} */
  getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getUniTokenBalance(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getUniTokenAllowance} */
  getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getUniTokenAllowance(address, overrides);
  }

  /** @internal */
  _getRemainingLiquidityMiningMPRewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    return this._readable._getRemainingLiquidityMiningMPRewardCalculator(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getRemainingLiquidityMiningMPReward} */
  getRemainingLiquidityMiningMPReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getRemainingLiquidityMiningMPReward(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getLiquidityMiningStake} */
  getLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getLiquidityMiningStake(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getTotalStakedUniTokens} */
  getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getTotalStakedUniTokens(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getLiquidityMiningMPReward} */
  getLiquidityMiningMPReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getLiquidityMiningMPReward(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getCollateralSurplusBalance(address, overrides);
  }

  /** @internal */
  getVaults(
    params: VaultListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<VaultWithPendingRedistribution[]>;

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.(getVaults:2)} */
  getVaults(params: VaultListingParams, overrides?: EthersCallOverrides): Promise<UserVault[]>;

  getVaults(params: VaultListingParams, overrides?: EthersCallOverrides): Promise<UserVault[]> {
    return this._readable.getVaults(params, overrides);
  }

  /** @internal */
  _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    return this._readable._getFeesFactory(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getFees} */
  getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    return this._readable.getFees(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getMPStake} */
  getMPStake(address?: string, overrides?: EthersCallOverrides): Promise<MPStake> {
    return this._readable.getMPStake(address, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getTotalStakedMP} */
  getTotalStakedMP(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getTotalStakedMP(overrides);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMoneyp.getFrontendStatus} */
  getFrontendStatus(address?: string, overrides?: EthersCallOverrides): Promise<FrontendStatus> {
    return this._readable.getFrontendStatus(address, overrides);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.openVault}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  openVault(
    params: VaultCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<VaultCreationDetails> {
    return this.send.openVault(params, maxBorrowingRate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.closeVault}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  closeVault(overrides?: EthersTransactionOverrides): Promise<VaultClosureDetails> {
    return this.send.closeVault(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.adjustVault}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  adjustVault(
    params: VaultAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send.adjustVault(params, maxBorrowingRate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.depositCollateral}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send.depositCollateral(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.withdrawCollateral}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send.withdrawCollateral(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.borrowBPD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  borrowBPD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send.borrowBPD(amount, maxBorrowingRate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.repayBPD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  repayBPD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send.repayBPD(amount, overrides).then(waitForSuccess);
  }

  /** @internal */
  setPrice(price: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.setPrice(price, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.liquidate}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this.send.liquidate(address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.liquidateUpTo}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  liquidateUpTo(
    maximumNumberOfVaultsToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this.send.liquidateUpTo(maximumNumberOfVaultsToLiquidate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.depositBPDInStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  depositBPDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this.send.depositBPDInStabilityPool(amount, frontendTag, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.withdrawBPDFromStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawBPDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this.send.withdrawBPDFromStabilityPool(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.withdrawGainsFromStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityPoolGainsWithdrawalDetails> {
    return this.send.withdrawGainsFromStabilityPool(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.transferCollateralGainToVault}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  transferCollateralGainToVault(
    overrides?: EthersTransactionOverrides
  ): Promise<CollateralGainTransferDetails> {
    return this.send.transferCollateralGainToVault(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.sendBPD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  sendBPD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send.sendBPD(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.sendMP}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  sendMP(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send.sendMP(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.redeemBPD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  redeemBPD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<RedemptionDetails> {
    return this.send.redeemBPD(amount, maxRedemptionRate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.claimCollateralSurplus}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  claimCollateralSurplus(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.claimCollateralSurplus(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.stakeMP}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  stakeMP(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.stakeMP(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.unstakeMP}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  unstakeMP(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.unstakeMP(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.withdrawGainsFromStaking}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStaking(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.withdrawGainsFromStaking(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.registerFrontend}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  registerFrontend(kickbackRate: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.registerFrontend(kickbackRate, overrides).then(waitForSuccess);
  }

  /** @internal */
  _mintUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send._mintUniToken(amount, address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.approveUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  approveUniTokens(allowance?: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.approveUniTokens(allowance, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.stakeUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  stakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.stakeUniTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.unstakeUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  unstakeUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.unstakeUniTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.withdrawMPRewardFromLiquidityMining}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawMPRewardFromLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.withdrawMPRewardFromLiquidityMining(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableMoneyp.exitLiquidityMining}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  exitLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.exitLiquidityMining(overrides).then(waitForSuccess);
  }
}

/**
 * Variant of {@link EthersMoneyp} that exposes a {@link @liquity/lib-base#MoneypStore}.
 *
 * @public
 */
export interface EthersMoneypWithStore<T extends MoneypStore = MoneypStore>
  extends EthersMoneyp {
  /** An object that implements MoneypStore. */
  readonly store: T;
}

class _EthersMoneypWithStore<T extends MoneypStore = MoneypStore>
  extends EthersMoneyp
  implements EthersMoneypWithStore<T> {
  readonly store: T;

  constructor(readable: ReadableEthersMoneypWithStore<T>) {
    super(readable);

    this.store = readable.store;
  }

  hasStore(store?: EthersMoneypStoreOption): boolean {
    return store === undefined || store === this.connection.useStore;
  }
}
