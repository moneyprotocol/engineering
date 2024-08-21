import { Decimal } from "./Decimal";
import { Vault, VaultWithPendingRedistribution, UserVault } from "./Vault";
import { StabilityDeposit } from "./StabilityDeposit";
import { Fees } from "./Fees";
import { MPStake } from "./MPStake";

/**
 * Represents whether an address has been registered as a Moneyp frontend.
 *
 * @remarks
 * Returned by the {@link ReadableMoneyp.getFrontendStatus | getFrontendStatus()} function.
 *
 * When `status` is `"registered"`, `kickbackRate` gives the frontend's kickback rate as a
 * {@link Decimal} between 0 and 1.
 *
 * @public
 */
export type FrontendStatus =
  | { status: "unregistered" }
  | { status: "registered"; kickbackRate: Decimal };

/**
 * Parameters of the {@link ReadableMoneyp.(getVaults:2) | getVaults()} function.
 *
 * @public
 */
export interface VaultListingParams {
  /** Number of Vaults to retrieve. */
  readonly first: number;

  /** How the Vaults should be sorted. */
  readonly sortedBy: "ascendingCollateralRatio" | "descendingCollateralRatio";

  /** Index of the first Vault to retrieve from the sorted list. */
  readonly startingAt?: number;

  /**
   * When set to `true`, the retrieved Vaults won't include the liquidation shares received since
   * the last time they were directly modified.
   *
   * @remarks
   * Changes the type of returned Vaults to {@link VaultWithPendingRedistribution}.
   */
  readonly beforeRedistribution?: boolean;
}

/**
 * Read the state of the Moneyp protocol.
 *
 * @remarks
 * Implemented by {@link @moneyprotocol/lib-ethers#BitcoinsMoneyp}.
 *
 * @public
 */
export interface ReadableMoneyp {
  /**
   * Get the total collateral and debt per stake that has been liquidated through redistribution.
   *
   * @remarks
   * Needed when dealing with instances of {@link @money-protocol/lib-base#VaultWithPendingRedistribution}.
   */
  getTotalRedistributed(): Promise<Vault>;

  /**
   * Get a Vault in its state after the last direct modification.
   *
   * @param address - Address that owns the Vault.
   *
   * @remarks
   * The current state of a Vault can be fetched using
   * {@link @money-protocol/lib-base#ReadableMoneyp.getVault | getVault()}.
   */
  getVaultBeforeRedistribution(
    address?: string
  ): Promise<VaultWithPendingRedistribution>;

  /**
   * Get the current state of a Vault.
   *
   * @param address - Address that owns the Vault.
   */
  getVault(address?: string): Promise<UserVault>;

  /**
   * Get number of Vaults that are currently open.
   */
  getNumberOfVaults(): Promise<number>;

  /**
   * Get the current price of the native currency (e.g. Ether) in USD.
   */
  getPrice(): Promise<Decimal>;

  /**
   * Get the total amount of collateral and debt in the Moneyp system.
   */
  getTotal(): Promise<Vault>;

  /**
   * Get the current state of a Stability Deposit.
   *
   * @param address - Address that owns the Stability Deposit.
   */
  getStabilityDeposit(address?: string): Promise<StabilityDeposit>;

  /**
   * Get the remaining MP that will be collectively rewarded to stability depositors.
   */
  getRemainingStabilityPoolMPReward(): Promise<Decimal>;

  /**
   * Get the total amount of BPD currently deposited in the Stability Pool.
   */
  getBPDInStabilityPool(): Promise<Decimal>;

  /**
   * Get the amount of BPD held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getBPDBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of MP held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getMPBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of leftover collateral available for withdrawal by an address.
   *
   * @remarks
   * When a Vault gets liquidated or redeemed, any collateral it has above 110% (in case of
   * liquidation) or 100% collateralization (in case of redemption) gets sent to a pool, where it
   * can be withdrawn from using
   * {@link @money-protocol/lib-base#TransactableMoneyp.claimCollateralSurplus | claimCollateralSurplus()}.
   */
  getCollateralSurplusBalance(address?: string): Promise<Decimal>;

  /** @internal */
  getVaults(
    params: VaultListingParams & { beforeRedistribution: true }
  ): Promise<VaultWithPendingRedistribution[]>;

  /**
   * Get a slice from the list of Vaults.
   *
   * @param params - Controls how the list is sorted, and where the slice begins and ends.
   * @returns Pairs of owner addresses and their Vaults.
   */
  getVaults(params: VaultListingParams): Promise<UserVault[]>;

  /**
   * Get a calculator for current fees.
   */
  getFees(): Promise<Fees>;

  /**
   * Get the current state of an MP Stake.
   *
   * @param address - Address that owns the MP Stake.
   */
  getMPStake(address?: string): Promise<MPStake>;

  /**
   * Get the total amount of MP currently staked.
   */
  getTotalStakedMP(): Promise<Decimal>;

  /**
   * Check whether an address is registered as a Moneyp frontend, and what its kickback rate is.
   *
   * @param address - Address to check.
   */
  getFrontendStatus(address?: string): Promise<FrontendStatus>;
}
