// Buidler-Truffle fixture for deployment to Buidler EVM

const SortedVaults = artifacts.require("./SortedVaults.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const StabilityPool = artifacts.require("./StabilityPool.sol")
const VaultManager = artifacts.require("./VaultManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const BPDToken = artifacts.require("./BPDToken.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deploymentHelpers = require("../utils/deploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

module.exports = async () => {
  const borrowerOperations = await BorrowerOperations.new()
  const priceFeed = await PriceFeed.new()
  const sortedVaults = await SortedVaults.new()
  const vaultManager = await VaultManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const bpdToken = await BPDToken.new(
    vaultManager.address,
    stabilityPool.address,
    borrowerOperations.address
  )
  BorrowerOperations.setAsDeployed(borrowerOperations)
  PriceFeed.setAsDeployed(priceFeed)
  SortedVaults.setAsDeployed(sortedVaults)
  VaultManager.setAsDeployed(vaultManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  DefaultPool.setAsDeployed(defaultPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BPDToken.setAsDeployed(bpdToken)

  const contracts = {
    borrowerOperations,
    priceFeed,
    bpdToken,
    sortedVaults,
    vaultManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller
  }

  // Grab contract addresses
  const addresses = getAddresses(contracts)
  console.log('deploy_contracts.js - Deployhed contract addresses: \n')
  console.log(addresses)
  console.log('\n')

  // Connect contracts to each other via the NameRegistry records
  await connectContracts(contracts, addresses)
}
