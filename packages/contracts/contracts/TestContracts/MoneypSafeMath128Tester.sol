// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/MoneypSafeMath128.sol";

/* Tester contract for math functions in MoneypSafeMath128.sol library. */

contract MoneypSafeMath128Tester {
    using MoneypSafeMath128 for uint128;

    function add(uint128 a, uint128 b) external pure returns (uint128) {
        return a.add(b);
    }

    function sub(uint128 a, uint128 b) external pure returns (uint128) {
        return a.sub(b);
    }
}
