// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

/*
 * The Stability Pool holds BPD tokens deposited by Stability Pool depositors.
 *
 * When a vault is liquidated, then depending on system conditions, some of its BPD debt gets offset with
 * BPD in the Stability Pool:  that is, the offset debt evaporates, and an equal amount of BPD tokens in the Stability Pool is burned.
 *
 * Thus, a liquidation causes each depositor to receive a BPD loss, in proportion to their deposit as a share of total deposits.
 * They also receive an RBTC gain, as the RBTC collateral of the liquidated vault is distributed among Stability depositors,
 * in the same proportion.
 *
 * When a liquidation occurs, it depletes every deposit by the same fraction: for example, a liquidation that depletes 40%
 * of the total BPD in the Stability Pool, depletes 40% of each deposit.
 *
 * A deposit that has experienced a series of liquidations is termed a "compounded deposit": each liquidation depletes the deposit,
 * multiplying it by some factor in range ]0,1[
 *
 * Please see the implementation spec in the proof document, which closely follows on from the compounded deposit / RBTC gain derivations:
 * https://github.com/moneyp/moneyp/blob/master/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 * --- MP ISSUANCE TO STABILITY POOL DEPOSITORS ---
 *
 * An MP issuance event occurs at every deposit operation, and every liquidation.
 *
 * Each deposit is tagged with the address of the front end through which it was made.
 *
 * All deposits earn a share of the issued MP in proportion to the deposit as a share of total deposits. The MP earned
 * by a given deposit, is split between the depositor and the front end through which the deposit was made, based on the front end's kickbackRate.
 *
 * Please see the system Readme for an overview:
 * https://github.com/moneyp/dev/blob/main/README.md#mp-issuance-to-stability-providers
 */
interface IStabilityPool {

    // --- Events ---
    
