// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IBPDToken.sol";

contract BPDTokenCaller {
    IBPDToken BPD;

    function setBPD(IBPDToken _BPD) external {
        BPD = _BPD;
    }

    function bpdMint(address _account, uint _amount) external {
        BPD.mint(_account, _amount);
    }

    function bpdBurn(address _account, uint _amount) external {
        BPD.burn(_account, _amount);
    }

    function bpdSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        BPD.sendToPool(_sender, _poolAddress, _amount);
    }

    function bpdReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        BPD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
