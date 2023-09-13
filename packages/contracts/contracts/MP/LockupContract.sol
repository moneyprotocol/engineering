// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/SafeMath.sol";
import "../Interfaces/IMPToken.sol";

/*
* The lockup contract architecture utilizes a single LockupContract, with an unlockTime. The unlockTime is passed as an argument 
* to the LockupContract's constructor. The contract's balance can be withdrawn by the beneficiary when block.timestamp > unlockTime. 
* At construction, the contract checks that unlockTime is at least one year later than the Moneyp system's deployment time. 

* Within the first year from deployment, the deployer of the MPToken (Money Protocol core team) may transfer MP only to valid 
* LockupContracts, and no other addresses (this is enforced in MPToken.sol's transfer() function).
* 
* The above two restrictions ensure that until one year after system deployment, MP tokens originating from Money Protocol core team cannot 
* enter circulating supply and cannot be staked to earn system revenue.
*/
contract LockupContract {
    using SafeMath for uint;

    // --- Data ---
    string constant public NAME = "LockupContract";

    uint constant public SECONDS_IN_ONE_YEAR = 31536000; // 1 year

    address public immutable beneficiary;

    IMPToken public mpToken;

    // Unlock time is the Unix point in time at which the beneficiary can withdraw.
    uint public unlockTime;

    // --- Events ---

    event LockupContractCreated(address _beneficiary, uint _unlockTime);
    event LockupContractEmptied(uint _MPwithdrawal);

    // --- Functions ---

    constructor 
    (
        address _mpTokenAddress, 
        address _beneficiary, 
        uint _unlockTime
    )
        public 
    {
        mpToken = IMPToken(_mpTokenAddress);

        /*
        * Set the unlock time to a chosen instant in the future, as long as it is at least 1 year after
        * the system was deployed 
        */
        _requireUnlockTimeIsAtLeastOneYearAfterSystemDeployment(_unlockTime);
        unlockTime = _unlockTime;
        
        beneficiary =  _beneficiary;
        emit LockupContractCreated(_beneficiary, _unlockTime);
    }

    function withdrawMP() external {
        _requireCallerIsBeneficiary();
        _requireLockupDurationHasPassed();

        IMPToken mpTokenCached = mpToken;
        uint MPBalance = mpTokenCached.balanceOf(address(this));
        mpTokenCached.transfer(beneficiary, MPBalance);
        emit LockupContractEmptied(MPBalance);
    }

    // --- 'require' functions ---

    function _requireCallerIsBeneficiary() internal view {
        require(msg.sender == beneficiary, "LockupContract: caller is not the beneficiary");
    }

    function _requireLockupDurationHasPassed() internal view {
        require(block.timestamp >= unlockTime, "LockupContract: The lockup duration must have passed");
    }

    function _requireUnlockTimeIsAtLeastOneYearAfterSystemDeployment(uint _unlockTime) internal view {
        uint systemDeploymentTime = mpToken.getDeploymentStartTime();
        require(_unlockTime >= systemDeploymentTime.add(SECONDS_IN_ONE_YEAR), "LockupContract: unlock time must be at least one year after system deployment");
    }
}
