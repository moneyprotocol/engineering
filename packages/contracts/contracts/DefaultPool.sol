// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IDefaultPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

/*
 * The Default Pool holds the RBTC and BPD debt (but not BPD tokens) from liquidations that have been redistributed
 * to active vaults but not yet "applied", i.e. not yet recorded on a recipient active vault's struct.
 *
 * When a vault makes an operation that applies its pending RBTC and BPD debt, its pending RBTC and BPD debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is Ownable, CheckContract, IDefaultPool {
    using SafeMath for uint256;

    string constant public NAME = "DefaultPool";

    address public vaultManagerAddress;
    address public activePoolAddress;
    uint256 internal RBTC;  // deposited RBTC tracker
    uint256 internal BPDDebt;  // debt

    event VaultManagerAddressChanged(address _newVaultManagerAddress);
    event DefaultPoolBPDDebtUpdated(uint _BPDDebt);
    event DefaultPoolRBTCBalanceUpdated(uint _RBTC);

    // --- Dependency setters ---

    function setAddresses(
        address _vaultManagerAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
    {
        checkContract(_vaultManagerAddress);
        checkContract(_activePoolAddress);

        vaultManagerAddress = _vaultManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit VaultManagerAddressChanged(_vaultManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the RBTC state variable.
    *
    * Not necessarily equal to the the contract's raw RBTC balance - bitcoin can be forcibly sent to contracts.
    */
    function getRBTC() external view override returns (uint) {
        return RBTC;
    }

    function getBPDDebt() external view override returns (uint) {
        return BPDDebt;
    }

    // --- Pool functionality ---

    function sendRBTCToActivePool(uint _amount) external override {
        _requireCallerIsVaultManager();
        address activePool = activePoolAddress; // cache to save an SLOAD
        RBTC = RBTC.sub(_amount);
        emit DefaultPoolRBTCBalanceUpdated(RBTC);
        emit BitcoinSent(activePool, _amount);

        (bool success, ) = activePool.call{ value: _amount }("");
        require(success, "DefaultPool: sending RBTC failed");
    }

    function increaseBPDDebt(uint _amount) external override {
        _requireCallerIsVaultManager();
        BPDDebt = BPDDebt.add(_amount);
        emit DefaultPoolBPDDebtUpdated(BPDDebt);
    }

    function decreaseBPDDebt(uint _amount) external override {
        _requireCallerIsVaultManager();
        BPDDebt = BPDDebt.sub(_amount);
        emit DefaultPoolBPDDebtUpdated(BPDDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsVaultManager() internal view {
        require(msg.sender == vaultManagerAddress, "DefaultPool: Caller is not the VaultManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        RBTC = RBTC.add(msg.value);
        emit DefaultPoolRBTCBalanceUpdated(RBTC);
    }
}
