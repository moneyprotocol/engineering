const { setNextBlockBaseFeePerGas } = require("@nomicfoundation/hardhat-network-helpers")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const SortedVaults = artifacts.require("SortedVaults")
const SortedVaultsTester = artifacts.require("SortedVaultsTester")
const VaultManagerTester = artifacts.require("VaultManagerTester")
const BPDToken = artifacts.require("BPDToken")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues

contract('SortedVaults', async accounts => {
  
  const assertSortedListIsOrdered = async (contracts) => {
    const price = await contracts.priceFeedTestnet.getPrice()

    let vault = await contracts.sortedVaults.getLast()
    while (vault !== (await contracts.sortedVaults.getFirst())) {
      
      // Get the adjacent upper vault ("prev" moves up the list, from lower ICR -> higher ICR)
      const prevVault = await contracts.sortedVaults.getPrev(vault)
     
      const vaultICR = await contracts.vaultManager.getCurrentICR(vault, price)
      const prevVaultICR = await contracts.vaultManager.getCurrentICR(prevVault, price)
      
      assert.isTrue(prevVaultICR.gte(vaultICR))

      const vaultNICR = await contracts.vaultManager.getNominalICR(vault)
      const prevVaultNICR = await contracts.vaultManager.getNominalICR(prevVault)
      
      assert.isTrue(prevVaultNICR.gte(vaultNICR))

      // climb the list
      vault = prevVault
    }
  }

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I, J, whale] = accounts;

  let priceFeed
  let sortedVaults
  let vaultManager
  let borrowerOperations
  let bpdToken

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let contracts

  const getOpenVaultBPDAmount = async (totalDebt) => th.getOpenVaultBPDAmount(contracts, totalDebt)
  const openVault = async (params) => th.openVault(contracts, params)

  describe('SortedVaults', () => {
    beforeEach(async () => {
      await setNextBlockBaseFeePerGas(0)
      contracts = await deploymentHelper.deployMoneypCore()
      contracts.vaultManager = await VaultManagerTester.new()
      contracts.bpdToken = await BPDToken.new(
        contracts.vaultManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )
      const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress, multisig)

      priceFeed = contracts.priceFeedTestnet
      sortedVaults = contracts.sortedVaults
      vaultManager = contracts.vaultManager
      borrowerOperations = contracts.borrowerOperations
      bpdToken = contracts.bpdToken

      await deploymentHelper.connectMPContracts(MPContracts)
      await deploymentHelper.connectCoreContracts(contracts, MPContracts)
      await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)
    })

    it('contains(): returns true for addresses that have opened vaults', async () => {
      await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // Confirm vault statuses became active
      assert.equal((await vaultManager.Vaults(alice))[3], '1')
      assert.equal((await vaultManager.Vaults(bob))[3], '1')
      assert.equal((await vaultManager.Vaults(carol))[3], '1')

      // Check sorted list contains vaults
      assert.isTrue(await sortedVaults.contains(alice))
      assert.isTrue(await sortedVaults.contains(bob))
      assert.isTrue(await sortedVaults.contains(carol))
    })

    it('contains(): returns false for addresses that have not opened vaults', async () => {
      await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // Confirm vaults have non-existent status
      assert.equal((await vaultManager.Vaults(dennis))[3], '0')
      assert.equal((await vaultManager.Vaults(erin))[3], '0')

      // Check sorted list do not contain vaults
      assert.isFalse(await sortedVaults.contains(dennis))
      assert.isFalse(await sortedVaults.contains(erin))
    })

    it('contains(): returns false for addresses that opened and then closed a vault', async () => {
      await openVault({ ICR: toBN(dec(1000, 18)), extraBPDAmount: toBN(dec(3000, 18)), extraParams: { from: whale } })

      await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // to compensate borrowing fees
      await bpdToken.transfer(alice, dec(1000, 18), { from: whale })
      await bpdToken.transfer(bob, dec(1000, 18), { from: whale })
      await bpdToken.transfer(carol, dec(1000, 18), { from: whale })

      // A, B, C close vaults
      await borrowerOperations.closeVault({ from: alice })
      await borrowerOperations.closeVault({ from:bob })
      await borrowerOperations.closeVault({ from:carol })

      // Confirm vault statuses became closed
      assert.equal((await vaultManager.Vaults(alice))[3], '2')
      assert.equal((await vaultManager.Vaults(bob))[3], '2')
      assert.equal((await vaultManager.Vaults(carol))[3], '2')

      // Check sorted list does not contain vaults
      assert.isFalse(await sortedVaults.contains(alice))
      assert.isFalse(await sortedVaults.contains(bob))
      assert.isFalse(await sortedVaults.contains(carol))
    })

    // true for addresses that opened -> closed -> opened a vault
    it('contains(): returns true for addresses that opened, closed and then re-opened a vault', async () => {
      await openVault({ ICR: toBN(dec(1000, 18)), extraBPDAmount: toBN(dec(3000, 18)), extraParams: { from: whale } })

      await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // to compensate borrowing fees
      await bpdToken.transfer(alice, dec(1000, 18), { from: whale })
      await bpdToken.transfer(bob, dec(1000, 18), { from: whale })
      await bpdToken.transfer(carol, dec(1000, 18), { from: whale })

      // A, B, C close vaults
      await borrowerOperations.closeVault({ from: alice })
      await borrowerOperations.closeVault({ from:bob })
      await borrowerOperations.closeVault({ from:carol })

      // Confirm vault statuses became closed
      assert.equal((await vaultManager.Vaults(alice))[3], '2')
      assert.equal((await vaultManager.Vaults(bob))[3], '2')
      assert.equal((await vaultManager.Vaults(carol))[3], '2')

      await openVault({ ICR: toBN(dec(1000, 16)), extraParams: { from: alice } })
      await openVault({ ICR: toBN(dec(2000, 18)), extraParams: { from: bob } })
      await openVault({ ICR: toBN(dec(3000, 18)), extraParams: { from: carol } })

      // Confirm vault statuses became open again
      assert.equal((await vaultManager.Vaults(alice))[3], '1')
      assert.equal((await vaultManager.Vaults(bob))[3], '1')
      assert.equal((await vaultManager.Vaults(carol))[3], '1')

      // Check sorted list does  contain vaults
      assert.isTrue(await sortedVaults.contains(alice))
      assert.isTrue(await sortedVaults.contains(bob))
      assert.isTrue(await sortedVaults.contains(carol))
    })

    // false when list size is 0
    it('contains(): returns false when there are no vaults in the system', async () => {
      assert.isFalse(await sortedVaults.contains(alice))
      assert.isFalse(await sortedVaults.contains(bob))
      assert.isFalse(await sortedVaults.contains(carol))
    })

    // true when list size is 1 and the vault the only one in system
    it('contains(): true when list size is 1 and the vault the only one in system', async () => {
      await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })

      assert.isTrue(await sortedVaults.contains(alice))
    })

    // false when list size is 1 and vault is not in the system
    it('contains(): false when list size is 1 and vault is not in the system', async () => {
      await openVault({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })

      assert.isFalse(await sortedVaults.contains(bob))
    })

    // --- getMaxSize ---

    it("getMaxSize(): Returns the maximum list size", async () => {
      const max = await sortedVaults.getMaxSize()
      assert.equal(web3.utils.toHex(max), th.maxBytes32)
    })

    // --- findInsertPosition ---

    it("Finds the correct insert position given two addresses that loosely bound the correct position", async () => { 
      await priceFeed.setPrice(dec(100, 18))

      // NICR sorted in descending order
      await openVault({ ICR: toBN(dec(500, 18)), extraParams: { from: whale } })
      await openVault({ ICR: toBN(dec(10, 18)), extraParams: { from: A } })
      await openVault({ ICR: toBN(dec(5, 18)), extraParams: { from: B } })
      await openVault({ ICR: toBN(dec(250, 16)), extraParams: { from: C } })
      await openVault({ ICR: toBN(dec(166, 16)), extraParams: { from: D } })
      await openVault({ ICR: toBN(dec(125, 16)), extraParams: { from: E } })

      // Expect a vault with NICR 300% to be inserted between B and C
      const targetNICR = dec(3, 18)

      // Pass addresses that loosely bound the right postiion
      const hints = await sortedVaults.findInsertPosition(targetNICR, A, E)

      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B )
      assert.equal(hints[1], C )

      // The price doesn’t affect the hints
      await priceFeed.setPrice(dec(500, 18))
      const hints2 = await sortedVaults.findInsertPosition(targetNICR, A, E)

      // Expect the exact correct insert hints have been returned
      assert.equal(hints2[0], B )
      assert.equal(hints2[1], C )
    })

    //--- Ordering --- 
    // infinte ICR (zero collateral) is not possible anymore, therefore, skipping
    it.skip("stays ordered after vaults with 'infinite' ICR receive a redistribution", async () => {

      // make several vaults with 0 debt and collateral, in random order
      await borrowerOperations.openVault(th._100pct, 0, whale, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.openVault(th._100pct, 0, A, A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openVault(th._100pct, 0, B, B, { from: B, value: dec(37, 'ether') })
      await borrowerOperations.openVault(th._100pct, 0, C, C, { from: C, value: dec(5, 'ether') })
      await borrowerOperations.openVault(th._100pct, 0, D, D, { from: D, value: dec(4, 'ether') })
      await borrowerOperations.openVault(th._100pct, 0, E, E, { from: E, value: dec(19, 'ether') })

      // Make some vaults with non-zero debt, in random order
      await borrowerOperations.openVault(th._100pct, dec(5, 19), F, F, { from: F, value: dec(1, 'ether') })
      await borrowerOperations.openVault(th._100pct, dec(3, 18), G, G, { from: G, value: dec(37, 'ether') })
      await borrowerOperations.openVault(th._100pct, dec(2, 20), H, H, { from: H, value: dec(5, 'ether') })
      await borrowerOperations.openVault(th._100pct, dec(17, 18), I, I, { from: I, value: dec(4, 'ether') })
      await borrowerOperations.openVault(th._100pct, dec(5, 21), J, J, { from: J, value: dec(1345, 'ether') })

      const price_1 = await priceFeed.getPrice()
      
      // Check vaults are ordered
      await assertSortedListIsOrdered(contracts)

      await borrowerOperations.openVault(th._100pct, dec(100, 18), defaulter_1, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      assert.isTrue(await sortedVaults.contains(defaulter_1))

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price_2 = await priceFeed.getPrice()

      // Liquidate a vault
      await vaultManager.liquidate(defaulter_1)
      assert.isFalse(await sortedVaults.contains(defaulter_1))

      // Check vaults are ordered
      await assertSortedListIsOrdered(contracts)
    })
  })

  describe('SortedVaults with mock dependencies', () => {
    let sortedVaultsTester

    beforeEach(async () => {
      await setNextBlockBaseFeePerGas(0)
      sortedVaults = await SortedVaults.new()
      sortedVaultsTester = await SortedVaultsTester.new()

      await sortedVaultsTester.setSortedVaults(sortedVaults.address)
    })

    context('when params are wrongly set', () => {
      it('setParams(): reverts if size is zero', async () => {
        await th.assertRevert(sortedVaults.setParams(0, sortedVaultsTester.address, sortedVaultsTester.address), 'SortedVaults: Size can’t be zero')
      })
    })

    context('when params are properly set', () => {
      beforeEach('set params', async() => {
        await sortedVaults.setParams(2, sortedVaultsTester.address, sortedVaultsTester.address)
      })

      it('insert(): fails if list is full', async () => {
        await sortedVaultsTester.insert(alice, 1, alice, alice)
        await sortedVaultsTester.insert(bob, 1, alice, alice)
        await th.assertRevert(sortedVaultsTester.insert(carol, 1, alice, alice), 'SortedVaults: List is full')
      })

      it('insert(): fails if list already contains the node', async () => {
        await sortedVaultsTester.insert(alice, 1, alice, alice)
        await th.assertRevert(sortedVaultsTester.insert(alice, 1, alice, alice), 'SortedVaults: List already contains the node')
      })

      it('insert(): fails if id is zero', async () => {
        await th.assertRevert(sortedVaultsTester.insert(th.ZERO_ADDRESS, 1, alice, alice), 'SortedVaults: Id cannot be zero')
      })

      it('insert(): fails if NICR is zero', async () => {
        await th.assertRevert(sortedVaultsTester.insert(alice, 0, alice, alice), 'SortedVaults: NICR must be positive')
      })

      it('remove(): fails if id is not in the list', async () => {
        await th.assertRevert(sortedVaultsTester.remove(alice), 'SortedVaults: List does not contain the id')
      })

      it('reInsert(): fails if list doesn’t contain the node', async () => {
        await th.assertRevert(sortedVaultsTester.reInsert(alice, 1, alice, alice), 'SortedVaults: List does not contain the id')
      })

      it('reInsert(): fails if new NICR is zero', async () => {
        await sortedVaultsTester.insert(alice, 1, alice, alice)
        assert.isTrue(await sortedVaults.contains(alice), 'list should contain element')
        await th.assertRevert(sortedVaultsTester.reInsert(alice, 0, alice, alice), 'SortedVaults: NICR must be positive')
        assert.isTrue(await sortedVaults.contains(alice), 'list should contain element')
      })

      it('findInsertPosition(): No prevId for hint - ascend list starting from nextId, result is after the tail', async () => {
        await sortedVaultsTester.insert(alice, 1, alice, alice)
        const pos = await sortedVaults.findInsertPosition(1, th.ZERO_ADDRESS, alice)
        assert.equal(pos[0], alice, 'prevId result should be nextId param')
        assert.equal(pos[1], th.ZERO_ADDRESS, 'nextId result should be zero')
      })
    })
  })
})
