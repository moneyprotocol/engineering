import assert from "assert";

import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Log } from "@ethersproject/abstract-provider";

import {
  CollateralGainTransferDetails,
  Decimal,
  Decimalish,
  LiquidationDetails,
  MoneypReceipt,
  BPD_MINIMUM_NET_DEBT,
  MinedReceipt,
  PopulatableMoneyp,
  PopulatedMoneypTransaction,
  PopulatedRedemption,
  RedemptionDetails,
  SentMoneypTransaction,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  Vault,
  VaultAdjustmentDetails,
  VaultAdjustmentParams,
  VaultClosureDetails,
  VaultCreationDetails,
  VaultCreationParams,
  VaultWithPendingRedistribution,
  _failedReceipt,
  _normalizeVaultAdjustment,
  _normalizeVaultCreation,
  _pendingReceipt,
  _successfulReceipt
} from "@liquity/lib-base";

import {
  BitcoinsPopulatedTransaction,
  BitcoinsTransactionOverrides,
  BitcoinsTransactionReceipt,
  BitcoinsTransactionResponse
} from "./types";

import {
  BitcoinsMoneypConnection,
  _getContracts,
  _getProvider,
  _requireAddress,
  _requireSigner
} from "./BitcoinsMoneypConnection";

import { _priceFeedIsTestnet, _rskSwapTokenIsMock } from "./contracts";
import { logsToString } from "./parseLogs";
import { ReadableBitcoinsMoneyp } from "./ReadableBitcoinsMoneyp";

const decimalify = (bigNumber: BigNumber) => Decimal.fromBigNumberString(bigNumber.toHexString());

// With 70 iterations redemption costs about ~10M gas, and each iteration accounts for ~138k more
/** @internal */
export const _redeemMaxIterations = 70;

const defaultBorrowingRateSlippageTolerance = Decimal.from(0.005); // 0.5%
const defaultRedemptionRateSlippageTolerance = Decimal.from(0.001); // 0.1%

const noDetails = () => undefined;

const compose = <T, U, V>(f: (_: U) => V, g: (_: T) => U) => (_: T) => f(g(_));

const id = <T>(t: T) => t;

// Takes ~6-7K to update lastFeeOperationTime. Let's be on the safe side.
const addGasForPotentialLastFeeOperationTimeUpdate = (gas: BigNumber) => gas.add(10000);

// An extra traversal can take ~12K.
const addGasForPotentialListTraversal = (gas: BigNumber) => gas.add(25000);

const addGasForMPIssuance = (gas: BigNumber) => gas.add(50000);

const addGasForRskSwapPoolRewardUpdate = (gas: BigNumber) => gas.add(20000);

// To get the best entropy available, we'd do something like:
//
// const bigRandomNumber = () =>
//   BigNumber.from(
//     `0x${Array.from(crypto.getRandomValues(new Uint32Array(8)))
//       .map(u32 => u32.toString(16).padStart(8, "0"))
//       .join("")}`
//   );
//
// However, Window.crypto is browser-specific. Since we only use this for randomly picking Vaults
// during the search for hints, Math.random() will do fine, too.
//
// This returns a random integer between 0 and Number.MAX_SAFE_INTEGER
const randomInteger = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

// Maximum number of trials to perform in a single getApproxHint() call. If the number of trials
// required to get a statistically "good" hint is larger than this, the search for the hint will
// be broken up into multiple getApproxHint() calls.
//
// This should be low enough to work with popular public Ethereum providers like Infura without
// triggering any fair use limits.
const maxNumberOfTrialsAtOnce = 2500;

function* generateTrials(totalNumberOfTrials: number) {
  assert(Number.isInteger(totalNumberOfTrials) && totalNumberOfTrials > 0);

  while (totalNumberOfTrials) {
    const numberOfTrials = Math.min(totalNumberOfTrials, maxNumberOfTrialsAtOnce);
    yield numberOfTrials;

    totalNumberOfTrials -= numberOfTrials;
  }
}

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Returned by {@link SendableBitcoinsMoneyp} functions.
 *
 * @public
 */
