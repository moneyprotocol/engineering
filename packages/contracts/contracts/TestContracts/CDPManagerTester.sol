// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../VaultManager.sol";

/* Tester contract inherits from VaultManager, and provides external functions 
for testing the parent's internal functions. */

contract VaultManagerTester is VaultManager {

    function computeICR(uint _coll, uint _debt, uint _price) external pure returns (uint) {
        return MoneypMath._computeCR(_coll, _debt, _price);
    }

    function getCollGasCompensation(uint _coll) external pure returns (uint) {
        return _getCollGasCompensation(_coll);
    }

    function getBPDGasCompensation() external pure returns (uint) {
        return BPD_GAS_COMPENSATION;
    }

    function getCompositeDebt(uint _debt) external pure returns (uint) {
        return _getCompositeDebt(_debt);
    }

    function unprotectedDecayBaseRateFromBorrowing() external returns (uint) {
        baseRate = _calcDecayedBaseRate();
        assert(baseRate >= 0 && baseRate <= DECIMAL_PRECISION);
        
        _updateLastFeeOpTime();
        return baseRate;
    }

    function minutesPassedSinceLastFeeOp() external view returns (uint) {
        return _minutesPassedSinceLastFeeOp();
    }

    function setLastFeeOpTimeToNow() external {
        lastFeeOperationTime = block.timestamp;
    }

    function setBaseRate(uint _baseRate) external {
        baseRate = _baseRate;
    }

    function callGetRedemptionFee(uint _RBTCDrawn) external view returns (uint) {
        _getRedemptionFee(_RBTCDrawn);
    }  

    function getActualDebtFromComposite(uint _debtVal) external pure returns (uint) {
        return _getNetDebt(_debtVal);
    }

    function callInternalRemoveVaultOwner(address _vaultOwner) external {
        uint vaultOwnersArrayLength = VaultOwners.length;
        _removeVaultOwner(_vaultOwner, vaultOwnersArrayLength);
    }
}
