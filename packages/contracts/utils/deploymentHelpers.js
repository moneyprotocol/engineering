const SortedVaults = artifacts.require("./SortedVaults.sol")
const VaultManager = artifacts.require("./VaultManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const BPDToken = artifacts.require("./BPDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")

const MPStaking = artifacts.require("./MPStaking.sol")
const MPToken = artifacts.require("./MPToken.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const Unipool =  artifacts.require("./Unipool.sol")

const MPTokenTester = artifacts.require("./MPTokenTester.sol")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const MoneypMathTester = artifacts.require("./MoneypMathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const VaultManagerTester = artifacts.require("./VaultManagerTester.sol")
const BPDTokenTester = artifacts.require("./BPDTokenTester.sol")

// Proxy scripts
const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const VaultManagerScript = artifacts.require('VaultManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')
const MPStakingScript = artifacts.require('MPStakingScript')
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

/* "Moneyp core" consists of all contracts in the core Moneyp system.

MP contracts consist of only those contracts related to the MP Token:

-the MP token
-the Lockup factory and lockup contracts
-the MPStaking contract
-the CommunityIssuance contract 
*/

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployMoneypCore() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployMoneypCoreHardhat()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployMoneypCoreTruffle()
    }
  }

  static async deployMPContracts(bountyAddress, lpRewardsAddress, multisigAddress) {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployMPContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress)
    } else if (frameworkPath.includes("truffle")) {
      return this.deployMPContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress)
    }
  }

  static async deployMoneypCoreHardhat() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedVaults = await SortedVaults.new()
    const vaultManager = await VaultManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const bpdToken = await BPDToken.new(
      vaultManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    BPDToken.setAsDeployed(bpdToken)
    DefaultPool.setAsDeployed(defaultPool)
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
    SortedVaults.setAsDeployed(sortedVaults)
    VaultManager.setAsDeployed(vaultManager)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    GasPool.setAsDeployed(gasPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)

    const coreContracts = {
      priceFeedTestnet,
      bpdToken,
      sortedVaults,
      vaultManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployTesterContractsHardhat() {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new()
    testerContracts.sortedVaults = await SortedVaults.new()
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.gasPool = await GasPool.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await MoneypMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new()
    testerContracts.vaultManager = await VaultManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.bpdToken =  await BPDTokenTester.new(
      testerContracts.vaultManager.address,
      testerContracts.stabilityPool.address,
      testerContracts.borrowerOperations.address
    )
    return testerContracts
  }

  static async deployMPContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const mpStaking = await MPStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    MPStaking.setAsDeployed(mpStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuance.setAsDeployed(communityIssuance)

    // Deploy MP Token, passing Community Issuance and Factory addresses to the constructor 
    const mpToken = await MPToken.new(
      communityIssuance.address, 
      mpStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    )
    MPToken.setAsDeployed(mpToken)

    const MPContracts = {
      mpStaking,
      lockupContractFactory,
      communityIssuance,
      mpToken
    }
    return MPContracts
  }

  static async deployMPTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const mpStaking = await MPStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuanceTester.new()

    MPStaking.setAsDeployed(mpStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)

    // Deploy MP Token, passing Community Issuance and Factory addresses to the constructor 
    const mpToken = await MPTokenTester.new(
      communityIssuance.address, 
      mpStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    )
    MPTokenTester.setAsDeployed(mpToken)

    const MPContracts = {
      mpStaking,
      lockupContractFactory,
      communityIssuance,
      mpToken
    }
    return MPContracts
  }

  static async deployMoneypCoreTruffle() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedVaults = await SortedVaults.new()
    const vaultManager = await VaultManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const bpdToken = await BPDToken.new(
      vaultManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    const coreContracts = {
      priceFeedTestnet,
      bpdToken,
      sortedVaults,
      vaultManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployMPContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress) {
    const mpStaking = await mpStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    /* Deploy MP Token, passing Community Issuance,  MPStaking, and Factory addresses 
    to the constructor  */
    const mpToken = await MPToken.new(
      communityIssuance.address, 
      mpStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress, 
      multisigAddress
    )

    const MPContracts = {
      mpStaking,
      lockupContractFactory,
      communityIssuance,
      mpToken
    }
    return MPContracts
  }

  static async deployBPDToken(contracts) {
    contracts.bpdToken = await BPDToken.new(
      contracts.vaultManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployBPDTokenTester(contracts) {
    contracts.bpdToken = await BPDTokenTester.new(
      contracts.vaultManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployProxyScripts(contracts, MPContracts, owner, users) {
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.vaultManager.address,
      MPContracts.mpStaking.address
    )
    contracts.borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(contracts.borrowerOperations.address)
    contracts.borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, contracts.borrowerOperations)

    const vaultManagerScript = await VaultManagerScript.new(contracts.vaultManager.address)
    contracts.vaultManager = new VaultManagerProxy(owner, proxies, vaultManagerScript.address, contracts.vaultManager)

    const stabilityPoolScript = await StabilityPoolScript.new(contracts.stabilityPool.address)
    contracts.stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, contracts.stabilityPool)

    contracts.sortedVaults = new SortedVaultsProxy(owner, proxies, contracts.sortedVaults)

    const bpdTokenScript = await TokenScript.new(contracts.bpdToken.address)
    contracts.bpdToken = new TokenProxy(owner, proxies, bpdTokenScript.address, contracts.bpdToken)

    const mpTokenScript = await TokenScript.new(MPContracts.mpToken.address)
    MPContracts.mpToken = new TokenProxy(owner, proxies, mpTokenScript.address, MPContracts.mpToken)

    const mpStakingScript = await MPStakingScript.new(MPContracts.mpStaking.address)
    MPContracts.mpStaking = new MPStakingProxy(owner, proxies, mpStakingScript.address, MPContracts.mpStaking)
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, MPContracts) {

    // set VaultManager addr in SortedVaults
    await contracts.sortedVaults.setParams(
      maxBytes32,
      contracts.vaultManager.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setVaultManagerAddress(contracts.vaultManager.address)
    await contracts.functionCaller.setSortedVaultsAddress(contracts.sortedVaults.address)

    // set contracts in the Vault Manager
    await contracts.vaultManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.bpdToken.address,
      contracts.sortedVaults.address,
      MPContracts.mpToken.address,
      MPContracts.mpStaking.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.vaultManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.sortedVaults.address,
      contracts.bpdToken.address,
      MPContracts.mpStaking.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.vaultManager.address,
      contracts.activePool.address,
      contracts.bpdToken.address,
      contracts.sortedVaults.address,
      contracts.priceFeedTestnet.address,
      MPContracts.communityIssuance.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.vaultManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.vaultManager.address,
      contracts.activePool.address,
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.vaultManager.address,
      contracts.activePool.address,
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedVaults.address,
      contracts.vaultManager.address
    )
  }

  static async connectMPContracts(MPContracts) {
    // Set MPToken address in LCF
    await MPContracts.lockupContractFactory.setMPTokenAddress(MPContracts.mpToken.address)
  }

  static async connectMPContractsToCore(MPContracts, coreContracts) {
    await MPContracts.mpStaking.setAddresses(
      MPContracts.mpToken.address,
      coreContracts.bpdToken.address,
      coreContracts.vaultManager.address, 
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address
    )
  
    await MPContracts.communityIssuance.setAddresses(
      MPContracts.mpToken.address,
      coreContracts.stabilityPool.address
    )
  }

  static async connectUnipool(uniPool, MPContracts, uniswapPairAddr, duration) {
    await uniPool.setParams(MPContracts.mpToken.address, uniswapPairAddr, duration)
  }
}
module.exports = DeploymentHelper
