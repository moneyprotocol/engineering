// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/MoneypMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/IVaultManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IMPStaking.sol";
import "./BorrowerOperationsScript.sol";
import "./RBTCTransferScript.sol";
import "./MPStakingScript.sol";
import "../Dependencies/console.sol";


contract BorrowerWrappersScript is BorrowerOperationsScript, RBTCTransferScript, MPStakingScript {
    using SafeMath for uint;

    string constant public NAME = "BorrowerWrappersScript";

    IVaultManager immutable vaultManager;
    IStabilityPool immutable stabilityPool;
    IPriceFeed immutable priceFeed;
    IERC20 immutable bpdToken;
    IERC20 immutable mpToken;
    IMPStaking immutable mpStaking;

    constructor(
        address _borrowerOperationsAddress,
        address _vaultManagerAddress,
        address _mpStakingAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
        MPStakingScript(_mpStakingAddress)
        public
    {
        checkContract(_vaultManagerAddress);
        IVaultManager vaultManagerCached = IVaultManager(_vaultManagerAddress);
        vaultManager = vaultManagerCached;

        IStabilityPool stabilityPoolCached = vaultManagerCached.stabilityPool();
        checkContract(address(stabilityPoolCached));
        stabilityPool = stabilityPoolCached;

        IPriceFeed priceFeedCached = vaultManagerCached.priceFeed();
        checkContract(address(priceFeedCached));
        priceFeed = priceFeedCached;

        address bpdTokenCached = address(vaultManagerCached.bpdToken());
        checkContract(bpdTokenCached);
        bpdToken = IERC20(bpdTokenCached);

        address mpTokenCached = address(vaultManagerCached.mpToken());
        checkContract(mpTokenCached);
        mpToken = IERC20(mpTokenCached);

        IMPStaking mpStakingCached = vaultManagerCached.mpStaking();
        require(_mpStakingAddress == address(mpStakingCached), "BorrowerWrappersScript: Wrong MPStaking address");
        mpStaking = mpStakingCached;
    }

    function claimCollateralAndOpenVault(uint _maxFee, uint _BPDAmount, address _upperHint, address _lowerHint) external payable {
        uint balanceBefore = address(this).balance;

        // Claim collateral
        borrowerOperations.claimCollateral();

        uint balanceAfter = address(this).balance;

        // already checked in CollSurplusPool
        assert(balanceAfter > balanceBefore);

        uint totalCollateral = balanceAfter.sub(balanceBefore).add(msg.value);

        // Open vault with obtained collateral, plus collateral sent by user
        borrowerOperations.openVault{ value: totalCollateral }(_maxFee, _BPDAmount, _upperHint, _lowerHint);
    }

    function claimSPRewardsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;
        uint mpBalanceBefore = mpToken.balanceOf(address(this));

        // Claim rewards
        stabilityPool.withdrawFromSP(0);

        uint collBalanceAfter = address(this).balance;
        uint mpBalanceAfter = mpToken.balanceOf(address(this));
        uint claimedCollateral = collBalanceAfter.sub(collBalanceBefore);

        // Add claimed RBTC to vault, get more BPD and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            _requireUserHasVault(address(this));
            uint BPDAmount = _getNetBPDAmount(claimedCollateral);
            borrowerOperations.adjustVault{ value: claimedCollateral }(_maxFee, 0, BPDAmount, true, _upperHint, _lowerHint);
            // Provide withdrawn BPD to Stability Pool
            if (BPDAmount > 0) {
                stabilityPool.provideToSP(BPDAmount, address(0));
            }
        }

        // Stake claimed MP
        uint claimedMP = mpBalanceAfter.sub(mpBalanceBefore);
        if (claimedMP > 0) {
            mpStaking.stake(claimedMP);
        }
    }

    function claimStakingGainsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;
        uint bpdBalanceBefore = bpdToken.balanceOf(address(this));
        uint mpBalanceBefore = mpToken.balanceOf(address(this));

        // Claim gains
        mpStaking.unstake(0);

        uint gainedCollateral = address(this).balance.sub(collBalanceBefore); // stack too deep issues :'(
        uint gainedBPD = bpdToken.balanceOf(address(this)).sub(bpdBalanceBefore);

        uint netBPDAmount;
        // Top up vault and get more BPD, keeping ICR constant
        if (gainedCollateral > 0) {
            _requireUserHasVault(address(this));
            netBPDAmount = _getNetBPDAmount(gainedCollateral);
            borrowerOperations.adjustVault{ value: gainedCollateral }(_maxFee, 0, netBPDAmount, true, _upperHint, _lowerHint);
        }

        uint totalBPD = gainedBPD.add(netBPDAmount);
        if (totalBPD > 0) {
            stabilityPool.provideToSP(totalBPD, address(0));

            // Providing to Stability Pool also triggers MP claim, so stake it if any
            uint mpBalanceAfter = mpToken.balanceOf(address(this));
            uint claimedMP = mpBalanceAfter.sub(mpBalanceBefore);
            if (claimedMP > 0) {
                mpStaking.stake(claimedMP);
            }
        }

    }

    function _getNetBPDAmount(uint _collateral) internal returns (uint) {
        uint price = priceFeed.fetchPrice();
        uint ICR = vaultManager.getCurrentICR(address(this), price);

        uint BPDAmount = _collateral.mul(price).div(ICR);
        uint borrowingRate = vaultManager.getBorrowingRateWithDecay();
        uint netDebt = BPDAmount.mul(MoneypMath.DECIMAL_PRECISION).div(MoneypMath.DECIMAL_PRECISION.add(borrowingRate));

        return netDebt;
    }

    function _requireUserHasVault(address _depositor) internal view {
        require(vaultManager.getVaultStatus(_depositor) == 1, "BorrowerWrappersScript: caller must have an active vault");
    }
}
