const { TestHelper: { dec } } = require("../utils/testHelpers.js")

const EchidnaTester = artifacts.require('EchidnaTester')
const VaultManager = artifacts.require('VaultManager')
const BPDToken = artifacts.require('BPDToken')
const ActivePool = artifacts.require('ActivePool')
const DefaultPool = artifacts.require('DefaultPool')
const StabilityPool = artifacts.require('StabilityPool')

// run with:
// npx hardhat --config hardhat.config.echidna.js test fuzzTests/echidna_debug.js

contract('Echidna debugger', async accounts => {
  let echidnaTester
  let vaultManager
  let bpdToken
  let activePool
  let defaultPool
  let stabilityPool
  let GAS_POOL_ADDRESS

  before(async () => {
    echidnaTester = await EchidnaTester.new({ value: dec(11, 25) })
    vaultManager = await VaultManager.at(await echidnaTester.vaultManager())
    bpdToken = await BPDToken.at(await echidnaTester.bpdToken())
    activePool = await ActivePool.at(await echidnaTester.activePool())
    defaultPool = await DefaultPool.at(await echidnaTester.defaultPool())
    stabilityPool = await StabilityPool.at(await echidnaTester.stabilityPool())
    GAS_POOL_ADDRESS = await vaultManager.GAS_POOL_ADDRESS();
  })

  it('openVault', async () => {
    await echidnaTester.openVaultExt(
      '28533397325200555203581702704626658822751905051193839801320459908900876958892',
      '52469987802830075086048985199642144541375565475567220729814021622139768827880',
      '9388634783070735775888100571650283386615011854365252563480851823632223689886'
    )
  })

  it('openVault', async () => {
    await echidnaTester.openVaultExt('0', '0', '0')
  })

  it.skip('vault order', async () => {
    const vault1 = await echidnaTester.echidnaProxies(0)
    console.log(vault1)
    const vault2 = await echidnaTester.echidnaProxies(1)

    const icr1_before = await vaultManager.getCurrentICR(vault1, '1000000000000000000')
    const icr2_before = await vaultManager.getCurrentICR(vault2, '1000000000000000000')
    console.log('Vault 1', icr1_before, icr1_before.toString())
    console.log('Vault 2', icr2_before, icr2_before.toString())

    await echidnaTester.openVaultExt('0', '0', '30540440604590048251848424')
    await echidnaTester.openVaultExt('1', '0', '0')
    await echidnaTester.setPriceExt('78051143795343077331468494330613608802436946862454908477491916')
    const icr1_after = await vaultManager.getCurrentICR(vault1, '1000000000000000000')
    const icr2_after = await vaultManager.getCurrentICR(vault2, '1000000000000000000')
    console.log('Vault 1', icr1_after, icr1_after.toString())
    console.log('Vault 2', icr2_after, icr2_after.toString())

    const icr1_after_price = await vaultManager.getCurrentICR(vault1, '78051143795343077331468494330613608802436946862454908477491916')
    const icr2_after_price = await vaultManager.getCurrentICR(vault2, '78051143795343077331468494330613608802436946862454908477491916')
    console.log('Vault 1', icr1_after_price, icr1_after_price.toString())
    console.log('Vault 2', icr2_after_price, icr2_after_price.toString())
  })

  it.only('BPD balance', async () => {
    await echidnaTester.openVaultExt('0', '0', '4210965169908805439447313562489173090')

    const totalSupply = await bpdToken.totalSupply();
    const gasPoolBalance = await bpdToken.balanceOf(GAS_POOL_ADDRESS);
    const activePoolBalance = await activePool.getBPDDebt();
    const defaultPoolBalance = await defaultPool.getBPDDebt();
    const stabilityPoolBalance = await stabilityPool.getTotalBPDDeposits();
    const currentVault = await echidnaTester.echidnaProxies(0);
    const vaultBalance = bpdToken.balanceOf(currentVault);

    console.log('totalSupply', totalSupply.toString());
    console.log('gasPoolBalance', gasPoolBalance.toString());
    console.log('activePoolBalance', activePoolBalance.toString());
    console.log('defaultPoolBalance', defaultPoolBalance.toString());
    console.log('stabilityPoolBalance', stabilityPoolBalance.toString());
    console.log('vaultBalance', vaultBalance.toString());
  })
})
