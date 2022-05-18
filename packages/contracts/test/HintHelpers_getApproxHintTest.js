const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const { dec, toBN } = th
const moneyVals = testHelpers.MoneyValues

let latestRandomSeed = 31337

const VaultManagerTester = artifacts.require("VaultManagerTester")
const BPDToken = artifacts.require("BPDToken")

contract('HintHelpers', async accounts => {
 
  const [owner] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let sortedVaults
  let vaultManager
  let borrowerOperations
  let hintHelpers
  let priceFeed

  let contracts

  let numAccounts;

  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)

  /* Open a Vault for each account. BPD debt is 200 BPD each, with collateral beginning at
  1.5 ether, and rising by 0.01 ether per Vault.  Hence, the ICR of account (i + 1) is always 1% greater than the ICR of account i. 
 */

 // Open Vaults in parallel, then withdraw BPD in parallel
 const makeVaultsInParallel = async (accounts, n) => {
  activeAccounts = accounts.slice(0,n)
  // console.log(`number of accounts used is: ${activeAccounts.length}`)
  // console.time("makeVaultsInParallel")
  const openVaultpromises = activeAccounts.map((account, index) => openVault(account, index))
  await Promise.all(openVaultpromises)
  const withdrawBPDpromises = activeAccounts.map(account => withdrawBPDfromVault(account))
  await Promise.all(withdrawBPDpromises)
  // console.timeEnd("makeVaultsInParallel")
 }

 const openVault = async (account, index) => {
   const amountFinney = 2000 + index * 10
   const coll = web3.utils.toWei((amountFinney.toString()), 'finney')
   await borrowerOperations.openVault(th._100pct, 0, account, account, { from: account, value: coll })
 }

 const withdrawBPDfromVault = async (account) => {
  await borrowerOperations.withdrawBPD(th._100pct, '100000000000000000000', account, account, { from: account })
 }

 // Sequentially add coll and withdraw BPD, 1 account at a time
  const makeVaultsInSequence = async (accounts, n) => {
    activeAccounts = accounts.slice(0,n)
    // console.log(`number of accounts used is: ${activeAccounts.length}`)

    let ICR = 200

    // console.time('makeVaultsInSequence')
    for (const account of activeAccounts) {
      const ICR_BN = toBN(ICR.toString().concat('0'.repeat(16)))
      await th.openVault(contracts, { extraBPDAmount: toBN(dec(10000, 18)), ICR: ICR_BN, extraParams: { from: account } })

      ICR += 1
    }
    // console.timeEnd('makeVaultsInSequence')
  }

  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.vaultManager = await VaultManagerTester.new()
    contracts.bpdToken = await BPDToken.new(
      contracts.vaultManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress, multisig)

    sortedVaults = contracts.sortedVaults
    vaultManager = contracts.vaultManager
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    priceFeed = contracts.priceFeedTestnet
  
    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)

    numAccounts = 10

    await priceFeed.setPrice(dec(100, 18))
    await makeVaultsInSequence(accounts, numAccounts) 
    // await makeVaultsInParallel(accounts, numAccounts)  
  })

  it("setup: makes accounts with nominal ICRs increasing by 1% consecutively", async () => {
    // check first 10 accounts
    const ICR_0 = await vaultManager.getNominalICR(accounts[0])
    const ICR_1 = await vaultManager.getNominalICR(accounts[1])
    const ICR_2 = await vaultManager.getNominalICR(accounts[2])
    const ICR_3 = await vaultManager.getNominalICR(accounts[3])
    const ICR_4 = await vaultManager.getNominalICR(accounts[4])
    const ICR_5 = await vaultManager.getNominalICR(accounts[5])
    const ICR_6 = await vaultManager.getNominalICR(accounts[6])
    const ICR_7 = await vaultManager.getNominalICR(accounts[7])
    const ICR_8 = await vaultManager.getNominalICR(accounts[8])
    const ICR_9 = await vaultManager.getNominalICR(accounts[9])

    assert.isTrue(ICR_0.eq(toBN(dec(200, 16))))
    assert.isTrue(ICR_1.eq(toBN(dec(201, 16))))
    assert.isTrue(ICR_2.eq(toBN(dec(202, 16))))
    assert.isTrue(ICR_3.eq(toBN(dec(203, 16))))
    assert.isTrue(ICR_4.eq(toBN(dec(204, 16))))
    assert.isTrue(ICR_5.eq(toBN(dec(205, 16))))
    assert.isTrue(ICR_6.eq(toBN(dec(206, 16))))
    assert.isTrue(ICR_7.eq(toBN(dec(207, 16))))
    assert.isTrue(ICR_8.eq(toBN(dec(208, 16))))
    assert.isTrue(ICR_9.eq(toBN(dec(209, 16))))
  })

  it("getApproxHint(): returns the address of a Vault within sqrt(length) positions of the correct insert position", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

    /* As per the setup, the ICRs of Vaults are monotonic and seperated by 1% intervals. Therefore, the difference in ICR between 
    the given CR and the ICR of the hint address equals the number of positions between the hint address and the correct insert position 
    for a Vault with the given CR. */

    // CR = 250%
    const CR_250 = '2500000000000000000'
    const CRPercent_250 = Number(web3.utils.fromWei(CR_250, 'ether')) * 100

    let hintAddress

    // const hintAddress_250 = await functionCaller.vaultManager_getApproxHint(CR_250, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_250, sqrtLength * 10, latestRandomSeed))
    const ICR_hintAddress_250 = await vaultManager.getNominalICR(hintAddress)
    const ICRPercent_hintAddress_250 = Number(web3.utils.fromWei(ICR_hintAddress_250, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_250 = (ICRPercent_hintAddress_250 - CRPercent_250)
    assert.isBelow(ICR_Difference_250, sqrtLength)

    // CR = 287% 
    const CR_287 = '2870000000000000000'
    const CRPercent_287 = Number(web3.utils.fromWei(CR_287, 'ether')) * 100

    // const hintAddress_287 = await functionCaller.vaultManager_getApproxHint(CR_287, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_287, sqrtLength * 10, latestRandomSeed))
    const ICR_hintAddress_287 = await vaultManager.getNominalICR(hintAddress)
    const ICRPercent_hintAddress_287 = Number(web3.utils.fromWei(ICR_hintAddress_287, 'ether')) * 100
    
    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_287 = (ICRPercent_hintAddress_287 - CRPercent_287)
    assert.isBelow(ICR_Difference_287, sqrtLength)

    // CR = 213%
    const CR_213 = '2130000000000000000'
    const CRPercent_213 = Number(web3.utils.fromWei(CR_213, 'ether')) * 100

    // const hintAddress_213 = await functionCaller.vaultManager_getApproxHint(CR_213, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_213, sqrtLength * 10, latestRandomSeed))
    const ICR_hintAddress_213 = await vaultManager.getNominalICR(hintAddress)
    const ICRPercent_hintAddress_213 = Number(web3.utils.fromWei(ICR_hintAddress_213, 'ether')) * 100
    
    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_213 = (ICRPercent_hintAddress_213 - CRPercent_213)
    assert.isBelow(ICR_Difference_213, sqrtLength)

     // CR = 201%
     const CR_201 = '2010000000000000000'
     const CRPercent_201 = Number(web3.utils.fromWei(CR_201, 'ether')) * 100
 
    //  const hintAddress_201 = await functionCaller.vaultManager_getApproxHint(CR_201, sqrtLength * 10)
     ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_201, sqrtLength * 10, latestRandomSeed))
     const ICR_hintAddress_201 = await vaultManager.getNominalICR(hintAddress)
     const ICRPercent_hintAddress_201 = Number(web3.utils.fromWei(ICR_hintAddress_201, 'ether')) * 100
     
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_201 = (ICRPercent_hintAddress_201 - CRPercent_201)
     assert.isBelow(ICR_Difference_201, sqrtLength)
  })

  /* Pass 100 random collateral ratios to getApproxHint(). For each, check whether the returned hint address is within 
  sqrt(length) positions of where a Vault with that CR should be inserted. */
  // it("getApproxHint(): for 100 random CRs, returns the address of a Vault within sqrt(length) positions of the correct insert position", async () => {
  //   const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

  //   for (i = 0; i < 100; i++) {
  //     // get random ICR between 200% and (200 + numAccounts)%
  //     const min = 200
  //     const max = 200 + numAccounts
  //     const ICR_Percent = (Math.floor(Math.random() * (max - min) + min)) 

  //     // Convert ICR to a duint
  //     const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney') 
  
  //     const hintAddress = await hintHelpers.getApproxHint(ICR, sqrtLength * 10)
  //     const ICR_hintAddress = await vaultManager.getNominalICR(hintAddress)
  //     const ICRPercent_hintAddress = Number(web3.utils.fromWei(ICR_hintAddress, 'ether')) * 100
      
  //     // check the hint position is at most sqrtLength positions away from the correct position
  //     ICR_Difference = (ICRPercent_hintAddress - ICR_Percent)
  //     assert.isBelow(ICR_Difference, sqrtLength)
  //   }
  // })

  it("getApproxHint(): returns the head of the list if the CR is the max uint256 value", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

    // CR = Maximum value, i.e. 2**256 -1 
    const CR_Max = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    let hintAddress

    // const hintAddress_Max = await functionCaller.vaultManager_getApproxHint(CR_Max, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_Max, sqrtLength * 10, latestRandomSeed))

    const ICR_hintAddress_Max = await vaultManager.getNominalICR(hintAddress)
    const ICRPercent_hintAddress_Max = Number(web3.utils.fromWei(ICR_hintAddress_Max, 'ether')) * 100

     const firstVault = await sortedVaults.getFirst()
     const ICR_FirstVault = await vaultManager.getNominalICR(firstVault)
     const ICRPercent_FirstVault = Number(web3.utils.fromWei(ICR_FirstVault, 'ether')) * 100
 
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_Max = (ICRPercent_hintAddress_Max - ICRPercent_FirstVault)
     assert.isBelow(ICR_Difference_Max, sqrtLength)
  })

  it("getApproxHint(): returns the tail of the list if the CR is lower than ICR of any Vault", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

     // CR = MCR
     const CR_Min = '1100000000000000000'

     let hintAddress

    //  const hintAddress_Min = await functionCaller.vaultManager_getApproxHint(CR_Min, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_Min, sqrtLength * 10, latestRandomSeed))
    const ICR_hintAddress_Min = await vaultManager.getNominalICR(hintAddress)
    const ICRPercent_hintAddress_Min = Number(web3.utils.fromWei(ICR_hintAddress_Min, 'ether')) * 100

     const lastVault = await sortedVaults.getLast()
     const ICR_LastVault = await vaultManager.getNominalICR(lastVault)
     const ICRPercent_LastVault = Number(web3.utils.fromWei(ICR_LastVault, 'ether')) * 100
 
     // check the hint position is at most sqrtLength positions away from the correct position
     const ICR_Difference_Min = (ICRPercent_hintAddress_Min - ICRPercent_LastVault)
     assert.isBelow(ICR_Difference_Min, sqrtLength)
  })

  it('computeNominalCR()', async () => {
    const NICR = await hintHelpers.computeNominalCR(dec(3, 18), dec(200, 18))
    assert.equal(NICR.toString(), dec(150, 16))
  })

})

// Gas usage:  See gas costs spreadsheet. Cost per trial = 10k-ish.
