import pytest

from brownie import *
from accounts import *
from helpers import *
from simulation_helpers import *

class Contracts: pass


def setAddresses(contracts):
    contracts.sortedVaults.setParams(
        MAX_BYTES_32,
        contracts.vaultManager.address,
        contracts.borrowerOperations.address,
        { 'from': accounts[0] }
    )

    contracts.vaultManager.setAddresses(
        contracts.borrowerOperations.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.priceFeedTestnet.address,
        contracts.bpdToken.address,
        contracts.sortedVaults.address,
        contracts.mpToken.address,
        contracts.mpStaking.address,
        { 'from': accounts[0] }
    )

    contracts.borrowerOperations.setAddresses(
        contracts.vaultManager.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.priceFeedTestnet.address,
        contracts.sortedVaults.address,
        contracts.bpdToken.address,
        contracts.mpStaking.address,
        { 'from': accounts[0] }
    )

    contracts.stabilityPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.vaultManager.address,
        contracts.activePool.address,
        contracts.bpdToken.address,
        contracts.sortedVaults.address,
        contracts.priceFeedTestnet.address,
        contracts.communityIssuance.address,
        { 'from': accounts[0] }
    )

    contracts.activePool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.vaultManager.address,
        contracts.stabilityPool.address,
        contracts.defaultPool.address,
        { 'from': accounts[0] }
    )

    contracts.defaultPool.setAddresses(
        contracts.vaultManager.address,
        contracts.activePool.address,
        { 'from': accounts[0] }
    )

    contracts.collSurplusPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.vaultManager.address,
        contracts.activePool.address,
        { 'from': accounts[0] }
    )

    contracts.hintHelpers.setAddresses(
        contracts.sortedVaults.address,
        contracts.vaultManager.address,
        { 'from': accounts[0] }
    )

    # MP
    contracts.mpStaking.setAddresses(
        contracts.mpToken.address,
        contracts.bpdToken.address,
        contracts.vaultManager.address,
        contracts.borrowerOperations.address,
        contracts.activePool.address,
        { 'from': accounts[0] }
    )

    contracts.communityIssuance.setAddresses(
        contracts.mpToken.address,
        contracts.stabilityPool.address,
        { 'from': accounts[0] }
    )

@pytest.fixture
def add_accounts():
    if network.show_active() != 'development':
        print("Importing accounts...")
        import_accounts(accounts)

@pytest.fixture
def contracts():
    contracts = Contracts()

    contracts.priceFeedTestnet = PriceFeedTestnet.deploy({ 'from': accounts[0] })
    contracts.sortedVaults = SortedVaults.deploy({ 'from': accounts[0] })
    contracts.vaultManager = VaultManager.deploy({ 'from': accounts[0] })
    contracts.activePool = ActivePool.deploy({ 'from': accounts[0] })
    contracts.stabilityPool = StabilityPool.deploy({ 'from': accounts[0] })
    contracts.gasPool = GasPool.deploy({ 'from': accounts[0] })
    contracts.defaultPool = DefaultPool.deploy({ 'from': accounts[0] })
    contracts.collSurplusPool = CollSurplusPool.deploy({ 'from': accounts[0] })
    contracts.borrowerOperations = BorrowerOperations.deploy({ 'from': accounts[0] })
    contracts.hintHelpers = HintHelpers.deploy({ 'from': accounts[0] })
    contracts.bpdToken = BPDToken.deploy(
        contracts.vaultManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address,
        { 'from': accounts[0] }
    )
    # MP
    contracts.mpStaking = MPStaking.deploy({ 'from': accounts[0] })
    contracts.communityIssuance = CommunityIssuance.deploy({ 'from': accounts[0] })
    contracts.lockupContractFactory = LockupContractFactory.deploy({ 'from': accounts[0] })
    contracts.mpToken = MPToken.deploy(
        contracts.communityIssuance.address,
        contracts.mpStaking.address,
        contracts.lockupContractFactory.address,
        accounts[0], # bountyAddress
        accounts[0],  # lpRewardsAddress
        { 'from': accounts[0] }
    )

    setAddresses(contracts)

    return contracts

