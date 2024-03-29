// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IVaultManager.sol";
import "./Interfaces/ISortedVaults.sol";
import "./Dependencies/MoneypBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

contract HintHelpers is MoneypBase, Ownable, CheckContract {
    string constant public NAME = "HintHelpers";

    ISortedVaults public sortedVaults;
    IVaultManager public vaultManager;

    // --- Events ---

    event SortedVaultsAddressChanged(address _sortedVaultsAddress);
    event VaultManagerAddressChanged(address _vaultManagerAddress);

    // --- Dependency setters ---

    function setAddresses(
        address _sortedVaultsAddress,
        address _vaultManagerAddress
    )
        external
        onlyOwner
    {
        checkContract(_sortedVaultsAddress);
        checkContract(_vaultManagerAddress);

        sortedVaults = ISortedVaults(_sortedVaultsAddress);
        vaultManager = IVaultManager(_vaultManagerAddress);

        emit SortedVaultsAddressChanged(_sortedVaultsAddress);
        emit VaultManagerAddressChanged(_vaultManagerAddress);

        _renounceOwnership();
    }

    // --- Functions ---

    /* getRedemptionHints() - Helper function for finding the right hints to pass to redeemCollateral().
     *
     * It simulates a redemption of `_BPDamount` to figure out where the redemption sequence will start and what state the final Vault
     * of the sequence will end up in.
     *
     * Returns three hints:
     *  - `firstRedemptionHint` is the address of the first Vault with ICR >= MCR (i.e. the first Vault that will be redeemed).
     *  - `partialRedemptionHintNICR` is the final nominal ICR of the last Vault of the sequence after being hit by partial redemption,
     *     or zero in case of no partial redemption.
     *  - `truncatedBPDamount` is the maximum amount that can be redeemed out of the provided `_BPDamount`. This can be lower than
     *    `_BPDamount` when redeeming the full amount would leave the last Vault of the redemption sequence with less net debt than the
     *    minimum allowed value (i.e. MIN_NET_DEBT).
     *
     * The number of Vaults to consider for redemption can be capped by passing a non-zero value as `_maxIterations`, while passing zero
     * will leave it uncapped.
     */

    function getRedemptionHints(
        uint _BPDamount, 
        uint _price,
        uint _maxIterations
    )
        external
        view
        returns (
            address firstRedemptionHint,
            uint partialRedemptionHintNICR,
            uint truncatedBPDamount
        )
    {
        ISortedVaults sortedVaultsCached = sortedVaults;

        uint remainingBPD = _BPDamount;
        address currentVaultuser = sortedVaultsCached.getLast();

        while (currentVaultuser != address(0) && vaultManager.getCurrentICR(currentVaultuser, _price) < MCR) {
            currentVaultuser = sortedVaultsCached.getPrev(currentVaultuser);
        }

        firstRedemptionHint = currentVaultuser;

        if (_maxIterations == 0) {
            _maxIterations = uint(-1);
        }

        while (currentVaultuser != address(0) && remainingBPD > 0 && _maxIterations-- > 0) {
            uint netBPDDebt = _getNetDebt(vaultManager.getVaultDebt(currentVaultuser))
                .add(vaultManager.getPendingBPDDebtReward(currentVaultuser));

            if (netBPDDebt > remainingBPD) {
                if (netBPDDebt > MIN_NET_DEBT) {
                    uint maxRedeemableBPD = MoneypMath._min(remainingBPD, netBPDDebt.sub(MIN_NET_DEBT));

                    uint RBTC = vaultManager.getVaultColl(currentVaultuser)
                        .add(vaultManager.getPendingRBTCReward(currentVaultuser));

                    uint newColl = RBTC.sub(maxRedeemableBPD.mul(DECIMAL_PRECISION).div(_price));
                    uint newDebt = netBPDDebt.sub(maxRedeemableBPD);

                    uint compositeDebt = _getCompositeDebt(newDebt);
                    partialRedemptionHintNICR = MoneypMath._computeNominalCR(newColl, compositeDebt);

                    remainingBPD = remainingBPD.sub(maxRedeemableBPD);
                }
                break;
            } else {
                remainingBPD = remainingBPD.sub(netBPDDebt);
            }

            currentVaultuser = sortedVaultsCached.getPrev(currentVaultuser);
        }

        truncatedBPDamount = _BPDamount.sub(remainingBPD);
    }

    /* getApproxHint() - return address of a Vault that is, on average, (length / numTrials) positions away in the 
    sortedVaults list from the correct insert position of the Vault to be inserted. 
    
    Note: The output address is worst-case O(n) positions away from the correct insert position, however, the function 
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput address will 
    be <= sqrt(length) positions away from the correct insert position.
    */
    function getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)
        external
        view
        returns (address hintAddress, uint diff, uint latestRandomSeed)
    {
        uint arrayLength = vaultManager.getVaultOwnersCount();

        if (arrayLength == 0) {
            return (address(0), 0, _inputRandomSeed);
        }

        hintAddress = sortedVaults.getLast();
        diff = MoneypMath._getAbsoluteDifference(_CR, vaultManager.getNominalICR(hintAddress));
        latestRandomSeed = _inputRandomSeed;

        uint i = 1;

        while (i < _numTrials) {
            latestRandomSeed = uint(keccak256(abi.encodePacked(latestRandomSeed)));

            uint arrayIndex = latestRandomSeed % arrayLength;
            address currentAddress = vaultManager.getVaultFromVaultOwnersArray(arrayIndex);
            uint currentNICR = vaultManager.getNominalICR(currentAddress);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint currentDiff = MoneypMath._getAbsoluteDifference(currentNICR, _CR);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            i++;
        }
    }

    function computeNominalCR(uint _coll, uint _debt) external pure returns (uint) {
        return MoneypMath._computeNominalCR(_coll, _debt);
    }

    function computeCR(uint _coll, uint _debt, uint _price) external pure returns (uint) {
        return MoneypMath._computeCR(_coll, _debt, _price);
    }
}
