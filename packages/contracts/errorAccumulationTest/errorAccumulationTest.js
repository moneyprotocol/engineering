const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec

const randAmountInWei = th.randAmountInWei
//const randAmountInGwei = th.randAmountInGwei

const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('VaultManager', async accounts => {
  
  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  let contracts 
  let priceFeed
  let vaultManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  
  beforeEach(async () => {
    contracts = await deploymentHelper.deployMoneypCore()
    const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress)
    
    bpdToken = contracts.bpdToken
    priceFeed = contracts.priceFeedTestnet
    sortedVaults = contracts.sortedVaults
    vaultManager = contracts.vaultManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
  
    mpStaking = MPContracts.mpStaking
    mpToken = MPContracts.mpToken
    communityIssuance = MPContracts.communityIssuance
    lockupContractFactory = MPContracts.lockupContractFactory

    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)
  })

  // --- Check accumulation from repeatedly applying rewards ---

  it("11 accounts with random coll. 1 liquidation. 10 accounts do Vault operations (apply rewards)", async () => {
    await borrowerOperations.openVault(0, 0, accounts[99], { from: accounts[99], value: dec(100, 'ether') })
    await borrowerOperations.openVault(0, dec(170, 18), accounts[0], { from: accounts[0], value: dec(1, 'ether') })

    await th.openVault_allAccounts_randomRBTC(1, 2, accounts.slice(1, 10), contracts, dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 10)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }

    await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })
    
    // check DefaultPool
    const RBTC_DefaultPool = await defaultPool.getRBTC()
    const BPDDebt_DefaultPool = await defaultPool.getBPDDebt()
    console.log(`RBTC left in Default Pool is: ${RBTC_DefaultPool}`)
    console.log(`BPDDebt left in Default Pool is: ${BPDDebt_DefaultPool}`)
  })

  /* ABDK64, no error correction:
    RBTC left in Default Pool is: 34
    BPDDebt left in Default Pool is: 98

    DeciMath, no error correction:
    RBTC left in Default Pool is: 7
    BPDDebt left in Default Pool is: 37

    Pure division, no correction for rewards:
    RBTC left in Default Pool is: 52
    BPDDebt left in Default Pool is: 96
  */

  it("101 accounts with random coll. 1 liquidation. 100 accounts do a Vault operation (apply rewards)", async () => {
    await borrowerOperations.openVault(0, 0, accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
    await borrowerOperations.openVault(0, dec(170, 18), accounts[0], { from: accounts[0], value: dec(1, 'ether') })

    await th.openVault_allAccounts_randomRBTC(1, 2, accounts.slice(1, 100), contracts, dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 100)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }
   
    await borrowerOperations.addColl(accounts[999], accounts[999], { from: accounts[999], value: 1 })
    // check DefaultPool
    const RBTC_DefaultPool = await defaultPool.getRBTC()
    const BPDDebt_DefaultPool = await defaultPool.getBPDDebt()
    console.log(`RBTC left in Default Pool is: ${RBTC_DefaultPool}`)
    console.log(`BPDDebt left in Default Pool is: ${BPDDebt_DefaultPool}`)
  })

  /* ABDK64, no error correction:
    RBTC left in Default Pool is: 908
    BPDDebt left in Default Pool is: 108

    DeciMath, no error correction:
    --Subtraction Overflow

    Pure division, no correction for rewards:
    RBTC left in Default Pool is: 167
    BPDDebt left in Default Pool is: 653
  */

  it("11 accounts. 1 liquidation. 10 accounts do Vault operations (apply rewards)", async () => {
    await borrowerOperations.openVault(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })

    await th.openVault_allAccounts(accounts.slice(0, 10), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 10)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }

    await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })
    // check DefaultPool
    const RBTC_DefaultPool = await defaultPool.getRBTC()
    const BPDDebt_DefaultPool = await defaultPool.getBPDDebt()
    console.log(`RBTC left in Default Pool is: ${RBTC_DefaultPool}`)
    console.log(`BPDDebt left in Default Pool is: ${BPDDebt_DefaultPool}`)
  })
  
  /* ABDK64, no error correction:
    RBTC left in Default Pool is: 64
    BPDDebt left in Default Pool is: 75 
    
    DeciMath, no error correction:
    --Subtraction Overflow

    Pure division, no correction:
    RBTC left in Default Pool is: 64
    BPDDebt left in Default Pool is: 75
  */

  it("101 accounts. 1 liquidation. 100 accounts do Vault operations (apply rewards)", async () => {
    await borrowerOperations.openVault(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })

    await th.openVault_allAccounts(accounts.slice(0, 99), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 99)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }
    await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })

    // check DefaultPool
    const RBTC_DefaultPool = await defaultPool.getRBTC()
    const BPDDebt_DefaultPool = await defaultPool.getBPDDebt()
    console.log(`RBTC left in Default Pool is: ${RBTC_DefaultPool}`)
    console.log(`BPDDebt left in Default Pool is: ${BPDDebt_DefaultPool}`)
  })
  
  /* ABDK64, no error correction:
    RBTC left in Default Pool is: 100
    BPDDebt left in Default Pool is: 180 
    
    DeciMath, no error correction:
    --Subtraction Overflow

    Pure division, no correction:
    RBTC left in Default Pool is: 100
    BPDDebt left in Default Pool is: 180
  */

  it("1001 accounts. 1 liquidation. 1000 accounts do Vault operations (apply rewards)", async () => {
    await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })

    await th.openVault_allAccounts(accounts.slice(0, 999), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 999)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }
    await borrowerOperations.addColl(accounts[999], accounts[999], { from: accounts[999], value: 1 })

    // check DefaultPool
    const RBTC_DefaultPool = await defaultPool.getRBTC()
    const BPDDebt_DefaultPool = await defaultPool.getBPDDebt()
    console.log(`RBTC left in Default Pool is: ${RBTC_DefaultPool}`)
    console.log(`BPDDebt left in Default Pool is: ${BPDDebt_DefaultPool}:`)
  })

  /*
    ABDK64, no error correction:
    RBTC left in Default Pool is: 1000
    BPDDebt left in Default Pool is: 180: 
    
    DeciMath, no error correction:
    -- overflow

    Pure division, no correction:
    RBTC left in Default Pool is: 1000
    BPDDebt left in Default Pool is: 180:
  */

  // --- Error accumulation from repeated Liquidations  - pure distribution, empty SP  ---

  //  50 Vaults added 
  //  1 whale, supports TCR
  //  price drops
  //  loop: Vaults are liquidated. Coll and debt difference between (activePool - defaultPool) is

  it("11 accounts. 10 liquidations. Check (ActivePool - DefaultPool) differences", async () => {
    await borrowerOperations.openVault(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })

    await th.openVault_allAccounts(accounts.slice(0, 11), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    // Grab total active coll and debt before liquidations
    let totalRBTCPoolDifference = web3.utils.toBN(0)
    let totalBPDDebtPoolDifference = web3.utils.toBN(0)

    for (account of accounts.slice(1, 11)) {
      const activePoolRBTC = await activePool.getRBTC()
      const activePoolBPDDebt = await activePool.getBPD()

      await vaultManager.liquidate(account)

      const defaultPoolRBTC = await defaultPool.getRBTC()
      const defaultPoolBPDDebt = await defaultPool.getBPDDebt()

      totalRBTCPoolDifference.add(activePoolRBTC.sub(defaultPoolRBTC))
      totalBPDDebtPoolDifference.add(activePoolBPDDebt.sub(defaultPoolBPDDebt))
    }
    
    console.log(`Accumulated RBTC difference between Default and Active Pools is: ${totalRBTCPoolDifference}`)
    console.log(`Accumulated BPDDebt difference between Active and Default Pools is: ${totalBPDDebtPoolDifference}`)
  })
  
  /* ABDK64, no error correction
    Accumulated RBTC difference between Default and Active Pools is: 0
    Accumulated BPDDebt difference between Active and Default Pools is: 0
    
    DeciMath, no error correction:
    Accumulated RBTC difference between Default and Active Pools is: 0
    Accumulated BPDDebt difference between Active and Default Pools is: 0
    
    Pure division with correction:
    Accumulated RBTC difference between Default and Active Pools is: 0
    Accumulated BPDDebt difference between Active and Default Pools is: 0
  */

  it("11 accounts. 10 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
    await borrowerOperations.openVault(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })

    await th.openVault_allAccounts(accounts.slice(0, 11), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 11)) {
      await vaultManager.liquidate(account)
    }

    const B_RBTC = await vaultManager.B_RBTC()
    const B_BPDDebt = await vaultManager.B_BPDDebt()

    const totalColl = await activePool.getRBTC()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalRBTCRewards = (totalColl.mul(B_RBTC)).div(_1e18_BN)
    const totalBPDRewards = (totalColl.mul(B_BPDDebt)).div(_1e18_BN)

    const defaultPoolRBTC = await defaultPool.getRBTC()
    const defaultPoolBPDDebt = await defaultPool.getBPDDebt()

    const RBTCRewardDifference = defaultPoolRBTC.sub(totalRBTCRewards)
    const BPDDebtRewardDifference = defaultPoolBPDDebt.sub(totalBPDRewards)

    console.log(`RBTC difference between total pending rewards and DefaultPool: ${RBTCRewardDifference} `)
    console.log(`BPDDebt difference between total pending rewards and DefaultPool: ${BPDDebtRewardDifference} `)
  })

  /* ABDK64, no error correction:
    RBTC difference between total pending rewards and DefaultPool: 700
    BPDDebt difference between total pending rewards and DefaultPool: 800

    ABDK64 WITH correction:
    RBTC difference between total pending rewards and DefaultPool: 300
    BPDDebt difference between total pending rewards and DefaultPool: 400
    
    DeciMath, no error correction:
    RBTC difference between total pending rewards and DefaultPool: -100
    BPDDebt difference between total pending rewards and DefaultPool: -200

    Pure division with correction: 
    RBTC difference between total pending rewards and DefaultPool: 0
    BPDDebt difference between total pending rewards and DefaultPool: 0
  */

  it("101 accounts. 100 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
    await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })

    await th.openVault_allAccounts(accounts.slice(0, 101), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 101)) {
      await vaultManager.liquidate(account)
    }

    const B_RBTC = await vaultManager.B_RBTC()
    const B_BPDDebt = await vaultManager.B_BPDDebt()

    const totalColl = await activePool.getRBTC()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalRBTCRewards = (totalColl.mul(B_RBTC)).div(_1e18_BN)
    const totalBPDRewards = (totalColl.mul(B_BPDDebt)).div(_1e18_BN)

    const defaultPoolRBTC = await defaultPool.getRBTC()
    const defaultPoolBPDDebt = await defaultPool.getBPDDebt()

    const RBTCRewardDifference = defaultPoolRBTC.sub(totalRBTCRewards)
    const BPDDebtRewardDifference = defaultPoolBPDDebt.sub(totalBPDRewards)

    console.log(`RBTC difference between total pending rewards and DefaultPool: ${RBTCRewardDifference} `)
    console.log(`BPDDebt difference between total pending rewards and DefaultPool: ${BPDDebtRewardDifference} `)
  })
  
  /* ABDK64, no error correction:
    RBTC difference between total pending rewards and DefaultPool: 51000
    BPDDebt difference between total pending rewards and DefaultPool: 55000
    
    ABDK64 WITH correction:
    RBTC difference between total pending rewards and DefaultPool: 31000
    BPDDebt difference between total pending rewards and DefaultPool: 31000

    DeciMath, no error correction:
    RBTC difference between total pending rewards and DefaultPool: 2000
    BPDDebt difference between total pending rewards and DefaultPool: -2000
    
    Pure division with correction:
    RBTC difference between total pending rewards and DefaultPool: 0
    BPDDebt difference between total pending rewards and DefaultPool: 0
  */

 it("11 accounts with random RBTC and proportional BPD (180:1). 10 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
  await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })

  await th.openVault_allAccounts_randomRBTC_ProportionalBPD(1, 2, accounts.slice(0, 11), contracts, 180)

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 11)) {
      await vaultManager.liquidate(account)

    }
    const B_RBTC = await vaultManager.B_RBTC()
    const B_BPDDebt = await vaultManager.B_BPDDebt()

    const totalColl = await activePool.getRBTC()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalRBTCRewards = (totalColl.mul(B_RBTC)).div(_1e18_BN)
    const totalBPDRewards = (totalColl.mul(B_BPDDebt)).div(_1e18_BN)

    const defaultPoolRBTC = await defaultPool.getRBTC()
    const defaultPoolBPDDebt = await defaultPool.getBPDDebt()

    const RBTCRewardDifference = defaultPoolRBTC.sub(totalRBTCRewards)
    const BPDDebtRewardDifference = defaultPoolBPDDebt.sub(totalBPDRewards)

    console.log(`RBTC difference between total pending rewards and DefaultPool: ${RBTCRewardDifference} `)
    console.log(`BPDDebt difference between total pending rewards and DefaultPool: ${BPDDebtRewardDifference} `)
  })

  /* ABDK64, no error correction:
    RBTC difference between total pending rewards and DefaultPool: 4500
    BPDDebt difference between total pending rewards and DefaultPool: 8000

    ABDK64 WITH correction:
    RBTC difference between total pending rewards and DefaultPool: 300
    BPDDebt difference between total pending rewards and DefaultPool: 300
      
    DeciMath, no error correction:
    RBTC difference between total pending rewards and DefaultPool: 0
    BPDDebt difference between total pending rewards and DefaultPool: -200

    Pure division with correction:
    RBTC difference between total pending rewards and DefaultPool: 100
    BPDDebt difference between total pending rewards and DefaultPool: 100
  */

  it("101 accounts with random RBTC and proportional BPD (180:1). 100 liquidations. Check 1) (DefaultPool - totalDistributionRewards) difference, and 2) ", async () => {
    await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })

    await th.openVault_allAccounts_randomRBTC_ProportionalBPD(1, 2, accounts.slice(0, 101), contracts, 180)

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 101)) {
      await vaultManager.liquidate(account)
    }

    // check (DefaultPool  - totalRewards)
    const B_RBTC = await vaultManager.B_RBTC()
    const B_BPDDebt = await vaultManager.B_BPDDebt()

    const totalColl = await activePool.getRBTC()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalRBTCRewards = (totalColl.mul(B_RBTC)).div(_1e18_BN)
    const totalBPDRewards = (totalColl.mul(B_BPDDebt)).div(_1e18_BN)

    const defaultPoolRBTC = await defaultPool.getRBTC()
    const defaultPoolBPDDebt = await defaultPool.getBPDDebt()

    const RBTCRewardDifference = defaultPoolRBTC.sub(totalRBTCRewards)
    const BPDDebtRewardDifference = defaultPoolBPDDebt.sub(totalBPDRewards)

    console.log(`RBTC difference between total pending rewards and DefaultPool: ${RBTCRewardDifference} `)
    console.log(`BPDDebt difference between total pending rewards and DefaultPool: ${BPDDebtRewardDifference} `)
  })

  /* ABDK64, no error correction:
    RBTC difference between total pending rewards and DefaultPool: 53900
    BPDDebt difference between total pending rewards and DefaultPool: 61000

    ABDK64 WITH correction:
    RBTC difference between total pending rewards and DefaultPool: 31300
    BPDDebt difference between total pending rewards and DefaultPool: 30000
    
    DeciMath, no error correction:
    RBTC difference between total pending rewards and DefaultPool: -4300
    BPDDebt difference between total pending rewards and DefaultPool: -8000
  
    Pure division with correction:
    RBTC difference between total pending rewards and DefaultPool: 400
    BPDDebt difference between total pending rewards and DefaultPool: 1000
  */

  // --- Error accumulation from repeated Liquidations - SP Pool, partial offsets  ---

  it("11 accounts. 10 liquidations, partial offsets. Check (DefaultPool - totalRewards) differences", async () => {
   // Acct 99 opens vault with 100 BPD
    await borrowerOperations.openVault(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })
    await borrowerOperations.withdrawBPD(0, dec(100, 18), accounts[99], {from: accounts[99]})
    
    await th.openVault_allAccounts(accounts.slice(0, 11), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[0])

    // On loop: Account[99] adds 10 BPD to pool -> a vault gets liquidated and partially offset against SP, emptying the SP
    for (account of accounts.slice(1, 11)) {
      await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, {from: account[99]})
      await vaultManager.liquidate(account)
    }
    // check (DefaultPool - totalRewards from distribution)
    const B_RBTC = await vaultManager.B_RBTC()
    const B_BPDDebt = await vaultManager.B_BPDDebt()

    const totalColl = await activePool.getRBTC()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalRBTCRewards_Distribution = (totalColl.mul(B_RBTC)).div(_1e18_BN)
    const totalBPDRewards_Distribution = (totalColl.mul(B_BPDDebt)).div(_1e18_BN)

    const defaultPoolRBTC = await defaultPool.getRBTC()
    const defaultPoolBPDDebt = await defaultPool.getBPDDebt()

    const RBTCRewardDifference = defaultPoolRBTC.sub(totalRBTCRewards_Distribution)
    const BPDDebtRewardDifference = defaultPoolBPDDebt.sub(totalBPDRewards_Distribution)

    console.log(`RBTC difference between total pending distribution rewards and DefaultPool: ${RBTCRewardDifference} `)
    console.log(`BPDDebt difference between total pending distribution rewards and DefaultPool: ${BPDDebtRewardDifference} `)
  })

  /* ABDK64, no error correction
    RBTC difference between total pending distribution rewards and DefaultPool: 550
    BPDDebt difference between total pending distribution rewards and DefaultPool: 600
    
    DeciMath, no error correction:
    RBTC difference between total pending distribution rewards and DefaultPool: 150
    BPDDebt difference between total pending distribution rewards and DefaultPool: -200
    
    Pure division with error correction:
    RBTC difference between total pending distribution rewards and DefaultPool: 50
    BPDDebt difference between total pending distribution rewards and DefaultPool: 0
  */

  it("101 accounts. 100 liquidations, partial offsets. Check (DefaultPool - totalRewards) differences", async () => {
    // Acct 99 opens vault with 100 BPD
     await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawBPD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     await th.openVault_allAccounts(accounts.slice(0, 101), contracts, dec(1, 'ether'), dec(170, 18))
 
     await priceFeed.setPrice(dec(100, 18))
     await vaultManager.liquidate(accounts[0])
 
     // On loop: Account[99] adds 10 BPD to pool -> a vault gets liquidated and partially offset against SP, emptying the SP
     for (account of accounts.slice(1, 101)) {
       await stabilityPool.provideToSP(dec(10, 18),ZERO_ADDRESS, {from: account[99]})
       await vaultManager.liquidate(account)
     }
     // check (DefaultPool - totalRewards from distribution)
     const B_RBTC = await vaultManager.B_RBTC()
     const B_BPDDebt = await vaultManager.B_BPDDebt()
 
     const totalColl = await activePool.getRBTC()
 
     const _1e18_BN = web3.utils.toBN(dec(1, 18))
     const totalRBTCRewards_Distribution = (totalColl.mul(B_RBTC)).div(_1e18_BN)
     const totalBPDRewards_Distribution = (totalColl.mul(B_BPDDebt)).div(_1e18_BN)
 
     const defaultPoolRBTC = await defaultPool.getRBTC()
     const defaultPoolBPDDebt = await defaultPool.getBPDDebt()
 
     const RBTCRewardDifference = defaultPoolRBTC.sub(totalRBTCRewards_Distribution)
     const BPDDebtRewardDifference = defaultPoolBPDDebt.sub(totalBPDRewards_Distribution)
 
     console.log(`RBTC difference between total pending distribution rewards and DefaultPool: ${RBTCRewardDifference} `)
     console.log(`BPDDebt difference between total pending distribution rewards and DefaultPool: ${BPDDebtRewardDifference} `)
   })

  /* ABDK64, no error correction
    RBTC difference between total pending distribution rewards and DefaultPool: 7600 
    BPDDebt difference between total pending distribution rewards and DefaultPool: 8900
    
    DeciMath, no error correction:
    RBTC difference between total pending distribution rewards and DefaultPool: -700
    BPDDebt difference between total pending distribution rewards and DefaultPool: 200
    
    Pure division with error correction:
    RBTC difference between total pending distribution rewards and DefaultPool: 0
    BPDDebt difference between total pending distribution rewards and DefaultPool: 0
  */

  // --- Error accumulation from SP withdrawals ---

  it("11 accounts. 10 Borrowers add to SP. 1 liquidation, 10 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens vault with 100 BPD
     await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawBPD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a vault
     await borrowerOperations.openVault(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

     // 9 Accounts open vaults and provide to SP
     await th.openVault_allAccounts(accounts.slice(1, 11), contracts, dec(1, 'ether'), dec(100, 18))
     await th.provideToSP_allAccounts(accounts.slice(1,11), stabilityPool, dec(50, 18))
     
     await priceFeed.setPrice(dec(100, 18))
     await vaultManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 11)) {
       await stabilityPool.withdrawFromSP(dec(50, 18), {from: account})
     }

    /* Sometimes, the error causes the last BPD withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = dec(100, 18)
    await stabilityPool.provideToSP(whaleSPDeposit,ZERO_ADDRESS, {from: accounts[999]} )
    
    await stabilityPool.withdrawFromSP(dec(50, 18), {from: accounts[1]} )
    const SP_RBTC = await stabilityPool.getRBTC()
    const SP_BPD = await stabilityPool.getTotalBPDDeposits()  

    const SP_BPD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_BPD)

     // check Stability Pool
    console.log(`Surplus RBTC left in in Stability Pool is ${SP_RBTC}`)
    console.log(`BPD insufficiency in Stability Pool is ${SP_BPD_Insufficiency}`)
   })

   /* ABDK64, no error correction
      Sometimes subtraction overflows on last withdrawal from SP - error leaves insufficient BPD in Pool.
      Noticed when reward shares are recurring fractions.

      Error in RBTC gain accumulates in the Pool.
      Surplus RBTC left in in Stability Pool is 530
      BPD insufficiency in Stability Pool is 530
      
      DeciMath, no error correction:
      Surplus RBTC left in in Stability Pool is 0
      BPD insufficiency in Stability Pool is 0

      Pure division with error correction:
      Surplus RBTC left in in Stability Pool is 0
      BPD insufficiency in Stability Pool is 0
    */

   it("101 accounts. 100 Borrowers add to SP. 1 liquidation, 100 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens vault with 100 BPD
     await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawBPD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a vault
     await borrowerOperations.openVault(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

     // 10 Accounts open vaults and provide to SP
     await th.openVault_allAccounts(accounts.slice(1, 101), contracts, dec(1, 'ether'), dec(100, 18))
     await th.provideToSP_allAccounts(accounts.slice(1,101), stabilityPool, dec(50, 18))
     
     await priceFeed.setPrice(dec(100, 18))
     await vaultManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 101)) {
       await stabilityPool.withdrawFromSP(dec(50, 18), {from: account})
     }

    /* Sometimes, the error causes the last BPD withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = dec(100, 18)
    await stabilityPool.provideToSP(whaleSPDeposit,ZERO_ADDRESS, {from: accounts[999]} )
    
    await stabilityPool.withdrawFromSP(dec(50, 18), {from: accounts[1]} )
    const SP_RBTC = await stabilityPool.getRBTC()
    const SP_BPD = await stabilityPool.getTotalBPDDeposits()  

    const SP_BPD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_BPD)

     // check Stability Pool
    console.log(`Surplus RBTC left in in Stability Pool is ${SP_RBTC}`)
    console.log(`BPD insufficiency in Stability Pool is ${SP_BPD_Insufficiency}`)
   })

   /* ABDK64, no error correction
    Surplus RBTC left in in Stability Pool is 5300
    BPD insufficiency in Stability Pool is 5300
      
    DeciMath, no error correction:
    Surplus RBTC left in in Stability Pool is 0
    BPD insufficiency in Stability Pool is 0

    Pure division with error correction:
    Surplus RBTC left in in Stability Pool is 0
    BPD insufficiency in Stability Pool is 0
   */

   it("11 accounts. 10 Borrowers add to SP, random BPD amounts. 1 liquidation, 10 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens vault with 100 BPD
     await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawBPD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a vault
     await borrowerOperations.openVault(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

     // 10 Accounts open vaults and provide to SP
     await th.openVault_allAccounts(accounts.slice(1, 11), contracts, dec(1, 'ether'), dec(100, 18))
     await th.th.provideToSP_allAccounts_randomAmount(10, 90, accounts.slice(2,11), stabilityPool)

     const account1SPDeposit = dec(50, 18)
     await stabilityPool.provideToSP(account1SPDeposit, ZERO_ADDRESS, {from: accounts[1]} )
     
     await priceFeed.setPrice(dec(100, 18))
     await vaultManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     
     for (account of accounts.slice(2, 11)) {
       await stabilityPool.withdrawFromSP(dec(100, 18), {from: account})
     }

    /* Sometimes, the error causes the last BPD withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = dec(100, 18)
    await stabilityPool.provideToSP(whaleSPDeposit, ZERO_ADDRESS, {from: accounts[999]} )
    
    await stabilityPool.withdrawFromSP(account1SPDeposit, {from: accounts[1]} )
    const SP_RBTC = await stabilityPool.getRBTC()
    const SP_BPD = await stabilityPool.getTotalBPDDeposits()  

    const SP_BPD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_BPD)

     // check Stability Pool
    console.log(`Surplus RBTC left in in Stability Pool is ${SP_RBTC}`)
    console.log(`BPD insufficiency in Stability Pool is ${SP_BPD_Insufficiency}`)
   })

   /* ABDK64, no error correction
      Sometimes subtraction overflows on last withdrawal from SP - error leaves insufficient BPD in Pool.
      Noticed when reward shares are recurring fractions.

      Error in RBTC gain accumulates in the Pool.
      Surplus RBTC left in in Stability Pool is 84
      BPD insufficiency in Stability Pool is 442

      DeciMath, no error correction:
      -- Subtraction Overflow

      Pure division with no error correction:
      Surplus RBTC left in in Stability Pool is 366
      BPD insufficiency in Stability Pool is 67

      Pure division with error correction:
      Surplus RBTC left in in Stability Pool is 446
      BPD insufficiency in Stability Pool is 507
    */

   it("101 accounts. 100 Borrowers add to SP, random BPD amounts. 1 liquidation, 100 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens vault with 100 BPD
     await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawBPD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a vault
     await borrowerOperations.openVault(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

     // 100 Accounts open vaults and provide to SP
     await th.openVault_allAccounts(accounts.slice(1, 101), contracts, dec(1, 'ether'), dec(100, 18))
     await th.th.provideToSP_allAccounts_randomAmount(10, 90, accounts.slice(2,101), stabilityPool)

     const account1SPDeposit = dec(50, 18)
     await stabilityPool.provideToSP(account1SPDeposit,ZERO_ADDRESS, {from: accounts[1]} )
     
     await priceFeed.setPrice(dec(100, 18))
     await vaultManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 101)) {
       await stabilityPool.withdrawFromSP(dec(100, 18), {from: account})
     }

    /* Sometimes, the error causes the last BPD withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = dec(100, 18)
    await stabilityPool.provideToSP(whaleSPDeposit,ZERO_ADDRESS, {from: accounts[999]} )
    
    await stabilityPool.withdrawFromSP(account1SPDeposit, {from: accounts[1]} )

    const SP_RBTC = await stabilityPool.getRBTC()
    const SP_BPD = await stabilityPool.getTotalBPDDeposits()  

    const SP_BPD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_BPD)

     // check Stability Pool
    console.log(`Surplus RBTC left in in Stability Pool is ${SP_RBTC}`)
    console.log(`BPD insufficiency in Stability Pool is ${SP_BPD_Insufficiency}`)
   })

   /* ABDK64, no error correction
    Surplus RBTC left in in Stability Pool is 3321
    BPD insufficiency in Stability Pool is 1112

    DeciMath, no error correction:
    Surplus RBTC left in in Stability Pool is 1373
    BPD insufficiency in Stability Pool is -13

    Pure division with no error correction:
    Surplus RBTC left in in Stability Pool is 4087
    BPD insufficiency in Stability Pool is 1960

    Pure division with error correction:
    Surplus RBTC left in in Stability Pool is 3072
    BPD insufficiency in Stability Pool is 452
  */ 

 it("501 accounts. 500 Borrowers add to SP, random BPD amounts. 1 liquidation, 500 Borrowers withdraw all their SP funds", async () => {
  // Acct 99 opens vault with 100 BPD
   await borrowerOperations.openVault(0, 0, accounts[999], { from: accounts[999], value: dec(100, 'ether') })
   await borrowerOperations.withdrawBPD(0, dec(100, 18), accounts[999], {from: accounts[999]})
   
   // Account 0 (to be liquidated) opens a vault
   await borrowerOperations.openVault(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

   // 500 Accounts open vaults and provide to SP
   await th.openVault_allAccounts(accounts.slice(1, 501), contracts, dec(1, 'ether'), dec(100, 18))
   await th.th.provideToSP_allAccounts_randomAmount(10, 90, accounts.slice(2,501), stabilityPool)

   const account1SPDeposit = dec(50, 18)
   await stabilityPool.provideToSP(account1SPDeposit, ZERO_ADDRESS, {from: accounts[1]} )
   
   await priceFeed.setPrice(dec(100, 18))
   await vaultManager.liquidate(accounts[0])

   // All but one depositors withdraw their deposit
   for (account of accounts.slice(2, 501)) {
     await stabilityPool.withdrawFromSP(dec(100, 18), {from: account})
   }

  /* Sometimes, the error causes the last BPD withdrawal from SP to underflow and fail. 
  So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
  const whaleSPDeposit = dec(100, 18)
  await stabilityPool.provideToSP(whaleSPDeposit,ZERO_ADDRESS, {from: accounts[999]} )
  
  await stabilityPool.withdrawFromSP(account1SPDeposit, {from: accounts[1]} )

  const SP_RBTC = await stabilityPool.getRBTC()
  const SP_BPD = await stabilityPool.getTotalBPDDeposits()  

  const SP_BPD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_BPD)

   // check Stability Pool
  console.log(`Surplus RBTC left in in Stability Pool is ${SP_RBTC}`)
  console.log(`BPD insufficiency in Stability Pool is ${SP_BPD_Insufficiency}`)
 })

  /* ABDK64, no error correction:
    DeciMath, no error correction:
    Surplus RBTC left in in Stability Pool is 2691
    BPD insufficiency in Stability Pool is -8445

    Pure division, no correction:
    Surplus RBTC left in in Stability Pool is 18708
    BPD insufficiency in Stability Pool is 25427

    Pure division with error correction:
    Surplus RBTC left in in Stability Pool is 1573
    BPD insufficiency in Stability Pool is 6037
  */ 

 it("10 accounts. 10x liquidate -> addColl. Check stake and totalStakes (On-chain data vs off-chain simulation)", async () => {
  await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
  await th.openVault_allAccounts(accounts.slice(1, 11), contracts, dec(1, 'ether'), dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))
 
  // Starting values for parallel off-chain computation
  let offchainTotalStakes = await vaultManager.totalStakes()
  let offchainTotalColl = await activePool.getRBTC()
  let offchainStake = web3.utils.toBN(0)
  let stakeDifference = web3.utils.toBN(0)
  let totalStakesDifference = web3.utils.toBN(0)

  // Loop over account range, alternately liquidating a Vault and opening a new vault
  for (i = 1; i < 10; i++) {
    const stakeOfVaultToLiquidate = (await vaultManager.Vaults(accounts[i]))[2]
    
    const newEntrantColl = web3.utils.toBN(dec(2, 18))
    
    /* Off-chain computation of new stake.  
    Remove the old stake from total, calculate the new stake, add new stake to total. */
    offchainTotalStakes = offchainTotalStakes.sub(stakeOfVaultToLiquidate)
    offchainTotalColl = offchainTotalColl
    // New vault opening creates a new stake, then adds 
    offchainStake = (newEntrantColl.mul(offchainTotalStakes)).div(offchainTotalColl)
    offchainTotalStakes = offchainTotalStakes.add(offchainStake)
    offchainTotalColl = offchainTotalColl.add(newEntrantColl)
   
    // Liquidate Vault 'i', and open vault from account '999 - i'
    await vaultManager.liquidate(accounts[i], {from: accounts[0]})
    await borrowerOperations.addColl(accounts[999 - i], accounts[999 - i], {from: accounts[999 - i], value: newEntrantColl })
  
    // Grab new stake and totalStakes on-chain
    const newStake = (await vaultManager.Vaults(accounts[999 - i]))[2] 
    const totalStakes = await vaultManager.totalStakes()
    
    stakeDifference = offchainStake.sub(newStake)
    totalStakesDifference = offchainTotalStakes.sub(totalStakes)
  }

  console.log(`Final difference in the last stake made, between on-chain and actual: ${stakeDifference}`)
  console.log(`Final difference in the last totalStakes value, between on-chain and actual: ${totalStakesDifference}`)
})

/* ABDK64, no error correction:
  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: 0

  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: -7

  Pure integer division, no correction:
  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: 0
*/

 it("10 accounts. 10x liquidate -> addColl. Random coll. Check stake and totalStakes (On-chain data vs off-chain simulation)", async () => {
  await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
  await th.openVault_allAccounts(accounts.slice(1, 11), contracts, dec(1, 'ether'), dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))
 
  // Starting values for parallel off-chain computation
  let offchainTotalStakes = await vaultManager.totalStakes()
  let offchainTotalColl = await activePool.getRBTC()
  let offchainStake = web3.utils.toBN(0)
  let stakeDifference = web3.utils.toBN(0)
  let totalStakesDifference = web3.utils.toBN(0)

  // Loop over account range, alternately liquidating a Vault and opening a new vault
  for (i = 1; i < 10; i++) {
    const stakeOfVaultToLiquidate = (await vaultManager.Vaults(accounts[i]))[2]
    
    const newEntrantColl = web3.utils.toBN(randAmountInWei(1, 100))
    
    /* Off-chain computation of new stake.  
    Remove the old stake from total, calculate the new stake, add new stake to total. */
    offchainTotalStakes = offchainTotalStakes.sub(stakeOfVaultToLiquidate)
    offchainTotalColl = offchainTotalColl
    // New vault opening creates a new stake, then adds 
    offchainStake = (newEntrantColl.mul(offchainTotalStakes)).div(offchainTotalColl)
    offchainTotalStakes = offchainTotalStakes.add(offchainStake)
    offchainTotalColl = offchainTotalColl.add(newEntrantColl)
   
    // Liquidate Vault 'i', and open vault from account '999 - i'
    await vaultManager.liquidate(accounts[i], {from: accounts[0]})
    await borrowerOperations.addColl(accounts[999 - i], accounts[999 - i], {from: accounts[999 - i], value: newEntrantColl })
  
    // Grab new stake and totalStakes on-chain
    const newStake = (await vaultManager.Vaults(accounts[999 - i]))[2] 
    const totalStakes = await vaultManager.totalStakes()
    
    stakeDifference = offchainStake.sub(newStake)
    totalStakesDifference = offchainTotalStakes.sub(totalStakes)
  }

  console.log(`Final difference in the last stake made, between on-chain and actual: ${stakeDifference}`)
  console.log(`Final difference in the last totalStakes value, between on-chain and actual: ${totalStakesDifference}`)
})

/* ABDK64, no error correction:
  Final difference in the last stake made, between on-chain and actual: 2
  Final difference in the last totalStakes value, between on-chain and actual: 7

  DeciMath, no error correction:
  Final difference in the last stake made, between on-chain and actual: 8
  Final difference in the last totalStakes value, between on-chain and actual: -68

  Pure integer division, no correction:
  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: 0
*/

it("100 accounts. 100x liquidate -> addColl. Random coll. Check stake and totalStakes (On-chain data vs off-chain simulation)", async () => {
  await borrowerOperations.openVault(0, 0, accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
  await th.openVault_allAccounts(accounts.slice(1, 101), contracts, dec(1, 'ether'), dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))
 
  // Starting values for parallel off-chain computation
  let offchainTotalStakes = await vaultManager.totalStakes()
  let offchainTotalColl = await activePool.getRBTC()
  let offchainStake = web3.utils.toBN(0)
  let stakeDifference = web3.utils.toBN(0)
  let totalStakesDifference = web3.utils.toBN(0)

  // Loop over account range, alternately liquidating a Vault and opening a new vault
  for (i = 1; i < 100; i++) {
    const stakeOfVaultToLiquidate = (await vaultManager.Vaults(accounts[i]))[2]
    
    const newEntrantColl = web3.utils.toBN(randAmountInWei(12, 73422))
    
    /* Off-chain computation of new stake.  
    Remove the old stake from total, calculate the new stake, add new stake to total. */
    offchainTotalStakes = offchainTotalStakes.sub(stakeOfVaultToLiquidate)
    offchainTotalColl = offchainTotalColl
    // New vault opening creates a new stake, then adds 
    offchainStake = (newEntrantColl.mul(offchainTotalStakes)).div(offchainTotalColl)
    offchainTotalStakes = offchainTotalStakes.add(offchainStake)
    offchainTotalColl = offchainTotalColl.add(newEntrantColl)
   
    // Liquidate Vault 'i', and open vault from account '999 - i'
    await vaultManager.liquidate(accounts[i], {from: accounts[0]})
    await borrowerOperations.addColl(accounts[999 - i], accounts[999 - i], {from: accounts[999 - i], value: newEntrantColl })
  
    // Grab new stake and totalStakes on-chain
    const newStake = (await vaultManager.Vaults(accounts[999 - i]))[2] 
    const totalStakes = await vaultManager.totalStakes()
    
    stakeDifference = offchainStake.sub(newStake)
    totalStakesDifference = offchainTotalStakes.sub(totalStakes)
  }

  console.log(`Final difference in the last stake made, between on-chain and actual: ${stakeDifference}`)
  console.log(`Final difference in the last totalStakes value, between on-chain and actual: ${totalStakesDifference}`)
})

/* ABDK64, no error correction:
  Final difference in the last stake made, between on-chain and actual: 1
  Final difference in the last totalStakes value, between on-chain and actual: 321

  DeciMath, no error correction:
  Final difference in the last stake made, between on-chain and actual: -20
  Final difference in the last totalStakes value, between on-chain and actual: -138

  Pure integer division, no correction:
  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: 0
*/

// --- Applied rewards, large coll and debt ---

it("11 accounts with random large coll, magnitude ~1e8 ether. 1 liquidation. 10 accounts do Vault operations (apply rewards)", async () => {
  await borrowerOperations.openVault(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })
  await borrowerOperations.openVault(0, dec(170, 18), accounts[0], { from: accounts[0], value: dec(1, 'ether') })

  // Vaults open with 100-200 million ether
  await th.openVault_allAccounts_randomRBTC(100000000, 200000000, accounts.slice(1, 10), contracts, dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))

  await vaultManager.liquidate(accounts[0])

  for (account of accounts.slice(1, 10)) {
    // apply rewards
    borrowerOperations.addColl(account, account, { from: account, value: 1 })
  }

  await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })
  // check DefaultPool
  const RBTC_DefaultPool = await defaultPool.getRBTC()
  const BPDDebt_DefaultPool = await defaultPool.getBPDDebt()
  console.log(`RBTC left in Default Pool is: ${RBTC_DefaultPool}`)
  console.log(`BPDDebt left in Default Pool is: ${BPDDebt_DefaultPool}`)
})