export class SentBitcoinsMoneypTransaction<T = unknown>
  implements
    SentMoneypTransaction<BitcoinsTransactionResponse, MoneypReceipt<BitcoinsTransactionReceipt, T>> {
  /** Bitcoins' representation of a sent transaction. */
  readonly rawSentTransaction: BitcoinsTransactionResponse;

  private readonly _connection: BitcoinsMoneypConnection;
  private readonly _parse: (rawReceipt: BitcoinsTransactionReceipt) => T;

  /** @internal */
  constructor(
    rawSentTransaction: BitcoinsTransactionResponse,
    connection: BitcoinsMoneypConnection,
    parse: (rawReceipt: BitcoinsTransactionReceipt) => T
  ) {
    this.rawSentTransaction = rawSentTransaction;
    this._connection = connection;
    this._parse = parse;
  }

  private _receiptFrom(rawReceipt: BitcoinsTransactionReceipt | null) {
    return rawReceipt
      ? rawReceipt.status
        ? _successfulReceipt(rawReceipt, this._parse(rawReceipt), () =>
            logsToString(rawReceipt, _getContracts(this._connection))
          )
        : _failedReceipt(rawReceipt)
      : _pendingReceipt;
  }

  /** {@inheritDoc @liquity/lib-base#SentMoneypTransaction.getReceipt} */
  async getReceipt(): Promise<MoneypReceipt<BitcoinsTransactionReceipt, T>> {
    return this._receiptFrom(
      await _getProvider(this._connection).getTransactionReceipt(this.rawSentTransaction.hash)
    );
  }

  /** {@inheritDoc @liquity/lib-base#SentMoneypTransaction.waitForReceipt} */
  async waitForReceipt(): Promise<MinedReceipt<BitcoinsTransactionReceipt, T>> {
    const receipt = this._receiptFrom(
      await _getProvider(this._connection).waitForTransaction(this.rawSentTransaction.hash)
    );

    assert(receipt.status !== "pending");
    return receipt;
  }
}

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Returned by {@link PopulatableBitcoinsMoneyp} functions.
 *
 * @public
 */
export class PopulatedBitcoinsMoneypTransaction<T = unknown>
  implements
    PopulatedMoneypTransaction<BitcoinsPopulatedTransaction, SentBitcoinsMoneypTransaction<T>> {
  /** Unsigned transaction object populated by Bitcoins. */
  readonly rawPopulatedTransaction: BitcoinsPopulatedTransaction;

  private readonly _connection: BitcoinsMoneypConnection;
  private readonly _parse: (rawReceipt: BitcoinsTransactionReceipt) => T;

  /** @internal */
  constructor(
    rawPopulatedTransaction: BitcoinsPopulatedTransaction,
    connection: BitcoinsMoneypConnection,
    parse: (rawReceipt: BitcoinsTransactionReceipt) => T
  ) {
    this.rawPopulatedTransaction = rawPopulatedTransaction;
    this._connection = connection;
    this._parse = parse;
  }

  /** {@inheritDoc @liquity/lib-base#PopulatedMoneypTransaction.send} */
  async send(): Promise<SentBitcoinsMoneypTransaction<T>> {
    return new SentBitcoinsMoneypTransaction(
      await _requireSigner(this._connection).sendTransaction(this.rawPopulatedTransaction),
      this._connection,
      this._parse
    );
  }
}

/**
 * {@inheritDoc @liquity/lib-base#PopulatedRedemption}
 *
 * @public
 */
