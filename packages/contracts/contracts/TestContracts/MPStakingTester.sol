// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../MP/MPStaking.sol";


contract MPStakingTester is MPStaking {
    function requireCallerIsVaultManager() external view {
        _requireCallerIsVaultManager();
    }
}
