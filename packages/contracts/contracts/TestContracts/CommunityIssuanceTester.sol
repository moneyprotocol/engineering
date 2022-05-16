// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../MP/CommunityIssuance.sol";

contract CommunityIssuanceTester is CommunityIssuance {
    function obtainMP(uint _amount) external {
        mpToken.transfer(msg.sender, _amount);
    }

    function getCumulativeIssuanceFraction() external view returns (uint) {
       return _getCumulativeIssuanceFraction();
    }

    function unprotectedIssueMP() external returns (uint) {
        // No checks on caller address
       
        uint latestTotalMPIssued = MPSupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalMPIssued.sub(totalMPIssued);
      
        totalMPIssued = latestTotalMPIssued;
        return issuance;
    }
}
