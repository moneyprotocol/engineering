// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IMOCState.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

/*
 * PriceFeed for mainnet deployment, to be connected to MoneyOnChain live RBTC/USD aggregator reference
 * contract and RSK Oracle contract for real-time RBTC price data.
 *
 * The PriceFeed uses MoneyOnChain (MOC) as primary oracle, and RSKOracle as fallback. It contains logic for
 * switching oracles based on oracle failures, timeouts, and conditions for returning to the primary
 * MOC oracle.
 */
contract PriceFeed is Ownable, CheckContract, IPriceFeed {
    IMoCState mocState;

    string public constant NAME = "PriceFeed";

    uint256 public lastGoodPrice;

    event LastGoodPriceUpdated(uint256 _lastGoodPrice);

    // [MP] TODO: revisit this
    enum Status {
        mocWorking
    }

    // The current status of the PriceFeed, which determines the conditions for the next price fetch attempt
    Status public status;

    // --- Dependency setters ---

    function setAddresses(address _mocStateAddress) external onlyOwner {
        checkContract(_mocStateAddress);

        mocState = IMoCState(_mocStateAddress);

        _renounceOwnership();
    }

    // --- Functions ---

    /*
     * fetchPrice():
     * Returns the latest price obtained from the Oracle. Called by Money Protocol functions that require a current price.
     *
     * Also callable by anyone externally.
     *
     * Non-view function - it stores the last good price seen by Money Protocol.
     *
     * Uses a main oracle (MOC) and a fallback oracle (RSK Oracle) in case MOC fails. If both fail,
     * it uses the last good price seen by Money Protocol.
     *
     */
    function fetchPrice() external override returns (uint256) {
        lastGoodPrice = mocState.getBitcoinPrice();
        emit LastGoodPriceUpdated(lastGoodPrice);
        return lastGoodPrice;
    }
}
