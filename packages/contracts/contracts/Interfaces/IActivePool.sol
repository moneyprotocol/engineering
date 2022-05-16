// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";


interface IActivePool is IPool {
    // --- Events ---
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event VaultManagerAddressChanged(address _newVaultManagerAddress);
    event ActivePoolBPDDebtUpdated(uint _BPDDebt);
    event ActivePoolRBTCBalanceUpdated(uint _RBTC);

    // --- Functions ---
    function sendRBTC(address _account, uint _amount) external;
}
