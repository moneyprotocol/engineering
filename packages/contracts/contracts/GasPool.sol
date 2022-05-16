// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


/**
 * The purpose of this contract is to hold BPD tokens for gas compensation:
 * https://github.com/moneyp/dev#gas-compensation
 * When a borrower opens a vault, an additional 50 BPD debt is issued,
 * and 50 BPD is minted and sent to this contract.
 * When a borrower closes their active vault, this gas compensation is refunded:
 * 50 BPD is burned from the this contract's balance, and the corresponding
 * 50 BPD debt on the vault is cancelled.
 * See this issue for more context: https://github.com/moneyp/dev/issues/186
 */
contract GasPool {
    // do nothing, as the core contracts have permission to send to and burn from this address
}
