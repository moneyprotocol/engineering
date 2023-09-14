const { setNextBlockBaseFeePerGas } = require("@nomicfoundation/hardhat-network-helpers")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference
const mv = testHelpers.MoneyValues

const VaultManagerTester = artifacts.require("VaultManagerTester")
const BPDToken = artifacts.require("BPDToken")

contract('VaultManager - Redistribution reward calculations', async accounts => {

  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    A, B, C, D, E,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let bpdToken
  let sortedVaults
  let vaultManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  let contracts

  const getOpenVaultBPDAmount = async (totalDebt) => th.getOpenVaultBPDAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const openVault = async (params) => th.openVault(contracts, params)

  beforeEach(async () => {
    await setNextBlockBaseFeePerGas(0)
    contracts = await deploymentHelper.deployMoneypCore()
    contracts.vaultManager = await VaultManagerTester.new()
    contracts.bpdToken = await BPDToken.new(
      contracts.vaultManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeed = contracts.priceFeedTestnet
    bpdToken = contracts.bpdToken
    sortedVaults = contracts.sortedVaults
    vaultManager = contracts.vaultManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations

    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)
  })

  it("redistribution: A, B Open. B Liquidated. C, D Open. D Liquidated. Distributes correct rewards", async () => {
    // A, B open vault
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: bob } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: B liquidated
    const txB = await vaultManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedVaults.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // C, D open vaults
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: carol } })
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L2: D Liquidated
    const txD = await vaultManager.liquidate(dennis)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedVaults.contains(dennis))

    // Get entire coll of A and C
    const alice_Coll = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()
    const carol_Coll = ((await vaultManager.Vaults(carol))[1]
      .add(await vaultManager.getPendingRBTCReward(carol)))
      .toString()

    /* Expected collateral:
    A: Alice receives 0.995 RBTC from L1, and ~3/5*0.995 RBTC from L2.
    expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 RBTC

    C: Carol receives ~2/5 RBTC from L2
    expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 RBTC

    Total coll = 4 + 2 * 0.995 RBTC
    */
    const A_collAfterL1 = A_coll.add(th.applyLiquidationFee(B_coll))
    assert.isAtMost(th.getDifference(alice_Coll, A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), 1000)


    const entireSystemColl = (await activePool.getRBTC()).add(await defaultPool.getRBTC()).toString()
    assert.equal(entireSystemColl, A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: A, B, C Open. C Liquidated. D, E, F Open. F Liquidated. Distributes correct rewards", async () => {
    // A, B C open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: bob } })
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: C liquidated
    const txC = await vaultManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedVaults.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // D, E, F open vaults
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: dennis } })
    const { collateral: E_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: erin } })
    const { collateral: F_coll } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: freddy } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L2: F Liquidated
    const txF = await vaultManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedVaults.contains(freddy))

    // Get entire coll of A, B, D and E
    const alice_Coll = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()
    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()
    const dennis_Coll = ((await vaultManager.Vaults(dennis))[1]
      .add(await vaultManager.getPendingRBTCReward(dennis)))
      .toString()
    const erin_Coll = ((await vaultManager.Vaults(erin))[1]
      .add(await vaultManager.getPendingRBTCReward(erin)))
      .toString()

    /* Expected collateral:
    A and B receives 1/2 RBTC * 0.995 from L1.
    total Coll: 3

    A, B, receive (2.4975)/8.995 * 0.995 RBTC from L2.
    
    D, E receive 2/8.995 * 0.995 RBTC from L2.

    expect A, B coll  = 2 +  0.4975 + 0.2763  =  RBTC
    expect D, E coll  = 2 + 0.2212  =  RBTC

    Total coll = 8 (non-liquidated) + 2 * 0.995 (liquidated and redistributed)
    */
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const totalBeforeL2 = A_collAfterL1.add(B_collAfterL1).add(D_coll).add(E_coll)
    const expected_A = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_B = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_D = D_coll.add(D_coll.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_E = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    assert.isAtMost(th.getDifference(alice_Coll, expected_A), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, expected_D), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, expected_E), 1000)

    const entireSystemColl = (await activePool.getRBTC()).add(await defaultPool.getRBTC()).toString()
    assert.equal(entireSystemColl, A_coll.add(B_coll).add(D_coll).add(E_coll).add(th.applyLiquidationFee(C_coll.add(F_coll))))

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })
  ////

  it("redistribution: Sequence of alternate opening/liquidation: final surviving vault has RBTC from all previously liquidated vaults", async () => {
    // A, B  open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: bob } })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L1: A liquidated
    const txA = await vaultManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(alice))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // C, opens vault
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L2: B Liquidated
    const txB = await vaultManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedVaults.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // D opens vault
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L3: C Liquidated
    const txC = await vaultManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedVaults.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // E opens vault
    const { collateral: E_coll } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L4: D Liquidated
    const txD = await vaultManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedVaults.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // F opens vault
    const { collateral: F_coll } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: freddy } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L5: E Liquidated
    const txE = await vaultManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedVaults.contains(erin))

    // Get entire coll of A, B, D, E and F
    const alice_Coll = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()
    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()
    const carol_Coll = ((await vaultManager.Vaults(carol))[1]
      .add(await vaultManager.getPendingRBTCReward(carol)))
      .toString()
    const dennis_Coll = ((await vaultManager.Vaults(dennis))[1]
      .add(await vaultManager.getPendingRBTCReward(dennis)))
      .toString()
    const erin_Coll = ((await vaultManager.Vaults(erin))[1]
      .add(await vaultManager.getPendingRBTCReward(erin)))
      .toString()

    const freddy_rawColl = (await vaultManager.Vaults(freddy))[1].toString()
    const freddy_RBTCReward = (await vaultManager.getPendingRBTCReward(freddy)).toString()

    /* Expected collateral:
     A-E should have been liquidated
     vault F should have acquired all RBTC in the system: 1 RBTC initial coll, and 0.995^5+0.995^4+0.995^3+0.995^2+0.995 from rewards = 5.925 RBTC
    */
    assert.isAtMost(th.getDifference(alice_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, '0'), 1000)

    assert.isAtMost(th.getDifference(freddy_rawColl, F_coll), 1000)
    const gainedRBTC = th.applyLiquidationFee(
      E_coll.add(th.applyLiquidationFee(
        D_coll.add(th.applyLiquidationFee(
          C_coll.add(th.applyLiquidationFee(
            B_coll.add(th.applyLiquidationFee(A_coll))
          ))
        ))
      ))
    )
    assert.isAtMost(th.getDifference(freddy_RBTCReward, gainedRBTC), 1000)

    const entireSystemColl = (await activePool.getRBTC()).add(await defaultPool.getRBTC()).toString()
    assert.isAtMost(th.getDifference(entireSystemColl, F_coll.add(gainedRBTC)), 1000)

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(1000, 18))
  })

  // ---Vault adds collateral --- 

  // Test based on scenario in: https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution: A,B,C,D,E open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt", async () => {
    // A, B, C, D, E open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100000, 18), extraParams: { from: A } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100000, 18), extraParams: { from: B } })
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100000, 18), extraParams: { from: C } })
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(20000, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: D } })
    const { collateral: E_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100000, 18), extraParams: { from: E } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate A
    // console.log(`ICR A: ${await vaultManager.getCurrentICR(A, price)}`)
    const txA = await vaultManager.liquidate(A)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(A))

    // Check entireColl for each vault:
    const B_entireColl_1 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_1 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_1 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_1 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    const totalCollAfterL1 = B_coll.add(C_coll).add(D_coll).add(E_coll)
    const B_collAfterL1 = B_coll.add(th.applyLiquidationFee(A_coll).mul(B_coll).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(th.applyLiquidationFee(A_coll).mul(C_coll).div(totalCollAfterL1))
    const D_collAfterL1 = D_coll.add(th.applyLiquidationFee(A_coll).mul(D_coll).div(totalCollAfterL1))
    const E_collAfterL1 = E_coll.add(th.applyLiquidationFee(A_coll).mul(E_coll).div(totalCollAfterL1))
    assert.isAtMost(getDifference(B_entireColl_1, B_collAfterL1), 1e8)
    assert.isAtMost(getDifference(C_entireColl_1, C_collAfterL1), 1e8)
    assert.isAtMost(getDifference(D_entireColl_1, D_collAfterL1), 1e8)
    assert.isAtMost(getDifference(E_entireColl_1, E_collAfterL1), 1e8)

    // Bob adds 1 RBTC to his vault
    const addedColl1 = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(B, B, { from: B, value: addedColl1 })

    // Liquidate C
    const txC = await vaultManager.liquidate(C)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedVaults.contains(C))

    const B_entireColl_2 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_2 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_2 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    const totalCollAfterL2 = B_collAfterL1.add(addedColl1).add(D_collAfterL1).add(E_collAfterL1)
    const B_collAfterL2 = B_collAfterL1.add(addedColl1).add(th.applyLiquidationFee(C_collAfterL1).mul(B_collAfterL1.add(addedColl1)).div(totalCollAfterL2))
    const D_collAfterL2 = D_collAfterL1.add(th.applyLiquidationFee(C_collAfterL1).mul(D_collAfterL1).div(totalCollAfterL2))
    const E_collAfterL2 = E_collAfterL1.add(th.applyLiquidationFee(C_collAfterL1).mul(E_collAfterL1).div(totalCollAfterL2))
    // console.log(`D_entireColl_2: ${D_entireColl_2}`)
    // console.log(`E_entireColl_2: ${E_entireColl_2}`)
    //assert.isAtMost(getDifference(B_entireColl_2, B_collAfterL2), 1e8)
    assert.isAtMost(getDifference(D_entireColl_2, D_collAfterL2), 1e8)
    assert.isAtMost(getDifference(E_entireColl_2, E_collAfterL2), 1e8)

    // Bob adds 1 RBTC to his vault
    const addedColl2 = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(B, B, { from: B, value: addedColl2 })

    // Liquidate E
    const txE = await vaultManager.liquidate(E)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedVaults.contains(E))

    const totalCollAfterL3 = B_collAfterL2.add(addedColl2).add(D_collAfterL2)
    const B_collAfterL3 = B_collAfterL2.add(addedColl2).add(th.applyLiquidationFee(E_collAfterL2).mul(B_collAfterL2.add(addedColl2)).div(totalCollAfterL3))
    const D_collAfterL3 = D_collAfterL2.add(th.applyLiquidationFee(E_collAfterL2).mul(D_collAfterL2).div(totalCollAfterL3))

    const B_entireColl_3 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_3 = (await th.getEntireCollAndDebt(contracts, D)).entireColl

    const diff_entireColl_B = getDifference(B_entireColl_3, B_collAfterL3)
    const diff_entireColl_D = getDifference(D_entireColl_3, D_collAfterL3)

    assert.isAtMost(diff_entireColl_B, 1e8)
    assert.isAtMost(diff_entireColl_D, 1e8)
  })

  // Test based on scenario in: https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution: A,B,C,D open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt", async () => {
    // A, B, C, D, E open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100000, 18), extraParams: { from: A } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100000, 18), extraParams: { from: B } })
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100000, 18), extraParams: { from: C } })
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(20000, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: D } })
    const { collateral: E_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100000, 18), extraParams: { from: E } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Check entireColl for each vault:
    const A_entireColl_0 = (await th.getEntireCollAndDebt(contracts, A)).entireColl
    const B_entireColl_0 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_0 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_0 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_0 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    // entireSystemColl, excluding A 
    const denominatorColl_1 = (await vaultManager.getEntireSystemColl()).sub(A_entireColl_0)

    // Liquidate A
    // console.log(`ICR A: ${await vaultManager.getCurrentICR(A, price)}`)
    const txA = await vaultManager.liquidate(A)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(A))

    const A_collRedistribution = A_entireColl_0.mul(toBN(995)).div(toBN(1000)) // remove the gas comp

    // console.log(`A_collRedistribution: ${A_collRedistribution}`)
    // Check accumulated RBTC gain for each vault
    const B_RBTCGain_1 = await vaultManager.getPendingRBTCReward(B)
    const C_RBTCGain_1 = await vaultManager.getPendingRBTCReward(C)
    const D_RBTCGain_1 = await vaultManager.getPendingRBTCReward(D)
    const E_RBTCGain_1 = await vaultManager.getPendingRBTCReward(E)

    // Check gains are what we'd expect from a distribution proportional to each vault's entire coll
    const B_expectedPendingRBTC_1 = A_collRedistribution.mul(B_entireColl_0).div(denominatorColl_1)
    const C_expectedPendingRBTC_1 = A_collRedistribution.mul(C_entireColl_0).div(denominatorColl_1)
    const D_expectedPendingRBTC_1 = A_collRedistribution.mul(D_entireColl_0).div(denominatorColl_1)
    const E_expectedPendingRBTC_1 = A_collRedistribution.mul(E_entireColl_0).div(denominatorColl_1)

    assert.isAtMost(getDifference(B_expectedPendingRBTC_1, B_RBTCGain_1), 1e8)
    assert.isAtMost(getDifference(C_expectedPendingRBTC_1, C_RBTCGain_1), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingRBTC_1, D_RBTCGain_1), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingRBTC_1, E_RBTCGain_1), 1e8)

    // // Bob adds 1 RBTC to his vault
    await borrowerOperations.addColl(B, B, { from: B, value: dec(1, 'ether') })

    // Check entireColl for each vault
    const B_entireColl_1 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_1 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_1 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_1 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    // entireSystemColl, excluding C
    const denominatorColl_2 = (await vaultManager.getEntireSystemColl()).sub(C_entireColl_1)

    // Liquidate C
    const txC = await vaultManager.liquidate(C)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedVaults.contains(C))

    const C_collRedistribution = C_entireColl_1.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    // console.log(`C_collRedistribution: ${C_collRedistribution}`)

    const B_RBTCGain_2 = await vaultManager.getPendingRBTCReward(B)
    const D_RBTCGain_2 = await vaultManager.getPendingRBTCReward(D)
    const E_RBTCGain_2 = await vaultManager.getPendingRBTCReward(E)

    // Since B topped up, he has no previous pending RBTC gain
    const B_expectedPendingRBTC_2 = C_collRedistribution.mul(B_entireColl_1).div(denominatorColl_2)

    // D & E's accumulated pending RBTC gain includes their previous gain
    const D_expectedPendingRBTC_2 = C_collRedistribution.mul(D_entireColl_1).div(denominatorColl_2)
      .add(D_expectedPendingRBTC_1)

    const E_expectedPendingRBTC_2 = C_collRedistribution.mul(E_entireColl_1).div(denominatorColl_2)
      .add(E_expectedPendingRBTC_1)

    assert.isAtMost(getDifference(B_expectedPendingRBTC_2, B_RBTCGain_2), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingRBTC_2, D_RBTCGain_2), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingRBTC_2, E_RBTCGain_2), 1e8)

    // // Bob adds 1 RBTC to his vault
    await borrowerOperations.addColl(B, B, { from: B, value: dec(1, 'ether') })

    // Check entireColl for each vault
    const B_entireColl_2 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_2 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_2 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    // entireSystemColl, excluding E
    const denominatorColl_3 = (await vaultManager.getEntireSystemColl()).sub(E_entireColl_2)

    // Liquidate E
    const txE = await vaultManager.liquidate(E)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedVaults.contains(E))

    const E_collRedistribution = E_entireColl_2.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    // console.log(`E_collRedistribution: ${E_collRedistribution}`)

    const B_RBTCGain_3 = await vaultManager.getPendingRBTCReward(B)
    const D_RBTCGain_3 = await vaultManager.getPendingRBTCReward(D)

    // Since B topped up, he has no previous pending RBTC gain
    const B_expectedPendingRBTC_3 = E_collRedistribution.mul(B_entireColl_2).div(denominatorColl_3)

    // D'S accumulated pending RBTC gain includes their previous gain
    const D_expectedPendingRBTC_3 = E_collRedistribution.mul(D_entireColl_2).div(denominatorColl_3)
      .add(D_expectedPendingRBTC_2)

    assert.isAtMost(getDifference(B_expectedPendingRBTC_3, B_RBTCGain_3), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingRBTC_3, D_RBTCGain_3), 1e8)
  })

  it("redistribution: A,B,C Open. Liq(C). B adds coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open vaults
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await vaultManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedVaults.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds RBTC to his vault
    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(bob, bob, { from: bob, value: addedColl })

    // Alice withdraws BPD
    await borrowerOperations.withdrawBPD(th._100pct, await getNetBorrowingAmount(A_totalDebt), alice, alice, { from: alice })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txA = await vaultManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(alice))

    // Expect Bob now holds all Bitcoin and BPDDebt in the system: 2 + 0.4975+0.4975*0.995+0.995 Bitcoin and 110*3 BPD (10 each for gas compensation)
    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const bob_BPDDebt = ((await vaultManager.Vaults(bob))[0]
      .add(await vaultManager.getPendingBPDDebtReward(bob)))
      .toString()

    const expected_B_coll = B_coll
          .add(addedColl)
          .add(th.applyLiquidationFee(A_coll))
          .add(th.applyLiquidationFee(C_coll).mul(B_coll).div(A_coll.add(B_coll)))
          .add(th.applyLiquidationFee(th.applyLiquidationFee(C_coll).mul(A_coll).div(A_coll.add(B_coll))))
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_BPDDebt, A_totalDebt.mul(toBN(2)).add(B_totalDebt).add(C_totalDebt)), 1000)
  })

  it("redistribution: A,B,C Open. Liq(C). B tops up coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open vaults
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await vaultManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedVaults.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds RBTC to his vault
    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(bob, bob, { from: bob, value: addedColl })

    // D opens vault
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txA = await vaultManager.liquidate(dennis)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(dennis))

    /* Bob rewards:
     L1: 1/2*0.995 RBTC, 55 BPD
     L2: (2.4975/3.995)*0.995 = 0.622 RBTC , 110*(2.4975/3.995)= 68.77 BPDDebt

    coll: 3.1195 RBTC
    debt: 233.77 BPDDebt

     Alice rewards:
    L1 1/2*0.995 RBTC, 55 BPD
    L2 (1.4975/3.995)*0.995 = 0.3730 RBTC, 110*(1.4975/3.995) = 41.23 BPDDebt

    coll: 1.8705 RBTC
    debt: 146.23 BPDDebt

    totalColl: 4.99 RBTC
    totalDebt 380 BPD (includes 50 each for gas compensation)
    */
    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const bob_BPDDebt = ((await vaultManager.Vaults(bob))[0]
      .add(await vaultManager.getPendingBPDDebtReward(bob)))
      .toString()

    const alice_Coll = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()

    const alice_BPDDebt = ((await vaultManager.Vaults(alice))[0]
      .add(await vaultManager.getPendingBPDDebtReward(alice)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(addedColl).add(th.applyLiquidationFee(C_coll))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll))).add(addedColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_B_debt = B_totalDebt
          .add(B_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
          .add(B_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_BPDDebt, expected_B_debt), 10000)

    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_A_debt = A_totalDebt
          .add(A_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
          .add(A_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))
    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(alice_BPDDebt, expected_A_debt), 10000)

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Vault with the majority stake tops up. A,B,C, D open. Liq(D). C tops up. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Bitcoin = toBN('998000000000000000000')
    // A, B, C, D open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openVault({ extraBPDAmount: dec(110, 18), extraParams: { from: carol, value: _998_Bitcoin } })
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: dennis, value: dec(1000, 'ether') } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await vaultManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedVaults.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 RBTC, bob: 1 RBTC, carol: 998 RBTC
    const alice_RBTCReward_1 = await vaultManager.getPendingRBTCReward(alice)
    const bob_RBTCReward_1 = await vaultManager.getPendingRBTCReward(bob)
    const caroB_RBTCReward_1 = await vaultManager.getPendingRBTCReward(carol)

    //Expect 1000 + 1000*0.995 RBTC in system now
    const entireSystemColl_1 = (await activePool.getRBTC()).add(await defaultPool.getRBTC()).toString()
    assert.equal(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    th.assertIsApproximatelyEqual(alice_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(caroB_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    //Carol adds 1 RBTC to her vault, brings it to 1992.01 total coll
    const C_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(carol, carol, { from: carol, value: dec(1, 'ether') })

    //Expect 1996 RBTC in system now
    const entireSystemColl_2 = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).add(C_addedColl))

    // E opens with another 1996 RBTC
    const { collateral: E_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: erin, value: entireSystemColl_2 } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await vaultManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedVaults.contains(erin))

    /* Expected RBTC rewards: 
     Carol = 1992.01/1996 * 1996*0.995 = 1982.05 RBTC
     Alice = 1.995/1996 * 1996*0.995 = 1.985025 RBTC
     Bob = 1.995/1996 * 1996*0.995 = 1.985025 RBTC

    therefore, expected total collateral:

    Carol = 1991.01 + 1991.01 = 3974.06
    Alice = 1.995 + 1.985025 = 3.980025 RBTC
    Bob = 1.995 + 1.985025 = 3.980025 RBTC

    total = 3982.02 RBTC
    */

    const alice_Coll = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()

    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const carol_Coll = ((await vaultManager.Vaults(carol))[1]
      .add(await vaultManager.getPendingRBTCReward(carol)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).add(C_addedColl)
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(C_addedColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    //Expect 3982.02 RBTC in system now
    const entireSystemColl_3 = (await activePool.getRBTC()).add(await defaultPool.getRBTC()).toString()
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))

    // check BPD gas compensation
    th.assertIsApproximatelyEqual((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Vault with the majority stake tops up. A,B,C, D open. Liq(D). A, B, C top up. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Bitcoin = toBN('998000000000000000000')
    // A, B, C open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openVault({ extraBPDAmount: dec(110, 18), extraParams: { from: carol, value: _998_Bitcoin } })
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: dennis, value: dec(1000, 'ether') } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await vaultManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedVaults.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 RBTC, bob: 1 RBTC, carol: 998 RBTC (*0.995)
    const alice_RBTCReward_1 = await vaultManager.getPendingRBTCReward(alice)
    const bob_RBTCReward_1 = await vaultManager.getPendingRBTCReward(bob)
    const caroB_RBTCReward_1 = await vaultManager.getPendingRBTCReward(carol)

    //Expect 1995 RBTC in system now
    const entireSystemColl_1 = (await activePool.getRBTC()).add(await defaultPool.getRBTC()).toString()
    assert.equal(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    th.assertIsApproximatelyEqual(alice_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(caroB_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    /* Alice, Bob, Carol each adds 1 RBTC to their vaults, 
    bringing them to 2.995, 2.995, 1992.01 total coll each. */

    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(alice, alice, { from: alice, value: addedColl })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: addedColl })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: addedColl })

    //Expect 1998 RBTC in system now
    const entireSystemColl_2 = (await activePool.getRBTC()).add(await defaultPool.getRBTC()).toString()
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).add(addedColl.mul(toBN(3))))

    // E opens with another 1998 RBTC
    const { collateral: E_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: erin, value: entireSystemColl_2 } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await vaultManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedVaults.contains(erin))

    /* Expected RBTC rewards: 
     Carol = 1992.01/1998 * 1998*0.995 = 1982.04995 RBTC
     Alice = 2.995/1998 * 1998*0.995 = 2.980025 RBTC
     Bob = 2.995/1998 * 1998*0.995 = 2.980025 RBTC

    therefore, expected total collateral:

    Carol = 1992.01 + 1982.04995 = 3974.05995
    Alice = 2.995 + 2.980025 = 5.975025 RBTC
    Bob = 2.995 + 2.980025 = 5.975025 RBTC

    total = 3986.01 RBTC
    */

    const alice_Coll = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()

    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const carol_Coll = ((await vaultManager.Vaults(carol))[1]
      .add(await vaultManager.getPendingRBTCReward(carol)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).add(addedColl.mul(toBN(3)))
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    //Expect 3986.01 RBTC in system now
    const entireSystemColl_3 = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))

    // check BPD gas compensation
    th.assertIsApproximatelyEqual((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  // --- Vault withdraws collateral ---

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open vaults
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await vaultManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedVaults.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob withdraws 0.5 RBTC from his vault
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.withdrawColl(withdrawnColl, bob, bob, { from: bob })

    // Alice withdraws BPD
    await borrowerOperations.withdrawBPD(th._100pct, await getNetBorrowingAmount(A_totalDebt), alice, alice, { from: alice })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txA = await vaultManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(alice))

    // Expect Bob now holds all Bitcoin and BPDDebt in the system: 2.5 Bitcoin and 300 BPD
    // 1 + 0.995/2 - 0.5 + 1.4975*0.995
    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const bob_BPDDebt = ((await vaultManager.Vaults(bob))[0]
      .add(await vaultManager.getPendingBPDDebtReward(bob)))
      .toString()

    const expected_B_coll = B_coll
          .sub(withdrawnColl)
          .add(th.applyLiquidationFee(A_coll))
          .add(th.applyLiquidationFee(C_coll).mul(B_coll).div(A_coll.add(B_coll)))
          .add(th.applyLiquidationFee(th.applyLiquidationFee(C_coll).mul(A_coll).div(A_coll.add(B_coll))))
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_BPDDebt, A_totalDebt.mul(toBN(2)).add(B_totalDebt).add(C_totalDebt)), 1000)

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open vaults
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await vaultManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedVaults.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob  withdraws 0.5 RBTC from his vault
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.withdrawColl(withdrawnColl, bob, bob, { from: bob })

    // D opens vault
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txA = await vaultManager.liquidate(dennis)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(dennis))

    /* Bob rewards:
     L1: 0.4975 RBTC, 55 BPD
     L2: (0.9975/2.495)*0.995 = 0.3978 RBTC , 110*(0.9975/2.495)= 43.98 BPDDebt

    coll: (1 + 0.4975 - 0.5 + 0.3968) = 1.3953 RBTC
    debt: (110 + 55 + 43.98 = 208.98 BPDDebt 

     Alice rewards:
    L1 0.4975, 55 BPD
    L2 (1.4975/2.495)*0.995 = 0.5972 RBTC, 110*(1.4975/2.495) = 66.022 BPDDebt

    coll: (1 + 0.4975 + 0.5972) = 2.0947 RBTC
    debt: (50 + 55 + 66.022) = 171.022 BPD Debt

    totalColl: 3.49 RBTC
    totalDebt 380 BPD (Includes 50 in each vault for gas compensation)
    */
    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const bob_BPDDebt = ((await vaultManager.Vaults(bob))[0]
      .add(await vaultManager.getPendingBPDDebtReward(bob)))
      .toString()

    const alice_Coll = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()

    const alice_BPDDebt = ((await vaultManager.Vaults(alice))[0]
      .add(await vaultManager.getPendingBPDDebtReward(alice)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).sub(withdrawnColl).add(th.applyLiquidationFee(C_coll))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll))).sub(withdrawnColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_B_debt = B_totalDebt
          .add(B_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
          .add(B_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_BPDDebt, expected_B_debt), 10000)

    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_A_debt = A_totalDebt
          .add(A_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
          .add(A_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))
    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(alice_BPDDebt, expected_A_debt), 10000)

    const entireSystemColl = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl, A_coll.add(B_coll).add(th.applyLiquidationFee(C_coll)).sub(withdrawnColl).add(th.applyLiquidationFee(D_coll)))
    const entireSystemDebt = (await activePool.getBPDDebt()).add(await defaultPool.getBPDDebt())
    th.assertIsApproximatelyEqual(entireSystemDebt, A_totalDebt.add(B_totalDebt).add(C_totalDebt).add(D_totalDebt))

    // check BPD gas compensation
    th.assertIsApproximatelyEqual((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Vault with the majority stake withdraws. A,B,C,D open. Liq(D). C withdraws some coll. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Bitcoin = toBN('998000000000000000000')
    // A, B, C, D open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openVault({ extraBPDAmount: dec(110, 18), extraParams: { from: carol, value: _998_Bitcoin } })
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: dennis, value: dec(1000, 'ether') } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await vaultManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedVaults.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 RBTC, bob: 1 RBTC, carol: 998 RBTC (*0.995)
    const alice_RBTCReward_1 = await vaultManager.getPendingRBTCReward(alice)
    const bob_RBTCReward_1 = await vaultManager.getPendingRBTCReward(bob)
    const caroB_RBTCReward_1 = await vaultManager.getPendingRBTCReward(carol)

    //Expect 1995 RBTC in system now
    const entireSystemColl_1 = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    th.assertIsApproximatelyEqual(alice_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(caroB_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    //Carol wthdraws 1 RBTC from her vault, brings it to 1990.01 total coll
    const C_withdrawnColl = toBN(dec(1, 'ether'))
    await borrowerOperations.withdrawColl(C_withdrawnColl, carol, carol, { from: carol })

    //Expect 1994 RBTC in system now
    const entireSystemColl_2 = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).sub(C_withdrawnColl))

    // E opens with another 1994 RBTC
    const { collateral: E_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: erin, value: entireSystemColl_2 } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await vaultManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedVaults.contains(erin))

    /* Expected RBTC rewards: 
     Carol = 1990.01/1994 * 1994*0.995 = 1980.05995 RBTC
     Alice = 1.995/1994 * 1994*0.995 = 1.985025 RBTC
     Bob = 1.995/1994 * 1994*0.995 = 1.985025 RBTC

    therefore, expected total collateral:

    Carol = 1990.01 + 1980.05995 = 3970.06995
    Alice = 1.995 + 1.985025 = 3.980025 RBTC
    Bob = 1.995 + 1.985025 = 3.980025 RBTC

    total = 3978.03 RBTC
    */

    const alice_Coll = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()

    const bob_Coll = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const carol_Coll = ((await vaultManager.Vaults(carol))[1]
      .add(await vaultManager.getPendingRBTCReward(carol)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).sub(C_withdrawnColl)
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(C_withdrawnColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    //Expect 3978.03 RBTC in system now
    const entireSystemColl_3 = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  it("redistribution: Vault with the majority stake withdraws. A,B,C,D open. Liq(D). A, B, C withdraw. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Bitcoin = toBN('998000000000000000000')
    // A, B, C, D open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openVault({ extraBPDAmount: dec(110, 18), extraParams: { from: carol, value: _998_Bitcoin } })
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: dennis, value: dec(1000, 'ether') } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await vaultManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedVaults.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 RBTC, bob: 1 RBTC, carol: 998 RBTC (*0.995)
    const alice_RBTCReward_1 = await vaultManager.getPendingRBTCReward(alice)
    const bob_RBTCReward_1 = await vaultManager.getPendingRBTCReward(bob)
    const caroB_RBTCReward_1 = await vaultManager.getPendingRBTCReward(carol)

    //Expect 1995 RBTC in system now
    const entireSystemColl_1 = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    th.assertIsApproximatelyEqual(alice_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(caroB_RBTCReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    /* Alice, Bob, Carol each withdraw 0.5 RBTC to their vaults, 
    bringing them to 1.495, 1.495, 1990.51 total coll each. */
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.withdrawColl(withdrawnColl, alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(withdrawnColl, bob, bob, { from: bob })
    await borrowerOperations.withdrawColl(withdrawnColl, carol, carol, { from: carol })

    const alice_Coll_1 = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()

    const bob_Coll_1 = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const carol_Coll_1 = ((await vaultManager.Vaults(carol))[1]
      .add(await vaultManager.getPendingRBTCReward(carol)))
      .toString()

    const totalColl_1 = A_coll.add(B_coll).add(C_coll)
    assert.isAtMost(th.getDifference(alice_Coll_1, A_coll.add(th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_1, B_coll.add(th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_1, C_coll.add(th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)

    //Expect 1993.5 RBTC in system now
    const entireSystemColl_2 = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).sub(withdrawnColl.mul(toBN(3))))

    // E opens with another 1993.5 RBTC
    const { collateral: E_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: erin, value: entireSystemColl_2 } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await vaultManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedVaults.contains(erin))

    /* Expected RBTC rewards: 
     Carol = 1990.51/1993.5 * 1993.5*0.995 = 1980.55745 RBTC
     Alice = 1.495/1993.5 * 1993.5*0.995 = 1.487525 RBTC
     Bob = 1.495/1993.5 * 1993.5*0.995 = 1.487525 RBTC

    therefore, expected total collateral:

    Carol = 1990.51 + 1980.55745 = 3971.06745
    Alice = 1.495 + 1.487525 = 2.982525 RBTC
    Bob = 1.495 + 1.487525 = 2.982525 RBTC

    total = 3977.0325 RBTC
    */

    const alice_Coll_2 = ((await vaultManager.Vaults(alice))[1]
      .add(await vaultManager.getPendingRBTCReward(alice)))
      .toString()

    const bob_Coll_2 = ((await vaultManager.Vaults(bob))[1]
      .add(await vaultManager.getPendingRBTCReward(bob)))
      .toString()

    const carol_Coll_2 = ((await vaultManager.Vaults(carol))[1]
      .add(await vaultManager.getPendingRBTCReward(carol)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).sub(withdrawnColl.mul(toBN(3)))
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    assert.isAtMost(th.getDifference(alice_Coll_2, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_2, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_2, expected_C_coll), 1000)

    //Expect 3977.0325 RBTC in system now
    const entireSystemColl_3 = (await activePool.getRBTC()).add(await defaultPool.getRBTC())
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

  // For calculations of correct values used in test, see scenario 1:
  // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Distributes correct rewards", async () => {
    // A, B, C open vaults
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: alice } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: carol } })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate A
    const txA = await vaultManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(alice))

    // Check rewards for B and C
    const B_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(B_coll).div(B_coll.add(C_coll))
    const C_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(C_coll).div(B_coll.add(C_coll))
    assert.isAtMost(th.getDifference(await vaultManager.getPendingRBTCReward(bob), B_pendingRewardsAfterL1), 1000000)
    assert.isAtMost(th.getDifference(await vaultManager.getPendingRBTCReward(carol), C_pendingRewardsAfterL1), 1000000)

    const totalStakesSnapshotAfterL1 = B_coll.add(C_coll)
    const totalCollateralSnapshotAfterL1 = totalStakesSnapshotAfterL1.add(th.applyLiquidationFee(A_coll))
    th.assertIsApproximatelyEqual(await vaultManager.totalStakesSnapshot(), totalStakesSnapshotAfterL1)
    th.assertIsApproximatelyEqual(await vaultManager.totalCollateralSnapshot(), totalCollateralSnapshotAfterL1)

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // D opens vault
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: dennis } })

    //Bob adds 1 RBTC to his vault
    const B_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(bob, bob, { from: bob, value: B_addedColl })

    //Carol  withdraws 1 RBTC from her vault
    const C_withdrawnColl = toBN(dec(1, 'ether'))
    await borrowerOperations.withdrawColl(C_withdrawnColl, carol, carol, { from: carol })

    const B_collAfterL1 = B_coll.add(B_pendingRewardsAfterL1).add(B_addedColl)
    const C_collAfterL1 = C_coll.add(C_pendingRewardsAfterL1).sub(C_withdrawnColl)

    // Price drops
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate B
    const txB = await vaultManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedVaults.contains(bob))

    // Check rewards for C and D
    const C_pendingRewardsAfterL2 = C_collAfterL1.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const D_pendingRewardsAfterL2 = D_coll.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    assert.isAtMost(th.getDifference(await vaultManager.getPendingRBTCReward(carol), C_pendingRewardsAfterL2), 1000000)
    assert.isAtMost(th.getDifference(await vaultManager.getPendingRBTCReward(dennis), D_pendingRewardsAfterL2), 1000000)

    const totalStakesSnapshotAfterL2 = totalStakesSnapshotAfterL1.add(D_coll.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1)).sub(B_coll).sub(C_withdrawnColl.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1))
    const defaultedAmountAfterL2 = th.applyLiquidationFee(B_coll.add(B_addedColl).add(B_pendingRewardsAfterL1)).add(C_pendingRewardsAfterL1)
    const totalCollateralSnapshotAfterL2 = C_coll.sub(C_withdrawnColl).add(D_coll).add(defaultedAmountAfterL2)
    th.assertIsApproximatelyEqual(await vaultManager.totalStakesSnapshot(), totalStakesSnapshotAfterL2)
    th.assertIsApproximatelyEqual(await vaultManager.totalCollateralSnapshot(), totalCollateralSnapshotAfterL2)

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // E and F open vaults
    const { collateral: E_coll, totalDebt: E_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: erin } })
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(110, 18), extraParams: { from: freddy } })

    // D tops up
    const D_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: D_addedColl })

    // Price drops to 1
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate F
    const txF = await vaultManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedVaults.contains(freddy))

    // Grab remaining vaults' collateral
    const carol_rawColl = (await vaultManager.Vaults(carol))[1].toString()
    const carol_pendingRBTCReward = (await vaultManager.getPendingRBTCReward(carol)).toString()

    const dennis_rawColl = (await vaultManager.Vaults(dennis))[1].toString()
    const dennis_pendingRBTCReward = (await vaultManager.getPendingRBTCReward(dennis)).toString()

    const erin_rawColl = (await vaultManager.Vaults(erin))[1].toString()
    const erin_pendingRBTCReward = (await vaultManager.getPendingRBTCReward(erin)).toString()

    // Check raw collateral of C, D, E
    const C_collAfterL2 = C_collAfterL1.add(C_pendingRewardsAfterL2)
    const D_collAfterL2 = D_coll.add(D_pendingRewardsAfterL2).add(D_addedColl)
    const totalCollForL3 = C_collAfterL2.add(D_collAfterL2).add(E_coll)
    const C_collAfterL3 = C_collAfterL2.add(C_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const D_collAfterL3 = D_collAfterL2.add(D_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const E_collAfterL3 = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    assert.isAtMost(th.getDifference(carol_rawColl, C_collAfterL1), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl, D_collAfterL2), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, E_coll), 1000)

    // Check pending RBTC rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingRBTCReward, C_collAfterL3.sub(C_collAfterL1)), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingRBTCReward, D_collAfterL3.sub(D_collAfterL2)), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingRBTCReward, E_collAfterL3.sub(E_coll)), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getRBTC()).toString()
    const defaultColl = (await defaultPool.getRBTC()).toString()

    assert.isAtMost(th.getDifference(activeColl, C_collAfterL1.add(D_collAfterL2.add(E_coll))), 1000000)
    assert.isAtMost(th.getDifference(defaultColl, C_collAfterL3.sub(C_collAfterL1).add(D_collAfterL3.sub(D_collAfterL2)).add(E_collAfterL3.sub(E_coll))), 1000000)

    // Check system snapshots
    const totalStakesSnapshotAfterL3 = totalStakesSnapshotAfterL2.add(D_addedColl.add(E_coll).mul(totalStakesSnapshotAfterL2).div(totalCollateralSnapshotAfterL2))
    const totalCollateralSnapshotAfterL3 = C_coll.sub(C_withdrawnColl).add(D_coll).add(D_addedColl).add(E_coll).add(defaultedAmountAfterL2).add(th.applyLiquidationFee(F_coll))
    const totalStakesSnapshot = (await vaultManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot = (await vaultManager.totalCollateralSnapshot()).toString()
    th.assertIsApproximatelyEqual(totalStakesSnapshot, totalStakesSnapshotAfterL3)
    th.assertIsApproximatelyEqual(totalCollateralSnapshot, totalCollateralSnapshotAfterL3)

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(600, 18))
  })

  // For calculations of correct values used in test, see scenario 2:
  // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Varying coll. Distributes correct rewards", async () => {
    /* A, B, C open vaults.
    A: 450 RBTC
    B: 8901 RBTC
    C: 23.902 RBTC
    */
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(90000, 16)), extraParams: { from: alice, value: toBN('450000000000000000000') } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(1800000, 16)), extraParams: { from: bob, value: toBN('8901000000000000000000') } })
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(4600, 16)), extraParams: { from: carol, value: toBN('23902000000000000000') } })

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate A
    const txA = await vaultManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedVaults.contains(alice))

    // Check rewards for B and C
    const B_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(B_coll).div(B_coll.add(C_coll))
    const C_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(C_coll).div(B_coll.add(C_coll))
    assert.isAtMost(th.getDifference(await vaultManager.getPendingRBTCReward(bob), B_pendingRewardsAfterL1), 1000000)
    assert.isAtMost(th.getDifference(await vaultManager.getPendingRBTCReward(carol), C_pendingRewardsAfterL1), 1000000)

    const totalStakesSnapshotAfterL1 = B_coll.add(C_coll)
    const totalCollateralSnapshotAfterL1 = totalStakesSnapshotAfterL1.add(th.applyLiquidationFee(A_coll))
    th.assertIsApproximatelyEqual(await vaultManager.totalStakesSnapshot(), totalStakesSnapshotAfterL1)
    th.assertIsApproximatelyEqual(await vaultManager.totalCollateralSnapshot(), totalCollateralSnapshotAfterL1)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    // D opens vault: 0.035 RBTC
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openVault({ extraBPDAmount: dec(100, 18), extraParams: { from: dennis, value: toBN(dec(35, 15)) } })

    // Bob adds 11.33909 RBTC to his vault
    const B_addedColl = toBN('11339090000000000000')
    await borrowerOperations.addColl(bob, bob, { from: bob, value: B_addedColl })

    // Carol withdraws 15 RBTC from her vault
    const C_withdrawnColl = toBN(dec(15, 'ether'))
    await borrowerOperations.withdrawColl(C_withdrawnColl, carol, carol, { from: carol })

    const B_collAfterL1 = B_coll.add(B_pendingRewardsAfterL1).add(B_addedColl)
    const C_collAfterL1 = C_coll.add(C_pendingRewardsAfterL1).sub(C_withdrawnColl)

    // Price drops
    await priceFeed.setPrice('1')

    // Liquidate B
    const txB = await vaultManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedVaults.contains(bob))

    // Check rewards for C and D
    const C_pendingRewardsAfterL2 = C_collAfterL1.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const D_pendingRewardsAfterL2 = D_coll.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const C_collAfterL2 = C_collAfterL1.add(C_pendingRewardsAfterL2)
    assert.isAtMost(th.getDifference(await vaultManager.getPendingRBTCReward(carol), C_pendingRewardsAfterL2), 10000000)
    assert.isAtMost(th.getDifference(await vaultManager.getPendingRBTCReward(dennis), D_pendingRewardsAfterL2), 10000000)

    const totalStakesSnapshotAfterL2 = totalStakesSnapshotAfterL1.add(D_coll.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1)).sub(B_coll).sub(C_withdrawnColl.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1))
    const defaultedAmountAfterL2 = th.applyLiquidationFee(B_coll.add(B_addedColl).add(B_pendingRewardsAfterL1)).add(C_pendingRewardsAfterL1)
    const totalCollateralSnapshotAfterL2 = C_coll.sub(C_withdrawnColl).add(D_coll).add(defaultedAmountAfterL2)
    th.assertIsApproximatelyEqual(await vaultManager.totalStakesSnapshot(), totalStakesSnapshotAfterL2)
    th.assertIsApproximatelyEqual(await vaultManager.totalCollateralSnapshot(), totalCollateralSnapshotAfterL2)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    /* E and F open vaults.
    E: 10000 RBTC
    F: 0.0007 RBTC
    */
    const { collateral: E_coll, totalDebt: E_totalDebt } = await openVault({ extraBPDAmount: dec(100, 18), extraParams: { from: erin, value: toBN(dec(1, 22)) } })
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openVault({ extraBPDAmount: dec(100, 18), extraParams: { from: freddy, value: toBN('700000000000000') } })

    // D tops up
    const D_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: D_addedColl })

    const D_collAfterL2 = D_coll.add(D_pendingRewardsAfterL2).add(D_addedColl)

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate F
    const txF = await vaultManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedVaults.contains(freddy))

    // Grab remaining vaults' collateral
    const carol_rawColl = (await vaultManager.Vaults(carol))[1].toString()
    const carol_pendingRBTCReward = (await vaultManager.getPendingRBTCReward(carol)).toString()
    const carol_Stake = (await vaultManager.Vaults(carol))[2].toString()

    const dennis_rawColl = (await vaultManager.Vaults(dennis))[1].toString()
    const dennis_pendingRBTCReward = (await vaultManager.getPendingRBTCReward(dennis)).toString()
    const dennis_Stake = (await vaultManager.Vaults(dennis))[2].toString()

    const erin_rawColl = (await vaultManager.Vaults(erin))[1].toString()
    const erin_pendingRBTCReward = (await vaultManager.getPendingRBTCReward(erin)).toString()
    const erin_Stake = (await vaultManager.Vaults(erin))[2].toString()

    // Check raw collateral of C, D, E
    const totalCollForL3 = C_collAfterL2.add(D_collAfterL2).add(E_coll)
    const C_collAfterL3 = C_collAfterL2.add(C_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const D_collAfterL3 = D_collAfterL2.add(D_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const E_collAfterL3 = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    assert.isAtMost(th.getDifference(carol_rawColl, C_collAfterL1), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl, D_collAfterL2), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, E_coll), 1000)

    // Check pending RBTC rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingRBTCReward, C_collAfterL3.sub(C_collAfterL1)), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingRBTCReward, D_collAfterL3.sub(D_collAfterL2)), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingRBTCReward, E_collAfterL3.sub(E_coll)), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getRBTC()).toString()
    const defaultColl = (await defaultPool.getRBTC()).toString()

    assert.isAtMost(th.getDifference(activeColl, C_collAfterL1.add(D_collAfterL2.add(E_coll))), 1000000)
    assert.isAtMost(th.getDifference(defaultColl, C_collAfterL3.sub(C_collAfterL1).add(D_collAfterL3.sub(D_collAfterL2)).add(E_collAfterL3.sub(E_coll))), 1000000)

    // Check system snapshots
    const totalStakesSnapshotAfterL3 = totalStakesSnapshotAfterL2.add(D_addedColl.add(E_coll).mul(totalStakesSnapshotAfterL2).div(totalCollateralSnapshotAfterL2))
    const totalCollateralSnapshotAfterL3 = C_coll.sub(C_withdrawnColl).add(D_coll).add(D_addedColl).add(E_coll).add(defaultedAmountAfterL2).add(th.applyLiquidationFee(F_coll))
    const totalStakesSnapshot = (await vaultManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot = (await vaultManager.totalCollateralSnapshot()).toString()
    th.assertIsApproximatelyEqual(totalStakesSnapshot, totalStakesSnapshotAfterL3)
    th.assertIsApproximatelyEqual(totalCollateralSnapshot, totalCollateralSnapshotAfterL3)

    // check BPD gas compensation
    assert.equal((await bpdToken.balanceOf(owner)).toString(), dec(600, 18))
  })
})
