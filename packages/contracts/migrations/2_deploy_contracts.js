// Truffle migration script for deployment to Ganache

const SortedVaults = artifacts.require("./SortedVaults.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const StabilityPool = artifacts.require("./StabilityPool.sol")
const VaultManager = artifacts.require("./VaultManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const BPDToken = artifacts.require("./BPDToken.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

module.exports = function(deployer) {
  deployer.deploy(BorrowerOperations)
  deployer.deploy(PriceFeed)
  deployer.deploy(SortedVaults)
  deployer.deploy(VaultManager)
  deployer.deploy(ActivePool)
  deployer.deploy(StabilityPool)
  deployer.deploy(DefaultPool)
  deployer.deploy(BPDToken)
  deployer.deploy(FunctionCaller)

  deployer.then(async () => {
    const borrowerOperations = await BorrowerOperations.deployed()
    const priceFeed = await PriceFeed.deployed()
    const sortedVaults = await SortedVaults.deployed()
    const vaultManager = await VaultManager.deployed()
    const activePool = await ActivePool.deployed()
    const stabilityPool = await StabilityPool.deployed()
    const defaultPool = await DefaultPool.deployed()
    const bpdToken = await BPDToken.deployed()
    const functionCaller = await FunctionCaller.deployed()

    const moneypContracts = {
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
    const moneypAddresses = getAddresses(moneypContracts)
    console.log('deploy_contracts.js - Deployed contract addresses: \n')
    console.log(moneypAddresses)
    console.log('\n')

    // Connect contracts to each other
    await connectContracts(moneypContracts, moneypAddresses)
  })
}
