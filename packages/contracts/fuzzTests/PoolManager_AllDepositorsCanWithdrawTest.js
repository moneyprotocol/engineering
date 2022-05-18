const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

const ZERO_ADDRESS = th.ZERO_ADDRESS

const ZERO = toBN('0')

/*
* Naive fuzz test that checks whether all SP depositors can successfully withdraw from the SP, after a random sequence
* of deposits and liquidations.
*
* The test cases tackle different size ranges for liquidated collateral and SP deposits.
*/

contract("PoolManager - random liquidations/deposits, then check all depositors can withdraw", async accounts => {

  const whale = accounts[accounts.length - 1]
  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  let priceFeed
  let bpdToken
  let vaultManager
  let stabilityPool
  let sortedVaults
  let borrowerOperations

  const skyrocketPriceAndCheckAllVaultsSafe = async () => {
        // price skyrockets, therefore no undercollateralized troes
        await priceFeed.setPrice(dec(1000, 18));
        const lowestICR = await vaultManager.getCurrentICR(await sortedVaults.getLast(), dec(1000, 18))
        assert.isTrue(lowestICR.gt(toBN(dec(110, 16))))
  }

  const performLiquidation = async (remainingDefaulters, liquidatedAccountsDict) => {
    if (remainingDefaulters.length === 0) { return }

    const randomDefaulterIndex = Math.floor(Math.random() * (remainingDefaulters.length))
    const randomDefaulter = remainingDefaulters[randomDefaulterIndex]

    const liquidatedBPD = (await vaultManager.Vaults(randomDefaulter))[0]
    const liquidatedETH = (await vaultManager.Vaults(randomDefaulter))[1]

    const price = await priceFeed.getPrice()
    const ICR = (await vaultManager.getCurrentICR(randomDefaulter, price)).toString()
    const ICRPercent = ICR.slice(0, ICR.length - 16)

    console.log(`SP address: ${stabilityPool.address}`)
    const BPDinPoolBefore = await stabilityPool.getTotalBPDDeposits()
    const liquidatedTx = await vaultManager.liquidate(randomDefaulter, { from: accounts[0] })
    const BPDinPoolAfter = await stabilityPool.getTotalBPDDeposits()

    assert.isTrue(liquidatedTx.receipt.status)

    if (liquidatedTx.receipt.status) {
      liquidatedAccountsDict[randomDefaulter] = true
      remainingDefaulters.splice(randomDefaulterIndex, 1)
    }
    if (await vaultManager.checkRecoveryMode(price)) { console.log("recovery mode: TRUE") }

    console.log(`Liquidation. addr: ${th.squeezeAddr(randomDefaulter)} ICR: ${ICRPercent}% coll: ${liquidatedETH} debt: ${liquidatedBPD} SP BPD before: ${BPDinPoolBefore} SP BPD after: ${BPDinPoolAfter} tx success: ${liquidatedTx.receipt.status}`)
  }

  const performSPDeposit = async (depositorAccounts, currentDepositors, currentDepositorsDict) => {
    const randomIndex = Math.floor(Math.random() * (depositorAccounts.length))
    const randomDepositor = depositorAccounts[randomIndex]

    const userBalance = (await bpdToken.balanceOf(randomDepositor))
    const maxBPDDeposit = userBalance.div(toBN(dec(1, 18)))

    const randomBPDAmount = th.randAmountInWei(1, maxBPDDeposit)

    const depositTx = await stabilityPool.provideToSP(randomBPDAmount, ZERO_ADDRESS, { from: randomDepositor })

    assert.isTrue(depositTx.receipt.status)

    if (depositTx.receipt.status && !currentDepositorsDict[randomDepositor]) {
      currentDepositorsDict[randomDepositor] = true
      currentDepositors.push(randomDepositor)
    }

    console.log(`SP deposit. addr: ${th.squeezeAddr(randomDepositor)} amount: ${randomBPDAmount} tx success: ${depositTx.receipt.status} `)
  }

  const randomOperation = async (depositorAccounts,
    remainingDefaulters,
    currentDepositors,
    liquidatedAccountsDict,
    currentDepositorsDict,
  ) => {
    const randomSelection = Math.floor(Math.random() * 2)

    if (randomSelection === 0) {
      await performLiquidation(remainingDefaulters, liquidatedAccountsDict)

    } else if (randomSelection === 1) {
      await performSPDeposit(depositorAccounts, currentDepositors, currentDepositorsDict)
    }
  }

  const systemContainsVaultUnder110 = async (price) => {
    const lowestICR = await vaultManager.getCurrentICR(await sortedVaults.getLast(), price)
    console.log(`lowestICR: ${lowestICR}, lowestICR.lt(dec(110, 16)): ${lowestICR.lt(toBN(dec(110, 16)))}`)
    return lowestICR.lt(dec(110, 16))
  }

  const systemContainsVaultUnder100 = async (price) => {
    const lowestICR = await vaultManager.getCurrentICR(await sortedVaults.getLast(), price)
    console.log(`lowestICR: ${lowestICR}, lowestICR.lt(dec(100, 16)): ${lowestICR.lt(toBN(dec(100, 16)))}`)
    return lowestICR.lt(dec(100, 16))
  }

  const getTotalDebtFromUndercollateralizedVaults = async (n, price) => {
    let totalDebt = ZERO
    let vault = await sortedVaults.getLast()

    for (let i = 0; i < n; i++) {
      const ICR = await vaultManager.getCurrentICR(vault, price)
      const debt = ICR.lt(toBN(dec(110, 16))) ? (await vaultManager.getEntireDebtAndColl(vault))[0] : ZERO

      totalDebt = totalDebt.add(debt)
      vault = await sortedVaults.getPrev(vault)
    }

    return totalDebt
  }

  const clearAllUndercollateralizedVaults = async (price) => {
    /* Somewhat arbitrary way to clear under-collateralized vaults: 
    *
    * - If system is in Recovery Mode and contains vaults with ICR < 100, whale draws the lowest vault's debt amount 
    * and sends to lowest vault owner, who then closes their vault.
    *
    * - If system contains vaults with ICR < 110, whale simply draws and makes an SP deposit 
    * equal to the debt of the last 50 vaults, before a liquidateVaults tx hits the last 50 vaults.
    *
    * The intent is to avoid the system entering an endless loop where the SP is empty and debt is being forever liquidated/recycled 
    * between active vaults, and the existence of some under-collateralized vaults blocks all SP depositors from withdrawing.
    * 
    * Since the purpose of the fuzz test is to see if SP depositors can indeed withdraw *when they should be able to*,
    * we first need to put the system in a state with no under-collateralized vaults (which are supposed to block SP withdrawals).
    */
    while(await systemContainsVaultUnder100(price) && await vaultManager.checkRecoveryMode()) {
      const lowestVault = await sortedVaults.getLast()
      const lastVaultDebt = (await vaultManager.getEntireDebtAndColl(vault))[0]
      await borrowerOperations.adjustVault(0, 0 , lastVaultDebt, true, whale, {from: whale})
      await bpdToken.transfer(lowestVault, lowestVaultDebt, {from: whale})
      await borrowerOperations.closeVault({from: lowestVault})
    }

    while (await systemContainsVaultUnder110(price)) {
      const debtLowest50Vaults = await getTotalDebtFromUndercollateralizedVaults(50, price)
      
      if (debtLowest50Vaults.gt(ZERO)) {
        await borrowerOperations.adjustVault(0, 0 , debtLowest50Vaults, true, whale, {from: whale})
        await stabilityPool.provideToSP(debtLowest50Vaults, {from: whale})
      }
      
      await vaultManager.liquidateVaults(50)
    }
  }

  const attemptWithdrawAllDeposits = async (currentDepositors) => {
    // First, liquidate all remaining undercollateralized vaults, so that SP depositors may withdraw

    console.log("\n")
    console.log("--- Attempt to withdraw all deposits ---")
    console.log(`Depositors count: ${currentDepositors.length}`)

    for (depositor of currentDepositors) {
      const initialDeposit = (await stabilityPool.deposits(depositor))[0]
      const finalDeposit = await stabilityPool.getCompoundedBPDDeposit(depositor)
      const ETHGain = await stabilityPool.getDepositorETHGain(depositor)
      const ETHinSP = (await stabilityPool.getETH()).toString()
      const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()

      // Attempt to withdraw
      const withdrawalTx = await stabilityPool.withdrawFromSP(dec(1, 36), { from: depositor })

      const ETHinSPAfter = (await stabilityPool.getETH()).toString()
      const BPDinSPAfter = (await stabilityPool.getTotalBPDDeposits()).toString()
      const BPDBalanceSPAfter = (await bpdToken.balanceOf(stabilityPool.address))
      const depositAfter = await stabilityPool.getCompoundedBPDDeposit(depositor)

      console.log(`--Before withdrawal--
                    withdrawer addr: ${th.squeezeAddr(depositor)}
                     initial deposit: ${initialDeposit}
                     RBTC gain: ${ETHGain}
                     RBTC in SP: ${ETHinSP}
                     compounded deposit: ${finalDeposit} 
                     BPD in SP: ${BPDinSP}
                    
                    --After withdrawal--
                     Withdrawal tx success: ${withdrawalTx.receipt.status} 
                     Deposit after: ${depositAfter}
                     RBTC remaining in SP: ${ETHinSPAfter}
                     SP BPD deposits tracker after: ${BPDinSPAfter}
                     SP BPD balance after: ${BPDBalanceSPAfter}
                     `)
      // Check each deposit can be withdrawn
      assert.isTrue(withdrawalTx.receipt.status)
      assert.equal(depositAfter, '0')
    }
  }

  describe("Stability Pool Withdrawals", async () => {

    before(async () => {
      console.log(`Number of accounts: ${accounts.length}`)
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress)

      stabilityPool = contracts.stabilityPool
      priceFeed = contracts.priceFeedTestnet
      bpdToken = contracts.bpdToken
      stabilityPool = contracts.stabilityPool
      vaultManager = contracts.vaultManager
      borrowerOperations = contracts.borrowerOperations
      sortedVaults = contracts.sortedVaults

      await deploymentHelper.connectMPContracts(MPContracts)
      await deploymentHelper.connectCoreContracts(contracts, MPContracts)
      await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)
    })

    // mixed deposits/liquidations

    // ranges: low-low, low-high, high-low, high-high, full-full

    // full offsets, partial offsets
    // ensure full offset with whale2 in S
    // ensure partial offset with whale 3 in L

    it("Defaulters' Collateral in range [1, 1e8]. SP Deposits in range [100, 1e10]. RBTC:USD = 100", async () => {
      // whale adds coll that holds TCR > 150%
      await borrowerOperations.openVault(0, 0, whale, whale, { from: whale, value: dec(5, 29) })

      const numberOfOps = 5
      const defaulterAccounts = accounts.slice(1, numberOfOps)
      const depositorAccounts = accounts.slice(numberOfOps + 1, numberOfOps * 2)

      const defaulterCollMin = 1
      const defaulterCollMax = 100000000
      const defaulterBPDProportionMin = 91
      const defaulterBPDProportionMax = 180

      const depositorCollMin = 1
      const depositorCollMax = 100000000
      const depositorBPDProportionMin = 100
      const depositorBPDProportionMax = 100

      const remainingDefaulters = [...defaulterAccounts]
      const currentDepositors = []
      const liquidatedAccountsDict = {}
      const currentDepositorsDict = {}

      // setup:
      // account set L all add coll and withdraw BPD
      await th.openVault_allAccounts_randomRBTC_randomBPD(defaulterCollMin,
        defaulterCollMax,
        defaulterAccounts,
        contracts,
        defaulterBPDProportionMin,
        defaulterBPDProportionMax,
        true)

      // account set S all add coll and withdraw BPD
      await th.openVault_allAccounts_randomRBTC_randomBPD(depositorCollMin,
        depositorCollMax,
        depositorAccounts,
        contracts,
        depositorBPDProportionMin,
        depositorBPDProportionMax,
        true)

      // price drops, all L liquidateable
      await priceFeed.setPrice(dec(1, 18));

      // Random sequence of operations: liquidations and SP deposits
      for (i = 0; i < numberOfOps; i++) {
        await randomOperation(depositorAccounts,
          remainingDefaulters,
          currentDepositors,
          liquidatedAccountsDict,
          currentDepositorsDict)
      }

      await skyrocketPriceAndCheckAllVaultsSafe()

      const totalBPDDepositsBeforeWithdrawals = await stabilityPool.getTotalBPDDeposits()
      const totalETHRewardsBeforeWithdrawals = await stabilityPool.getETH()

      await attemptWithdrawAllDeposits(currentDepositors)

      const totalBPDDepositsAfterWithdrawals = await stabilityPool.getTotalBPDDeposits()
      const totalETHRewardsAfterWithdrawals = await stabilityPool.getETH()

      console.log(`Total BPD deposits before any withdrawals: ${totalBPDDepositsBeforeWithdrawals}`)
      console.log(`Total RBTC rewards before any withdrawals: ${totalETHRewardsBeforeWithdrawals}`)

      console.log(`Remaining BPD deposits after withdrawals: ${totalBPDDepositsAfterWithdrawals}`)
      console.log(`Remaining RBTC rewards after withdrawals: ${totalETHRewardsAfterWithdrawals}`)

      console.log(`current depositors length: ${currentDepositors.length}`)
      console.log(`remaining defaulters length: ${remainingDefaulters.length}`)
    })

    it("Defaulters' Collateral in range [1, 10]. SP Deposits in range [1e8, 1e10]. RBTC:USD = 100", async () => {
      // whale adds coll that holds TCR > 150%
      await borrowerOperations.openVault(0, 0, whale, whale, { from: whale, value: dec(5, 29) })

      const numberOfOps = 5
      const defaulterAccounts = accounts.slice(1, numberOfOps)
      const depositorAccounts = accounts.slice(numberOfOps + 1, numberOfOps * 2)

      const defaulterCollMin = 1
      const defaulterCollMax = 10
      const defaulterBPDProportionMin = 91
      const defaulterBPDProportionMax = 180

      const depositorCollMin = 1000000
      const depositorCollMax = 100000000
      const depositorBPDProportionMin = 100
      const depositorBPDProportionMax = 100

      const remainingDefaulters = [...defaulterAccounts]
      const currentDepositors = []
      const liquidatedAccountsDict = {}
      const currentDepositorsDict = {}

      // setup:
      // account set L all add coll and withdraw BPD
      await th.openVault_allAccounts_randomRBTC_randomBPD(defaulterCollMin,
        defaulterCollMax,
        defaulterAccounts,
        contracts,
        defaulterBPDProportionMin,
        defaulterBPDProportionMax)

      // account set S all add coll and withdraw BPD
      await th.openVault_allAccounts_randomRBTC_randomBPD(depositorCollMin,
        depositorCollMax,
        depositorAccounts,
        contracts,
        depositorBPDProportionMin,
        depositorBPDProportionMax)

      // price drops, all L liquidateable
      await priceFeed.setPrice(dec(100, 18));

      // Random sequence of operations: liquidations and SP deposits
      for (i = 0; i < numberOfOps; i++) {
        await randomOperation(depositorAccounts,
          remainingDefaulters,
          currentDepositors,
          liquidatedAccountsDict,
          currentDepositorsDict)
      }

      await skyrocketPriceAndCheckAllVaultsSafe()

      const totalBPDDepositsBeforeWithdrawals = await stabilityPool.getTotalBPDDeposits()
      const totalETHRewardsBeforeWithdrawals = await stabilityPool.getETH()

      await attemptWithdrawAllDeposits(currentDepositors)

      const totalBPDDepositsAfterWithdrawals = await stabilityPool.getTotalBPDDeposits()
      const totalETHRewardsAfterWithdrawals = await stabilityPool.getETH()

      console.log(`Total BPD deposits before any withdrawals: ${totalBPDDepositsBeforeWithdrawals}`)
      console.log(`Total RBTC rewards before any withdrawals: ${totalETHRewardsBeforeWithdrawals}`)

      console.log(`Remaining BPD deposits after withdrawals: ${totalBPDDepositsAfterWithdrawals}`)
      console.log(`Remaining RBTC rewards after withdrawals: ${totalETHRewardsAfterWithdrawals}`)

      console.log(`current depositors length: ${currentDepositors.length}`)
      console.log(`remaining defaulters length: ${remainingDefaulters.length}`)
    })

    it("Defaulters' Collateral in range [1e6, 1e8]. SP Deposits in range [100, 1000]. Every liquidation empties the Pool. RBTC:USD = 100", async () => {
      // whale adds coll that holds TCR > 150%
      await borrowerOperations.openVault(0, 0, whale, whale, { from: whale, value: dec(5, 29) })

      const numberOfOps = 5
      const defaulterAccounts = accounts.slice(1, numberOfOps)
      const depositorAccounts = accounts.slice(numberOfOps + 1, numberOfOps * 2)

      const defaulterCollMin = 1000000
      const defaulterCollMax = 100000000
      const defaulterBPDProportionMin = 91
      const defaulterBPDProportionMax = 180

      const depositorCollMin = 1
      const depositorCollMax = 10
      const depositorBPDProportionMin = 100
      const depositorBPDProportionMax = 100

      const remainingDefaulters = [...defaulterAccounts]
      const currentDepositors = []
      const liquidatedAccountsDict = {}
      const currentDepositorsDict = {}

      // setup:
      // account set L all add coll and withdraw BPD
      await th.openVault_allAccounts_randomRBTC_randomBPD(defaulterCollMin,
        defaulterCollMax,
        defaulterAccounts,
        contracts,
        defaulterBPDProportionMin,
        defaulterBPDProportionMax)

      // account set S all add coll and withdraw BPD
      await th.openVault_allAccounts_randomRBTC_randomBPD(depositorCollMin,
        depositorCollMax,
        depositorAccounts,
        contracts,
        depositorBPDProportionMin,
        depositorBPDProportionMax)

      // price drops, all L liquidateable
      await priceFeed.setPrice(dec(100, 18));

      // Random sequence of operations: liquidations and SP deposits
      for (i = 0; i < numberOfOps; i++) {
        await randomOperation(depositorAccounts,
          remainingDefaulters,
          currentDepositors,
          liquidatedAccountsDict,
          currentDepositorsDict)
      }

      await skyrocketPriceAndCheckAllVaultsSafe()

      const totalBPDDepositsBeforeWithdrawals = await stabilityPool.getTotalBPDDeposits()
      const totalETHRewardsBeforeWithdrawals = await stabilityPool.getETH()

      await attemptWithdrawAllDeposits(currentDepositors)

      const totalBPDDepositsAfterWithdrawals = await stabilityPool.getTotalBPDDeposits()
      const totalETHRewardsAfterWithdrawals = await stabilityPool.getETH()

      console.log(`Total BPD deposits before any withdrawals: ${totalBPDDepositsBeforeWithdrawals}`)
      console.log(`Total RBTC rewards before any withdrawals: ${totalETHRewardsBeforeWithdrawals}`)

      console.log(`Remaining BPD deposits after withdrawals: ${totalBPDDepositsAfterWithdrawals}`)
      console.log(`Remaining RBTC rewards after withdrawals: ${totalETHRewardsAfterWithdrawals}`)

      console.log(`current depositors length: ${currentDepositors.length}`)
      console.log(`remaining defaulters length: ${remainingDefaulters.length}`)
    })

    it("Defaulters' Collateral in range [1e6, 1e8]. SP Deposits in range [1e8 1e10]. RBTC:USD = 100", async () => {
      // whale adds coll that holds TCR > 150%
      await borrowerOperations.openVault(0, 0, whale, whale, { from: whale, value: dec(5, 29) })

      // price drops, all L liquidateable
      const numberOfOps = 5
      const defaulterAccounts = accounts.slice(1, numberOfOps)
      const depositorAccounts = accounts.slice(numberOfOps + 1, numberOfOps * 2)

      const defaulterCollMin = 1000000
      const defaulterCollMax = 100000000
      const defaulterBPDProportionMin = 91
      const defaulterBPDProportionMax = 180

      const depositorCollMin = 1000000
      const depositorCollMax = 100000000
      const depositorBPDProportionMin = 100
      const depositorBPDProportionMax = 100

      const remainingDefaulters = [...defaulterAccounts]
      const currentDepositors = []
      const liquidatedAccountsDict = {}
      const currentDepositorsDict = {}

      // setup:
      // account set L all add coll and withdraw BPD
      await th.openVault_allAccounts_randomRBTC_randomBPD(defaulterCollMin,
        defaulterCollMax,
        defaulterAccounts,
        contracts,
        defaulterBPDProportionMin,
        defaulterBPDProportionMax)

      // account set S all add coll and withdraw BPD
      await th.openVault_allAccounts_randomRBTC_randomBPD(depositorCollMin,
        depositorCollMax,
        depositorAccounts,
        contracts,
        depositorBPDProportionMin,
        depositorBPDProportionMax)

      // price drops, all L liquidateable
      await priceFeed.setPrice(dec(100, 18));

      // Random sequence of operations: liquidations and SP deposits
      for (i = 0; i < numberOfOps; i++) {
        await randomOperation(depositorAccounts,
          remainingDefaulters,
          currentDepositors,
          liquidatedAccountsDict,
          currentDepositorsDict)
      }

      await skyrocketPriceAndCheckAllVaultsSafe()

      const totalBPDDepositsBeforeWithdrawals = await stabilityPool.getTotalBPDDeposits()
      const totalETHRewardsBeforeWithdrawals = await stabilityPool.getETH()

      await attemptWithdrawAllDeposits(currentDepositors)

      const totalBPDDepositsAfterWithdrawals = await stabilityPool.getTotalBPDDeposits()
      const totalETHRewardsAfterWithdrawals = await stabilityPool.getETH()

      console.log(`Total BPD deposits before any withdrawals: ${totalBPDDepositsBeforeWithdrawals}`)
      console.log(`Total RBTC rewards before any withdrawals: ${totalETHRewardsBeforeWithdrawals}`)

      console.log(`Remaining BPD deposits after withdrawals: ${totalBPDDepositsAfterWithdrawals}`)
      console.log(`Remaining RBTC rewards after withdrawals: ${totalETHRewardsAfterWithdrawals}`)

      console.log(`current depositors length: ${currentDepositors.length}`)
      console.log(`remaining defaulters length: ${remainingDefaulters.length}`)
    })
  })
})
