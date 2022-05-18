from brownie import Wei

ZERO_ADDRESS = '0x' + '0'.zfill(40)
MAX_BYTES_32 = '0x' + 'F' * 64

def floatToWei(amount):
    return Wei(amount * 1e18)

def logGlobalState(contracts):
    print('\n ---- Global state ----')
    print('Num vaults      ', contracts.sortedVaults.getSize())
    activePoolColl = contracts.activePool.getETH()
    activePoolDebt = contracts.activePool.getBPDDebt()
    defaultPoolColl = contracts.defaultPool.getETH()
    defaultPoolDebt = contracts.defaultPool.getBPDDebt()
    print('Total Debt      ', (activePoolDebt + defaultPoolDebt).to("ether"))
    print('Total Coll      ', (activePoolColl + defaultPoolColl).to("ether"))
    print('SP BPD         ', contracts.stabilityPool.getTotalBPDDeposits().to("ether"))
    print('SP RBTC          ', contracts.stabilityPool.getETH().to("ether"))
    price_ether_current = contracts.priceFeedTestnet.getPrice()
    print('RBTC price       ', price_ether_current.to("ether"))
    print('TCR             ', contracts.vaultManager.getTCR(price_ether_current).to("ether"))
    print('Rec. Mode       ', contracts.vaultManager.checkRecoveryMode(price_ether_current))
    stakes_snapshot = contracts.vaultManager.totalStakesSnapshot()
    coll_snapshot = contracts.vaultManager.totalCollateralSnapshot()
    print('Stake snapshot  ', stakes_snapshot.to("ether"))
    print('Coll snapshot   ', coll_snapshot.to("ether"))
    if stakes_snapshot > 0:
        print('Snapshot ratio  ', coll_snapshot / stakes_snapshot)
    last_vault = contracts.sortedVaults.getLast()
    last_ICR = contracts.vaultManager.getCurrentICR(last_vault, price_ether_current)
    #print('Last vault      ', last_vault)
    print('Last vault’s ICR', last_ICR.to("ether"))
    print(' ----------------------\n')
