// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/BaseMath.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/console.sol";
import "../Interfaces/IMPToken.sol";
import "../Interfaces/IMPStaking.sol";
import "../Dependencies/MoneypMath.sol";
import "../Interfaces/IBPDToken.sol";

contract MPStaking is IMPStaking, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---
    string constant public NAME = "MPStaking";

    mapping( address => uint) public stakes;
    uint public totalMPStaked;

    uint public F_RBTC;  // Running sum of RBTC fees per-MP-staked
    uint public F_BPD; // Running sum of MP fees per-MP-staked

    // User snapshots of F_RBTC and F_BPD, taken at the point at which their latest deposit was made
    mapping (address => Snapshot) public snapshots; 

    struct Snapshot {
        uint F_RBTC_Snapshot;
        uint F_BPD_Snapshot;
    }
    
    IMPToken public mpToken;
    IBPDToken public bpdToken;

    address public vaultManagerAddress;
    address public borrowerOperationsAddress;
    address public activePoolAddress;

    // --- Events ---

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
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_mpTokenAddress);
        checkContract(_bpdTokenAddress);
        checkContract(_vaultManagerAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);

        mpToken = IMPToken(_mpTokenAddress);
        bpdToken = IBPDToken(_bpdTokenAddress);
        vaultManagerAddress = _vaultManagerAddress;
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePoolAddress = _activePoolAddress;

        emit MPTokenAddressSet(_mpTokenAddress);
        emit MPTokenAddressSet(_bpdTokenAddress);
        emit VaultManagerAddressSet(_vaultManagerAddress);
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
        emit ActivePoolAddressSet(_activePoolAddress);

        _renounceOwnership();
    }

    // If caller has a pre-existing stake, send any accumulated RBTC and BPD gains to them. 
    function stake(uint _MPamount) external override {
        _requireNonZeroAmount(_MPamount);

        uint currentStake = stakes[msg.sender];

        uint RBTCGain;
        uint BPDGain;
        // Grab any accumulated RBTC and BPD gains from the current stake
        if (currentStake != 0) {
            RBTCGain = _getPendingRBTCGain(msg.sender);
            BPDGain = _getPendingBPDGain(msg.sender);
        }
    
       _updateUserSnapshots(msg.sender);

        uint newStake = currentStake.add(_MPamount);

        // Increase user’s stake and total MP staked
        stakes[msg.sender] = newStake;
        totalMPStaked = totalMPStaked.add(_MPamount);
        emit TotalMPStakedUpdated(totalMPStaked);

        // Transfer MP from caller to this contract
        mpToken.sendToMPStaking(msg.sender, _MPamount);

        emit StakeChanged(msg.sender, newStake);
        emit StakingGainsWithdrawn(msg.sender, BPDGain, RBTCGain);

         // Send accumulated BPD and RBTC gains to the caller
        if (currentStake != 0) {
            bpdToken.transfer(msg.sender, BPDGain);
            _sendRBTCGainToUser(RBTCGain);
        }
    }

    // Unstake the MP and send the it back to the caller, along with their accumulated BPD & RBTC gains. 
    // If requested amount > stake, send their entire stake.
    function unstake(uint _MPamount) external override {
        uint currentStake = stakes[msg.sender];
        _requireUserHasStake(currentStake);

        // Grab any accumulated RBTC and BPD gains from the current stake
        uint RBTCGain = _getPendingRBTCGain(msg.sender);
        uint BPDGain = _getPendingBPDGain(msg.sender);
        
        _updateUserSnapshots(msg.sender);

        if (_MPamount > 0) {
            uint MPToWithdraw = MoneypMath._min(_MPamount, currentStake);

            uint newStake = currentStake.sub(MPToWithdraw);

            // Decrease user's stake and total MP staked
            stakes[msg.sender] = newStake;
            totalMPStaked = totalMPStaked.sub(MPToWithdraw);
            emit TotalMPStakedUpdated(totalMPStaked);

            // Transfer unstaked MP to user
            mpToken.transfer(msg.sender, MPToWithdraw);

            emit StakeChanged(msg.sender, newStake);
        }

        emit StakingGainsWithdrawn(msg.sender, BPDGain, RBTCGain);

        // Send accumulated BPD and RBTC gains to the caller
        bpdToken.transfer(msg.sender, BPDGain);
        _sendRBTCGainToUser(RBTCGain);
    }

    // --- Reward-per-unit-staked increase functions. Called by Moneyp core contracts ---

    function increaseF_RBTC(uint _RBTCFee) external override {
        _requireCallerIsVaultManager();
        uint RBTCFeePerMPStaked;
     
        if (totalMPStaked > 0) {RBTCFeePerMPStaked = _RBTCFee.mul(DECIMAL_PRECISION).div(totalMPStaked);}

        F_RBTC = F_RBTC.add(RBTCFeePerMPStaked); 
        emit F_RBTCUpdated(F_RBTC);
    }

    function increaseF_BPD(uint _BPDFee) external override {
        _requireCallerIsBorrowerOperations();
        uint BPDFeePerMPStaked;
        
        if (totalMPStaked > 0) {BPDFeePerMPStaked = _BPDFee.mul(DECIMAL_PRECISION).div(totalMPStaked);}
        
        F_BPD = F_BPD.add(BPDFeePerMPStaked);
        emit F_BPDUpdated(F_BPD);
    }

    // --- Pending reward functions ---

    function getPendingRBTCGain(address _user) external view override returns (uint) {
        return _getPendingRBTCGain(_user);
    }

    function _getPendingRBTCGain(address _user) internal view returns (uint) {
        uint F_RBTC_Snapshot = snapshots[_user].F_RBTC_Snapshot;
        uint RBTCGain = stakes[_user].mul(F_RBTC.sub(F_RBTC_Snapshot)).div(DECIMAL_PRECISION);
        return RBTCGain;
    }

    function getPendingBPDGain(address _user) external view override returns (uint) {
        return _getPendingBPDGain(_user);
    }

    function _getPendingBPDGain(address _user) internal view returns (uint) {
        uint F_BPD_Snapshot = snapshots[_user].F_BPD_Snapshot;
        uint BPDGain = stakes[_user].mul(F_BPD.sub(F_BPD_Snapshot)).div(DECIMAL_PRECISION);
        return BPDGain;
    }

    // --- Internal helper functions ---

    function _updateUserSnapshots(address _user) internal {
        snapshots[_user].F_RBTC_Snapshot = F_RBTC;
        snapshots[_user].F_BPD_Snapshot = F_BPD;
        emit StakerSnapshotsUpdated(_user, F_RBTC, F_BPD);
    }

    function _sendRBTCGainToUser(uint RBTCGain) internal {
        emit BitcoinSent(msg.sender, RBTCGain);
        (bool success, ) = msg.sender.call{value: RBTCGain}("");
        require(success, "MPStaking: Failed to send accumulated RBTCGain");
    }

    // --- 'require' functions ---

    function _requireCallerIsVaultManager() internal view {
        require(msg.sender == vaultManagerAddress, "MPStaking: caller is not VaultM");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "MPStaking: caller is not BorrowerOps");
    }

     function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "MPStaking: caller is not ActivePool");
    }

    function _requireUserHasStake(uint currentStake) internal pure {  
        require(currentStake > 0, 'MPStaking: User must have a non-zero stake');  
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, 'MPStaking: Amount must be non-zero');
    }

    receive() external payable {
        _requireCallerIsActivePool();
    }
}
