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

  const ZERO_ADDRESS = th.ZERO_ADDRESS
  const [owner, A, B, C, D, E, F] = accounts.slice(0, 7);

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

  const getOpenVaultBPDAmount = async (totalDebt) => th.getOpenVaultBPDAmount(contracts, totalDebt)
 
  const getSnapshotsRatio = async () => {
    const ratio = (await vaultManager.totalStakesSnapshot())
      .mul(toBN(dec(1, 18)))
      .div((await vaultManager.totalCollateralSnapshot()))

    return ratio
  }

  beforeEach(async () => {
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

  it("A given vault's stake decline is negligible with adjustments and tiny liquidations", async () => {
    await priceFeed.setPrice(dec(100, 18))
  
    // Make 1 mega vaults A at ~50% total collateral
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(1, 31)), ZERO_ADDRESS, ZERO_ADDRESS, { from: A, value: dec(2, 29) })
    
    // Make 5 large vaults B, C, D, E, F at ~10% total collateral
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(2, 30)), ZERO_ADDRESS, ZERO_ADDRESS, { from: B, value: dec(4, 28) })
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(2, 30)), ZERO_ADDRESS, ZERO_ADDRESS, { from: C, value: dec(4, 28) })
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(2, 30)), ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(4, 28) })
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(2, 30)), ZERO_ADDRESS, ZERO_ADDRESS, { from: E, value: dec(4, 28) })
    await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(2, 30)), ZERO_ADDRESS, ZERO_ADDRESS, { from: F, value: dec(4, 28) })
  
    // Make 10 tiny vaults at relatively negligible collateral (~1e-9 of total)
    const tinyVaults = accounts.slice(10, 20)
    for (account of tinyVaults) {
      await borrowerOperations.openVault(th._100pct, await getOpenVaultBPDAmount(dec(1, 22)), ZERO_ADDRESS, ZERO_ADDRESS, { from: account, value: dec(2, 20) })
    }

    // liquidate 1 vault at ~50% total system collateral
    await priceFeed.setPrice(dec(50, 18))
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))
    await vaultManager.liquidate(A)

    console.log(`totalStakesSnapshot after L1: ${await vaultManager.totalStakesSnapshot()}`)
    console.log(`totalCollateralSnapshot after L1: ${await vaultManager.totalCollateralSnapshot()}`)
    console.log(`Snapshots ratio after L1: ${await getSnapshotsRatio()}`)
    console.log(`B pending RBTC reward after L1: ${await vaultManager.getPendingRBTCReward(B)}`)
    console.log(`B stake after L1: ${(await vaultManager.Vaults(B))[2]}`)

    // adjust vault B 1 wei: apply rewards
    await borrowerOperations.adjustVault(th._100pct, 0, 1, false, ZERO_ADDRESS, ZERO_ADDRESS, {from: B})  // B repays 1 wei
    console.log(`B stake after A1: ${(await vaultManager.Vaults(B))[2]}`)
    console.log(`Snapshots ratio after A1: ${await getSnapshotsRatio()}`)

    // Loop over tiny vaults, and alternately:
    // - Liquidate a tiny vault
    // - Adjust B's collateral by 1 wei
    for (let [idx, vault] of tinyVaults.entries()) {
      await vaultManager.liquidate(vault)
      console.log(`B stake after L${idx + 2}: ${(await vaultManager.Vaults(B))[2]}`)
      console.log(`Snapshots ratio after L${idx + 2}: ${await getSnapshotsRatio()}`)
      await borrowerOperations.adjustVault(th._100pct, 0, 1, false, ZERO_ADDRESS, ZERO_ADDRESS, {from: B})  // A repays 1 wei
      console.log(`B stake after A${idx + 2}: ${(await vaultManager.Vaults(B))[2]}`)
    }
  })

  // TODO: stake decline for adjustments with sizable liquidations, for comparison
})