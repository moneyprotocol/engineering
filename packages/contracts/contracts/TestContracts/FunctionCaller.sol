// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import '../Interfaces/IVaultManager.sol';
import '../Interfaces/ISortedVaults.sol';
import '../Interfaces/IPriceFeed.sol';
import '../Dependencies/MoneypMath.sol';

/* Wrapper contract - used for calculating gas of read-only and internal functions. 
Not part of the Moneyp application. */
contract FunctionCaller {

    IVaultManager vaultManager;
    address public vaultManagerAddress;

    ISortedVaults sortedVaults;
    address public sortedVaultsAddress;

    IPriceFeed priceFeed;
    address public priceFeedAddress;

    // --- Dependency setters ---

    function setVaultManagerAddress(address _vaultManagerAddress) external {
        vaultManagerAddress = _vaultManagerAddress;
        vaultManager = IVaultManager(_vaultManagerAddress);
    }
    
    function setSortedVaultsAddress(address _sortedVaultsAddress) external {
        vaultManagerAddress = _sortedVaultsAddress;
        sortedVaults = ISortedVaults(_sortedVaultsAddress);
    }

     function setPriceFeedAddress(address _priceFeedAddress) external {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(_priceFeedAddress);
    }

    // --- Non-view wrapper functions used for calculating gas ---
    
    function vaultManager_getCurrentICR(address _address, uint _price) external returns (uint) {
        return vaultManager.getCurrentICR(_address, _price);  
    }

    function sortedVaults_findInsertPosition(uint _NICR, address _prevId, address _nextId) external returns (address, address) {
        return sortedVaults.findInsertPosition(_NICR, _prevId, _nextId);
    }
}
