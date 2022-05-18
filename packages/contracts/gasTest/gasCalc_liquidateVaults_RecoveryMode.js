/* Script that logs gas costs for Moneyp operations under various conditions. 

  Note: uses Mocha testing structure, but the purpose of each test is simply to print gas costs.

  'asserts' are only used to confirm the setup conditions.
*/
const fs = require('fs')

const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const timeValues = testHelpers.TimeValues
const _100pct = th._100pct

const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('Gas cost tests', async accounts => {
  const [owner] = accounts;
  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  let priceFeed
  let bpdToken

  let sortedVaults
  let vaultManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts
  let data = []

  beforeEach(async () => {
    contracts = await deploymentHelper.deployMoneypCore()
    const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress)

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

    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)
  })

  // --- liquidateVaults RECOVERY MODE - pure redistribution ---

  // 1 vault
  it("", async () => {
    const message = 'liquidateVaults(). n = 1. Pure redistribution, Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //1 accts open Vault with 1 ether and withdraw 100 BPD
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openVault_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' vaults have been closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 2. Pure redistribution. Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //2 accts open Vault with 1 ether and withdraw 100 BPD
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openVault_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' vaults have been closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 3. Pure redistribution. Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //3 accts open Vault with 1 ether and withdraw 100 BPD
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openVault_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' vaults have been closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 5. Pure redistribution. Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //5 accts open Vault with 1 ether and withdraw 100 BPD
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openVault_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' vaults have been closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 10. Pure redistribution. Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //10 accts open Vault with 1 ether and withdraw 100 BPD
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openVault_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' vaults have been closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  //20 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 20. Pure redistribution. Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 90 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //20 accts open Vault with 1 ether and withdraw 100 BPD
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openVault_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' vaults have been closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 30. Pure redistribution. Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 90 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //30 accts open Vault with 1 ether and withdraw 100 BPD
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openVault_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' vaults have been closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 40. Pure redistribution. Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 90 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //40 accts open Vault with 1 ether and withdraw 100 BPD
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openVault_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' vaults have been closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 45. Pure redistribution. Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //45 accts open Vault with 1 ether and withdraw 100 BPD
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openVault_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 BPD
    await borrowerOperations.openVault(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Price drops, defaulters' vaults fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await vaultManager.liquidateVaults(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' vaults have been closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- liquidate Vaults --- RECOVERY MODE --- Full offset, NO pending distribution rewards ----

  // 1 vault
  it("", async () => {
    const message = 'liquidateVaults(). n = 1. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //1 acct opens Vault with 1 ether and withdraw 100 BPD
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openVault_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _1_Defaulter) {
      console.log(`ICR: ${await vaultManager.getCurrentICR(account, price)}`)
      assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 2. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //2 acct opens Vault with 1 ether and withdraw 100 BPD
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openVault_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _2_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 3 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 3. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //3 accts open Vault with 1 ether and withdraw 100 BPD
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openVault_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _3_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 vaults 
  it("", async () => {
    const message = 'liquidateVaults(). n = 5. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //5 accts open Vault with 1 ether and withdraw 100 BPD
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openVault_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _5_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 10 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 10. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //10 accts open Vault with 1 ether and withdraw 100 BPD
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openVault_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _10_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 20. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //30 accts open Vault with 1 ether and withdraw 100 BPD
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openVault_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _20_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 30 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 30. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //30 accts open Vault with 1 ether and withdraw 100 BPD
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openVault_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _30_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 40. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale, ZERO_ADDRESS,{ from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //40 accts open Vault with 1 ether and withdraw 100 BPD
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openVault_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _40_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 45. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    //45 accts open Vault with 1 ether and withdraw 100 BPD
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openVault_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _45_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- liquidate Vaults --- RECOVERY MODE --- Full offset, HAS pending distribution rewards ----

  // 1 vault
  it("", async () => {
    const message = 'liquidateVaults(). n = 1. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //1 acct opens Vault with 1 ether and withdraw 100 BPD
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openVault_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _1_Defaulter) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale, ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28),ZERO_ADDRESS,  { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _1_Defaulter) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Vaults are closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 2. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //2 accts open Vault with 1 ether and withdraw 100 BPD
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openVault_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _2_Defaulters) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale, ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS,  { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _2_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Vaults are closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))


    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 3. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //3 accts open Vault with 1 ether and withdraw 100 BPD
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openVault_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _3_Defaulters) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _3_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Vaults are closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 5. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //5 accts open Vault with 1 ether and withdraw 100 BPD
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openVault_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _5_Defaulters) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _5_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Vaults are closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 10. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //10 accts open Vault with 1 ether and withdraw 100 BPD
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openVault_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _10_Defaulters) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _10_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Vaults are closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 20. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //20 accts open Vault with 1 ether and withdraw 100 BPD
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openVault_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _20_Defaulters) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _20_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Vaults are closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 30. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //30 accts open Vault with 1 ether and withdraw 100 BPD
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openVault_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _30_Defaulters) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _30_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Vaults are closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 40. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //40 accts open Vault with 1 ether and withdraw 100 BPD
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openVault_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _40_Defaulters) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _40_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Vaults are closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 vaults
  it("", async () => {
    const message = 'liquidateVaults(). n = 45. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Vault with 10 ether, withdraw 900 BPD
    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }

    //45 accts open Vault with 1 ether and withdraw 100 BPD
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openVault_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 BPD
    await borrowerOperations.openVault(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedVaults.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedVaults.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _45_Defaulters) { assert.isTrue(await vaultManager.hasPendingRewards(account)) }

    // Whale opens vault and fills SP with 1 billion BPD
    const whale = accounts[999]
    await borrowerOperations.openVault(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 BPD
    const BPDinSP = (await stabilityPool.getTotalBPDDeposits()).toString()
    assert.equal(BPDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _45_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, vaultManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate vaults
    const tx = await vaultManager.liquidateVaults(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await vaultManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Vaults are closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    // Check initial vaults with starting 10E/90BPD, and whale's vault, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedVaults.contains(account)) }
    assert.isTrue(await sortedVaults.contains(whale))

    //Check BPD in SP has decreased but is still > 0
    const BPDinSP_After = await stabilityPool.getTotalBPDDeposits()
    assert.isTrue(BPDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(BPDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- BatchLiquidateVaults ---

  // --- Pure redistribution, no offset. WITH pending distribution rewards ---

  // 10 vaults
  it("", async () => {
    const message = 'batchLiquidateVaults(). n = 10. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open Vault with 10 ether, withdraw 180 BPD

    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 BPD
    await borrowerOperations.openVault(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    const _10_defaulters = accounts.slice(1, 11)
    // --- Accounts to be liquidated in the test tx ---
    await th.openVault_allAccounts(_10_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // Check all defaulters active
    for (account of _10_defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await vaultManager.batchLiquidateVaults(_10_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _10_defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 vaults
  it("", async () => {
    const message = 'batchLiquidateVaults(). n = 40. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open Vault with 10 ether, withdraw 180 BPD

    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 BPD
    await borrowerOperations.openVault(_100pct, dec(130, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })


    // --- Accounts to be liquidated in the test tx ---
    const _40_defaulters = accounts.slice(1, 41)
    await th.openVault_allAccounts(_40_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // Check all defaulters active
    for (account of _40_defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await vaultManager.batchLiquidateVaults(_40_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _40_defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 vaults
  it("", async () => {
    const message = 'batchLiquidateVaults(). n = 45. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open Vault with 10 ether, withdraw 180 BPD

    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 BPD
    await borrowerOperations.openVault(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _45_defaulters = accounts.slice(1, 46)
    await th.openVault_allAccounts(_45_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // check all defaulters active
    for (account of _45_defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await vaultManager.batchLiquidateVaults(_45_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _45_defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 50 vaults
  it("", async () => {
    const message = 'batchLiquidateVaults(). n = 50. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open Vault with 10 ether, withdraw 180 BPD

    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 BPD
    await borrowerOperations.openVault(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _50_defaulters = accounts.slice(1, 51)
    await th.openVault_allAccounts(_50_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // check all defaulters active
    for (account of _50_defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await vaultManager.batchLiquidateVaults(_50_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _50_defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // --- batchLiquidateVaults - pure offset with Stability Pool ---

  // 10 vaults
  it("", async () => {
    const message = 'batchLiquidateVaults(). n = 10. All vaults fully offset. Have pending distribution rewards'
    // 10 accts each open Vault with 10 ether, withdraw 180 BPD

    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 BPD
    await borrowerOperations.openVault(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    const _10_defaulters = accounts.slice(1, 11)
    // --- Accounts to be liquidated in the test tx ---
    await th.openVault_allAccounts(_10_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // Check all defaulters active
    for (account of _10_defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens vault and fills SP with 1 billion BPD
    await borrowerOperations.openVault(_100pct, dec(1, 27), accounts[999],ZERO_ADDRESS, { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await vaultManager.batchLiquidateVaults(_10_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _10_defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 40 vaults
  it("", async () => {
    const message = 'batchLiquidateVaults(). n = 40. All vaults fully offset. Have pending distribution rewards'
    // 10 accts each open Vault with 10 ether, withdraw 180 BPD

    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(10, 18))

    // Account 500 opens with 1 ether and withdraws 180 BPD
    await borrowerOperations.openVault(_100pct, dec(130, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })


    // --- Accounts to be liquidated in the test tx ---
    const _40_defaulters = accounts.slice(1, 41)
    await th.openVault_allAccounts(_40_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // Check all defaulters active
    for (account of _40_defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens vault and fills SP with 1 billion BPD
    await borrowerOperations.openVault(_100pct, dec(1, 27), accounts[999],ZERO_ADDRESS, { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await vaultManager.batchLiquidateVaults(_40_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _40_defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 vaults
  it("", async () => {
    const message = 'batchLiquidateVaults(). n = 45. All vaults fully offset. Have pending distribution rewards'
    // 10 accts each open Vault with 10 ether, withdraw 180 BPD

    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 BPD
    await borrowerOperations.openVault(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _45_defaulters = accounts.slice(1, 46)
    await th.openVault_allAccounts(_45_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // check all defaulters active
    for (account of _45_defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens vault and fills SP with 1 billion BPD
    await borrowerOperations.openVault(_100pct, dec(1, 27), accounts[999],ZERO_ADDRESS, { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await vaultManager.batchLiquidateVaults(_45_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _45_defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 50 vaults
  it("", async () => {
    const message = 'batchLiquidateVaults(). n = 50. All vaults fully offset. Have pending distribution rewards'
    // 10 accts each open Vault with 10 ether, withdraw 180 BPD

    await th.openVault_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 BPD
    await borrowerOperations.openVault(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _50_defaulters = accounts.slice(1, 51)
    await th.openVault_allAccounts(_50_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // check all defaulters active
    for (account of _50_defaulters) { assert.isTrue(await sortedVaults.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await vaultManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens vault and fills SP with 1 billion BPD
    await borrowerOperations.openVault(_100pct, dec(1, 27), accounts[999],ZERO_ADDRESS, { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    
    const tx = await vaultManager.batchLiquidateVaults(_50_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _50_defaulters) { assert.isFalse(await sortedVaults.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })



  it("Export test data", async () => {
    fs.writeFile('gasTest/outputs/liquidateVaultsGasData.csv', data, (err) => {
      if (err) { console.log(err) } else {
        console.log("LiquidateVaults() gas test data written to gasTest/outputs/liquidateVaultsGasData.csv")
      }
    })
  })
})