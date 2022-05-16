// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the Vault Manager.
interface IBorrowerOperations {

    // --- Events ---

    event VaultManagerAddressChanged(address _newVaultManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event SortedVaultsAddressChanged(address _sortedVaultsAddress);
    event BPDTokenAddressChanged(address _bpdTokenAddress);
    event MPStakingAddressChanged(address _mpStakingAddress);

    event VaultCreated(address indexed _borrower, uint arrayIndex);
    event VaultUpdated(address indexed _borrower, uint _debt, uint _coll, uint stake, uint8 operation);
    event BPDBorrowingFeePaid(address indexed _borrower, uint _BPDFee);

    // --- Functions ---

    function setAddresses(
        address _vaultManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedVaultsAddress,
        address _bpdTokenAddress,
        address _mpStakingAddress
    ) external;

    function openVault(uint _maxFee, uint _BPDAmount, address _upperHint, address _lowerHint) external payable;

    function addColl(address _upperHint, address _lowerHint) external payable;

    function moveRBTCGainToVault(address _user, address _upperHint, address _lowerHint) external payable;

    function withdrawColl(uint _amount, address _upperHint, address _lowerHint) external;

    function withdrawBPD(uint _maxFee, uint _amount, address _upperHint, address _lowerHint) external;

    function repayBPD(uint _amount, address _upperHint, address _lowerHint) external;

    function closeVault() external;

    function adjustVault(uint _maxFee, uint _collWithdrawal, uint _debtChange, bool isDebtIncrease, address _upperHint, address _lowerHint) external payable;

    function claimCollateral() external;

    function getCompositeDebt(uint _debt) external pure returns (uint);
}
