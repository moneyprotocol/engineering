// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


/**
 * The purpose of this contract is to hold BPD tokens for gas compensation:
 * When a borrower opens a vault, an additional 200 BPD debt is issued,
 * and 200 BPD is minted and sent to this contract.
 * When a borrower closes their active vault, this gas compensation is refunded:
 * 200 BPD is burned from the this contract's balance, and the corresponding
 * 200 BPD debt on the vault is cancelled.
 */
contract GasPool {
    // do nothing, as the core contracts have permission to send to and burn from this address
}
