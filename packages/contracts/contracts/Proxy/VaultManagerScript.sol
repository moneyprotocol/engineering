// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/IVaultManager.sol";


contract VaultManagerScript is CheckContract {
    string constant public NAME = "VaultManagerScript";

    IVaultManager immutable vaultManager;

    constructor(IVaultManager _vaultManager) public {
        checkContract(address(_vaultManager));
        vaultManager = _vaultManager;
    }

    function redeemCollateral(
        uint _BPDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external returns (uint) {
        vaultManager.redeemCollateral(
            _BPDAmount,
            _firstRedemptionHint,
            _upperPartialRedemptionHint,
            _lowerPartialRedemptionHint,
            _partialRedemptionHintNICR,
            _maxIterations,
            _maxFee
        );
    }
}