    event StabilityPoolRBTCBalanceUpdated(uint _newBalance);
    event StabilityPoolBPDBalanceUpdated(uint _newBalance);

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event VaultManagerAddressChanged(address _newVaultManagerAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event BPDTokenAddressChanged(address _newBPDTokenAddress);
    event SortedVaultsAddressChanged(address _newSortedVaultsAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CommunityIssuanceAddressChanged(address _newCommunityIssuanceAddress);

    event P_Updated(uint _P);
    event S_Updated(uint _S, uint128 _epoch, uint128 _scale);
    event G_Updated(uint _G, uint128 _epoch, uint128 _scale);
    event EpochUpdated(uint128 _currentEpoch);
    event ScaleUpdated(uint128 _currentScale);

    event FrontEndRegistered(address indexed _frontEnd, uint _kickbackRate);
    event FrontEndTagSet(address indexed _depositor, address indexed _frontEnd);

    event DepositSnapshotUpdated(address indexed _depositor, uint _P, uint _S, uint _G);
    event FrontEndSnapshotUpdated(address indexed _frontEnd, uint _P, uint _G);
    event UserDepositChanged(address indexed _depositor, uint _newDeposit);
    event FrontEndStakeChanged(address indexed _frontEnd, uint _newFrontEndStake, address _depositor);

    event RBTCGainWithdrawn(address indexed _depositor, uint _RBTC, uint _BPDLoss);
    event MPPaidToDepositor(address indexed _depositor, uint _MP);
    event MPPaidToFrontEnd(address indexed _frontEnd, uint _MP);
    event EtherSent(address _to, uint _amount);

    // --- Functions ---

    /*
     * Called only once on init, to set addresses of other Moneyp contracts
     * Callable only by owner, renounces ownership at the end
     */
    function setAddresses(
        address _borrowerOperationsAddress,
        address _vaultManagerAddress,
        address _activePoolAddress,
        address _bpdTokenAddress,
        address _sortedVaultsAddress,
        address _priceFeedAddress,
        address _communityIssuanceAddress
    ) external;

    /*
     * Initial checks:
     * - Frontend is registered or zero address
     * - Sender is not a registered frontend
     * - _amount is not zero
     * ---
     * - Triggers a MP issuance, based on time passed since the last issuance. The MP issuance is shared between *all* depositors and front ends
     * - Tags the deposit with the provided front end tag param, if it's a new deposit
     * - Sends depositor's accumulated gains (MP, RBTC) to depositor
     * - Sends the tagged front end's accumulated MP gains to the tagged front end
     * - Increases deposit and tagged front end's stake, and takes new snapshots for each.
     */
    function provideToSP(uint _amount, address _frontEndTag) external;

    /*
     * Initial checks:
     * - _amount is zero or there are no under collateralized vaults left in the system
     * - User has a non zero deposit
     * ---
     * - Triggers a MP issuance, based on time passed since the last issuance. The MP issuance is shared between *all* depositors and front ends
     * - Removes the deposit's front end tag if it is a full withdrawal
     * - Sends all depositor's accumulated gains (MP, RBTC) to depositor
     * - Sends the tagged front end's accumulated MP gains to the tagged front end
     * - Decreases deposit and tagged front end's stake, and takes new snapshots for each.
     *
     * If _amount > userDeposit, the user withdraws all of their compounded deposit.
     */
    function withdrawFromSP(uint _amount) external;

    /*
     * Initial checks:
     * - User has a non zero deposit
     * - User has an open vault
     * - User has some RBTC gain
     * ---
     * - Triggers a MP issuance, based on time passed since the last issuance. The MP issuance is shared between *all* depositors and front ends
     * - Sends all depositor's MP gain to  depositor
     * - Sends all tagged front end's MP gain to the tagged front end
     * - Transfers the depositor's entire RBTC gain from the Stability Pool to the caller's vault
     * - Leaves their compounded deposit in the Stability Pool
     * - Updates snapshots for deposit and tagged front end stake
     */
    function withdrawRBTCGainToVault(address _upperHint, address _lowerHint) external;

    /*
     * Initial checks:
     * - Frontend (sender) not already registered
     * - User (sender) has no deposit
     * - _kickbackRate is in the range [0, 100%]
     * ---
     * Front end makes a one-time selection of kickback rate upon registering
     */
    function registerFrontEnd(uint _kickbackRate) external;

    /*
     * Initial checks:
     * - Caller is VaultManager
     * ---
     * Cancels out the specified debt against the BPD contained in the Stability Pool (as far as possible)
     * and transfers the Vault's RBTC collateral from ActivePool to StabilityPool.
     * Only called by liquidation functions in the VaultManager.
     */
    function offset(uint _debt, uint _coll) external;

    /*
     * Returns the total amount of RBTC held by the pool, accounted in an internal variable instead of `balance`,
     * to exclude edge cases like RBTC received from a self-destruct.
     */
    function getRBTC() external view returns (uint);

    /*
     * Returns BPD held in the pool. Changes when users deposit/withdraw, and when Vault debt is offset.
     */
    function getTotalBPDDeposits() external view returns (uint);

    /*
     * Calculates the RBTC gain earned by the deposit since its last snapshots were taken.
     */
    function getDepositorRBTCGain(address _depositor) external view returns (uint);

    /*
     * Calculate the MP gain earned by a deposit since its last snapshots were taken.
     * If not tagged with a front end, the depositor gets a 100% cut of what their deposit earned.
     * Otherwise, their cut of the deposit's earnings is equal to the kickbackRate, set by the front end through
     * which they made their deposit.
     */
    function getDepositorMPGain(address _depositor) external view returns (uint);

    /*
     * Return the MP gain earned by the front end.
     */
    function getFrontEndMPGain(address _frontEnd) external view returns (uint);

    /*
     * Return the user's compounded deposit.
     */
    function getCompoundedBPDDeposit(address _depositor) external view returns (uint);

    /*
     * Return the front end's compounded stake.
     *
     * The front end's compounded stake is equal to the sum of its depositors' compounded deposits.
     */
    function getCompoundedFrontEndStake(address _frontEnd) external view returns (uint);

    /*
     * Fallback function
     * Only callable by Active Pool, it just accounts for RBTC received
     * receive() external payable;
     */
}
