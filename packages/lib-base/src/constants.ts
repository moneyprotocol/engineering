import { Decimal } from "./Decimal";

/**
 * Total collateral ratio below which recovery mode is triggered.
 *
 * @public
 */
export const CRITICAL_COLLATERAL_RATIO = Decimal.from(1.5);

/**
 * Collateral ratio below which a Vault can be liquidated in normal mode.
 *
 * @public
 */
export const MINIMUM_COLLATERAL_RATIO = Decimal.from(1.1);

/**
 * Amount of BPD that's reserved for compensating the liquidator of a Vault.
 *
 * @public
 */
export const BPD_LIQUIDATION_RESERVE = Decimal.from(200);

/**
 * A Vault must always have at least this much debt on top of the
 * {@link BPD_LIQUIDATION_RESERVE | liquidation reserve}.
 *
 * @remarks
 * Any transaction that would result in a Vault with less net debt than this will be reverted.
 *
 * @public
 */
export const BPD_MINIMUM_NET_DEBT = Decimal.from(1800);

/**
 * A Vault must always have at least this much debt.
 *
 * @remarks
 * Any transaction that would result in a Vault with less debt than this will be reverted.
 *
 * @public
 */
export const BPD_MINIMUM_DEBT = BPD_LIQUIDATION_RESERVE.add(BPD_MINIMUM_NET_DEBT);

/**
 * Value that the {@link Fees.borrowingRate | borrowing rate} will never decay below.
 *
 * @remarks
 * Note that the borrowing rate can still be lower than this during recovery mode, when it's
 * overridden by zero.
 *
 * @public
 */
export const MINIMUM_BORROWING_RATE = Decimal.from(0.005);

/**
 * Value that the {@link Fees.borrowingRate | borrowing rate} will never exceed.
 *
 * @public
 */
export const MAXIMUM_BORROWING_RATE = Decimal.from(0.05);

/**
 * Value that the {@link Fees.redemptionRate | redemption rate} will never decay below.
 *
 * @public
 */
export const MINIMUM_REDEMPTION_RATE = Decimal.from(0.005);
