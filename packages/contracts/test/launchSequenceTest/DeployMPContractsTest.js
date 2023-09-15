const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")
const { setNextBlockBaseFeePerGas } = require('@nomicfoundation/hardhat-network-helpers');


const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const assertRevert = th.assertRevert
const toBN = th.toBN
const dec = th.dec

contract('Deploying the MP contracts: LCF, CI, MPStaking, and MPToken ', async accounts => {
  const [moneypAG, A, B] = accounts;
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let MPContracts

  const digits = toBN(1e18)
  const oneHundresSixtySevenMillion = toBN(167705382)
  const expectedCISupplyCap = oneHundresSixtySevenMillion.mul(digits)

  beforeEach(async () => {
    await setNextBlockBaseFeePerGas(0)
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

    it("Mints the correct MP amount to the multisig's address: (314.825309 million)", async () => {
      const multisigMPEntitlement = await mpToken.balanceOf(multisig)

      const eighteenZeroes = "0".repeat(18)
      const expectedMultisigEntitlement = "314825309".concat(eighteenZeroes)

      assert.equal(multisigMPEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct MP amount to the CommunityIssuance contract address: 167.705382 million", async () => {
      const communityMPEntitlement = await mpToken.balanceOf(communityIssuance.address)
      const eighteenZeroes = "0".repeat(18)
      const expectedCommunityMPEntitlement = "167705382".concat(eighteenZeroes)

      assert.equal(communityMPEntitlement, expectedCommunityMPEntitlement)
    })

    it("Mints the correct MP amount to the bountyAddress EOA: 10.481586 million", async () => {
      const bountyAddressBal = await mpToken.balanceOf(bountyAddress)
      const expectedBountyEntitlement = 
        web3.utils.toBN('10481586000000000000000000').add( // bountyEntitlement
          web3.utils.toBN('6987723000000000000000000') // plus _lpRewardsEntitlement
        ).toString()

      assert.equal(bountyAddressBal, expectedBountyEntitlement)
    })

    it("Mints the correct MP amount to the lpRewardsAddress EOA: 0", async () => {
      const lpRewardsAddressBal = await mpToken.balanceOf(lpRewardsAddress)
      const expectedLpRewardsEntitlement = '0';

      assert.equal(lpRewardsAddressBal, expectedLpRewardsEntitlement)
    })
  })

  describe('Community Issuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {

      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(storedDeployerAddress, moneypAG)
    })

    it("Has a supply cap of 167.705382 million", async () => {
      const supplyCap = await communityIssuance.MPSupplyCap()

      assert.isTrue(expectedCISupplyCap.eq(supplyCap))
    })

    it("Moneyp AG can set addresses if CI's MP balance is equal or greater than 167.705382 million ", async () => {
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
