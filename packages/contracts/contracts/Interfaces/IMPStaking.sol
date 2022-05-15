// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IMPStaking {

    // --- Events --
    
    event MPTokenAddressSet(address _mpTokenAddress);
    event BPDTokenAddressSet(address _bpdTokenAddress);
    event VaultManagerAddressSet(address _vaultManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint newStake);
    event StakingGainsWithdrawn(address indexed staker, uint BPDGain, uint RBTCGain);
    event F_RBTCUpdated(uint _F_RBTC);
    event F_BPDUpdated(uint _F_BPD);
    event TotalMPStakedUpdated(uint _totalMPStaked);
    event BitcoinSent(address _account, uint _amount);
    event StakerSnapshotsUpdated(address _staker, uint _F_RBTC, uint _F_BPD);

    // --- Functions ---

    function setAddresses
    (
        address _mpTokenAddress,
        address _bpdTokenAddress,
        address _vaultManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )  external;

    function stake(uint _MPamount) external;

    function unstake(uint _MPamount) external;

    function increaseF_RBTC(uint _RBTCFee) external; 

    function increaseF_BPD(uint _MPFee) external;  

    function getPendingRBTCGain(address _user) external view returns (uint);

    function getPendingBPDGain(address _user) external view returns (uint);
}
