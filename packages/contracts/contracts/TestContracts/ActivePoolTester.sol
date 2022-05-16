// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncreaseBPDDebt(uint _amount) external {
        BPDDebt  = BPDDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        RBTC = RBTC.add(msg.value);
    }
}
