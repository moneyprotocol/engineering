// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../VaultManager.sol";
import "../BorrowerOperations.sol";
import "../ActivePool.sol";
import "../DefaultPool.sol";
import "../StabilityPool.sol";
import "../GasPool.sol";
import "../CollSurplusPool.sol";
import "../BPDToken.sol";
import "./PriceFeedTestnet.sol";
import "../SortedVaults.sol";
import "./EchidnaProxy.sol";
//import "../Dependencies/console.sol";

// Run with:
// rm -f fuzzTests/corpus/* # (optional)
// ~/.local/bin/echidna-test contracts/TestContracts/EchidnaTester.sol --contract EchidnaTester --config fuzzTests/echidna_config.yaml

contract EchidnaTester {
    using SafeMath for uint;

    uint constant private NUMBER_OF_ACTORS = 100;
    uint constant private INITIAL_BALANCE = 1e24;
    uint private MCR;
    uint private CCR;
    uint private BPD_GAS_COMPENSATION;

    VaultManager public vaultManager;
    BorrowerOperations public borrowerOperations;
    ActivePool public activePool;
    DefaultPool public defaultPool;
    StabilityPool public stabilityPool;
    GasPool public gasPool;
    CollSurplusPool public collSurplusPool;
    BPDToken public bpdToken;
    PriceFeedTestnet priceFeedTestnet;
    SortedVaults sortedVaults;

    EchidnaProxy[NUMBER_OF_ACTORS] public echidnaProxies;

    uint private numberOfVaults;

    constructor() public payable {
        vaultManager = new VaultManager();
        borrowerOperations = new BorrowerOperations();
        activePool = new ActivePool();
        defaultPool = new DefaultPool();
        stabilityPool = new StabilityPool();
        gasPool = new GasPool();
        bpdToken = new BPDToken(
            address(vaultManager),
            address(stabilityPool),
            address(borrowerOperations)
        );

        collSurplusPool = new CollSurplusPool();
        priceFeedTestnet = new PriceFeedTestnet();

        sortedVaults = new SortedVaults();

        vaultManager.setAddresses(address(borrowerOperations), 
            address(activePool), address(defaultPool), 
            address(stabilityPool), address(gasPool), address(collSurplusPool),
            address(priceFeedTestnet), address(bpdToken), 
            address(sortedVaults), address(0), address(0));
       
        borrowerOperations.setAddresses(address(vaultManager), 
            address(activePool), address(defaultPool), 
            address(stabilityPool), address(gasPool), address(collSurplusPool),
            address(priceFeedTestnet), address(sortedVaults), 
            address(bpdToken), address(0));

        activePool.setAddresses(address(borrowerOperations), 
            address(vaultManager), address(stabilityPool), address(defaultPool));

        defaultPool.setAddresses(address(vaultManager), address(activePool));
        
        stabilityPool.setAddresses(address(borrowerOperations), 
            address(vaultManager), address(activePool), address(bpdToken), 
            address(sortedVaults), address(priceFeedTestnet), address(0));

        collSurplusPool.setAddresses(address(borrowerOperations), 
             address(vaultManager), address(activePool));
    
        sortedVaults.setParams(1e18, address(vaultManager), address(borrowerOperations));

        for (uint i = 0; i < NUMBER_OF_ACTORS; i++) {
            echidnaProxies[i] = new EchidnaProxy(vaultManager, borrowerOperations, stabilityPool, bpdToken);
            (bool success, ) = address(echidnaProxies[i]).call{value: INITIAL_BALANCE}("");
            require(success);
        }

        MCR = borrowerOperations.MCR();
        CCR = borrowerOperations.CCR();
        BPD_GAS_COMPENSATION = borrowerOperations.BPD_GAS_COMPENSATION();
        require(MCR > 0);
        require(CCR > 0);

        // TODO:
        priceFeedTestnet.setPrice(1e22);
    }

    // VaultManager

    function liquidateExt(uint _i, address _user) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].liquidatePrx(_user);
    }

    function liquidateVaultsExt(uint _i, uint _n) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].liquidateVaultsPrx(_n);
    }

    function batchLiquidateVaultsExt(uint _i, address[] calldata _vaultArray) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].batchLiquidateVaultsPrx(_vaultArray);
    }

    function redeemCollateralExt(
        uint _i,
        uint _BPDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR
    ) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].redeemCollateralPrx(_BPDAmount, _firstRedemptionHint, _upperPartialRedemptionHint, _lowerPartialRedemptionHint, _partialRedemptionHintNICR, 0, 0);
    }

    // Borrower Operations

    function getAdjustedRBTC(uint actorBalance, uint _RBTC, uint ratio) internal view returns (uint) {
        uint price = priceFeedTestnet.getPrice();
        require(price > 0);
        uint minRBTC = ratio.mul(BPD_GAS_COMPENSATION).div(price);
        require(actorBalance > minRBTC);
        uint RBTC = minRBTC + _RBTC % (actorBalance - minRBTC);
        return RBTC;
    }

    function getAdjustedBPD(uint RBTC, uint _BPDAmount, uint ratio) internal view returns (uint) {
        uint price = priceFeedTestnet.getPrice();
        uint BPDAmount = _BPDAmount;
        uint compositeDebt = BPDAmount.add(BPD_GAS_COMPENSATION);
        uint ICR = MoneypMath._computeCR(RBTC, compositeDebt, price);
        if (ICR < ratio) {
            compositeDebt = RBTC.mul(price).div(ratio);
            BPDAmount = compositeDebt.sub(BPD_GAS_COMPENSATION);
        }
        return BPDAmount;
    }

    function openVaultExt(uint _i, uint _RBTC, uint _BPDAmount) public payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint actorBalance = address(echidnaProxy).balance;

        // we pass in CCR instead of MCR in case it’s the first one
        uint RBTC = getAdjustedRBTC(actorBalance, _RBTC, CCR);
        uint BPDAmount = getAdjustedBPD(RBTC, _BPDAmount, CCR);

        //console.log('RBTC', RBTC);
        //console.log('BPDAmount', BPDAmount);

        echidnaProxy.openVaultPrx(RBTC, BPDAmount, address(0), address(0), 0);

        numberOfVaults = vaultManager.getVaultOwnersCount();
        assert(numberOfVaults > 0);
        // canary
        //assert(numberOfVaults == 0);
    }

    function openVaultRawExt(uint _i, uint _RBTC, uint _BPDAmount, address _upperHint, address _lowerHint, uint _maxFee) public payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].openVaultPrx(_RBTC, _BPDAmount, _upperHint, _lowerHint, _maxFee);
    }

    function addCollExt(uint _i, uint _RBTC) external payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint actorBalance = address(echidnaProxy).balance;

        uint RBTC = getAdjustedRBTC(actorBalance, _RBTC, MCR);

        echidnaProxy.addCollPrx(RBTC, address(0), address(0));
    }

    function addCollRawExt(uint _i, uint _RBTC, address _upperHint, address _lowerHint) external payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].addCollPrx(_RBTC, _upperHint, _lowerHint);
    }

    function withdrawCollExt(uint _i, uint _amount, address _upperHint, address _lowerHint) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawCollPrx(_amount, _upperHint, _lowerHint);
    }

    function withdrawBPDExt(uint _i, uint _amount, address _upperHint, address _lowerHint, uint _maxFee) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawBPDPrx(_amount, _upperHint, _lowerHint, _maxFee);
    }

    function repayBPDExt(uint _i, uint _amount, address _upperHint, address _lowerHint) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].repayBPDPrx(_amount, _upperHint, _lowerHint);
    }

    function closeVaultExt(uint _i) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].closeVaultPrx();
    }

    function adjustVaultExt(uint _i, uint _RBTC, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease) external payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint actorBalance = address(echidnaProxy).balance;

        uint RBTC = getAdjustedRBTC(actorBalance, _RBTC, MCR);
        uint debtChange = _debtChange;
        if (_isDebtIncrease) {
            // TODO: add current amount already withdrawn:
            debtChange = getAdjustedBPD(RBTC, uint(_debtChange), MCR);
        }
        // TODO: collWithdrawal, debtChange
        echidnaProxy.adjustVaultPrx(RBTC, _collWithdrawal, debtChange, _isDebtIncrease, address(0), address(0), 0);
    }

    function adjustVaultRawExt(uint _i, uint _RBTC, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFee) external payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].adjustVaultPrx(_RBTC, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint, _maxFee);
    }

    // Pool Manager

    function provideToSPExt(uint _i, uint _amount, address _frontEndTag) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].provideToSPPrx(_amount, _frontEndTag);
    }

    function withdrawFromSPExt(uint _i, uint _amount) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawFromSPPrx(_amount);
    }

    // BPD Token

    function transferExt(uint _i, address recipient, uint256 amount) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].transferPrx(recipient, amount);
    }

    function approveExt(uint _i, address spender, uint256 amount) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].approvePrx(spender, amount);
    }

    function transferFromExt(uint _i, address sender, address recipient, uint256 amount) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].transferFromPrx(sender, recipient, amount);
    }

    function increaseAllowanceExt(uint _i, address spender, uint256 addedValue) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].increaseAllowancePrx(spender, addedValue);
    }

    function decreaseAllowanceExt(uint _i, address spender, uint256 subtractedValue) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].decreaseAllowancePrx(spender, subtractedValue);
    }

    // PriceFeed

    function setPriceExt(uint256 _price) external {
        bool result = priceFeedTestnet.setPrice(_price);
        assert(result);
    }

    // --------------------------
    // Invariants and properties
    // --------------------------

    function echidna_canary_number_of_vaults() public view returns(bool) {
        if (numberOfVaults > 20) {
            return false;
        }

        return true;
    }

    function echidna_canary_active_pool_balance() public view returns(bool) {
        if (address(activePool).balance > 0) {
            return false;
        }
        return true;
    }

    function echidna_vaults_order() external view returns(bool) {
        address currentVault = sortedVaults.getFirst();
        address nextVault = sortedVaults.getNext(currentVault);

        while (currentVault != address(0) && nextVault != address(0)) {
            if (vaultManager.getNominalICR(nextVault) > vaultManager.getNominalICR(currentVault)) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            currentVault = nextVault;
            nextVault = sortedVaults.getNext(currentVault);
        }

        return true;
    }

    /**
     * Status
     * Minimum debt (gas compensation)
     * Stake > 0
     */
    function echidna_vault_properties() public view returns(bool) {
        address currentVault = sortedVaults.getFirst();
        while (currentVault != address(0)) {
            // Status
            if (VaultManager.Status(vaultManager.getVaultStatus(currentVault)) != VaultManager.Status.active) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            // Minimum debt (gas compensation)
            if (vaultManager.getVaultDebt(currentVault) < BPD_GAS_COMPENSATION) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            // Stake > 0
            if (vaultManager.getVaultStake(currentVault) == 0) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            currentVault = sortedVaults.getNext(currentVault);
        }
        return true;
    }

    function echidna_RBTC_balances() public view returns(bool) {
        if (address(vaultManager).balance > 0) {
            return false;
        }

        if (address(borrowerOperations).balance > 0) {
            return false;
        }

        if (address(activePool).balance != activePool.getRBTC()) {
            return false;
        }

        if (address(defaultPool).balance != defaultPool.getRBTC()) {
            return false;
        }

        if (address(stabilityPool).balance != stabilityPool.getRBTC()) {
            return false;
        }

        if (address(bpdToken).balance > 0) {
            return false;
        }
    
        if (address(priceFeedTestnet).balance > 0) {
            return false;
        }
        
        if (address(sortedVaults).balance > 0) {
            return false;
        }

        return true;
    }

    // TODO: What should we do with this? Should it be allowed? Should it be a canary?
    function echidna_price() public view returns(bool) {
        uint price = priceFeedTestnet.getPrice();
        
        if (price == 0) {
            return false;
        }
        // Uncomment to check that the condition is meaningful
        //else return false;

        return true;
    }

    // Total BPD matches
    function echidna_BPD_global_balances() public view returns(bool) {
        uint totalSupply = bpdToken.totalSupply();
        uint gasPoolBalance = bpdToken.balanceOf(address(gasPool));

        uint activePoolBalance = activePool.getBPDDebt();
        uint defaultPoolBalance = defaultPool.getBPDDebt();
        if (totalSupply != activePoolBalance + defaultPoolBalance) {
            return false;
        }

        uint stabilityPoolBalance = stabilityPool.getTotalBPDDeposits();
        address currentVault = sortedVaults.getFirst();
        uint vaultsBalance;
        while (currentVault != address(0)) {
            vaultsBalance += bpdToken.balanceOf(address(currentVault));
            currentVault = sortedVaults.getNext(currentVault);
        }
        // we cannot state equality because tranfers are made to external addresses too
        if (totalSupply <= stabilityPoolBalance + vaultsBalance + gasPoolBalance) {
            return false;
        }

        return true;
    }

    /*
    function echidna_test() public view returns(bool) {
        return true;
    }
    */
}
