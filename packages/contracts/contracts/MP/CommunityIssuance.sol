// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IMPToken.sol";
import "../Interfaces/ICommunityIssuance.sol";
import "../Dependencies/BaseMath.sol";
import "../Dependencies/MoneypMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/SafeMath.sol";


contract CommunityIssuance is ICommunityIssuance, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---

    string constant public NAME = "CommunityIssuance";

    uint constant public SECONDS_IN_ONE_MINUTE = 60;

   /* The issuance factor F determines the curvature of the issuance curve.
    *
    * Minutes in one year: 60*24*365 = 525600
    *
    * For 50% of remaining tokens issued each year, with minutes as time units, we have:
    * 
    * F ** 525600 = 0.5
    * 
    * Re-arranging:
    * 
    * 525600 * ln(F) = ln(0.5)
    * F = 0.5 ** (1/525600)
    * F = 0.999998681227695000 
    */
    uint constant public ISSUANCE_FACTOR = 999998681227695000;

    /* 
    * The community MP supply cap is the starting balance of the Community Issuance contract.
    * It should be minted to this contract by MPToken, when the token is deployed.
    * 
    * Set to 167.705382 million (approximately 1/3) of total MP supply.
    */
    uint constant public MPSupplyCap = 167.705382e24;

    IMPToken public mpToken;

    address public stabilityPoolAddress;

    uint public totalMPIssued;
    uint public immutable deploymentTime;

    // --- Events ---

    event MPTokenAddressSet(address _mpTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalMPIssuedUpdated(uint _totalMPIssued);

    // --- Functions ---

    constructor() public {
        deploymentTime = block.timestamp;
    }

    function setAddresses
    (
        address _mpTokenAddress, 
        address _stabilityPoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_mpTokenAddress);
        checkContract(_stabilityPoolAddress);

        mpToken = IMPToken(_mpTokenAddress);
        stabilityPoolAddress = _stabilityPoolAddress;

        // When MPToken deployed, it should have transferred CommunityIssuance's MP entitlement
        uint MPBalance = mpToken.balanceOf(address(this));
        assert(MPBalance >= MPSupplyCap);

        emit MPTokenAddressSet(_mpTokenAddress);
        emit StabilityPoolAddressSet(_stabilityPoolAddress);

        _renounceOwnership();
    }

    function issueMP() external override returns (uint) {
        _requireCallerIsStabilityPool();

        uint latestTotalMPIssued = MPSupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalMPIssued.sub(totalMPIssued);

        totalMPIssued = latestTotalMPIssued;
        emit TotalMPIssuedUpdated(latestTotalMPIssued);
        
        return issuance;
    }

    /* Gets 1-f^t    where: f < 1

    f: issuance factor that determines the shape of the curve
    t:  time passed since last MP issuance event  */
    function _getCumulativeIssuanceFraction() internal view returns (uint) {
        // Get the time passed since deployment
        uint timePassedInMinutes = block.timestamp.sub(deploymentTime).div(SECONDS_IN_ONE_MINUTE);

        // f^t
        uint power = MoneypMath._decPow(ISSUANCE_FACTOR, timePassedInMinutes);

        //  (1 - f^t)
        uint cumulativeIssuanceFraction = (uint(DECIMAL_PRECISION).sub(power));
        assert(cumulativeIssuanceFraction <= DECIMAL_PRECISION); // must be in range [0,1]

        return cumulativeIssuanceFraction;
    }

    function sendMP(address _account, uint _MPamount) external override {
        _requireCallerIsStabilityPool();

        mpToken.transfer(_account, _MPamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "CommunityIssuance: caller is not SP");
    }
}
