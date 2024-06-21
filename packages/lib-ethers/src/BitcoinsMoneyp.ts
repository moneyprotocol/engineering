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
  UserVault,
} from "@moneyprotocol/lib-base";

import {
  BitcoinsMoneypConnection,
  BitcoinsMoneypConnectionOptionalParams,
  BitcoinsMoneypStoreOption,
  _connect,
  _usingStore,
} from "./BitcoinsMoneypConnection";

import {
  BitcoinsCallOverrides,
  BitcoinsProvider,
  BitcoinsSigner,
  BitcoinsTransactionOverrides,
  BitcoinsTransactionReceipt,
} from "./types";

import {
  PopulatableBitcoinsMoneyp,
  SentBitcoinsMoneypTransaction,
} from "./PopulatableBitcoinsMoneyp";
import {
  ReadableBitcoinsMoneyp,
  ReadableBitcoinsMoneypWithStore,
} from "./ReadableBitcoinsMoneyp";
import { SendableBitcoinsMoneyp } from "./SendableBitcoinsMoneyp";
import { BlockPolledMoneypStore } from "./BlockPolledMoneypStore";

/**
 * Thrown by {@link BitcoinsMoneyp} in case of transaction failure.
 *
 * @public
 */
export class BitcoinsTransactionFailedError extends TransactionFailedError<
  FailedReceipt<BitcoinsTransactionReceipt>
> {
  constructor(
    message: string,
    failedReceipt: FailedReceipt<BitcoinsTransactionReceipt>
  ) {
    super("BitcoinsTransactionFailedError", message, failedReceipt);
  }
}

const waitForSuccess = async <T>(tx: SentBitcoinsMoneypTransaction<T>) => {
  const receipt = await tx.waitForReceipt();

  if (receipt.status !== "succeeded") {
    throw new BitcoinsTransactionFailedError("Transaction failed", receipt);
  }

  return receipt.details;
};

/**
 * Convenience class that combines multiple interfaces of the library in one object.
 *
 * @public
 */
