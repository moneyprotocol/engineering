// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the Pools.
interface IPool {
    
    // --- Events ---
    
    event RBTCBalanceUpdated(uint _newBalance);
    event BPDBalanceUpdated(uint _newBalance);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event BitcoinSent(address _to, uint _amount);

    // --- Functions ---
    
    function getRBTC() external view returns (uint);

    function getBPDDebt() external view returns (uint);

    function increaseBPDDebt(uint _amount) external;

    function decreaseBPDDebt(uint _amount) external;
}
