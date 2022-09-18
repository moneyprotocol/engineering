// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IExternalPriceFeed.sol";
import "./Ownable.sol";
import "./CheckContract.sol";

interface IRSKOracle {
    function getPricing() external view returns (uint256, uint256);
}

contract RSKExternalPriceFeed is Ownable, CheckContract, IExternalPriceFeed {
    IRSKOracle rskOracle;

    string public constant NAME = "RSKExternalPriceFeed";

    uint256 public lastGoodPrice;

    function setAddress(address _rskOracleAddress) external onlyOwner {
        checkContract(_rskOracleAddress);
        rskOracle = IRSKOracle(_rskOracleAddress);
        _renounceOwnership();
    }

    function latestAnswer() external view override returns (uint256, bool) {
        (uint256 price, ) = rskOracle.getPricing();
        return (price, price != 0);
    }
}
