// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/IMPStaking.sol";


contract MPStakingScript is CheckContract {
    IMPStaking immutable MPStaking;

    constructor(address _mpStakingAddress) public {
        checkContract(_mpStakingAddress);
        MPStaking = IMPStaking(_mpStakingAddress);
    }

    function stake(uint _MPamount) external {
        MPStaking.stake(_MPamount);
    }
}