/* DeciMath:
  RBTC left in Default Pool is: 563902502
  BPDDebt left in Default Pool is: 308731912

  Pure division, correction:
  RBTC left in Default Pool is: 1136050360
  BPDDebt left in Default Pool is: 997601870

  Pure division, no correction:
  RBTC left in Default Pool is: 810899932
  BPDDebt left in Default Pool is: 535042995
*/

it("101 accounts with random large coll, magnitude ~1e8 ether. 1 liquidation. 500 accounts do a Vault operation (apply rewards)", async () => {
  await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
  await borrowerOperations.openVault(0, dec(170, 18), accounts[0], { from: accounts[0], value: dec(1, 'ether') })

   // Vaults open with 100-200 million ether
  await th.openVault_allAccounts_randomRBTC(100000000, 200000000, accounts.slice(1, 100), contracts, dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))

  await vaultManager.liquidate(accounts[0])

  for (account of accounts.slice(1, 100)) {
    // apply rewards
    borrowerOperations.addColl(account, account, { from: account, value: 1 })
  }
 
  await borrowerOperations.addColl(accounts[999], accounts[999], { from: accounts[999], value: 1 })
  // check DefaultPool
  const RBTC_DefaultPool = await defaultPool.getRBTC()
  const BPDDebt_DefaultPool = await defaultPool.getBPDDebt()
  console.log(`RBTC left in Default Pool is: ${RBTC_DefaultPool}`)
  console.log(`BPDDebt left in Default Pool is: ${BPDDebt_DefaultPool}`)
})

 /*
  Pure division, no correction:
  RBTC left in Default Pool is: 8356761440
  BPDDebt left in Default Pool is: 14696382412

  Pure division, correction:
  RBTC left in Default Pool is: 9281255535
  BPDDebt left in Default Pool is: 5854012464
  */

