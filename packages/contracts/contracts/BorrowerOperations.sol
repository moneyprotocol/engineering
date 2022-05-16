// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/IVaultManager.sol";
import "./Interfaces/IBPDToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IMPStaking.sol";
import "./Dependencies/MoneypBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

contract BorrowerOperations is MoneypBase, Ownable, CheckContract, IBorrowerOperations {
    string constant public NAME = "BorrowerOperations";

    // --- Connected contract declarations ---

    IVaultManager public vaultManager;

    address stabilityPoolAddress;

    address gasPoolAddress;

    ICollSurplusPool collSurplusPool;

    IMPStaking public mpStaking;
    address public mpStakingAddress;

    IBPDToken public bpdToken;

    // A doubly linked list of Troves, sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

     struct LocalVariables_adjustTrove {
        uint price;
        uint collChange;
        uint netDebtChange;
        bool isCollIncrease;
        uint debt;
        uint coll;
        uint oldICR;
        uint newICR;
        uint newTCR;
        uint BPDFee;
        uint newDebt;
        uint newColl;
        uint stake;
    }

    struct LocalVariables_openTrove {
        uint price;
        uint BPDFee;
        uint netDebt;
        uint compositeDebt;
        uint ICR;
        uint NICR;
        uint stake;
        uint arrayIndex;
    }

    struct ContractsCache {
        IVaultManager vaultManager;
        IActivePool activePool;
        IBPDToken bpdToken;
    }

    enum BorrowerOperation {
        openTrove,
        closeTrove,
        adjustTrove
    }

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event BPDTokenAddressChanged(address _bpdTokenAddress);
    event MPStakingAddressChanged(address _mpStakingAddress);

    event TroveCreated(address indexed _borrower, uint arrayIndex);
    event TroveUpdated(address indexed _borrower, uint _debt, uint _coll, uint stake, BorrowerOperation operation);
    event BPDBorrowingFeePaid(address indexed _borrower, uint _BPDFee);
    
    // --- Dependency setters ---

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedTrovesAddress,
        address _bpdTokenAddress,
        address _mpStakingAddress
    )
        external
        override
        onlyOwner
    {
        // This makes impossible to open a trove with zero withdrawn BPD
        assert(MIN_NET_DEBT > 0);

        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_priceFeedAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_bpdTokenAddress);
        checkContract(_mpStakingAddress);

        vaultManager = IVaultManager(_troveManagerAddress);
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPoolAddress = _stabilityPoolAddress;
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        bpdToken = IBPDToken(_bpdTokenAddress);
        mpStakingAddress = _mpStakingAddress;
        mpStaking = IMPStaking(_mpStakingAddress);

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit BPDTokenAddressChanged(_bpdTokenAddress);
        emit MPStakingAddressChanged(_mpStakingAddress);

        _renounceOwnership();
    }

    // --- Borrower Trove Operations ---

    function openTrove(uint _maxFeePercentage, uint _BPDAmount, address _upperHint, address _lowerHint) external payable override {
        ContractsCache memory contractsCache = ContractsCache(vaultManager, activePool, bpdToken);
        LocalVariables_openTrove memory vars;

        vars.price = priceFeed.fetchPrice();
        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);
        _requireTroveisNotActive(contractsCache.vaultManager, msg.sender);

        vars.BPDFee;
        vars.netDebt = _BPDAmount;

        if (!isRecoveryMode) {
            vars.BPDFee = _triggerBorrowingFee(contractsCache.vaultManager, contractsCache.bpdToken, _BPDAmount, _maxFeePercentage);
            vars.netDebt = vars.netDebt.add(vars.BPDFee);
        }
        _requireAtLeastMinNetDebt(vars.netDebt);

        // ICR is based on the composite debt, i.e. the requested BPD amount + BPD borrowing fee + BPD gas comp.
        vars.compositeDebt = _getCompositeDebt(vars.netDebt);
        assert(vars.compositeDebt > 0);
        
        vars.ICR = MoneypMath._computeCR(msg.value, vars.compositeDebt, vars.price);
        vars.NICR = MoneypMath._computeNominalCR(msg.value, vars.compositeDebt);

        if (isRecoveryMode) {
            _requireICRisAboveCCR(vars.ICR);
        } else {
            _requireICRisAboveMCR(vars.ICR);
            uint newTCR = _getNewTCRFromTroveChange(msg.value, true, vars.compositeDebt, true, vars.price);  // bools: coll increase, debt increase
            _requireNewTCRisAboveCCR(newTCR); 
        }

        // Set the trove struct's properties
        contractsCache.vaultManager.setTroveStatus(msg.sender, 1);
        contractsCache.vaultManager.increaseTroveColl(msg.sender, msg.value);
        contractsCache.vaultManager.increaseTroveDebt(msg.sender, vars.compositeDebt);

        contractsCache.vaultManager.updateTroveRewardSnapshots(msg.sender);
        vars.stake = contractsCache.vaultManager.updateStakeAndTotalStakes(msg.sender);

        sortedTroves.insert(msg.sender, vars.NICR, _upperHint, _lowerHint);
        vars.arrayIndex = contractsCache.vaultManager.addTroveOwnerToArray(msg.sender);
        emit TroveCreated(msg.sender, vars.arrayIndex);

        // Move the bitcoin to the Active Pool, and mint the BPDAmount to the borrower
        _activePoolAddColl(contractsCache.activePool, msg.value);
        _withdrawBPD(contractsCache.activePool, contractsCache.bpdToken, msg.sender, _BPDAmount, vars.netDebt);
        // Move the BPD gas compensation to the Gas Pool
        _withdrawBPD(contractsCache.activePool, contractsCache.bpdToken, gasPoolAddress, BPD_GAS_COMPENSATION, BPD_GAS_COMPENSATION);

        emit TroveUpdated(msg.sender, vars.compositeDebt, msg.value, vars.stake, BorrowerOperation.openTrove);
        emit BPDBorrowingFeePaid(msg.sender, vars.BPDFee);
    }

    // Send ETH as collateral to a trove
    function addColl(address _upperHint, address _lowerHint) external payable override {
        _adjustTrove(msg.sender, 0, 0, false, _upperHint, _lowerHint, 0);
    }

    // Send ETH as collateral to a trove. Called by only the Stability Pool.
    function moveETHGainToTrove(address _borrower, address _upperHint, address _lowerHint) external payable override {
        _requireCallerIsStabilityPool();
        _adjustTrove(_borrower, 0, 0, false, _upperHint, _lowerHint, 0);
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(uint _collWithdrawal, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, _collWithdrawal, 0, false, _upperHint, _lowerHint, 0);
    }

    // Withdraw BPD tokens from a trove: mint new BPD tokens to the owner, and increase the trove's debt accordingly
    function withdrawBPD(uint _maxFeePercentage, uint _BPDAmount, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, 0, _BPDAmount, true, _upperHint, _lowerHint, _maxFeePercentage);
    }

    // Repay BPD tokens to a Trove: Burn the repaid BPD tokens, and reduce the trove's debt accordingly
    function repayBPD(uint _BPDAmount, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, 0, _BPDAmount, false, _upperHint, _lowerHint, 0);
    }

    function adjustTrove(uint _maxFeePercentage, uint _collWithdrawal, uint _BPDChange, bool _isDebtIncrease, address _upperHint, address _lowerHint) external payable override {
        _adjustTrove(msg.sender, _collWithdrawal, _BPDChange, _isDebtIncrease, _upperHint, _lowerHint, _maxFeePercentage);
    }

    /*
    * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal. 
    *
    * It therefore expects either a positive msg.value, or a positive _collWithdrawal argument.
    *
    * If both are positive, it will revert.
    */
    function _adjustTrove(address _borrower, uint _collWithdrawal, uint _BPDChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFeePercentage) internal {
        ContractsCache memory contractsCache = ContractsCache(vaultManager, activePool, bpdToken);
        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();
        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        if (_isDebtIncrease) {
            _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);
            _requireNonZeroDebtChange(_BPDChange);
        }
        _requireSingularCollChange(_collWithdrawal);
        _requireNonZeroAdjustment(_collWithdrawal, _BPDChange);
        _requireTroveisActive(contractsCache.vaultManager, _borrower);

        // Confirm the operation is either a borrower adjusting their own trove, or a pure ETH transfer from the Stability Pool to a trove
        assert(msg.sender == _borrower || (msg.sender == stabilityPoolAddress && msg.value > 0 && _BPDChange == 0));

        contractsCache.vaultManager.applyPendingRewards(_borrower);

        // Get the collChange based on whether or not ETH was sent in the transaction
        (vars.collChange, vars.isCollIncrease) = _getCollChange(msg.value, _collWithdrawal);

        vars.netDebtChange = _BPDChange;

        // If the adjustment incorporates a debt increase and system is in Normal Mode, then trigger a borrowing fee
        if (_isDebtIncrease && !isRecoveryMode) { 
            vars.BPDFee = _triggerBorrowingFee(contractsCache.vaultManager, contractsCache.bpdToken, _BPDChange, _maxFeePercentage);
            vars.netDebtChange = vars.netDebtChange.add(vars.BPDFee); // The raw debt change includes the fee
        }

        vars.debt = contractsCache.vaultManager.getTroveDebt(_borrower);
        vars.coll = contractsCache.vaultManager.getTroveColl(_borrower);
        
        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = MoneypMath._computeCR(vars.coll, vars.debt, vars.price);
        vars.newICR = _getNewICRFromTroveChange(vars.coll, vars.debt, vars.collChange, vars.isCollIncrease, vars.netDebtChange, _isDebtIncrease, vars.price);
        assert(_collWithdrawal <= vars.coll); 

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(isRecoveryMode, _collWithdrawal, _isDebtIncrease, vars);
            
        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough BPD
        if (!_isDebtIncrease && _BPDChange > 0) {
            _requireAtLeastMinNetDebt(_getNetDebt(vars.debt).sub(vars.netDebtChange));
            _requireValidBPDRepayment(vars.debt, vars.netDebtChange);
            _requireSufficientBPDBalance(contractsCache.bpdToken, _borrower, vars.netDebtChange);
        }

        (vars.newColl, vars.newDebt) = _updateTroveFromAdjustment(contractsCache.vaultManager, _borrower, vars.collChange, vars.isCollIncrease, vars.netDebtChange, _isDebtIncrease);
        vars.stake = contractsCache.vaultManager.updateStakeAndTotalStakes(_borrower);

        // Re-insert trove in to the sorted list
        uint newNICR = _getNewNominalICRFromTroveChange(vars.coll, vars.debt, vars.collChange, vars.isCollIncrease, vars.netDebtChange, _isDebtIncrease);
        sortedTroves.reInsert(_borrower, newNICR, _upperHint, _lowerHint);

        emit TroveUpdated(_borrower, vars.newDebt, vars.newColl, vars.stake, BorrowerOperation.adjustTrove);
        emit BPDBorrowingFeePaid(msg.sender,  vars.BPDFee);

        // Use the unmodified _BPDChange here, as we don't send the fee to the user
        _moveTokensAndETHfromAdjustment(
            contractsCache.activePool,
            contractsCache.bpdToken,
            msg.sender,
            vars.collChange,
            vars.isCollIncrease,
            _BPDChange,
            _isDebtIncrease,
            vars.netDebtChange
        );
    }

    function closeTrove() external override {
        IVaultManager troveManagerCached = vaultManager;
        IActivePool activePoolCached = activePool;
        IBPDToken bpdTokenCached = bpdToken;

        _requireTroveisActive(troveManagerCached, msg.sender);
        uint price = priceFeed.fetchPrice();
        _requireNotInRecoveryMode(price);

        troveManagerCached.applyPendingRewards(msg.sender);

        uint coll = troveManagerCached.getTroveColl(msg.sender);
        uint debt = troveManagerCached.getTroveDebt(msg.sender);

        _requireSufficientBPDBalance(bpdTokenCached, msg.sender, debt.sub(BPD_GAS_COMPENSATION));

        uint newTCR = _getNewTCRFromTroveChange(coll, false, debt, false, price);
        _requireNewTCRisAboveCCR(newTCR);

        troveManagerCached.removeStake(msg.sender);
        troveManagerCached.closeTrove(msg.sender);

        emit TroveUpdated(msg.sender, 0, 0, 0, BorrowerOperation.closeTrove);

        // Burn the repaid BPD from the user's balance and the gas compensation from the Gas Pool
        _repayBPD(activePoolCached, bpdTokenCached, msg.sender, debt.sub(BPD_GAS_COMPENSATION));
        _repayBPD(activePoolCached, bpdTokenCached, gasPoolAddress, BPD_GAS_COMPENSATION);

        // Send the collateral back to the user
        activePoolCached.sendETH(msg.sender, coll);
    }

    /**
     * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
     */
    function claimCollateral() external override {
        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
    }

    // --- Helper functions ---

    function _triggerBorrowingFee(IVaultManager _troveManager, IBPDToken _bpdToken, uint _BPDAmount, uint _maxFeePercentage) internal returns (uint) {
        _troveManager.decayBaseRateFromBorrowing(); // decay the baseRate state variable
        uint BPDFee = _troveManager.getBorrowingFee(_BPDAmount);

        _requireUserAcceptsFee(BPDFee, _BPDAmount, _maxFeePercentage);
        
        // Send fee to MP staking contract
        mpStaking.increaseF_BPD(BPDFee);
        _bpdToken.mint(mpStakingAddress, BPDFee);

        return BPDFee;
    }

    function _getUSDValue(uint _coll, uint _price) internal pure returns (uint) {
        uint usdValue = _price.mul(_coll).div(DECIMAL_PRECISION);

        return usdValue;
    }

    function _getCollChange(
        uint _collReceived,
        uint _requestedCollWithdrawal
    )
        internal
        pure
        returns(uint collChange, bool isCollIncrease)
    {
        if (_collReceived != 0) {
            collChange = _collReceived;
            isCollIncrease = true;
        } else {
            collChange = _requestedCollWithdrawal;
        }
    }

    // Update trove's coll and debt based on whether they increase or decrease
    function _updateTroveFromAdjustment
    (
        IVaultManager _troveManager,
        address _borrower,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        internal
        returns (uint, uint)
    {
        uint newColl = (_isCollIncrease) ? _troveManager.increaseTroveColl(_borrower, _collChange)
                                        : _troveManager.decreaseTroveColl(_borrower, _collChange);
        uint newDebt = (_isDebtIncrease) ? _troveManager.increaseTroveDebt(_borrower, _debtChange)
                                        : _troveManager.decreaseTroveDebt(_borrower, _debtChange);

        return (newColl, newDebt);
    }

    function _moveTokensAndETHfromAdjustment
    (
        IActivePool _activePool,
        IBPDToken _bpdToken,
        address _borrower,
        uint _collChange,
        bool _isCollIncrease,
        uint _BPDChange,
        bool _isDebtIncrease,
        uint _netDebtChange
    )
        internal
    {
        if (_isDebtIncrease) {
            _withdrawBPD(_activePool, _bpdToken, _borrower, _BPDChange, _netDebtChange);
        } else {
            _repayBPD(_activePool, _bpdToken, _borrower, _BPDChange);
        }

        if (_isCollIncrease) {
            _activePoolAddColl(_activePool, _collChange);
        } else {
            _activePool.sendETH(_borrower, _collChange);
        }
    }

    // Send ETH to Active Pool and increase its recorded ETH balance
    function _activePoolAddColl(IActivePool _activePool, uint _amount) internal {
        (bool success, ) = address(_activePool).call{value: _amount}("");
        require(success, "BorrowerOps: Sending ETH to ActivePool failed");
    }

    // Issue the specified amount of BPD to _account and increases the total active debt (_netDebtIncrease potentially includes a BPDFee)
    function _withdrawBPD(IActivePool _activePool, IBPDToken _bpdToken, address _account, uint _BPDAmount, uint _netDebtIncrease) internal {
        _activePool.increaseBPDDebt(_netDebtIncrease);
        _bpdToken.mint(_account, _BPDAmount);
    }

    // Burn the specified amount of BPD from _account and decreases the total active debt
    function _repayBPD(IActivePool _activePool, IBPDToken _bpdToken, address _account, uint _BPD) internal {
        _activePool.decreaseBPDDebt(_BPD);
        _bpdToken.burn(_account, _BPD);
    }

    // --- 'Require' wrapper functions ---

    function _requireSingularCollChange(uint _collWithdrawal) internal view {
        require(msg.value == 0 || _collWithdrawal == 0, "BorrowerOperations: Cannot withdraw and add coll");
    }

    function _requireCallerIsBorrower(address _borrower) internal view {
        require(msg.sender == _borrower, "BorrowerOps: Caller must be the borrower for a withdrawal");
    }

    function _requireNonZeroAdjustment(uint _collWithdrawal, uint _BPDChange) internal view {
        require(msg.value != 0 || _collWithdrawal != 0 || _BPDChange != 0, "BorrowerOps: There must be either a collateral change or a debt change");
    }

    function _requireTroveisActive(IVaultManager _troveManager, address _borrower) internal view {
        uint status = _troveManager.getTroveStatus(_borrower);
        require(status == 1, "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveisNotActive(IVaultManager _troveManager, address _borrower) internal view {
        uint status = _troveManager.getTroveStatus(_borrower);
        require(status != 1, "BorrowerOps: Trove is active");
    }

    function _requireNonZeroDebtChange(uint _BPDChange) internal pure {
        require(_BPDChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
    }
   
    function _requireNotInRecoveryMode(uint _price) internal view {
        require(!_checkRecoveryMode(_price), "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireNoCollWithdrawal(uint _collWithdrawal) internal pure {
        require(_collWithdrawal == 0, "BorrowerOps: Collateral withdrawal not permitted Recovery Mode");
    }

    function _requireValidAdjustmentInCurrentMode 
    (
        bool _isRecoveryMode,
        uint _collWithdrawal,
        bool _isDebtIncrease, 
        LocalVariables_adjustTrove memory _vars
    ) 
        internal 
        view 
    {
        /* 
        *In Recovery Mode, only allow:
        *
        * - Pure collateral top-up
        * - Pure debt repayment
        * - Collateral top-up with debt repayment
        * - A debt increase combined with a collateral top-up which makes the ICR >= 150% and improves the ICR (and by extension improves the TCR).
        *
        * In Normal Mode, ensure:
        *
        * - The new ICR is above MCR
        * - The adjustment won't pull the TCR below CCR
        */
        if (_isRecoveryMode) {
            _requireNoCollWithdrawal(_collWithdrawal);
            if (_isDebtIncrease) {
                _requireICRisAboveCCR(_vars.newICR);
                _requireNewICRisAboveOldICR(_vars.newICR, _vars.oldICR);
            }       
        } else { // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
            _vars.newTCR = _getNewTCRFromTroveChange(_vars.collChange, _vars.isCollIncrease, _vars.netDebtChange, _isDebtIncrease, _vars.price);
            _requireNewTCRisAboveCCR(_vars.newTCR);  
        }
    }

    function _requireICRisAboveMCR(uint _newICR) internal pure {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireICRisAboveCCR(uint _newICR) internal pure {
        require(_newICR >= CCR, "BorrowerOps: Operation must leave trove with ICR >= CCR");
    }

    function _requireNewICRisAboveOldICR(uint _newICR, uint _oldICR) internal pure {
        require(_newICR >= _oldICR, "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode");
    }

    function _requireNewTCRisAboveCCR(uint _newTCR) internal pure {
        require(_newTCR >= CCR, "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireAtLeastMinNetDebt(uint _netDebt) internal pure {
        require (_netDebt >= MIN_NET_DEBT, "BorrowerOps: Trove's net debt must be greater than minimum");
    }

    function _requireValidBPDRepayment(uint _currentDebt, uint _debtRepayment) internal pure {
        require(_debtRepayment <= _currentDebt.sub(BPD_GAS_COMPENSATION), "BorrowerOps: Amount repaid must not be larger than the Trove's debt");
    }

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "BorrowerOps: Caller is not Stability Pool");
    }

     function _requireSufficientBPDBalance(IBPDToken _bpdToken, address _borrower, uint _debtRepayment) internal view {
        require(_bpdToken.balanceOf(_borrower) >= _debtRepayment, "BorrowerOps: Caller doesnt have enough BPD to make repayment");
    }

    function _requireValidMaxFeePercentage(uint _maxFeePercentage, bool _isRecoveryMode) internal pure {
        if (_isRecoveryMode) {
            require(_maxFeePercentage <= DECIMAL_PRECISION,
                "Max fee percentage must less than or equal to 100%");
        } else {
            require(_maxFeePercentage >= BORROWING_FEE_FLOOR && _maxFeePercentage <= DECIMAL_PRECISION,
                "Max fee percentage must be between 0.5% and 100%");
        }
    }

    // --- ICR and TCR getters ---

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewNominalICRFromTroveChange
    (
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        pure
        internal
        returns (uint)
    {
        (uint newColl, uint newDebt) = _getNewTroveAmounts(_coll, _debt, _collChange, _isCollIncrease, _debtChange, _isDebtIncrease);

        uint newNICR = MoneypMath._computeNominalCR(newColl, newDebt);
        return newNICR;
    }

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewICRFromTroveChange
    (
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        pure
        internal
        returns (uint)
    {
        (uint newColl, uint newDebt) = _getNewTroveAmounts(_coll, _debt, _collChange, _isCollIncrease, _debtChange, _isDebtIncrease);

        uint newICR = MoneypMath._computeCR(newColl, newDebt, _price);
        return newICR;
    }

    function _getNewTroveAmounts(
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        internal
        pure
        returns (uint, uint)
    {
        uint newColl = _coll;
        uint newDebt = _debt;

        newColl = _isCollIncrease ? _coll.add(_collChange) :  _coll.sub(_collChange);
        newDebt = _isDebtIncrease ? _debt.add(_debtChange) : _debt.sub(_debtChange);

        return (newColl, newDebt);
    }

    function _getNewTCRFromTroveChange
    (
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        internal
        view
        returns (uint)
    {
        uint totalColl = getEntireSystemColl();
        uint totalDebt = getEntireSystemDebt();

        totalColl = _isCollIncrease ? totalColl.add(_collChange) : totalColl.sub(_collChange);
        totalDebt = _isDebtIncrease ? totalDebt.add(_debtChange) : totalDebt.sub(_debtChange);

        uint newTCR = MoneypMath._computeCR(totalColl, totalDebt, _price);
        return newTCR;
    }

    function getCompositeDebt(uint _debt) external pure override returns (uint) {
        return _getCompositeDebt(_debt);
    }
}
