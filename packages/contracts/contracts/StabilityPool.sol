// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/IVaultManager.sol';
import './Interfaces/IBPDToken.sol';
import './Interfaces/ISortedVaults.sol';
import "./Interfaces/ICommunityIssuance.sol";
import "./Dependencies/MoneypBase.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/MoneypSafeMath128.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

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
 *
 * --- IMPLEMENTATION ---
 *
 * We use a highly scalable method of tracking deposits and RBTC gains that has O(1) complexity.
 *
 * When a liquidation occurs, rather than updating each depositor's deposit and RBTC gain, we simply update two state variables:
 * a product P, and a sum S.
 *
 * A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors' compounded deposits
 * and accumulated RBTC gains over time, as liquidations occur, using just these two variables P and S. When depositors join the
 * Stability Pool, they get a snapshot of the latest P and S: P_t and S_t, respectively.
 *
 *
 * For a given deposit d_t, the ratio P/P_t tells us the factor by which a deposit has decreased since it joined the Stability Pool,
 * and the term d_t * (S - S_t)/P_t gives us the deposit's total accumulated RBTC gain.
 *
 * Each liquidation updates the product P and sum S. After a series of liquidations, a compounded deposit and corresponding RBTC gain
 * can be calculated using the initial deposit, the depositor’s snapshots of P and S, and the latest values of P and S.
 *
 * Any time a depositor updates their deposit (withdrawal, top-up) their accumulated RBTC gain is paid out, their new deposit is recorded
 * (based on their latest compounded deposit and modified by the withdrawal/top-up), and they receive new snapshots of the latest P and S.
 * Essentially, they make a fresh deposit that overwrites the old one.
 *
 *
 * --- SCALE FACTOR ---
 *
 * Since P is a running product in range ]0,1] that is always-decreasing, it should never reach 0 when multiplied by a number in range ]0,1[.
 * Unfortunately, Solidity floor division always reaches 0, sooner or later.
 *
 * A series of liquidations that nearly empty the Pool (and thus each multiply P by a very small number in range ]0,1[ ) may push P
 * to its 18 digit decimal limit, and round it to 0, when in fact the Pool hasn't been emptied: this would break deposit tracking.
 *
 * So, to track P accurately, we use a scale factor: if a liquidation would cause P to decrease to <1e-9 (and be rounded to 0 by Solidity),
 * we first multiply P by 1e9, and increment a currentScale factor by 1.
 *
 * The added benefit of using 1e9 for the scale factor (rather than 1e18) is that it ensures negligible precision loss close to the 
 * scale boundary: when P is at its minimum value of 1e9, the relative precision loss in P due to floor division is only on the 
 * order of 1e-9. 
 *
 * --- EPOCHS ---
 *
 * Whenever a liquidation fully empties the Stability Pool, all deposits should become 0. However, setting P to 0 would make P be 0
 * forever, and break all future reward calculations.
 *
 * So, every time the Stability Pool is emptied by a liquidation, we reset P = 1 and currentScale = 0, and increment the currentEpoch by 1.
 *
 * --- TRACKING DEPOSIT OVER SCALE CHANGES AND EPOCHS ---
 *
 * When a deposit is made, it gets snapshots of the currentEpoch and the currentScale.
 *
 * When calculating a compounded deposit, we compare the current epoch to the deposit's epoch snapshot. If the current epoch is newer,
 * then the deposit was present during a pool-emptying liquidation, and necessarily has been depleted to 0.
 *
 * Otherwise, we then compare the current scale to the deposit's scale snapshot. If they're equal, the compounded deposit is given by d_t * P/P_t.
 * If it spans one scale change, it is given by d_t * P/(P_t * 1e9). If it spans more than one scale change, we define the compounded deposit
 * as 0, since it is now less than 1e-9'th of its initial value (e.g. a deposit of 1 billion BPD has depleted to < 1 BPD).
 *
 *
 *  --- TRACKING DEPOSITOR'S RBTC GAIN OVER SCALE CHANGES AND EPOCHS ---
 *
 * In the current epoch, the latest value of S is stored upon each scale change, and the mapping (scale -> S) is stored for each epoch.
 *
 * This allows us to calculate a deposit's accumulated RBTC gain, during the epoch in which the deposit was non-zero and earned RBTC.
 *
 * We calculate the depositor's accumulated RBTC gain for the scale at which they made the deposit, using the RBTC gain formula:
 * e_1 = d_t * (S - S_t) / P_t
 *
 * and also for scale after, taking care to divide the latter by a factor of 1e9:
 * e_2 = d_t * S / (P_t * 1e9)
 *
 * The gain in the second scale will be full, as the starting point was in the previous scale, thus no need to subtract anything.
 * The deposit therefore was present for reward events from the beginning of that second scale.
 *
 *        S_i-S_t + S_{i+1}
 *      .<--------.------------>
 *      .         .
 *      . S_i     .   S_{i+1}
 *   <--.-------->.<----------->
 *   S_t.         .
 *   <->.         .
 *      t         .
 *  |---+---------|-------------|-----...
 *         i            i+1
 *
 * The sum of (e_1 + e_2) captures the depositor's total accumulated RBTC gain, handling the case where their
 * deposit spanned one scale change. We only care about gains across one scale change, since the compounded
 * deposit is defined as being 0 once it has spanned more than one scale change.
 *
 *
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
 *
 * We use the same mathematical product-sum approach to track MP gains for depositors, where 'G' is the sum corresponding to MP gains.
 * The product P (and snapshot P_t) is re-used, as the ratio P/P_t tracks a deposit's depletion due to liquidations.
 *
 */
contract StabilityPool is MoneypBase, Ownable, CheckContract, IStabilityPool {
    using MoneypSafeMath128 for uint128;

    string constant public NAME = "StabilityPool";

    IBorrowerOperations public borrowerOperations;

    IVaultManager public vaultManager;

    IBPDToken public bpdToken;

    // Needed to check if there are pending liquidations
    ISortedVaults public sortedVaults;

    ICommunityIssuance public communityIssuance;

    uint256 internal RBTC;  // deposited bitcoin tracker

    // Tracker for BPD held in the pool. Changes when users deposit/withdraw, and when Vault debt is offset.
    uint256 internal totalBPDDeposits;

   // --- Data structures ---

    struct FrontEnd {
        uint kickbackRate;
        bool registered;
    }

    struct Deposit {
        uint initialValue;
        address frontEndTag;
    }

    struct Snapshots {
        uint S;
        uint P;
        uint G;
        uint128 scale;
        uint128 epoch;
    }

    mapping (address => Deposit) public deposits;  // depositor address -> Deposit struct
    mapping (address => Snapshots) public depositSnapshots;  // depositor address -> snapshots struct

    mapping (address => FrontEnd) public frontEnds;  // front end address -> FrontEnd struct
    mapping (address => uint) public frontEndStakes; // front end address -> last recorded total deposits, tagged with that front end
    mapping (address => Snapshots) public frontEndSnapshots; // front end address -> snapshots struct

    /*  Product 'P': Running product by which to multiply an initial deposit, in order to find the current compounded deposit,
    * after a series of liquidations have occurred, each of which cancel some BPD debt with the deposit.
    *
    * During its lifetime, a deposit's value evolves from d_t to d_t * P / P_t , where P_t
    * is the snapshot of P taken at the instant the deposit was made. 18-digit decimal.
    */
    uint public P = DECIMAL_PRECISION;

    uint public constant SCALE_FACTOR = 1e9;

    // Each time the scale of P shifts by SCALE_FACTOR, the scale is incremented by 1
    uint128 public currentScale;

    // With each offset that fully empties the Pool, the epoch is incremented by 1
    uint128 public currentEpoch;

    /* RBTC Gain sum 'S': During its lifetime, each deposit d_t earns an RBTC gain of ( d_t * [S - S_t] )/P_t, where S_t
    * is the depositor's snapshot of S taken at the time t when the deposit was made.
    *
    * The 'S' sums are stored in a nested mapping (epoch => scale => sum):
    *
    * - The inner mapping records the sum S at different scales
    * - The outer mapping records the (scale => sum) mappings, for different epochs.
    */
    mapping (uint128 => mapping(uint128 => uint)) public epochToScaleToSum;

    /*
    * Similarly, the sum 'G' is used to calculate MP gains. During it's lifetime, each deposit d_t earns a MP gain of
    *  ( d_t * [G - G_t] )/P_t, where G_t is the depositor's snapshot of G taken at time t when  the deposit was made.
    *
    *  MP reward events occur are triggered by depositor operations (new deposit, topup, withdrawal), and liquidations.
    *  In each case, the MP reward is issued (i.e. G is updated), before other state changes are made.
    */
    mapping (uint128 => mapping(uint128 => uint)) public epochToScaleToG;

    // Error tracker for the error correction in the MP issuance calculation
    uint public lastMPError;
    // Error trackers for the error correction in the offset calculation
    uint public lastRBTCError_Offset;
    uint public lastBPDLossError_Offset;

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
    event BitcoinSent(address _to, uint _amount);

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _vaultManagerAddress,
        address _activePoolAddress,
        address _bpdTokenAddress,
        address _sortedVaultsAddress,
        address _priceFeedAddress,
        address _communityIssuanceAddress
    )
        external
        override
        onlyOwner
    {
        checkContract(_borrowerOperationsAddress);
        checkContract(_vaultManagerAddress);
        checkContract(_activePoolAddress);
        checkContract(_bpdTokenAddress);
        checkContract(_sortedVaultsAddress);
        checkContract(_priceFeedAddress);
        checkContract(_communityIssuanceAddress);

        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        vaultManager = IVaultManager(_vaultManagerAddress);
        activePool = IActivePool(_activePoolAddress);
        bpdToken = IBPDToken(_bpdTokenAddress);
        sortedVaults = ISortedVaults(_sortedVaultsAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        communityIssuance = ICommunityIssuance(_communityIssuanceAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit VaultManagerAddressChanged(_vaultManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit BPDTokenAddressChanged(_bpdTokenAddress);
        emit SortedVaultsAddressChanged(_sortedVaultsAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit CommunityIssuanceAddressChanged(_communityIssuanceAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getRBTC() external view override returns (uint) {
        return RBTC;
    }

    function getTotalBPDDeposits() external view override returns (uint) {
        return totalBPDDeposits;
    }

    // --- External Depositor Functions ---

    /*  provideToSP():
    *
    * - Triggers a MP issuance, based on time passed since the last issuance. The MP issuance is shared between *all* depositors and front ends
    * - Tags the deposit with the provided front end tag param, if it's a new deposit
    * - Sends depositor's accumulated gains (MP, RBTC) to depositor
    * - Sends the tagged front end's accumulated MP gains to the tagged front end
    * - Increases deposit and tagged front end's stake, and takes new snapshots for each.
    */
    function provideToSP(uint _amount, address _frontEndTag) external override {
        _requireFrontEndIsRegisteredOrZero(_frontEndTag);
        _requireFrontEndNotRegistered(msg.sender);
        _requireNonZeroAmount(_amount);

        uint initialDeposit = deposits[msg.sender].initialValue;

        ICommunityIssuance communityIssuanceCached = communityIssuance;

        _triggerMPIssuance(communityIssuanceCached);

        if (initialDeposit == 0) {_setFrontEndTag(msg.sender, _frontEndTag);}
        uint depositorRBTCGain = getDepositorRBTCGain(msg.sender);
        uint compoundedBPDDeposit = getCompoundedBPDDeposit(msg.sender);
        uint BPDLoss = initialDeposit.sub(compoundedBPDDeposit); // Needed only for event log

        // First pay out any MP gains
        address frontEnd = deposits[msg.sender].frontEndTag;
        _payOutMPGains(communityIssuanceCached, msg.sender, frontEnd);

        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake.add(_amount);
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, msg.sender);

        _sendBPDtoStabilityPool(msg.sender, _amount);

        uint newDeposit = compoundedBPDDeposit.add(_amount);
        _updateDepositAndSnapshots(msg.sender, newDeposit);
        emit UserDepositChanged(msg.sender, newDeposit);

        emit RBTCGainWithdrawn(msg.sender, depositorRBTCGain, BPDLoss); // BPD Loss required for event log

        _sendRBTCGainToDepositor(depositorRBTCGain);
     }

    /*  withdrawFromSP():
    *
    * - Triggers a MP issuance, based on time passed since the last issuance. The MP issuance is shared between *all* depositors and front ends
    * - Removes the deposit's front end tag if it is a full withdrawal
    * - Sends all depositor's accumulated gains (MP, RBTC) to depositor
    * - Sends the tagged front end's accumulated MP gains to the tagged front end
    * - Decreases deposit and tagged front end's stake, and takes new snapshots for each.
    *
    * If _amount > userDeposit, the user withdraws all of their compounded deposit.
    */
    function withdrawFromSP(uint _amount) external override {
        if (_amount !=0) {_requireNoUnderCollateralizedVaults();}
        uint initialDeposit = deposits[msg.sender].initialValue;
        _requireUserHasDeposit(initialDeposit);

        ICommunityIssuance communityIssuanceCached = communityIssuance;

        _triggerMPIssuance(communityIssuanceCached);

        uint depositorRBTCGain = getDepositorRBTCGain(msg.sender);

        uint compoundedBPDDeposit = getCompoundedBPDDeposit(msg.sender);
        uint BPDtoWithdraw = MoneypMath._min(_amount, compoundedBPDDeposit);
        uint BPDLoss = initialDeposit.sub(compoundedBPDDeposit); // Needed only for event log

        // First pay out any MP gains
        address frontEnd = deposits[msg.sender].frontEndTag;
        _payOutMPGains(communityIssuanceCached, msg.sender, frontEnd);

        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake.sub(BPDtoWithdraw);
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, msg.sender);

        _sendBPDToDepositor(msg.sender, BPDtoWithdraw);

        // Update deposit
        uint newDeposit = compoundedBPDDeposit.sub(BPDtoWithdraw);
        _updateDepositAndSnapshots(msg.sender, newDeposit);
        emit UserDepositChanged(msg.sender, newDeposit);

        emit RBTCGainWithdrawn(msg.sender, depositorRBTCGain, BPDLoss);  // BPD Loss required for event log

        _sendRBTCGainToDepositor(depositorRBTCGain);
    }

    /* withdrawRBTCGainToVault:
    * - Triggers a MP issuance, based on time passed since the last issuance. The MP issuance is shared between *all* depositors and front ends
    * - Sends all depositor's MP gain to  depositor
    * - Sends all tagged front end's MP gain to the tagged front end
    * - Transfers the depositor's entire RBTC gain from the Stability Pool to the caller's vault
    * - Leaves their compounded deposit in the Stability Pool
    * - Updates snapshots for deposit and tagged front end stake */
    function withdrawRBTCGainToVault(address _upperHint, address _lowerHint) external override {
        uint initialDeposit = deposits[msg.sender].initialValue;
        _requireUserHasDeposit(initialDeposit);
        _requireUserHasVault(msg.sender);
        _requireUserHasRBTCGain(msg.sender);

        ICommunityIssuance communityIssuanceCached = communityIssuance;

        _triggerMPIssuance(communityIssuanceCached);

        uint depositorRBTCGain = getDepositorRBTCGain(msg.sender);

        uint compoundedBPDDeposit = getCompoundedBPDDeposit(msg.sender);
        uint BPDLoss = initialDeposit.sub(compoundedBPDDeposit); // Needed only for event log

        // First pay out any MP gains
        address frontEnd = deposits[msg.sender].frontEndTag;
        _payOutMPGains(communityIssuanceCached, msg.sender, frontEnd);

        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake;
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, msg.sender);

        _updateDepositAndSnapshots(msg.sender, compoundedBPDDeposit);

        /* Emit events before transferring RBTC gain to Vault.
         This lets the event log make more sense (i.e. so it appears that first the RBTC gain is withdrawn
        and then it is deposited into the Vault, not the other way around). */
        emit RBTCGainWithdrawn(msg.sender, depositorRBTCGain, BPDLoss);
        emit UserDepositChanged(msg.sender, compoundedBPDDeposit);

        RBTC = RBTC.sub(depositorRBTCGain);
        emit StabilityPoolRBTCBalanceUpdated(RBTC);
        emit BitcoinSent(msg.sender, depositorRBTCGain);

        borrowerOperations.moveRBTCGainToVault{ value: depositorRBTCGain }(msg.sender, _upperHint, _lowerHint);
    }

    // --- MP issuance functions ---

    function _triggerMPIssuance(ICommunityIssuance _communityIssuance) internal {
        uint MPIssuance = _communityIssuance.issueMP();
       _updateG(MPIssuance);
    }

    function _updateG(uint _MPIssuance) internal {
        uint totalBPD = totalBPDDeposits; // cached to save an SLOAD
        /*
        * When total deposits is 0, G is not updated. In this case, the MP issued can not be obtained by later
        * depositors - it is missed out on, and remains in the balanceof the CommunityIssuance contract.
        *
        */
        if (totalBPD == 0 || _MPIssuance == 0) {return;}

        uint MPPerUnitStaked;
        MPPerUnitStaked =_computeMPPerUnitStaked(_MPIssuance, totalBPD);

        uint marginalMPGain = MPPerUnitStaked.mul(P);
        epochToScaleToG[currentEpoch][currentScale] = epochToScaleToG[currentEpoch][currentScale].add(marginalMPGain);

        emit G_Updated(epochToScaleToG[currentEpoch][currentScale], currentEpoch, currentScale);
    }

    function _computeMPPerUnitStaked(uint _MPIssuance, uint _totalBPDDeposits) internal returns (uint) {
        /*  
        * Calculate the MP-per-unit staked.  Division uses a "feedback" error correction, to keep the 
        * cumulative error low in the running total G:
        *
        * 1) Form a numerator which compensates for the floor division error that occurred the last time this 
        * function was called.  
        * 2) Calculate "per-unit-staked" ratio.
        * 3) Multiply the ratio back by its denominator, to reveal the current floor division error.
        * 4) Store this error for use in the next correction when this function is called.
        * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
        */
        uint MPNumerator = _MPIssuance.mul(DECIMAL_PRECISION).add(lastMPError);

        uint MPPerUnitStaked = MPNumerator.div(_totalBPDDeposits);
        lastMPError = MPNumerator.sub(MPPerUnitStaked.mul(_totalBPDDeposits));

        return MPPerUnitStaked;
    }

    // --- Liquidation functions ---

    /*
    * Cancels out the specified debt against the BPD contained in the Stability Pool (as far as possible)
    * and transfers the Vault's RBTC collateral from ActivePool to StabilityPool.
    * Only called by liquidation functions in the VaultManager.
    */
    function offset(uint _debtToOffset, uint _collToAdd) external override {
        _requireCallerIsVaultManager();
        uint totalBPD = totalBPDDeposits; // cached to save an SLOAD
        if (totalBPD == 0 || _debtToOffset == 0) { return; }

        _triggerMPIssuance(communityIssuance);

        (uint RBTCGainPerUnitStaked,
            uint BPDLossPerUnitStaked) = _computeRewardsPerUnitStaked(_collToAdd, _debtToOffset, totalBPD);

        _updateRewardSumAndProduct(RBTCGainPerUnitStaked, BPDLossPerUnitStaked);  // updates S and P

        _moveOffsetCollAndDebt(_collToAdd, _debtToOffset);
    }

    // --- Offset helper functions ---

    function _computeRewardsPerUnitStaked(
        uint _collToAdd,
        uint _debtToOffset,
        uint _totalBPDDeposits
    )
        internal
        returns (uint RBTCGainPerUnitStaked, uint BPDLossPerUnitStaked)
    {
        /*
        * Compute the BPD and RBTC rewards. Uses a "feedback" error correction, to keep
        * the cumulative error in the P and S state variables low:
        *
        * 1) Form numerators which compensate for the floor division errors that occurred the last time this 
        * function was called.  
        * 2) Calculate "per-unit-staked" ratios.
        * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
        * 4) Store these errors for use in the next correction when this function is called.
        * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
        */
        uint RBTCNumerator = _collToAdd.mul(DECIMAL_PRECISION).add(lastRBTCError_Offset);

        assert(_debtToOffset <= _totalBPDDeposits);
        if (_debtToOffset == _totalBPDDeposits) {
            BPDLossPerUnitStaked = DECIMAL_PRECISION;  // When the Pool depletes to 0, so does each deposit 
            lastBPDLossError_Offset = 0;
        } else {
            uint BPDLossNumerator = _debtToOffset.mul(DECIMAL_PRECISION).sub(lastBPDLossError_Offset);
            /*
            * Add 1 to make error in quotient positive. We want "slightly too much" BPD loss,
            * which ensures the error in any given compoundedBPDDeposit favors the Stability Pool.
            */
            BPDLossPerUnitStaked = (BPDLossNumerator.div(_totalBPDDeposits)).add(1);
            lastBPDLossError_Offset = (BPDLossPerUnitStaked.mul(_totalBPDDeposits)).sub(BPDLossNumerator);
        }

        RBTCGainPerUnitStaked = RBTCNumerator.div(_totalBPDDeposits);
        lastRBTCError_Offset = RBTCNumerator.sub(RBTCGainPerUnitStaked.mul(_totalBPDDeposits));

        return (RBTCGainPerUnitStaked, BPDLossPerUnitStaked);
    }

    // Update the Stability Pool reward sum S and product P
    function _updateRewardSumAndProduct(uint _RBTCGainPerUnitStaked, uint _BPDLossPerUnitStaked) internal {
        uint currentP = P;
        uint newP;

        assert(_BPDLossPerUnitStaked <= DECIMAL_PRECISION);
        /*
        * The newProductFactor is the factor by which to change all deposits, due to the depletion of Stability Pool BPD in the liquidation.
        * We make the product factor 0 if there was a pool-emptying. Otherwise, it is (1 - BPDLossPerUnitStaked)
        */
        uint newProductFactor = uint(DECIMAL_PRECISION).sub(_BPDLossPerUnitStaked);

        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint currentS = epochToScaleToSum[currentEpochCached][currentScaleCached];

        /*
        * Calculate the new S first, before we update P.
        * The RBTC gain for any given depositor from a liquidation depends on the value of their deposit
        * (and the value of totalDeposits) prior to the Stability being depleted by the debt in the liquidation.
        *
        * Since S corresponds to RBTC gain, and P to deposit loss, we update S first.
        */
        uint marginalRBTCGain = _RBTCGainPerUnitStaked.mul(currentP);
        uint newS = currentS.add(marginalRBTCGain);
        epochToScaleToSum[currentEpochCached][currentScaleCached] = newS;
        emit S_Updated(newS, currentEpochCached, currentScaleCached);

        // If the Stability Pool was emptied, increment the epoch, and reset the scale and product P
        if (newProductFactor == 0) {
            currentEpoch = currentEpochCached.add(1);
            emit EpochUpdated(currentEpoch);
            currentScale = 0;
            emit ScaleUpdated(currentScale);
            newP = DECIMAL_PRECISION;

        // If multiplying P by a non-zero product factor would reduce P below the scale boundary, increment the scale
        } else if (currentP.mul(newProductFactor).div(DECIMAL_PRECISION) < SCALE_FACTOR) {
            newP = currentP.mul(newProductFactor).mul(SCALE_FACTOR).div(DECIMAL_PRECISION); 
            currentScale = currentScaleCached.add(1);
            emit ScaleUpdated(currentScale);
        } else {
            newP = currentP.mul(newProductFactor).div(DECIMAL_PRECISION);
        }

        assert(newP > 0);
        P = newP;

        emit P_Updated(newP);
    }

    function _moveOffsetCollAndDebt(uint _collToAdd, uint _debtToOffset) internal {
        IActivePool activePoolCached = activePool;

        // Cancel the liquidated BPD debt with the BPD in the stability pool
        activePoolCached.decreaseBPDDebt(_debtToOffset);
        _decreaseBPD(_debtToOffset);

        // Burn the debt that was successfully offset
        bpdToken.burn(address(this), _debtToOffset);

        activePoolCached.sendRBTC(address(this), _collToAdd);
    }

    function _decreaseBPD(uint _amount) internal {
        uint newTotalBPDDeposits = totalBPDDeposits.sub(_amount);
        totalBPDDeposits = newTotalBPDDeposits;
        emit StabilityPoolBPDBalanceUpdated(newTotalBPDDeposits);
    }

    // --- Reward calculator functions for depositor and front end ---

    /* Calculates the RBTC gain earned by the deposit since its last snapshots were taken.
    * Given by the formula:  E = d0 * (S - S(0))/P(0)
    * where S(0) and P(0) are the depositor's snapshots of the sum S and product P, respectively.
    * d0 is the last recorded deposit value.
    */
    function getDepositorRBTCGain(address _depositor) public view override returns (uint) {
        uint initialDeposit = deposits[_depositor].initialValue;

        if (initialDeposit == 0) { return 0; }

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint RBTCGain = _getRBTCGainFromSnapshots(initialDeposit, snapshots);
        return RBTCGain;
    }

    function _getRBTCGainFromSnapshots(uint initialDeposit, Snapshots memory snapshots) internal view returns (uint) {
        /*
        * Grab the sum 'S' from the epoch at which the stake was made. The RBTC gain may span up to one scale change.
        * If it does, the second portion of the RBTC gain is scaled by 1e9.
        * If the gain spans no scale change, the second portion will be 0.
        */
        uint128 epochSnapshot = snapshots.epoch;
        uint128 scaleSnapshot = snapshots.scale;
        uint S_Snapshot = snapshots.S;
        uint P_Snapshot = snapshots.P;

        uint firstPortion = epochToScaleToSum[epochSnapshot][scaleSnapshot].sub(S_Snapshot);
        uint secondPortion = epochToScaleToSum[epochSnapshot][scaleSnapshot.add(1)].div(SCALE_FACTOR);

        uint RBTCGain = initialDeposit.mul(firstPortion.add(secondPortion)).div(P_Snapshot).div(DECIMAL_PRECISION);

        return RBTCGain;
    }

    /*
    * Calculate the MP gain earned by a deposit since its last snapshots were taken.
    * Given by the formula:  MP = d0 * (G - G(0))/P(0)
    * where G(0) and P(0) are the depositor's snapshots of the sum G and product P, respectively.
    * d0 is the last recorded deposit value.
    */
    function getDepositorMPGain(address _depositor) public view override returns (uint) {
        uint initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) {return 0;}

        address frontEndTag = deposits[_depositor].frontEndTag;

        /*
        * If not tagged with a front end, the depositor gets a 100% cut of what their deposit earned.
        * Otherwise, their cut of the deposit's earnings is equal to the kickbackRate, set by the front end through
        * which they made their deposit.
        */
        uint kickbackRate = frontEndTag == address(0) ? DECIMAL_PRECISION : frontEnds[frontEndTag].kickbackRate;

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint MPGain = kickbackRate.mul(_getMPGainFromSnapshots(initialDeposit, snapshots)).div(DECIMAL_PRECISION);

        return MPGain;
    }

    /*
    * Return the MP gain earned by the front end. Given by the formula:  E = D0 * (G - G(0))/P(0)
    * where G(0) and P(0) are the depositor's snapshots of the sum G and product P, respectively.
    *
    * D0 is the last recorded value of the front end's total tagged deposits.
    */
    function getFrontEndMPGain(address _frontEnd) public view override returns (uint) {
        uint frontEndStake = frontEndStakes[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        uint kickbackRate = frontEnds[_frontEnd].kickbackRate;
        uint frontEndShare = uint(DECIMAL_PRECISION).sub(kickbackRate);

        Snapshots memory snapshots = frontEndSnapshots[_frontEnd];

        uint MPGain = frontEndShare.mul(_getMPGainFromSnapshots(frontEndStake, snapshots)).div(DECIMAL_PRECISION);
        return MPGain;
    }

    function _getMPGainFromSnapshots(uint initialStake, Snapshots memory snapshots) internal view returns (uint) {
       /*
        * Grab the sum 'G' from the epoch at which the stake was made. The MP gain may span up to one scale change.
        * If it does, the second portion of the MP gain is scaled by 1e9.
        * If the gain spans no scale change, the second portion will be 0.
        */
        uint128 epochSnapshot = snapshots.epoch;
        uint128 scaleSnapshot = snapshots.scale;
        uint G_Snapshot = snapshots.G;
        uint P_Snapshot = snapshots.P;

        uint firstPortion = epochToScaleToG[epochSnapshot][scaleSnapshot].sub(G_Snapshot);
        uint secondPortion = epochToScaleToG[epochSnapshot][scaleSnapshot.add(1)].div(SCALE_FACTOR);

        uint MPGain = initialStake.mul(firstPortion.add(secondPortion)).div(P_Snapshot).div(DECIMAL_PRECISION);

        return MPGain;
    }

    // --- Compounded deposit and compounded front end stake ---

    /*
    * Return the user's compounded deposit. Given by the formula:  d = d0 * P/P(0)
    * where P(0) is the depositor's snapshot of the product P, taken when they last updated their deposit.
    */
    function getCompoundedBPDDeposit(address _depositor) public view override returns (uint) {
        uint initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) { return 0; }

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint compoundedDeposit = _getCompoundedStakeFromSnapshots(initialDeposit, snapshots);
        return compoundedDeposit;
    }

    /*
    * Return the front end's compounded stake. Given by the formula:  D = D0 * P/P(0)
    * where P(0) is the depositor's snapshot of the product P, taken at the last time
    * when one of the front end's tagged deposits updated their deposit.
    *
    * The front end's compounded stake is equal to the sum of its depositors' compounded deposits.
    */
    function getCompoundedFrontEndStake(address _frontEnd) public view override returns (uint) {
        uint frontEndStake = frontEndStakes[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        Snapshots memory snapshots = frontEndSnapshots[_frontEnd];

        uint compoundedFrontEndStake = _getCompoundedStakeFromSnapshots(frontEndStake, snapshots);
        return compoundedFrontEndStake;
    }

    // Internal function, used to calculcate compounded deposits and compounded front end stakes.
    function _getCompoundedStakeFromSnapshots(
        uint initialStake,
        Snapshots memory snapshots
    )
        internal
        view
        returns (uint)
    {
        uint snapshot_P = snapshots.P;
        uint128 scaleSnapshot = snapshots.scale;
        uint128 epochSnapshot = snapshots.epoch;

        // If stake was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
        if (epochSnapshot < currentEpoch) { return 0; }

        uint compoundedStake;
        uint128 scaleDiff = currentScale.sub(scaleSnapshot);

        /* Compute the compounded stake. If a scale change in P was made during the stake's lifetime,
        * account for it. If more than one scale change was made, then the stake has decreased by a factor of
        * at least 1e-9 -- so return 0.
        */
        if (scaleDiff == 0) {
            compoundedStake = initialStake.mul(P).div(snapshot_P);
        } else if (scaleDiff == 1) {
            compoundedStake = initialStake.mul(P).div(snapshot_P).div(SCALE_FACTOR);
        } else { // if scaleDiff >= 2
            compoundedStake = 0;
        }

        /*
        * If compounded deposit is less than a billionth of the initial deposit, return 0.
        *
        * NOTE: originally, this line was in place to stop rounding errors making the deposit too large. However, the error
        * corrections should ensure the error in P "favors the Pool", i.e. any given compounded deposit should slightly less
        * than it's theoretical value.
        *
        * Thus it's unclear whether this line is still really needed.
        */
        if (compoundedStake < initialStake.div(1e9)) {return 0;}

        return compoundedStake;
    }

    // --- Sender functions for BPD deposit, RBTC gains and MP gains ---

    // Transfer the BPD tokens from the user to the Stability Pool's address, and update its recorded BPD
    function _sendBPDtoStabilityPool(address _address, uint _amount) internal {
        bpdToken.sendToPool(_address, address(this), _amount);
        uint newTotalBPDDeposits = totalBPDDeposits.add(_amount);
        totalBPDDeposits = newTotalBPDDeposits;
        emit StabilityPoolBPDBalanceUpdated(newTotalBPDDeposits);
    }

    function _sendRBTCGainToDepositor(uint _amount) internal {
        if (_amount == 0) {return;}
        uint newRBTC = RBTC.sub(_amount);
        RBTC = newRBTC;
        emit StabilityPoolRBTCBalanceUpdated(newRBTC);
        emit BitcoinSent(msg.sender, _amount);

        (bool success, ) = msg.sender.call{ value: _amount }("");
        require(success, "StabilityPool: sending RBTC failed");
    }

    // Send BPD to user and decrease BPD in Pool
    function _sendBPDToDepositor(address _depositor, uint BPDWithdrawal) internal {
        if (BPDWithdrawal == 0) {return;}

        bpdToken.returnFromPool(address(this), _depositor, BPDWithdrawal);
        _decreaseBPD(BPDWithdrawal);
    }

    // --- External Front End functions ---

    // Front end makes a one-time selection of kickback rate upon registering
    function registerFrontEnd(uint _kickbackRate) external override {
        _requireFrontEndNotRegistered(msg.sender);
        _requireUserHasNoDeposit(msg.sender);
        _requireValidKickbackRate(_kickbackRate);

        frontEnds[msg.sender].kickbackRate = _kickbackRate;
        frontEnds[msg.sender].registered = true;

        emit FrontEndRegistered(msg.sender, _kickbackRate);
    }

    // --- Stability Pool Deposit Functionality ---

    function _setFrontEndTag(address _depositor, address _frontEndTag) internal {
        deposits[_depositor].frontEndTag = _frontEndTag;
        emit FrontEndTagSet(_depositor, _frontEndTag);
    }


    function _updateDepositAndSnapshots(address _depositor, uint _newValue) internal {
        deposits[_depositor].initialValue = _newValue;

        if (_newValue == 0) {
            delete deposits[_depositor].frontEndTag;
            delete depositSnapshots[_depositor];
            emit DepositSnapshotUpdated(_depositor, 0, 0, 0);
            return;
        }
        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint currentP = P;

        // Get S and G for the current epoch and current scale
        uint currentS = epochToScaleToSum[currentEpochCached][currentScaleCached];
        uint currentG = epochToScaleToG[currentEpochCached][currentScaleCached];

        // Record new snapshots of the latest running product P, sum S, and sum G, for the depositor
        depositSnapshots[_depositor].P = currentP;
        depositSnapshots[_depositor].S = currentS;
        depositSnapshots[_depositor].G = currentG;
        depositSnapshots[_depositor].scale = currentScaleCached;
        depositSnapshots[_depositor].epoch = currentEpochCached;

        emit DepositSnapshotUpdated(_depositor, currentP, currentS, currentG);
    }

    function _updateFrontEndStakeAndSnapshots(address _frontEnd, uint _newValue) internal {
        frontEndStakes[_frontEnd] = _newValue;

        if (_newValue == 0) {
            delete frontEndSnapshots[_frontEnd];
            emit FrontEndSnapshotUpdated(_frontEnd, 0, 0);
            return;
        }

        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint currentP = P;

        // Get G for the current epoch and current scale
        uint currentG = epochToScaleToG[currentEpochCached][currentScaleCached];

        // Record new snapshots of the latest running product P and sum G for the front end
        frontEndSnapshots[_frontEnd].P = currentP;
        frontEndSnapshots[_frontEnd].G = currentG;
        frontEndSnapshots[_frontEnd].scale = currentScaleCached;
        frontEndSnapshots[_frontEnd].epoch = currentEpochCached;

        emit FrontEndSnapshotUpdated(_frontEnd, currentP, currentG);
    }

    function _payOutMPGains(ICommunityIssuance _communityIssuance, address _depositor, address _frontEnd) internal {
        // Pay out front end's MP gain
        if (_frontEnd != address(0)) {
            uint frontEndMPGain = getFrontEndMPGain(_frontEnd);
            _communityIssuance.sendMP(_frontEnd, frontEndMPGain);
            emit MPPaidToFrontEnd(_frontEnd, frontEndMPGain);
        }

        // Pay out depositor's MP gain
        uint depositorMPGain = getDepositorMPGain(_depositor);
        _communityIssuance.sendMP(_depositor, depositorMPGain);
        emit MPPaidToDepositor(_depositor, depositorMPGain);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require( msg.sender == address(activePool), "StabilityPool: Caller is not ActivePool");
    }

    function _requireCallerIsVaultManager() internal view {
        require(msg.sender == address(vaultManager), "StabilityPool: Caller is not VaultManager");
    }

    function _requireNoUnderCollateralizedVaults() internal {
        uint price = priceFeed.fetchPrice();
        address lowestVault = sortedVaults.getLast();
        uint ICR = vaultManager.getCurrentICR(lowestVault, price);
        require(ICR >= MCR, "StabilityPool: Cannot withdraw while there are vaults with ICR < MCR");
    }

    function _requireUserHasDeposit(uint _initialDeposit) internal pure {
        require(_initialDeposit > 0, 'StabilityPool: User must have a non-zero deposit');
    }

     function _requireUserHasNoDeposit(address _address) internal view {
        uint initialDeposit = deposits[_address].initialValue;
        require(initialDeposit == 0, 'StabilityPool: User must have no deposit');
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, 'StabilityPool: Amount must be non-zero');
    }

    function _requireUserHasVault(address _depositor) internal view {
        require(vaultManager.getVaultStatus(_depositor) == 1, "StabilityPool: caller must have an active vault to withdraw RBTCGain to");
    }

    function _requireUserHasRBTCGain(address _depositor) internal view {
        uint RBTCGain = getDepositorRBTCGain(_depositor);
        require(RBTCGain > 0, "StabilityPool: caller must have non-zero RBTC Gain");
    }

    function _requireFrontEndNotRegistered(address _address) internal view {
        require(!frontEnds[_address].registered, "StabilityPool: must not already be a registered front end");
    }

     function _requireFrontEndIsRegisteredOrZero(address _address) internal view {
        require(frontEnds[_address].registered || _address == address(0),
            "StabilityPool: Tag must be a registered front end, or the zero address");
    }

    function  _requireValidKickbackRate(uint _kickbackRate) internal pure {
        require (_kickbackRate <= DECIMAL_PRECISION, "StabilityPool: Kickback rate must be in range [0,1]");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        RBTC = RBTC.add(msg.value);
        StabilityPoolRBTCBalanceUpdated(RBTC);
    }
}
