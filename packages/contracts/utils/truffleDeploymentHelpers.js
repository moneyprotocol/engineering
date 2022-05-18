
const SortedVaults = artifacts.require("./SortedVaults.sol")
const VaultManager = artifacts.require("./VaultManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const BPDToken = artifacts.require("./BPDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deployLiquity = async () => {
  const priceFeedTestnet = await PriceFeedTestnet.new()
  const sortedVaults = await SortedVaults.new()
  const vaultManager = await VaultManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const bpdToken = await BPDToken.new(
    vaultManager.address,
    stabilityPool.address,
    borrowerOperations.address
  )
  DefaultPool.setAsDeployed(defaultPool)
  PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
  BPDToken.setAsDeployed(bpdToken)
  SortedVaults.setAsDeployed(sortedVaults)
  VaultManager.setAsDeployed(vaultManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)

  const contracts = {
    priceFeedTestnet,
    bpdToken,
    sortedVaults,
    vaultManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations
  }
  return contracts
}

const getAddresses = (contracts) => {
  return {
    BorrowerOperations: contracts.borrowerOperations.address,
    PriceFeedTestnet: contracts.priceFeedTestnet.address,
    BPDToken: contracts.bpdToken.address,
    SortedVaults: contracts.sortedVaults.address,
    VaultManager: contracts.vaultManager.address,
    StabilityPool: contracts.stabilityPool.address,
    ActivePool: contracts.activePool.address,
    DefaultPool: contracts.defaultPool.address,
    FunctionCaller: contracts.functionCaller.address
  }
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, addresses) => {
  // set VaultManager addr in SortedVaults
  await contracts.sortedVaults.setVaultManager(addresses.VaultManager)

  // set contract addresses in the FunctionCaller 
  await contracts.functionCaller.setVaultManagerAddress(addresses.VaultManager)
  await contracts.functionCaller.setSortedVaultsAddress(addresses.SortedVaults)

  // set VaultManager addr in PriceFeed
  await contracts.priceFeedTestnet.setVaultManagerAddress(addresses.VaultManager)

  // set contracts in the Vault Manager
  await contracts.vaultManager.setBPDToken(addresses.BPDToken)
  await contracts.vaultManager.setSortedVaults(addresses.SortedVaults)
  await contracts.vaultManager.setPriceFeed(addresses.PriceFeedTestnet)
  await contracts.vaultManager.setActivePool(addresses.ActivePool)
  await contracts.vaultManager.setDefaultPool(addresses.DefaultPool)
  await contracts.vaultManager.setStabilityPool(addresses.StabilityPool)
  await contracts.vaultManager.setBorrowerOperations(addresses.BorrowerOperations)

  // set contracts in BorrowerOperations 
  await contracts.borrowerOperations.setSortedVaults(addresses.SortedVaults)
  await contracts.borrowerOperations.setPriceFeed(addresses.PriceFeedTestnet)
  await contracts.borrowerOperations.setActivePool(addresses.ActivePool)
  await contracts.borrowerOperations.setDefaultPool(addresses.DefaultPool)
  await contracts.borrowerOperations.setVaultManager(addresses.VaultManager)

  // set contracts in the Pools
  await contracts.stabilityPool.setActivePoolAddress(addresses.ActivePool)
  await contracts.stabilityPool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.activePool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.activePool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.defaultPool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.defaultPool.setActivePoolAddress(addresses.ActivePool)
}

const connectEchidnaProxy = async (echidnaProxy, addresses) => {
  echidnaProxy.setVaultManager(addresses.VaultManager)
  echidnaProxy.setBorrowerOperations(addresses.BorrowerOperations)
}

module.exports = {
  connectEchidnaProxy: connectEchidnaProxy,
  getAddresses: getAddresses,
  deployLiquity: deployLiquity,
  connectContracts: connectContracts
}
