
const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployMoneyp = deploymentHelpers.deployMoneyp
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th  = testHelpers.TestHelper
const dec = th.dec

contract('Pool Manager: Sum-Product rounding errors', async accounts => {

  const whale = accounts[0]

  let contracts

  let priceFeed
  let bpdToken
  let stabilityPool
  let vaultManager
  let borrowerOperations

  beforeEach(async () => {
    contracts = await deployMoneyp()
    
    priceFeed = contracts.priceFeedTestnet
    bpdToken = contracts.bpdToken
    stabilityPool = contracts.stabilityPool
    vaultManager = contracts.vaultManager
    borrowerOperations = contracts.borrowerOperations

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  // skipped to not slow down CI
  it.skip("Rounding errors: 100 deposits of 100BPD into SP, then 200 liquidations of 49BPD", async () => {
    const owner = accounts[0]
    const depositors = accounts.slice(1, 101)
    const defaulters = accounts.slice(101, 301)

    for (let account of depositors) {
      await openVault({ extraBPDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
      await stabilityPool.provideToSP(dec(100, 18), { from: account })
    }

    // Defaulter opens vault with 200% ICR
    for (let defaulter of defaulters) {
      await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter } })
      }
    const price = await priceFeed.getPrice()

    // price drops by 50%: defaulter ICR falls to 100%
    await priceFeed.setPrice(dec(105, 18));

    // Defaulters liquidated
    for (let defaulter of defaulters) {
      await vaultManager.liquidate(defaulter, { from: owner });
    }

    const SP_TotalDeposits = await stabilityPool.getTotalBPDDeposits()
    const SP_RBTC = await stabilityPool.getRBTC()
    const compoundedDeposit = await stabilityPool.getCompoundedBPDDeposit(depositors[0])
    const RBTC_Gain = await stabilityPool.getCurrentRBTCGain(depositors[0])

    // Check depostiors receive their share without too much error
    assert.isAtMost(th.getDifference(SP_TotalDeposits.div(th.toBN(depositors.length)), compoundedDeposit), 100000)
    assert.isAtMost(th.getDifference(SP_RBTC.div(th.toBN(depositors.length)), RBTC_Gain), 100000)
  })
})

contract('Reset chain state', async accounts => { })
