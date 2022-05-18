const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const MPStakingTester = artifacts.require('MPStakingTester')
const VaultManagerTester = artifacts.require("VaultManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

/* NOTE: These tests do not test for specific RBTC and BPD gain values. They only test that the 
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific RBTC/BPD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the VaultManager, which are still TBD based on economic
 * modelling.
 * 
 */ 

contract('MPStaking revenue share tests', async accounts => {

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let priceFeed
  let bpdToken
  let sortedVaults
  let vaultManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let mpStaking
  let mpToken

  let contracts

  const openVault = async (params) => th.openVault(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployMoneypCore()
    contracts.vaultManager = await VaultManagerTester.new()
    contracts = await deploymentHelper.deployBPDTokenTester(contracts)
    const MPContracts = await deploymentHelper.deployMPTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
    
    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)

    nonPayable = await NonPayable.new() 
    priceFeed = contracts.priceFeedTestnet
    bpdToken = contracts.bpdToken
    sortedVaults = contracts.sortedVaults
    vaultManager = contracts.vaultManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    mpToken = MPContracts.mpToken
    mpStaking = MPContracts.mpStaking
  })

  it('stake(): reverts if amount is zero', async () => {
    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A mp bal: ${await mpToken.balanceOf(A)}`)

    // A makes stake
    await mpToken.approve(mpStaking.address, dec(100, 18), {from: A})
    await assertRevert(mpStaking.stake(0, {from: A}), "MPStaking: Amount must be non-zero")
  })

  it("RBTC fee per MP staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A mp bal: ${await mpToken.balanceOf(A)}`)

    // A makes stake
    await mpToken.approve(mpStaking.address, dec(100, 18), {from: A})
    await mpStaking.stake(dec(100, 18), {from: A})

    // Check RBTC fee per unit staked is zero
    const F_RBTC_Before = await mpStaking.F_RBTC()
    assert.equal(F_RBTC_Before, '0')

    const B_BalBeforeREdemption = await bpdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await bpdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check RBTC fee emitted in event is non-zero
    const emittedRBTCFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedRBTCFee.gt(toBN('0')))

    // Check RBTC fee per unit staked has increased by correct amount
    const F_RBTC_After = await mpStaking.F_RBTC()

    // Expect fee per unit staked = fee/100, since there is 100 BPD totalStaked
    const expected_F_RBTC_After = emittedRBTCFee.div(toBN('100')) 

    assert.isTrue(expected_F_RBTC_After.eq(F_RBTC_After))
  })

  it("RBTC fee per MP staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // Check RBTC fee per unit staked is zero
    const F_RBTC_Before = await mpStaking.F_RBTC()
    assert.equal(F_RBTC_Before, '0')

    const B_BalBeforeREdemption = await bpdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await bpdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check RBTC fee emitted in event is non-zero
    const emittedRBTCFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedRBTCFee.gt(toBN('0')))

    // Check RBTC fee per unit staked has not increased 
    const F_RBTC_After = await mpStaking.F_RBTC()
    assert.equal(F_RBTC_After, '0')
  })

  it("BPD fee per MP staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await mpToken.approve(mpStaking.address, dec(100, 18), {from: A})
    await mpStaking.stake(dec(100, 18), {from: A})

    // Check BPD fee per unit staked is zero
    const F_BPD_Before = await mpStaking.F_RBTC()
    assert.equal(F_BPD_Before, '0')

    const B_BalBeforeREdemption = await bpdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await bpdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await vaultManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawBPD(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check BPD fee value in event is non-zero
    const emittedBPDFee = toBN(th.getBPDFeeFromBPDBorrowingEvent(tx))
    assert.isTrue(emittedBPDFee.gt(toBN('0')))
    
    // Check BPD fee per unit staked has increased by correct amount
    const F_BPD_After = await mpStaking.F_BPD()

    // Expect fee per unit staked = fee/100, since there is 100 BPD totalStaked
    const expected_F_BPD_After = emittedBPDFee.div(toBN('100')) 

    assert.isTrue(expected_F_BPD_After.eq(F_BPD_After))
  })

  it("BPD fee per MP staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // Check BPD fee per unit staked is zero
    const F_BPD_Before = await mpStaking.F_RBTC()
    assert.equal(F_BPD_Before, '0')

    const B_BalBeforeREdemption = await bpdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await bpdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await vaultManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawBPD(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check BPD fee value in event is non-zero
    const emittedBPDFee = toBN(th.getBPDFeeFromBPDBorrowingEvent(tx))
    assert.isTrue(emittedBPDFee.gt(toBN('0')))
    
    // Check BPD fee per unit staked did not increase, is still zero
    const F_BPD_After = await mpStaking.F_BPD()
    assert.equal(F_BPD_After, '0')
  })

  it("MP Staking: A single staker earns all RBTC and MP fees that occur", async () => {
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await mpToken.approve(mpStaking.address, dec(100, 18), {from: A})
    await mpStaking.stake(dec(100, 18), {from: A})

    const B_BalBeforeREdemption = await bpdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await bpdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check RBTC fee 1 emitted in event is non-zero
    const emittedRBTCFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedRBTCFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await bpdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await bpdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check RBTC fee 2 emitted in event is non-zero
     const emittedRBTCFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedRBTCFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawBPD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check BPD fee value in event is non-zero
    const emittedBPDFee_1 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedBPDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawBPD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check BPD fee value in event is non-zero
    const emittedBPDFee_2 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedBPDFee_2.gt(toBN('0')))

    const expectedTotalRBTCGain = emittedRBTCFee_1.add(emittedRBTCFee_2)
    const expectedTotalBPDGain = emittedBPDFee_1.add(emittedBPDFee_2)

    const A_RBTCBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_BPDBalance_Before = toBN(await bpdToken.balanceOf(A))

    // A un-stakes
    await mpStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})

    const A_RBTCBalance_After = toBN(await web3.eth.getBalance(A))
    const A_BPDBalance_After = toBN(await bpdToken.balanceOf(A))


    const A_RBTCGain = A_RBTCBalance_After.sub(A_RBTCBalance_Before)
    const A_BPDGain = A_BPDBalance_After.sub(A_BPDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalRBTCGain, A_RBTCGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalBPDGain, A_BPDGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated RBTC and BPD gains to the staker", async () => { 
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await mpToken.approve(mpStaking.address, dec(100, 18), {from: A})
    await mpStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await bpdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await bpdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check RBTC fee 1 emitted in event is non-zero
    const emittedRBTCFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedRBTCFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await bpdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await bpdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check RBTC fee 2 emitted in event is non-zero
     const emittedRBTCFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedRBTCFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawBPD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check BPD fee value in event is non-zero
    const emittedBPDFee_1 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedBPDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawBPD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check BPD fee value in event is non-zero
    const emittedBPDFee_2 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedBPDFee_2.gt(toBN('0')))

    const expectedTotalRBTCGain = emittedRBTCFee_1.add(emittedRBTCFee_2)
    const expectedTotalBPDGain = emittedBPDFee_1.add(emittedBPDFee_2)

    const A_RBTCBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_BPDBalance_Before = toBN(await bpdToken.balanceOf(A))

    // A tops up
    await mpStaking.stake(dec(50, 18), {from: A, gasPrice: 0})

    const A_RBTCBalance_After = toBN(await web3.eth.getBalance(A))
    const A_BPDBalance_After = toBN(await bpdToken.balanceOf(A))

    const A_RBTCGain = A_RBTCBalance_After.sub(A_RBTCBalance_Before)
    const A_BPDGain = A_BPDBalance_After.sub(A_BPDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalRBTCGain, A_RBTCGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalBPDGain, A_BPDGain), 1000)
  })

  it("getPendingRBTCGain(): Returns the staker's correct pending RBTC gain", async () => { 
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await mpToken.approve(mpStaking.address, dec(100, 18), {from: A})
    await mpStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await bpdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await bpdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check RBTC fee 1 emitted in event is non-zero
    const emittedRBTCFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedRBTCFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await bpdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await bpdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check RBTC fee 2 emitted in event is non-zero
     const emittedRBTCFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedRBTCFee_2.gt(toBN('0')))

    const expectedTotalRBTCGain = emittedRBTCFee_1.add(emittedRBTCFee_2)

    const A_RBTCGain = await mpStaking.getPendingRBTCGain(A)

    assert.isAtMost(th.getDifference(expectedTotalRBTCGain, A_RBTCGain), 1000)
  })

  it("getPendingBPDGain(): Returns the staker's correct pending BPD gain", async () => { 
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A
    await mpToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await mpToken.approve(mpStaking.address, dec(100, 18), {from: A})
    await mpStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await bpdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await bpdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check RBTC fee 1 emitted in event is non-zero
    const emittedRBTCFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedRBTCFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await bpdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await bpdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check RBTC fee 2 emitted in event is non-zero
     const emittedRBTCFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedRBTCFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawBPD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check BPD fee value in event is non-zero
    const emittedBPDFee_1 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedBPDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawBPD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check BPD fee value in event is non-zero
    const emittedBPDFee_2 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedBPDFee_2.gt(toBN('0')))

    const expectedTotalBPDGain = emittedBPDFee_1.add(emittedBPDFee_2)
    const A_BPDGain = await mpStaking.getPendingBPDGain(A)

    assert.isAtMost(th.getDifference(expectedTotalBPDGain, A_BPDGain), 1000)
  })

  // - multi depositors, several rewards
  it("MP Staking: Multiple stakers earn the correct share of all RBTC and MP fees, based on their stake size", async () => {
    await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: G } })

    // FF time one year so owner can transfer MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A, B, C
    await mpToken.transfer(A, dec(100, 18), {from: multisig})
    await mpToken.transfer(B, dec(200, 18), {from: multisig})
    await mpToken.transfer(C, dec(300, 18), {from: multisig})

    // A, B, C make stake
    await mpToken.approve(mpStaking.address, dec(100, 18), {from: A})
    await mpToken.approve(mpStaking.address, dec(200, 18), {from: B})
    await mpToken.approve(mpStaking.address, dec(300, 18), {from: C})
    await mpStaking.stake(dec(100, 18), {from: A})
    await mpStaking.stake(dec(200, 18), {from: B})
    await mpStaking.stake(dec(300, 18), {from: C})

    // Confirm staking contract holds 600 MP
    // console.log(`mp staking MP bal: ${await mpToken.balanceOf(mpStaking.address)}`)
    assert.equal(await mpToken.balanceOf(mpStaking.address), dec(600, 18))
    assert.equal(await mpStaking.totalMPStaked(), dec(600, 18))

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(F, contracts, dec(45, 18))
    const emittedRBTCFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedRBTCFee_1.gt(toBN('0')))

     // G redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18))
     const emittedRBTCFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedRBTCFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawBPD(th._100pct, dec(104, 18), F, F, {from: F})
    const emittedBPDFee_1 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedBPDFee_1.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawBPD(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedBPDFee_2 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedBPDFee_2.gt(toBN('0')))

    // D obtains MP from owner and makes a stake
    await mpToken.transfer(D, dec(50, 18), {from: multisig})
    await mpToken.approve(mpStaking.address, dec(50, 18), {from: D})
    await mpStaking.stake(dec(50, 18), {from: D})

    // Confirm staking contract holds 650 MP
    assert.equal(await mpToken.balanceOf(mpStaking.address), dec(650, 18))
    assert.equal(await mpStaking.totalMPStaked(), dec(650, 18))

     // G redeems
     const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18))
     const emittedRBTCFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
     assert.isTrue(emittedRBTCFee_3.gt(toBN('0')))

     // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawBPD(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedBPDFee_3 = toBN(th.getBPDFeeFromBPDBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedBPDFee_3.gt(toBN('0')))
     
    /*  
    Expected rewards:

    A_RBTC: (100* RBTCFee_1)/600 + (100* RBTCFee_2)/600 + (100*RBTC_Fee_3)/650
    B_RBTC: (200* RBTCFee_1)/600 + (200* RBTCFee_2)/600 + (200*RBTC_Fee_3)/650
    C_RBTC: (300* RBTCFee_1)/600 + (300* RBTCFee_2)/600 + (300*RBTC_Fee_3)/650
    D_RBTC:                                             (100*RBTC_Fee_3)/650

    A_BPD: (100*BPDFee_1 )/600 + (100* BPDFee_2)/600 + (100*BPDFee_3)/650
    B_BPD: (200* BPDFee_1)/600 + (200* BPDFee_2)/600 + (200*BPDFee_3)/650
    C_BPD: (300* BPDFee_1)/600 + (300* BPDFee_2)/600 + (300*BPDFee_3)/650
    D_BPD:                                               (100*BPDFee_3)/650
    */

    // Expected RBTC gains
    const expectedRBTCGain_A = toBN('100').mul(emittedRBTCFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedRBTCFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedRBTCFee_3).div( toBN('650')))

    const expectedRBTCGain_B = toBN('200').mul(emittedRBTCFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedRBTCFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedRBTCFee_3).div( toBN('650')))

    const expectedRBTCGain_C = toBN('300').mul(emittedRBTCFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedRBTCFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedRBTCFee_3).div( toBN('650')))

    const expectedRBTCGain_D = toBN('50').mul(emittedRBTCFee_3).div( toBN('650'))

    // Expected BPD gains:
    const expectedBPDGain_A = toBN('100').mul(emittedBPDFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedBPDFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedBPDFee_3).div( toBN('650')))

    const expectedBPDGain_B = toBN('200').mul(emittedBPDFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedBPDFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedBPDFee_3).div( toBN('650')))

    const expectedBPDGain_C = toBN('300').mul(emittedBPDFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedBPDFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedBPDFee_3).div( toBN('650')))
    
    const expectedBPDGain_D = toBN('50').mul(emittedBPDFee_3).div( toBN('650'))


    const A_RBTCBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_BPDBalance_Before = toBN(await bpdToken.balanceOf(A))
    const B_RBTCBalance_Before = toBN(await web3.eth.getBalance(B))
    const B_BPDBalance_Before = toBN(await bpdToken.balanceOf(B))
    const C_RBTCBalance_Before = toBN(await web3.eth.getBalance(C))
    const C_BPDBalance_Before = toBN(await bpdToken.balanceOf(C))
    const D_RBTCBalance_Before = toBN(await web3.eth.getBalance(D))
    const D_BPDBalance_Before = toBN(await bpdToken.balanceOf(D))

    // A-D un-stake
    const unstake_A = await mpStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})
    const unstake_B = await mpStaking.unstake(dec(200, 18), {from: B, gasPrice: 0})
    const unstake_C = await mpStaking.unstake(dec(400, 18), {from: C, gasPrice: 0})
    const unstake_D = await mpStaking.unstake(dec(50, 18), {from: D, gasPrice: 0})

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await mpToken.balanceOf(mpStaking.address)), '0')
    assert.equal((await mpStaking.totalMPStaked()), '0')

    // Get A-D RBTC and BPD balances
    const A_RBTCBalance_After = toBN(await web3.eth.getBalance(A))
    const A_BPDBalance_After = toBN(await bpdToken.balanceOf(A))
    const B_RBTCBalance_After = toBN(await web3.eth.getBalance(B))
    const B_BPDBalance_After = toBN(await bpdToken.balanceOf(B))
    const C_RBTCBalance_After = toBN(await web3.eth.getBalance(C))
    const C_BPDBalance_After = toBN(await bpdToken.balanceOf(C))
    const D_RBTCBalance_After = toBN(await web3.eth.getBalance(D))
    const D_BPDBalance_After = toBN(await bpdToken.balanceOf(D))

    // Get RBTC and BPD gains
    const A_RBTCGain = A_RBTCBalance_After.sub(A_RBTCBalance_Before)
    const A_BPDGain = A_BPDBalance_After.sub(A_BPDBalance_Before)
    const B_RBTCGain = B_RBTCBalance_After.sub(B_RBTCBalance_Before)
    const B_BPDGain = B_BPDBalance_After.sub(B_BPDBalance_Before)
    const C_RBTCGain = C_RBTCBalance_After.sub(C_RBTCBalance_Before)
    const C_BPDGain = C_BPDBalance_After.sub(C_BPDBalance_Before)
    const D_RBTCGain = D_RBTCBalance_After.sub(D_RBTCBalance_Before)
    const D_BPDGain = D_BPDBalance_After.sub(D_BPDBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedRBTCGain_A, A_RBTCGain), 1000)
    assert.isAtMost(th.getDifference(expectedBPDGain_A, A_BPDGain), 1000)
    assert.isAtMost(th.getDifference(expectedRBTCGain_B, B_RBTCGain), 1000)
    assert.isAtMost(th.getDifference(expectedBPDGain_B, B_BPDGain), 1000)
    assert.isAtMost(th.getDifference(expectedRBTCGain_C, C_RBTCGain), 1000)
    assert.isAtMost(th.getDifference(expectedBPDGain_C, C_BPDGain), 1000)
    assert.isAtMost(th.getDifference(expectedRBTCGain_D, D_RBTCGain), 1000)
    assert.isAtMost(th.getDifference(expectedBPDGain_D, D_BPDGain), 1000)
  })
 
  it("unstake(): reverts if caller has RBTC gains and can't receive RBTC",  async () => {
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })  
    await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openVault({ extraBPDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MP to staker A and the non-payable proxy
    await mpToken.transfer(A, dec(100, 18), {from: multisig})
    await mpToken.transfer(nonPayable.address, dec(100, 18), {from: multisig})

    //  A makes stake
    const A_stakeTx = await mpStaking.stake(dec(100, 18), {from: A})
    assert.isTrue(A_stakeTx.receipt.status)

    //  A tells proxy to make a stake
    const proxystakeTxData = await th.getTransactionData('stake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 MP
    await nonPayable.forward(mpStaking.address, proxystakeTxData, {from: A})


    // B makes a redemption, creating RBTC gain for proxy
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(45, 18))
    
    const proxy_RBTCGain = await mpStaking.getPendingRBTCGain(nonPayable.address)
    assert.isTrue(proxy_RBTCGain.gt(toBN('0')))

    // Expect this tx to revert: stake() tries to send nonPayable proxy's accumulated RBTC gain (albeit 0),
    //  A tells proxy to unstake
    const proxyUnStakeTxData = await th.getTransactionData('unstake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 MP
    const proxyUnstakeTxPromise = nonPayable.forward(mpStaking.address, proxyUnStakeTxData, {from: A})
   
    // but nonPayable proxy can not accept RBTC - therefore stake() reverts.
    await assertRevert(proxyUnstakeTxPromise)
  })

  it("receive(): reverts when it receives RBTC from an address that is not the Active Pool",  async () => { 
    const ethSendTxPromise1 = web3.eth.sendTransaction({to: mpStaking.address, from: A, value: dec(1, 'ether')})
    const ethSendTxPromise2 = web3.eth.sendTransaction({to: mpStaking.address, from: owner, value: dec(1, 'ether')})

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

  it("unstake(): reverts if user has no stake",  async () => {  
    const unstakeTxPromise1 = mpStaking.unstake(1, {from: A})
    const unstakeTxPromise2 = mpStaking.unstake(1, {from: owner})

    await assertRevert(unstakeTxPromise1)
    await assertRevert(unstakeTxPromise2)
  })

  it('Test requireCallerIsVaultManager', async () => {
    const mpStakingTester = await MPStakingTester.new()
    await assertRevert(mpStakingTester.requireCallerIsVaultManager(), 'MPStaking: caller is not VaultM')
  })
})
