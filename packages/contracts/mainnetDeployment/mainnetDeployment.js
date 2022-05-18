const { UniswapV2Factory } = require("./ABIs/UniswapV2Factory.js")
const { UniswapV2Pair } = require("./ABIs/UniswapV2Pair.js")
const { UniswapV2Router02 } = require("./ABIs/UniswapV2Router02.js")
const { ChainlinkAggregatorV3Interface } = require("./ABIs/ChainlinkAggregatorV3Interface.js")
const { TestHelper: th, TimeValues: timeVals } = require("../utils/testHelpers.js")
const { dec } = th
const MainnetDeploymentHelper = require("../utils/mainnetDeploymentHelpers.js")
const toBigNum = ethers.BigNumber.from

async function mainnetDeploy(configParams) {
  const date = new Date()
  console.log(date.toUTCString())
  const deployerWallet = (await ethers.getSigners())[0]
  const account2Wallet = (await ethers.getSigners())[1]
  const mdh = new MainnetDeploymentHelper(configParams, deployerWallet)
  const gasPrice = configParams.GAS_PRICE

  const deploymentState = mdh.loadPreviousDeployment()

  console.log(`deployer address: ${deployerWallet.address}`)
  assert.equal(deployerWallet.address, configParams.liquityAddrs.DEPLOYER)
  assert.equal(account2Wallet.address, configParams.beneficiaries.ACCOUNT_2)
  let deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
  console.log(`deployerETHBalance before: ${deployerETHBalance}`)

  // Get UniswaV2Factory instance at its deployed address
  const uniswapV2Factory = new ethers.Contract(
    configParams.externalAddrs.UNISWAP_V2_FACTORY,
    UniswapV2Factory.abi,
    deployerWallet
  )

  console.log(`Uniswp addr: ${uniswapV2Factory.address}`)
  const uniAllPairsLength = await uniswapV2Factory.allPairsLength()
  console.log(`Uniswap Factory number of pairs: ${uniAllPairsLength}`)

  deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
  console.log(`deployer's RBTC balance before deployments: ${deployerETHBalance}`)

  // Deploy core logic contracts
  const liquityCore = await mdh.deployLiquityCoreMainnet(configParams.externalAddrs.TELLOR_MASTER, deploymentState)
  await mdh.logContractObjects(liquityCore)

  // Check Uniswap Pair BPD-RBTC pair before pair creation
  let BPDWETHPairAddr = await uniswapV2Factory.getPair(liquityCore.bpdToken.address, configParams.externalAddrs.ETH_ERC20)
  let WETHBPDPairAddr = await uniswapV2Factory.getPair(configParams.externalAddrs.ETH_ERC20, liquityCore.bpdToken.address)
  assert.equal(BPDWETHPairAddr, WETHBPDPairAddr)


  if (BPDWETHPairAddr == th.ZERO_ADDRESS) {
    // Deploy Unipool for BPD-WETH
    await mdh.sendAndWaitForTransaction(uniswapV2Factory.createPair(
      configParams.externalAddrs.ETH_ERC20,
      liquityCore.bpdToken.address,
      { gasPrice }
    ))

    // Check Uniswap Pair BPD-WETH pair after pair creation (forwards and backwards should have same address)
    BPDWETHPairAddr = await uniswapV2Factory.getPair(liquityCore.bpdToken.address, configParams.externalAddrs.ETH_ERC20)
    assert.notEqual(BPDWETHPairAddr, th.ZERO_ADDRESS)
    WETHBPDPairAddr = await uniswapV2Factory.getPair(configParams.externalAddrs.ETH_ERC20, liquityCore.bpdToken.address)
    console.log(`BPD-WETH pair contract address after Uniswap pair creation: ${BPDWETHPairAddr}`)
    assert.equal(WETHBPDPairAddr, BPDWETHPairAddr)
  }

  // Deploy Unipool
  const unipool = await mdh.deployUnipoolMainnet(deploymentState)

  // Deploy MP Contracts
  const MPContracts = await mdh.deployMPContractsMainnet(
    configParams.liquityAddrs.GENERAL_SAFE, // bounty address
    unipool.address,  // lp rewards address
    configParams.liquityAddrs.MP_SAFE, // multisig MP endowment address
    deploymentState,
  )

  // Connect all core contracts up
  await mdh.connectCoreContractsMainnet(liquityCore, MPContracts, configParams.externalAddrs.CHAINLINK_ETHUSD_PROXY)
  await mdh.connectMPContractsMainnet(MPContracts)
  await mdh.connectMPContractsToCoreMainnet(MPContracts, liquityCore)

  // Deploy a read-only multi-vault getter
  const multiVaultGetter = await mdh.deployMultiVaultGetterMainnet(liquityCore, deploymentState)

  // Connect Unipool to MPToken and the BPD-WETH pair address, with a 6 week duration
  const LPRewardsDuration = timeVals.SECONDS_IN_SIX_WEEKS
  await mdh.connectUnipoolMainnet(unipool, MPContracts, BPDWETHPairAddr, LPRewardsDuration)

  // Log MP and Unipool addresses
  await mdh.logContractObjects(MPContracts)
  console.log(`Unipool address: ${unipool.address}`)

  let latestBlock = await ethers.provider.getBlockNumber()
  let now = (await ethers.provider.getBlock(latestBlock)).timestamp

  console.log(`time now: ${now}`)
  const oneYearFromNow = (now + timeVals.SECONDS_IN_ONE_YEAR).toString()
  console.log(`time oneYearFromNow: ${oneYearFromNow}`)

  // Deploy LockupContracts - one for each beneficiary
  const lockupContracts = {}

  for (const [investor, investorAddr] of Object.entries(configParams.beneficiaries)) {
    const lockupContractEthersFactory = await ethers.getContractFactory("LockupContract", deployerWallet)
    if (deploymentState[investor] && deploymentState[investor].address) {
      console.log(`Using previously deployed ${investor} lockup contract at address ${deploymentState[investor].address}`)
      lockupContracts[investor] = new ethers.Contract(
        deploymentState[investor].address,
        lockupContractEthersFactory.interface,
        deployerWallet
      )
    } else {
      const txReceipt = await mdh.sendAndWaitForTransaction(MPContracts.lockupContractFactory.deployLockupContract(investorAddr, oneYearFromNow, { gasPrice }))

      const address = await txReceipt.logs[0].address // The deployment event emitted from the LC itself is is the first of two events, so this is its address 
      lockupContracts[investor] = new ethers.Contract(
        address,
        lockupContractEthersFactory.interface,
        deployerWallet
      )

      deploymentState[investor] = {
        address: address,
        txHash: txReceipt.transactionHash
      }

      mdh.saveDeployment(deploymentState)
    }

    // verify
    if (configParams.ETHERSCAN_BASE_URL) {
      await mdh.verifyContract(investor, deploymentState)
    }
  }

  // // --- TESTS AND CHECKS  ---

  // Check chainlink proxy price ---

  const chainlinkProxy = new ethers.Contract(
    configParams.externalAddrs.CHAINLINK_ETHUSD_PROXY,
    ChainlinkAggregatorV3Interface,
    deployerWallet
  )

  // Get latest price
  let chainlinkPrice = await chainlinkProxy.latestAnswer()
  console.log(`current Chainlink price: ${chainlinkPrice}`)

  // // TODO: Check Tellor price directly (through TellorCaller)
  let tellorPriceResponse = await liquityCore.tellorCaller.getTellorCurrentValue(1) // id == 1: the RBTC-USD request ID
  console.log(`current Tellor price: ${tellorPriceResponse[1]}`)
  console.log(`current Tellor timestamp: ${tellorPriceResponse[2]}`)

  // --- Lockup Contracts ---
  console.log("LOCKUP CONTRACT CHECKS")
  // Check lockup contracts exist for each beneficiary with correct unlock time
  for (investor of Object.keys(lockupContracts)) {
    const lockupContract = lockupContracts[investor]
    const onChainBeneficiary = await lockupContract.beneficiary()
    const unlockTime = await lockupContract.unlockTime()

    console.log(
      `lockupContract addr: ${th.squeezeAddr(lockupContract.address)},
            beneficiary: ${investor},
            beneficiary addr: ${th.squeezeAddr(configParams.beneficiaries[investor])},
            on-chain beneficiary addr: ${th.squeezeAddr(onChainBeneficiary)}
            unlockTime: ${unlockTime}
            `
    )
  }

  // --- Check correct addresses set in MPToken
  console.log("STORED ADDRESSES IN MP TOKEN")
  const storedMultisigAddress = await MPContracts.mpToken.multisigAddress()
  assert.equal(configParams.liquityAddrs.MP_SAFE.toLowerCase(), storedMultisigAddress.toLowerCase())
  console.log(`multi-sig address stored in MPToken : ${th.squeezeAddr(storedMultisigAddress)}`)
  console.log(`MP Safe address: ${th.squeezeAddr(configParams.liquityAddrs.MP_SAFE)}`)

  // --- MP allowances of different addresses ---
  console.log("INITIAL MP BALANCES")
  // Unipool
  const unipoolMPBal = await MPContracts.mpToken.balanceOf(unipool.address)
  // TODO: Uncomment for real launch assert.equal(unipoolMPBal.toString(), '1333333333333333333333333')
  th.logBN('Unipool MP balance       ', unipoolMPBal)

  // MP Safe
  const mpSafeBal = await MPContracts.mpToken.balanceOf(configParams.liquityAddrs.MP_SAFE)
   // TODO: Uncomment for real launch  assert.equal(mpDeployerBal.toString(), '64666666666666666666666667')
  th.logBN('MP Safe balance     ', mpSafeBal)

  // Bounties/hackathons (General Safe)
  const generalSafeBal = await MPContracts.mpToken.balanceOf(configParams.liquityAddrs.GENERAL_SAFE)
   // TODO: Uncomment for real launch  assert.equal(generalSafeBal.toString(), '2000000000000000000000000')
  th.logBN('General Safe balance       ', generalSafeBal)

  // CommunityIssuance contract
  const communityIssuanceBal = await MPContracts.mpToken.balanceOf(MPContracts.communityIssuance.address)
  // TODO: Uncomment for real launch  assert.equal(communityIssuanceBal.toString(), '32000000000000000000000000')
  th.logBN('Community Issuance balance', communityIssuanceBal)

  // --- PriceFeed ---
  console.log("PRICEFEED CHECKS")
  // Check Pricefeed's status and last good price
  const lastGoodPrice = await liquityCore.priceFeed.lastGoodPrice()
  const priceFeedInitialStatus = await liquityCore.priceFeed.status()
  th.logBN('PriceFeed first stored price', lastGoodPrice)
  console.log(`PriceFeed initial status: ${priceFeedInitialStatus}`)

  // Check PriceFeed's & TellorCaller's stored addresses
  const priceFeedCLAddress = await liquityCore.priceFeed.priceAggregator()
  const priceFeedTellorCallerAddress = await liquityCore.priceFeed.tellorCaller()
  assert.equal(priceFeedCLAddress, configParams.externalAddrs.CHAINLINK_ETHUSD_PROXY)
  assert.equal(priceFeedTellorCallerAddress, liquityCore.tellorCaller.address)

  // Check Tellor address
  const tellorCallerTellorMasterAddress = await liquityCore.tellorCaller.tellor()
  assert.equal(tellorCallerTellorMasterAddress, configParams.externalAddrs.TELLOR_MASTER)

  // --- Unipool ---

  // Check Unipool's BPD-RBTC Uniswap Pair address
  const unipoolUniswapPairAddr = await unipool.uniToken()
  console.log(`Unipool's stored BPD-RBTC Uniswap Pair address: ${unipoolUniswapPairAddr}`)

  console.log("SYSTEM GLOBAL VARS CHECKS")
  // --- Sorted Vaults ---

  // Check max size
  const sortedVaultsMaxSize = (await liquityCore.sortedVaults.data())[2]
  assert.equal(sortedVaultsMaxSize, '115792089237316195423570985008687907853269984665640564039457584007913129639935')

  // --- VaultManager ---

  const liqReserve = await liquityCore.vaultManager.BPD_GAS_COMPENSATION()
  const minNetDebt = await liquityCore.vaultManager.MIN_NET_DEBT()

  th.logBN('system liquidation reserve', liqReserve)
  th.logBN('system min net debt      ', minNetDebt)

  // --- Make first BPD-RBTC liquidity provision ---

  // Open vault if not yet opened
  const vaultStatus = await liquityCore.vaultManager.getVaultStatus(deployerWallet.address)
  if (vaultStatus.toString() != '1') {
    let _3kBPDWithdrawal = th.dec(3000, 18) // 3000 BPD
    let _3ETHcoll = th.dec(3, 'ether') // 3 RBTC
    console.log('Opening vault...')
    await mdh.sendAndWaitForTransaction(
      liquityCore.borrowerOperations.openVault(
        th._100pct,
        _3kBPDWithdrawal,
        th.ZERO_ADDRESS,
        th.ZERO_ADDRESS,
        { value: _3ETHcoll, gasPrice }
      )
    )
  } else {
    console.log('Deployer already has an active vault')
  }

  // Check deployer now has an open vault
  console.log(`deployer is in sorted list after making vault: ${await liquityCore.sortedVaults.contains(deployerWallet.address)}`)

  const deployerVault = await liquityCore.vaultManager.Vaults(deployerWallet.address)
  th.logBN('deployer debt', deployerVault[0])
  th.logBN('deployer coll', deployerVault[1])
  th.logBN('deployer stake', deployerVault[2])
  console.log(`deployer's vault status: ${deployerVault[3]}`)

  // Check deployer has BPD
  let deployerBPDBal = await liquityCore.bpdToken.balanceOf(deployerWallet.address)
  th.logBN("deployer's BPD balance", deployerBPDBal)

  // Check Uniswap pool has BPD and WETH tokens
  const BPDETHPair = await new ethers.Contract(
    BPDWETHPairAddr,
    UniswapV2Pair.abi,
    deployerWallet
  )

  const token0Addr = await BPDETHPair.token0()
  const token1Addr = await BPDETHPair.token1()
  console.log(`BPD-RBTC Pair token 0: ${th.squeezeAddr(token0Addr)},
        BPDToken contract addr: ${th.squeezeAddr(liquityCore.bpdToken.address)}`)
  console.log(`BPD-RBTC Pair token 1: ${th.squeezeAddr(token1Addr)},
        WETH ERC20 contract addr: ${th.squeezeAddr(configParams.externalAddrs.ETH_ERC20)}`)

  // Check initial BPD-RBTC pair reserves before provision
  let reserves = await BPDETHPair.getReserves()
  th.logBN("BPD-RBTC Pair's BPD reserves before provision", reserves[0])
  th.logBN("BPD-RBTC Pair's RBTC reserves before provision", reserves[1])

  // Get the UniswapV2Router contract
  const uniswapV2Router02 = new ethers.Contract(
    configParams.externalAddrs.UNIWAP_V2_ROUTER02,
    UniswapV2Router02.abi,
    deployerWallet
  )

  // --- Provide liquidity to BPD-RBTC pair if not yet done so ---
  let deployerLPTokenBal = await BPDETHPair.balanceOf(deployerWallet.address)
  if (deployerLPTokenBal.toString() == '0') {
    console.log('Providing liquidity to Uniswap...')
    // Give router an allowance for BPD
    await liquityCore.bpdToken.increaseAllowance(uniswapV2Router02.address, dec(10000, 18))

    // Check Router's spending allowance
    const routerBPDAllowanceFromDeployer = await liquityCore.bpdToken.allowance(deployerWallet.address, uniswapV2Router02.address)
    th.logBN("router's spending allowance for deployer's BPD", routerBPDAllowanceFromDeployer)

    // Get amounts for liquidity provision
    const LP_ETH = dec(1, 'ether')

    // Convert 8-digit CL price to 18 and multiply by RBTC amount
    const BPDAmount = toBigNum(price)
      .mul(toBigNum(dec(1, 10)))
      .mul(toBigNum(LP_ETH))
      .div(toBigNum(dec(1, 18)))

    const minBPDAmount = BPDAmount.sub(toBigNum(dec(100, 18)))

    latestBlock = await ethers.provider.getBlockNumber()
    now = (await ethers.provider.getBlock(latestBlock)).timestamp
    let tenMinsFromNow = now + (60 * 60 * 10)

    // Provide liquidity to BPD-RBTC pair
    await mdh.sendAndWaitForTransaction(
      uniswapV2Router02.addLiquidityETH(
        liquityCore.bpdToken.address, // address of BPD token
        BPDAmount, // BPD provision
        minBPDAmount, // minimum BPD provision
        LP_ETH, // minimum RBTC provision
        deployerWallet.address, // address to send LP tokens to
        tenMinsFromNow, // deadline for this tx
        {
          value: dec(1, 'ether'),
          gasPrice,
          gasLimit: 5000000 // For some reason, ethers can't estimate gas for this tx
        }
      )
    )
  } else {
    console.log('Liquidity already provided to Uniswap')
  }
  // Check BPD-RBTC reserves after liquidity provision:
  reserves = await BPDETHPair.getReserves()
  th.logBN("BPD-RBTC Pair's BPD reserves after provision", reserves[0])
  th.logBN("BPD-RBTC Pair's RBTC reserves after provision", reserves[1])



  // ---  Check LP staking  ---
  console.log("CHECK LP STAKING EARNS MP")

  // Check deployer's LP tokens
  deployerLPTokenBal = await BPDETHPair.balanceOf(deployerWallet.address)
  th.logBN("deployer's LP token balance", deployerLPTokenBal)

  // Stake LP tokens in Unipool
  console.log(`BPDETHPair addr: ${BPDETHPair.address}`)
  console.log(`Pair addr stored in Unipool: ${await unipool.uniToken()}`)

  earnedMP = await unipool.earned(deployerWallet.address)
  th.logBN("deployer's farmed MP before staking LP tokens", earnedMP)

  const deployerUnipoolStake = await unipool.balanceOf(deployerWallet.address)
  if (deployerUnipoolStake.toString() == '0') {
    console.log('Staking to Unipool...')
    // Deployer approves Unipool
    await mdh.sendAndWaitForTransaction(
      BPDETHPair.approve(unipool.address, deployerLPTokenBal, { gasPrice })
    )

    await mdh.sendAndWaitForTransaction(unipool.stake(1, { gasPrice }))
  } else {
    console.log('Already staked in Unipool')
  }

  console.log("wait 90 seconds before checking earnings... ")
  await configParams.waitFunction()

  earnedMP = await unipool.earned(deployerWallet.address)
  th.logBN("deployer's farmed MP from Unipool after waiting ~1.5mins", earnedMP)

  let deployerMPBal = await MPContracts.mpToken.balanceOf(deployerWallet.address)
  th.logBN("deployer MP Balance Before SP deposit", deployerMPBal)



  // --- Make SP deposit and earn MP ---
  console.log("CHECK DEPLOYER MAKING DEPOSIT AND EARNING MP")

  let SPDeposit = await liquityCore.stabilityPool.getCompoundedBPDDeposit(deployerWallet.address)
  th.logBN("deployer SP deposit before making deposit", SPDeposit)

  // Provide to SP
  await mdh.sendAndWaitForTransaction(liquityCore.stabilityPool.provideToSP(dec(15, 18), th.ZERO_ADDRESS, { gasPrice, gasLimit: 400000 }))

  // Get SP deposit 
  SPDeposit = await liquityCore.stabilityPool.getCompoundedBPDDeposit(deployerWallet.address)
  th.logBN("deployer SP deposit after depositing 15 BPD", SPDeposit)

  console.log("wait 90 seconds before withdrawing...")
  // wait 90 seconds
  await configParams.waitFunction()

  // Withdraw from SP
  await mdh.sendAndWaitForTransaction(liquityCore.stabilityPool.withdrawFromSP(dec(1000, 18), { gasPrice, gasLimit: 400000 }))

  SPDeposit = await liquityCore.stabilityPool.getCompoundedBPDDeposit(deployerWallet.address)
  th.logBN("deployer SP deposit after full withdrawal", SPDeposit)

  deployerMPBal = await MPContracts.mpToken.balanceOf(deployerWallet.address)
  th.logBN("deployer MP Balance after SP deposit withdrawal", deployerMPBal)



  // ---  Attempt withdrawal from LC  ---
  console.log("CHECK BENEFICIARY ATTEMPTING WITHDRAWAL FROM LC")

  // connect Acct2 wallet to the LC they are beneficiary of
  let account2LockupContract = await lockupContracts["ACCOUNT_2"].connect(account2Wallet)

  // Deployer funds LC with 10 MP
  await mdh.sendAndWaitForTransaction(MPContracts.mpToken.transfer(account2LockupContract.address, dec(10, 18), { gasPrice }))

  // account2 MP bal
  let account2bal = await MPContracts.mpToken.balanceOf(account2Wallet.address)
  th.logBN("account2 MP bal before withdrawal attempt", account2bal)

  // Check LC MP bal 
  let account2LockupContractBal = await MPContracts.mpToken.balanceOf(account2LockupContract.address)
  th.logBN("account2's LC MP bal before withdrawal attempt", account2LockupContractBal)

  // Acct2 attempts withdrawal from  LC
  await mdh.sendAndWaitForTransaction(account2LockupContract.withdrawMP({ gasPrice, gasLimit: 1000000 }))

  // Acct MP bal
  account2bal = await MPContracts.mpToken.balanceOf(account2Wallet.address)
  th.logBN("account2's MP bal after LC withdrawal attempt", account2bal)

  // Check LC bal 
  account2LockupContractBal = await MPContracts.mpToken.balanceOf(account2LockupContract.address)
  th.logBN("account2's LC MP bal LC withdrawal attempt", account2LockupContractBal)

  // --- Stake MP ---
  console.log("CHECK DEPLOYER STAKING MP")

  // Log deployer MP bal and stake before staking
  deployerMPBal = await MPContracts.mpToken.balanceOf(deployerWallet.address)
  th.logBN("deployer MP bal before staking", deployerMPBal)
  let deployerMPStake = await MPContracts.mpStaking.stakes(deployerWallet.address)
  th.logBN("deployer stake before staking", deployerMPStake)

  // stake 13 MP
  await mdh.sendAndWaitForTransaction(MPContracts.mpStaking.stake(dec(13, 18), { gasPrice, gasLimit: 1000000 }))

  // Log deployer MP bal and stake after staking
  deployerMPBal = await MPContracts.mpToken.balanceOf(deployerWallet.address)
  th.logBN("deployer MP bal after staking", deployerMPBal)
  deployerMPStake = await MPContracts.mpStaking.stakes(deployerWallet.address)
  th.logBN("deployer stake after staking", deployerMPStake)

  // Log deployer rev share immediately after staking
  let deployerBPDRevShare = await MPContracts.mpStaking.getPendingBPDGain(deployerWallet.address)
  th.logBN("deployer pending BPD revenue share", deployerBPDRevShare)



  // --- 2nd Account opens vault ---
  const vault2Status = await liquityCore.vaultManager.getVaultStatus(account2Wallet.address)
  if (vault2Status.toString() != '1') {
    console.log("Acct 2 opens a vault ...")
    let _2kBPDWithdrawal = th.dec(2000, 18) // 2000 BPD
    let _1pt5_ETHcoll = th.dec(15, 17) // 1.5 RBTC
    const borrowerOpsEthersFactory = await ethers.getContractFactory("BorrowerOperations", account2Wallet)
    const borrowerOpsAcct2 = await new ethers.Contract(liquityCore.borrowerOperations.address, borrowerOpsEthersFactory.interface, account2Wallet)

    await mdh.sendAndWaitForTransaction(borrowerOpsAcct2.openVault(th._100pct, _2kBPDWithdrawal, th.ZERO_ADDRESS, th.ZERO_ADDRESS, { value: _1pt5_ETHcoll, gasPrice, gasLimit: 1000000 }))
  } else {
    console.log('Acct 2 already has an active vault')
  }

  const acct2Vault = await liquityCore.vaultManager.Vaults(account2Wallet.address)
  th.logBN('acct2 debt', acct2Vault[0])
  th.logBN('acct2 coll', acct2Vault[1])
  th.logBN('acct2 stake', acct2Vault[2])
  console.log(`acct2 vault status: ${acct2Vault[3]}`)

  // Log deployer's pending BPD gain - check fees went to staker (deloyer)
  deployerBPDRevShare = await MPContracts.mpStaking.getPendingBPDGain(deployerWallet.address)
  th.logBN("deployer pending BPD revenue share from staking, after acct 2 opened vault", deployerBPDRevShare)

  //  --- deployer withdraws staking gains ---
  console.log("CHECK DEPLOYER WITHDRAWING STAKING GAINS")

  // check deployer's BPD balance before withdrawing staking gains
  deployerBPDBal = await liquityCore.bpdToken.balanceOf(deployerWallet.address)
  th.logBN('deployer BPD bal before withdrawing staking gains', deployerBPDBal)

  // Deployer withdraws staking gains
  await mdh.sendAndWaitForTransaction(MPContracts.mpStaking.unstake(0, { gasPrice, gasLimit: 1000000 }))

  // check deployer's BPD balance after withdrawing staking gains
  deployerBPDBal = await liquityCore.bpdToken.balanceOf(deployerWallet.address)
  th.logBN('deployer BPD bal after withdrawing staking gains', deployerBPDBal)


  // --- System stats  ---

  // Uniswap BPD-RBTC pool size
  reserves = await BPDETHPair.getReserves()
  th.logBN("BPD-RBTC Pair's current BPD reserves", reserves[0])
  th.logBN("BPD-RBTC Pair's current RBTC reserves", reserves[1])

  // Number of vaults
  const numVaults = await liquityCore.vaultManager.getVaultOwnersCount()
  console.log(`number of vaults: ${numVaults} `)

  // Sorted list size
  const listSize = await liquityCore.sortedVaults.getSize()
  console.log(`Vault list size: ${listSize} `)

  // Total system debt and coll
  const entireSystemDebt = await liquityCore.vaultManager.getEntireSystemDebt()
  const entireSystemColl = await liquityCore.vaultManager.getEntireSystemColl()
  th.logBN("Entire system debt", entireSystemDebt)
  th.logBN("Entire system coll", entireSystemColl)

  // current borrowing rate
  const baseRate = await liquityCore.vaultManager.baseRate()
  const currentBorrowingRate = await liquityCore.vaultManager.getBorrowingRateWithDecay()
  th.logBN("Base rate", baseRate)
  th.logBN("Current borrowing rate", currentBorrowingRate)

  // total SP deposits
  const totalSPDeposits = await liquityCore.stabilityPool.getTotalBPDDeposits()
  th.logBN("Total BPD SP deposits", totalSPDeposits)

  // total MP Staked in MPStaking
  const totalMPStaked = await MPContracts.mpStaking.totalMPStaked()
  th.logBN("Total MP staked", totalMPStaked)

  // total LP tokens staked in Unipool
  const totalLPTokensStaked = await unipool.totalSupply()
  th.logBN("Total LP (BPD-RBTC) tokens staked in unipool", totalLPTokensStaked)

  // --- State variables ---

  // VaultManager 
  console.log("VaultManager state variables:")
  const totalStakes = await liquityCore.vaultManager.totalStakes()
  const totalStakesSnapshot = await liquityCore.vaultManager.totalStakesSnapshot()
  const totalCollateralSnapshot = await liquityCore.vaultManager.totalCollateralSnapshot()
  th.logBN("Total vault stakes", totalStakes)
  th.logBN("Snapshot of total vault stakes before last liq. ", totalStakesSnapshot)
  th.logBN("Snapshot of total vault collateral before last liq. ", totalCollateralSnapshot)

  const L_ETH = await liquityCore.vaultManager.L_ETH()
  const B_BPDDebt = await liquityCore.vaultManager.B_BPDDebt()
  th.logBN("L_ETH", L_ETH)
  th.logBN("B_BPDDebt", B_BPDDebt)

  // StabilityPool
  console.log("StabilityPool state variables:")
  const P = await liquityCore.stabilityPool.P()
  const currentScale = await liquityCore.stabilityPool.currentScale()
  const currentEpoch = await liquityCore.stabilityPool.currentEpoch()
  const S = await liquityCore.stabilityPool.epochToScaleToSum(currentEpoch, currentScale)
  const G = await liquityCore.stabilityPool.epochToScaleToG(currentEpoch, currentScale)
  th.logBN("Product P", P)
  th.logBN("Current epoch", currentEpoch)
  th.logBN("Current scale", currentScale)
  th.logBN("Sum S, at current epoch and scale", S)
  th.logBN("Sum G, at current epoch and scale", G)

  // MPStaking
  console.log("MPStaking state variables:")
  const F_BPD = await MPContracts.mpStaking.F_BPD()
  const F_ETH = await MPContracts.mpStaking.F_ETH()
  th.logBN("F_BPD", F_BPD)
  th.logBN("F_ETH", F_ETH)


  // CommunityIssuance
  console.log("CommunityIssuance state variables:")
  const totalMPIssued = await MPContracts.communityIssuance.totalMPIssued()
  th.logBN("Total MP issued to depositors / front ends", totalMPIssued)


  // TODO: Uniswap *MP-RBTC* pool size (check it's deployed?)















  // ************************
  // --- NOT FOR APRIL 5: Deploy a MPToken2 with General Safe as beneficiary to test minting MP showing up in Gnosis App  ---

  // // General Safe MP bal before:
  // const realGeneralSafeAddr = "0xF06016D822943C42e3Cb7FC3a6A3B1889C1045f8"

  //   const MPToken2EthersFactory = await ethers.getContractFactory("MPToken2", deployerWallet)
  //   const mpToken2 = await MPToken2EthersFactory.deploy( 
  //     "0xF41E0DD45d411102ed74c047BdA544396cB71E27",  // CI param: LC1 
  //     "0x9694a04263593AC6b895Fc01Df5929E1FC7495fA", // MP Staking param: LC2
  //     "0x98f95E112da23c7b753D8AE39515A585be6Fb5Ef", // LCF param: LC3
  //     realGeneralSafeAddr,  // bounty/hackathon param: REAL general safe addr
  //     "0x98f95E112da23c7b753D8AE39515A585be6Fb5Ef", // LP rewards param: LC3
  //     deployerWallet.address, // multisig param: deployer wallet
  //     {gasPrice, gasLimit: 10000000}
  //   )

  //   console.log(`mp2 address: ${mpToken2.address}`)

  //   let generalSafeMPBal = await mpToken2.balanceOf(realGeneralSafeAddr)
  //   console.log(`generalSafeMPBal: ${generalSafeMPBal}`)



  // ************************
  // --- NOT FOR APRIL 5: Test short-term lockup contract MP withdrawal on mainnet ---

  // now = (await ethers.provider.getBlock(latestBlock)).timestamp

  // const LCShortTermEthersFactory = await ethers.getContractFactory("LockupContractShortTerm", deployerWallet)

  // new deployment
  // const LCshortTerm = await LCShortTermEthersFactory.deploy(
  //   MPContracts.mpToken.address,
  //   deployerWallet.address,
  //   now, 
  //   {gasPrice, gasLimit: 1000000}
  // )

  // LCshortTerm.deployTransaction.wait()

  // existing deployment
  // const deployedShortTermLC = await new ethers.Contract(
  //   "0xbA8c3C09e9f55dA98c5cF0C28d15Acb927792dC7", 
  //   LCShortTermEthersFactory.interface,
  //   deployerWallet
  // )

  // new deployment
  // console.log(`Short term LC Address:  ${LCshortTerm.address}`)
  // console.log(`recorded beneficiary in short term LC:  ${await LCshortTerm.beneficiary()}`)
  // console.log(`recorded short term LC name:  ${await LCshortTerm.NAME()}`)

  // existing deployment
  //   console.log(`Short term LC Address:  ${deployedShortTermLC.address}`)
  //   console.log(`recorded beneficiary in short term LC:  ${await deployedShortTermLC.beneficiary()}`)
  //   console.log(`recorded short term LC name:  ${await deployedShortTermLC.NAME()}`)
  //   console.log(`recorded short term LC name:  ${await deployedShortTermLC.unlockTime()}`)
  //   now = (await ethers.provider.getBlock(latestBlock)).timestamp
  //   console.log(`time now: ${now}`)

  //   // check deployer MP bal
  //   let deployerMPBal = await MPContracts.mpToken.balanceOf(deployerWallet.address)
  //   console.log(`deployerMPBal before he withdraws: ${deployerMPBal}`)

  //   // check LC MP bal
  //   let LC_MPBal = await MPContracts.mpToken.balanceOf(deployedShortTermLC.address)
  //   console.log(`LC MP bal before withdrawal: ${LC_MPBal}`)

  // // withdraw from LC
  // const withdrawFromShortTermTx = await deployedShortTermLC.withdrawMP( {gasPrice, gasLimit: 1000000})
  // withdrawFromShortTermTx.wait()

  // // check deployer bal after LC withdrawal
  // deployerMPBal = await MPContracts.mpToken.balanceOf(deployerWallet.address)
  // console.log(`deployerMPBal after he withdraws: ${deployerMPBal}`)

  //   // check LC MP bal
  //   LC_MPBal = await MPContracts.mpToken.balanceOf(deployedShortTermLC.address)
  //   console.log(`LC MP bal after withdrawal: ${LC_MPBal}`)
}

module.exports = {
  mainnetDeploy
}