export class BitcoinsMoneyp
  implements ReadableBitcoinsMoneyp, TransactableMoneyp
{
  /** Information about the connection to the Moneyp protocol. */
  readonly connection: BitcoinsMoneypConnection;

  /** Can be used to create populated (unsigned) transactions. */
  readonly populate: PopulatableBitcoinsMoneyp;

  /** Can be used to send transactions without waiting for them to be mined. */
  readonly send: SendableBitcoinsMoneyp;

  private _readable: ReadableBitcoinsMoneyp;

  /** @internal */
  constructor(readable: ReadableBitcoinsMoneyp) {
    this._readable = readable;
    this.connection = readable.connection;
    this.populate = new PopulatableBitcoinsMoneyp(readable);
    this.send = new SendableBitcoinsMoneyp(this.populate);
  }

  /** @internal */
  static _from(
    connection: BitcoinsMoneypConnection & { useStore: "blockPolled" }
  ): BitcoinsMoneypWithStore<BlockPolledMoneypStore>;

  /** @internal */
  static _from(connection: BitcoinsMoneypConnection): BitcoinsMoneyp;

  /** @internal */
  static _from(connection: BitcoinsMoneypConnection): BitcoinsMoneyp {
    if (_usingStore(connection)) {
      return new _BitcoinsMoneypWithStore(
        ReadableBitcoinsMoneyp._from(connection)
      );
    } else {
      return new BitcoinsMoneyp(ReadableBitcoinsMoneyp._from(connection));
    }
  }

  /** @internal */
  static connect(
    signerOrProvider: BitcoinsSigner | BitcoinsProvider,
    optionalParams: BitcoinsMoneypConnectionOptionalParams & {
      useStore: "blockPolled";
    }
  ): Promise<BitcoinsMoneypWithStore<BlockPolledMoneypStore>>;

  /**
   * Connect to the Moneyp protocol and create an `BitcoinsMoneyp` object.
   *
   * @param signerOrProvider - Bitcoins `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static connect(
    signerOrProvider: BitcoinsSigner | BitcoinsProvider,
    optionalParams?: BitcoinsMoneypConnectionOptionalParams
  ): Promise<BitcoinsMoneyp>;

  static async connect(
    signerOrProvider: BitcoinsSigner | BitcoinsProvider,
    optionalParams?: BitcoinsMoneypConnectionOptionalParams
  ): Promise<BitcoinsMoneyp> {
    return BitcoinsMoneyp._from(
      await _connect(signerOrProvider, optionalParams)
    );
  }

  /**
   * Check whether this `BitcoinsMoneyp` is an {@link BitcoinsMoneypWithStore}.
   */
  hasStore(): this is BitcoinsMoneypWithStore;

  /**
   * Check whether this `BitcoinsMoneyp` is an
   * {@link BitcoinsMoneypWithStore}\<{@link BlockPolledMoneypStore}\>.
   */
  hasStore(
    store: "blockPolled"
  ): this is BitcoinsMoneypWithStore<BlockPolledMoneypStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getTotalRedistributed} */
  getTotalRedistributed(overrides?: BitcoinsCallOverrides): Promise<Vault> {
    return this._readable.getTotalRedistributed(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getVaultBeforeRedistribution} */
  getVaultBeforeRedistribution(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<VaultWithPendingRedistribution> {
    return this._readable.getVaultBeforeRedistribution(address, overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getVault} */
  getVault(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<UserVault> {
    return this._readable.getVault(address, overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getNumberOfVaults} */
  getNumberOfVaults(overrides?: BitcoinsCallOverrides): Promise<number> {
    return this._readable.getNumberOfVaults(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getPrice} */
  getPrice(overrides?: BitcoinsCallOverrides): Promise<Decimal> {
    return this._readable.getPrice(overrides);
  }

  /** @internal */
  _getActivePool(overrides?: BitcoinsCallOverrides): Promise<Vault> {
    return this._readable._getActivePool(overrides);
  }

  /** @internal */
  _getDefaultPool(overrides?: BitcoinsCallOverrides): Promise<Vault> {
    return this._readable._getDefaultPool(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getTotal} */
  getTotal(overrides?: BitcoinsCallOverrides): Promise<Vault> {
    return this._readable.getTotal(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getStabilityDeposit} */
  getStabilityDeposit(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<StabilityDeposit> {
    return this._readable.getStabilityDeposit(address, overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getRemainingStabilityPoolMPReward} */
  getRemainingStabilityPoolMPReward(
    overrides?: BitcoinsCallOverrides
  ): Promise<Decimal> {
    return this._readable.getRemainingStabilityPoolMPReward(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getBPDInStabilityPool} */
  getBPDInStabilityPool(overrides?: BitcoinsCallOverrides): Promise<Decimal> {
    return this._readable.getBPDInStabilityPool(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getBPDBalance} */
  getBPDBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<Decimal> {
    return this._readable.getBPDBalance(address, overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getMPBalance} */
  getMPBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<Decimal> {
    return this._readable.getMPBalance(address, overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getRskSwapTokenBalance} */
  // getRskSwapTokenBalance(address?: string, overrides?: BitcoinsCallOverrides): Promise<Decimal> {
  //   return this._readable.getRskSwapTokenBalance(address, overrides);
  // }

  // /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getRskSwapTokenAllowance} */
  // getRskSwapTokenAllowance(address?: string, overrides?: BitcoinsCallOverrides): Promise<Decimal> {
  //   return this._readable.getRskSwapTokenAllowance(address, overrides);
  // }

  // /** @internal */
  // _getRemainingLiquidityMiningMPRewardCalculator(
  //   overrides?: BitcoinsCallOverrides
  // ): Promise<(blockTimestamp: number) => Decimal> {
  //   return this._readable._getRemainingLiquidityMiningMPRewardCalculator(overrides);
  // }

  // /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getRemainingLiquidityMiningMPReward} */
  // getRemainingLiquidityMiningMPReward(overrides?: BitcoinsCallOverrides): Promise<Decimal> {
  //   return this._readable.getRemainingLiquidityMiningMPReward(overrides);
  // }

  // /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getLiquidityMiningStake} */
  // getLiquidityMiningStake(address?: string, overrides?: BitcoinsCallOverrides): Promise<Decimal> {
  //   return this._readable.getLiquidityMiningStake(address, overrides);
  // }

  // /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getTotalStakedRskSwapTokens} */
  // getTotalStakedRskSwapTokens(overrides?: BitcoinsCallOverrides): Promise<Decimal> {
  //   return this._readable.getTotalStakedRskSwapTokens(overrides);
  // }

  // /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getLiquidityMiningMPReward} */
  // getLiquidityMiningMPReward(address?: string, overrides?: BitcoinsCallOverrides): Promise<Decimal> {
  //   return this._readable.getLiquidityMiningMPReward(address, overrides);
  // }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<Decimal> {
    return this._readable.getCollateralSurplusBalance(address, overrides);
  }

  /** @internal */
  getVaults(
    params: VaultListingParams & { beforeRedistribution: true },
    overrides?: BitcoinsCallOverrides
  ): Promise<VaultWithPendingRedistribution[]>;

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.(getVaults:2)} */
  getVaults(
    params: VaultListingParams,
    overrides?: BitcoinsCallOverrides
  ): Promise<UserVault[]>;

  getVaults(
    params: VaultListingParams,
    overrides?: BitcoinsCallOverrides
  ): Promise<UserVault[]> {
    return this._readable.getVaults(params, overrides);
  }

  /** @internal */
  _getFeesFactory(
    overrides?: BitcoinsCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    return this._readable._getFeesFactory(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getFees} */
  getFees(overrides?: BitcoinsCallOverrides): Promise<Fees> {
    return this._readable.getFees(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getMPStake} */
  getMPStake(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<MPStake> {
    return this._readable.getMPStake(address, overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getTotalStakedMP} */
  getTotalStakedMP(overrides?: BitcoinsCallOverrides): Promise<Decimal> {
    return this._readable.getTotalStakedMP(overrides);
  }

  /** {@inheritDoc @moneyprotocol/lib-base#ReadableMoneyp.getFrontendStatus} */
  getFrontendStatus(
    address?: string,
    overrides?: BitcoinsCallOverrides
  ): Promise<FrontendStatus> {
    return this._readable.getFrontendStatus(address, overrides);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.openVault}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  openVault(
    params: VaultCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<VaultCreationDetails> {
    return this.send
      .openVault(params, maxBorrowingRate, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.closeVault}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  closeVault(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<VaultClosureDetails> {
    return this.send.closeVault(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.adjustVault}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  adjustVault(
    params: VaultAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send
      .adjustVault(params, maxBorrowingRate, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.depositCollateral}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  depositCollateral(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send.depositCollateral(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.withdrawCollateral}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send.withdrawCollateral(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.borrowBPD}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  borrowBPD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send
      .borrowBPD(amount, maxBorrowingRate, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.repayBPD}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  repayBPD(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<VaultAdjustmentDetails> {
    return this.send.repayBPD(amount, overrides).then(waitForSuccess);
  }

  /** @internal */
  setPrice(
    price: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send.setPrice(price, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.liquidate}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  liquidate(
    address: string | string[],
    overrides?: BitcoinsTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this.send.liquidate(address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.liquidateUpTo}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  liquidateUpTo(
    maximumNumberOfVaultsToLiquidate: number,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this.send
      .liquidateUpTo(maximumNumberOfVaultsToLiquidate, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.depositBPDInStabilityPool}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  depositBPDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this.send
      .depositBPDInStabilityPool(amount, frontendTag, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.withdrawBPDFromStabilityPool}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  withdrawBPDFromStabilityPool(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this.send
      .withdrawBPDFromStabilityPool(amount, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.withdrawGainsFromStabilityPool}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStabilityPool(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<StabilityPoolGainsWithdrawalDetails> {
    return this.send
      .withdrawGainsFromStabilityPool(overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.transferCollateralGainToVault}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  transferCollateralGainToVault(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<CollateralGainTransferDetails> {
    return this.send
      .transferCollateralGainToVault(overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.sendBPD}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  sendBPD(
    toAddress: string,
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send.sendBPD(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.sendMP}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  sendMP(
    toAddress: string,
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send.sendMP(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.redeemBPD}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  redeemBPD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<RedemptionDetails> {
    return this.send
      .redeemBPD(amount, maxRedemptionRate, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.claimCollateralSurplus}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  claimCollateralSurplus(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send.claimCollateralSurplus(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.stakeMP}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  stakeMP(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send.stakeMP(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.unstakeMP}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  unstakeMP(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send.unstakeMP(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.withdrawGainsFromStaking}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStaking(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send.withdrawGainsFromStaking(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.registerFrontend}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  registerFrontend(
    kickbackRate: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send
      .registerFrontend(kickbackRate, overrides)
      .then(waitForSuccess);
  }

  /** @internal */
  _mintRskSwapToken(
    amount: Decimalish,
    address?: string,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send
      ._mintRskSwapToken(amount, address, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.approveRskSwapTokens}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  approveRskSwapTokens(
    allowance?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send
      .approveRskSwapTokens(allowance, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.stakeRskSwapTokens}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  stakeRskSwapTokens(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send.stakeRskSwapTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.unstakeRskSwapTokens}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  unstakeRskSwapTokens(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send
      .unstakeRskSwapTokens(amount, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.withdrawMPRewardFromLiquidityMining}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  withdrawMPRewardFromLiquidityMining(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<void> {
    return this.send
      .withdrawMPRewardFromLiquidityMining(overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @moneyprotocol/lib-base#TransactableMoneyp.exitLiquidityMining}
   *
   * @throws
   * Throws {@link BitcoinsTransactionFailedError} in case of transaction failure.
   */
  exitLiquidityMining(overrides?: BitcoinsTransactionOverrides): Promise<void> {
    return this.send.exitLiquidityMining(overrides).then(waitForSuccess);
  }
}

/**
 * Variant of {@link BitcoinsMoneyp} that exposes a {@link @moneyprotocol/lib-base#MoneypStore}.
 *
 * @public
 */
export interface BitcoinsMoneypWithStore<T extends MoneypStore = MoneypStore>
  extends BitcoinsMoneyp {
  /** An object that implements MoneypStore. */
  readonly store: T;
}

class _BitcoinsMoneypWithStore<T extends MoneypStore = MoneypStore>
  extends BitcoinsMoneyp
  implements BitcoinsMoneypWithStore<T>
{
  readonly store: T;

  constructor(readable: ReadableBitcoinsMoneypWithStore<T>) {
    super(readable);

    this.store = readable.store;
  }

  hasStore(store?: BitcoinsMoneypStoreOption): boolean {
    return store === undefined || store === this.connection.useStore;
  }
}
