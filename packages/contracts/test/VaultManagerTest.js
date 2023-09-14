const { setNextBlockBaseFeePerGas } = require("@nomicfoundation/hardhat-network-helpers")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const VaultManagerTester = artifacts.require("./VaultManagerTester.sol")
const BPDTokenTester = artifacts.require("./BPDTokenTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues


/* NOTE: Some tests involving RBTC redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific RBTC gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the VaultManager, which is still TBD based on economic modelling.
 * 
 */ 
contract('VaultManager', async accounts => {

  const _18_zeros = '000000000000000000'
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale,
    A, B, C, D, E] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let bpdToken
  let sortedVaults
  let vaultManager
  let activePool
  let stabilityPool
  let collSurplusPool
  let defaultPool
  let borrowerOperations
  let hintHelpers

  let contracts

  const getOpenVaultTotalDebt = async (bpdAmount) => th.getOpenVaultTotalDebt(contracts, bpdAmount)
  const getOpenVaultBPDAmount = async (totalDebt) => th.getOpenVaultBPDAmount(contracts, totalDebt)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const openVault = async (params) => th.openVault(contracts, params)
  const withdrawBPD = async (params) => th.withdrawBPD(contracts, params)

  beforeEach(async () => {
    await setNextBlockBaseFeePerGas(0)
    contracts = await deploymentHelper.deployMoneypCore()
    contracts.vaultManager = await VaultManagerTester.new()
    contracts.bpdToken = await BPDTokenTester.new(
      contracts.vaultManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeed = contracts.priceFeedTestnet
    bpdToken = contracts.bpdToken
    sortedVaults = contracts.sortedVaults
    vaultManager = contracts.vaultManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    mpStaking = MPContracts.mpStaking
    mpToken = MPContracts.mpToken
    communityIssuance = MPContracts.communityIssuance
    lockupContractFactory = MPContracts.lockupContractFactory

    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)
  })

  it('liquidate(): closes a Vault that has ICR < MCR', async () => {
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })

    const price = await priceFeed.getPrice()
    const ICR_Before = await vaultManager.getCurrentICR(alice, price)
    assert.equal(ICR_Before, dec(4, 18))

    const MCR = (await vaultManager.MCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice increases debt to 180 BPD, lowering her ICR to 1.11
    const A_BPDWithdrawal = await getNetBorrowingAmount(dec(130, 18))

    const targetICR = toBN('1111111111111111111')
    await withdrawBPD({ ICR: targetICR, extraParams: { from: alice } })

    const ICR_AfterWithdrawal = await vaultManager.getCurrentICR(alice, price)
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal, targetICR), 100)

    // price drops to 1RBTC:100BPD, reducing Alice's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // close Vault
    await vaultManager.liquidate(alice, { from: owner });

    // check the Vault is successfully closed, and removed from sortedList
    const status = (await vaultManager.Vaults(alice))[3]
    assert.equal(status, 3)  // status enum 3 corresponds to "Closed by liquidation"
    const alice_Vault_isInSortedList = await sortedVaults.contains(alice)
    assert.isFalse(alice_Vault_isInSortedList)
  })

  it("liquidate(): decreases ActivePool RBTC and BPDDebt by correct amounts", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check ActivePool RBTC and BPD debt before
    const activePool_RBTC_Before = (await activePool.getRBTC()).toString()
    const activePool_RawBitcoin_Before = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_BPDDebt_Before = (await activePool.getBPDDebt()).toString()

    assert.equal(activePool_RBTC_Before, A_collateral.add(B_collateral))
    assert.equal(activePool_RawBitcoin_Before, A_collateral.add(B_collateral))
    th.assertIsApproximatelyEqual(activePool_BPDDebt_Before, A_totalDebt.add(B_totalDebt))

    // price drops to 1RBTC:100BPD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    /* close Bob's Vault. Should liquidate his ether and BPD, 
    leaving Alice’s ether and BPD debt in the ActivePool. */
    await vaultManager.liquidate(bob, { from: owner });

    // check ActivePool RBTC and BPD debt 
    const activePool_RBTC_After = (await activePool.getRBTC()).toString()
    const activePool_RawBitcoin_After = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_BPDDebt_After = (await activePool.getBPDDebt()).toString()

    assert.equal(activePool_RBTC_After, A_collateral)
    assert.equal(activePool_RawBitcoin_After, A_collateral)
    th.assertIsApproximatelyEqual(activePool_BPDDebt_After, A_totalDebt)
  })

  it("liquidate(): increases DefaultPool RBTC and BPD debt by correct amounts", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check DefaultPool RBTC and BPD debt before
    const defaultPool_RBTC_Before = (await defaultPool.getRBTC())
    const defaultPool_RawBitcoin_Before = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_BPDDebt_Before = (await defaultPool.getBPDDebt()).toString()

    assert.equal(defaultPool_RBTC_Before, '0')
    assert.equal(defaultPool_RawBitcoin_Before, '0')
    assert.equal(defaultPool_BPDDebt_Before, '0')

    // price drops to 1RBTC:100BPD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // close Bob's Vault
    await vaultManager.liquidate(bob, { from: owner });

    // check after
    const defaultPool_RBTC_After = (await defaultPool.getRBTC()).toString()
    const defaultPool_RawBitcoin_After = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_BPDDebt_After = (await defaultPool.getBPDDebt()).toString()

    const defaultPooB_RBTC = th.applyLiquidationFee(B_collateral)
    assert.equal(defaultPool_RBTC_After, defaultPooB_RBTC)
    assert.equal(defaultPool_RawBitcoin_After, defaultPooB_RBTC)
    th.assertIsApproximatelyEqual(defaultPool_BPDDebt_After, B_totalDebt)
  })

  it("liquidate(): removes the Vault's stake from the total stakes", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await vaultManager.totalStakes()).toString()
    assert.equal(totalStakes_Before, A_collateral.add(B_collateral))

    // price drops to 1RBTC:100BPD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Close Bob's Vault
    await vaultManager.liquidate(bob, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await vaultManager.totalStakes()).toString()
    assert.equal(totalStakes_After, A_collateral)
  })

  it("liquidate(): Removes the correct vault from the VaultOwners array, and moves the last array element to the new empty slot", async () => {
    // --- SETUP --- 
    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol, Dennis, Erin open vaults with consecutively decreasing collateral ratio
    await openVault({ ICR: toBN(dec(218, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(216, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(214, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(212, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    // At this stage, VaultOwners array should be: [W, A, B, C, D, E] 

    // Drop price
    await priceFeed.setPrice(dec(100, 18))

    const arrayLength_Before = await vaultManager.getVaultOwnersCount()
    assert.equal(arrayLength_Before, 6)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate carol
    await vaultManager.liquidate(carol)

    // Check Carol no longer has an active vault
    assert.isFalse(await sortedVaults.contains(carol))

    // Check length of array has decreased by 1
    const arrayLength_After = await vaultManager.getVaultOwnersCount()
    assert.equal(arrayLength_After, 5)

    /* After Carol is removed from array, the last element (Erin's address) should have been moved to fill 
    the empty slot left by Carol, and the array length decreased by one.  The final VaultOwners array should be:
  
    [W, A, B, E, D] 

    Check all remaining vaults in the array are in the correct order */
    const vault_0 = await vaultManager.VaultOwners(0)
    const vault_1 = await vaultManager.VaultOwners(1)
    const vault_2 = await vaultManager.VaultOwners(2)
    const vault_3 = await vaultManager.VaultOwners(3)
    const vault_4 = await vaultManager.VaultOwners(4)

    assert.equal(vault_0, whale)
    assert.equal(vault_1, alice)
    assert.equal(vault_2, bob)
    assert.equal(vault_3, erin)
    assert.equal(vault_4, dennis)

    // Check correct indices recorded on the active vault structs
    const whale_arrayIndex = (await vaultManager.Vaults(whale))[4]
    const alice_arrayIndex = (await vaultManager.Vaults(alice))[4]
    const bob_arrayIndex = (await vaultManager.Vaults(bob))[4]
    const dennis_arrayIndex = (await vaultManager.Vaults(dennis))[4]
    const erin_arrayIndex = (await vaultManager.Vaults(erin))[4]

    // [W, A, B, E, D] 
    assert.equal(whale_arrayIndex, 0)
    assert.equal(alice_arrayIndex, 1)
    assert.equal(bob_arrayIndex, 2)
    assert.equal(erin_arrayIndex, 3)
    assert.equal(dennis_arrayIndex, 4)
  })

  it("liquidate(): updates the snapshots of total stakes and total collateral", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check snapshots before 
    const totalStakesSnapshot_Before = (await vaultManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_Before = (await vaultManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnapshot_Before, '0')
    assert.equal(totalCollateralSnapshot_Before, '0')

    // price drops to 1RBTC:100BPD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // close Bob's Vault.  His ether*0.995 and BPD should be added to the DefaultPool.
    await vaultManager.liquidate(bob, { from: owner });

    /* check snapshots after. Total stakes should be equal to the  remaining stake then the system: 
    10 ether, Alice's stake.
     
    Total collateral should be equal to Alice's collateral plus her pending RBTC reward (Bob’s collaterale*0.995 ether), earned
    from the liquidation of Bob's Vault */
    const totalStakesSnapshot_After = (await vaultManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_After = (await vaultManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnapshot_After, A_collateral)
    assert.equal(totalCollateralSnapshot_After, A_collateral.add(th.applyLiquidationFee(B_collateral)))
  })

  it("liquidate(): updates the B_RBTC and B_BPDDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(8, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
    const { collateral: C_collateral, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(111, 16)), extraParams: { from: carol } })

    // --- TEST ---

    // price drops to 1RBTC:100BPD, reducing Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // close Carol's Vault.  
    assert.isTrue(await sortedVaults.contains(carol))
    await vaultManager.liquidate(carol, { from: owner });
    assert.isFalse(await sortedVaults.contains(carol))

    // Carol's ether*0.995 and BPD should be added to the DefaultPool.
    const L_RBTC_AfterCarolLiquidated = await vaultManager.B_RBTC()
    const B_BPDDebt_AfterCarolLiquidated = await vaultManager.B_BPDDebt()

    const L_RBTC_expected_1 = th.applyLiquidationFee(C_collateral).mul(mv._1e18BN).div(A_collateral.add(B_collateral))
    const B_BPDDebt_expected_1 = C_totalDebt.mul(mv._1e18BN).div(A_collateral.add(B_collateral))
    assert.isAtMost(th.getDifference(L_RBTC_AfterCarolLiquidated, L_RBTC_expected_1), 100)
    assert.isAtMost(th.getDifference(B_BPDDebt_AfterCarolLiquidated, B_BPDDebt_expected_1), 100)

    // Bob now withdraws BPD, bringing his ICR to 1.11
    const { increasedTotalDebt: B_increasedTotalDebt } = await withdrawBPD({ ICR: toBN(dec(111, 16)), extraParams: { from: bob } })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // price drops to 1RBTC:50BPD, reducing Bob's ICR below MCR
    await priceFeed.setPrice(dec(50, 18));
    const price = await priceFeed.getPrice()

    // close Bob's Vault 
    assert.isTrue(await sortedVaults.contains(bob))
    await vaultManager.liquidate(bob, { from: owner });
    assert.isFalse(await sortedVaults.contains(bob))

    /* Alice now has all the active stake. totalStakes in the system is now 10 ether.
   
   Bob's pending collateral reward and debt reward are applied to his Vault
   before his liquidation.
   His total collateral*0.995 and debt are then added to the DefaultPool. 
   
   The system rewards-per-unit-staked should now be:
   
   B_RBTC = (0.995 / 20) + (10.4975*0.995  / 10) = 1.09425125 RBTC
   B_BPDDebt = (180 / 20) + (890 / 10) = 98 BPD */
    const L_RBTC_AfterBobLiquidated = await vaultManager.B_RBTC()
    const B_BPDDebt_AfterBobLiquidated = await vaultManager.B_BPDDebt()

    const L_RBTC_expected_2 = L_RBTC_expected_1.add(th.applyLiquidationFee(B_collateral.add(B_collateral.mul(L_RBTC_expected_1).div(mv._1e18BN))).mul(mv._1e18BN).div(A_collateral))
    const B_BPDDebt_expected_2 = B_BPDDebt_expected_1.add(B_totalDebt.add(B_increasedTotalDebt).add(B_collateral.mul(B_BPDDebt_expected_1).div(mv._1e18BN)).mul(mv._1e18BN).div(A_collateral))
    assert.isAtMost(th.getDifference(L_RBTC_AfterBobLiquidated, L_RBTC_expected_2), 100)
    assert.isAtMost(th.getDifference(B_BPDDebt_AfterBobLiquidated, B_BPDDebt_expected_2), 100)
  })

  it("liquidate(): Liquidates undercollateralized vault if there are two vaults in the system", async () => {
    await openVault({ ICR: toBN(dec(200, 18)), extraParams: { from: bob, value: dec(100, 'ether') } })

    // Alice creates a single vault with 0.7 RBTC and a debt of 70 BPD, and provides 10 BPD to SP
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

    // Alice proves 10 BPD to SP
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    // Set RBTC:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const alice_ICR = (await vaultManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeVaultsCount_Before = await vaultManager.getVaultOwnersCount()

    assert.equal(activeVaultsCount_Before, 2)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate the vault
    await vaultManager.liquidate(alice, { from: owner })

    // Check Alice's vault is removed, and bob remains
    const activeVaultsCount_After = await vaultManager.getVaultOwnersCount()
    assert.equal(activeVaultsCount_After, 1)

    const alice_isInSortedList = await sortedVaults.contains(alice)
    assert.isFalse(alice_isInSortedList)

    const bob_isInSortedList = await sortedVaults.contains(bob)
    assert.isTrue(bob_isInSortedList)
  })

  it("liquidate(): reverts if vault is non-existent", async () => {
    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    assert.equal(await vaultManager.getVaultStatus(carol), 0) // check vault non-existent

    assert.isFalse(await sortedVaults.contains(carol))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    try {
      const txCarol = await vaultManager.liquidate(carol)

      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Vault does not exist or is closed")
    }
  })

  it("liquidate(): reverts if vault has been closed", async () => {
    await openVault({ ICR: toBN(dec(8, 18)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

    assert.isTrue(await sortedVaults.contains(carol))

    // price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Carol liquidated, and her vault is closed
    const txCarol_L1 = await vaultManager.liquidate(carol)
    assert.isTrue(txCarol_L1.receipt.status)

    assert.isFalse(await sortedVaults.contains(carol))

    assert.equal(await vaultManager.getVaultStatus(carol), 3)  // check vault closed by liquidation

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    try {
      const txCarol_L2 = await vaultManager.liquidate(carol)

      assert.isFalse(txCarol_L2.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Vault does not exist or is closed")
    }
  })

  it("liquidate(): does nothing if vault has >= 110% ICR", async () => {
    await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: whale } })
    await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: bob } })

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const listSize_Before = (await sortedVaults.getSize()).toString()

    const price = await priceFeed.getPrice()

    // Check Bob's ICR > 110%
    const bob_ICR = await vaultManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Attempt to liquidate bob
    await assertRevert(vaultManager.liquidate(bob), "VaultManager: nothing to liquidate")

    // Check bob active, check whale active
    assert.isTrue((await sortedVaults.contains(bob)))
    assert.isTrue((await sortedVaults.contains(whale)))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const listSize_After = (await sortedVaults.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidate(): Given the same price and no other vault changes, complete Pool offsets restore the TCR to its value prior to the defaulters opening vaults", async () => {
    // Whale provides BPD to SP
    const spDeposit = toBN(dec(100, 24))
    await openVault({ ICR: toBN(dec(4, 18)), extraBPDAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale })

    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    const TCR_Before = (await th.getTCR(contracts)).toString()

    await openVault({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openVault({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openVault({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedVaults.contains(defaulter_1)))
    assert.isTrue((await sortedVaults.contains(defaulter_2)))
    assert.isTrue((await sortedVaults.contains(defaulter_3)))
    assert.isTrue((await sortedVaults.contains(defaulter_4)))

    // Price drop
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // All defaulters liquidated
    await vaultManager.liquidate(defaulter_1)
    assert.isFalse((await sortedVaults.contains(defaulter_1)))

    await vaultManager.liquidate(defaulter_2)
    assert.isFalse((await sortedVaults.contains(defaulter_2)))

    await vaultManager.liquidate(defaulter_3)
    assert.isFalse((await sortedVaults.contains(defaulter_3)))

    await vaultManager.liquidate(defaulter_4)
    assert.isFalse((await sortedVaults.contains(defaulter_4)))

    // Price bounces back
    await priceFeed.setPrice(dec(200, 18))

    const TCR_After = (await th.getTCR(contracts)).toString()
    assert.equal(TCR_Before, TCR_After)
  })


  it("liquidate(): Pool offsets increase the TCR", async () => {
    // Whale provides BPD to SP
    const spDeposit = toBN(dec(100, 24))
    await openVault({ ICR: toBN(dec(4, 18)), extraBPDAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale })

    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openVault({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openVault({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openVault({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedVaults.contains(defaulter_1)))
    assert.isTrue((await sortedVaults.contains(defaulter_2)))
    assert.isTrue((await sortedVaults.contains(defaulter_3)))
    assert.isTrue((await sortedVaults.contains(defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))

    const TCR_1 = await th.getTCR(contracts)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Check TCR improves with each liquidation that is offset with Pool
    await vaultManager.liquidate(defaulter_1)
    assert.isFalse((await sortedVaults.contains(defaulter_1)))
    const TCR_2 = await th.getTCR(contracts)
    assert.isTrue(TCR_2.gte(TCR_1))

    await vaultManager.liquidate(defaulter_2)
    assert.isFalse((await sortedVaults.contains(defaulter_2)))
    const TCR_3 = await th.getTCR(contracts)
    assert.isTrue(TCR_3.gte(TCR_2))

    await vaultManager.liquidate(defaulter_3)
    assert.isFalse((await sortedVaults.contains(defaulter_3)))
    const TCR_4 = await th.getTCR(contracts)
    assert.isTrue(TCR_4.gte(TCR_4))

    await vaultManager.liquidate(defaulter_4)
    assert.isFalse((await sortedVaults.contains(defaulter_4)))
    const TCR_5 = await th.getTCR(contracts)
    assert.isTrue(TCR_5.gte(TCR_5))
  })

  it("liquidate(): a pure redistribution reduces the TCR only as a result of compensation", async () => {
    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openVault({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openVault({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openVault({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedVaults.contains(defaulter_1)))
    assert.isTrue((await sortedVaults.contains(defaulter_2)))
    assert.isTrue((await sortedVaults.contains(defaulter_3)))
    assert.isTrue((await sortedVaults.contains(defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_0 = await th.getTCR(contracts)

    const entireSystemCollBefore = await vaultManager.getEntireSystemColl()
    const entireSystemDebtBefore = await vaultManager.getEntireSystemDebt()

    const expectedTCR_0 = entireSystemCollBefore.mul(price).div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_0.eq(TCR_0))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Check TCR does not decrease with each liquidation 
    const liquidationTx_1 = await vaultManager.liquidate(defaulter_1)
    const [liquidatedDebt_1, liquidatedColl_1, gasComp_1] = th.getEmittedLiquidationValues(liquidationTx_1)
    assert.isFalse((await sortedVaults.contains(defaulter_1)))
    const TCR_1 = await th.getTCR(contracts)

    // Expect only change to TCR to be due to the issued gas compensation
    const expectedTCR_1 = (entireSystemCollBefore
      .sub(gasComp_1))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_1.eq(TCR_1))

    const liquidationTx_2 = await vaultManager.liquidate(defaulter_2)
    const [liquidatedDebt_2, liquidatedColl_2, gasComp_2] = th.getEmittedLiquidationValues(liquidationTx_2)
    assert.isFalse((await sortedVaults.contains(defaulter_2)))

    const TCR_2 = await th.getTCR(contracts)

    const expectedTCR_2 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_2.eq(TCR_2))

    const liquidationTx_3 = await vaultManager.liquidate(defaulter_3)
    const [liquidatedDebt_3, liquidatedColl_3, gasComp_3] = th.getEmittedLiquidationValues(liquidationTx_3)
    assert.isFalse((await sortedVaults.contains(defaulter_3)))

    const TCR_3 = await th.getTCR(contracts)

    const expectedTCR_3 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_3.eq(TCR_3))


    const liquidationTx_4 = await vaultManager.liquidate(defaulter_4)
    const [liquidatedDebt_4, liquidatedColl_4, gasComp_4] = th.getEmittedLiquidationValues(liquidationTx_4)
    assert.isFalse((await sortedVaults.contains(defaulter_4)))

    const TCR_4 = await th.getTCR(contracts)

    const expectedTCR_4 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3)
      .sub(gasComp_4))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_4.eq(TCR_4))
  })

  it("liquidate(): does not affect the SP deposit or RBTC gain when called on an SP depositor's address that has no vault", async () => {
    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const spDeposit = toBN(dec(1, 24))
    await openVault({ ICR: toBN(dec(3, 18)), extraBPDAmount: spDeposit, extraParams: { from: bob } })
    const { C_totalDebt, C_collateral } = await openVault({ ICR: toBN(dec(218, 16)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    // Bob sends tokens to Dennis, who has no vault
    await bpdToken.transfer(dennis, spDeposit, { from: bob })

    //Dennis provides BPD to SP
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: dennis })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await vaultManager.liquidate(carol)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C)

    assert.isFalse(await sortedVaults.contains(carol))
    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated RBTC
    const dennis_Deposit_Before = (await stabilityPool.getCompoundedBPDDeposit(dennis)).toString()
    const dennis_RBTCGain_Before = (await stabilityPool.getDepositorRBTCGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, spDeposit.sub(liquidatedDebt)), 1000000)
    assert.isAtMost(th.getDifference(dennis_RBTCGain_Before, liquidatedColl), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Attempt to liquidate Dennis
    try {
      const txDennis = await vaultManager.liquidate(dennis)
      assert.isFalse(txDennis.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Vault does not exist or is closed")
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (await stabilityPool.getCompoundedBPDDeposit(dennis)).toString()
    const dennis_RBTCGain_After = (await stabilityPool.getDepositorRBTCGain(dennis)).toString()
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_RBTCGain_Before, dennis_RBTCGain_After)
  })

  it("liquidate(): does not liquidate a SP depositor's vault with ICR > 110%, and does not affect their SP deposit or RBTC gain", async () => {
    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const spDeposit = toBN(dec(1, 24))
    await openVault({ ICR: toBN(dec(3, 18)), extraBPDAmount: spDeposit, extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(218, 16)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    //Bob provides BPD to SP
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await vaultManager.liquidate(carol)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C)
    assert.isFalse(await sortedVaults.contains(carol))

    // price bounces back - Bob's vault is >110% ICR again
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()
    assert.isTrue((await vaultManager.getCurrentICR(bob, price)).gt(mv._MCR))

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated RBTC
    const bob_Deposit_Before = (await stabilityPool.getCompoundedBPDDeposit(bob)).toString()
    const bob_RBTCGain_Before = (await stabilityPool.getDepositorRBTCGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, spDeposit.sub(liquidatedDebt)), 1000000)
    assert.isAtMost(th.getDifference(bob_RBTCGain_Before, liquidatedColl), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Attempt to liquidate Bob
    await assertRevert(vaultManager.liquidate(bob), "VaultManager: nothing to liquidate")

    // Confirm Bob's vault is still active
    assert.isTrue(await sortedVaults.contains(bob))

    // Check Bob' SP deposit does not change after liquidation attempt
    const bob_Deposit_After = (await stabilityPool.getCompoundedBPDDeposit(bob)).toString()
    const bob_RBTCGain_After = (await stabilityPool.getDepositorRBTCGain(bob)).toString()
    assert.equal(bob_Deposit_Before, bob_Deposit_After)
    assert.equal(bob_RBTCGain_Before, bob_RBTCGain_After)
  })

  it("liquidate(): liquidates a SP depositor's vault with ICR < 110%, and the liquidation correctly impacts their SP deposit and RBTC gain", async () => {
    const A_spDeposit = toBN(dec(3, 24))
    const B_spDeposit = toBN(dec(1, 24))
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openVault({ ICR: toBN(dec(8, 18)), extraBPDAmount: A_spDeposit, extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_debt } = await openVault({ ICR: toBN(dec(218, 16)), extraBPDAmount: B_spDeposit, extraParams: { from: bob } })
    const { collateral: C_collateral, totalDebt: C_debt } = await openVault({ ICR: toBN(dec(210, 16)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    //Bob provides BPD to SP
    await stabilityPool.provideToSP(B_spDeposit, ZERO_ADDRESS, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(carol)

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated RBTC
    const bob_Deposit_Before = await stabilityPool.getCompoundedBPDDeposit(bob)
    const bob_RBTCGain_Before = await stabilityPool.getDepositorRBTCGain(bob)
    assert.isAtMost(th.getDifference(bob_Deposit_Before, B_spDeposit.sub(C_debt)), 1000000)
    assert.isAtMost(th.getDifference(bob_RBTCGain_Before, th.applyLiquidationFee(C_collateral)), 1000)

    // Alice provides BPD to SP
    await stabilityPool.provideToSP(A_spDeposit, ZERO_ADDRESS, { from: alice })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate Bob
    await vaultManager.liquidate(bob)

    // Confirm Bob's vault has been closed
    assert.isFalse(await sortedVaults.contains(bob))
    const bob_Vault_Status = ((await vaultManager.Vaults(bob))[3]).toString()
    assert.equal(bob_Vault_Status, 3) // check closed by liquidation

    /* Alice's BPD Loss = (300 / 400) * 200 = 150 BPD
       Alice's RBTC gain = (300 / 400) * 2*0.995 = 1.4925 RBTC

       Bob's BPDLoss = (100 / 400) * 200 = 50 BPD
       Bob's RBTC gain = (100 / 400) * 2*0.995 = 0.4975 RBTC

     Check Bob' SP deposit has been reduced to 50 BPD, and his RBTC gain has increased to 1.5 RBTC. */
    const alice_Deposit_After = (await stabilityPool.getCompoundedBPDDeposit(alice)).toString()
    const alice_RBTCGain_After = (await stabilityPool.getDepositorRBTCGain(alice)).toString()

    const totalDeposits = bob_Deposit_Before.add(A_spDeposit)

    assert.isAtMost(th.getDifference(alice_Deposit_After, A_spDeposit.sub(B_debt.mul(A_spDeposit).div(totalDeposits))), 1000000)
    assert.isAtMost(th.getDifference(alice_RBTCGain_After, th.applyLiquidationFee(B_collateral).mul(A_spDeposit).div(totalDeposits)), 1000000)

    const bob_Deposit_After = await stabilityPool.getCompoundedBPDDeposit(bob)
    const bob_RBTCGain_After = await stabilityPool.getDepositorRBTCGain(bob)

    assert.isAtMost(th.getDifference(bob_Deposit_After, bob_Deposit_Before.sub(B_debt.mul(bob_Deposit_Before).div(totalDeposits))), 1000000)
    assert.isAtMost(th.getDifference(bob_RBTCGain_After, bob_RBTCGain_Before.add(th.applyLiquidationFee(B_collateral).mul(bob_Deposit_Before).div(totalDeposits))), 1000000)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const { bpdAmount: A_bpdAmount } = await openVault({ ICR: toBN(dec(2, 18)), extraBPDAmount: toBN(dec(300, 18)), extraParams: { from: alice } })
    const { bpdAmount: B_bpdAmount } = await openVault({ ICR: toBN(dec(2, 18)), extraBPDAmount: toBN(dec(200, 18)), extraParams: { from: bob } })
    const { bpdAmount: C_bpdAmount } = await openVault({ ICR: toBN(dec(2, 18)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    await priceFeed.setPrice(dec(100, 18))

    // Check sortedList size
    assert.equal((await sortedVaults.getSize()).toString(), '4')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate A, B and C
    const activeBPDDebt_0 = await activePool.getBPDDebt()
    const defaultBPDDebt_0 = await defaultPool.getBPDDebt()

    await vaultManager.liquidate(alice)
    const activeBPDDebt_A = await activePool.getBPDDebt()
    const defaultBPDDebt_A = await defaultPool.getBPDDebt()

    await vaultManager.liquidate(bob)
    const activeBPDDebt_B = await activePool.getBPDDebt()
    const defaultBPDDebt_B = await defaultPool.getBPDDebt()

    await vaultManager.liquidate(carol)

    // Confirm A, B, C closed
    assert.isFalse(await sortedVaults.contains(alice))
    assert.isFalse(await sortedVaults.contains(bob))
    assert.isFalse(await sortedVaults.contains(carol))

    // Check sortedList size reduced to 1
    assert.equal((await sortedVaults.getSize()).toString(), '1')

    // Confirm token balances have not changed
    assert.equal((await bpdToken.balanceOf(alice)).toString(), A_bpdAmount)
    assert.equal((await bpdToken.balanceOf(bob)).toString(), B_bpdAmount)
    assert.equal((await bpdToken.balanceOf(carol)).toString(), C_bpdAmount)
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openVault({ ICR: toBN(dec(8, 18)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(221, 16)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(2, 18)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    // Defaulter opens with 60 BPD, 0.6 RBTC
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await vaultManager.getCurrentICR(alice, price)
    const bob_ICR_Before = await vaultManager.getCurrentICR(bob, price)
    const carol_ICR_Before = await vaultManager.getCurrentICR(carol, price)

    /* Before liquidation: 
    Alice ICR: = (2 * 100 / 50) = 400%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    /* Liquidate defaulter. 30 BPD and 0.3 RBTC is distributed between A, B and C.

    A receives (30 * 2/4) = 15 BPD, and (0.3*2/4) = 0.15 RBTC
    B receives (30 * 1/4) = 7.5 BPD, and (0.3*1/4) = 0.075 RBTC
    C receives (30 * 1/4) = 7.5 BPD, and (0.3*1/4) = 0.075 RBTC
    */
    await vaultManager.liquidate(defaulter_1)

    const alice_ICR_After = await vaultManager.getCurrentICR(alice, price)
    const bob_ICR_After = await vaultManager.getCurrentICR(bob, price)
    const carol_ICR_After = await vaultManager.getCurrentICR(carol, price)

    /* After liquidation: 

    Alice ICR: (10.15 * 100 / 60) = 183.33%
    Bob ICR:(1.075 * 100 / 98) =  109.69%
    Carol ICR: (1.075 *100 /  107.5 ) = 100.0%

    Check Alice is above MCR, Bob below, Carol below. */


    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await vaultManager.Vaults(bob))[1]
    const bob_Debt = (await vaultManager.Vaults(bob))[0]

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate Alice, Bob, Carol
    await assertRevert(vaultManager.liquidate(alice), "VaultManager: nothing to liquidate")
    await vaultManager.liquidate(bob)
    await vaultManager.liquidate(carol)

    /* Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedVaults.contains(alice))
    assert.isFalse(await sortedVaults.contains(bob))
    assert.isFalse(await sortedVaults.contains(carol))

    // Check vault statuses - A active (1),  B and C liquidated (3)
    assert.equal((await vaultManager.Vaults(alice))[3].toString(), '1')
    assert.equal((await vaultManager.Vaults(bob))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(carol))[3].toString(), '3')
  })

  it("liquidate(): when SP > 0, triggers MP reward event - increases the sum G", async () => {
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open vaults 
    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalBPDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1RBTC:100BPD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate vault
    await vaultManager.liquidate(defaulter_1)
    assert.isFalse(await sortedVaults.contains(defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the MP reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("liquidate(): when SP is empty, doesn't update G", async () => {
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open vaults 
    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalBPDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1RBTC:100BPD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // liquidate vault
    await vaultManager.liquidate(defaulter_1)
    assert.isFalse(await sortedVaults.contains(defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  // --- liquidateVaults() ---

  it('liquidateVaults(): liquidates a Vault that a) was skipped in a previous liquidation and b) has pending rewards', async () => {
    // A, B, C, D, E open vaults
    await openVault({ ICR: toBN(dec(333, 16)), extraParams: { from: D } })
    await openVault({ ICR: toBN(dec(333, 16)), extraParams: { from: E } })
    await openVault({ ICR: toBN(dec(120, 16)), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    // Price drops
    await priceFeed.setPrice(dec(175, 18))
    let price = await priceFeed.getPrice()
    
    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // A gets liquidated, creates pending rewards for all
    const liqTxA = await vaultManager.liquidate(A)
    assert.isTrue(liqTxA.receipt.status)
    assert.isFalse(await sortedVaults.contains(A))

    // A adds 10 BPD to the SP, but less than C's debt
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, {from: A})

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    price = await priceFeed.getPrice()
    // Confirm system is now in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))

    // Confirm C has ICR > TCR
    const TCR = await vaultManager.getTCR(price)
    const ICR_C = await vaultManager.getCurrentICR(C, price)
  
    assert.isTrue(ICR_C.gt(TCR))

    // Attempt to liquidate B and C, which skips C in the liquidation since it is immune
    const liqTxBC = await vaultManager.liquidateVaults(2)
    assert.isTrue(liqTxBC.receipt.status)
    assert.isFalse(await sortedVaults.contains(B))
    assert.isTrue(await sortedVaults.contains(C))
    assert.isTrue(await sortedVaults.contains(D))
    assert.isTrue(await sortedVaults.contains(E))

    // // All remaining vaults D and E repay a little debt, applying their pending rewards
    assert.isTrue((await sortedVaults.getSize()).eq(toBN('3')))
    await borrowerOperations.repayBPD(dec(1, 18), D, D, {from: D})
    await borrowerOperations.repayBPD(dec(1, 18), E, E, {from: E})

    // Check C is the only vault that has pending rewards
    assert.isTrue(await vaultManager.hasPendingRewards(C))
    assert.isFalse(await vaultManager.hasPendingRewards(D))
    assert.isFalse(await vaultManager.hasPendingRewards(E))

    // Check C's pending coll and debt rewards are <= the coll and debt in the DefaultPool
    const pendingRBTC_C = await vaultManager.getPendingRBTCReward(C)
    const pendingBPDDebt_C = await vaultManager.getPendingBPDDebtReward(C)
    const defaultPoolRBTC = await defaultPool.getRBTC()
    const defaultPoolBPDDebt = await defaultPool.getBPDDebt()
    assert.isTrue(pendingRBTC_C.lte(defaultPoolRBTC))
    assert.isTrue(pendingBPDDebt_C.lte(defaultPoolBPDDebt))
    //Check only difference is dust
    assert.isAtMost(th.getDifference(pendingRBTC_C, defaultPoolRBTC), 1000)
    assert.isAtMost(th.getDifference(pendingBPDDebt_C, defaultPoolBPDDebt), 1000)

    // Confirm system is still in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))

    // D and E fill the Stability Pool, enough to completely absorb C's debt of 70
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, {from: D})
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, {from: E})

    await priceFeed.setPrice(dec(50, 18))

    // Try to liquidate C again. Check it succeeds and closes C's vault
    const liqTx2 = await vaultManager.liquidateVaults(2)
    assert.isTrue(liqTx2.receipt.status)
    assert.isFalse(await sortedVaults.contains(C))
    assert.isFalse(await sortedVaults.contains(D))
    assert.isTrue(await sortedVaults.contains(E))
    assert.isTrue((await sortedVaults.getSize()).eq(toBN('1')))
  })

  it('liquidateVaults(): closes every Vault with ICR < MCR, when n > number of undercollateralized vaults', async () => {
    // --- SETUP ---
    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // create 5 Vaults with varying ICRs
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(190, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(195, 16)), extraParams: { from: erin } })
    await openVault({ ICR: toBN(dec(120, 16)), extraParams: { from: flyn } })

    // G,H, I open high-ICR vaults
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: graham } })
    await openVault({ ICR: toBN(dec(90, 18)), extraParams: { from: harriet } })
    await openVault({ ICR: toBN(dec(80, 18)), extraParams: { from: ida } })

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1RBTC:100BPD, reducing Bob and Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm vaults A-E are ICR < 110%
    assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(bob, price)).lte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(carol, price)).lte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(erin, price)).lte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(flyn, price)).lte(mv._MCR))

    // Confirm vaults G, H, I are ICR > 110%
    assert.isTrue((await vaultManager.getCurrentICR(graham, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(harriet, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(ida, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await vaultManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate 5 vaults
    await vaultManager.liquidateVaults(5);

    // Confirm vaults A-E have been removed from the system
    assert.isFalse(await sortedVaults.contains(alice))
    assert.isFalse(await sortedVaults.contains(bob))
    assert.isFalse(await sortedVaults.contains(carol))
    assert.isFalse(await sortedVaults.contains(erin))
    assert.isFalse(await sortedVaults.contains(flyn))

    // Check all vaults A-E are now closed by liquidation
    assert.equal((await vaultManager.Vaults(alice))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(bob))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(carol))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(erin))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(flyn))[3].toString(), '3')

    // Check sorted list has been reduced to length 4 
    assert.equal((await sortedVaults.getSize()).toString(), '4')
  })

  it('liquidateVaults(): liquidates  up to the requested number of undercollateralized vaults', async () => {
    // --- SETUP --- 
    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol, Dennis, Erin open vaults with consecutively decreasing collateral ratio
    await openVault({ ICR: toBN(dec(202, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(204, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(206, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(208, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    await vaultManager.liquidateVaults(3)

    const VaultOwnersArrayLength = await vaultManager.getVaultOwnersCount()
    assert.equal(VaultOwnersArrayLength, '3')

    // Check Alice, Bob, Carol vaults have been closed
    const aliceVaultStatus = (await vaultManager.getVaultStatus(alice)).toString()
    const bobVaultStatus = (await vaultManager.getVaultStatus(bob)).toString()
    const carolVaultStatus = (await vaultManager.getVaultStatus(carol)).toString()

    assert.equal(aliceVaultStatus, '3')
    assert.equal(bobVaultStatus, '3')
    assert.equal(carolVaultStatus, '3')

    //  Check Alice, Bob, and Carol's vault are no longer in the sorted list
    const alice_isInSortedList = await sortedVaults.contains(alice)
    const bob_isInSortedList = await sortedVaults.contains(bob)
    const carol_isInSortedList = await sortedVaults.contains(carol)

    assert.isFalse(alice_isInSortedList)
    assert.isFalse(bob_isInSortedList)
    assert.isFalse(carol_isInSortedList)

    // Check Dennis, Erin still have active vaults
    const dennisVaultStatus = (await vaultManager.getVaultStatus(dennis)).toString()
    const erinVaultStatus = (await vaultManager.getVaultStatus(erin)).toString()

    assert.equal(dennisVaultStatus, '1')
    assert.equal(erinVaultStatus, '1')

    // Check Dennis, Erin still in sorted list
    const dennis_isInSortedList = await sortedVaults.contains(dennis)
    const erin_isInSortedList = await sortedVaults.contains(erin)

    assert.isTrue(dennis_isInSortedList)
    assert.isTrue(erin_isInSortedList)
  })

  it('liquidateVaults(): does nothing if all vaults have ICR > 110%', async () => {
    await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openVault({ ICR: toBN(dec(222, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(222, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(222, 16)), extraParams: { from: carol } })

    // Price drops, but all vaults remain active at 111% ICR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    assert.isTrue((await sortedVaults.contains(whale)))
    assert.isTrue((await sortedVaults.contains(alice)))
    assert.isTrue((await sortedVaults.contains(bob)))
    assert.isTrue((await sortedVaults.contains(carol)))

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const listSize_Before = (await sortedVaults.getSize()).toString()

    assert.isTrue((await vaultManager.getCurrentICR(whale, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Attempt liqudation sequence
    await assertRevert(vaultManager.liquidateVaults(10), "VaultManager: nothing to liquidate")

    // Check all vaults remain active
    assert.isTrue((await sortedVaults.contains(whale)))
    assert.isTrue((await sortedVaults.contains(alice)))
    assert.isTrue((await sortedVaults.contains(bob)))
    assert.isTrue((await sortedVaults.contains(carol)))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const listSize_After = (await sortedVaults.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  
  it("liquidateVaults(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openVault({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(221, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await vaultManager.getCurrentICR(alice, price)
    const bob_ICR_Before = await vaultManager.getCurrentICR(bob, price)
    const carol_ICR_Before = await vaultManager.getCurrentICR(carol, price)

    /* Before liquidation: 
    Alice ICR: = (2 * 100 / 100) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    // Liquidate defaulter. 30 BPD and 0.3 RBTC is distributed uniformly between A, B and C. Each receive 10 BPD, 0.1 RBTC
    await vaultManager.liquidate(defaulter_1)

    const alice_ICR_After = await vaultManager.getCurrentICR(alice, price)
    const bob_ICR_After = await vaultManager.getCurrentICR(bob, price)
    const carol_ICR_After = await vaultManager.getCurrentICR(carol, price)

    /* After liquidation: 

    Alice ICR: (1.0995 * 100 / 60) = 183.25%
    Bob ICR:(1.0995 * 100 / 100.5) =  109.40%
    Carol ICR: (1.0995 * 100 / 110 ) 99.95%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await vaultManager.Vaults(bob))[1]
    const bob_Debt = (await vaultManager.Vaults(bob))[0]

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await openVault({ ICR: toBN(dec(10, 18)), extraBPDAmount: dec(1, 24), extraParams: { from: whale } })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    //liquidate A, B, C
    await vaultManager.liquidateVaults(10)

    // Check A stays active, B and C get liquidated
    assert.isTrue(await sortedVaults.contains(alice))
    assert.isFalse(await sortedVaults.contains(bob))
    assert.isFalse(await sortedVaults.contains(carol))

    // check vault statuses - A active (1),  B and C closed by liquidation (3)
    assert.equal((await vaultManager.Vaults(alice))[3].toString(), '1')
    assert.equal((await vaultManager.Vaults(bob))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(carol))[3].toString(), '3')
  })

  it("liquidateVaults(): reverts if n = 0", async () => {
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(218, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(206, 16)), extraParams: { from: carol } })

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_Before = (await th.getTCR(contracts)).toString()

    // Confirm A, B, C ICRs are below 110%
    const alice_ICR = await vaultManager.getCurrentICR(alice, price)
    const bob_ICR = await vaultManager.getCurrentICR(bob, price)
    const carol_ICR = await vaultManager.getCurrentICR(carol, price)
    assert.isTrue(alice_ICR.lte(mv._MCR))
    assert.isTrue(bob_ICR.lte(mv._MCR))
    assert.isTrue(carol_ICR.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidation with n = 0
    await assertRevert(vaultManager.liquidateVaults(0), "VaultManager: nothing to liquidate")

    // Check all vaults are still in the system
    assert.isTrue(await sortedVaults.contains(whale))
    assert.isTrue(await sortedVaults.contains(alice))
    assert.isTrue(await sortedVaults.contains(bob))
    assert.isTrue(await sortedVaults.contains(carol))

    const TCR_After = (await th.getTCR(contracts)).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
  })

  it("liquidateVaults():  liquidates vaults with ICR < MCR", async () => {
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // A, B, C open vaults that will remain active when price drops to 100
    await openVault({ ICR: toBN(dec(220, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(230, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(240, 16)), extraParams: { from: carol } })

    // D, E, F open vaults that will fall below MCR when price drops to 100
    await openVault({ ICR: toBN(dec(218, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(216, 16)), extraParams: { from: erin } })
    await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: flyn } })

    // Check list size is 7
    assert.equal((await sortedVaults.getSize()).toString(), '7')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR = await vaultManager.getCurrentICR(alice, price)
    const bob_ICR = await vaultManager.getCurrentICR(bob, price)
    const carol_ICR = await vaultManager.getCurrentICR(carol, price)
    const dennis_ICR = await vaultManager.getCurrentICR(dennis, price)
    const erin_ICR = await vaultManager.getCurrentICR(erin, price)
    const flyn_ICR = await vaultManager.getCurrentICR(flyn, price)

    // Check A, B, C have ICR above MCR
    assert.isTrue(alice_ICR.gte(mv._MCR))
    assert.isTrue(bob_ICR.gte(mv._MCR))
    assert.isTrue(carol_ICR.gte(mv._MCR))

    // Check D, E, F have ICR below MCR
    assert.isTrue(dennis_ICR.lte(mv._MCR))
    assert.isTrue(erin_ICR.lte(mv._MCR))
    assert.isTrue(flyn_ICR.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    //Liquidate sequence
    await vaultManager.liquidateVaults(10)

    // check list size reduced to 4
    assert.equal((await sortedVaults.getSize()).toString(), '4')

    // Check Whale and A, B, C remain in the system
    assert.isTrue(await sortedVaults.contains(whale))
    assert.isTrue(await sortedVaults.contains(alice))
    assert.isTrue(await sortedVaults.contains(bob))
    assert.isTrue(await sortedVaults.contains(carol))

    // Check D, E, F have been removed
    assert.isFalse(await sortedVaults.contains(dennis))
    assert.isFalse(await sortedVaults.contains(erin))
    assert.isFalse(await sortedVaults.contains(flyn))
  })

  it("liquidateVaults(): does not affect the liquidated user's token balances", async () => {
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // D, E, F open vaults that will fall below MCR when price drops to 100
    await openVault({ ICR: toBN(dec(218, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(216, 16)), extraParams: { from: erin } })
    await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: flyn } })

    const D_balanceBefore = await bpdToken.balanceOf(dennis)
    const E_balanceBefore = await bpdToken.balanceOf(erin)
    const F_balanceBefore = await bpdToken.balanceOf(flyn)

    // Check list size is 4
    assert.equal((await sortedVaults.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    //Liquidate sequence
    await vaultManager.liquidateVaults(10)

    // check list size reduced to 1
    assert.equal((await sortedVaults.getSize()).toString(), '1')

    // Check Whale remains in the system
    assert.isTrue(await sortedVaults.contains(whale))

    // Check D, E, F have been removed
    assert.isFalse(await sortedVaults.contains(dennis))
    assert.isFalse(await sortedVaults.contains(erin))
    assert.isFalse(await sortedVaults.contains(flyn))

    // Check token balances of users whose vaults were liquidated, have not changed
    assert.equal((await bpdToken.balanceOf(dennis)).toString(), D_balanceBefore)
    assert.equal((await bpdToken.balanceOf(erin)).toString(), E_balanceBefore)
    assert.equal((await bpdToken.balanceOf(flyn)).toString(), F_balanceBefore)
  })

  it("liquidateVaults(): A liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 BPD to SP
    await openVault({ ICR: toBN(dec(100, 18)), extraBPDAmount: toBN(dec(500, 18)), extraParams: { from: whale } })
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(28, 18)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(8, 18)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(80, 18)), extraParams: { from: dennis } })

    await openVault({ ICR: toBN(dec(199, 16)), extraParams: { from: defaulter_1 } })
    await openVault({ ICR: toBN(dec(156, 16)), extraParams: { from: defaulter_2 } })
    await openVault({ ICR: toBN(dec(183, 16)), extraParams: { from: defaulter_3 } })
    await openVault({ ICR: toBN(dec(166, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedVaults.contains(defaulter_1)))
    assert.isTrue((await sortedVaults.contains(defaulter_2)))
    assert.isTrue((await sortedVaults.contains(defaulter_3)))
    assert.isTrue((await sortedVaults.contains(defaulter_4)))

    assert.equal((await sortedVaults.getSize()).toString(), '9')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    const TCR_Before = await th.getTCR(contracts)

    // Check pool has 500 BPD
    assert.equal((await stabilityPool.getTotalBPDDeposits()).toString(), dec(500, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate vaults
    await vaultManager.liquidateVaults(10)

    // Check pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalBPDDeposits()).toString(), '0')

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedVaults.contains(defaulter_1)))
    assert.isFalse((await sortedVaults.contains(defaulter_2)))
    assert.isFalse((await sortedVaults.contains(defaulter_3)))
    assert.isFalse((await sortedVaults.contains(defaulter_4)))

    // check system sized reduced to 5 vaults
    assert.equal((await sortedVaults.getSize()).toString(), '5')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await th.getTCR(contracts)
    assert.isTrue(TCR_After.gte(TCR_Before))
  })

  it("liquidateVaults(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    const { collateral: W_coll, totalDebt: W_debt } = await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    const { collateral: A_coll, totalDebt: A_debt } = await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_debt } = await openVault({ ICR: toBN(dec(28, 18)), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_debt } = await openVault({ ICR: toBN(dec(8, 18)), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_debt } = await openVault({ ICR: toBN(dec(80, 18)), extraParams: { from: dennis } })

    const { collateral: d1_coll, totalDebt: d1_debt } = await openVault({ ICR: toBN(dec(199, 16)), extraParams: { from: defaulter_1 } })
    const { collateral: d2_coll, totalDebt: d2_debt } = await openVault({ ICR: toBN(dec(156, 16)), extraParams: { from: defaulter_2 } })
    const { collateral: d3_coll, totalDebt: d3_debt } = await openVault({ ICR: toBN(dec(183, 16)), extraParams: { from: defaulter_3 } })
    const { collateral: d4_coll, totalDebt: d4_debt } = await openVault({ ICR: toBN(dec(166, 16)), extraParams: { from: defaulter_4 } })

    const totalCollNonDefaulters = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)
    const totalCollDefaulters = d1_coll.add(d2_coll).add(d3_coll).add(d4_coll)
    const totalColl = totalCollNonDefaulters.add(totalCollDefaulters)
    const totalDebt = W_debt.add(A_debt).add(B_debt).add(C_debt).add(D_debt).add(d1_debt).add(d2_debt).add(d3_debt).add(d4_debt)

    assert.isTrue((await sortedVaults.contains(defaulter_1)))
    assert.isTrue((await sortedVaults.contains(defaulter_2)))
    assert.isTrue((await sortedVaults.contains(defaulter_3)))
    assert.isTrue((await sortedVaults.contains(defaulter_4)))

    assert.equal((await sortedVaults.getSize()).toString(), '9')

    // Price drops
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    const TCR_Before = await th.getTCR(contracts)
    assert.isAtMost(th.getDifference(TCR_Before, totalColl.mul(price).div(totalDebt)), 1000)

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalBPDDeposits()).toString(), '0')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate
    await vaultManager.liquidateVaults(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedVaults.contains(defaulter_1)))
    assert.isFalse((await sortedVaults.contains(defaulter_2)))
    assert.isFalse((await sortedVaults.contains(defaulter_3)))
    assert.isFalse((await sortedVaults.contains(defaulter_4)))

    // check system sized reduced to 5 vaults
    assert.equal((await sortedVaults.getSize()).toString(), '5')

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await th.getTCR(contracts)
    // ((100+1+7+2+20)+(1+2+3+4)*0.995)*100/(2050+50+50+50+50+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_After, totalCollNonDefaulters.add(th.applyLiquidationFee(totalCollDefaulters)).mul(price).div(totalDebt)), 1000)
    assert.isTrue(TCR_Before.gte(TCR_After))
    assert.isTrue(TCR_After.gte(TCR_Before.mul(toBN(995)).div(toBN(1000))))
  })

  it("liquidateVaults(): Liquidating vaults with SP deposits correctly impacts their SP deposit and RBTC gain", async () => {
    // Whale provides 400 BPD to the SP
    const whaleDeposit = toBN(dec(40000, 18))
    await openVault({ ICR: toBN(dec(100, 18)), extraBPDAmount: whaleDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(whaleDeposit, ZERO_ADDRESS, { from: whale })

    const A_deposit = toBN(dec(10000, 18))
    const B_deposit = toBN(dec(30000, 18))
    const { collateral: A_coll, totalDebt: A_debt } = await openVault({ ICR: toBN(dec(2, 18)), extraBPDAmount: A_deposit, extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_debt } = await openVault({ ICR: toBN(dec(2, 18)), extraBPDAmount: B_deposit, extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_debt } = await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

    const liquidatedColl = A_coll.add(B_coll).add(C_coll)
    const liquidatedDebt = A_debt.add(B_debt).add(C_debt)

    // A, B provide 100, 300 to the SP
    await stabilityPool.provideToSP(A_deposit, ZERO_ADDRESS, { from: alice })
    await stabilityPool.provideToSP(B_deposit, ZERO_ADDRESS, { from: bob })

    assert.equal((await sortedVaults.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Check 800 BPD in Pool
    const totalDeposits = whaleDeposit.add(A_deposit).add(B_deposit)
    assert.equal((await stabilityPool.getTotalBPDDeposits()).toString(), totalDeposits)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate
    await vaultManager.liquidateVaults(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedVaults.contains(alice)))
    assert.isFalse((await sortedVaults.contains(bob)))
    assert.isFalse((await sortedVaults.contains(carol)))

    // check system sized reduced to 1 vaults
    assert.equal((await sortedVaults.getSize()).toString(), '1')

    /* Prior to liquidation, SP deposits were:
    Whale: 400 BPD
    Alice: 100 BPD
    Bob:   300 BPD
    Carol: 0 BPD

    Total BPD in Pool: 800 BPD

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 150 + 350 + 150 = 650 BPD
    Total liquidated RBTC = 1.1 + 3.1 + 1.1 = 5.3 RBTC

    whale bpd loss: 650 * (400/800) = 325 bpd
    alice bpd loss:  650 *(100/800) = 81.25 bpd
    bob bpd loss: 650 * (300/800) = 243.75 bpd

    whale remaining deposit: (400 - 325) = 75 bpd
    alice remaining deposit: (100 - 81.25) = 18.75 bpd
    bob remaining deposit: (300 - 243.75) = 56.25 bpd

    whale eth gain: 5*0.995 * (400/800) = 2.4875 eth
    alice eth gain: 5*0.995 *(100/800) = 0.621875 eth
    bob eth gain: 5*0.995 * (300/800) = 1.865625 eth

    Total remaining deposits: 150 BPD
    Total RBTC gain: 4.975 RBTC */

    // Check remaining BPD Deposits and RBTC gain, for whale and depositors whose vaults were liquidated
    const whale_Deposit_After = await stabilityPool.getCompoundedBPDDeposit(whale)
    const alice_Deposit_After = await stabilityPool.getCompoundedBPDDeposit(alice)
    const bob_Deposit_After = await stabilityPool.getCompoundedBPDDeposit(bob)

    const whale_RBTCGain = await stabilityPool.getDepositorRBTCGain(whale)
    const alice_RBTCGain = await stabilityPool.getDepositorRBTCGain(alice)
    const bob_RBTCGain = await stabilityPool.getDepositorRBTCGain(bob)

    assert.isAtMost(th.getDifference(whale_Deposit_After, whaleDeposit.sub(liquidatedDebt.mul(whaleDeposit).div(totalDeposits))), 100000)
    assert.isAtMost(th.getDifference(alice_Deposit_After, A_deposit.sub(liquidatedDebt.mul(A_deposit).div(totalDeposits))), 100000)
    assert.isAtMost(th.getDifference(bob_Deposit_After, B_deposit.sub(liquidatedDebt.mul(B_deposit).div(totalDeposits))), 100000)

    assert.isAtMost(th.getDifference(whale_RBTCGain, th.applyLiquidationFee(liquidatedColl).mul(whaleDeposit).div(totalDeposits)), 100000)
    assert.isAtMost(th.getDifference(alice_RBTCGain, th.applyLiquidationFee(liquidatedColl).mul(A_deposit).div(totalDeposits)), 100000)
    assert.isAtMost(th.getDifference(bob_RBTCGain, th.applyLiquidationFee(liquidatedColl).mul(B_deposit).div(totalDeposits)), 100000)

    // Check total remaining deposits and RBTC gain in Stability Pool
    const total_BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    const totaB_RBTCinSP = (await stabilityPool.getRBTC()).toString()

    assert.isAtMost(th.getDifference(total_BPDinSP, totalDeposits.sub(liquidatedDebt)), 1000)
    assert.isAtMost(th.getDifference(totaB_RBTCinSP, th.applyLiquidationFee(liquidatedColl)), 1000)
  })

  it("liquidateVaults(): when SP > 0, triggers MP reward event - increases the sum G", async () => {
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open vaults
    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(3, 18)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openVault({ ICR: toBN(dec(219, 16)), extraParams: { from: defaulter_1 } })
    await openVault({ ICR: toBN(dec(213, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalBPDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1RBTC:100BPD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate vaults
    await vaultManager.liquidateVaults(2)
    assert.isFalse(await sortedVaults.contains(defaulter_1))
    assert.isFalse(await sortedVaults.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the MP reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("liquidateVaults(): when SP is empty, doesn't update G", async () => {
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open vaults
    await openVault({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(3, 18)), extraBPDAmount: toBN(dec(100, 18)), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openVault({ ICR: toBN(dec(219, 16)), extraParams: { from: defaulter_1 } })
    await openVault({ ICR: toBN(dec(213, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalBPDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1RBTC:100BPD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // liquidate vaults
    await vaultManager.liquidateVaults(2)
    assert.isFalse(await sortedVaults.contains(defaulter_1))
    assert.isFalse(await sortedVaults.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })


  // --- batchLiquidateVaults() ---

  it('batchLiquidateVaults(): liquidates a Vault that a) was skipped in a previous liquidation and b) has pending rewards', async () => {
    // A, B, C, D, E open vaults 
    await openVault({ ICR: toBN(dec(300, 16)), extraParams: { from: C } })
    await openVault({ ICR: toBN(dec(364, 16)), extraParams: { from: D } })
    await openVault({ ICR: toBN(dec(364, 16)), extraParams: { from: E } })
    await openVault({ ICR: toBN(dec(120, 16)), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })

    // Price drops
    await priceFeed.setPrice(dec(175, 18))
    let price = await priceFeed.getPrice()
    
    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // A gets liquidated, creates pending rewards for all
    const liqTxA = await vaultManager.liquidate(A)
    assert.isTrue(liqTxA.receipt.status)
    assert.isFalse(await sortedVaults.contains(A))

    // A adds 10 BPD to the SP, but less than C's debt
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, {from: A})

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    price = await priceFeed.getPrice()
    // Confirm system is now in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))

    // Confirm C has ICR > TCR
    const TCR = await vaultManager.getTCR(price)
    const ICR_C = await vaultManager.getCurrentICR(C, price)
  
    assert.isTrue(ICR_C.gt(TCR))

    // Attempt to liquidate B and C, which skips C in the liquidation since it is immune
    const liqTxBC = await vaultManager.liquidateVaults(2)
    assert.isTrue(liqTxBC.receipt.status)
    assert.isFalse(await sortedVaults.contains(B))
    assert.isTrue(await sortedVaults.contains(C))
    assert.isTrue(await sortedVaults.contains(D))
    assert.isTrue(await sortedVaults.contains(E))

    // // All remaining vaults D and E repay a little debt, applying their pending rewards
    assert.isTrue((await sortedVaults.getSize()).eq(toBN('3')))
    await borrowerOperations.repayBPD(dec(1, 18), D, D, {from: D})
    await borrowerOperations.repayBPD(dec(1, 18), E, E, {from: E})

    // Check C is the only vault that has pending rewards
    assert.isTrue(await vaultManager.hasPendingRewards(C))
    assert.isFalse(await vaultManager.hasPendingRewards(D))
    assert.isFalse(await vaultManager.hasPendingRewards(E))

    // Check C's pending coll and debt rewards are <= the coll and debt in the DefaultPool
    const pendingRBTC_C = await vaultManager.getPendingRBTCReward(C)
    const pendingBPDDebt_C = await vaultManager.getPendingBPDDebtReward(C)
    const defaultPoolRBTC = await defaultPool.getRBTC()
    const defaultPoolBPDDebt = await defaultPool.getBPDDebt()
    assert.isTrue(pendingRBTC_C.lte(defaultPoolRBTC))
    assert.isTrue(pendingBPDDebt_C.lte(defaultPoolBPDDebt))
    //Check only difference is dust
    assert.isAtMost(th.getDifference(pendingRBTC_C, defaultPoolRBTC), 1000)
    assert.isAtMost(th.getDifference(pendingBPDDebt_C, defaultPoolBPDDebt), 1000)

    // Confirm system is still in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))

    // D and E fill the Stability Pool, enough to completely absorb C's debt of 70
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, {from: D})
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, {from: E})

    await priceFeed.setPrice(dec(50, 18))

    // Try to liquidate C again. Check it succeeds and closes C's vault
    const liqTx2 = await vaultManager.batchLiquidateVaults([C,D])
    assert.isTrue(liqTx2.receipt.status)
    assert.isFalse(await sortedVaults.contains(C))
    assert.isFalse(await sortedVaults.contains(D))
    assert.isTrue(await sortedVaults.contains(E))
    assert.isTrue((await sortedVaults.getSize()).eq(toBN('1')))
  })

  it('batchLiquidateVaults(): closes every vault with ICR < MCR in the given array', async () => {
    // --- SETUP ---
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedVaults.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1RBTC:100BPD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm vaults A-C are ICR < 110%
    assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await vaultManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await vaultManager.getCurrentICR(whale, price)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await vaultManager.batchLiquidateVaults(liquidationArray);

    // Confirm vaults A-C have been removed from the system
    assert.isFalse(await sortedVaults.contains(alice))
    assert.isFalse(await sortedVaults.contains(bob))
    assert.isFalse(await sortedVaults.contains(carol))

    // Check all vaults A-C are now closed by liquidation
    assert.equal((await vaultManager.Vaults(alice))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(bob))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(carol))[3].toString(), '3')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedVaults.getSize()).toString(), '3')
  })

  it('batchLiquidateVaults(): does not liquidate vaults that are not in the given array', async () => {
    // --- SETUP ---
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(180, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: toBN(dec(500, 18)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: toBN(dec(500, 18)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedVaults.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1RBTC:100BPD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm vaults A-E are ICR < 110%
    assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(dennis, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(erin, price)).lt(mv._MCR))

    liquidationArray = [alice, bob]  // C-E not included
    await vaultManager.batchLiquidateVaults(liquidationArray);

    // Confirm vaults A-B have been removed from the system
    assert.isFalse(await sortedVaults.contains(alice))
    assert.isFalse(await sortedVaults.contains(bob))

    // Check all vaults A-B are now closed by liquidation
    assert.equal((await vaultManager.Vaults(alice))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(bob))[3].toString(), '3')

    // Confirm vaults C-E remain in the system
    assert.isTrue(await sortedVaults.contains(carol))
    assert.isTrue(await sortedVaults.contains(dennis))
    assert.isTrue(await sortedVaults.contains(erin))

    // Check all vaults C-E are still active
    assert.equal((await vaultManager.Vaults(carol))[3].toString(), '1')
    assert.equal((await vaultManager.Vaults(dennis))[3].toString(), '1')
    assert.equal((await vaultManager.Vaults(erin))[3].toString(), '1')

    // Check sorted list has been reduced to length 4
    assert.equal((await sortedVaults.getSize()).toString(), '4')
  })

  it('batchLiquidateVaults(): does not close vaults with ICR >= MCR in the given array', async () => {
    // --- SETUP ---
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedVaults.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1RBTC:100BPD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm vaults A-C are ICR < 110%
    assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR >= 110%
    assert.isTrue((await vaultManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await vaultManager.getCurrentICR(whale, price)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await vaultManager.batchLiquidateVaults(liquidationArray);

    // Confirm vaults D-E and whale remain in the system
    assert.isTrue(await sortedVaults.contains(dennis))
    assert.isTrue(await sortedVaults.contains(erin))
    assert.isTrue(await sortedVaults.contains(whale))

    // Check all vaults D-E and whale remain active
    assert.equal((await vaultManager.Vaults(dennis))[3].toString(), '1')
    assert.equal((await vaultManager.Vaults(erin))[3].toString(), '1')
    assert.isTrue(await sortedVaults.contains(whale))

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedVaults.getSize()).toString(), '3')
  })

  it('batchLiquidateVaults(): reverts if array is empty', async () => {
    // --- SETUP ---
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedVaults.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1RBTC:100BPD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    liquidationArray = []
    try {
      const tx = await vaultManager.batchLiquidateVaults(liquidationArray);
      assert.isFalse(tx.receipt.status)
    } catch (error) {
      assert.include(error.message, "VaultManager: Calldata address array must not be empty")
    }
  })

  it("batchLiquidateVaults(): skips if vault is non-existent", async () => {
    // --- SETUP ---
    const spDeposit = toBN(dec(500000, 18))
    await openVault({ ICR: toBN(dec(100, 18)), extraBPDAmount: spDeposit, extraParams: { from: whale } })

    const { totalDebt: A_debt } = await openVault({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    const { totalDebt: B_debt } = await openVault({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    assert.equal(await vaultManager.getVaultStatus(carol), 0) // check vault non-existent

    // Check full sorted list size is 6
    assert.equal((await sortedVaults.getSize()).toString(), '5')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1RBTC:100BPD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm vaults A-B are ICR < 110%
    assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(bob, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await vaultManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await vaultManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate - vault C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await vaultManager.batchLiquidateVaults(liquidationArray);

    // Confirm vaults A-B have been removed from the system
    assert.isFalse(await sortedVaults.contains(alice))
    assert.isFalse(await sortedVaults.contains(bob))

    // Check all vaults A-B are now closed by liquidation
    assert.equal((await vaultManager.Vaults(alice))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(bob))[3].toString(), '3')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedVaults.getSize()).toString(), '3')

    // Confirm vault C non-existent
    assert.isFalse(await sortedVaults.contains(carol))
    assert.equal((await vaultManager.Vaults(carol))[3].toString(), '0')

    // Check Stability pool has only been reduced by A-B
    th.assertIsApproximatelyEqual((await stabilityPool.getTotalBPDDeposits()).toString(), spDeposit.sub(A_debt).sub(B_debt))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
  })

  it("batchLiquidateVaults(): skips if a vault has been closed", async () => {
    // --- SETUP ---
    const spDeposit = toBN(dec(500000, 18))
    await openVault({ ICR: toBN(dec(100, 18)), extraBPDAmount: spDeposit, extraParams: { from: whale } })

    const { totalDebt: A_debt } = await openVault({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    const { totalDebt: B_debt } = await openVault({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openVault({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    assert.isTrue(await sortedVaults.contains(carol))

    // Check full sorted list size is 6
    assert.equal((await sortedVaults.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale })

    // Whale transfers to Carol so she can close her vault
    await bpdToken.transfer(carol, dec(100, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1RBTC:100BPD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Carol liquidated, and her vault is closed
    const txCarolClose = await borrowerOperations.closeVault({ from: carol })
    assert.isTrue(txCarolClose.receipt.status)

    assert.isFalse(await sortedVaults.contains(carol))

    assert.equal(await vaultManager.getVaultStatus(carol), 2)  // check vault closed

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm vaults A-B are ICR < 110%
    assert.isTrue((await vaultManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(bob, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await vaultManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await vaultManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await vaultManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate - vault C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await vaultManager.batchLiquidateVaults(liquidationArray);

    // Confirm vaults A-B have been removed from the system
    assert.isFalse(await sortedVaults.contains(alice))
    assert.isFalse(await sortedVaults.contains(bob))

    // Check all vaults A-B are now closed by liquidation
    assert.equal((await vaultManager.Vaults(alice))[3].toString(), '3')
    assert.equal((await vaultManager.Vaults(bob))[3].toString(), '3')
    // Vault C still closed by user
    assert.equal((await vaultManager.Vaults(carol))[3].toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedVaults.getSize()).toString(), '3')

    // Check Stability pool has only been reduced by A-B
    th.assertIsApproximatelyEqual((await stabilityPool.getTotalBPDDeposits()).toString(), spDeposit.sub(A_debt).sub(B_debt))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
  })

  it("batchLiquidateVaults: when SP > 0, triggers MP reward event - increases the sum G", async () => {
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open vaults
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(167, 16)), extraParams: { from: C } })

    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalBPDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1RBTC:100BPD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate vaults
    await vaultManager.batchLiquidateVaults([defaulter_1, defaulter_2])
    assert.isFalse(await sortedVaults.contains(defaulter_1))
    assert.isFalse(await sortedVaults.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the MP reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("batchLiquidateVaults(): when SP is empty, doesn't update G", async () => {
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open vaults
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(167, 16)), extraParams: { from: C } })

    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalBPDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1RBTC:100BPD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // liquidate vaults
    await vaultManager.batchLiquidateVaults([defaulter_1, defaulter_2])
    assert.isFalse(await sortedVaults.contains(defaulter_1))
    assert.isFalse(await sortedVaults.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  // --- redemptions ---


  it('getRedemptionHints(): gets the address of the first Vault and the final ICR of the last Vault involved in a redemption', async () => {
    // --- SETUP ---
    const partialRedemptionAmount = toBN(dec(100, 18))
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(310, 16)), extraBPDAmount: partialRedemptionAmount, extraParams: { from: alice } })
    const { netDebt: B_debt } = await openVault({ ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    const { netDebt: C_debt } = await openVault({ ICR: toBN(dec(250, 16)), extraParams: { from: carol } })
    // Dennis' Vault should be untouched by redemption, because its ICR will be < 110% after the price drop
    await openVault({ ICR: toBN(dec(120, 16)), extraParams: { from: dennis } })

    // Drop the price
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);

    // --- TEST ---
    const redemptionAmount = C_debt.add(B_debt).add(partialRedemptionAmount)
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, price, 0)

    assert.equal(firstRedemptionHint, carol)
    const expectedICR = A_coll.mul(price).sub(partialRedemptionAmount.mul(mv._1e18BN)).div(A_totalDebt.sub(partialRedemptionAmount))
    th.assertIsApproximatelyEqual(partialRedemptionHintNICR, expectedICR)
  });

  it('getRedemptionHints(): returns 0 as partialRedemptionHintNICR when reaching _maxIterations', async () => {
    // --- SETUP ---
    await openVault({ ICR: toBN(dec(310, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(250, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(180, 16)), extraParams: { from: dennis } })

    const price = await priceFeed.getPrice();

    // --- TEST ---

    // Get hints for a redemption of 170 + 30 + some extra BPD. At least 3 iterations are needed
    // for total redemption of the given amount.
    const {
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints('210' + _18_zeros, price, 2) // limit _maxIterations to 2

    assert.equal(partialRedemptionHintNICR, '0')
  });

  it('redeemCollateral(): cancels the provided BPD with debt from Vaults with the lowest ICRs and sends an equivalent amount of Bitcoin', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(310, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openVault({ ICR: toBN(dec(290, 16)), extraBPDAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openVault({ ICR: toBN(dec(250, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: carol } })
    const partialRedemptionAmount = toBN(2)
    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount)
    // start Dennis with a high ICR
    await openVault({ ICR: toBN(dec(100, 18)), extraBPDAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_RBTCBalance_Before = toBN(await web3.eth.getBalance(dennis))

    const dennis_BPDBalance_Before = await bpdToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST ---

    // Find hints for redeeming 20 BPD
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, price, 0)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedVaults.findInsertPosition(
      partialRedemptionHintNICR,
      dennis,
      dennis
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // Dennis redeems 20 BPD
    // Don't pay for gas, as it makes it easier to calculate the received Bitcoin
    const redemptionTx = await vaultManager.redeemCollateral(
      redemptionAmount,
      firstRedemptionHint,
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const RBTCFee = th.getEmittedRedemptionValues(redemptionTx)[3]

    const alice_Vault_After = await vaultManager.Vaults(alice)
    const bob_Vault_After = await vaultManager.Vaults(bob)
    const carol_Vault_After = await vaultManager.Vaults(carol)

    const alice_debt_After = alice_Vault_After[0].toString()
    const bob_debt_After = bob_Vault_After[0].toString()
    const carol_debt_After = carol_Vault_After[0].toString()

    /* check that Dennis' redeemed 20 BPD has been cancelled with debt from Bobs's Vault (8) and Carol's Vault (10).
    The remaining lot (2) is sent to Alice's Vault, who had the best ICR.
    It leaves her with (3) BPD debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(alice_debt_After, A_totalDebt.sub(partialRedemptionAmount))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_RBTCBalance_After = toBN(await web3.eth.getBalance(dennis))
    const receivedRBTC = dennis_RBTCBalance_After.sub(dennis_RBTCBalance_Before)

    const expectedTotalRBTCDrawn = redemptionAmount.div(toBN(200)) // convert redemptionAmount BPD to RBTC, at RBTC:USD price 200
    const expectedReceivedRBTC = expectedTotalRBTCDrawn.sub(toBN(RBTCFee))

    th.assertIsApproximatelyEqual(expectedReceivedRBTC, receivedRBTC)

    const dennis_BPDBalance_After = (await bpdToken.balanceOf(dennis)).toString()
    assert.equal(dennis_BPDBalance_After, dennis_BPDBalance_Before.sub(redemptionAmount))
  })

  it('redeemCollateral(): ends the redemption sequence when the token redemption request has been filled', async () => {
    // --- SETUP --- 
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol, Dennis, Erin open vaults
    const { netDebt: A_debt } = await openVault({ ICR: toBN(dec(290, 16)), extraBPDAmount: dec(20, 18), extraParams: { from: alice } })
    const { netDebt: B_debt } = await openVault({ ICR: toBN(dec(290, 16)), extraBPDAmount: dec(20, 18), extraParams: { from: bob } })
    const { netDebt: C_debt } = await openVault({ ICR: toBN(dec(290, 16)), extraBPDAmount: dec(20, 18), extraParams: { from: carol } })
    const redemptionAmount = A_debt.add(B_debt).add(C_debt)
    const { totalDebt: D_totalDebt, collateral: D_coll } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt, collateral: E_coll } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: erin } })

    // --- TEST --- 

    // open vault from redeemer.  Redeemer has highest ICR (100RBTC, 100 BPD), 20000%
    const { bpdAmount: F_bpdAmount } = await openVault({ ICR: toBN(dec(200, 18)), extraBPDAmount: redemptionAmount.mul(toBN(2)), extraParams: { from: flyn } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // Flyn redeems collateral
    await vaultManager.redeemCollateral(redemptionAmount, alice, alice, alice, 0, 0, th._100pct, { from: flyn })

    // Check Flyn's redemption has reduced his balance from 100 to (100-60) = 40 BPD
    const flynBalance = await bpdToken.balanceOf(flyn)
    th.assertIsApproximatelyEqual(flynBalance, F_bpdAmount.sub(redemptionAmount))

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await vaultManager.getVaultDebt(alice)
    const bob_Debt = await vaultManager.getVaultDebt(bob)
    const carol_Debt = await vaultManager.getVaultDebt(carol)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    assert.equal(carol_Debt, 0)

    // check Alice, Bob and Carol vaults are closed by redemption
    const alice_Status = await vaultManager.getVaultStatus(alice)
    const bob_Status = await vaultManager.getVaultStatus(bob)
    const carol_Status = await vaultManager.getVaultStatus(carol)
    assert.equal(alice_Status, 4)
    assert.equal(bob_Status, 4)
    assert.equal(carol_Status, 4)

    // check debt and coll of Dennis, Erin has not been impacted by redemption
    const dennis_Debt = await vaultManager.getVaultDebt(dennis)
    const erin_Debt = await vaultManager.getVaultDebt(erin)

    th.assertIsApproximatelyEqual(dennis_Debt, D_totalDebt)
    th.assertIsApproximatelyEqual(erin_Debt, E_totalDebt)

    const dennis_Coll = await vaultManager.getVaultColl(dennis)
    const erin_Coll = await vaultManager.getVaultColl(erin)

    assert.equal(dennis_Coll.toString(), D_coll.toString())
    assert.equal(erin_Coll.toString(), E_coll.toString())
  })

  it('redeemCollateral(): ends the redemption sequence when max iterations have been reached', async () => {
    // --- SETUP --- 
    await openVault({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol open vaults with equal collateral ratio
    const { netDebt: A_debt } = await openVault({ ICR: toBN(dec(286, 16)), extraBPDAmount: dec(20, 18), extraParams: { from: alice } })
    const { netDebt: B_debt } = await openVault({ ICR: toBN(dec(286, 16)), extraBPDAmount: dec(20, 18), extraParams: { from: bob } })
    const { netDebt: C_debt, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(286, 16)), extraBPDAmount: dec(20, 18), extraParams: { from: carol } })
    const redemptionAmount = A_debt.add(B_debt)
    const attemptedRedemptionAmount = redemptionAmount.add(C_debt)

    // --- TEST --- 

    // open vault from redeemer.  Redeemer has highest ICR (100RBTC, 100 BPD), 20000%
    const { bpdAmount: F_bpdAmount } = await openVault({ ICR: toBN(dec(200, 18)), extraBPDAmount: redemptionAmount.mul(toBN(2)), extraParams: { from: flyn } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // Flyn redeems collateral with only two iterations
    await vaultManager.redeemCollateral(attemptedRedemptionAmount, alice, alice, alice, 0, 2, th._100pct, { from: flyn })

    // Check Flyn's redemption has reduced his balance from 100 to (100-40) = 60 BPD
    const flynBalance = (await bpdToken.balanceOf(flyn)).toString()
    th.assertIsApproximatelyEqual(flynBalance, F_bpdAmount.sub(redemptionAmount))

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await vaultManager.getVaultDebt(alice)
    const bob_Debt = await vaultManager.getVaultDebt(bob)
    const carol_Debt = await vaultManager.getVaultDebt(carol)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    th.assertIsApproximatelyEqual(carol_Debt, C_totalDebt)

    // check Alice and Bob vaults are closed, but Carol is not
    const alice_Status = await vaultManager.getVaultStatus(alice)
    const bob_Status = await vaultManager.getVaultStatus(bob)
    const carol_Status = await vaultManager.getVaultStatus(carol)
    assert.equal(alice_Status, 4)
    assert.equal(bob_Status, 4)
    assert.equal(carol_Status, 1)
  })

  it("redeemCollateral(): performs partial redemption if resultant debt is > minimum net debt", async () => {
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(10000, 18)), A, A, { from: A, value: dec(1000, 'ether') })
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(20000, 18)), B, B, { from: B, value: dec(1000, 'ether') })
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(30000, 18)), C, C, { from: C, value: dec(1000, 'ether') })

    // A and C send all their tokens to B
    await bpdToken.transfer(B, await bpdToken.balanceOf(A), {from: A})
    await bpdToken.transfer(B, await bpdToken.balanceOf(C), {from: C})
    
    await vaultManager.setBaseRate(0) 

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // BPD redemption is 55000 US
    const BPDRedemption = dec(55000, 18)
    const tx1 = await th.redeemCollateralAndGetTxObject(B, contracts, BPDRedemption, th._100pct)
    
    // Check B, C closed and A remains active
    assert.isTrue(await sortedVaults.contains(A))
    assert.isFalse(await sortedVaults.contains(B))
    assert.isFalse(await sortedVaults.contains(C))

    // A's remaining debt = 29800 + 19800 + 9800 + 200 - 55000 = 4600
    const A_debt = await vaultManager.getVaultDebt(A)
    await th.assertIsApproximatelyEqual(A_debt, dec(4600, 18), 1000) 
  })

  it("redeemCollateral(): doesn't perform partial redemption if resultant debt would be < minimum net debt", async () => {
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(6000, 18)), A, A, { from: A, value: dec(1000, 'ether') })
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(20000, 18)), B, B, { from: B, value: dec(1000, 'ether') })
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(30000, 18)), C, C, { from: C, value: dec(1000, 'ether') })

    // A and C send all their tokens to B
    await bpdToken.transfer(B, await bpdToken.balanceOf(A), {from: A})
    await bpdToken.transfer(B, await bpdToken.balanceOf(C), {from: C})

    await vaultManager.setBaseRate(0) 

    // Skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // BPD redemption is 55000 BPD
    const BPDRedemption = dec(55000, 18)
    const tx1 = await th.redeemCollateralAndGetTxObject(B, contracts, BPDRedemption, th._100pct)
    
    // Check B, C closed and A remains active
    assert.isTrue(await sortedVaults.contains(A))
    assert.isFalse(await sortedVaults.contains(B))
    assert.isFalse(await sortedVaults.contains(C))

    // A's remaining debt would be 29950 + 19950 + 5950 + 50 - 55000 = 900.
    // Since this is below the min net debt of 100, A should be skipped and untouched by the redemption
    const A_debt = await vaultManager.getVaultDebt(A)
    await th.assertIsApproximatelyEqual(A_debt, dec(6000, 18))
  })

  it('redeemCollateral(): doesnt perform the final partial redemption in the sequence if the hint is out-of-date', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(363, 16)), extraBPDAmount: dec(5, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openVault({ ICR: toBN(dec(344, 16)), extraBPDAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openVault({ ICR: toBN(dec(333, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: carol } })

    const partialRedemptionAmount = toBN(2)
    const fullfilledRedemptionAmount = C_netDebt.add(B_netDebt)
    const redemptionAmount = fullfilledRedemptionAmount.add(partialRedemptionAmount)

    await openVault({ ICR: toBN(dec(100, 18)), extraBPDAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_RBTCBalance_Before = toBN(await web3.eth.getBalance(dennis))

    const dennis_BPDBalance_Before = await bpdToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST --- 

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, price, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedVaults.findInsertPosition(
      partialRedemptionHintNICR,
      dennis,
      dennis
    )

    const frontRunRedepmtion = toBN(dec(1, 18))
    // Oops, another transaction gets in the way
    {
      const {
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(dec(1, 18), price, 0)

      const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedVaults.findInsertPosition(
        partialRedemptionHintNICR,
        dennis,
        dennis
      )

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

      // Alice redeems 1 BPD from Carol's Vault
      await vaultManager.redeemCollateral(
        frontRunRedepmtion,
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: alice }
      )
    }

    // Dennis tries to redeem 20 BPD
    const redemptionTx = await vaultManager.redeemCollateral(
      redemptionAmount,
      firstRedemptionHint,
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const RBTCFee = th.getEmittedRedemptionValues(redemptionTx)[3]

    // Since Alice already redeemed 1 BPD from Carol's Vault, Dennis was  able to redeem:
    //  - 9 BPD from Carol's
    //  - 8 BPD from Bob's
    // for a total of 17 BPD.

    // Dennis calculated his hint for redeeming 2 BPD from Alice's Vault, but after Alice's transaction
    // got in the way, he would have needed to redeem 3 BPD to fully complete his redemption of 20 BPD.
    // This would have required a different hint, therefore he ended up with a partial redemption.

    const dennis_RBTCBalance_After = toBN(await web3.eth.getBalance(dennis))
    const receivedRBTC = dennis_RBTCBalance_After.sub(dennis_RBTCBalance_Before)

    // Expect only 17 worth of RBTC drawn
    const expectedTotalRBTCDrawn = fullfilledRedemptionAmount.sub(frontRunRedepmtion).div(toBN(200)) // redempted BPD converted to RBTC, at RBTC:USD price 200
    const expectedReceivedRBTC = expectedTotalRBTCDrawn.sub(RBTCFee)

    th.assertIsApproximatelyEqual(expectedReceivedRBTC, receivedRBTC)

    const dennis_BPDBalance_After = (await bpdToken.balanceOf(dennis)).toString()
    th.assertIsApproximatelyEqual(dennis_BPDBalance_After, dennis_BPDBalance_Before.sub(fullfilledRedemptionAmount.sub(frontRunRedepmtion)))
  })

  // active debt cannot be zero, as there’s a positive min debt enforced, and at least a vault must exist
  it.skip("redeemCollateral(): can redeem if there is zero active debt but non-zero debt in DefaultPool", async () => {
    // --- SETUP ---

    const amount = await getOpenVaultBPDAmount(dec(110, 18))
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(133, 16)), extraBPDAmount: amount, extraParams: { from: bob } })

    await bpdToken.transfer(carol, amount, { from: bob })

    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // Liquidate Bob's Vault
    await vaultManager.liquidateVaults(1)

    // --- TEST --- 

    const caroB_RBTCBalance_Before = toBN(await web3.eth.getBalance(carol))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    const redemptionTx = await vaultManager.redeemCollateral(
      amount,
      alice,
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '10367038690476190477',
      0,
      th._100pct,
      {
        from: carol,
        gasPrice: 0
      }
    )

    const RBTCFee = th.getEmittedRedemptionValues(redemptionTx)[3]

    const caroB_RBTCBalance_After = toBN(await web3.eth.getBalance(carol))

    const expectedTotalRBTCDrawn = toBN(amount).div(toBN(100)) // convert 100 BPD to RBTC at RBTC:USD price of 100
    const expectedReceivedRBTC = expectedTotalRBTCDrawn.sub(RBTCFee)

    const receivedRBTC = caroB_RBTCBalance_After.sub(caroB_RBTCBalance_Before)
    assert.isTrue(expectedReceivedRBTC.eq(receivedRBTC))

    const carol_BPDBalance_After = (await bpdToken.balanceOf(carol)).toString()
    assert.equal(carol_BPDBalance_After, '0')
  })

  it("redeemCollateral(): doesn't touch Vaults with ICR < 110%", async () => {
    // --- SETUP ---

    const { netDebt: A_debt } = await openVault({ ICR: toBN(dec(13, 18)), extraParams: { from: alice } })
    const { bpdAmount: B_bpdAmount, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(133, 16)), extraBPDAmount: A_debt, extraParams: { from: bob } })

    await bpdToken.transfer(carol, B_bpdAmount, { from: bob })

    // Put Bob's Vault below 110% ICR
    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // --- TEST --- 

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    await vaultManager.redeemCollateral(
      A_debt,
      alice,
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      th._100pct,
      { from: carol }
    );

    // Alice's Vault was cleared of debt
    const { debt: alice_Debt_After } = await vaultManager.Vaults(alice)
    assert.equal(alice_Debt_After, '0')

    // Bob's Vault was left untouched
    const { debt: bob_Debt_After } = await vaultManager.Vaults(bob)
    th.assertIsApproximatelyEqual(bob_Debt_After, B_totalDebt)
  });

  it("redeemCollateral(): finds the last Vault with ICR == 110% even if there is more than one", async () => {
    // --- SETUP ---
    const amount1 = toBN(dec(100, 18))
    const { totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: amount1, extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: amount1, extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: amount1, extraParams: { from: carol } })
    const redemptionAmount = C_totalDebt.add(B_totalDebt).add(A_totalDebt)
    const { totalDebt: D_totalDebt } = await openVault({ ICR: toBN(dec(195, 16)), extraBPDAmount: redemptionAmount, extraParams: { from: dennis } })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%
    const price = '110' + _18_zeros
    await priceFeed.setPrice(price)

    const orderOfVaults = [];
    let current = await sortedVaults.getFirst();

    while (current !== '0x0000000000000000000000000000000000000000') {
      orderOfVaults.push(current);
      current = await sortedVaults.getNext(current);
    }

    assert.deepEqual(orderOfVaults, [carol, bob, alice, dennis]);

    await openVault({ ICR: toBN(dec(100, 18)), extraBPDAmount: dec(10, 18), extraParams: { from: whale } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    const tx = await vaultManager.redeemCollateral(
      redemptionAmount,
      carol, // try to trick redeemCollateral by passing a hint that doesn't exactly point to the
      // last Vault with ICR == 110% (which would be Alice's)
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      th._100pct,
      { from: dennis }
    )
    
    const { debt: alice_Debt_After } = await vaultManager.Vaults(alice)
    assert.equal(alice_Debt_After, '0')

    const { debt: bob_Debt_After } = await vaultManager.Vaults(bob)
    assert.equal(bob_Debt_After, '0')

    const { debt: carol_Debt_After } = await vaultManager.Vaults(carol)
    assert.equal(carol_Debt_After, '0')

    const { debt: dennis_Debt_After } = await vaultManager.Vaults(dennis)
    th.assertIsApproximatelyEqual(dennis_Debt_After, D_totalDebt)
  });

  it("redeemCollateral(): reverts when TCR < MCR", async () => {
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(196, 16)), extraParams: { from: dennis } })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%
  
    await priceFeed.setPrice('110' + _18_zeros)
    const price = await priceFeed.getPrice()
    
    const TCR = (await th.getTCR(contracts))
    assert.isTrue(TCR.lt(toBN('1100000000000000000')))

    await assertRevert(th.redeemCollateral(carol, contracts, dec(270, 18)), "VaultManager: Cannot redeem when TCR < MCR")
  });

  it("redeemCollateral(): reverts when argument _amount is 0", async () => {
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens vault and transfers 500BPD to Erin, the would-be redeemer
    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(500, 18), extraParams: { from: alice } })
    await bpdToken.transfer(erin, dec(500, 18), { from: alice })

    // B, C and D open vaults
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: dennis } })

    // Erin attempts to redeem with _amount = 0
    const redemptionTxPromise = vaultManager.redeemCollateral(0, erin, erin, erin, 0, 0, th._100pct, { from: erin })
    await assertRevert(redemptionTxPromise, "VaultManager: Amount must be greater than zero")
  })

  it("redeemCollateral(): reverts if max fee > 100%", async () => {
    await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(20, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(30, 18), extraParams: { from: C } })
    await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(40, 18), extraParams: { from: D } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), dec(2, 18)), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), '1000000000000000001'), "Max fee percentage must be between 0.5% and 100%")
  })

  it("redeemCollateral(): reverts if max fee < 0.5%", async () => { 
    await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(10, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(20, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(30, 18), extraParams: { from: C } })
    await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(40, 18), extraParams: { from: D } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), 0), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), 1), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), '4999999999999999'), "Max fee percentage must be between 0.5% and 100%")
  })

  it("redeemCollateral(): reverts if fee exceeds max fee percentage", async () => {
    const { totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(80, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(90, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })
    const expectedTotalSupply = A_totalDebt.add(B_totalDebt).add(C_totalDebt)

    // Check total BPD supply
    const totalSupply = await bpdToken.totalSupply()
    th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)

    await vaultManager.setBaseRate(0) 

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // BPD redemption is 27 USD: a redemption that incurs a fee of 27/(270 * 2) = 5%
    const attemptedBPDRedemption = expectedTotalSupply.div(toBN(10))

    // Max fee is <5%
    const lessThan5pct = '49999999999999999'
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedBPDRedemption, lessThan5pct), "Fee exceeded provided maximum")
  
    await vaultManager.setBaseRate(0)  // artificially zero the baseRate
    
    // Max fee is 1%
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedBPDRedemption, dec(1, 16)), "Fee exceeded provided maximum")
  
    await vaultManager.setBaseRate(0)

     // Max fee is 3.754%
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedBPDRedemption, dec(3754, 13)), "Fee exceeded provided maximum")
  
    await vaultManager.setBaseRate(0)

    // Max fee is 0.5%
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedBPDRedemption, dec(5, 15)), "Fee exceeded provided maximum")
  })

  it("redeemCollateral(): succeeds if fee is less than max fee percentage", async () => {
    const { totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(9500, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(395, 16)), extraBPDAmount: dec(9000, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(390, 16)), extraBPDAmount: dec(10000, 18), extraParams: { from: C } })
    const expectedTotalSupply = A_totalDebt.add(B_totalDebt).add(C_totalDebt)

    // Check total BPD supply
    const totalSupply = await bpdToken.totalSupply()
    th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)

    await vaultManager.setBaseRate(0) 

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // BPD redemption fee with 10% of the supply will be 0.5% + 1/(10*2)
    const attemptedBPDRedemption = expectedTotalSupply.div(toBN(10))

    // Attempt with maxFee > 5.5%
    const price = await priceFeed.getPrice()
    const RBTCDrawn = attemptedBPDRedemption.mul(mv._1e18BN).div(price)
    const slightlyMoreThanFee = (await vaultManager.getRedemptionFeeWithDecay(RBTCDrawn))
    const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, attemptedBPDRedemption, slightlyMoreThanFee)
    assert.isTrue(tx1.receipt.status)

    await vaultManager.setBaseRate(0)  // Artificially zero the baseRate
    
    // Attempt with maxFee = 5.5%
    const exactSameFee = (await vaultManager.getRedemptionFeeWithDecay(RBTCDrawn))
    const tx2 = await th.redeemCollateralAndGetTxObject(C, contracts, attemptedBPDRedemption, exactSameFee)
    assert.isTrue(tx2.receipt.status)

    await vaultManager.setBaseRate(0)

     // Max fee is 10%
    const tx3 = await th.redeemCollateralAndGetTxObject(B, contracts, attemptedBPDRedemption, dec(1, 17))
    assert.isTrue(tx3.receipt.status)

    await vaultManager.setBaseRate(0)

    // Max fee is 37.659%
    const tx4 = await th.redeemCollateralAndGetTxObject(A, contracts, attemptedBPDRedemption, dec(37659, 13))
    assert.isTrue(tx4.receipt.status)

    await vaultManager.setBaseRate(0)

    // Max fee is 100%
    const tx5 = await th.redeemCollateralAndGetTxObject(C, contracts, attemptedBPDRedemption, dec(1, 18))
    assert.isTrue(tx5.receipt.status)
  })

  it("redeemCollateral(): doesn't affect the Stability Pool deposits or RBTC gain of redeemed-from vaults", async () => {
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // B, C, D, F open vault
    const { totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(195, 16)), extraBPDAmount: dec(200, 18), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(400, 18), extraParams: { from: dennis } })
    const { totalDebt: F_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: flyn } })

    const redemptionAmount = B_totalDebt.add(C_totalDebt).add(D_totalDebt).add(F_totalDebt)
    // Alice opens vault and transfers BPD to Erin, the would-be redeemer
    await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: redemptionAmount, extraParams: { from: alice } })
    await bpdToken.transfer(erin, redemptionAmount, { from: alice })

    // B, C, D deposit some of their tokens to the Stability Pool
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: bob })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: carol })
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

    let price = await priceFeed.getPrice()
    const bob_ICR_before = await vaultManager.getCurrentICR(bob, price)
    const carol_ICR_before = await vaultManager.getCurrentICR(carol, price)
    const dennis_ICR_before = await vaultManager.getCurrentICR(dennis, price)

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await sortedVaults.contains(flyn))

    // Liquidate Flyn
    await vaultManager.liquidate(flyn)
    assert.isFalse(await sortedVaults.contains(flyn))

    // Price bounces back, bringing B, C, D back above MCR
    await priceFeed.setPrice(dec(200, 18))

    const bob_SPDeposit_before = (await stabilityPool.getCompoundedBPDDeposit(bob)).toString()
    const carol_SPDeposit_before = (await stabilityPool.getCompoundedBPDDeposit(carol)).toString()
    const dennis_SPDeposit_before = (await stabilityPool.getCompoundedBPDDeposit(dennis)).toString()

    const bob_RBTCGain_before = (await stabilityPool.getDepositorRBTCGain(bob)).toString()
    const caroB_RBTCGain_before = (await stabilityPool.getDepositorRBTCGain(carol)).toString()
    const dennis_RBTCGain_before = (await stabilityPool.getDepositorRBTCGain(dennis)).toString()

    // Check the remaining BPD and RBTC in Stability Pool after liquidation is non-zero
    const BPDinSP = await stabilityPool.getTotalBPDDeposits()
    const RBTCinSP = await stabilityPool.getRBTC()
    assert.isTrue(BPDinSP.gte(mv._zeroBN))
    assert.isTrue(RBTCinSP.gte(mv._zeroBN))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // Erin redeems BPD
    await th.redeemCollateral(erin, contracts, redemptionAmount, th._100pct)

    price = await priceFeed.getPrice()
    const bob_ICR_after = await vaultManager.getCurrentICR(bob, price)
    const carol_ICR_after = await vaultManager.getCurrentICR(carol, price)
    const dennis_ICR_after = await vaultManager.getCurrentICR(dennis, price)

    // Check ICR of B, C and D vaults has increased,i.e. they have been hit by redemptions
    assert.isTrue(bob_ICR_after.gte(bob_ICR_before))
    assert.isTrue(carol_ICR_after.gte(carol_ICR_before))
    assert.isTrue(dennis_ICR_after.gte(dennis_ICR_before))

    const bob_SPDeposit_after = (await stabilityPool.getCompoundedBPDDeposit(bob)).toString()
    const carol_SPDeposit_after = (await stabilityPool.getCompoundedBPDDeposit(carol)).toString()
    const dennis_SPDeposit_after = (await stabilityPool.getCompoundedBPDDeposit(dennis)).toString()

    const bob_RBTCGain_after = (await stabilityPool.getDepositorRBTCGain(bob)).toString()
    const caroB_RBTCGain_after = (await stabilityPool.getDepositorRBTCGain(carol)).toString()
    const dennis_RBTCGain_after = (await stabilityPool.getDepositorRBTCGain(dennis)).toString()

    // Check B, C, D Stability Pool deposits and RBTC gain have not been affected by redemptions from their vaults
    assert.equal(bob_SPDeposit_before, bob_SPDeposit_after)
    assert.equal(carol_SPDeposit_before, carol_SPDeposit_after)
    assert.equal(dennis_SPDeposit_before, dennis_SPDeposit_after)

    assert.equal(bob_RBTCGain_before, bob_RBTCGain_after)
    assert.equal(caroB_RBTCGain_before, caroB_RBTCGain_after)
    assert.equal(dennis_RBTCGain_before, dennis_RBTCGain_after)
  })

  it("redeemCollateral(): caller can redeem their entire BPDToken balance", async () => {
    const { collateral: W_coll, totalDebt: W_totalDebt } = await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens vault and transfers 400 BPD to Erin, the would-be redeemer
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(400, 18), extraParams: { from: alice } })
    await bpdToken.transfer(erin, dec(400, 18), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await bpdToken.balanceOf(erin)
    assert.equal(erin_balance_before, dec(400, 18))

    // B, C, D open vault
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(590, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(1990, 18), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openVault({ ICR: toBN(dec(500, 16)), extraBPDAmount: dec(1990, 18), extraParams: { from: dennis } })

    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)
    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getBPDDebt()
    const activePool_coll_before = await activePool.getRBTC()

    th.assertIsApproximatelyEqual(activePool_debt_before, totalDebt)
    assert.equal(activePool_coll_before.toString(), totalColl)

    const price = await priceFeed.getPrice()

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // Erin attempts to redeem 400 BPD
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(dec(400, 18), price, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedVaults.findInsertPosition(
      partialRedemptionHintNICR,
      erin,
      erin
    )

    await vaultManager.redeemCollateral(
      dec(400, 18),
      firstRedemptionHint,
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      { from: erin })

    // Check activePool debt reduced by  400 BPD
    const activePool_debt_after = await activePool.getBPDDebt()
    assert.equal(activePool_debt_before.sub(activePool_debt_after), dec(400, 18))

    /* Check ActivePool coll reduced by $400 worth of Bitcoin: at RBTC:USD price of $200, this should be 2 RBTC.

    therefore remaining ActivePool RBTC should be 198 */
    const activePool_coll_after = await activePool.getRBTC()
    // console.log(`activePool_coll_after: ${activePool_coll_after}`)
    assert.equal(activePool_coll_after.toString(), activePool_coll_before.sub(toBN(dec(2, 18))))

    // Check Erin's balance after
    const erin_balance_after = (await bpdToken.balanceOf(erin)).toString()
    assert.equal(erin_balance_after, '0')
  })

  it("redeemCollateral(): reverts when requested redemption amount exceeds caller's BPD token balance", async () => {
    const { collateral: W_coll, totalDebt: W_totalDebt } = await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens vault and transfers 400 BPD to Erin, the would-be redeemer
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(400, 18), extraParams: { from: alice } })
    await bpdToken.transfer(erin, dec(400, 18), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await bpdToken.balanceOf(erin)
    assert.equal(erin_balance_before, dec(400, 18))

    // B, C, D open vault
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(590, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(1990, 18), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openVault({ ICR: toBN(dec(500, 16)), extraBPDAmount: dec(1990, 18), extraParams: { from: dennis } })

    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)
    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getBPDDebt()
    const activePool_coll_before = (await activePool.getRBTC()).toString()

    th.assertIsApproximatelyEqual(activePool_debt_before, totalDebt)
    assert.equal(activePool_coll_before, totalColl)

    const price = await priceFeed.getPrice()

    let firstRedemptionHint
    let partialRedemptionHintNICR

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // Erin tries to redeem 1000 BPD
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(dec(1000, 18), price, 0))

      const { 0: upperPartialRedemptionHint_1, 1: lowerPartialRedemptionHint_1 } = await sortedVaults.findInsertPosition(
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await vaultManager.redeemCollateral(
        dec(1000, 18),
        firstRedemptionHint,
        upperPartialRedemptionHint_1,
        lowerPartialRedemptionHint_1,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: erin })

      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's BPD token balance")
    }

    // Erin tries to redeem 401 BPD
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints('401000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_2, 1: lowerPartialRedemptionHint_2 } = await sortedVaults.findInsertPosition(
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await vaultManager.redeemCollateral(
        '401000000000000000000', firstRedemptionHint,
        upperPartialRedemptionHint_2,
        lowerPartialRedemptionHint_2,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's BPD token balance")
    }

    // Erin tries to redeem 239482309 BPD
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints('239482309000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_3, 1: lowerPartialRedemptionHint_3 } = await sortedVaults.findInsertPosition(
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await vaultManager.redeemCollateral(
        '239482309000000000000000000', firstRedemptionHint,
        upperPartialRedemptionHint_3,
        lowerPartialRedemptionHint_3,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's BPD token balance")
    }

    // Erin tries to redeem 2^256 - 1 BPD
    const maxBytes32 = toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints('239482309000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_4, 1: lowerPartialRedemptionHint_4 } = await sortedVaults.findInsertPosition(
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await vaultManager.redeemCollateral(
        maxBytes32, firstRedemptionHint,
        upperPartialRedemptionHint_4,
        lowerPartialRedemptionHint_4,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's BPD token balance")
    }
  })

  it("redeemCollateral(): value of issued RBTC == face value of redeemed BPD (assuming 1 BPD has value of $1)", async () => {
    const { collateral: W_coll } = await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens vault and transfers 1000 BPD each to Erin, Flyn, Graham
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(400, 16)), extraBPDAmount: dec(4990, 18), extraParams: { from: alice } })
    await bpdToken.transfer(erin, dec(1000, 18), { from: alice })
    await bpdToken.transfer(flyn, dec(1000, 18), { from: alice })
    await bpdToken.transfer(graham, dec(1000, 18), { from: alice })

    // B, C, D open vault
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(300, 16)), extraBPDAmount: dec(1590, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(600, 16)), extraBPDAmount: dec(1090, 18), extraParams: { from: carol } })
    const { collateral: D_coll } = await openVault({ ICR: toBN(dec(800, 16)), extraBPDAmount: dec(1090, 18), extraParams: { from: dennis } })

    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)

    const price = await priceFeed.getPrice()

    const _120_BPD = '120000000000000000000'
    const _373_BPD = '373000000000000000000'
    const _950_BPD = '950000000000000000000'

    // Check Bitcoin in activePool
    const activeRBTC_0 = await activePool.getRBTC()
    assert.equal(activeRBTC_0, totalColl.toString());

    let firstRedemptionHint
    let partialRedemptionHintNICR


    // Erin redeems 120 BPD
    ({
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(_120_BPD, price, 0))

    const { 0: upperPartialRedemptionHint_1, 1: lowerPartialRedemptionHint_1 } = await sortedVaults.findInsertPosition(
      partialRedemptionHintNICR,
      erin,
      erin
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    const redemption_1 = await vaultManager.redeemCollateral(
      _120_BPD,
      firstRedemptionHint,
      upperPartialRedemptionHint_1,
      lowerPartialRedemptionHint_1,
      partialRedemptionHintNICR,
      0, th._100pct,
      { from: erin })

    assert.isTrue(redemption_1.receipt.status);

    /* 120 BPD redeemed.  Expect $120 worth of RBTC removed. At RBTC:USD price of $200, 
    RBTC removed = (120/200) = 0.6 RBTC
    Total active RBTC = 280 - 0.6 = 279.4 RBTC */

    const activeRBTC_1 = await activePool.getRBTC()
    assert.equal(activeRBTC_1.toString(), activeRBTC_0.sub(toBN(_120_BPD).mul(mv._1e18BN).div(price)));

    // Flyn redeems 373 BPD
    ({
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(_373_BPD, price, 0))

    const { 0: upperPartialRedemptionHint_2, 1: lowerPartialRedemptionHint_2 } = await sortedVaults.findInsertPosition(
      partialRedemptionHintNICR,
      flyn,
      flyn
    )

    const redemption_2 = await vaultManager.redeemCollateral(
      _373_BPD,
      firstRedemptionHint,
      upperPartialRedemptionHint_2,
      lowerPartialRedemptionHint_2,
      partialRedemptionHintNICR,
      0, th._100pct,
      { from: flyn })

    assert.isTrue(redemption_2.receipt.status);

    /* 373 BPD redeemed.  Expect $373 worth of RBTC removed. At RBTC:USD price of $200, 
    RBTC removed = (373/200) = 1.865 RBTC
    Total active RBTC = 279.4 - 1.865 = 277.535 RBTC */
    const activeRBTC_2 = await activePool.getRBTC()
    assert.equal(activeRBTC_2.toString(), activeRBTC_1.sub(toBN(_373_BPD).mul(mv._1e18BN).div(price)));

    // Graham redeems 950 BPD
    ({
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(_950_BPD, price, 0))

    const { 0: upperPartialRedemptionHint_3, 1: lowerPartialRedemptionHint_3 } = await sortedVaults.findInsertPosition(
      partialRedemptionHintNICR,
      graham,
      graham
    )

    const redemption_3 = await vaultManager.redeemCollateral(
      _950_BPD,
      firstRedemptionHint,
      upperPartialRedemptionHint_3,
      lowerPartialRedemptionHint_3,
      partialRedemptionHintNICR,
      0, th._100pct,
      { from: graham })

    assert.isTrue(redemption_3.receipt.status);

    /* 950 BPD redeemed.  Expect $950 worth of RBTC removed. At RBTC:USD price of $200, 
    RBTC removed = (950/200) = 4.75 RBTC
    Total active RBTC = 277.535 - 4.75 = 272.785 RBTC */
    const activeRBTC_3 = (await activePool.getRBTC()).toString()
    assert.equal(activeRBTC_3.toString(), activeRBTC_2.sub(toBN(_950_BPD).mul(mv._1e18BN).div(price)));
  })

  // it doesn’t make much sense as there’s now min debt enforced and at least one vault must remain active
  // the only way to test it is before any vault is opened
  it("redeemCollateral(): reverts if there is zero outstanding system debt", async () => {
    // --- SETUP --- illegally mint BPD to Bob
    await bpdToken.unprotectedMint(bob, dec(100, 18))

    assert.equal((await bpdToken.balanceOf(bob)), dec(100, 18))

    const price = await priceFeed.getPrice()

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(dec(100, 18), price, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedVaults.findInsertPosition(
      partialRedemptionHintNICR,
      bob,
      bob
    )

    // Bob tries to redeem his illegally obtained BPD
    try {
      const redemptionTx = await vaultManager.redeemCollateral(
        dec(100, 18),
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }

    // assert.isFalse(redemptionTx.receipt.status);
  })

  it("redeemCollateral(): reverts if caller's tries to redeem more than the outstanding system debt", async () => {
    // --- SETUP --- illegally mint BPD to Bob
    await bpdToken.unprotectedMint(bob, '101000000000000000000')

    assert.equal((await bpdToken.balanceOf(bob)), '101000000000000000000')

    const { collateral: C_coll, totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(1000, 16)), extraBPDAmount: dec(40, 18), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openVault({ ICR: toBN(dec(1000, 16)), extraBPDAmount: dec(40, 18), extraParams: { from: dennis } })

    const totalDebt = C_totalDebt.add(D_totalDebt)
    th.assertIsApproximatelyEqual((await activePool.getBPDDebt()).toString(), totalDebt)

    const price = await priceFeed.getPrice()
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints('101000000000000000000', price, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedVaults.findInsertPosition(
      partialRedemptionHintNICR,
      bob,
      bob
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // Bob attempts to redeem his ill-gotten 101 BPD, from a system that has 100 BPD outstanding debt
    try {
      const redemptionTx = await vaultManager.redeemCollateral(
        totalDebt.add(toBN(dec(100, 18))),
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }
  })

  // Redemption fees 
  it("redeemCollateral(): a redemption made when base rate is zero increases the base rate", async () => {
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await vaultManager.baseRate(), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    const A_balanceBefore = await bpdToken.balanceOf(A)

    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))).toString())

    // Check baseRate is now non-zero
    assert.isTrue((await vaultManager.baseRate()).gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made when base rate is non-zero increases the base rate, for negligible time passed", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
    await mpStaking.stake(dec(1, 18), { from: multisig })

    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await vaultManager.baseRate(), '0')

    const A_balanceBefore = await bpdToken.balanceOf(A)
    const B_balanceBefore = await bpdToken.balanceOf(B)

    // A redeems 10 BPD
    const redemptionTx_A = await th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18))
    const timeStamp_A = await th.getTimestampFromTx(redemptionTx_A, web3)

    // Check A's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await vaultManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // B redeems 10 BPD
    const redemptionTx_B = await th.redeemCollateralAndGetTxObject(B, contracts, dec(10, 18))
    const timeStamp_B = await th.getTimestampFromTx(redemptionTx_B, web3)

    // Check B's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18))).toString())

    // Check negligible time difference (< 1 minute) between txs
    assert.isTrue(Number(timeStamp_B) - Number(timeStamp_A) < 60)

    const baseRate_2 = await vaultManager.baseRate()

    // Check baseRate has again increased
    assert.isTrue(baseRate_2.gt(baseRate_1))
  })

  it("redeemCollateral(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation [ @skip-on-coverage ]", async () => {
    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    const A_balanceBefore = await bpdToken.balanceOf(A)

    // A redeems 10 BPD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 BPD
    assert.equal(A_balanceBefore.sub(await bpdToken.balanceOf(A)), dec(10, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await vaultManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lastFeeOpTime_1 = await vaultManager.lastFeeOperationTime()

    // 45 seconds pass
    th.fastForwardTime(45, web3.currentProvider)

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18))

    const lastFeeOpTime_2 = await vaultManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower A's 2nd redemption occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 15 seconds passes
    th.fastForwardTime(15, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18))

    const lastFeeOpTime_3 = await vaultManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as A's 2rd redemption occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })

  it("redeemCollateral(): a redemption made at zero base rate send a non-zero RBTCFee to MP staking contract", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
    await mpStaking.stake(dec(1, 18), { from: multisig })

    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await vaultManager.baseRate(), '0')

    // Check MP Staking contract balance before is zero
    const mpStakingBalance_Before = await web3.eth.getBalance(mpStaking.address)
    assert.equal(mpStakingBalance_Before, '0')

    const A_balanceBefore = await bpdToken.balanceOf(A)

    // A redeems 10 BPD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await vaultManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check MP Staking contract balance after is non-zero
    const mpStakingBalance_After = toBN(await web3.eth.getBalance(mpStaking.address))
    assert.isTrue(mpStakingBalance_After.gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made at zero base increases the RBTC-fees-per-MP-staked in MP Staking contract", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
    await mpStaking.stake(dec(1, 18), { from: multisig })

    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await vaultManager.baseRate(), '0')

    // Check MP Staking RBTC-fees-per-MP-staked before is zero
    const F_RBTC_Before = await mpStaking.F_RBTC()
    assert.equal(F_RBTC_Before, '0')

    const A_balanceBefore = await bpdToken.balanceOf(A)

    // A redeems 10 BPD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await vaultManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check MP Staking RBTC-fees-per-MP-staked after is non-zero
    const F_RBTC_After = await mpStaking.F_RBTC()
    assert.isTrue(F_RBTC_After.gt('0'))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate send a non-zero RBTCFee to MP staking contract", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
    await mpStaking.stake(dec(1, 18), { from: multisig })

    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await vaultManager.baseRate(), '0')

    const A_balanceBefore = await bpdToken.balanceOf(A)
    const B_balanceBefore = await bpdToken.balanceOf(B)

    // A redeems 10 BPD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await vaultManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const mpStakingBalance_Before = toBN(await web3.eth.getBalance(mpStaking.address))

    // B redeems 10 BPD
    await th.redeemCollateral(B, contracts, dec(10, 18))

    // Check B's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18))).toString())

    const mpStakingBalance_After = toBN(await web3.eth.getBalance(mpStaking.address))

    // check MP Staking balance has increased
    assert.isTrue(mpStakingBalance_After.gt(mpStakingBalance_Before))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate increases RBTC-per-MP-staked in the staking contract", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
    await mpStaking.stake(dec(1, 18), { from: multisig })

    await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await vaultManager.baseRate(), '0')

    const A_balanceBefore = await bpdToken.balanceOf(A)
    const B_balanceBefore = await bpdToken.balanceOf(B)

    // A redeems 10 BPD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await vaultManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check MP Staking RBTC-fees-per-MP-staked before is zero
    const F_RBTC_Before = await mpStaking.F_RBTC()

    // B redeems 10 BPD
    await th.redeemCollateral(B, contracts, dec(10, 18))

    // Check B's balance has decreased by 10 BPD
    assert.equal(await bpdToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18))).toString())

    const F_RBTC_After = await mpStaking.F_RBTC()

    // check MP Staking balance has increased
    assert.isTrue(F_RBTC_After.gt(F_RBTC_Before))
  })

  it("redeemCollateral(): a redemption sends the RBTC remainder (RBTCDrawn - RBTCFee) to the redeemer", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
    await mpStaking.stake(dec(1, 18), { from: multisig })

    const { totalDebt: W_totalDebt } = await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    const { totalDebt: A_totalDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })
    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt)

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))

    // Confirm baseRate before redemption is 0
    const baseRate = await vaultManager.baseRate()
    assert.equal(baseRate, '0')

    // Check total BPD supply
    const activeBPD = await activePool.getBPDDebt()
    const defaultBPD = await defaultPool.getBPDDebt()

    const totalBPDSupply = activeBPD.add(defaultBPD)
    th.assertIsApproximatelyEqual(totalBPDSupply, totalDebt)

    // A redeems 9 BPD
    const redemptionAmount = toBN(dec(9, 18))
    await th.redeemCollateral(A, contracts, redemptionAmount)

    /*
    At RBTC:USD price of 200:
    RBTCDrawn = (9 / 200) = 0.045 RBTC
    RBTCfee = (0.005 + (1/2) *( 9/260)) * RBTCDrawn = 0.00100384615385 RBTC
    RBTCRemainder = 0.045 - 0.001003... = 0.0439961538462
    */

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))

    // check A's RBTC balance has increased by 0.045 RBTC 
    const price = await priceFeed.getPrice()
    const RBTCDrawn = redemptionAmount.mul(mv._1e18BN).div(price)
    th.assertIsApproximatelyEqual(
      A_balanceAfter.sub(A_balanceBefore),
      RBTCDrawn.sub(
        toBN(dec(5, 15)).add(redemptionAmount.mul(mv._1e18BN).div(totalDebt).div(toBN(2)))
          .mul(RBTCDrawn).div(mv._1e18BN)
      ),
      100000
    )
  })

  it("redeemCollateral(): a full redemption (leaving vault with 0 debt), closes the vault", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
    await mpStaking.stake(dec(1, 18), { from: multisig })

    const { netDebt: W_netDebt } = await openVault({ ICR: toBN(dec(20, 18)), extraBPDAmount: dec(10000, 18), extraParams: { from: whale } })

    const { netDebt: A_netDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt } = await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt } = await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })
    const { netDebt: D_netDebt } = await openVault({ ICR: toBN(dec(280, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: D } })
    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(toBN(dec(10, 18)))

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    // whale redeems 360 BPD.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, redemptionAmount)

    // Check A, B, C have been closed
    assert.isFalse(await sortedVaults.contains(A))
    assert.isFalse(await sortedVaults.contains(B))
    assert.isFalse(await sortedVaults.contains(C))

    // Check D remains active
    assert.isTrue(await sortedVaults.contains(D))
  })

  const redeemCollateral3Full1Partial = async () => {
    // time fast-forwards 1 year, and multisig stakes 1 MP
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await mpToken.approve(mpStaking.address, dec(1, 18), { from: multisig })
    await mpStaking.stake(dec(1, 18), { from: multisig })

    const { netDebt: W_netDebt } = await openVault({ ICR: toBN(dec(20, 18)), extraBPDAmount: dec(10000, 18), extraParams: { from: whale } })

    const { netDebt: A_netDebt, collateral: A_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt, collateral: B_coll } = await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt, collateral: C_coll } = await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })
    const { netDebt: D_netDebt } = await openVault({ ICR: toBN(dec(280, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: D } })
    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(toBN(dec(10, 18)))

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))
    const D_balanceBefore = toBN(await web3.eth.getBalance(D))

    const A_collBefore = await vaultManager.getVaultColl(A)
    const B_collBefore = await vaultManager.getVaultColl(B)
    const C_collBefore = await vaultManager.getVaultColl(C)
    const D_collBefore = await vaultManager.getVaultColl(D)

    // Confirm baseRate before redemption is 0
    const baseRate = await vaultManager.baseRate()
    assert.equal(baseRate, '0')

    // whale redeems BPD.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, redemptionAmount)

    // Check A, B, C have been closed
    assert.isFalse(await sortedVaults.contains(A))
    assert.isFalse(await sortedVaults.contains(B))
    assert.isFalse(await sortedVaults.contains(C))

    // Check D stays active
    assert.isTrue(await sortedVaults.contains(D))
    
    /*
    At RBTC:USD price of 200, with full redemptions from A, B, C:

    RBTCDrawn from A = 100/200 = 0.5 RBTC --> Surplus = (1-0.5) = 0.5
    RBTCDrawn from B = 120/200 = 0.6 RBTC --> Surplus = (1-0.6) = 0.4
    RBTCDrawn from C = 130/200 = 0.65 RBTC --> Surplus = (2-0.65) = 1.35
    */

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))
    const D_balanceAfter = toBN(await web3.eth.getBalance(D))

    // Check A, B, C’s vault collateral balance is zero (fully redeemed-from vaults)
    const A_collAfter = await vaultManager.getVaultColl(A)
    const B_collAfter = await vaultManager.getVaultColl(B)
    const C_collAfter = await vaultManager.getVaultColl(C)
    assert.isTrue(A_collAfter.eq(toBN(0)))
    assert.isTrue(B_collAfter.eq(toBN(0)))
    assert.isTrue(C_collAfter.eq(toBN(0)))

    // check D's vault collateral balances have decreased (the partially redeemed-from vault)
    const D_collAfter = await vaultManager.getVaultColl(D)
    assert.isTrue(D_collAfter.lt(D_collBefore))

    // Check A, B, C (fully redeemed-from vaults), and D's (the partially redeemed-from vault) balance has not changed
    assert.isTrue(A_balanceAfter.eq(A_balanceBefore))
    assert.isTrue(B_balanceAfter.eq(B_balanceBefore))
    assert.isTrue(C_balanceAfter.eq(C_balanceBefore))
    assert.isTrue(D_balanceAfter.eq(D_balanceBefore))

    // D is not closed, so cannot open vault
    await assertRevert(borrowerOperations.openVault(th._100pct, 0, ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(10, 18) }), 'BorrowerOps: Vault is active')

    return {
      A_netDebt, A_coll,
      B_netDebt, B_coll,
      C_netDebt, C_coll,
    }
  }

  it("redeemCollateral(): emits correct debt and coll values in each redeemed vault's VaultUpdated event", async () => {
    const { netDebt: W_netDebt } = await openVault({ ICR: toBN(dec(20, 18)), extraBPDAmount: dec(10000, 18), extraParams: { from: whale } })

    const { netDebt: A_netDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt } = await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt } = await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })
    const { totalDebt: D_totalDebt, collateral: D_coll } = await openVault({ ICR: toBN(dec(280, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: D } })
    const partialAmount = toBN(dec(15, 18))
    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(partialAmount)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // whale redeems BPD.  Expect this to fully redeem A, B, C, and partially redeem 15 BPD from D.
    const redemptionTx = await th.redeemCollateralAndGetTxObject(whale, contracts, redemptionAmount, th._100pct, { gasPrice: 0 })

    // Check A, B, C have been closed
    assert.isFalse(await sortedVaults.contains(A))
    assert.isFalse(await sortedVaults.contains(B))
    assert.isFalse(await sortedVaults.contains(C))

    // Check D stays active
    assert.isTrue(await sortedVaults.contains(D))

    const vaultUpdatedEvents = th.getAllEventsByName(redemptionTx, "VaultUpdated")

    // Get each vault's emitted debt and coll 
    const [A_emittedDebt, A_emittedColl] = th.getDebtAndCollFromVaultUpdatedEvents(vaultUpdatedEvents, A)
    const [B_emittedDebt, B_emittedColl] = th.getDebtAndCollFromVaultUpdatedEvents(vaultUpdatedEvents, B)
    const [C_emittedDebt, C_emittedColl] = th.getDebtAndCollFromVaultUpdatedEvents(vaultUpdatedEvents, C)
    const [D_emittedDebt, D_emittedColl] = th.getDebtAndCollFromVaultUpdatedEvents(vaultUpdatedEvents, D)

    // Expect A, B, C to have 0 emitted debt and coll, since they were closed
    assert.equal(A_emittedDebt, '0')
    assert.equal(A_emittedColl, '0')
    assert.equal(B_emittedDebt, '0')
    assert.equal(B_emittedColl, '0')
    assert.equal(C_emittedDebt, '0')
    assert.equal(C_emittedColl, '0')

    /* Expect D to have lost 15 debt and (at RBTC price of 200) 15/200 = 0.075 RBTC. 
    So, expect remaining debt = (85 - 15) = 70, and remaining RBTC = 1 - 15/200 = 0.925 remaining. */
    const price = await priceFeed.getPrice()
    th.assertIsApproximatelyEqual(D_emittedDebt, D_totalDebt.sub(partialAmount))
    th.assertIsApproximatelyEqual(D_emittedColl, D_coll.sub(partialAmount.mul(mv._1e18BN).div(price)))
  })

  it("redeemCollateral(): a redemption that closes a vault leaves the vault's RBTC surplus (collateral - RBTC drawn) available for the vault owner to claim", async () => {
    const {
      A_netDebt, A_coll,
      B_netDebt, B_coll,
      C_netDebt, C_coll,
    } = await redeemCollateral3Full1Partial()

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    // CollSurplusPool endpoint cannot be called directly
    await assertRevert(collSurplusPool.claimColl(A), 'CollSurplusPool: Caller is not Borrower Operations')

    await borrowerOperations.claimCollateral({ from: A, gasPrice: 0 })
    await borrowerOperations.claimCollateral({ from: B, gasPrice: 0 })
    await borrowerOperations.claimCollateral({ from: C, gasPrice: 0 })

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))

    const price = await priceFeed.getPrice()

    th.assertIsApproximatelyEqual(A_balanceAfter, A_balanceBefore.add(A_coll.sub(A_netDebt.mul(mv._1e18BN).div(price))))
    th.assertIsApproximatelyEqual(B_balanceAfter, B_balanceBefore.add(B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price))))
    th.assertIsApproximatelyEqual(C_balanceAfter, C_balanceBefore.add(C_coll.sub(C_netDebt.mul(mv._1e18BN).div(price))))
  })

  it("redeemCollateral(): a redemption that closes a vault leaves the vault's RBTC surplus (collateral - RBTC drawn) available for the vault owner after re-opening vault", async () => {
    const {
      A_netDebt, A_coll: A_collBefore,
      B_netDebt, B_coll: B_collBefore,
      C_netDebt, C_coll: C_collBefore,
    } = await redeemCollateral3Full1Partial()

    const price = await priceFeed.getPrice()
    const A_surplus = A_collBefore.sub(A_netDebt.mul(mv._1e18BN).div(price))
    const B_surplus = B_collBefore.sub(B_netDebt.mul(mv._1e18BN).div(price))
    const C_surplus = C_collBefore.sub(C_netDebt.mul(mv._1e18BN).div(price))

    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(200, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: A } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(190, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: B } })
    const { collateral: C_coll } = await openVault({ ICR: toBN(dec(180, 16)), extraBPDAmount: dec(100, 18), extraParams: { from: C } })

    const A_collAfter = await vaultManager.getVaultColl(A)
    const B_collAfter = await vaultManager.getVaultColl(B)
    const C_collAfter = await vaultManager.getVaultColl(C)

    assert.isTrue(A_collAfter.eq(A_coll))
    assert.isTrue(B_collAfter.eq(B_coll))
    assert.isTrue(C_collAfter.eq(C_coll))

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    await borrowerOperations.claimCollateral({ from: A, gasPrice: 0 })
    await borrowerOperations.claimCollateral({ from: B, gasPrice: 0 })
    await borrowerOperations.claimCollateral({ from: C, gasPrice: 0 })

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))

    th.assertIsApproximatelyEqual(A_balanceAfter, A_balanceBefore.add(A_surplus))
    th.assertIsApproximatelyEqual(B_balanceAfter, B_balanceBefore.add(B_surplus))
    th.assertIsApproximatelyEqual(C_balanceAfter, C_balanceBefore.add(C_surplus))
  })

  it("getPendingBPDDebtReward(): Returns 0 if there is no pending BPDDebt reward", async () => {
    // Make some vaults
    const { totalDebt } = await openVault({ ICR: toBN(dec(2, 18)), extraBPDAmount: dec(100, 18), extraParams: { from: defaulter_1 } })

    await openVault({ ICR: toBN(dec(3, 18)), extraBPDAmount: dec(20, 18), extraParams: { from: carol } })

    await openVault({ ICR: toBN(dec(20, 18)), extraBPDAmount: totalDebt, extraParams: { from: whale } })
    await stabilityPool.provideToSP(totalDebt, ZERO_ADDRESS, { from: whale })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedVaults.contains(defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_B_BPDDebt = await vaultManager.B_BPDDebt()
    assert.equal(current_B_BPDDebt, 0)

    const carolSnapshot_B_BPDDebt = (await vaultManager.rewardSnapshots(carol))[1]
    assert.equal(carolSnapshot_B_BPDDebt, 0)

    const carol_PendingBPDDebtReward = await vaultManager.getPendingBPDDebtReward(carol)
    assert.equal(carol_PendingBPDDebtReward, 0)
  })

  it("getPendingRBTCReward(): Returns 0 if there is no pending RBTC reward", async () => {
    // make some vaults
    const { totalDebt } = await openVault({ ICR: toBN(dec(2, 18)), extraBPDAmount: dec(100, 18), extraParams: { from: defaulter_1 } })

    await openVault({ ICR: toBN(dec(3, 18)), extraBPDAmount: dec(20, 18), extraParams: { from: carol } })

    await openVault({ ICR: toBN(dec(20, 18)), extraBPDAmount: totalDebt, extraParams: { from: whale } })
    await stabilityPool.provideToSP(totalDebt, ZERO_ADDRESS, { from: whale })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await vaultManager.liquidate(defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedVaults.contains(defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_B_RBTC = await vaultManager.B_RBTC()
    assert.equal(current_B_RBTC, 0)

    const carolSnapshot_B_RBTC = (await vaultManager.rewardSnapshots(carol))[0]
    assert.equal(carolSnapshot_B_RBTC, 0)

    const carol_PendingRBTCReward = await vaultManager.getPendingRBTCReward(carol)
    assert.equal(carol_PendingRBTCReward, 0)
  })

  // --- computeICR ---

  it("computeICR(): Returns 0 if vault's coll is worth 0", async () => {
    const price = 0
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)

    const ICR = (await vaultManager.computeICR(coll, debt, price)).toString()

    assert.equal(ICR, 0)
  })

  it("computeICR(): Returns 2^256-1 for RBTC:USD = 100, coll = 1 RBTC, debt = 100 BPD", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)

    const ICR = (await vaultManager.computeICR(coll, debt, price)).toString()

    assert.equal(ICR, dec(1, 18))
  })

  it("computeICR(): returns correct ICR for RBTC:USD = 100, coll = 200 RBTC, debt = 30 BPD", async () => {
    const price = dec(100, 18)
    const coll = dec(200, 'ether')
    const debt = dec(30, 18)

    const ICR = (await vaultManager.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '666666666666666666666'), 1000)
  })

  it("computeICR(): returns correct ICR for RBTC:USD = 250, coll = 1350 RBTC, debt = 127 BPD", async () => {
    const price = '250000000000000000000'
    const coll = '1350000000000000000000'
    const debt = '127000000000000000000'

    const ICR = (await vaultManager.computeICR(coll, debt, price))

    assert.isAtMost(th.getDifference(ICR, '2657480314960630000000'), 1000000)
  })

  it("computeICR(): returns correct ICR for RBTC:USD = 100, coll = 1 RBTC, debt = 54321 BPD", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = '54321000000000000000000'

    const ICR = (await vaultManager.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '1840908672520756'), 1000)
  })


  it("computeICR(): Returns 2^256-1 if vault has non-zero coll and zero debt", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = 0

    const ICR = web3.utils.toHex(await vaultManager.computeICR(coll, debt, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(ICR, maxBytes32)
  })

  // --- checkRecoveryMode ---

  //TCR < 150%
  it("checkRecoveryMode(): Returns true when TCR < 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice('99999999999999999999')

    const TCR = (await th.getTCR(contracts))

    assert.isTrue(TCR.lte(toBN('1500000000000000000')))

    assert.isTrue(await th.checkRecoveryMode(contracts))
  })

  // TCR == 150%
  it("checkRecoveryMode(): Returns false when TCR == 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const TCR = (await th.getTCR(contracts))

    assert.equal(TCR, '1500000000000000000')

    assert.isFalse(await th.checkRecoveryMode(contracts))
  })

  // > 150%
  it("checkRecoveryMode(): Returns false when TCR > 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice('100000000000000000001')

    const TCR = (await th.getTCR(contracts))

    assert.isTrue(TCR.gte(toBN('1500000000000000000')))

    assert.isFalse(await th.checkRecoveryMode(contracts))
  })

  // check 0
  it("checkRecoveryMode(): Returns false when TCR == 0", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice(0)

    const TCR = (await th.getTCR(contracts)).toString()

    assert.equal(TCR, 0)

    assert.isTrue(await th.checkRecoveryMode(contracts))
  })

  // --- Getters ---

  it("getVaultStake(): Returns stake", async () => {
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const A_Stake = await vaultManager.getVaultStake(A)
    const B_Stake = await vaultManager.getVaultStake(B)

    assert.equal(A_Stake, A_coll.toString())
    assert.equal(B_Stake, B_coll.toString())
  })

  it("getVaultColl(): Returns coll", async () => {
    const { collateral: A_coll } = await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { collateral: B_coll } = await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    assert.equal(await vaultManager.getVaultColl(A), A_coll.toString())
    assert.equal(await vaultManager.getVaultColl(B), B_coll.toString())
  })

  it("getVaultDebt(): Returns debt", async () => {
    const { totalDebt: totalDebtA } = await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { totalDebt: totalDebtB } = await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const A_Debt = await vaultManager.getVaultDebt(A)
    const B_Debt = await vaultManager.getVaultDebt(B)

    // Expect debt = requested + 0.5% fee + 50 (due to gas comp)

    assert.equal(A_Debt, totalDebtA.toString())
    assert.equal(B_Debt, totalDebtB.toString())
  })

  it("getVaultStatus(): Returns status", async () => {
    const { totalDebt: B_totalDebt } = await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })
    await openVault({ ICR: toBN(dec(150, 16)), extraBPDAmount: B_totalDebt, extraParams: { from: A } })

    // to be able to repay:
    await bpdToken.transfer(B, B_totalDebt, { from: A })
    await borrowerOperations.closeVault({from: B})

    const A_Status = await vaultManager.getVaultStatus(A)
    const B_Status = await vaultManager.getVaultStatus(B)
    const C_Status = await vaultManager.getVaultStatus(C)

    assert.equal(A_Status, '1')  // active
    assert.equal(B_Status, '2')  // closed by user
    assert.equal(C_Status, '0')  // non-existent
  })
})

contract('Reset chain state', async accounts => { })
