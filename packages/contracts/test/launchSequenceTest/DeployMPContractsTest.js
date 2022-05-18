const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")


const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const assertRevert = th.assertRevert
const toBN = th.toBN
const dec = th.dec

contract('Deploying the MP contracts: LCF, CI, MPStaking, and MPToken ', async accounts => {
  const [moneypAG, A, B] = accounts;
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let MPContracts

  const oneMillion = toBN(1000000)
  const digits = toBN(1e18)
  const thirtyTwo = toBN(32)
  const expectedCISupplyCap = thirtyTwo.mul(oneMillion).mul(digits)

  beforeEach(async () => {
    // Deploy all contracts from the first account
    MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress, multisig)
    await deploymentHelper.connectMPContracts(MPContracts)

    mpStaking = MPContracts.mpStaking
    mpToken = MPContracts.mpToken
    communityIssuance = MPContracts.communityIssuance
    lockupContractFactory = MPContracts.lockupContractFactory

    //MP Staking and CommunityIssuance have not yet had their setters called, so are not yet
    // connected to the rest of the system
  })


  describe('CommunityIssuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(moneypAG, storedDeployerAddress)
    })
  })

  describe('MPStaking deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await mpStaking.owner()

      assert.equal(moneypAG, storedDeployerAddress)
    })
  })

  describe('MPToken deployment', async accounts => {
    it("Stores the multisig's address", async () => {
      const storedMultisigAddress = await mpToken.multisigAddress()

      assert.equal(multisig, storedMultisigAddress)
    })

    it("Stores the CommunityIssuance address", async () => {
      const storedCIAddress = await mpToken.communityIssuanceAddress()

      assert.equal(communityIssuance.address, storedCIAddress)
    })

    it("Stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await mpToken.lockupContractFactory()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it("Mints the correct MP amount to the multisig's address: (64.66 million)", async () => {
      const multisigMPEntitlement = await mpToken.balanceOf(multisig)

     const twentyThreeSixes = "6".repeat(23)
      const expectedMultisigEntitlement = "64".concat(twentyThreeSixes).concat("7")
      assert.equal(multisigMPEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct MP amount to the CommunityIssuance contract address: 32 million", async () => {
      const communityMPEntitlement = await mpToken.balanceOf(communityIssuance.address)
      // 32 million as 18-digit decimal
      const _32Million = dec(32, 24)

      assert.equal(communityMPEntitlement, _32Million)
    })

    it("Mints the correct MP amount to the bountyAddress EOA: 2 million", async () => {
      const bountyAddressBal = await mpToken.balanceOf(bountyAddress)
      // 2 million as 18-digit decimal
      const _2Million = dec(2, 24)

      assert.equal(bountyAddressBal, _2Million)
    })

    it("Mints the correct MP amount to the lpRewardsAddress EOA: 1.33 million", async () => {
      const lpRewardsAddressBal = await mpToken.balanceOf(lpRewardsAddress)
      // 1.3 million as 18-digit decimal
      const _1pt33Million = "1".concat("3".repeat(24))

      assert.equal(lpRewardsAddressBal, _1pt33Million)
    })
  })

  describe('Community Issuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {

      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(storedDeployerAddress, moneypAG)
    })

    it("Has a supply cap of 32 million", async () => {
      const supplyCap = await communityIssuance.MPSupplyCap()

      assert.isTrue(expectedCISupplyCap.eq(supplyCap))
    })

    it("Moneyp AG can set addresses if CI's MP balance is equal or greater than 32 million ", async () => {
      const MPBalance = await mpToken.balanceOf(communityIssuance.address)
      assert.isTrue(MPBalance.eq(expectedCISupplyCap))

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployMoneypCore()

      const tx = await communityIssuance.setAddresses(
        mpToken.address,
        coreContracts.stabilityPool.address,
        { from: moneypAG }
      );
      assert.isTrue(tx.receipt.status)
    })

    it("Moneyp AG can't set addresses if CI's MP balance is < 32 million ", async () => {
      const newCI = await CommunityIssuance.new()

      const MPBalance = await mpToken.balanceOf(newCI.address)
      assert.equal(MPBalance, '0')

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployMoneypCore()

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await mpToken.transfer(newCI.address, '31999999999999999999999999', {from: multisig}) // 1e-18 less than CI expects (32 million)

      try {
        const tx = await newCI.setAddresses(
          mpToken.address,
          coreContracts.stabilityPool.address,
          { from: moneypAG }
        );
      
        // Check it gives the expected error message for a failed Solidity 'assert'
      } catch (err) {
        assert.include(err.message, "invalid opcode")
      }
    })
  })

  describe('Connecting MPToken to LCF, CI and MPStaking', async accounts => {
    it('sets the correct MPToken address in MPStaking', async () => {
      // Deploy core contracts and set the MPToken address in the CI and MPStaking
      const coreContracts = await deploymentHelper.deployMoneypCore()
      await deploymentHelper.connectMPContractsToCore(MPContracts, coreContracts)

      const mpTokenAddress = mpToken.address

      const recordedMPTokenAddress = await mpStaking.mpToken()
      assert.equal(mpTokenAddress, recordedMPTokenAddress)
    })

    it('sets the correct MPToken address in LockupContractFactory', async () => {
      const mpTokenAddress = mpToken.address

      const recordedMPTokenAddress = await lockupContractFactory.mpTokenAddress()
      assert.equal(mpTokenAddress, recordedMPTokenAddress)
    })

    it('sets the correct MPToken address in CommunityIssuance', async () => {
      // Deploy core contracts and set the MPToken address in the CI and MPStaking
      const coreContracts = await deploymentHelper.deployMoneypCore()
      await deploymentHelper.connectMPContractsToCore(MPContracts, coreContracts)

      const mpTokenAddress = mpToken.address

      const recordedMPTokenAddress = await communityIssuance.mpToken()
      assert.equal(mpTokenAddress, recordedMPTokenAddress)
    })
  })
})
