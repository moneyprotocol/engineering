const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const VaultManagerTester = artifacts.require("VaultManagerTester")
const MPTokenTester = artifacts.require("MPTokenTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert

const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  VaultManagerProxy,
  StabilityPoolProxy,
  SortedVaultsProxy,
  TokenProxy,
  MPStakingProxy
} = require('../utils/proxyHelpers.js')

contract('BorrowerWrappers', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E,
    defaulter_1, defaulter_2,
    // frontEnd_1, frontEnd_2, frontEnd_3
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let bpdToken
  let sortedVaults
  let vaultManagerOriginal
  let vaultManager
  let activePool
  let stabilityPool
  let defaultPool
  let collSurplusPool
  let borrowerOperations
  let borrowerWrappers
  let mpTokenOriginal
  let mpToken
  let mpStaking

  let contracts

  let BPD_GAS_COMPENSATION

  const getOpenVaultBPDAmount = async (totalDebt) => th.getOpenVaultBPDAmount(contracts, totalDebt)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const openVault = async (params) => th.openVault(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployMoneypCore()
    contracts.vaultManager = await VaultManagerTester.new()
    contracts = await deploymentHelper.deployBPDToken(contracts)
    const MPContracts = await deploymentHelper.deployMPTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)

    vaultManagerOriginal = contracts.vaultManager
    mpTokenOriginal = MPContracts.mpToken

    const users = [ alice, bob, carol, dennis, whale, A, B, C, D, E, defaulter_1, defaulter_2 ]
    await deploymentHelper.deployProxyScripts(contracts, MPContracts, owner, users)

    priceFeed = contracts.priceFeedTestnet
    bpdToken = contracts.bpdToken
    sortedVaults = contracts.sortedVaults
    vaultManager = contracts.vaultManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    borrowerWrappers = contracts.borrowerWrappers
    mpStaking = MPContracts.mpStaking
    mpToken = MPContracts.mpToken

    BPD_GAS_COMPENSATION = await borrowerOperations.BPD_GAS_COMPENSATION()
  })

  it('proxy owner can recover RBTC', async () => {
    const amount = toBN(dec(1, 18))
    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)

    // send some RBTC to proxy
    await web3.eth.sendTransaction({ from: owner, to: proxyAddress, value: amount })
    assert.equal(await web3.eth.getBalance(proxyAddress), amount.toString())

    const balanceBefore = toBN(await web3.eth.getBalance(alice))

    // recover RBTC
    await borrowerWrappers.transferRBTC(alice, amount, { from: alice, gasPrice: 0 })
    const balanceAfter = toBN(await web3.eth.getBalance(alice))

    assert.equal(balanceAfter.sub(balanceBefore), amount.toString())
  })

  it('non proxy owner cannot recover RBTC', async () => {
    const amount = toBN(dec(1, 18))
    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)

    // send some RBTC to proxy
    await web3.eth.sendTransaction({ from: owner, to: proxyAddress, value: amount })
    assert.equal(await web3.eth.getBalance(proxyAddress), amount.toString())

    const balanceBefore = toBN(await web3.eth.getBalance(alice))

    // try to recover RBTC
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'transferRBTC(address,uint256)'
    const calldata = th.getTransactionData(signature, [alice, amount])
    await assertRevert(proxy.methods["execute(address,bytes)"](borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')

    assert.equal(await web3.eth.getBalance(proxyAddress), amount.toString())

    const balanceAfter = toBN(await web3.eth.getBalance(alice))
    assert.equal(balanceAfter, balanceBefore.toString())
  })

  // --- claimCollateralAndOpenVault ---

  it('claimCollateralAndOpenVault(): reverts if nothing to claim', async () => {
    // Whale opens Vault
    await openVault({ ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // alice opens Vault
    const { bpdAmount, collateral } = await openVault({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    assert.equal(await web3.eth.getBalance(proxyAddress), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // alice claims collateral and re-opens the vault
    await assertRevert(
      borrowerWrappers.claimCollateralAndOpenVault(th._100pct, bpdAmount, alice, alice, { from: alice }),
      'CollSurplusPool: No collateral available to claim'
    )

    // check everything remain the same
    assert.equal(await web3.eth.getBalance(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await bpdToken.balanceOf(proxyAddress), bpdAmount)
    assert.equal(await vaultManager.getVaultStatus(proxyAddress), 1)
    th.assertIsApproximatelyEqual(await vaultManager.getVaultColl(proxyAddress), collateral)
  })

  it('claimCollateralAndOpenVault(): without sending any value', async () => {
    // alice opens Vault
    const { bpdAmount, netDebt: redeemAmount, collateral } = await openVault({extraBPDAmount: 0, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
    // Whale opens Vault
    await openVault({ extraBPDAmount: redeemAmount, ICR: toBN(dec(5, 18)), extraParams: { from: whale } })

    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    assert.equal(await web3.eth.getBalance(proxyAddress), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 150 BPD
    await th.redeemCollateral(whale, contracts, redeemAmount)
    assert.equal(await web3.eth.getBalance(proxyAddress), '0')

    // surplus: 5 - 150/200
    const price = await priceFeed.getPrice();
    const expectedSurplus = collateral.sub(redeemAmount.mul(mv._1e18BN).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), expectedSurplus)
    assert.equal(await vaultManager.getVaultStatus(proxyAddress), 4) // closed by redemption

    // alice claims collateral and re-opens the vault
    await borrowerWrappers.claimCollateralAndOpenVault(th._100pct, bpdAmount, alice, alice, { from: alice })

    assert.equal(await web3.eth.getBalance(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await bpdToken.balanceOf(proxyAddress), bpdAmount.mul(toBN(2)))
    assert.equal(await vaultManager.getVaultStatus(proxyAddress), 1)
    th.assertIsApproximatelyEqual(await vaultManager.getVaultColl(proxyAddress), expectedSurplus)
  })

  it('claimCollateralAndOpenVault(): sending value in the transaction', async () => {
    // alice opens Vault
    const { bpdAmount, netDebt: redeemAmount, collateral } = await openVault({ extraParams: { from: alice } })
    // Whale opens Vault
    await openVault({ extraBPDAmount: redeemAmount, ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    assert.equal(await web3.eth.getBalance(proxyAddress), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 150 BPD
    await th.redeemCollateral(whale, contracts, redeemAmount)
    assert.equal(await web3.eth.getBalance(proxyAddress), '0')

    // surplus: 5 - 150/200
    const price = await priceFeed.getPrice();
    const expectedSurplus = collateral.sub(redeemAmount.mul(mv._1e18BN).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), expectedSurplus)
    assert.equal(await vaultManager.getVaultStatus(proxyAddress), 4) // closed by redemption

    // alice claims collateral and re-opens the vault
    await borrowerWrappers.claimCollateralAndOpenVault(th._100pct, bpdAmount, alice, alice, { from: alice, value: collateral })

    assert.equal(await web3.eth.getBalance(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await bpdToken.balanceOf(proxyAddress), bpdAmount.mul(toBN(2)))
    assert.equal(await vaultManager.getVaultStatus(proxyAddress), 1)
    th.assertIsApproximatelyEqual(await vaultManager.getVaultColl(proxyAddress), expectedSurplus.add(collateral))
  })

  // --- claimSPRewardsAndRecycle ---

  it('claimSPRewardsAndRecycle(): only owner can call it', async () => {
    // Whale opens Vault
    await openVault({ extraBPDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
    // Whale deposits 1850 BPD in StabilityPool
    await stabilityPool.provideToSP(dec(1850, 18), ZERO_ADDRESS, { from: whale })

    // alice opens vault and provides 150 BPD to StabilityPool
    await openVault({ extraBPDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // Defaulter Vault opened
    await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })

    // price drops: defaulters' Vaults fall below MCR, alice and whale Vault remain active
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);

    // Defaulter vault closed
    const liquidationTX_1 = await vaultManager.liquidate(defaulter_1, { from: owner })
    const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)

    // Bob tries to claims SP rewards in behalf of Alice
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'claimSPRewardsAndRecycle(uint256,address,address)'
    const calldata = th.getTransactionData(signature, [th._100pct, alice, alice])
    await assertRevert(proxy.methods["execute(address,bytes)"](borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')
  })

  it('claimSPRewardsAndRecycle():', async () => {
    // Whale opens Vault
    const whaleDeposit = toBN(dec(2350, 18))
    await openVault({ extraBPDAmount: whaleDeposit, ICR: toBN(dec(4, 18)), extraParams: { from: whale } })
    // Whale deposits 1850 BPD in StabilityPool
    await stabilityPool.provideToSP(whaleDeposit, ZERO_ADDRESS, { from: whale })

    // alice opens vault and provides 150 BPD to StabilityPool
    const aliceDeposit = toBN(dec(150, 18))
    await openVault({ extraBPDAmount: aliceDeposit, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(aliceDeposit, ZERO_ADDRESS, { from: alice })

    // Defaulter Vault opened
    const { bpdAmount, netDebt, collateral } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })

    // price drops: defaulters' Vaults fall below MCR, alice and whale Vault remain active
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);

    // Defaulter vault closed
    const liquidationTX_1 = await vaultManager.liquidate(defaulter_1, { from: owner })
    const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)

    // Alice BPDLoss is ((150/2500) * liquidatedDebt)
    const totalDeposits = whaleDeposit.add(aliceDeposit)
    const expectedBPDLoss_A = liquidatedDebt_1.mul(aliceDeposit).div(totalDeposits)

    const expectedCompoundedBPDDeposit_A = toBN(dec(150, 18)).sub(expectedBPDLoss_A)
    const compoundedBPDDeposit_A = await stabilityPool.getCompoundedBPDDeposit(alice)
    // collateral * 150 / 2500 * 0.995
    const expectedRBTCGain_A = collateral.mul(aliceDeposit).div(totalDeposits).mul(toBN(dec(995, 15))).div(mv._1e18BN)

    assert.isAtMost(th.getDifference(expectedCompoundedBPDDeposit_A, compoundedBPDDeposit_A), 1000)

    const ethBalanceBefore = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollBefore = await vaultManager.getVaultColl(alice)
    const bpdBalanceBefore = await bpdToken.balanceOf(alice)
    const vaultDebtBefore = await vaultManager.getVaultDebt(alice)
    const mpBalanceBefore = await mpToken.balanceOf(alice)
    const ICRBefore = await vaultManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await mpStaking.stakes(alice)

    const proportionalBPD = expectedRBTCGain_A.mul(price).div(ICRBefore)
    const borrowingRate = await vaultManagerOriginal.getBorrowingRateWithDecay()
    const netDebtChange = proportionalBPD.mul(mv._1e18BN).div(mv._1e18BN.add(borrowingRate))

    // to force MP issuance
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const expectedMPGain_A = toBN('50373424199406504708132')

    await priceFeed.setPrice(price.mul(toBN(2)));

    // Alice claims SP rewards and puts them back in the system through the proxy
    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    await borrowerWrappers.claimSPRewardsAndRecycle(th._100pct, alice, alice, { from: alice })

    const ethBalanceAfter = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollAfter = await vaultManager.getVaultColl(alice)
    const bpdBalanceAfter = await bpdToken.balanceOf(alice)
    const vaultDebtAfter = await vaultManager.getVaultDebt(alice)
    const mpBalanceAfter = await mpToken.balanceOf(alice)
    const ICRAfter = await vaultManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await mpStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(ethBalanceAfter.toString(), ethBalanceBefore.toString())
    assert.equal(bpdBalanceAfter.toString(), bpdBalanceBefore.toString())
    assert.equal(mpBalanceAfter.toString(), mpBalanceBefore.toString())
    // check vault has increased debt by the ICR proportional amount to RBTC gain
    th.assertIsApproximatelyEqual(vaultDebtAfter, vaultDebtBefore.add(proportionalBPD))
    // check vault has increased collateral by the RBTC gain
    th.assertIsApproximatelyEqual(vaultCollAfter, vaultCollBefore.add(expectedRBTCGain_A))
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.sub(expectedBPDLoss_A).add(netDebtChange))
    // check mp balance remains the same
    th.assertIsApproximatelyEqual(mpBalanceAfter, mpBalanceBefore)

    // MP staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore.add(expectedMPGain_A))

    // Expect Alice has withdrawn all RBTC gain
    const alice_pendingRBTCGain = await stabilityPool.getDepositorRBTCGain(alice)
    assert.equal(alice_pendingRBTCGain, 0)
  })


  // --- claimStakingGainsAndRecycle ---

  it('claimStakingGainsAndRecycle(): only owner can call it', async () => {
    // Whale opens Vault
    await openVault({ extraBPDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // alice opens vault
    await openVault({ extraBPDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })

    // mint some MP
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake MP
    await mpStaking.stake(dec(1850, 18), { from: whale })
    await mpStaking.stake(dec(150, 18), { from: alice })

    // Defaulter Vault opened
    const { bpdAmount, netDebt, totalDebt, collateral } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 BPD
    const redeemedAmount = toBN(dec(100, 18))
    await th.redeemCollateral(whale, contracts, redeemedAmount)

    // Bob tries to claims staking gains in behalf of Alice
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'claimStakingGainsAndRecycle(uint256,address,address)'
    const calldata = th.getTransactionData(signature, [th._100pct, alice, alice])
    await assertRevert(proxy.methods["execute(address,bytes)"](borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')
  })

  it('claimStakingGainsAndRecycle(): reverts if user has no vault', async () => {
    const price = toBN(dec(200, 18))

    // Whale opens Vault
    await openVault({ extraBPDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
    // Whale deposits 1850 BPD in StabilityPool
    await stabilityPool.provideToSP(dec(1850, 18), ZERO_ADDRESS, { from: whale })

    // alice opens vault and provides 150 BPD to StabilityPool
    //await openVault({ extraBPDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    //await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some MP
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake MP
    await mpStaking.stake(dec(1850, 18), { from: whale })
    await mpStaking.stake(dec(150, 18), { from: alice })

    // Defaulter Vault opened
    const { bpdAmount, netDebt, totalDebt, collateral } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
    const borrowingFee = netDebt.sub(bpdAmount)

    // Alice BPD gain is ((150/2000) * borrowingFee)
    const expectedBPDGain_A = borrowingFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 BPD
    const redeemedAmount = toBN(dec(100, 18))
    await th.redeemCollateral(whale, contracts, redeemedAmount)

    const ethBalanceBefore = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollBefore = await vaultManager.getVaultColl(alice)
    const bpdBalanceBefore = await bpdToken.balanceOf(alice)
    const vaultDebtBefore = await vaultManager.getVaultDebt(alice)
    const mpBalanceBefore = await mpToken.balanceOf(alice)
    const ICRBefore = await vaultManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await mpStaking.stakes(alice)

    // Alice claims staking rewards and puts them back in the system through the proxy
    await assertRevert(
      borrowerWrappers.claimStakingGainsAndRecycle(th._100pct, alice, alice, { from: alice }),
      'BorrowerWrappersScript: caller must have an active vault'
    )

    const ethBalanceAfter = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollAfter = await vaultManager.getVaultColl(alice)
    const bpdBalanceAfter = await bpdToken.balanceOf(alice)
    const vaultDebtAfter = await vaultManager.getVaultDebt(alice)
    const mpBalanceAfter = await mpToken.balanceOf(alice)
    const ICRAfter = await vaultManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await mpStaking.stakes(alice)

    // check everything remains the same
    assert.equal(ethBalanceAfter.toString(), ethBalanceBefore.toString())
    assert.equal(bpdBalanceAfter.toString(), bpdBalanceBefore.toString())
    assert.equal(mpBalanceAfter.toString(), mpBalanceBefore.toString())
    th.assertIsApproximatelyEqual(vaultDebtAfter, vaultDebtBefore, 10000)
    th.assertIsApproximatelyEqual(vaultCollAfter, vaultCollBefore)
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    th.assertIsApproximatelyEqual(depositAfter, depositBefore, 10000)
    th.assertIsApproximatelyEqual(mpBalanceBefore, mpBalanceAfter)
    // MP staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore)

    // Expect Alice has withdrawn all RBTC gain
    const alice_pendingRBTCGain = await stabilityPool.getDepositorRBTCGain(alice)
    assert.equal(alice_pendingRBTCGain, 0)
  })

  it('claimStakingGainsAndRecycle(): with only RBTC gain', async () => {
    const price = toBN(dec(200, 18))

    // Whale opens Vault
    await openVault({ extraBPDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // Defaulter Vault opened
    const { bpdAmount, netDebt, collateral } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
    const borrowingFee = netDebt.sub(bpdAmount)

    // alice opens vault and provides 150 BPD to StabilityPool
    await openVault({ extraBPDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some MP
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake MP
    await mpStaking.stake(dec(1850, 18), { from: whale })
    await mpStaking.stake(dec(150, 18), { from: alice })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 BPD
    const redeemedAmount = toBN(dec(100, 18))
    await th.redeemCollateral(whale, contracts, redeemedAmount)

    // Alice RBTC gain is ((150/2000) * (redemption fee over redeemedAmount) / price)
    const redemptionFee = await vaultManager.getRedemptionFeeWithDecay(redeemedAmount)
    const expectedRBTCGain_A = redemptionFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18))).mul(mv._1e18BN).div(price)

    const ethBalanceBefore = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollBefore = await vaultManager.getVaultColl(alice)
    const bpdBalanceBefore = await bpdToken.balanceOf(alice)
    const vaultDebtBefore = await vaultManager.getVaultDebt(alice)
    const mpBalanceBefore = await mpToken.balanceOf(alice)
    const ICRBefore = await vaultManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await mpStaking.stakes(alice)

    const proportionalBPD = expectedRBTCGain_A.mul(price).div(ICRBefore)
    const borrowingRate = await vaultManagerOriginal.getBorrowingRateWithDecay()
    const netDebtChange = proportionalBPD.mul(toBN(dec(1, 18))).div(toBN(dec(1, 18)).add(borrowingRate))

    const expectedMPGain_A = toBN('839557069990108416000000')

    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    // Alice claims staking rewards and puts them back in the system through the proxy
    await borrowerWrappers.claimStakingGainsAndRecycle(th._100pct, alice, alice, { from: alice })

    // Alice new BPD gain due to her own Vault adjustment: ((150/2000) * (borrowing fee over netDebtChange))
    const newBorrowingFee = await vaultManagerOriginal.getBorrowingFeeWithDecay(netDebtChange)
    const expectedNewBPDGain_A = newBorrowingFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    const ethBalanceAfter = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollAfter = await vaultManager.getVaultColl(alice)
    const bpdBalanceAfter = await bpdToken.balanceOf(alice)
    const vaultDebtAfter = await vaultManager.getVaultDebt(alice)
    const mpBalanceAfter = await mpToken.balanceOf(alice)
    const ICRAfter = await vaultManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await mpStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(ethBalanceAfter.toString(), ethBalanceBefore.toString())
    assert.equal(mpBalanceAfter.toString(), mpBalanceBefore.toString())
    // check proxy bpd balance has increased by own adjust vault reward
    th.assertIsApproximatelyEqual(bpdBalanceAfter, bpdBalanceBefore.add(expectedNewBPDGain_A))
    // check vault has increased debt by the ICR proportional amount to RBTC gain
    th.assertIsApproximatelyEqual(vaultDebtAfter, vaultDebtBefore.add(proportionalBPD), 10000)
    // check vault has increased collateral by the RBTC gain
    th.assertIsApproximatelyEqual(vaultCollAfter, vaultCollBefore.add(expectedRBTCGain_A))
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.add(netDebtChange), 10000)
    // check mp balance remains the same
    th.assertIsApproximatelyEqual(mpBalanceBefore, mpBalanceAfter)

    // MP staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore.add(expectedMPGain_A))

    // Expect Alice has withdrawn all RBTC gain
    const alice_pendingRBTCGain = await stabilityPool.getDepositorRBTCGain(alice)
    assert.equal(alice_pendingRBTCGain, 0)
  })

  it('claimStakingGainsAndRecycle(): with only BPD gain', async () => {
    const price = toBN(dec(200, 18))

    // Whale opens Vault
    await openVault({ extraBPDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // alice opens vault and provides 150 BPD to StabilityPool
    await openVault({ extraBPDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some MP
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake MP
    await mpStaking.stake(dec(1850, 18), { from: whale })
    await mpStaking.stake(dec(150, 18), { from: alice })

    // Defaulter Vault opened
    const { bpdAmount, netDebt, collateral } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
    const borrowingFee = netDebt.sub(bpdAmount)

    // Alice BPD gain is ((150/2000) * borrowingFee)
    const expectedBPDGain_A = borrowingFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    const ethBalanceBefore = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollBefore = await vaultManager.getVaultColl(alice)
    const bpdBalanceBefore = await bpdToken.balanceOf(alice)
    const vaultDebtBefore = await vaultManager.getVaultDebt(alice)
    const mpBalanceBefore = await mpToken.balanceOf(alice)
    const ICRBefore = await vaultManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await mpStaking.stakes(alice)

    const borrowingRate = await vaultManagerOriginal.getBorrowingRateWithDecay()

    // Alice claims staking rewards and puts them back in the system through the proxy
    await borrowerWrappers.claimStakingGainsAndRecycle(th._100pct, alice, alice, { from: alice })

    const ethBalanceAfter = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollAfter = await vaultManager.getVaultColl(alice)
    const bpdBalanceAfter = await bpdToken.balanceOf(alice)
    const vaultDebtAfter = await vaultManager.getVaultDebt(alice)
    const mpBalanceAfter = await mpToken.balanceOf(alice)
    const ICRAfter = await vaultManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await mpStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(ethBalanceAfter.toString(), ethBalanceBefore.toString())
    assert.equal(mpBalanceAfter.toString(), mpBalanceBefore.toString())
    // check proxy bpd balance has increased by own adjust vault reward
    th.assertIsApproximatelyEqual(bpdBalanceAfter, bpdBalanceBefore)
    // check vault has increased debt by the ICR proportional amount to RBTC gain
    th.assertIsApproximatelyEqual(vaultDebtAfter, vaultDebtBefore, 10000)
    // check vault has increased collateral by the RBTC gain
    th.assertIsApproximatelyEqual(vaultCollAfter, vaultCollBefore)
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.add(expectedBPDGain_A), 10000)
    // check mp balance remains the same
    th.assertIsApproximatelyEqual(mpBalanceBefore, mpBalanceAfter)

    // Expect Alice has withdrawn all RBTC gain
    const alice_pendingRBTCGain = await stabilityPool.getDepositorRBTCGain(alice)
    assert.equal(alice_pendingRBTCGain, 0)
  })

  it('claimStakingGainsAndRecycle(): with both RBTC and BPD gains', async () => {
    const price = toBN(dec(200, 18))

    // Whale opens Vault
    await openVault({ extraBPDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // alice opens vault and provides 150 BPD to StabilityPool
    await openVault({ extraBPDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some MP
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await mpTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake MP
    await mpStaking.stake(dec(1850, 18), { from: whale })
    await mpStaking.stake(dec(150, 18), { from: alice })

    // Defaulter Vault opened
    const { bpdAmount, netDebt, collateral } = await openVault({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
    const borrowingFee = netDebt.sub(bpdAmount)

    // Alice BPD gain is ((150/2000) * borrowingFee)
    const expectedBPDGain_A = borrowingFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 BPD
    const redeemedAmount = toBN(dec(100, 18))
    await th.redeemCollateral(whale, contracts, redeemedAmount)

    // Alice RBTC gain is ((150/2000) * (redemption fee over redeemedAmount) / price)
    const redemptionFee = await vaultManager.getRedemptionFeeWithDecay(redeemedAmount)
    const expectedRBTCGain_A = redemptionFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18))).mul(mv._1e18BN).div(price)

    const ethBalanceBefore = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollBefore = await vaultManager.getVaultColl(alice)
    const bpdBalanceBefore = await bpdToken.balanceOf(alice)
    const vaultDebtBefore = await vaultManager.getVaultDebt(alice)
    const mpBalanceBefore = await mpToken.balanceOf(alice)
    const ICRBefore = await vaultManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await mpStaking.stakes(alice)

    const proportionalBPD = expectedRBTCGain_A.mul(price).div(ICRBefore)
    const borrowingRate = await vaultManagerOriginal.getBorrowingRateWithDecay()
    const netDebtChange = proportionalBPD.mul(toBN(dec(1, 18))).div(toBN(dec(1, 18)).add(borrowingRate))
    const expectedTotalBPD = expectedBPDGain_A.add(netDebtChange)

    const expectedMPGain_A = toBN('839557069990108416000000')

    // Alice claims staking rewards and puts them back in the system through the proxy
    await borrowerWrappers.claimStakingGainsAndRecycle(th._100pct, alice, alice, { from: alice })

    // Alice new BPD gain due to her own Vault adjustment: ((150/2000) * (borrowing fee over netDebtChange))
    const newBorrowingFee = await vaultManagerOriginal.getBorrowingFeeWithDecay(netDebtChange)
    const expectedNewBPDGain_A = newBorrowingFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    const ethBalanceAfter = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const vaultCollAfter = await vaultManager.getVaultColl(alice)
    const bpdBalanceAfter = await bpdToken.balanceOf(alice)
    const vaultDebtAfter = await vaultManager.getVaultDebt(alice)
    const mpBalanceAfter = await mpToken.balanceOf(alice)
    const ICRAfter = await vaultManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await mpStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(ethBalanceAfter.toString(), ethBalanceBefore.toString())
    assert.equal(mpBalanceAfter.toString(), mpBalanceBefore.toString())
    // check proxy bpd balance has increased by own adjust vault reward
    th.assertIsApproximatelyEqual(bpdBalanceAfter, bpdBalanceBefore.add(expectedNewBPDGain_A))
    // check vault has increased debt by the ICR proportional amount to RBTC gain
    th.assertIsApproximatelyEqual(vaultDebtAfter, vaultDebtBefore.add(proportionalBPD), 10000)
    // check vault has increased collateral by the RBTC gain
    th.assertIsApproximatelyEqual(vaultCollAfter, vaultCollBefore.add(expectedRBTCGain_A))
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.add(expectedTotalBPD), 10000)
    // check mp balance remains the same
    th.assertIsApproximatelyEqual(mpBalanceBefore, mpBalanceAfter)

    // MP staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore.add(expectedMPGain_A))

    // Expect Alice has withdrawn all RBTC gain
    const alice_pendingRBTCGain = await stabilityPool.getDepositorRBTCGain(alice)
    assert.equal(alice_pendingRBTCGain, 0)
  })

})
