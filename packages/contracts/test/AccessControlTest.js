const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const VaultManagerTester = artifacts.require("VaultManagerTester")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert

/* The majority of access control tests are contained in this file. However, tests for restrictions 
on the Moneyp admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

contract('Access Control: Moneyp functions with the caller restricted to Moneyp contract(s)', async accounts => {

  const [owner, alice, bob, carol] = accounts;
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let coreContracts

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

  let mpStaking
  let mpToken
  let communityIssuance
  let lockupContractFactory

  before(async () => {
    coreContracts = await deploymentHelper.deployMoneypCore()
    coreContracts.vaultManager = await VaultManagerTester.new()
    coreContracts = await deploymentHelper.deployBPDTokenTester(coreContracts)
    const MPContracts = await deploymentHelper.deployMPTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
    
    priceFeed = coreContracts.priceFeed
    bpdToken = coreContracts.bpdToken
    sortedVaults = coreContracts.sortedVaults
    vaultManager = coreContracts.vaultManager
    nameRegistry = coreContracts.nameRegistry
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    mpStaking = MPContracts.mpStaking
    mpToken = MPContracts.mpToken
    communityIssuance = MPContracts.communityIssuance
    lockupContractFactory = MPContracts.lockupContractFactory

    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, coreContracts)

    for (account of accounts.slice(0, 10)) {
      await th.openVault(coreContracts, { extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
    }

    const expectedCISupplyCap = '32000000000000000000000000' // 32mil

    // Check CI has been properly funded
    const bal = await mpToken.balanceOf(communityIssuance.address)
    assert.equal(bal, expectedCISupplyCap)
  })

  describe('BorrowerOperations', async accounts => { 
    it("moveRBTCGainToVault(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const tx1= await borrowerOperations.moveRBTCGainToVault(bob, bob, bob, { from: bob })
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "BorrowerOps: Caller is not Stability Pool")
      }
    })
  })

  describe('VaultManager', async accounts => {
    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.applyPendingRewards(bob, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.updateVaultRewardSnapshots(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert" )
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.removeStake(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateStakeAndTotalStakes
    it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.updateStakeAndTotalStakes(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeVault
    it("closeVault(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.closeVault(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // addVaultOwnerToArray
    it("addVaultOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.addVaultOwnerToArray(bob, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // setVaultStatus
    it("setVaultStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.setVaultStatus(bob, 1, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseVaultColl
    it("increaseVaultColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.increaseVaultColl(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseVaultColl
    it("decreaseVaultColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.decreaseVaultColl(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseVaultDebt
    it("increaseVaultDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.increaseVaultDebt(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseVaultDebt
    it("decreaseVaultDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await vaultManager.decreaseVaultDebt(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })
  })

  describe('ActivePool', async accounts => {
    // sendRBTC
    it("sendRBTC(): reverts when called by an account that is not BO nor VaultM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.sendRBTC(alice, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor VaultManager nor StabilityPool")
      }
    })

    // increaseBPD	
    it("increaseBPDDebt(): reverts when called by an account that is not BO nor VaultM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.increaseBPDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor VaultManager")
      }
    })

    // decreaseBPD
    it("decreaseBPDDebt(): reverts when called by an account that is not BO nor VaultM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.decreaseBPDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor VaultManager nor StabilityPool")
      }
    })

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not Borrower Operations nor Default Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: activePool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "ActivePool: Caller is neither BO nor Default Pool")
      }
    })
  })

  describe('DefaultPool', async accounts => {
    // sendRBTCToActivePool
    it("sendRBTCToActivePool(): reverts when called by an account that is not VaultManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.sendRBTCToActivePool(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the VaultManager")
      }
    })

    // increaseBPD	
    it("increaseBPDDebt(): reverts when called by an account that is not VaultManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.increaseBPDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the VaultManager")
      }
    })

    // decreaseBPD	
    it("decreaseBPD(): reverts when called by an account that is not VaultManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.decreaseBPDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the VaultManager")
      }
    })

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: defaultPool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "DefaultPool: Caller is not the ActivePool")
      }
    })
  })

  describe('StabilityPool', async accounts => {
    // --- onlyVaultManager --- 

    // offset
    it("offset(): reverts when called by an account that is not VaultManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.offset(100, 10, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not VaultManager")
      }
    })

    // --- onlyActivePool ---

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: stabilityPool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "StabilityPool: Caller is not ActivePool")
      }
    })
  })

  describe('BPDToken', async accounts => {

    //    mint
    it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      const txAlice = bpdToken.mint(bob, 100, { from: alice })
      await th.assertRevert(txAlice, "Caller is not BorrowerOperations")
    })

    // burn
    it("burn(): reverts when called by an account that is not BO nor VaultM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await bpdToken.burn(bob, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither BorrowerOperations nor VaultManager nor StabilityPool")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await bpdToken.sendToPool(bob, activePool.address, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the StabilityPool")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not VaultManager nor StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await bpdToken.returnFromPool(activePool.address, bob, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither VaultManager nor StabilityPool")
      }
    })
  })

  describe('SortedVaults', async accounts => {
    // --- onlyBorrowerOperations ---
    //     insert
    it("insert(): reverts when called by an account that is not BorrowerOps or VaultM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedVaults.insert(bob, '150000000000000000000', bob, bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is neither BO nor VaultM")
      }
    })

    // --- onlyVaultManager ---
    // remove
    it("remove(): reverts when called by an account that is not VaultManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedVaults.remove(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is not the VaultManager")
      }
    })

    // --- onlyVaultMorBM ---
    // reinsert
    it("reinsert(): reverts when called by an account that is neither BorrowerOps nor VaultManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedVaults.reInsert(bob, '150000000000000000000', bob, bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BO nor VaultM")
      }
    })
  })

  describe('LockupContract', async accounts => {
    it("withdrawMP(): reverts when caller is not beneficiary", async () => {
      // deploy new LC with Carol as beneficiary
      const unlockTime = (await mpToken.getDeploymentStartTime()).add(toBN(timeValues.SECONDS_IN_ONE_YEAR))
      const deployedLCtx = await lockupContractFactory.deployLockupContract(
        carol, 
        unlockTime,
        { from: owner })

      const LC = await th.getLCFromDeploymentTx(deployedLCtx)

      // MP Multisig funds the LC
      await mpToken.transfer(LC.address, dec(100, 18), { from: multisig })

      // Fast-forward one year, so that beneficiary can withdraw
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Bob attempts to withdraw MP
      try {
        const txBob = await LC.withdrawMP({ from: bob })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Confirm beneficiary, Carol, can withdraw
      const txCarol = await LC.withdrawMP({ from: carol })
      assert.isTrue(txCarol.receipt.status)
    })
  })

  describe('MPStaking', async accounts => {
    it("increaseF_BPD(): reverts when caller is not VaultManager", async () => {
      try {
        const txAlice = await mpStaking.increaseF_BPD(dec(1, 18), { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('MPToken', async accounts => {
    it("sendToMPStaking(): reverts when caller is not the MPSstaking", async () => {
      // Check multisig has some MP
      assert.isTrue((await mpToken.balanceOf(multisig)).gt(toBN('0')))

      // multisig tries to call it
      try {
        const tx = await mpToken.sendToMPStaking(multisig, 1, { from: multisig })
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // FF >> time one year
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Owner transfers 1 MP to bob
      await mpToken.transfer(bob, dec(1, 18), { from: multisig })
      assert.equal((await mpToken.balanceOf(bob)), dec(1, 18))

      // Bob tries to call it
      try {
        const tx = await mpToken.sendToMPStaking(bob, dec(1, 18), { from: bob })
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('CommunityIssuance', async accounts => {
    it("sendMP(): reverts when caller is not the StabilityPool", async () => {
      const tx1 = communityIssuance.sendMP(alice, dec(100, 18), {from: alice})
      const tx2 = communityIssuance.sendMP(bob, dec(100, 18), {from: alice})
      const tx3 = communityIssuance.sendMP(stabilityPool.address, dec(100, 18), {from: alice})
     
      assertRevert(tx1)
      assertRevert(tx2)
      assertRevert(tx3)
    })

    it("issueMP(): reverts when caller is not the StabilityPool", async () => {
      const tx1 = communityIssuance.issueMP({from: alice})

      assertRevert(tx1)
    })
  })

  
})


