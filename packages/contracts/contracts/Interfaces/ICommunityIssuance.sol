// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ICommunityIssuance { 
    
    // --- Events ---
    
    event MPTokenAddressSet(address _mpTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalMPIssuedUpdated(uint _totalMPIssued);

    // --- Functions ---

    function setAddresses(address _mpTokenAddress, address _stabilityPoolAddress) external;

    function issueMP() external returns (uint);

    function sendMP(address _account, uint _MPamount) external;
}
