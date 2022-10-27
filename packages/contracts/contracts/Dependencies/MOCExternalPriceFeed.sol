// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IExternalPriceFeed.sol";
import "./Ownable.sol";
import "./CheckContract.sol";

interface IMoCBaseOracle {
    function peek() external view returns (bytes32, bool);

    function getLastPublicationBlock() external view returns (uint256);
}

interface IMoCState {
    function getBitcoinPrice() external view returns (uint256);

    function getBtcPriceProvider() external view returns (address);
}

contract MOCExternalPriceFeed is Ownable, CheckContract, IExternalPriceFeed {
    IMoCState mocState;
    IMoCBaseOracle mocOracle;

    string public constant NAME = "MOCExternalPriceFeed";

    uint256 public lastGoodPrice;

    function setAddress(address _mocStateAddress) external onlyOwner {
        checkContract(_mocStateAddress);
        mocState = IMoCState(_mocStateAddress);
        address _mocOracleAddress = mocState.getBtcPriceProvider();
        checkContract(_mocOracleAddress);
        mocOracle = IMoCBaseOracle(_mocOracleAddress);
        _renounceOwnership();
    }

    function latestAnswer() external view override returns (uint256, bool) {
        (bytes32 price, bool success) = mocOracle.peek();
        return (uint256(price), success);
    }
}
