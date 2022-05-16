// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../VaultManager.sol";
import "../BorrowerOperations.sol";
import "../StabilityPool.sol";
import "../BPDToken.sol";

contract EchidnaProxy {
    VaultManager vaultManager;
    BorrowerOperations borrowerOperations;
    StabilityPool stabilityPool;
    BPDToken bpdToken;

    constructor(
        VaultManager _vaultManager,
        BorrowerOperations _borrowerOperations,
        StabilityPool _stabilityPool,
        BPDToken _bpdToken
    ) public {
        vaultManager = _vaultManager;
        borrowerOperations = _borrowerOperations;
        stabilityPool = _stabilityPool;
        bpdToken = _bpdToken;
    }

    receive() external payable {
        // do nothing
    }

    // VaultManager

    function liquidatePrx(address _user) external {
        vaultManager.liquidate(_user);
    }

    function liquidateVaultsPrx(uint _n) external {
        vaultManager.liquidateVaults(_n);
    }

    function batchLiquidateVaultsPrx(address[] calldata _vaultArray) external {
        vaultManager.batchLiquidateVaults(_vaultArray);
    }

    function redeemCollateralPrx(
        uint _BPDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external {
        vaultManager.redeemCollateral(_BPDAmount, _firstRedemptionHint, _upperPartialRedemptionHint, _lowerPartialRedemptionHint, _partialRedemptionHintNICR, _maxIterations, _maxFee);
    }

    // Borrower Operations
    function openVaultPrx(uint _RBTC, uint _BPDAmount, address _upperHint, address _lowerHint, uint _maxFee) external payable {
        borrowerOperations.openVault{value: _RBTC}(_maxFee, _BPDAmount, _upperHint, _lowerHint);
    }

    function addCollPrx(uint _RBTC, address _upperHint, address _lowerHint) external payable {
        borrowerOperations.addColl{value: _RBTC}(_upperHint, _lowerHint);
    }

    function withdrawCollPrx(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.withdrawColl(_amount, _upperHint, _lowerHint);
    }

    function withdrawBPDPrx(uint _amount, address _upperHint, address _lowerHint, uint _maxFee) external {
        borrowerOperations.withdrawBPD(_maxFee, _amount, _upperHint, _lowerHint);
    }

    function repayBPDPrx(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.repayBPD(_amount, _upperHint, _lowerHint);
    }

    function closeVaultPrx() external {
        borrowerOperations.closeVault();
    }

    function adjustVaultPrx(uint _RBTC, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFee) external payable {
        borrowerOperations.adjustVault{value: _RBTC}(_maxFee, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint);
    }

    // Pool Manager
    function provideToSPPrx(uint _amount, address _frontEndTag) external {
        stabilityPool.provideToSP(_amount, _frontEndTag);
    }

    function withdrawFromSPPrx(uint _amount) external {
        stabilityPool.withdrawFromSP(_amount);
    }

    // BPD Token

    function transferPrx(address recipient, uint256 amount) external returns (bool) {
        return bpdToken.transfer(recipient, amount);
    }

    function approvePrx(address spender, uint256 amount) external returns (bool) {
        return bpdToken.approve(spender, amount);
    }

    function transferFromPrx(address sender, address recipient, uint256 amount) external returns (bool) {
        return bpdToken.transferFrom(sender, recipient, amount);
    }

    function increaseAllowancePrx(address spender, uint256 addedValue) external returns (bool) {
        return bpdToken.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowancePrx(address spender, uint256 subtractedValue) external returns (bool) {
        return bpdToken.decreaseAllowance(spender, subtractedValue);
    }
}
