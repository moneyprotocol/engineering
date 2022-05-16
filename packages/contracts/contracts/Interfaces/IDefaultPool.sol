// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";


interface IDefaultPool is IPool {
    // --- Events ---
    event VaultManagerAddressChanged(address _newVaultManagerAddress);
    event DefaultPoolBPDDebtUpdated(uint _BPDDebt);
    event DefaultPoolRBTCBalanceUpdated(uint _RBTC);

    // --- Functions ---
    function sendRBTCToActivePool(uint _amount) external;
}
