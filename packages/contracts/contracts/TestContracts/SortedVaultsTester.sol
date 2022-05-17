// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ISortedVaults.sol";


contract SortedVaultsTester {
    ISortedVaults sortedVaults;

    function setSortedVaults(address _sortedVaultsAddress) external {
        sortedVaults = ISortedVaults(_sortedVaultsAddress);
    }

    function insert(address _id, uint256 _NICR, address _prevId, address _nextId) external {
        sortedVaults.insert(_id, _NICR, _prevId, _nextId);
    }

    function remove(address _id) external {
        sortedVaults.remove(_id);
    }

    function reInsert(address _id, uint256 _newNICR, address _prevId, address _nextId) external {
        sortedVaults.reInsert(_id, _newNICR, _prevId, _nextId);
    }

    function getNominalICR(address) external pure returns (uint) {
        return 1;
    }

    function getCurrentICR(address, uint) external pure returns (uint) {
        return 1;
    }
}