// --- Liquidations, large coll and debt ---

it("11 accounts with random RBTC and proportional BPD (180:1). 10 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
  await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(1, 27) })

  // Vaults open with 100-200 million ether and proportional BPD Debt
  await th.openVault_allAccounts_randomRBTC_ProportionalBPD(100000000, 200000000, accounts.slice(0, 11), contracts, 180)

  await priceFeed.setPrice(dec(100, 18))

  await vaultManager.liquidate(accounts[0])

  for (account of accounts.slice(1, 11)) {
    await vaultManager.liquidate(account)
  }

  const B_RBTC = await vaultManager.B_RBTC()
  const B_BPDDebt = await vaultManager.B_BPDDebt()

  const totalColl = await activePool.getRBTC()

  const _1e18_BN = web3.utils.toBN(dec(1, 18))
  const totalRBTCRewards = (totalColl.mul(B_RBTC)).div(_1e18_BN)
  const totalBPDRewards = (totalColl.mul(B_BPDDebt)).div(_1e18_BN)

  const defaultPoolRBTC = await defaultPool.getRBTC()
  const defaultPoolBPDDebt = await defaultPool.getBPDDebt()

  const RBTCRewardDifference = defaultPoolRBTC.sub(totalRBTCRewards)
  const BPDDebtRewardDifference = defaultPoolBPDDebt.sub(totalBPDRewards)

  console.log(`RBTC difference between total pending rewards and DefaultPool: ${RBTCRewardDifference} `)
  console.log(`BPDDebt difference between total pending rewards and DefaultPool: ${BPDDebtRewardDifference} `)
})
 
