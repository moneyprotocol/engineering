// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IExternalPriceFeed.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IMOCState.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

/*
 * PriceFeed for mainnet deployment, to be connected to Chainlink's live ETH:USD aggregator reference
 * contract, and a wrapper contract TellorCaller, which connects to TellorMaster contract.
 *
 * The PriceFeed uses Chainlink as primary oracle, and Tellor as fallback. It contains logic for
 * switching oracles based on oracle failures, timeouts, and conditions for returning to the primary
 * Chainlink oracle.
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

    function setExternalPriceFeed(
        uint8 index,
        address _externalPriceFeedAddress
    ) internal returns (uint256) {
        checkContract(_externalPriceFeedAddress);
        priceFeeds[index] = IExternalPriceFeed(_externalPriceFeedAddress);
        (uint256 price, bool success) = priceFeeds[index].latestAnswer();
        require(success, "Price feed is not working");
        emit PriceFeedUpdated(index, _externalPriceFeedAddress);
        return price;
    }

    // --- Functions ---

    /*
     * fetchPrice():
     * Returns the latest price obtained from the Oracle. Called by Liquity functions that require a current price.
     *
     * Also callable by anyone externally.
     *
     * Non-view function - it stores the last good price seen by Liquity.
     *
     * Uses a main oracle (Chainlink) and a fallback oracle (Tellor) in case Chainlink fails. If both fail,
     * it uses the last good price seen by Liquity.
     *
     */
    function fetchPrice() external override returns (uint256) {
        lastGoodPrice = mocState.getBitcoinPrice();
        emit LastGoodPriceUpdated(lastGoodPrice);
        return lastGoodPrice;
    }
}
