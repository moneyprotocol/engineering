const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const VaultManagerTester = artifacts.require("VaultManagerTester")
const BPDTokenTester = artifacts.require("./BPDTokenTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert

/* NOTE: Some of the borrowing tests do not test for specific BPD fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific BPD fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the VaultManager, which is still TBD based on economic
 * modelling.
 * 
 */

contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

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

  const getOpenVaultBPDAmount = async (totalDebt) => th.getOpenVaultBPDAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const openVault = async (params) => th.openVault(contracts, params)
  const getVaultEntireColl = async (vault) => th.getVaultEntireColl(contracts, vault)
  const getVaultEntireDebt = async (vault) => th.getVaultEntireDebt(contracts, vault)
  const getVaultStake = async (vault) => th.getVaultStake(contracts, vault)

  let BPD_GAS_COMPENSATION
  let MIN_NET_DEBT
  let BORROWING_FEE_FLOOR

  before(async () => {

  })

  const testCorpus = ({ withProxy = false }) => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.vaultManager = await VaultManagerTester.new()
      contracts = await deploymentHelper.deployBPDTokenTester(contracts)
      const MPContracts = await deploymentHelper.deployMPTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

      await deploymentHelper.connectMPContracts(MPContracts)
      await deploymentHelper.connectCoreContracts(contracts, MPContracts)
      await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)

      if (withProxy) {
        const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
        await deploymentHelper.deployProxyScripts(contracts, MPContracts, owner, users)
      }

      priceFeed = contracts.priceFeedTestnet
      bpdToken = contracts.bpdToken
      sortedVaults = contracts.sortedVaults
      vaultManager = contracts.vaultManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers

      mpStaking = MPContracts.mpStaking
      mpToken = MPContracts.mpToken
      communityIssuance = MPContracts.communityIssuance
      lockupContractFactory = MPContracts.lockupContractFactory

      BPD_GAS_COMPENSATION = await borrowerOperations.BPD_GAS_COMPENSATION()
      MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
      BORROWING_FEE_FLOOR = await borrowerOperations.BORROWING_FEE_FLOOR()
    })

    it("addColl(): reverts when top-up would leave vault with ICR < MCR", async () => {
      // alice creates a Vault and adds first collateral
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await vaultManager.checkRecoveryMode(price))
      assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const collTopUp = 1  // 1 wei top up

     await assertRevert(borrowerOperations.addColl(alice, alice, { from: alice, value: collTopUp }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("addColl(): Increases the activePool RBTC and raw ether balance by correct amount", async () => {
      const { collateral: aliceColl } = await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const activePool_RBTC_Before = await activePool.getETH()
      const activePool_RawEther_Before = toBN(await web3.eth.getBalance(activePool.address))

      assert.isTrue(activePool_RBTC_Before.eq(aliceColl))
      assert.isTrue(activePool_RawEther_Before.eq(aliceColl))

      await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_RBTC_After = await activePool.getETH()
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
    })

    it("addColl(), active Vault: adds the correct collateral amount to the Vault", async () => {
      // alice creates a Vault and adds first collateral
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const alice_Vault_Before = await vaultManager.Vaults(alice)
      const coll_before = alice_Vault_Before[1]
      const status_Before = alice_Vault_Before[3]

      // check status before
      assert.equal(status_Before, 1)

      // Alice adds second collateral
      await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

      const alice_Vault_After = await vaultManager.Vaults(alice)
      const coll_After = alice_Vault_After[1]
      const status_After = alice_Vault_After[3]

      // check coll increases by correct amount,and status remains active
      assert.isTrue(coll_After.eq(coll_before.add(toBN(dec(1, 'ether')))))
      assert.equal(status_After, 1)
    })

    it("addColl(), active Vault: Vault is in sortedList before and after", async () => {
      // alice creates a Vault and adds first collateral
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check Alice is in list before
      const aliceVaultInList_Before = await sortedVaults.contains(alice)
      const listIsEmpty_Before = await sortedVaults.isEmpty()
      assert.equal(aliceVaultInList_Before, true)
      assert.equal(listIsEmpty_Before, false)

      await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

      // check Alice is still in list after
      const aliceVaultInList_After = await sortedVaults.contains(alice)
      const listIsEmpty_After = await sortedVaults.isEmpty()
      assert.equal(aliceVaultInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("addColl(), active Vault: updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Vault with 1 ether
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const alice_Vault_Before = await vaultManager.Vaults(alice)
      const alice_Stake_Before = alice_Vault_Before[2]
      const totalStakes_Before = (await vaultManager.totalStakes())

      assert.isTrue(totalStakes_Before.eq(alice_Stake_Before))

      // Alice tops up Vault collateral with 2 ether
      await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(2, 'ether') })

      // Check stake and total stakes get updated
      const alice_Vault_After = await vaultManager.Vaults(alice)
      const alice_Stake_After = alice_Vault_After[2]
      const totalStakes_After = (await vaultManager.totalStakes())

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.add(toBN(dec(2, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.add(toBN(dec(2, 'ether')))))
    })

    it("addColl(), active Vault: applies pending rewards and updates user's L_ETH, B_BPDDebt snapshots", async () => {
      // --- SETUP ---

      const { collateral: aliceCollBefore, totalDebt: aliceDebtBefore } = await openVault({ extraBPDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const { collateral: bobCollBefore, totalDebt: bobDebtBefore } = await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // --- TEST ---

      // price drops to 1ETH:100BPD, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // Liquidate Carol's Vault,
      const tx = await vaultManager.liquidate(carol, { from: owner });

      assert.isFalse(await sortedVaults.contains(carol))

      const L_ETH = await vaultManager.L_ETH()
      const B_BPDDebt = await vaultManager.B_BPDDebt()

      // check Alice and Bob's reward snapshots are zero before they alter their Vaults
      const alice_rewardSnapshot_Before = await vaultManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_BPDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await vaultManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_BPDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_BPDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_BPDDebtRewardSnapshot_Before, 0)

      const alicePendingETHReward = await vaultManager.getPendingETHReward(alice)
      const bobPendingETHReward = await vaultManager.getPendingETHReward(bob)
      const alicePendingBPDDebtReward = await vaultManager.getPendingBPDDebtReward(alice)
      const bobPendingBPDDebtReward = await vaultManager.getPendingBPDDebtReward(bob)
      for (reward of [alicePendingETHReward, bobPendingETHReward, alicePendingBPDDebtReward, bobPendingBPDDebtReward]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob top up their Vaults
      const aliceTopUp = toBN(dec(5, 'ether'))
      const bobTopUp = toBN(dec(1, 'ether'))

      await borrowerOperations.addColl(alice, alice, { from: alice, value: aliceTopUp })
      await borrowerOperations.addColl(bob, bob, { from: bob, value: bobTopUp })

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceNewColl = await getVaultEntireColl(alice)
      const aliceNewDebt = await getVaultEntireDebt(alice)
      const bobNewColl = await getVaultEntireColl(bob)
      const bobNewDebt = await getVaultEntireDebt(bob)

      assert.isTrue(aliceNewColl.eq(aliceCollBefore.add(alicePendingETHReward).add(aliceTopUp)))
      assert.isTrue(aliceNewDebt.eq(aliceDebtBefore.add(alicePendingBPDDebtReward)))
      assert.isTrue(bobNewColl.eq(bobCollBefore.add(bobPendingETHReward).add(bobTopUp)))
      assert.isTrue(bobNewDebt.eq(bobDebtBefore.add(bobPendingBPDDebtReward)))

      /* Check that both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and B_BPDDebt */
      const alice_rewardSnapshot_After = await vaultManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      const alice_BPDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

      const bob_rewardSnapshot_After = await vaultManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      const bob_BPDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_BPDDebtRewardSnapshot_After, B_BPDDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_BPDDebtRewardSnapshot_After, B_BPDDebt), 100)
    })

    // it("addColl(), active Vault: adds the right corrected stake after liquidations have occured", async () => {
    //  // TODO - check stake updates for addColl/withdrawColl/adustVault ---

    //   // --- SETUP ---
    //   // A,B,C add 15/5/5 RBTC, withdraw 100/100/900 BPD
    //   await borrowerOperations.openVault(th._100pct, dec(100, 18), alice, alice, { from: alice, value: dec(15, 'ether') })
    //   await borrowerOperations.openVault(th._100pct, dec(100, 18), bob, bob, { from: bob, value: dec(4, 'ether') })
    //   await borrowerOperations.openVault(th._100pct, dec(900, 18), carol, carol, { from: carol, value: dec(5, 'ether') })

    //   await borrowerOperations.openVault(th._100pct, 0, dennis, dennis, { from: dennis, value: dec(1, 'ether') })
    //   // --- TEST ---

    //   // price drops to 1ETH:100BPD, reducing Carol's ICR below MCR
    //   await priceFeed.setPrice('100000000000000000000');

    //   // close Carol's Vault, liquidating her 5 ether and 900BPD.
    //   await vaultManager.liquidate(carol, { from: owner });

    //   // dennis tops up his vault by 1 RBTC
    //   await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: dec(1, 'ether') })

    //   /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
    //   stake is given by the formula: 

    //   s = totalStakesSnapshot / totalCollateralSnapshot 

    //   where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
    //   the RBTC from her Vault has now become the totalPendingETHReward. So:

    //   totalStakes = (alice_Stake + bob_Stake + dennis_orig_stake ) = (15 + 4 + 1) =  20 RBTC.
    //   totalCollateral = (alice_Collateral + bob_Collateral + dennis_orig_coll + totalPendingETHReward) = (15 + 4 + 1 + 5)  = 25 RBTC.

    //   Therefore, as Dennis adds 1 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 RBTC */
    //   const dennis_Vault = await vaultManager.Vaults(dennis)

    //   const dennis_Stake = dennis_Vault[2]
    //   console.log(dennis_Stake.toString())

    //   assert.isAtMost(th.getDifference(dennis_Stake), 100)
    // })

    it("addColl(), reverts if vault is non-existent or closed", async () => {
      // A, B open vaults
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Carol attempts to add collateral to her non-existent vault
      try {
        const txCarol = await borrowerOperations.addColl(carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Vault does not exist or is closed")
      }

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Bob gets liquidated
      await vaultManager.liquidate(bob)

      assert.isFalse(await sortedVaults.contains(bob))

      // Bob attempts to add collateral to his closed vault
      try {
        const txBob = await borrowerOperations.addColl(bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Vault does not exist or is closed")
      }
    })

    it('addColl(): can add collateral in Recovery Mode', async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getVaultEntireColl(alice)
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const collTopUp = toBN(dec(1, 'ether'))
      await borrowerOperations.addColl(alice, alice, { from: alice, value: collTopUp })

      // Check Alice's collateral
      const aliceCollAfter = (await vaultManager.Vaults(alice))[1]
      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.add(collTopUp)))
    })

    // --- withdrawColl() ---

    it("withdrawColl(): reverts when withdrawal would leave vault with ICR < MCR", async () => {
      // alice creates a Vault and adds first collateral
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await vaultManager.checkRecoveryMode(price))
      assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const collWithdrawal = 1  // 1 wei withdrawal

     await assertRevert(borrowerOperations.withdrawColl(1, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    // reverts when calling address does not have active vault  
    it("withdrawColl(): reverts when calling address does not have active vault", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws some coll
      const txBob = await borrowerOperations.withdrawColl(dec(100, 'finney'), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active vault attempts to withdraw
      try {
        const txCarol = await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawColl(1000, alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //Check withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawColl(1000, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when requested RBTC withdrawal is > the vault's collateral", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolColl = await getVaultEntireColl(carol)
      const bobColl = await getVaultEntireColl(bob)
      // Carol withdraws exactly all her collateral
      await assertRevert(
        borrowerOperations.withdrawColl(carolColl, carol, carol, { from: carol }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )

      // Bob attempts to withdraw 1 wei more than his collateral
      try {
        const txBob = await borrowerOperations.withdrawColl(bobColl.add(toBN(1)), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } }) // 110% ICR

      // Bob attempts to withdraws 1 wei, Which would leave him with < 110% ICR.

      try {
        const txBob = await borrowerOperations.withdrawColl(1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---

      // A and B open vaults at 150% ICR
      await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // --- TEST ---

      // price drops to 1ETH:150BPD, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');

      //Alice tries to withdraw collateral during Recovery Mode
      try {
        const txData = await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawColl(): doesn’t allow a user to completely withdraw all collateral from their Vault (due to gas compensation)", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceColl = (await vaultManager.getEntireDebtAndColl(alice))[1]

      // Check Vault is active
      const alice_Vault_Before = await vaultManager.Vaults(alice)
      const status_Before = alice_Vault_Before[3]
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedVaults.contains(alice))

      // Alice attempts to withdraw all collateral
      await assertRevert(
        borrowerOperations.withdrawColl(aliceColl, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("withdrawColl(): leaves the Vault active when the user withdraws less than all the collateral", async () => {
      // Open Vault 
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Vault is active
      const alice_Vault_Before = await vaultManager.Vaults(alice)
      const status_Before = alice_Vault_Before[3]
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedVaults.contains(alice))

      // Withdraw some collateral
      await borrowerOperations.withdrawColl(dec(100, 'finney'), alice, alice, { from: alice })

      // Check Vault is still active
      const alice_Vault_After = await vaultManager.Vaults(alice)
      const status_After = alice_Vault_After[3]
      assert.equal(status_After, 1)
      assert.isTrue(await sortedVaults.contains(alice))
    })

    it("withdrawColl(): reduces the Vault's collateral by the correct amount", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getVaultEntireColl(alice)

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })

      // Check 1 ether remaining
      const alice_Vault_After = await vaultManager.Vaults(alice)
      const aliceCollAfter = await getVaultEntireColl(alice)

      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): reduces ActivePool RBTC and raw ether by correct amount", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getVaultEntireColl(alice)

      // check before
      const activePool_RBTC_before = await activePool.getETH()
      const activePool_RawEther_before = toBN(await web3.eth.getBalance(activePool.address))

      await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })

      // check after
      const activePool_RBTC_After = await activePool.getETH()
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_After.eq(activePool_RBTC_before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_RawEther_before.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Vault with 2 ether
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: toBN(dec(5, 'ether')) } })
      const aliceColl = await getVaultEntireColl(alice)
      assert.isTrue(aliceColl.gt(toBN('0')))

      const alice_Vault_Before = await vaultManager.Vaults(alice)
      const alice_Stake_Before = alice_Vault_Before[2]
      const totalStakes_Before = (await vaultManager.totalStakes())

      assert.isTrue(alice_Stake_Before.eq(aliceColl))
      assert.isTrue(totalStakes_Before.eq(aliceColl))

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })

      // Check stake and total stakes get updated
      const alice_Vault_After = await vaultManager.Vaults(alice)
      const alice_Stake_After = alice_Vault_After[2]
      const totalStakes_After = (await vaultManager.totalStakes())

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): sends the correct amount of RBTC to the user", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: dec(2, 'ether') } })

      const alice_ETHBalance_Before = toBN(web3.utils.toBN(await web3.eth.getBalance(alice)))
      await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice, gasPrice: 0 })

      const alice_ETHBalance_After = toBN(web3.utils.toBN(await web3.eth.getBalance(alice)))
      const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

      assert.isTrue(balanceDiff.eq(toBN(dec(1, 'ether'))))
    })

    it("withdrawColl(): applies pending rewards and updates user's L_ETH, B_BPDDebt snapshots", async () => {
      // --- SETUP ---
      // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })
      await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: bob, value: toBN(dec(100, 'ether')) } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol, value: toBN(dec(10, 'ether')) } })

      const aliceCollBefore = await getVaultEntireColl(alice)
      const aliceDebtBefore = await getVaultEntireDebt(alice)
      const bobCollBefore = await getVaultEntireColl(bob)
      const bobDebtBefore = await getVaultEntireDebt(bob)

      // --- TEST ---

      // price drops to 1ETH:100BPD, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // close Carol's Vault, liquidating her 1 ether and 180BPD.
      await vaultManager.liquidate(carol, { from: owner });

      const L_ETH = await vaultManager.L_ETH()
      const B_BPDDebt = await vaultManager.B_BPDDebt()

      // check Alice and Bob's reward snapshots are zero before they alter their Vaults
      const alice_rewardSnapshot_Before = await vaultManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_BPDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await vaultManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_BPDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_BPDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_BPDDebtRewardSnapshot_Before, 0)

      // Check A and B have pending rewards
      const pendingCollReward_A = await vaultManager.getPendingETHReward(alice)
      const pendingDebtReward_A = await vaultManager.getPendingBPDDebtReward(alice)
      const pendingCollReward_B = await vaultManager.getPendingETHReward(bob)
      const pendingDebtReward_B = await vaultManager.getPendingBPDDebtReward(bob)
      for (reward of [pendingCollReward_A, pendingDebtReward_A, pendingCollReward_B, pendingDebtReward_B]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob withdraw from their Vaults
      const aliceCollWithdrawal = toBN(dec(5, 'ether'))
      const bobCollWithdrawal = toBN(dec(1, 'ether'))

      await borrowerOperations.withdrawColl(aliceCollWithdrawal, alice, alice, { from: alice })
      await borrowerOperations.withdrawColl(bobCollWithdrawal, bob, bob, { from: bob })

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceCollAfter = await getVaultEntireColl(alice)
      const aliceDebtAfter = await getVaultEntireDebt(alice)
      const bobCollAfter = await getVaultEntireColl(bob)
      const bobDebtAfter = await getVaultEntireDebt(bob)

      // Check rewards have been applied to vaults
      th.assertIsApproximatelyEqual(aliceCollAfter, aliceCollBefore.add(pendingCollReward_A).sub(aliceCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(pendingDebtReward_A), 10000)
      th.assertIsApproximatelyEqual(bobCollAfter, bobCollBefore.add(pendingCollReward_B).sub(bobCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(bobDebtAfter, bobDebtBefore.add(pendingDebtReward_B), 10000)

      /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and B_BPDDebt */
      const alice_rewardSnapshot_After = await vaultManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      const alice_BPDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

      const bob_rewardSnapshot_After = await vaultManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      const bob_BPDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_BPDDebtRewardSnapshot_After, B_BPDDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_BPDDebtRewardSnapshot_After, B_BPDDebt), 100)
    })

    // --- withdrawBPD() ---

    it("withdrawBPD(): reverts when withdrawal would leave vault with ICR < MCR", async () => {
      // alice creates a Vault and adds first collateral
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await vaultManager.checkRecoveryMode(price))
      assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const BPDwithdrawal = 1  // withdraw 1 wei BPD

     await assertRevert(borrowerOperations.withdrawBPD(th._100pct, BPDwithdrawal, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("withdrawBPD(): decays a non-zero base rate", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openVault({ extraBPDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const A_BPDBal = await bpdToken.balanceOf(A)

      // Artificially set base rate to 5%
      await vaultManager.setBaseRate(dec(5, 16))

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws BPD
      await borrowerOperations.withdrawBPD(th._100pct, dec(1, 18), A, A, { from: D })

      // Check baseRate has decreased
      const baseRate_2 = await vaultManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E withdraws BPD
      await borrowerOperations.withdrawBPD(th._100pct, dec(1, 18), A, A, { from: E })

      const baseRate_3 = await vaultManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("withdrawBPD(): reverts if max fee > 100%", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await assertRevert(borrowerOperations.withdrawBPD(dec(2, 18), dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawBPD('1000000000000000001', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("withdrawBPD(): reverts if max fee < 0.5% in Normal mode", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await assertRevert(borrowerOperations.withdrawBPD(0, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawBPD(1, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawBPD('4999999999999999', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("withdrawBPD(): reverts if fee exceeds max fee percentage", async () => {
      await openVault({ extraBPDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openVault({ extraBPDAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const totalSupply = await bpdToken.totalSupply()

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      let baseRate = await vaultManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // 100%: 1e18,  10%: 1e17,  1%: 1e16,  0.1%: 1e15
      // 5%: 5e16
      // 0.5%: 5e15
      // actual: 0.5%, 5e15


      // BPDFee:                  15000000558793542
      // absolute _fee:            15000000558793542
      // actual feePercentage:      5000000186264514
      // user's _maxFeePercentage: 49999999999999999

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.withdrawBPD(lessThan5pct, dec(3, 18), A, A, { from: A }), "Fee exceeded provided maximum")

      baseRate = await vaultManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.withdrawBPD(dec(1, 16), dec(1, 18), A, A, { from: B }), "Fee exceeded provided maximum")

      baseRate = await vaultManager.baseRate()  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.withdrawBPD(dec(3754, 13), dec(1, 18), A, A, { from: C }), "Fee exceeded provided maximum")

      baseRate = await vaultManager.baseRate()  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 0.5%%
      await assertRevert(borrowerOperations.withdrawBPD(dec(5, 15), dec(1, 18), A, A, { from: D }), "Fee exceeded provided maximum")
    })

    it("withdrawBPD(): succeeds when fee is less than max fee percentage", async () => {
      await openVault({ extraBPDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openVault({ extraBPDAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const totalSupply = await bpdToken.totalSupply()

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      let baseRate = await vaultManager.baseRate() // expect 5% base rate
      assert.isTrue(baseRate.eq(toBN(dec(5, 16))))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.withdrawBPD(moreThan5pct, dec(1, 18), A, A, { from: A })
      assert.isTrue(tx1.receipt.status)

      baseRate = await vaultManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.withdrawBPD(dec(5, 16), dec(1, 18), A, A, { from: B })
      assert.isTrue(tx2.receipt.status)

      baseRate = await vaultManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.withdrawBPD(dec(1, 17), dec(1, 18), A, A, { from: C })
      assert.isTrue(tx3.receipt.status)

      baseRate = await vaultManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.withdrawBPD(dec(37659, 13), dec(1, 18), A, A, { from: D })
      assert.isTrue(tx4.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.withdrawBPD(dec(1, 18), dec(1, 18), A, A, { from: E })
      assert.isTrue(tx5.receipt.status)
    })

    it("withdrawBPD(): doesn't change base rate if it is already zero", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws BPD
      await borrowerOperations.withdrawBPD(th._100pct, dec(37, 18), A, A, { from: D })

      // Check baseRate is still 0
      const baseRate_2 = await vaultManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens vault 
      await borrowerOperations.withdrawBPD(th._100pct, dec(12, 18), A, A, { from: E })

      const baseRate_3 = await vaultManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("withdrawBPD(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await vaultManager.lastFeeOperationTime()

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.withdrawBPD(th._100pct, dec(1, 18), C, C, { from: C })

      const lastFeeOpTime_2 = await vaultManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.withdrawBPD(th._100pct, dec(1, 18), C, C, { from: C })

      const lastFeeOpTime_3 = await vaultManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })


    it("withdrawBPD(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers a fee, before decay interval has passed
      await borrowerOperations.withdrawBPD(th._100pct, dec(1, 18), C, C, { from: C })

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.withdrawBPD(th._100pct, dec(1, 18), C, C, { from: C })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await vaultManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("withdrawBPD(): borrowing at non-zero base rate sends BPD fee to MP staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP BPD balance before == 0
      const mpStaking_BPDBalance_Before = await bpdToken.balanceOf(mpStaking.address)
      assert.equal(mpStaking_BPDBalance_Before, '0')

      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws BPD
      await borrowerOperations.withdrawBPD(th._100pct, dec(37, 18), C, C, { from: D })

      // Check MP BPD balance after has increased
      const mpStaking_BPDBalance_After = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStaking_BPDBalance_After.gt(mpStaking_BPDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("withdrawBPD(): borrowing at non-zero base records the (drawn debt + fee) on the Vault struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 MP
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
        await mpStaking.stake(dec(1, 18), { from: multisig })

        await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        const D_debtBefore = await getVaultEntireDebt(D)

        // Artificially make baseRate 5%
        await vaultManager.setBaseRate(dec(5, 16))
        await vaultManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await vaultManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        // D withdraws BPD
        const withdrawal_D = toBN(dec(37, 18))
        const withdrawalTx = await borrowerOperations.withdrawBPD(th._100pct, toBN(dec(37, 18)), D, D, { from: D })

        const emittedFee = toBN(th.getBPDFeeFromBPDBorrowingEvent(withdrawalTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const newDebt = (await vaultManager.Vaults(D))[0]

        // Check debt on Vault struct equals initial debt + withdrawal + emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_debtBefore.add(withdrawal_D).add(emittedFee), 10000)
      })
    }

    it("withdrawBPD(): Borrowing at non-zero base rate increases the MP staking contract BPD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP contract BPD fees-per-unit-staked is zero
      const F_BPD_Before = await mpStaking.F_BPD()
      assert.equal(F_BPD_Before, '0')

      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws BPD
      await borrowerOperations.withdrawBPD(th._100pct, toBN(dec(37, 18)), D, D, { from: D })

      // Check MP contract BPD fees-per-unit-staked has increased
      const F_BPD_After = await mpStaking.F_BPD()
      assert.isTrue(F_BPD_After.gt(F_BPD_Before))
    })

    it("withdrawBPD(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP Staking contract balance before == 0
      const mpStaking_BPDBalance_Before = await bpdToken.balanceOf(mpStaking.address)
      assert.equal(mpStaking_BPDBalance_Before, '0')

      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_BPDBalanceBefore = await bpdToken.balanceOf(D)

      // D withdraws BPD
      const D_BPDRequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawBPD(th._100pct, D_BPDRequest, D, D, { from: D })

      // Check MP staking BPD balance has increased
      const mpStaking_BPDBalance_After = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStaking_BPDBalance_After.gt(mpStaking_BPDBalance_Before))

      // Check D's BPD balance now equals their initial balance plus request BPD
      const D_BPDBalanceAfter = await bpdToken.balanceOf(D)
      assert.isTrue(D_BPDBalanceAfter.eq(D_BPDBalanceBefore.add(D_BPDRequest)))
    })

    it("withdrawBPD(): Borrowing at zero base rate changes BPD fees-per-unit-staked", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // A artificially receives MP, then stakes it
      await mpToken.unprotectedMint(A, dec(100, 18))
      await mpStaking.stake(dec(100, 18), { from: A })

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check MP BPD balance before == 0
      const F_BPD_Before = await mpStaking.F_BPD()
      assert.equal(F_BPD_Before, '0')

      // D withdraws BPD
      await borrowerOperations.withdrawBPD(th._100pct, dec(37, 18), D, D, { from: D })

      // Check MP BPD balance after > 0
      const F_BPD_After = await mpStaking.F_BPD()
      assert.isTrue(F_BPD_After.gt('0'))
    })

    it("withdrawBPD(): Borrowing at zero base rate sends debt request to user", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_BPDBalanceBefore = await bpdToken.balanceOf(D)

      // D withdraws BPD
      const D_BPDRequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawBPD(th._100pct, dec(37, 18), D, D, { from: D })

      // Check D's BPD balance now equals their requested BPD
      const D_BPDBalanceAfter = await bpdToken.balanceOf(D)

      // Check D's vault debt == D's BPD balance + liquidation reserve
      assert.isTrue(D_BPDBalanceAfter.eq(D_BPDBalanceBefore.add(D_BPDRequest)))
    })

    it("withdrawBPD(): reverts when calling address does not have active vault", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws BPD
      const txBob = await borrowerOperations.withdrawBPD(th._100pct, dec(100, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active vault attempts to withdraw BPD
      try {
        const txCarol = await borrowerOperations.withdrawBPD(th._100pct, dec(100, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawBPD(): reverts when requested withdrawal amount is zero BPD", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws 1e-18 BPD
      const txBob = await borrowerOperations.withdrawBPD(th._100pct, 1, bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to withdraw 0 BPD
      try {
        const txAlice = await borrowerOperations.withdrawBPD(th._100pct, 0, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawBPD(): reverts when system is in Recovery Mode", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawBPD(th._100pct, dec(100, 18), alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice('50000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //Check BPD withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawBPD(th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawBPD(): reverts when withdrawal would bring the vault's ICR < MCR", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      // Bob tries to withdraw BPD that would bring his ICR < MCR
      try {
        const txBob = await borrowerOperations.withdrawBPD(th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawBPD(): reverts when a withdrawal would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // Alice and Bob creates vaults with 150% ICR.  System TCR = 150%.
      await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      var TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // Bob attempts to withdraw 1 BPD.
      // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
      try {
        const txBob = await borrowerOperations.withdrawBPD(th._100pct, dec(1, 18), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawBPD(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---
      await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      // --- TEST ---

      // price drops to 1ETH:150BPD, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');
      assert.isTrue((await th.getTCR(contracts)).lt(toBN(dec(15, 17))))

      try {
        const txData = await borrowerOperations.withdrawBPD(th._100pct, '200', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawBPD(): increases the Vault's BPD debt by the correct amount", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check before
      const aliceDebtBefore = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      await borrowerOperations.withdrawBPD(th._100pct, await getNetBorrowingAmount(100), alice, alice, { from: alice })

      // check after
      const aliceDebtAfter = await getVaultEntireDebt(alice)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(toBN(100)))
    })

    it("withdrawBPD(): increases BPD debt in ActivePool by correct amount", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })

      const aliceDebtBefore = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      // check before
      const activePool_BPD_Before = await activePool.getBPDDebt()
      assert.isTrue(activePool_BPD_Before.eq(aliceDebtBefore))

      await borrowerOperations.withdrawBPD(th._100pct, await getNetBorrowingAmount(dec(10000, 18)), alice, alice, { from: alice })

      // check after
      const activePool_BPD_After = await activePool.getBPDDebt()
      th.assertIsApproximatelyEqual(activePool_BPD_After, activePool_BPD_Before.add(toBN(dec(10000, 18))))
    })

    it("withdrawBPD(): increases user BPDToken balance by correct amount", async () => {
      await openVault({ extraParams: { value: toBN(dec(100, 'ether')), from: alice } })

      // check before
      const alice_BPDTokenBalance_Before = await bpdToken.balanceOf(alice)
      assert.isTrue(alice_BPDTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.withdrawBPD(th._100pct, dec(10000, 18), alice, alice, { from: alice })

      // check after
      const alice_BPDTokenBalance_After = await bpdToken.balanceOf(alice)
      assert.isTrue(alice_BPDTokenBalance_After.eq(alice_BPDTokenBalance_Before.add(toBN(dec(10000, 18)))))
    })

    // --- repayBPD() ---
    it("repayBPD(): reverts when repayment would leave vault with ICR < MCR", async () => {
      // alice creates a Vault and adds first collateral
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await vaultManager.checkRecoveryMode(price))
      assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const BPDRepayment = 1  // 1 wei repayment

     await assertRevert(borrowerOperations.repayBPD(BPDRepayment, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("repayBPD(): Succeeds when it would leave vault with net debt >= minimum net debt", async () => {
      // Make the BPD request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await borrowerOperations.openVault(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), A, A, { from: A, value: dec(100, 30) })

      const repayTxA = await borrowerOperations.repayBPD(1, A, A, { from: A })
      assert.isTrue(repayTxA.receipt.status)

      await borrowerOperations.openVault(th._100pct, dec(20, 25), B, B, { from: B, value: dec(100, 30) })

      const repayTxB = await borrowerOperations.repayBPD(dec(19, 25), B, B, { from: B })
      assert.isTrue(repayTxB.receipt.status)
    })

    it("repayBPD(): reverts when it would leave vault with net debt < minimum net debt", async () => {
      // Make the BPD request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await borrowerOperations.openVault(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), A, A, { from: A, value: dec(100, 30) })

      const repayTxAPromise = borrowerOperations.repayBPD(2, A, A, { from: A })
      await assertRevert(repayTxAPromise, "BorrowerOps: Vault's net debt must be greater than minimum")
    })

    it("repayBPD(): reverts when calling address does not have active vault", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      // Bob successfully repays some BPD
      const txBob = await borrowerOperations.repayBPD(dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active vault attempts to repayBPD
      try {
        const txCarol = await borrowerOperations.repayBPD(dec(10, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("repayBPD(): reverts when attempted repayment is > the debt of the vault", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebt = await getVaultEntireDebt(alice)

      // Bob successfully repays some BPD
      const txBob = await borrowerOperations.repayBPD(dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to repay more than her debt
      try {
        const txAlice = await borrowerOperations.repayBPD(aliceDebt.add(toBN(dec(1, 18))), alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    //repayBPD: reduces BPD debt in Vault
    it("repayBPD(): reduces the Vault's BPD debt by the correct amount", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      await borrowerOperations.repayBPD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      const aliceDebtAfter = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebtAfter.gt(toBN('0')))

      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))  // check 9/10 debt remaining
    })

    it("repayBPD(): decreases BPD debt in ActivePool by correct amount", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // Check before
      const activePool_BPD_Before = await activePool.getBPDDebt()
      assert.isTrue(activePool_BPD_Before.gt(toBN('0')))

      await borrowerOperations.repayBPD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const activePool_BPD_After = await activePool.getBPDDebt()
      th.assertIsApproximatelyEqual(activePool_BPD_After, activePool_BPD_Before.sub(aliceDebtBefore.div(toBN(10))))
    })

    it("repayBPD(): decreases user BPDToken balance by correct amount", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // check before
      const alice_BPDTokenBalance_Before = await bpdToken.balanceOf(alice)
      assert.isTrue(alice_BPDTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.repayBPD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const alice_BPDTokenBalance_After = await bpdToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_BPDTokenBalance_After, alice_BPDTokenBalance_Before.sub(aliceDebtBefore.div(toBN(10))))
    })

    it('repayBPD(): can repay debt in Recovery Mode', async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const tx = await borrowerOperations.repayBPD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })
      assert.isTrue(tx.receipt.status)

      // Check Alice's debt: 110 (initial) - 50 (repaid)
      const aliceDebtAfter = await getVaultEntireDebt(alice)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))
    })

    it("repayBPD(): Reverts if borrower has insufficient BPD balance to cover his debt repayment", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      const bobBalBefore = await bpdToken.balanceOf(B)
      assert.isTrue(bobBalBefore.gt(toBN('0')))

      // Bob transfers all but 5 of his BPD to Carol
      await bpdToken.transfer(C, bobBalBefore.sub((toBN(dec(5, 18)))), { from: B })

      //Confirm B's BPD balance has decreased to 5 BPD
      const bobBalAfter = await bpdToken.balanceOf(B)

      assert.isTrue(bobBalAfter.eq(toBN(dec(5, 18))))
      
      // Bob tries to repay 6 BPD
      const repayBPDPromise_B = borrowerOperations.repayBPD(toBN(dec(6, 18)), B, B, { from: B })

      await assertRevert(repayBPDPromise_B, "Caller doesnt have enough BPD to make repayment")
    })

    // --- adjustVault() ---

    it("adjustVault(): reverts when adjustment would leave vault with ICR < MCR", async () => {
      // alice creates a Vault and adds first collateral
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await vaultManager.checkRecoveryMode(price))
      assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const BPDRepayment = 1  // 1 wei repayment
      const collTopUp = 1

     await assertRevert(borrowerOperations.adjustVault(th._100pct, 0, BPDRepayment, false, alice, alice, { from: alice, value: collTopUp }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("adjustVault(): reverts if max fee < 0.5% in Normal mode", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      await assertRevert(borrowerOperations.adjustVault(0, 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.adjustVault(1, 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.adjustVault('4999999999999999', 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("adjustVault(): allows max fee < 0.5% in Recovery mode", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      await priceFeed.setPrice(dec(120, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))

      await borrowerOperations.adjustVault(0, 0, dec(1, 9), true, A, A, { from: A, value: dec(300, 18) })
      await priceFeed.setPrice(dec(1, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await borrowerOperations.adjustVault(1, 0, dec(1, 9), true, A, A, { from: A, value: dec(30000, 18) })
      await priceFeed.setPrice(dec(1, 16))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await borrowerOperations.adjustVault('4999999999999999', 0, dec(1, 9), true, A, A, { from: A, value: dec(3000000, 18) })
    })

    it("adjustVault(): decays a non-zero base rate", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts vault
      await borrowerOperations.adjustVault(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check baseRate has decreased
      const baseRate_2 = await vaultManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts vault
      await borrowerOperations.adjustVault(th._100pct, 0, dec(37, 15), true, E, E, { from: D })

      const baseRate_3 = await vaultManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("adjustVault(): doesn't decay a non-zero base rate when user issues 0 debt", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // D opens vault 
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts vault with 0 debt
      await borrowerOperations.adjustVault(th._100pct, 0, 0, false, D, D, { from: D, value: dec(1, 'ether') })

      // Check baseRate has not decreased 
      const baseRate_2 = await vaultManager.baseRate()
      assert.isTrue(baseRate_2.eq(baseRate_1))
    })

    it("adjustVault(): doesn't change base rate if it is already zero", async () => {
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts vault
      await borrowerOperations.adjustVault(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check baseRate is still 0
      const baseRate_2 = await vaultManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts vault
      await borrowerOperations.adjustVault(th._100pct, 0, dec(37, 15), true, E, E, { from: D })

      const baseRate_3 = await vaultManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("adjustVault(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await vaultManager.lastFeeOperationTime()

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.adjustVault(th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      const lastFeeOpTime_2 = await vaultManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.adjustVault(th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      const lastFeeOpTime_3 = await vaultManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("adjustVault(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // Borrower C triggers a fee, before decay interval of 1 minute has passed
      await borrowerOperations.adjustVault(th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.adjustVault(th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await vaultManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("adjustVault(): borrowing at non-zero base rate sends BPD fee to MP staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP BPD balance before == 0
      const mpStaking_BPDBalance_Before = await bpdToken.balanceOf(mpStaking.address)
      assert.equal(mpStaking_BPDBalance_Before, '0')

      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts vault
      await openVault({ extraBPDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check MP BPD balance after has increased
      const mpStaking_BPDBalance_After = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStaking_BPDBalance_After.gt(mpStaking_BPDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("adjustVault(): borrowing at non-zero base records the (drawn debt + fee) on the Vault struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 MP
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
        await mpStaking.stake(dec(1, 18), { from: multisig })

        await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        const D_debtBefore = await getVaultEntireDebt(D)

        // Artificially make baseRate 5%
        await vaultManager.setBaseRate(dec(5, 16))
        await vaultManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await vaultManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const withdrawal_D = toBN(dec(37, 18))

        // D withdraws BPD
        const adjustmentTx = await borrowerOperations.adjustVault(th._100pct, 0, withdrawal_D, true, D, D, { from: D })

        const emittedFee = toBN(th.getBPDFeeFromBPDBorrowingEvent(adjustmentTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const D_newDebt = (await vaultManager.Vaults(D))[0]
    
        // Check debt on Vault struct equals initila debt plus drawn debt plus emitted fee
        assert.isTrue(D_newDebt.eq(D_debtBefore.add(withdrawal_D).add(emittedFee)))
      })
    }

    it("adjustVault(): Borrowing at non-zero base rate increases the MP staking contract BPD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP contract BPD fees-per-unit-staked is zero
      const F_BPD_Before = await mpStaking.F_BPD()
      assert.equal(F_BPD_Before, '0')

      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts vault
      await borrowerOperations.adjustVault(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check MP contract BPD fees-per-unit-staked has increased
      const F_BPD_After = await mpStaking.F_BPD()
      assert.isTrue(F_BPD_After.gt(F_BPD_Before))
    })

    it("adjustVault(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP Staking contract balance before == 0
      const mpStaking_BPDBalance_Before = await bpdToken.balanceOf(mpStaking.address)
      assert.equal(mpStaking_BPDBalance_Before, '0')

      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const D_BPDBalanceBefore = await bpdToken.balanceOf(D)

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts vault
      const BPDRequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustVault(th._100pct, 0, BPDRequest_D, true, D, D, { from: D })

      // Check MP staking BPD balance has increased
      const mpStaking_BPDBalance_After = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStaking_BPDBalance_After.gt(mpStaking_BPDBalance_Before))

      // Check D's BPD balance has increased by their requested BPD
      const D_BPDBalanceAfter = await bpdToken.balanceOf(D)
      assert.isTrue(D_BPDBalanceAfter.eq(D_BPDBalanceBefore.add(BPDRequest_D)))
    })

    it("adjustVault(): Borrowing at zero base rate changes BPD balance of MP staking contract", async () => {
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check staking BPD balance before > 0
      const mpStaking_BPDBalance_Before = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStaking_BPDBalance_Before.gt(toBN('0')))

      // D adjusts vault
      await borrowerOperations.adjustVault(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check staking BPD balance after > staking balance before
      const mpStaking_BPDBalance_After = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStaking_BPDBalance_After.gt(mpStaking_BPDBalance_Before))
    })

    it("adjustVault(): Borrowing at zero base rate changes MP staking contract BPD fees-per-unit-staked", async () => {
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // A artificially receives MP, then stakes it
      await mpToken.unprotectedMint(A, dec(100, 18))
      await mpStaking.stake(dec(100, 18), { from: A })

      // Check staking BPD balance before == 0
      const F_BPD_Before = await mpStaking.F_BPD()
      assert.isTrue(F_BPD_Before.eq(toBN('0')))

      // D adjusts vault
      await borrowerOperations.adjustVault(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check staking BPD balance increases
      const F_BPD_After = await mpStaking.F_BPD()
      assert.isTrue(F_BPD_After.gt(F_BPD_Before))
    })

    it("adjustVault(): Borrowing at zero base rate sends total requested BPD to the user", async () => {
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const D_BPDBalBefore = await bpdToken.balanceOf(D)
      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const DUSDBalanceBefore = await bpdToken.balanceOf(D)

      // D adjusts vault
      const BPDRequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustVault(th._100pct, 0, BPDRequest_D, true, D, D, { from: D })

      // Check D's BPD balance increased by their requested BPD
      const BPDBalanceAfter = await bpdToken.balanceOf(D)
      assert.isTrue(BPDBalanceAfter.eq(D_BPDBalBefore.add(BPDRequest_D)))
    })

    it("adjustVault(): reverts when calling address has no active vault", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Alice coll and debt increase(+1 RBTC, +50BPD)
      await borrowerOperations.adjustVault(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      try {
        const txCarol = await borrowerOperations.adjustVault(th._100pct, 0, dec(50, 18), true, carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustVault(): reverts in Recovery Mode when the adjustment would reduce the TCR", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      const txAlice = await borrowerOperations.adjustVault(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in RBTC price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      try { // collateral withdrawal should also fail
        const txAlice = await borrowerOperations.adjustVault(th._100pct, dec(1, 'ether'), 0, false, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase should fail
        const txBob = await borrowerOperations.adjustVault(th._100pct, 0, dec(50, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase that's also a collateral increase should also fail, if ICR will be worse off
        const txBob = await borrowerOperations.adjustVault(th._100pct, 0, dec(111, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustVault(): collateral withdrawal reverts in Recovery Mode", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in RBTC price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Alice attempts an adjustment that repays half her debt BUT withdraws 1 wei collateral, and fails
      await assertRevert(borrowerOperations.adjustVault(th._100pct, 1, dec(5000, 18), false, alice, alice, { from: alice }),
        "BorrowerOps: Collateral withdrawal not permitted Recovery Mode")
    })

    it("adjustVault(): debt increase that would leave ICR < 150% reverts in Recovery Mode", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await vaultManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in RBTC price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const ICR_A = await vaultManager.getCurrentICR(alice, price)

      const aliceDebt = await getVaultEntireDebt(alice)
      const aliceColl = await getVaultEntireColl(alice)
      const debtIncrease = toBN(dec(50, 18))
      const collIncrease = toBN(dec(1, 'ether'))

      // Check the new ICR would be an improvement, but less than the CCR (150%)
      const newICR = await vaultManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)

      assert.isTrue(newICR.gt(ICR_A) && newICR.lt(CCR))

      await assertRevert(borrowerOperations.adjustVault(th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease }),
        "BorrowerOps: Operation must leave vault with ICR >= CCR")
    })

    it("adjustVault(): debt increase that would reduce the ICR reverts in Recovery Mode", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await vaultManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in RBTC price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //--- Alice with ICR > 150% tries to reduce her ICR ---

      const ICR_A = await vaultManager.getCurrentICR(alice, price)

      // Check Alice's initial ICR is above 150%
      assert.isTrue(ICR_A.gt(CCR))

      const aliceDebt = await getVaultEntireDebt(alice)
      const aliceColl = await getVaultEntireColl(alice)
      const aliceDebtIncrease = toBN(dec(150, 18))
      const aliceCollIncrease = toBN(dec(1, 'ether'))

      const newICR_A = await vaultManager.computeICR(aliceColl.add(aliceCollIncrease), aliceDebt.add(aliceDebtIncrease), price)

      // Check Alice's new ICR would reduce but still be greater than 150%
      assert.isTrue(newICR_A.lt(ICR_A) && newICR_A.gt(CCR))

      await assertRevert(borrowerOperations.adjustVault(th._100pct, 0, aliceDebtIncrease, true, alice, alice, { from: alice, value: aliceCollIncrease }),
        "BorrowerOps: Cannot decrease your Vault's ICR in Recovery Mode")

      //--- Bob with ICR < 150% tries to reduce his ICR ---

      const ICR_B = await vaultManager.getCurrentICR(bob, price)

      // Check Bob's initial ICR is below 150%
      assert.isTrue(ICR_B.lt(CCR))

      const bobDebt = await getVaultEntireDebt(bob)
      const bobColl = await getVaultEntireColl(bob)
      const bobDebtIncrease = toBN(dec(450, 18))
      const bobCollIncrease = toBN(dec(1, 'ether'))

      const newICR_B = await vaultManager.computeICR(bobColl.add(bobCollIncrease), bobDebt.add(bobDebtIncrease), price)

      // Check Bob's new ICR would reduce 
      assert.isTrue(newICR_B.lt(ICR_B))

      await assertRevert(borrowerOperations.adjustVault(th._100pct, 0, bobDebtIncrease, true, bob, bob, { from: bob, value: bobCollIncrease }),
        " BorrowerOps: Operation must leave vault with ICR >= CCR")
    })

    it("adjustVault(): A vault with ICR < CCR in Recovery Mode can adjust their vault to ICR > CCR", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await vaultManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(100, 18)) // trigger drop in RBTC price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const ICR_A = await vaultManager.getCurrentICR(alice, price)
      // Check initial ICR is below 150%
      assert.isTrue(ICR_A.lt(CCR))

      const aliceDebt = await getVaultEntireDebt(alice)
      const aliceColl = await getVaultEntireColl(alice)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await vaultManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)

      // Check new ICR would be > 150%
      assert.isTrue(newICR.gt(CCR))

      const tx = await borrowerOperations.adjustVault(th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease })
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await vaultManager.getCurrentICR(alice, price)
      assert.isTrue(actualNewICR.gt(CCR))
    })

    it("adjustVault(): A vault with ICR > CCR in Recovery Mode can improve their ICR", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await vaultManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in RBTC price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const initialICR = await vaultManager.getCurrentICR(alice, price)
      // Check initial ICR is above 150%
      assert.isTrue(initialICR.gt(CCR))

      const aliceDebt = await getVaultEntireDebt(alice)
      const aliceColl = await getVaultEntireColl(alice)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await vaultManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)

      // Check new ICR would be > old ICR
      assert.isTrue(newICR.gt(initialICR))

      const tx = await borrowerOperations.adjustVault(th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease })
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await vaultManager.getCurrentICR(alice, price)
      assert.isTrue(actualNewICR.gt(initialICR))
    })

    it("adjustVault(): debt increase in Recovery Mode charges no fee", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(200000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in RBTC price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // B stakes MP
      await mpToken.unprotectedMint(bob, dec(100, 18))
      await mpStaking.stake(dec(100, 18), { from: bob })

      const mpStakingBPDBalanceBefore = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStakingBPDBalanceBefore.gt(toBN('0')))

      const txAlice = await borrowerOperations.adjustVault(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(100, 'ether') })
      assert.isTrue(txAlice.receipt.status)

      // Check emitted fee = 0
      const emittedFee = toBN(await th.getEventArgByName(txAlice, 'BPDBorrowingFeePaid', '_BPDFee'))
      assert.isTrue(emittedFee.eq(toBN('0')))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check no fee was sent to staking contract
      const mpStakingBPDBalanceAfter = await bpdToken.balanceOf(mpStaking.address)
      assert.equal(mpStakingBPDBalanceAfter.toString(), mpStakingBPDBalanceBefore.toString())
    })

    it("adjustVault(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      // Check TCR and Recovery Mode
      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob attempts an operation that would bring the TCR below the CCR
      try {
        const txBob = await borrowerOperations.adjustVault(th._100pct, 0, dec(1, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustVault(): reverts when BPD repaid is > debt of the vault", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const bobOpenTx = (await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })).tx

      const bobDebt = await getVaultEntireDebt(bob)
      assert.isTrue(bobDebt.gt(toBN('0')))

      const bobFee = toBN(await th.getEventArgByIndex(bobOpenTx, 'BPDBorrowingFeePaid', 1))
      assert.isTrue(bobFee.gt(toBN('0')))

      // Alice transfers BPD to bob to compensate borrowing fees
      await bpdToken.transfer(bob, bobFee, { from: alice })

      const remainingDebt = (await vaultManager.getVaultDebt(bob)).sub(BPD_GAS_COMPENSATION)

      // Bob attempts an adjustment that would repay 1 wei more than his debt
      await assertRevert(
        borrowerOperations.adjustVault(th._100pct, 0, remainingDebt.add(toBN(1)), false, bob, bob, { from: bob, value: dec(1, 'ether') }),
        "revert"
      )
    })

    it("adjustVault(): reverts when attempted RBTC withdrawal is >= the vault's collateral", async () => {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolColl = await getVaultEntireColl(carol)

      // Carol attempts an adjustment that would withdraw 1 wei more than her RBTC
      try {
        const txCarol = await borrowerOperations.adjustVault(th._100pct, carolColl.add(toBN(1)), 0, true, carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustVault(): reverts when change would cause the ICR of the vault to fall below the MCR", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

      await priceFeed.setPrice(dec(100, 18))

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      // Bob attempts to increase debt by 100 BPD and 1 ether, i.e. a change that constitutes a 100% ratio of coll:debt.
      // Since his ICR prior is 110%, this change would reduce his ICR below MCR.
      try {
        const txBob = await borrowerOperations.adjustVault(th._100pct, 0, dec(100, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustVault(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollBefore = await getVaultEntireColl(alice)
      const activePoolCollBefore = await activePool.getETH()

      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(aliceCollBefore.eq(activePoolCollBefore))

      // Alice adjusts vault. No coll change, and a debt increase (+50BPD)
      await borrowerOperations.adjustVault(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: 0 })

      const aliceCollAfter = await getVaultEntireColl(alice)
      const activePoolCollAfter = await activePool.getETH()

      assert.isTrue(aliceCollAfter.eq(activePoolCollAfter))
      assert.isTrue(activePoolCollAfter.eq(activePoolCollAfter))
    })

    it("adjustVault(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getVaultEntireDebt(alice)
      const activePoolDebtBefore = await activePool.getBPDDebt()

      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore.eq(activePoolDebtBefore))

      // Alice adjusts vault. Coll change, no debt change
      await borrowerOperations.adjustVault(th._100pct, 0, 0, false, alice, alice, { from: alice, value: dec(1, 'ether') })

      const aliceDebtAfter = await getVaultEntireDebt(alice)
      const activePoolDebtAfter = await activePool.getBPDDebt()

      assert.isTrue(aliceDebtAfter.eq(aliceDebtBefore))
      assert.isTrue(activePoolDebtAfter.eq(activePoolDebtBefore))
    })

    it("adjustVault(): updates borrower's debt and coll with an increase in both", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getVaultEntireDebt(alice)
      const collBefore = await getVaultEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts vault. Coll and debt increase(+1 RBTC, +50BPD)
      await borrowerOperations.adjustVault(th._100pct, 0, await getNetBorrowingAmount(dec(50, 18)), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const debtAfter = await getVaultEntireDebt(alice)
      const collAfter = await getVaultEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.add(toBN(dec(1, 18))), 10000)
    })

    it("adjustVault(): updates borrower's debt and coll with a decrease in both", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getVaultEntireDebt(alice)
      const collBefore = await getVaultEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts vault coll and debt decrease (-0.5 RBTC, -50BPD)
      await borrowerOperations.adjustVault(th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const debtAfter = await getVaultEntireDebt(alice)
      const collAfter = await getVaultEntireColl(alice)

      assert.isTrue(debtAfter.eq(debtBefore.sub(toBN(dec(50, 18)))))
      assert.isTrue(collAfter.eq(collBefore.sub(toBN(dec(5, 17)))))
    })

    it("adjustVault(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getVaultEntireDebt(alice)
      const collBefore = await getVaultEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts vault - coll increase and debt decrease (+0.5 RBTC, -50BPD)
      await borrowerOperations.adjustVault(th._100pct, 0, dec(50, 18), false, alice, alice, { from: alice, value: dec(500, 'finney') })

      const debtAfter = await getVaultEntireDebt(alice)
      const collAfter = await getVaultEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.sub(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.add(toBN(dec(5, 17))), 10000)
    })

    it("adjustVault(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getVaultEntireDebt(alice)
      const collBefore = await getVaultEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts vault - coll decrease and debt increase (0.1 RBTC, 10BPD)
      await borrowerOperations.adjustVault(th._100pct, dec(1, 17), await getNetBorrowingAmount(dec(1, 18)), true, alice, alice, { from: alice })

      const debtAfter = await getVaultEntireDebt(alice)
      const collAfter = await getVaultEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(1, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.sub(toBN(dec(1, 17))), 10000)
    })

    it("adjustVault(): updates borrower's stake and totalStakes with a coll increase", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const stakeBefore = await vaultManager.getVaultStake(alice)
      const totalStakesBefore = await vaultManager.totalStakes();
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts vault - coll and debt increase (+1 RBTC, +50 BPD)
      await borrowerOperations.adjustVault(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const stakeAfter = await vaultManager.getVaultStake(alice)
      const totalStakesAfter = await vaultManager.totalStakes();

      assert.isTrue(stakeAfter.eq(stakeBefore.add(toBN(dec(1, 18)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.add(toBN(dec(1, 18)))))
    })

    it("adjustVault():  updates borrower's stake and totalStakes with a coll decrease", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const stakeBefore = await vaultManager.getVaultStake(alice)
      const totalStakesBefore = await vaultManager.totalStakes();
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts vault - coll decrease and debt decrease
      await borrowerOperations.adjustVault(th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const stakeAfter = await vaultManager.getVaultStake(alice)
      const totalStakesAfter = await vaultManager.totalStakes();

      assert.isTrue(stakeAfter.eq(stakeBefore.sub(toBN(dec(5, 17)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(toBN(dec(5, 17)))))
    })

    it("adjustVault(): changes BPDToken balance by the requested decrease", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const alice_BPDTokenBalance_Before = await bpdToken.balanceOf(alice)
      assert.isTrue(alice_BPDTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts vault - coll decrease and debt decrease
      await borrowerOperations.adjustVault(th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      // check after
      const alice_BPDTokenBalance_After = await bpdToken.balanceOf(alice)
      assert.isTrue(alice_BPDTokenBalance_After.eq(alice_BPDTokenBalance_Before.sub(toBN(dec(10, 18)))))
    })

    it("adjustVault(): changes BPDToken balance by the requested increase", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const alice_BPDTokenBalance_Before = await bpdToken.balanceOf(alice)
      assert.isTrue(alice_BPDTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts vault - coll increase and debt increase
      await borrowerOperations.adjustVault(th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      // check after
      const alice_BPDTokenBalance_After = await bpdToken.balanceOf(alice)
      assert.isTrue(alice_BPDTokenBalance_After.eq(alice_BPDTokenBalance_Before.add(toBN(dec(100, 18)))))
    })

    it("adjustVault(): Changes the activePool RBTC and raw ether balance by the requested decrease", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_RBTC_Before = await activePool.getETH()
      const activePool_RawEther_Before = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts vault - coll decrease and debt decrease
      await borrowerOperations.adjustVault(th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      const activePool_RBTC_After = await activePool.getETH()
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_After.eq(activePool_RBTC_Before.sub(toBN(dec(1, 17)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_RBTC_Before.sub(toBN(dec(1, 17)))))
    })

    it("adjustVault(): Changes the activePool RBTC and raw ether balance by the amount of RBTC sent", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_RBTC_Before = await activePool.getETH()
      const activePool_RawEther_Before = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts vault - coll increase and debt increase
      await borrowerOperations.adjustVault(th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_RBTC_After = await activePool.getETH()
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_After.eq(activePool_RBTC_Before.add(toBN(dec(1, 18)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_RBTC_Before.add(toBN(dec(1, 18)))))
    })

    it("adjustVault(): Changes the BPD debt in ActivePool by requested decrease", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_BPDDebt_Before = await activePool.getBPDDebt()
      assert.isTrue(activePool_BPDDebt_Before.gt(toBN('0')))

      // Alice adjusts vault - coll increase and debt decrease
      await borrowerOperations.adjustVault(th._100pct, 0, dec(30, 18), false, alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_BPDDebt_After = await activePool.getBPDDebt()
      assert.isTrue(activePool_BPDDebt_After.eq(activePool_BPDDebt_Before.sub(toBN(dec(30, 18)))))
    })

    it("adjustVault(): Changes the BPD debt in ActivePool by requested increase", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_BPDDebt_Before = await activePool.getBPDDebt()
      assert.isTrue(activePool_BPDDebt_Before.gt(toBN('0')))

      // Alice adjusts vault - coll increase and debt increase
      await borrowerOperations.adjustVault(th._100pct, 0, await getNetBorrowingAmount(dec(100, 18)), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_BPDDebt_After = await activePool.getBPDDebt()
    
      th.assertIsApproximatelyEqual(activePool_BPDDebt_After, activePool_BPDDebt_Before.add(toBN(dec(100, 18))))
    })

    it("adjustVault(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      const aliceColl = await getVaultEntireColl(alice)
      const aliceDebt = await getVaultEntireColl(alice)
      const status_Before = await vaultManager.getVaultStatus(alice)
      const isInSortedList_Before = await sortedVaults.contains(alice)

      assert.equal(status_Before, 1)  // 1: Active
      assert.isTrue(isInSortedList_Before)

      await assertRevert(
        borrowerOperations.adjustVault(th._100pct, aliceColl, aliceDebt, true, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("adjustVault(): Reverts if requested debt increase and amount is zero", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(borrowerOperations.adjustVault(th._100pct, 0, 0, true, alice, alice, { from: alice }),
        'BorrowerOps: Debt increase requires non-zero debtChange')
    })

    it("adjustVault(): Reverts if requested coll withdrawal and ether is sent", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(borrowerOperations.adjustVault(th._100pct, dec(1, 'ether'), dec(100, 18), true, alice, alice, { from: alice, value: dec(3, 'ether') }), 'BorrowerOperations: Cannot withdraw and add coll')
    })

    it("adjustVault(): Reverts if requested coll withdrawal is greater than vault's collateral", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const aliceColl = await getVaultEntireColl(alice)

      // Requested coll withdrawal > coll in the vault
      await assertRevert(borrowerOperations.adjustVault(th._100pct, aliceColl.add(toBN(1)), 0, false, alice, alice, { from: alice }))
      await assertRevert(borrowerOperations.adjustVault(th._100pct, aliceColl.add(toBN(dec(37, 'ether'))), 0, false, bob, bob, { from: bob }))
    })

    it("adjustVault(): Reverts if borrower has insufficient BPD balance to cover his debt repayment", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: B } })
      const bobDebt = await getVaultEntireDebt(B)

      // Bob transfers some BPD to carol
      await bpdToken.transfer(C, dec(10, 18), { from: B })

      //Confirm B's BPD balance is less than 50 BPD
      const B_BPDBal = await bpdToken.balanceOf(B)
      assert.isTrue(B_BPDBal.lt(bobDebt))

      const repayBPDPromise_B = borrowerOperations.adjustVault(th._100pct, 0, bobDebt, false, B, B, { from: B })

      // B attempts to repay all his debt
      await assertRevert(repayBPDPromise_B, "revert")
    })

    // --- Internal _adjustVault() ---

    if (!withProxy) { // no need to test this with proxies
      it("Internal _adjustVault(): reverts when op is a withdrawal and _borrower param is not the msg.sender", async () => {
        await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

        const txPromise_A = borrowerOperations.callInternalAdjustLoan(alice, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
        await assertRevert(txPromise_A, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_B = borrowerOperations.callInternalAdjustLoan(bob, dec(1, 18), dec(1, 18), true, alice, alice, { from: owner })
        await assertRevert(txPromise_B, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_C = borrowerOperations.callInternalAdjustLoan(carol, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
        await assertRevert(txPromise_C, "BorrowerOps: Caller must be the borrower for a withdrawal")
      })
    }

    // --- closeVault() ---

    it("closeVault(): reverts when it would lower the TCR below CCR", async () => {
      await openVault({ ICR: toBN(dec(300, 16)), extraParams:{ from: alice } })
      await openVault({ ICR: toBN(dec(120, 16)), extraBPDAmount: toBN(dec(300, 18)), extraParams:{ from: bob } })

      const price = await priceFeed.getPrice()
      
      // to compensate borrowing fees
      await bpdToken.transfer(alice, dec(300, 18), { from: bob })

      assert.isFalse(await vaultManager.checkRecoveryMode(price))
    
      await assertRevert(
        borrowerOperations.closeVault({ from: alice }),
        "BorrowerOps: An operation that would result in TCR < CCR is not permitted"
      )
    })

    it("closeVault(): reverts when calling address does not have active vault", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Carol with no active vault attempts to close her vault
      try {
        const txCarol = await borrowerOperations.closeVault({ from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("closeVault(): reverts when system is in Recovery Mode", async () => {
      await openVault({ extraBPDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Alice transfers her BPD to Bob and Carol so they can cover fees
      const aliceBal = await bpdToken.balanceOf(alice)
      await bpdToken.transfer(bob, aliceBal.div(toBN(2)), { from: alice })
      await bpdToken.transfer(carol, aliceBal.div(toBN(2)), { from: alice })

      // check Recovery Mode 
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob successfully closes his vault
      const txBob = await borrowerOperations.closeVault({ from: bob })
      assert.isTrue(txBob.receipt.status)

      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Carol attempts to close her vault during Recovery Mode
      await assertRevert(borrowerOperations.closeVault({ from: carol }), "BorrowerOps: Operation not permitted during Recovery Mode")
    })

    it("closeVault(): reverts when vault is the only one in the system", async () => {
      await openVault({ extraBPDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Artificially mint to Alice so she has enough to close her vault
      await bpdToken.unprotectedMint(alice, dec(100000, 18))

      // Check she has more BPD than her vault debt
      const aliceBal = await bpdToken.balanceOf(alice)
      const aliceDebt = await getVaultEntireDebt(alice)
      assert.isTrue(aliceBal.gt(aliceDebt))

      // check Recovery Mode 
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(1, 18))

      // Check Recovery Mode 
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Alice attempts to close her vault
      await assertRevert(borrowerOperations.closeVault({ from: alice }), "BorrowerOps: Operation not permitted during Recovery Mode")
    })

    it("closeVault(): reduces a Vault's collateral to zero", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollBefore = await getVaultEntireColl(alice)
      const dennisBPD = await bpdToken.balanceOf(dennis)
      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(dennisBPD.gt(toBN('0')))

      // To compensate borrowing fees
      await bpdToken.transfer(alice, dennisBPD.div(toBN(2)), { from: dennis })

      // Alice attempts to close vault
      await borrowerOperations.closeVault({ from: alice })

      const aliceCollAfter = await getVaultEntireColl(alice)
      assert.equal(aliceCollAfter, '0')
    })

    it("closeVault(): reduces a Vault's debt to zero", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getVaultEntireColl(alice)
      const dennisBPD = await bpdToken.balanceOf(dennis)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(dennisBPD.gt(toBN('0')))

      // To compensate borrowing fees
      await bpdToken.transfer(alice, dennisBPD.div(toBN(2)), { from: dennis })

      // Alice attempts to close vault
      await borrowerOperations.closeVault({ from: alice })

      const aliceCollAfter = await getVaultEntireColl(alice)
      assert.equal(aliceCollAfter, '0')
    })

    it("closeVault(): sets Vault's stake to zero", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceStakeBefore = await getVaultStake(alice)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))

      const dennisBPD = await bpdToken.balanceOf(dennis)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))
      assert.isTrue(dennisBPD.gt(toBN('0')))

      // To compensate borrowing fees
      await bpdToken.transfer(alice, dennisBPD.div(toBN(2)), { from: dennis })

      // Alice attempts to close vault
      await borrowerOperations.closeVault({ from: alice })

      const stakeAfter = ((await vaultManager.Vaults(alice))[2]).toString()
      assert.equal(stakeAfter, '0')
      // check withdrawal was successful
    })

    it("closeVault(): zero's the vaults reward snapshots", async () => {
      // Dennis opens vault and transfers tokens to alice
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate Bob
      await vaultManager.liquidate(bob)
      assert.isFalse(await sortedVaults.contains(bob))

      // Price bounces back
      await priceFeed.setPrice(dec(200, 18))

      // Alice and Carol open vaults
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Price drops ...again
      await priceFeed.setPrice(dec(100, 18))

      // Get Alice's pending reward snapshots 
      const L_RBTC_A_Snapshot = (await vaultManager.rewardSnapshots(alice))[0]
      const B_BPDDebt_A_Snapshot = (await vaultManager.rewardSnapshots(alice))[1]
      assert.isTrue(L_RBTC_A_Snapshot.gt(toBN('0')))
      assert.isTrue(B_BPDDebt_A_Snapshot.gt(toBN('0')))

      // Liquidate Carol
      await vaultManager.liquidate(carol)
      assert.isFalse(await sortedVaults.contains(carol))

      // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
      const L_RBTC_Snapshot_A_AfterLiquidation = (await vaultManager.rewardSnapshots(alice))[0]
      const B_BPDDebt_Snapshot_A_AfterLiquidation = (await vaultManager.rewardSnapshots(alice))[1]

      assert.isTrue(L_RBTC_Snapshot_A_AfterLiquidation.gt(toBN('0')))
      assert.isTrue(B_BPDDebt_Snapshot_A_AfterLiquidation.gt(toBN('0')))

      // to compensate borrowing fees
      await bpdToken.transfer(alice, await bpdToken.balanceOf(dennis), { from: dennis })

      await priceFeed.setPrice(dec(200, 18))

      // Alice closes vault
      await borrowerOperations.closeVault({ from: alice })

      // Check Alice's pending reward snapshots are zero
      const L_RBTC_Snapshot_A_afterAliceCloses = (await vaultManager.rewardSnapshots(alice))[0]
      const B_BPDDebt_Snapshot_A_afterAliceCloses = (await vaultManager.rewardSnapshots(alice))[1]

      assert.equal(L_RBTC_Snapshot_A_afterAliceCloses, '0')
      assert.equal(B_BPDDebt_Snapshot_A_afterAliceCloses, '0')
    })

    it("closeVault(): sets vault's status to closed and removes it from sorted vaults list", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Vault is active
      const alice_Vault_Before = await vaultManager.Vaults(alice)
      const status_Before = alice_Vault_Before[3]

      assert.equal(status_Before, 1)
      assert.isTrue(await sortedVaults.contains(alice))

      // to compensate borrowing fees
      await bpdToken.transfer(alice, await bpdToken.balanceOf(dennis), { from: dennis })

      // Close the vault
      await borrowerOperations.closeVault({ from: alice })

      const alice_Vault_After = await vaultManager.Vaults(alice)
      const status_After = alice_Vault_After[3]

      assert.equal(status_After, 2)
      assert.isFalse(await sortedVaults.contains(alice))
    })

    it("closeVault(): reduces ActivePool RBTC and raw ether by correct amount", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const dennisColl = await getVaultEntireColl(dennis)
      const aliceColl = await getVaultEntireColl(alice)
      assert.isTrue(dennisColl.gt('0'))
      assert.isTrue(aliceColl.gt('0'))

      // Check active Pool RBTC before
      const activePool_RBTC_before = await activePool.getETH()
      const activePool_RawEther_before = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_before.eq(aliceColl.add(dennisColl)))
      assert.isTrue(activePool_RBTC_before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_before.eq(activePool_RBTC_before))

      // to compensate borrowing fees
      await bpdToken.transfer(alice, await bpdToken.balanceOf(dennis), { from: dennis })

      // Close the vault
      await borrowerOperations.closeVault({ from: alice })

      // Check after
      const activePool_RBTC_After = await activePool.getETH()
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_After.eq(dennisColl))
      assert.isTrue(activePool_RawEther_After.eq(dennisColl))
    })

    it("closeVault(): reduces ActivePool debt by correct amount", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const dennisDebt = await getVaultEntireDebt(dennis)
      const aliceDebt = await getVaultEntireDebt(alice)
      assert.isTrue(dennisDebt.gt('0'))
      assert.isTrue(aliceDebt.gt('0'))

      // Check before
      const activePool_Debt_before = await activePool.getBPDDebt()
      assert.isTrue(activePool_Debt_before.eq(aliceDebt.add(dennisDebt)))
      assert.isTrue(activePool_Debt_before.gt(toBN('0')))

      // to compensate borrowing fees
      await bpdToken.transfer(alice, await bpdToken.balanceOf(dennis), { from: dennis })

      // Close the vault
      await borrowerOperations.closeVault({ from: alice })

      // Check after
      const activePool_Debt_After = (await activePool.getBPDDebt()).toString()
      th.assertIsApproximatelyEqual(activePool_Debt_After, dennisDebt)
    })

    it("closeVault(): updates the the total stakes", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Get individual stakes
      const aliceStakeBefore = await getVaultStake(alice)
      const bobStakeBefore = await getVaultStake(bob)
      const dennisStakeBefore = await getVaultStake(dennis)
      assert.isTrue(aliceStakeBefore.gt('0'))
      assert.isTrue(bobStakeBefore.gt('0'))
      assert.isTrue(dennisStakeBefore.gt('0'))

      const totalStakesBefore = await vaultManager.totalStakes()

      assert.isTrue(totalStakesBefore.eq(aliceStakeBefore.add(bobStakeBefore).add(dennisStakeBefore)))

      // to compensate borrowing fees
      await bpdToken.transfer(alice, await bpdToken.balanceOf(dennis), { from: dennis })

      // Alice closes vault
      await borrowerOperations.closeVault({ from: alice })

      // Check stake and total stakes get updated
      const aliceStakeAfter = await getVaultStake(alice)
      const totalStakesAfter = await vaultManager.totalStakes()

      assert.equal(aliceStakeAfter, 0)
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(aliceStakeBefore)))
    })

    if (!withProxy) { // TODO: wrap web3.eth.getBalance to be able to go through proxies
      it("closeVault(): sends the correct amount of RBTC to the user", async () => {
        await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
        await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

        const aliceColl = await getVaultEntireColl(alice)
        assert.isTrue(aliceColl.gt(toBN('0')))

        const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))

        // to compensate borrowing fees
        await bpdToken.transfer(alice, await bpdToken.balanceOf(dennis), { from: dennis })

        await borrowerOperations.closeVault({ from: alice, gasPrice: 0 })

        const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
        const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

        assert.isTrue(balanceDiff.eq(aliceColl))
      })
    }

    it("closeVault(): subtracts the debt of the closed Vault from the Borrower's BPDToken balance", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebt = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      // to compensate borrowing fees
      await bpdToken.transfer(alice, await bpdToken.balanceOf(dennis), { from: dennis })

      const alice_BPDBalance_Before = await bpdToken.balanceOf(alice)
      assert.isTrue(alice_BPDBalance_Before.gt(toBN('0')))

      // close vault
      await borrowerOperations.closeVault({ from: alice })

      // check alice BPD balance after
      const alice_BPDBalance_After = await bpdToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_BPDBalance_After, alice_BPDBalance_Before.sub(aliceDebt.sub(BPD_GAS_COMPENSATION)))
    })

    it("closeVault(): applies pending rewards", async () => {
      // --- SETUP ---
      await openVault({ extraBPDAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      const whaleDebt = await getVaultEntireDebt(whale)
      const whaleColl = await getVaultEntireColl(whale)

      await openVault({ extraBPDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolDebt = await getVaultEntireDebt(carol)
      const carolColl = await getVaultEntireColl(carol)

      // Whale transfers to A and B to cover their fees
      await bpdToken.transfer(alice, dec(10000, 18), { from: whale })
      await bpdToken.transfer(bob, dec(10000, 18), { from: whale })

      // --- TEST ---

      // price drops to 1ETH:100BPD, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice()

      // liquidate Carol's Vault, Alice and Bob earn rewards.
      const liquidationTx = await vaultManager.liquidate(carol, { from: owner });
      const [liquidatedDebt_C, liquidatedColl_C, gasComp_C] = th.getEmittedLiquidationValues(liquidationTx)

      // Dennis opens a new Vault 
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // check Alice and Bob's reward snapshots are zero before they alter their Vaults
      const alice_rewardSnapshot_Before = await vaultManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_BPDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await vaultManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_BPDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_BPDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_BPDDebtRewardSnapshot_Before, 0)

      const defaultPool_ETH = await defaultPool.getETH()
      const defaultPool_BPDDebt = await defaultPool.getBPDDebt()

      // Carol's liquidated coll (1 RBTC) and drawn debt should have entered the Default Pool
      assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColl_C), 100)
      assert.isAtMost(th.getDifference(defaultPool_BPDDebt, liquidatedDebt_C), 100)

      const pendingCollReward_A = await vaultManager.getPendingETHReward(alice)
      const pendingDebtReward_A = await vaultManager.getPendingBPDDebtReward(alice)
      assert.isTrue(pendingCollReward_A.gt('0'))
      assert.isTrue(pendingDebtReward_A.gt('0'))

      // Close Alice's vault. Alice's pending rewards should be removed from the DefaultPool when she close.
      await borrowerOperations.closeVault({ from: alice })

      const defaultPool_RBTC_afterAliceCloses = await defaultPool.getETH()
      const defaultPool_BPDDebt_afterAliceCloses = await defaultPool.getBPDDebt()

      assert.isAtMost(th.getDifference(defaultPool_RBTC_afterAliceCloses,
        defaultPool_ETH.sub(pendingCollReward_A)), 1000)
      assert.isAtMost(th.getDifference(defaultPool_BPDDebt_afterAliceCloses,
        defaultPool_BPDDebt.sub(pendingDebtReward_A)), 1000)

      // whale adjusts vault, pulling their rewards out of DefaultPool
      await borrowerOperations.adjustVault(th._100pct, 0, dec(1, 18), true, whale, whale, { from: whale })

      // Close Bob's vault. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
      await borrowerOperations.closeVault({ from: bob })

      const defaultPool_RBTC_afterBobCloses = await defaultPool.getETH()
      const defaultPool_BPDDebt_afterBobCloses = await defaultPool.getBPDDebt()

      assert.isAtMost(th.getDifference(defaultPool_RBTC_afterBobCloses, 0), 100000)
      assert.isAtMost(th.getDifference(defaultPool_BPDDebt_afterBobCloses, 0), 100000)
    })

    it("closeVault(): reverts if borrower has insufficient BPD balance to repay his entire debt", async () => {
      await openVault({ extraBPDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      //Confirm Bob's BPD balance is less than his vault debt
      const B_BPDBal = await bpdToken.balanceOf(B)
      const B_vaultDebt = await getVaultEntireDebt(B)

      assert.isTrue(B_BPDBal.lt(B_vaultDebt))

      const closeVaultPromise_B = borrowerOperations.closeVault({ from: B })

      // Check closing vault reverts
      await assertRevert(closeVaultPromise_B, "BorrowerOps: Caller doesnt have enough BPD to make repayment")
    })

    // --- openVault() ---

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openVault(): emits a VaultUpdated event with the correct collateral and debt", async () => {
        const txA = (await openVault({ extraBPDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })).tx
        const txB = (await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })).tx
        const txC = (await openVault({ extraBPDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })).tx

        const A_Coll = await getVaultEntireColl(A)
        const B_Coll = await getVaultEntireColl(B)
        const C_Coll = await getVaultEntireColl(C)
        const A_Debt = await getVaultEntireDebt(A)
        const B_Debt = await getVaultEntireDebt(B)
        const C_Debt = await getVaultEntireDebt(C)

        const A_emittedDebt = toBN(th.getEventArgByName(txA, "VaultUpdated", "_debt"))
        const A_emittedColl = toBN(th.getEventArgByName(txA, "VaultUpdated", "_coll"))
        const B_emittedDebt = toBN(th.getEventArgByName(txB, "VaultUpdated", "_debt"))
        const B_emittedColl = toBN(th.getEventArgByName(txB, "VaultUpdated", "_coll"))
        const C_emittedDebt = toBN(th.getEventArgByName(txC, "VaultUpdated", "_debt"))
        const C_emittedColl = toBN(th.getEventArgByName(txC, "VaultUpdated", "_coll"))

        // Check emitted debt values are correct
        assert.isTrue(A_Debt.eq(A_emittedDebt))
        assert.isTrue(B_Debt.eq(B_emittedDebt))
        assert.isTrue(C_Debt.eq(C_emittedDebt))

        // Check emitted coll values are correct
        assert.isTrue(A_Coll.eq(A_emittedColl))
        assert.isTrue(B_Coll.eq(B_emittedColl))
        assert.isTrue(C_Coll.eq(C_emittedColl))

        const baseRateBefore = await vaultManager.baseRate()

        // Artificially make baseRate 5%
        await vaultManager.setBaseRate(dec(5, 16))
        await vaultManager.setLastFeeOpTimeToNow()

        assert.isTrue((await vaultManager.baseRate()).gt(baseRateBefore))

        const txD = (await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })).tx
        const txE = (await openVault({ extraBPDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })).tx
        const D_Coll = await getVaultEntireColl(D)
        const E_Coll = await getVaultEntireColl(E)
        const D_Debt = await getVaultEntireDebt(D)
        const E_Debt = await getVaultEntireDebt(E)

        const D_emittedDebt = toBN(th.getEventArgByName(txD, "VaultUpdated", "_debt"))
        const D_emittedColl = toBN(th.getEventArgByName(txD, "VaultUpdated", "_coll"))

        const E_emittedDebt = toBN(th.getEventArgByName(txE, "VaultUpdated", "_debt"))
        const E_emittedColl = toBN(th.getEventArgByName(txE, "VaultUpdated", "_coll"))

        // Check emitted debt values are correct
        assert.isTrue(D_Debt.eq(D_emittedDebt))
        assert.isTrue(E_Debt.eq(E_emittedDebt))

        // Check emitted coll values are correct
        assert.isTrue(D_Coll.eq(D_emittedColl))
        assert.isTrue(E_Coll.eq(E_emittedColl))
      })
    }

    it("openVault(): Opens a vault with net debt >= minimum net debt", async () => {
      // Add 1 wei to correct for rounding error in helper function
      const txA = await borrowerOperations.openVault(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1))), A, A, { from: A, value: dec(100, 30) })
      assert.isTrue(txA.receipt.status)
      assert.isTrue(await sortedVaults.contains(A))

      const txC = await borrowerOperations.openVault(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22)))), A, A, { from: C, value: dec(100, 30) })
      assert.isTrue(txC.receipt.status)
      assert.isTrue(await sortedVaults.contains(C))
    })

    it("openVault(): reverts if net debt < minimum net debt", async () => {
      const txAPromise = borrowerOperations.openVault(th._100pct, 0, A, A, { from: A, value: dec(100, 30) })
      await assertRevert(txAPromise, "revert")

      const txBPromise = borrowerOperations.openVault(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1))), B, B, { from: B, value: dec(100, 30) })
      await assertRevert(txBPromise, "revert")

      const txCPromise = borrowerOperations.openVault(th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), C, C, { from: C, value: dec(100, 30) })
      await assertRevert(txCPromise, "revert")
    })

    it("openVault(): decays a non-zero base rate", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens vault 
      await openVault({ extraBPDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate has decreased
      const baseRate_2 = await vaultManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens vault 
      await openVault({ extraBPDAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const baseRate_3 = await vaultManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("openVault(): doesn't change base rate if it is already zero", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens vault 
      await openVault({ extraBPDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is still 0
      const baseRate_2 = await vaultManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens vault 
      await openVault({ extraBPDAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const baseRate_3 = await vaultManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("openVault(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await vaultManager.lastFeeOperationTime()

      // Borrower D triggers a fee
      await openVault({ extraBPDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const lastFeeOpTime_2 = await vaultManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

      // Borrower E triggers a fee
      await openVault({ extraBPDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const lastFeeOpTime_3 = await vaultManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("openVault(): reverts if max fee > 100%", async () => {
      await assertRevert(borrowerOperations.openVault(dec(2, 18), dec(10000, 18), A, A, { from: A, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openVault('1000000000000000001', dec(20000, 18), B, B, { from: B, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("openVault(): reverts if max fee < 0.5% in Normal mode", async () => {
      await assertRevert(borrowerOperations.openVault(0, dec(195000, 18), A, A, { from: A, value: dec(1200, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openVault(1, dec(195000, 18), A, A, { from: A, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openVault('4999999999999999', dec(195000, 18), B, B, { from: B, value: dec(1200, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("openVault(): allows max fee < 0.5% in Recovery Mode", async () => {
      await borrowerOperations.openVault(th._100pct, dec(195000, 18), A, A, { from: A, value: dec(2000, 'ether') })

      await priceFeed.setPrice(dec(100, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))

      await borrowerOperations.openVault(0, dec(19500, 18), B, B, { from: B, value: dec(3100, 'ether') })
      await priceFeed.setPrice(dec(50, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await borrowerOperations.openVault(1, dec(19500, 18), C, C, { from: C, value: dec(3100, 'ether') })
      await priceFeed.setPrice(dec(25, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await borrowerOperations.openVault('4999999999999999', dec(19500, 18), D, D, { from: D, value: dec(3100, 'ether') })
    })

    it("openVault(): reverts if fee exceeds max fee percentage", async () => {
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      const totalSupply = await bpdToken.totalSupply()

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      //       actual fee percentage: 0.005000000186264514
      // user's max fee percentage:  0.0049999999999999999
      let borrowingRate = await vaultManager.getBorrowingRate() // expect max(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.openVault(lessThan5pct, dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")

      borrowingRate = await vaultManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.openVault(dec(1, 16), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")

      borrowingRate = await vaultManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.openVault(dec(3754, 13), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")

      borrowingRate = await vaultManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 1e-16%
      await assertRevert(borrowerOperations.openVault(dec(5, 15), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")
    })

    it("openVault(): succeeds when fee is less than max fee percentage", async () => {
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      let borrowingRate = await vaultManager.getBorrowingRate() // expect min(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.openVault(moreThan5pct, dec(10000, 18), A, A, { from: D, value: dec(100, 'ether') })
      assert.isTrue(tx1.receipt.status)

      borrowingRate = await vaultManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.openVault(dec(5, 16), dec(10000, 18), A, A, { from: H, value: dec(100, 'ether') })
      assert.isTrue(tx2.receipt.status)

      borrowingRate = await vaultManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.openVault(dec(1, 17), dec(10000, 18), A, A, { from: E, value: dec(100, 'ether') })
      assert.isTrue(tx3.receipt.status)

      borrowingRate = await vaultManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.openVault(dec(37659, 13), dec(10000, 18), A, A, { from: F, value: dec(100, 'ether') })
      assert.isTrue(tx4.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.openVault(dec(1, 18), dec(10000, 18), A, A, { from: G, value: dec(100, 'ether') })
      assert.isTrue(tx5.receipt.status)
    })

    it("openVault(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 59 minutes pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Assume Borrower also owns accounts D and E
      // Borrower triggers a fee, before decay interval has passed
      await openVault({ extraBPDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // 1 minute pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Borrower triggers another fee
      await openVault({ extraBPDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await vaultManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("openVault(): borrowing at non-zero base rate sends BPD fee to MP staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP BPD balance before == 0
      const mpStaking_BPDBalance_Before = await bpdToken.balanceOf(mpStaking.address)
      assert.equal(mpStaking_BPDBalance_Before, '0')

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens vault 
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check MP BPD balance after has increased
      const mpStaking_BPDBalance_After = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStaking_BPDBalance_After.gt(mpStaking_BPDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openVault(): borrowing at non-zero base records the (drawn debt + fee  + liq. reserve) on the Vault struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 MP
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
        await mpStaking.stake(dec(1, 18), { from: multisig })

        await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

        // Artificially make baseRate 5%
        await vaultManager.setBaseRate(dec(5, 16))
        await vaultManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await vaultManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const D_BPDRequest = toBN(dec(20000, 18))

        // D withdraws BPD
        const openVaultTx = await borrowerOperations.openVault(th._100pct, D_BPDRequest, ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(200, 'ether') })

        const emittedFee = toBN(th.getBPDFeeFromBPDBorrowingEvent(openVaultTx))
        assert.isTrue(toBN(emittedFee).gt(toBN('0')))

        const newDebt = (await vaultManager.Vaults(D))[0]

        // Check debt on Vault struct equals drawn debt plus emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_BPDRequest.add(emittedFee).add(BPD_GAS_COMPENSATION), 100000)
      })
    }

    it("openVault(): Borrowing at non-zero base rate increases the MP staking contract BPD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP contract BPD fees-per-unit-staked is zero
      const F_BPD_Before = await mpStaking.F_BPD()
      assert.equal(F_BPD_Before, '0')

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens vault 
      await openVault({ extraBPDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check MP contract BPD fees-per-unit-staked has increased
      const F_BPD_After = await mpStaking.F_BPD()
      assert.isTrue(F_BPD_After.gt(F_BPD_Before))
    })

    it("openVault(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 MP
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
      await mpStaking.stake(dec(1, 18), { from: multisig })

      // Check MP Staking contract balance before == 0
      const mpStaking_BPDBalance_Before = await bpdToken.balanceOf(mpStaking.address)
      assert.equal(mpStaking_BPDBalance_Before, '0')

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await vaultManager.setBaseRate(dec(5, 16))
      await vaultManager.setLastFeeOpTimeToNow()

      // Check baseRate is non-zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens vault 
      const BPDRequest_D = toBN(dec(40000, 18))
      await borrowerOperations.openVault(th._100pct, BPDRequest_D, D, D, { from: D, value: dec(500, 'ether') })

      // Check MP staking BPD balance has increased
      const mpStaking_BPDBalance_After = await bpdToken.balanceOf(mpStaking.address)
      assert.isTrue(mpStaking_BPDBalance_After.gt(mpStaking_BPDBalance_Before))

      // Check D's BPD balance now equals their requested BPD
      const BPDBalance_D = await bpdToken.balanceOf(D)
      assert.isTrue(BPDRequest_D.eq(BPDBalance_D))
    })

    it("openVault(): Borrowing at zero base rate changes the MP staking contract BPD fees-per-unit-staked", async () => {
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Check baseRate is zero
      const baseRate_1 = await vaultManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check BPD reward per MP staked == 0
      const F_BPD_Before = await mpStaking.F_BPD()
      assert.equal(F_BPD_Before, '0')

      // A stakes MP
      await mpToken.unprotectedMint(A, dec(100, 18))
      await mpStaking.stake(dec(100, 18), { from: A })

      // D opens vault 
      await openVault({ extraBPDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check BPD reward per MP staked > 0
      const F_BPD_After = await mpStaking.F_BPD()
      assert.isTrue(F_BPD_After.gt(toBN('0')))
    })

    it("openVault(): Borrowing at zero base rate charges minimum fee", async () => {
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      const BPDRequest = toBN(dec(10000, 18))
      const txC = await borrowerOperations.openVault(th._100pct, BPDRequest, ZERO_ADDRESS, ZERO_ADDRESS, { value: dec(100, 'ether'), from: C })
      const _BPDFee = toBN(th.getEventArgByName(txC, "BPDBorrowingFeePaid", "_BPDFee"))

      const expectedFee = BORROWING_FEE_FLOOR.mul(toBN(BPDRequest)).div(toBN(dec(1, 18)))
      assert.isTrue(_BPDFee.eq(expectedFee))
    })

    it("openVault(): reverts when system is in Recovery Mode and ICR < CCR", async () => {
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Bob tries to open a vault with 149% ICR during Recovery Mode
      try {
        const txBob = await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: alice } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openVault(): reverts when vault ICR < MCR", async () => {
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob attempts to open a 109% ICR vault in Normal Mode
      try {
        const txBob = (await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })).tx
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Bob attempts to open a 109% ICR vault in Recovery Mode
      try {
        const txBob = await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openVault(): reverts when opening the vault would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      // Alice creates vault with 150% ICR.  System TCR = 150%.
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TCR = await th.getTCR(contracts)
      assert.equal(TCR, dec(150, 16))

      // Bob attempts to open a vault with ICR = 149% 
      // System TCR would fall below 150%
      try {
        const txBob = await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openVault(): reverts if vault is already active", async () => {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      try {
        const txB_1 = await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: bob } })

        assert.isFalse(txB_1.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const txB_2 = await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

        assert.isFalse(txB_2.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("openVault(): Can open a vault with ICR >= CCR when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // price drops to 1ETH:100BPD, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Carol opens at 150% ICR in Recovery Mode
      const txCarol = (await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: carol } })).tx
      assert.isTrue(txCarol.receipt.status)
      assert.isTrue(await sortedVaults.contains(carol))

      const carol_VaultStatus = await vaultManager.getVaultStatus(carol)
      assert.equal(carol_VaultStatus, 1)

      const carolICR = await vaultManager.getCurrentICR(carol, price)
      assert.isTrue(carolICR.gt(toBN(dec(150, 16))))
    })

    it("openVault(): Reverts opening a vault with min debt when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // price drops to 1ETH:100BPD, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');

      assert.isTrue(await th.checkRecoveryMode(contracts))

      await assertRevert(borrowerOperations.openVault(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT), carol, carol, { from: carol, value: dec(1, 'ether') }))
    })

    it("openVault(): creates a new Vault and assigns the correct collateral and debt amount", async () => {
      const debt_Before = await getVaultEntireDebt(alice)
      const coll_Before = await getVaultEntireColl(alice)
      const status_Before = await vaultManager.getVaultStatus(alice)

      // check coll and debt before
      assert.equal(debt_Before, 0)
      assert.equal(coll_Before, 0)

      // check non-existent status
      assert.equal(status_Before, 0)

      const BPDRequest = MIN_NET_DEBT
      borrowerOperations.openVault(th._100pct, MIN_NET_DEBT, carol, carol, { from: alice, value: dec(100, 'ether') })

      // Get the expected debt based on the BPD request (adding fee and liq. reserve on top)
      const expectedDebt = BPDRequest
        .add(await vaultManager.getBorrowingFee(BPDRequest))
        .add(BPD_GAS_COMPENSATION)

      const debt_After = await getVaultEntireDebt(alice)
      const coll_After = await getVaultEntireColl(alice)
      const status_After = await vaultManager.getVaultStatus(alice)

      // check coll and debt after
      assert.isTrue(coll_After.gt('0'))
      assert.isTrue(debt_After.gt('0'))

      assert.isTrue(debt_After.eq(expectedDebt))

      // check active status
      assert.equal(status_After, 1)
    })

    it("openVault(): adds Vault owner to VaultOwners array", async () => {
      const VaultOwnersCount_Before = (await vaultManager.getVaultOwnersCount()).toString();
      assert.equal(VaultOwnersCount_Before, '0')

      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const VaultOwnersCount_After = (await vaultManager.getVaultOwnersCount()).toString();
      assert.equal(VaultOwnersCount_After, '1')
    })

    it("openVault(): creates a stake and adds it to total stakes", async () => {
      const aliceStakeBefore = await getVaultStake(alice)
      const totalStakesBefore = await vaultManager.totalStakes()

      assert.equal(aliceStakeBefore, '0')
      assert.equal(totalStakesBefore, '0')

      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollAfter = await getVaultEntireColl(alice)
      const aliceStakeAfter = await getVaultStake(alice)
      assert.isTrue(aliceCollAfter.gt(toBN('0')))
      assert.isTrue(aliceStakeAfter.eq(aliceCollAfter))

      const totalStakesAfter = await vaultManager.totalStakes()

      assert.isTrue(totalStakesAfter.eq(aliceStakeAfter))
    })

    it("openVault(): inserts Vault to Sorted Vaults list", async () => {
      // Check before
      const aliceVaultInList_Before = await sortedVaults.contains(alice)
      const listIsEmpty_Before = await sortedVaults.isEmpty()
      assert.equal(aliceVaultInList_Before, false)
      assert.equal(listIsEmpty_Before, true)

      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check after
      const aliceVaultInList_After = await sortedVaults.contains(alice)
      const listIsEmpty_After = await sortedVaults.isEmpty()
      assert.equal(aliceVaultInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("openVault(): Increases the activePool RBTC and raw ether balance by correct amount", async () => {
      const activePool_RBTC_Before = await activePool.getETH()
      const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
      assert.equal(activePool_RBTC_Before, 0)
      assert.equal(activePool_RawEther_Before, 0)

      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollAfter = await getVaultEntireColl(alice)

      const activePool_RBTC_After = await activePool.getETH()
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_RBTC_After.eq(aliceCollAfter))
      assert.isTrue(activePool_RawEther_After.eq(aliceCollAfter))
    })

    it("openVault(): records up-to-date initial snapshots of L_ETH and B_BPDDebt", async () => {
      // --- SETUP ---

      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // --- TEST ---

      // price drops to 1ETH:100BPD, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));

      // close Carol's Vault, liquidating her 1 ether and 180BPD.
      const liquidationTx = await vaultManager.liquidate(carol, { from: owner });
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
       and B_BPD should equal 18 BPD per-ether-staked. */

      const L_ETH = await vaultManager.L_ETH()
      const B_BPD = await vaultManager.B_BPDDebt()

      assert.isTrue(L_ETH.gt(toBN('0')))
      assert.isTrue(B_BPD.gt(toBN('0')))

      // Bob opens vault
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Check Bob's snapshots of L_ETH and B_BPD equal the respective current values
      const bob_rewardSnapshot = await vaultManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
      const bob_BPDDebtRewardSnapshot = bob_rewardSnapshot[1]

      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 1000)
      assert.isAtMost(th.getDifference(bob_BPDDebtRewardSnapshot, B_BPD), 1000)
    })

    it("openVault(): allows a user to open a Vault, then close it, then re-open it", async () => {
      // Open Vaults
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Check Vault is active
      const alice_Vault_1 = await vaultManager.Vaults(alice)
      const status_1 = alice_Vault_1[3]
      assert.equal(status_1, 1)
      assert.isTrue(await sortedVaults.contains(alice))

      // to compensate borrowing fees
      await bpdToken.transfer(alice, dec(10000, 18), { from: whale })

      // Repay and close Vault
      await borrowerOperations.closeVault({ from: alice })

      // Check Vault is closed
      const alice_Vault_2 = await vaultManager.Vaults(alice)
      const status_2 = alice_Vault_2[3]
      assert.equal(status_2, 2)
      assert.isFalse(await sortedVaults.contains(alice))

      // Re-open Vault
      await openVault({ extraBPDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Vault is re-opened
      const alice_Vault_3 = await vaultManager.Vaults(alice)
      const status_3 = alice_Vault_3[3]
      assert.equal(status_3, 1)
      assert.isTrue(await sortedVaults.contains(alice))
    })

    it("openVault(): increases the Vault's BPD debt by the correct amount", async () => {
      // check before
      const alice_Vault_Before = await vaultManager.Vaults(alice)
      const debt_Before = alice_Vault_Before[0]
      assert.equal(debt_Before, 0)

      await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(10000, 18)), alice, alice, { from: alice, value: dec(100, 'ether') })

      // check after
      const alice_Vault_After = await vaultManager.Vaults(alice)
      const debt_After = alice_Vault_After[0]
      th.assertIsApproximatelyEqual(debt_After, dec(10000, 18), 10000)
    })

    it("openVault(): increases BPD debt in ActivePool by the debt of the vault", async () => {
      const activePool_BPDDebt_Before = await activePool.getBPDDebt()
      assert.equal(activePool_BPDDebt_Before, 0)

      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceDebt = await getVaultEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      const activePool_BPDDebt_After = await activePool.getBPDDebt()
      assert.isTrue(activePool_BPDDebt_After.eq(aliceDebt))
    })

    it("openVault(): increases user BPDToken balance by correct amount", async () => {
      // check before
      const alice_BPDTokenBalance_Before = await bpdToken.balanceOf(alice)
      assert.equal(alice_BPDTokenBalance_Before, 0)

      await borrowerOperations.openVault(th._100pct, dec(10000, 18), alice, alice, { from: alice, value: dec(100, 'ether') })

      // check after
      const alice_BPDTokenBalance_After = await bpdToken.balanceOf(alice)
      assert.equal(alice_BPDTokenBalance_After, dec(10000, 18))
    })

    //  --- getNewICRFromVaultChange - (external wrapper in Tester contract calls internal function) ---

    describe("getNewICRFromVaultChange() returns the correct ICR", async () => {


      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.isAtMost(th.getDifference(newICR, '1333333333333333333'), 100)
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
        assert.equal(newICR, '1000000000000000000')
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, false, debtChange, false, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
        assert.equal(newICR, '8000000000000000000')
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = dec(100, 18)

        const newICR = (await borrowerOperations.getNewICRFromVaultChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
        assert.equal(newICR, '500000000000000000')
      })
    })

    // --- getCompositeDebt ---

    it("getCompositeDebt(): returns debt + gas comp", async () => {
      const res1 = await borrowerOperations.getCompositeDebt('0')
      assert.equal(res1, BPD_GAS_COMPENSATION.toString())

      const res2 = await borrowerOperations.getCompositeDebt(dec(90, 18))
      th.assertIsApproximatelyEqual(res2, BPD_GAS_COMPENSATION.add(toBN(dec(90, 18))))

      const res3 = await borrowerOperations.getCompositeDebt(dec(24423422357345049, 12))
      th.assertIsApproximatelyEqual(res3, BPD_GAS_COMPENSATION.add(toBN(dec(24423422357345049, 12))))
    })

    //  --- getNewTCRFromVaultChange  - (external wrapper in Tester contract calls internal function) ---

    describe("getNewTCRFromVaultChange() returns the correct TCR", async () => {

      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = 0
        const newTCR = await borrowerOperations.getNewTCRFromVaultChange(collChange, true, debtChange, true, price)

        const expectedTCR = (vaultColl.add(liquidatedColl)).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = dec(200, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromVaultChange(collChange, true, debtChange, true, price))

        const expectedTCR = (vaultColl.add(liquidatedColl)).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = 0
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromVaultChange(collChange, true, debtChange, false, price))

        const expectedTCR = (vaultColl.add(liquidatedColl)).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = dec(2, 'ether')
        const debtChange = 0
        const newTCR = (await borrowerOperations.getNewTCRFromVaultChange(collChange, true, debtChange, true, price))

        const expectedTCR = (vaultColl.add(liquidatedColl).add(toBN(collChange))).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = 0
        const newTCR = (await borrowerOperations.getNewTCRFromVaultChange(collChange, false, debtChange, true, price))

        const expectedTCR = (vaultColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromVaultChange(collChange, false, debtChange, false, price))

        const expectedTCR = (vaultColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromVaultChange(collChange, true, debtChange, true, price))

        const expectedTCR = (vaultColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt).add(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromVaultChange(collChange, true, debtChange, false, price))

        const expectedTCR = (vaultColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const vaultColl = toBN(dec(1000, 'ether'))
        const vaultTotalDebt = toBN(dec(100000, 18))
        const vaultBPDAmount = await getOpenVaultBPDAmount(vaultTotalDebt)
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, alice, alice, { from: alice, value: vaultColl })
        await borrowerOperations.openVault(th._100pct, vaultBPDAmount, bob, bob, { from: bob, value: vaultColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await vaultManager.liquidate(bob)
        assert.isFalse(await sortedVaults.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = await getNetBorrowingAmount(dec(200, 18))
        const newTCR = (await borrowerOperations.getNewTCRFromVaultChange(collChange, false, debtChange, true, price))

        const expectedTCR = (vaultColl.add(liquidatedColl).sub(toBN(collChange))).mul(price)
          .div(vaultTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })
    })

    if (!withProxy) {
      it('closeVault(): fails if owner cannot receive RBTC', async () => {
        const nonPayable = await NonPayable.new()

        // we need 2 vaults to be able to close 1 and have 1 remaining in the system
        await borrowerOperations.openVault(th._100pct, dec(100000, 18), alice, alice, { from: alice, value: dec(1000, 18) })

        // Alice sends BPD to NonPayable so its BPD balance covers its debt
        await bpdToken.transfer(nonPayable.address, dec(10000, 18), {from: alice})

        // open vault from NonPayable proxy contract
        const _100pctHex = '0xde0b6b3a7640000'
        const _1e25Hex = '0xd3c21bcecceda1000000'
        const openVaultData = th.getTransactionData('openVault(uint256,uint256,address,address)', [_100pctHex, _1e25Hex, '0x0', '0x0'])
        await nonPayable.forward(borrowerOperations.address, openVaultData, { value: dec(10000, 'ether') })
        assert.equal((await vaultManager.getVaultStatus(nonPayable.address)).toString(), '1', 'NonPayable proxy should have a vault')
        assert.isFalse(await th.checkRecoveryMode(contracts), 'System should not be in Recovery Mode')
        // open vault from NonPayable proxy contract
        const closeVaultData = th.getTransactionData('closeVault()', [])
        await th.assertRevert(nonPayable.forward(borrowerOperations.address, closeVaultData), 'ActivePool: sending RBTC failed')
      })
    }
  }

  describe('Without proxy', async () => {
    testCorpus({ withProxy: false })
  })

  // describe('With proxy', async () => {
  //   testCorpus({ withProxy: true })
  // })
})

contract('Reset chain state', async accounts => { })

/* TODO:

 1) Test SortedList re-ordering by ICR. ICR ratio
 changes with addColl, withdrawColl, withdrawBPD, repayBPD, etc. Can split them up and put them with
 individual functions, or give ordering it's own 'describe' block.

 2)In security phase:
 -'Negative' tests for all the above functions.
 */