/* 
  Pure division, no error correction:
  RBTC difference between total pending rewards and DefaultPool: 9000000000
  BPDDebt difference between total pending rewards and DefaultPool: 12000000000

  Pure division with correction:
  RBTC difference between total pending rewards and DefaultPool: 1000000000
  BPDDebt difference between total pending rewards and DefaultPool: 1000000000
  */

  it("101 accounts with random RBTC and proportional BPD (180:1). 100 liquidations. Check 1) (DefaultPool - totalDistributionRewards) difference, and 2) ", async () => {
    await borrowerOperations.openVault(0, 0,  accounts[999], { from: accounts[999], value: dec(1, 28) })

    // Vaults open with 100-200 million ether and proportional BPD Debt
    await th.openVault_allAccounts_randomRBTC_ProportionalBPD(100000000, 200000000, accounts.slice(0, 101), contracts, 180)

    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(accounts[0])

    // Grab total active coll and debt before liquidations
    for (account of accounts.slice(1, 101)) {
      await vaultManager.liquidate(account)
    }

    // check (DefaultPool  - totalRewards)
    const B_RBTC = await vaultManager.B_RBTC()
    const B_BPDDebt = await vaultManager.B_BPDDebt()

    const totalColl = await activePool.getRBTC()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalRBTCRewards = (totalColl.mul(B_RBTC)).div(_1e18_BN)
    const totalBPDRewards = (totalColl.mul(B_BPDDebt)).div(_1e18_BN)

    const defaultPoolRBTC = await defaultPool.getRBTC()
    const defaultPoolBPDDebt = await defaultPool.getBPDDebt()

    const RBTCRewardDifference = defaultPoolRBTC.sub(totalRBTCRewards)
    const BPDDebtRewardDifference = defaultPoolBPDDebt.sub(totalBPDRewards)

    console.log(`RBTC difference between total pending rewards and DefaultPool: ${RBTCRewardDifference} `)
    console.log(`BPDDebt difference between total pending rewards and DefaultPool: ${BPDDebtRewardDifference} `)
  })
  /*
    Pure division, no correction:
    RBTC difference between total pending rewards and DefaultPool: 910000000000
    BPDDebt difference between total pending rewards and DefaultPool: 870000000000

    Pure division with correction:
    RBTC difference between total pending rewards and DefaultPool: 10000000000
    BPDDebt difference between total pending rewards and DefaultPool: 10000000000
  */
})

  /* --- TODO:
 
 - Stakes computations. Errors occur in stake = totalColl/totalStakes.  
 
 Two contributions to accumulated error:

 -Truncation in division (-)
 -Previous error baked in to totalStakes, reducing the denominator (+)

 Test to see if error is stable or grows. 

  -----
  Findings with ABDK64 throughout:
  -----

  ABDK64:

  1) Reward applications accumulate RBTC and BPDDebt error in DefaultPool

  2) Liquidations accumulate RBTC and BPDDebt error in DefaultPool

  3) Liquidations with partial offset send slightly too little to StabilityPool, and redistribute slightly too much
  
  4) StabilityPool Withdrawals accumulate RBTC error in the StabilityPool

  5) StabilityPool Withdrawals can accumulate BPDLoss in the StabilityPool (i.e. they distribute too much BPD), and can block
  the final deposit withdrawal

  DeciMath:

  1) Lower error overall - 5-10x

  2) Similar noticable error accumulation

  3) Errors more likely to be negative, and cause subtraction overflows

  */
