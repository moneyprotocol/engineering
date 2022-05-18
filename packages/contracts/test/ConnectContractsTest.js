const deploymentHelper = require("../utils/deploymentHelpers.js")

contract('Deployment script - Sets correct contract addresses dependencies after deployment', async accounts => {
  const [owner] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  let priceFeed
  let bpdToken
  let sortedVaults
  let vaultManager
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let mpStaking
  let mpToken
  let communityIssuance
  let lockupContractFactory

  before(async () => {
    const coreContracts = await deploymentHelper.deployMoneypCore()
    const MPContracts = await deploymentHelper.deployMPContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeed = coreContracts.priceFeedTestnet
    bpdToken = coreContracts.bpdToken
    sortedVaults = coreContracts.sortedVaults
    vaultManager = coreContracts.vaultManager
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    mpStaking = MPContracts.mpStaking
    mpToken = MPContracts.mpToken
    communityIssuance = MPContracts.communityIssuance
    lockupContractFactory = MPContracts.lockupContractFactory

    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, coreContracts)
  })

  it('Sets the correct PriceFeed address in VaultManager', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await vaultManager.priceFeed()

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('Sets the correct BPDToken address in VaultManager', async () => {
    const bpdTokenAddress = bpdToken.address

    const recordedClvTokenAddress = await vaultManager.bpdToken()

    assert.equal(bpdTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct SortedVaults address in VaultManager', async () => {
    const sortedVaultsAddress = sortedVaults.address

    const recordedSortedVaultsAddress = await vaultManager.sortedVaults()

    assert.equal(sortedVaultsAddress, recordedSortedVaultsAddress)
  })

  it('Sets the correct BorrowerOperations address in VaultManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await vaultManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ActivePool in VaultM
  it('Sets the correct ActivePool address in VaultManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await vaultManager.activePool()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })

  // DefaultPool in VaultM
  it('Sets the correct DefaultPool address in VaultManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await vaultManager.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })

  // StabilityPool in VaultM
  it('Sets the correct StabilityPool address in VaultManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await vaultManager.stabilityPool()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })

  // MP Staking in VaultM
  it('Sets the correct MPStaking address in VaultManager', async () => {
    const mpStakingAddress = mpStaking.address

    const recordedMPStakingAddress = await vaultManager.mpStaking()
    assert.equal(mpStakingAddress, recordedMPStakingAddress)
  })

  // Active Pool

  it('Sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('Sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('Sets the correct BorrowerOperations address in ActivePool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct VaultManager address in ActivePool', async () => {
    const vaultManagerAddress = vaultManager.address

    const recordedVaultManagerAddress = await activePool.vaultManagerAddress()
    assert.equal(vaultManagerAddress, recordedVaultManagerAddress)
  })

  // Stability Pool

  it('Sets the correct ActivePool address in StabilityPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await stabilityPool.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct BorrowerOperations address in StabilityPool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BPDToken address in StabilityPool', async () => {
    const bpdTokenAddress = bpdToken.address

    const recordedClvTokenAddress = await stabilityPool.bpdToken()

    assert.equal(bpdTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct VaultManager address in StabilityPool', async () => {
    const vaultManagerAddress = vaultManager.address

    const recordedVaultManagerAddress = await stabilityPool.vaultManager()
    assert.equal(vaultManagerAddress, recordedVaultManagerAddress)
  })

  // Default Pool

  it('Sets the correct VaultManager address in DefaultPool', async () => {
    const vaultManagerAddress = vaultManager.address

    const recordedVaultManagerAddress = await defaultPool.vaultManagerAddress()
    assert.equal(vaultManagerAddress, recordedVaultManagerAddress)
  })

  it('Sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct VaultManager address in SortedVaults', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedVaults.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BorrowerOperations address in SortedVaults', async () => {
    const vaultManagerAddress = vaultManager.address

    const recordedVaultManagerAddress = await sortedVaults.vaultManager()
    assert.equal(vaultManagerAddress, recordedVaultManagerAddress)
  })

  //--- BorrowerOperations ---

  // VaultManager in BO
  it('Sets the correct VaultManager address in BorrowerOperations', async () => {
    const vaultManagerAddress = vaultManager.address

    const recordedVaultManagerAddress = await borrowerOperations.vaultManager()
    assert.equal(vaultManagerAddress, recordedVaultManagerAddress)
  })

  // setPriceFeed in BO
  it('Sets the correct PriceFeed address in BorrowerOperations', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await borrowerOperations.priceFeed()
    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  // setSortedVaults in BO
  it('Sets the correct SortedVaults address in BorrowerOperations', async () => {
    const sortedVaultsAddress = sortedVaults.address

    const recordedSortedVaultsAddress = await borrowerOperations.sortedVaults()
    assert.equal(sortedVaultsAddress, recordedSortedVaultsAddress)
  })

  // setActivePool in BO
  it('Sets the correct ActivePool address in BorrowerOperations', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await borrowerOperations.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // setDefaultPool in BO
  it('Sets the correct DefaultPool address in BorrowerOperations', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await borrowerOperations.defaultPool()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  // MP Staking in BO
  it('Sets the correct MPStaking address in BorrowerOperations', async () => {
    const mpStakingAddress = mpStaking.address

    const recordedMPStakingAddress = await borrowerOperations.mpStakingAddress()
    assert.equal(mpStakingAddress, recordedMPStakingAddress)
  })


  // --- MP Staking ---

  // Sets MPToken in MPStaking
  it('Sets the correct MPToken address in MPStaking', async () => {
    const mpTokenAddress = mpToken.address

    const recordedMPTokenAddress = await mpStaking.mpToken()
    assert.equal(mpTokenAddress, recordedMPTokenAddress)
  })

  // Sets ActivePool in MPStaking
  it('Sets the correct ActivePool address in MPStaking', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await mpStaking.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // Sets BPDToken in MPStaking
  it('Sets the correct ActivePool address in MPStaking', async () => {
    const bpdTokenAddress = bpdToken.address

    const recordedBPDTokenAddress = await mpStaking.bpdToken()
    assert.equal(bpdTokenAddress, recordedBPDTokenAddress)
  })

  // Sets VaultManager in MPStaking
  it('Sets the correct ActivePool address in MPStaking', async () => {
    const vaultManagerAddress = vaultManager.address

    const recordedVaultManagerAddress = await mpStaking.vaultManagerAddress()
    assert.equal(vaultManagerAddress, recordedVaultManagerAddress)
  })

  // Sets BorrowerOperations in MPStaking
  it('Sets the correct BorrowerOperations address in MPStaking', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await mpStaking.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ---  MPToken ---

  // Sets CI in MPToken
  it('Sets the correct CommunityIssuance address in MPToken', async () => {
    const communityIssuanceAddress = communityIssuance.address

    const recordedcommunityIssuanceAddress = await mpToken.communityIssuanceAddress()
    assert.equal(communityIssuanceAddress, recordedcommunityIssuanceAddress)
  })

  // Sets MPStaking in MPToken
  it('Sets the correct MPStaking address in MPToken', async () => {
    const mpStakingAddress = mpStaking.address

    const recordedMPStakingAddress =  await mpToken.mpStakingAddress()
    assert.equal(mpStakingAddress, recordedMPStakingAddress)
  })

  // Sets LCF in MPToken
  it('Sets the correct LockupContractFactory address in MPToken', async () => {
    const LCFAddress = lockupContractFactory.address

    const recordedLCFAddress =  await mpToken.lockupContractFactory()
    assert.equal(LCFAddress, recordedLCFAddress)
  })

  // --- LCF  ---

  // Sets MPToken in LockupContractFactory
  it('Sets the correct MPToken address in LockupContractFactory', async () => {
    const mpTokenAddress = mpToken.address

    const recordedMPTokenAddress = await lockupContractFactory.mpTokenAddress()
    assert.equal(mpTokenAddress, recordedMPTokenAddress)
  })

  // --- CI ---

  // Sets MPToken in CommunityIssuance
  it('Sets the correct MPToken address in CommunityIssuance', async () => {
    const mpTokenAddress = mpToken.address

    const recordedMPTokenAddress = await communityIssuance.mpToken()
    assert.equal(mpTokenAddress, recordedMPTokenAddress)
  })

  it('Sets the correct StabilityPool address in CommunityIssuance', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await communityIssuance.stabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })
})
