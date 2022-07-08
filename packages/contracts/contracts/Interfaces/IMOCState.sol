// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IMoCState {
    function getBitcoinPrice() external view returns (uint256);

    function getBtcPriceProvider() external view returns (address);
}
