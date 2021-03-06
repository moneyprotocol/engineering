// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions 
for testing the parent's internal functions. */
contract BorrowerOperationsTester is BorrowerOperations {

    function getNewICRFromVaultChange
    (
        uint _coll, 
        uint _debt, 
        uint _collChange, 
        bool isCollIncrease, 
        uint _debtChange, 
        bool isDebtIncrease, 
        uint _price
    ) 
    external
    pure
    returns (uint)
    {
        return _getNewICRFromVaultChange(_coll, _debt, _collChange, isCollIncrease, _debtChange, isDebtIncrease, _price);
    }

    function getNewTCRFromVaultChange
    (
        uint _collChange, 
        bool isCollIncrease,  
        uint _debtChange, 
        bool isDebtIncrease, 
        uint _price
    ) 
    external 
    view
    returns (uint) 
    {
        return _getNewTCRFromVaultChange(_collChange, isCollIncrease, _debtChange, isDebtIncrease, _price);
    }

    function getUSDValue(uint _coll, uint _price) external pure returns (uint) {
        return _getUSDValue(_coll, _price);
    }

    function callInternalAdjustLoan
    (
        address _borrower, 
        uint _collWithdrawal, 
        uint _debtChange, 
        bool _isDebtIncrease, 
        address _upperHint,
        address _lowerHint)
        external 
    {
        _adjustVault(_borrower, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint, 0);
    }


    // Payable fallback function
    receive() external payable { }
}