export class PopulatedBitcoinsRedemption
  extends PopulatedBitcoinsMoneypTransaction<RedemptionDetails>
  implements
    PopulatedRedemption<
      BitcoinsPopulatedTransaction,
      BitcoinsTransactionResponse,
      BitcoinsTransactionReceipt
    > {
  /** {@inheritDoc @liquity/lib-base#PopulatedRedemption.attemptedBPDAmount} */
  readonly attemptedBPDAmount: Decimal;

  /** {@inheritDoc @liquity/lib-base#PopulatedRedemption.redeemableBPDAmount} */
  readonly redeemableBPDAmount: Decimal;

  /** {@inheritDoc @liquity/lib-base#PopulatedRedemption.isTruncated} */
  readonly isTruncated: boolean;

  private readonly _increaseAmountByMinimumNetDebt?: (
    maxRedemptionRate?: Decimalish
  ) => Promise<PopulatedBitcoinsRedemption>;

  /** @internal */
  constructor(
    rawPopulatedTransaction: BitcoinsPopulatedTransaction,
    connection: BitcoinsMoneypConnection,
    attemptedBPDAmount: Decimal,
    redeemableBPDAmount: Decimal,
    increaseAmountByMinimumNetDebt?: (
      maxRedemptionRate?: Decimalish
    ) => Promise<PopulatedBitcoinsRedemption>
  ) {
    const { vaultManager } = _getContracts(connection);

    super(
      rawPopulatedTransaction,
      connection,

      ({ logs }) =>
        vaultManager
          .extractEvents(logs, "Redemption")
          .map(({ args: { _RBTCSent, _RBTCFee, _actualBPDAmount, _attemptedBPDAmount } }) => ({
            attemptedBPDAmount: decimalify(_attemptedBPDAmount),
            actualBPDAmount: decimalify(_actualBPDAmount),
            collateralTaken: decimalify(_RBTCSent),
            fee: decimalify(_RBTCFee)
          }))[0]
    );

    this.attemptedBPDAmount = attemptedBPDAmount;
    this.redeemableBPDAmount = redeemableBPDAmount;
    this.isTruncated = redeemableBPDAmount.lt(attemptedBPDAmount);
    this._increaseAmountByMinimumNetDebt = increaseAmountByMinimumNetDebt;
  }

  /** {@inheritDoc @liquity/lib-base#PopulatedRedemption.increaseAmountByMinimumNetDebt} */
  increaseAmountByMinimumNetDebt(
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedBitcoinsRedemption> {
    if (!this._increaseAmountByMinimumNetDebt) {
      throw new Error(
        "PopulatedBitcoinsRedemption: increaseAmountByMinimumNetDebt() can " +
          "only be called when amount is truncated"
      );
    }

    return this._increaseAmountByMinimumNetDebt(maxRedemptionRate);
  }
}

/** @internal */
export interface _VaultChangeWithFees<T> {
  params: T;
  newVault: Vault;
  fee: Decimal;
}

/**
 * Bitcoins-based implementation of {@link @liquity/lib-base#PopulatableMoneyp}.
 *
 * @public
 */
export class PopulatableBitcoinsMoneyp
  implements
    PopulatableMoneyp<
      BitcoinsTransactionReceipt,
      BitcoinsTransactionResponse,
      BitcoinsPopulatedTransaction
    > {
  private readonly _readable: ReadableBitcoinsMoneyp;

  constructor(readable: ReadableBitcoinsMoneyp) {
    this._readable = readable;
  }

  private _wrapSimpleTransaction(
    rawPopulatedTransaction: BitcoinsPopulatedTransaction
  ): PopulatedBitcoinsMoneypTransaction<void> {
    return new PopulatedBitcoinsMoneypTransaction(
      rawPopulatedTransaction,
      this._readable.connection,
      noDetails
    );
  }

  private _wrapVaultChangeWithFees<T>(
    params: T,
    rawPopulatedTransaction: BitcoinsPopulatedTransaction
  ): PopulatedBitcoinsMoneypTransaction<_VaultChangeWithFees<T>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return new PopulatedBitcoinsMoneypTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const [newVault] = borrowerOperations
          .extractEvents(logs, "VaultUpdated")
          .map(({ args: { _coll, _debt } }) => new Vault(decimalify(_coll), decimalify(_debt)));

        const [fee] = borrowerOperations
          .extractEvents(logs, "BPDBorrowingFeePaid")
          .map(({ args: { _BPDFee } }) => decimalify(_BPDFee));

        return {
          params,
          newVault,
          fee
        };
      }
    );
  }

  private async _wrapVaultClosure(
    rawPopulatedTransaction: BitcoinsPopulatedTransaction
  ): Promise<PopulatedBitcoinsMoneypTransaction<VaultClosureDetails>> {
    const { activePool, bpdToken } = _getContracts(this._readable.connection);

    return new PopulatedBitcoinsMoneypTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs, from: userAddress }) => {
        const [repayBPD] = bpdToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === userAddress && to === AddressZero)
          .map(({ args: { value } }) => decimalify(value));

        const [withdrawCollateral] = activePool
          .extractEvents(logs, "BitcoinSent")
          .filter(({ args: { _to } }) => _to === userAddress)
          .map(({ args: { _amount } }) => decimalify(_amount));

        return {
          params: repayBPD.nonZero ? { withdrawCollateral, repayBPD } : { withdrawCollateral }
        };
      }
    );
  }

  private _wrapLiquidation(
    rawPopulatedTransaction: BitcoinsPopulatedTransaction
  ): PopulatedBitcoinsMoneypTransaction<LiquidationDetails> {
    const { vaultManager } = _getContracts(this._readable.connection);

    return new PopulatedBitcoinsMoneypTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const liquidatedAddresses = vaultManager
          .extractEvents(logs, "VaultLiquidated")
          .map(({ args: { _borrower } }) => _borrower);

        const [totals] = vaultManager
          .extractEvents(logs, "Liquidation")
          .map(
            ({
              args: { _BPDGasCompensation, _collGasCompensation, _liquidatedColl, _liquidatedDebt }
            }) => ({
              collateralGasCompensation: decimalify(_collGasCompensation),
              bpdGasCompensation: decimalify(_BPDGasCompensation),
              totalLiquidated: new Vault(decimalify(_liquidatedColl), decimalify(_liquidatedDebt))
            })
          );

        return {
          liquidatedAddresses,
          ...totals
        };
      }
    );
  }

  private _extractStabilityPoolGainsWithdrawalDetails(
    logs: Log[]
  ): StabilityPoolGainsWithdrawalDetails {
    const { stabilityPool } = _getContracts(this._readable.connection);

    const [newBPDDeposit] = stabilityPool
      .extractEvents(logs, "UserDepositChanged")
      .map(({ args: { _newDeposit } }) => decimalify(_newDeposit));

    const [[collateralGain, bpdLoss]] = stabilityPool
      .extractEvents(logs, "RBTCGainWithdrawn")
      .map(({ args: { _RBTC, _BPDLoss } }) => [decimalify(_RBTC), decimalify(_BPDLoss)]);

    const [mpReward] = stabilityPool
      .extractEvents(logs, "MPPaidToDepositor")
      .map(({ args: { _MP } }) => decimalify(_MP));

    return {
      bpdLoss,
      newBPDDeposit,
      collateralGain,
      mpReward
    };
  }

  private _wrapStabilityPoolGainsWithdrawal(
    rawPopulatedTransaction: BitcoinsPopulatedTransaction
  ): PopulatedBitcoinsMoneypTransaction<StabilityPoolGainsWithdrawalDetails> {
    return new PopulatedBitcoinsMoneypTransaction(
      rawPopulatedTransaction,
      this._readable.connection,
      ({ logs }) => this._extractStabilityPoolGainsWithdrawalDetails(logs)
    );
  }

  private _wrapStabilityDepositTopup(
    change: { depositBPD: Decimal },
    rawPopulatedTransaction: BitcoinsPopulatedTransaction
  ): PopulatedBitcoinsMoneypTransaction<StabilityDepositChangeDetails> {
    return new PopulatedBitcoinsMoneypTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => ({
        ...this._extractStabilityPoolGainsWithdrawalDetails(logs),
        change
      })
    );
  }

  private async _wrapStabilityDepositWithdrawal(
    rawPopulatedTransaction: BitcoinsPopulatedTransaction
  ): Promise<PopulatedBitcoinsMoneypTransaction<StabilityDepositChangeDetails>> {
    const { stabilityPool, bpdToken } = _getContracts(this._readable.connection);

    return new PopulatedBitcoinsMoneypTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs, from: userAddress }) => {
        const gainsWithdrawalDetails = this._extractStabilityPoolGainsWithdrawalDetails(logs);

        const [withdrawBPD] = bpdToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === stabilityPool.address && to === userAddress)
          .map(({ args: { value } }) => decimalify(value));

        return {
          ...gainsWithdrawalDetails,
          change: { withdrawBPD, withdrawAllBPD: gainsWithdrawalDetails.newBPDDeposit.isZero }
        };
      }
    );
  }

  private _wrapCollateralGainTransfer(
    rawPopulatedTransaction: BitcoinsPopulatedTransaction
  ): PopulatedBitcoinsMoneypTransaction<CollateralGainTransferDetails> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return new PopulatedBitcoinsMoneypTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const [newVault] = borrowerOperations
          .extractEvents(logs, "VaultUpdated")
          .map(({ args: { _coll, _debt } }) => new Vault(decimalify(_coll), decimalify(_debt)));

        return {
          ...this._extractStabilityPoolGainsWithdrawalDetails(logs),
          newVault
        };
      }
    );
  }

  private async _findHintsForNominalCollateralRatio(
    nominalCollateralRatio: Decimal
  ): Promise<[string, string]> {
    const { sortedVaults, hintHelpers } = _getContracts(this._readable.connection);
    const numberOfVaults = await this._readable.getNumberOfVaults();

    if (!numberOfVaults) {
      return [AddressZero, AddressZero];
    }

    if (nominalCollateralRatio.infinite) {
      return [AddressZero, await sortedVaults.getFirst()];
    }

    const totalNumberOfTrials = Math.ceil(10 * Math.sqrt(numberOfVaults));
    const [firstTrials, ...restOfTrials] = generateTrials(totalNumberOfTrials);

    const collectApproxHint = (
      {
        latestRandomSeed,
        results
      }: {
        latestRandomSeed: BigNumberish;
        results: { diff: BigNumber; hintAddress: string }[];
      },
      numberOfTrials: number
    ) =>
      hintHelpers
        .getApproxHint(nominalCollateralRatio.hex, numberOfTrials, latestRandomSeed)
        .then(({ latestRandomSeed, ...result }) => ({
          latestRandomSeed,
          results: [...results, result]
        }));

    const { results } = await restOfTrials.reduce(
      (p, numberOfTrials) => p.then(state => collectApproxHint(state, numberOfTrials)),
      collectApproxHint({ latestRandomSeed: randomInteger(), results: [] }, firstTrials)
    );

    const { hintAddress } = results.reduce((a, b) => (a.diff.lt(b.diff) ? a : b));

    return sortedVaults.findInsertPosition(nominalCollateralRatio.hex, hintAddress, hintAddress);
  }

  private async _findHints(vault: Vault): Promise<[string, string]> {
    if (vault instanceof VaultWithPendingRedistribution) {
      throw new Error("Rewards must be applied to this Vault");
    }

    return this._findHintsForNominalCollateralRatio(vault._nominalCollateralRatio);
  }

  private async _findRedemptionHints(
    amount: Decimal
  ): Promise<
    [
      truncatedAmount: Decimal,
      firstRedemptionHint: string,
      partialRedemptionUpperHint: string,
      partialRedemptionLowerHint: string,
      partialRedemptionHintNICR: BigNumber
    ]
  > {
    const { hintHelpers } = _getContracts(this._readable.connection);
    const price = await this._readable.getPrice();

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR,
      truncatedBPDamount
    } = await hintHelpers.getRedemptionHints(amount.hex, price.hex, _redeemMaxIterations);

    const [
      partialRedemptionUpperHint,
      partialRedemptionLowerHint
    ] = partialRedemptionHintNICR.isZero()
      ? [AddressZero, AddressZero]
      : await this._findHintsForNominalCollateralRatio(decimalify(partialRedemptionHintNICR));

    return [
      decimalify(truncatedBPDamount),
      firstRedemptionHint,
      partialRedemptionUpperHint,
      partialRedemptionLowerHint,
      partialRedemptionHintNICR
    ];
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.openVault} */
  async openVault(
    params: VaultCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<VaultCreationDetails>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    const normalized = _normalizeVaultCreation(params);
    const { depositCollateral, borrowBPD } = normalized;

    const fees = await this._readable.getFees();
    const borrowingRate = fees.borrowingRate();
    const newVault = Vault.create(normalized, borrowingRate);

    maxBorrowingRate =
      maxBorrowingRate !== undefined
        ? Decimal.from(maxBorrowingRate)
        : borrowingRate.add(defaultBorrowingRateSlippageTolerance);

    return this._wrapVaultChangeWithFees(
      normalized,
      await borrowerOperations.estimateAndPopulate.openVault(
        { value: depositCollateral.hex, ...overrides },
        compose(addGasForPotentialLastFeeOperationTimeUpdate, addGasForPotentialListTraversal),
        maxBorrowingRate.hex,
        borrowBPD.hex,
        ...(await this._findHints(newVault))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.closeVault} */
  async closeVault(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<VaultClosureDetails>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return this._wrapVaultClosure(
      await borrowerOperations.estimateAndPopulate.closeVault({ ...overrides }, id)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this.adjustVault({ depositCollateral: amount }, undefined, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this.adjustVault({ withdrawCollateral: amount }, undefined, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.borrowBPD} */
  borrowBPD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this.adjustVault({ borrowBPD: amount }, maxBorrowingRate, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.repayBPD} */
  repayBPD(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    return this.adjustVault({ repayBPD: amount }, undefined, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.adjustVault} */
  async adjustVault(
    params: VaultAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<VaultAdjustmentDetails>> {
    const address = _requireAddress(this._readable.connection, overrides);
    const { borrowerOperations } = _getContracts(this._readable.connection);

    const normalized = _normalizeVaultAdjustment(params);
    const { depositCollateral, withdrawCollateral, borrowBPD, repayBPD } = normalized;

    const [vault, fees] = await Promise.all([
      this._readable.getVault(address),
      borrowBPD && this._readable.getFees()
    ]);

    const borrowingRate = fees?.borrowingRate();
    const finalVault = vault.adjust(normalized, borrowingRate);

    maxBorrowingRate =
      maxBorrowingRate !== undefined
        ? Decimal.from(maxBorrowingRate)
        : borrowingRate?.add(defaultBorrowingRateSlippageTolerance) ?? Decimal.ZERO;

    return this._wrapVaultChangeWithFees(
      normalized,
      await borrowerOperations.estimateAndPopulate.adjustVault(
        { value: depositCollateral?.hex, ...overrides },
        compose(
          borrowBPD ? addGasForPotentialLastFeeOperationTimeUpdate : id,
          addGasForPotentialListTraversal
        ),
        maxBorrowingRate.hex,
        (withdrawCollateral ?? Decimal.ZERO).hex,
        (borrowBPD ?? repayBPD ?? Decimal.ZERO).hex,
        !!borrowBPD,
        ...(await this._findHints(finalVault))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.claimCollateralSurplus} */
  async claimCollateralSurplus(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await borrowerOperations.estimateAndPopulate.claimCollateral({ ...overrides }, id)
    );
  }

  /** @internal */
  async setPrice(
    price: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { priceFeed } = _getContracts(this._readable.connection);

    if (!_priceFeedIsTestnet(priceFeed)) {
      throw new Error("setPrice() unavailable on this deployment of Moneyp");
    }

    return this._wrapSimpleTransaction(
      await priceFeed.estimateAndPopulate.setPrice({ ...overrides }, id, Decimal.from(price).hex)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.liquidate} */
  async liquidate(
    address: string | string[],
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<LiquidationDetails>> {
    const { vaultManager } = _getContracts(this._readable.connection);

    if (Array.isArray(address)) {
      return this._wrapLiquidation(
        await vaultManager.estimateAndPopulate.batchLiquidateVaults(
          { ...overrides },
          addGasForMPIssuance,
          address
        )
      );
    } else {
      return this._wrapLiquidation(
        await vaultManager.estimateAndPopulate.liquidate(
          { ...overrides },
          addGasForMPIssuance,
          address
        )
      );
    }
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.liquidateUpTo} */
  async liquidateUpTo(
    maximumNumberOfVaultsToLiquidate: number,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<LiquidationDetails>> {
    const { vaultManager } = _getContracts(this._readable.connection);

    return this._wrapLiquidation(
      await vaultManager.estimateAndPopulate.liquidateVaults(
        { ...overrides },
        addGasForMPIssuance,
        maximumNumberOfVaultsToLiquidate
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.depositBPDInStabilityPool} */
  async depositBPDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<StabilityDepositChangeDetails>> {
    const { stabilityPool } = _getContracts(this._readable.connection);
    const depositBPD = Decimal.from(amount);

    return this._wrapStabilityDepositTopup(
      { depositBPD },
      await stabilityPool.estimateAndPopulate.provideToSP(
        { ...overrides },
        addGasForMPIssuance,
        depositBPD.hex,
        frontendTag ?? this._readable.connection.frontendTag ?? AddressZero
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.withdrawBPDFromStabilityPool} */
  async withdrawBPDFromStabilityPool(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<StabilityDepositChangeDetails>> {
    const { stabilityPool } = _getContracts(this._readable.connection);

    return this._wrapStabilityDepositWithdrawal(
      await stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForMPIssuance,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.withdrawGainsFromStabilityPool} */
  async withdrawGainsFromStabilityPool(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<StabilityPoolGainsWithdrawalDetails>> {
    const { stabilityPool } = _getContracts(this._readable.connection);

    return this._wrapStabilityPoolGainsWithdrawal(
      await stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForMPIssuance,
        Decimal.ZERO.hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.transferCollateralGainToVault} */
  async transferCollateralGainToVault(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<CollateralGainTransferDetails>> {
    const address = _requireAddress(this._readable.connection, overrides);
    const { stabilityPool } = _getContracts(this._readable.connection);

    const [initialVault, stabilityDeposit] = await Promise.all([
      this._readable.getVault(address),
      this._readable.getStabilityDeposit(address)
    ]);

    const finalVault = initialVault.addCollateral(stabilityDeposit.collateralGain);

    return this._wrapCollateralGainTransfer(
      await stabilityPool.estimateAndPopulate.withdrawRBTCGainToVault(
        { ...overrides },
        compose(addGasForPotentialListTraversal, addGasForMPIssuance),
        ...(await this._findHints(finalVault))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.sendBPD} */
  async sendBPD(
    toAddress: string,
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { bpdToken } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await bpdToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.sendMP} */
  async sendMP(
    toAddress: string,
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { mpToken } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await mpToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.redeemBPD} */
  async redeemBPD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsRedemption> {
    const { vaultManager } = _getContracts(this._readable.connection);
    const attemptedBPDAmount = Decimal.from(amount);

    const [
      fees,
      total,
      [truncatedAmount, firstRedemptionHint, ...partialHints]
    ] = await Promise.all([
      this._readable.getFees(),
      this._readable.getTotal(),
      this._findRedemptionHints(attemptedBPDAmount)
    ]);

    if (truncatedAmount.isZero) {
      throw new Error(
        `redeemBPD: amount too low to redeem (try at least ${BPD_MINIMUM_NET_DEBT})`
      );
    }

    const defaultMaxRedemptionRate = (amount: Decimal) =>
      Decimal.min(
        fees.redemptionRate(amount.div(total.debt)).add(defaultRedemptionRateSlippageTolerance),
        Decimal.ONE
      );

    const populateRedemption = async (
      attemptedBPDAmount: Decimal,
      maxRedemptionRate?: Decimalish,
      truncatedAmount: Decimal = attemptedBPDAmount,
      partialHints: [string, string, BigNumberish] = [AddressZero, AddressZero, 0]
    ): Promise<PopulatedBitcoinsRedemption> => {
      const maxRedemptionRateOrDefault =
        maxRedemptionRate !== undefined
          ? Decimal.from(maxRedemptionRate)
          : defaultMaxRedemptionRate(truncatedAmount);

      return new PopulatedBitcoinsRedemption(
        await vaultManager.estimateAndPopulate.redeemCollateral(
          { ...overrides },
          addGasForPotentialLastFeeOperationTimeUpdate,
          truncatedAmount.hex,
          firstRedemptionHint,
          ...partialHints,
          _redeemMaxIterations,
          maxRedemptionRateOrDefault.hex
        ),

        this._readable.connection,
        attemptedBPDAmount,
        truncatedAmount,

        truncatedAmount.lt(attemptedBPDAmount)
          ? newMaxRedemptionRate =>
              populateRedemption(
                truncatedAmount.add(BPD_MINIMUM_NET_DEBT),
                newMaxRedemptionRate ?? maxRedemptionRate
              )
          : undefined
      );
    };

    return populateRedemption(attemptedBPDAmount, maxRedemptionRate, truncatedAmount, partialHints);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.stakeMP} */
  async stakeMP(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { mpStaking } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await mpStaking.estimateAndPopulate.stake({ ...overrides }, id, Decimal.from(amount).hex)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.unstakeMP} */
  async unstakeMP(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { mpStaking } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await mpStaking.estimateAndPopulate.unstake({ ...overrides }, id, Decimal.from(amount).hex)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    return this.unstakeMP(Decimal.ZERO, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.registerFrontend} */
  async registerFrontend(
    kickbackRate: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { stabilityPool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await stabilityPool.estimateAndPopulate.registerFrontEnd(
        { ...overrides },
        id,
        Decimal.from(kickbackRate).hex
      )
    );
  }

  /** @internal */
  async _mintRskSwapToken(
    amount: Decimalish,
    address?: string,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    address ??= _requireAddress(this._readable.connection, overrides);
    const { rskSwapToken } = _getContracts(this._readable.connection);

    if (!_rskSwapTokenIsMock(rskSwapToken)) {
      throw new Error("_mintRskSwapToken() unavailable on this deployment of Moneyp");
    }

    return this._wrapSimpleTransaction(
      await rskSwapToken.estimateAndPopulate.mint(
        { ...overrides },
        id,
        address,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.approveRskSwapTokens} */
  async approveRskSwapTokens(
    allowance?: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { rskSwapToken, unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await rskSwapToken.estimateAndPopulate.approve(
        { ...overrides },
        id,
        unipool.address,
        Decimal.from(allowance ?? Decimal.INFINITY).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.stakeRskSwapTokens} */
  async stakeRskSwapTokens(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.stake(
        { ...overrides },
        addGasForRskSwapPoolRewardUpdate,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.unstakeRskSwapTokens} */
  async unstakeRskSwapTokens(
    amount: Decimalish,
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.withdraw(
        { ...overrides },
        addGasForRskSwapPoolRewardUpdate,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.withdrawMPRewardFromLiquidityMining} */
  async withdrawMPRewardFromLiquidityMining(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.claimReward({ ...overrides }, addGasForRskSwapPoolRewardUpdate)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMoneyp.exitLiquidityMining} */
  async exitLiquidityMining(
    overrides?: BitcoinsTransactionOverrides
  ): Promise<PopulatedBitcoinsMoneypTransaction<void>> {
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.withdrawAndClaim(
        { ...overrides },
        addGasForRskSwapPoolRewardUpdate
      )
    );
  }
}
