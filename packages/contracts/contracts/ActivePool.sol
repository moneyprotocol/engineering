// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IActivePool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

/*
 * The Active Pool holds the RBTC collateral and BPD debt (but not BPD tokens) for all active vaults.
 *
 * When a vault is liquidated, its RBTC and BPD debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
contract ActivePool is Ownable, CheckContract, IActivePool {
    using SafeMath for uint256;

    string constant public NAME = "ActivePool";

    address public borrowerOperationsAddress;
    address public vaultManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;
    uint256 internal RBTC;  // deposited bitcoin tracker
    uint256 internal BPDDebt;

    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event VaultManagerAddressChanged(address _newVaultManagerAddress);
    event ActivePoolBPDDebtUpdated(uint _BPDDebt);
    event ActivePoolRBTCBalanceUpdated(uint _RBTC);

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _vaultManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress
    )
        external
        onlyOwner
    {
        checkContract(_borrowerOperationsAddress);
        checkContract(_vaultManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_defaultPoolAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;
        vaultManagerAddress = _vaultManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit VaultManagerAddressChanged(_vaultManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the RBTC state variable.
    *
    *Not necessarily equal to the contract's raw RBTC balance - bitcoin can be forcibly sent to contracts.
    */
    function getRBTC() external view override returns (uint) {
        return RBTC;
    }

    function getBPDDebt() external view override returns (uint) {
        return BPDDebt;
    }

    // --- Pool functionality ---

    function sendRBTC(address _account, uint _amount) external override {
        _requireCallerIsBOorVaultMorSP();
        RBTC = RBTC.sub(_amount);
        emit ActivePoolRBTCBalanceUpdated(RBTC);
        emit BitcoinSent(_account, _amount);

        (bool success, ) = _account.call{ value: _amount }("");
        require(success, "ActivePool: sending RBTC failed");
    }

    function increaseBPDDebt(uint _amount) external override {
        _requireCallerIsBOorVaultM();
        BPDDebt  = BPDDebt.add(_amount);
        ActivePoolBPDDebtUpdated(BPDDebt);
    }

    function decreaseBPDDebt(uint _amount) external override {
        _requireCallerIsBOorVaultMorSP();
        BPDDebt = BPDDebt.sub(_amount);
        ActivePoolBPDDebtUpdated(BPDDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool");
    }

    function _requireCallerIsBOorVaultMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == vaultManagerAddress ||
            msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor VaultManager nor StabilityPool");
    }

    function _requireCallerIsBOorVaultM() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == vaultManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor VaultManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsBorrowerOperationsOrDefaultPool();
        RBTC = RBTC.add(msg.value);
        emit ActivePoolRBTCBalanceUpdated(RBTC);
    }
}
