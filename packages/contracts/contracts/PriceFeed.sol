// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IExternalPriceFeed.sol";
import "./Interfaces/IPriceFeed.sol";
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
    string public constant NAME = "PriceFeed";

    IExternalPriceFeed[2] priceFeeds;

    uint256 public lastGoodPrice;

    event LastGoodPriceUpdated(uint256 _lastGoodPrice);
    event PriceFeedBroken(uint8 index, address priceFeedAddress);
    event PriceFeedUpdated(uint8 index, address newPriceFeedAddress);

    // --- Dependency setters ---

    function setAddresses(address[] memory priceFeedAddresses)
        external
        onlyOwner
    {
        require(
            priceFeedAddresses.length == priceFeeds.length,
            "PriceFeed must have 2 price feeds"
        );

        for (uint8 i = 0; i < priceFeedAddresses.length; i++) {
            uint256 latestPrice = setExternalPriceFeed(
                i,
                priceFeedAddresses[i]
            );
            lastGoodPrice = latestPrice;
            emit LastGoodPriceUpdated(lastGoodPrice);
        }

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
        for (uint8 i = 0; i < priceFeeds.length; i++) {
            (uint256 price, bool success) = priceFeeds[i].latestAnswer();
            if (success) {
                lastGoodPrice = price;
                emit LastGoodPriceUpdated(lastGoodPrice);
                return price;
            }
            emit PriceFeedBroken(i, address(priceFeeds[i]));
        }
        return lastGoodPrice;
    }
}