@pytest.fixture
def print_expectations():
    ether_price_one_year = price_ether_initial * (1 + drift_ether)**8760
    print("Expected ether price at the end of the year: $", ether_price_one_year)

    print("\n Open vaults")
    print("E(Q_t^e)    = ", collateral_gamma_k * collateral_gamma_theta)
    print("SD(Q_t^e)   = ", collateral_gamma_k**(0.5) * collateral_gamma_theta)
    print("E(CR^*(i))  = ", (target_cr_a + target_cr_b * target_cr_chi_square_df) * 100, "%")
    print("SD(CR^*(i)) = ", target_cr_b * (2*target_cr_chi_square_df)**(1/2) * 100, "%")
    print("E(tau)      = ", rational_inattention_gamma_k * rational_inattention_gamma_theta * 100, "%")
    print("SD(tau)     = ", rational_inattention_gamma_k**(0.5) * rational_inattention_gamma_theta * 100, "%")
    print("\n")

def _test_test(contracts):
    print(len(accounts))
    contracts.borrowerOperations.openVault(Wei(1e18), Wei(2000e18), ZERO_ADDRESS, ZERO_ADDRESS,
                                           { 'from': accounts[1], 'value': Wei("100 ether") })

    #assert False

"""# Simulation Program
**Sequence of events**

> In each period, the following events occur sequentially


* exogenous ether price input
* vault liquidation
* return of the previous period's stability pool determined (liquidation gain & airdropped MP gain)
* vault closure
* vault adjustment
* open vaults
* issuance fee
* vault pool formed
* BPD supply determined
* BPD stability pool demand determined
* BPD liquidity pool demand determined
* BPD price determined
* redemption & redemption fee
* MP pool return determined
"""
def test_run_simulation(add_accounts, contracts, print_expectations):
    MIN_NET_DEBT = contracts.vaultManager.MIN_NET_DEBT() / 1e18

    price = contracts.priceFeedTestnet.setPrice(floatToWei(price_ether[0]), { 'from': accounts[0] })
    # whale
    contracts.borrowerOperations.openVault(MAX_FEE, Wei(10e24), ZERO_ADDRESS, ZERO_ADDRESS,
                                           { 'from': accounts[0], 'value': Wei("30000 ether") })
    contracts.stabilityPool.provideToSP(floatToWei(stability_initial), ZERO_ADDRESS, { 'from': accounts[0] })

    active_accounts = []
    inactive_accounts = [*range(1, len(accounts))]

    price_BPD = 1

    data = {"airdrop_gain": [0] * n_sim, "liquidation_gain": [0] * n_sim}
    total_bpd_redempted = 0
    total_coll_added = 0
    total_coll_liquidated = 0

    print(f"Accounts: {len(accounts)}")
    print(f"Network: {network.show_active()}")

    logGlobalState(contracts)

    #Simulation Process
    for index in range(1, n_sim):
        print('\n  --> Iteration', index)
        print('  -------------------\n')
        #exogenous ether price input
        price_ether_current = price_ether[index]
        price = contracts.priceFeedTestnet.setPrice(floatToWei(price_ether_current), { 'from': accounts[0] })
        #price_MP_previous = data.loc[index-1,'price_MP']

        #vault liquidation & return of stability pool
        result_liquidation = liquidate_vaults(accounts, contracts, active_accounts, inactive_accounts, price_ether_current, price_BPD, data, index)
        total_coll_liquidated = total_coll_liquidated + result_liquidation[0]
        return_stability = result_liquidation[1]

        #close vaults
        result_close = close_vaults(accounts, contracts, active_accounts, inactive_accounts, price_ether_current, price_BPD, index)

        #adjust vaults
        coll_added_adjust = adjust_vaults(accounts, contracts, active_accounts, inactive_accounts, price_ether_current, index)

        #open vaults
        coll_added_open = open_vaults(accounts, contracts, active_accounts, inactive_accounts, price_ether_current, price_BPD, index)
        total_coll_added = total_coll_added + coll_added_adjust + coll_added_open
        #active_accounts.sort(key=lambda a : a.get('CR_initial'))

        #Stability Pool
        stability_update(accounts, contracts, return_stability, index)

        #Calculating Price, Liquidity Pool, and Redemption
        [price_BPD, redemption_pool] = price_stabilizer(accounts, contracts, active_accounts, price_BPD, index)
        total_bpd_redempted = total_bpd_redempted + redemption_pool
        print('BPD price', price_BPD)

        """
        #MP Market
        result_MP = MP_market(index, data)
        price_MP_current = result_MP[0]
        annualized_earning = result_MP[1]
        MC_MP_current = result_MP[2]
        """

        logGlobalState(contracts)
        print('Total redempted ', total_bpd_redempted)
        print('Total RBTC added ', total_coll_added)
        print('Total RBTC liquid', total_coll_liquidated)
        print(f'Ratio RBTC liquid {100 * total_coll_liquidated / total_coll_added}%')
        print(' ----------------------\n')

        assert price_BPD > 0
