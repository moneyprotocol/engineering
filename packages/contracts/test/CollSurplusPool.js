const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const VaultManagerTester = artifacts.require("VaultManagerTester")
const BPDToken = artifacts.require("BPDToken")

contract('CollSurplusPool', async accounts => {
  const [
    owner,
    A, B, C, D, E] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let borrowerOperations
  let priceFeed
  let collSurplusPool

  let contracts

  const getOpenVaultBPDAmount = async (totalDebt) => th.getOpenVaultBPDAmount(contracts, totalDebt)
  const openVault = async (params) => th.openVault(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployMoneypCore()
    contracts.vaultManager = await VaultManagerTester.new()
    contracts.bpdToken = await BPDToken.new(
      contracts.vaultManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeed = contracts.priceFeedTestnet
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations

    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)
  })

  it("CollSurplusPool::getRBTC(): Returns the RBTC balance of the CollSurplusPool after redemption", async () => {
    const RBTC_1 = await collSurplusPool.getRBTC()
    assert.equal(RBTC_1, '0')

    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    const { collateral: B_coll, netDebt: B_netDebt } = await openVault({ ICR: toBN(dec(200, 16)), extraParams: { from: B } })
    await openVault({ extraBPDAmount: B_netDebt, extraParams: { from: A, value: dec(3000, 'ether') } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // At RBTC:USD = 100, this redemption should leave 1 ether of coll surplus
    await th.redeemCollateralAndGetTxObject(A, contracts, B_netDebt)

    const RBTC_2 = await collSurplusPool.getRBTC()
    th.assertIsApproximatelyEqual(RBTC_2, B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price)))
  })

  it("CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations", async () => {
    await th.assertRevert(collSurplusPool.claimColl(A, { from: A }), 'CollSurplusPool: Caller is not Borrower Operations')
  })

  it("CollSurplusPool: claimColl(): Reverts if nothing to claim", async () => {
    await th.assertRevert(borrowerOperations.claimCollateral({ from: A }), 'CollSurplusPool: No collateral available to claim')
  })

  it("CollSurplusPool: claimColl(): Reverts if owner cannot receive RBTC surplus", async () => {
    const nonPayable = await NonPayable.new()

    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    // open vault from NonPayable proxy contract
    const B_coll = toBN(dec(60, 18))
    const B_bpdAmount = toBN(dec(3000, 18))
    const B_netDebt = await th.getAmountWithBorrowingFee(contracts, B_bpdAmount)
    const openVaultData = th.getTransactionData('openVault(uint256,uint256,address,address)', ['0xde0b6b3a7640000', web3.utils.toHex(B_bpdAmount), B, B])
    await nonPayable.forward(borrowerOperations.address, openVaultData, { value: B_coll })
    await openVault({ extraBPDAmount: B_netDebt, extraParams: { from: A, value: dec(3000, 'ether') } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 4.43, web3.currentProvider)

    // At RBTC:USD = 100, this redemption should leave 1 ether of coll surplus for B
    await th.redeemCollateralAndGetTxObject(A, contracts, B_netDebt)

    const RBTC_2 = await collSurplusPool.getRBTC()
    th.assertIsApproximatelyEqual(RBTC_2, B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price)))

    const claimCollateralData = th.getTransactionData('claimCollateral()', [])
    await th.assertRevert(nonPayable.forward(borrowerOperations.address, claimCollateralData), 'CollSurplusPool: sending RBTC failed')
  })

  it('CollSurplusPool: reverts trying to send RBTC to it', async () => {
    await th.assertRevert(web3.eth.sendTransaction({ from: A, to: collSurplusPool.address, value: 1 }), 'CollSurplusPool: Caller is not Active Pool')
  })

  it('CollSurplusPool: accountSurplus: reverts if caller is not Vault Manager', async () => {
    await th.assertRevert(collSurplusPool.accountSurplus(A, 1), 'CollSurplusPool: Caller is not VaultManager')
  })
})

contract('Reset chain state', async accounts => { })
