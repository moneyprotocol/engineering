const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")
const StabilityPool = artifacts.require("./StabilityPool.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec


const logMPBalanceAndError = (MPBalance_A, expectedMPBalance_A) => {
  console.log(
    `Expected final balance: ${expectedMPBalance_A}, \n
    Actual final balance: ${MPBalance_A}, \n
    Abs. error: ${expectedMPBalance_A.sub(MPBalance_A)}`
  )
}

const repeatedlyIssueMP = async (stabilityPool, timeBetweenIssuances, duration) => {
  const startTimestamp = th.toBN(await th.getLatestBlockTimestamp(web3))
  let timePassed = 0

  // while current time < 1 month from deployment, issue MP every minute
  while (timePassed < duration) {
    // console.log(`timePassed: ${timePassed}`)
    await th.fastForwardTime(timeBetweenIssuances, web3.currentProvider)
    await stabilityPool._unprotectedTriggerMPIssuance()

    const currentTimestamp = th.toBN(await th.getLatestBlockTimestamp(web3))
    timePassed = currentTimestamp.sub(startTimestamp)
  }
}


contract('MP community issuance arithmetic tests', async accounts => {
  let contracts
  let borrowerOperations
  let communityIssuanceTester
  let mpToken
  let stabilityPool

  const [owner, alice, frontEnd_1] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  before(async () => {

  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployMoneypCore()
    const MPContracts = await deploymentHelper.deployMPTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
    contracts.stabilityPool = await StabilityPool.new()
    contracts = await deploymentHelper.deployBPDToken(contracts)

    stabilityPool = contracts.stabilityPool
    borrowerOperations = contracts.borrowerOperations

    mpToken = MPContracts.mpToken
    communityIssuanceTester = MPContracts.communityIssuance

    await deploymentHelper.connectMPContracts(MPContracts)
    await deploymentHelper.connectCoreContracts(contracts, MPContracts)
    await deploymentHelper.connectMPContractsToCore(MPContracts, contracts)
  })

  // Accuracy tests
  it("getCumulativeIssuanceFraction(): fraction doesn't increase if less than a minute has passed", async () => {
   // progress time 1 week 
    await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider)

    await communityIssuanceTester.unprotectedIssueMP()
   
    const issuanceFractionBefore = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.isTrue(issuanceFractionBefore.gt(th.toBN('0')))
    console.log(`issuance fraction before: ${issuanceFractionBefore}`)
    const blockTimestampBefore = th.toBN(await th.getLatestBlockTimestamp(web3))

    // progress time 10 seconds
    await th.fastForwardTime(10, web3.currentProvider)

    const issuanceFractionAfter = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const blockTimestampAfter = th.toBN(await th.getLatestBlockTimestamp(web3))

    const timestampDiff = blockTimestampAfter.sub(blockTimestampBefore)
    // check blockTimestamp diff < 60s
    assert.isTrue(timestampDiff.lt(th.toBN(60)))

    console.log(`issuance fraction after: ${issuanceFractionBefore}`)
    assert.isTrue(issuanceFractionBefore.eq(issuanceFractionAfter))
  })

  /*--- Issuance tests for "Yearly halving" schedule.

  Total issuance year 1: 50%, year 2: 75%, year 3:   0.875, etc   
  
  Error tolerance: 1e-9
  
  ---*/

  // using the result of this to advance time by the desired amount from the deployment time, whether or not some extra time has passed in the meanwhile
  const getDuration = async (expectedDuration) => {
    const deploymentTime = (await communityIssuanceTester.deploymentTime()).toNumber()
    const currentTime = await th.getLatestBlockTimestamp(web3)
    const duration = Math.max(expectedDuration - (currentTime - deploymentTime), 0)

    return duration
  }

  it("Cumulative issuance fraction is 0.0000013 after a minute", async () => {
    // console.log(`supply cap: ${await communityIssuanceTester.MPSupplyCap()}`)

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MINUTE)

    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '1318772305025'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 100000000)
  })

  it("Cumulative issuance fraction is 0.000079 after an hour", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_HOUR)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '79123260066094'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.0019 after a day", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_DAY)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '1897231348441660'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.013 after a week", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_WEEK)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '13205268780628400'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.055 after a month", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '55378538087966600'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.16 after 3 months", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH * 3)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '157105100752037000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.29 after 6 months", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH * 6)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = 289528188821766000

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.5 after a year", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = dec(5, 17)

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.75 after 2 years", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 2)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = dec(75, 16)

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.875 after 3 years", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 3)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = dec(875, 15)

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.9375 after 4 years", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 4)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '937500000000000000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.999 after 10 years", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 10)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '999023437500000000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.999999 after 20 years", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 20)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '999999046325684000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.999999999 after 30 years", async () => {
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 30)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '999999999068677000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  // --- Token issuance for yearly halving ---

   // Error tolerance: 1e-3, i.e. 1/1000th of a token

  it("Total MP tokens issued is 42.20 after a minute", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MINUTE)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '221165213181045510000'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 13,269.39 after an hour", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)


    const duration = await getDuration(timeValues.SECONDS_IN_ONE_HOUR)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '13269396554220261614874'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 318,175.9 after a day", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)


    const duration = await getDuration(timeValues.SECONDS_IN_ONE_DAY)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '318175908026681734690050'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 2,214,594.64 after a week", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)


    const duration = await getDuration(timeValues.SECONDS_IN_ONE_WEEK)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '2214594645225704303178552'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 9,287,278.88 after a month", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)


    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '9287278884470581897485492'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 26,347,370.93 after 3 months", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH * 3)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '26347370935304654766607830'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 48,555,435.50 after 6 months", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH * 6)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '48555435505339908284891154'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 83,852,690.99 after a year", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '83852690999997199152415218'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 125,779,036.49 after 2 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 2)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '125779036499997199152415218'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 146,742,209 after 3 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 3)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '146742209249997899490090450'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 157,223,795 after 4 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 4)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '157223795624998599660060300'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 167,541,160 after 10 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 10)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '167541607212890570328045468'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 167,705,222.06 after 20 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 20)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '167705222063684463375197526'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  it("Total MP tokens issued is 167,705,381.18 after 30 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalMPIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 30)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue MP
    await communityIssuanceTester.unprotectedIssueMP()
    const totalMPIssued = await communityIssuanceTester.totalMPIssued()
    const expectedTotalMPIssued = '167705381843812191794401350'

    const absError = th.toBN(expectedTotalMPIssued).sub(totalMPIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalMPIssued: ${totalMPIssued},  
    //    expectedTotalMPIssued: ${expectedTotalMPIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalMPIssued, expectedTotalMPIssued), 1000000000000000)
  })

  /* ---  
  Accumulated issuance error: how many tokens are lost over a given period, for a given issuance frequency? 
  
  Slow tests are skipped.
  --- */

  // TODO: Convert to 25mil issuance schedule
  it.skip("Frequent token issuance: issuance event every year, for 30 years", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Alice opens vault and deposits to SP
    await borrowerOperations.openVault(th._100pct, dec(1, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForMP(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_YEAR
    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 30)

    await repeatedlyIssueMP(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated MP
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const MPBalance_A = await mpToken.balanceOf(alice)
    const expectedMPBalance_A = th.toBN('33333333302289200000000000')
    const diff = expectedMPBalance_A.sub(MPBalance_A)

    // logMPBalanceAndError(MPBalance_A, expectedMPBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
  /*  Results:
  
  Expected final balance: 33333333302289200000000000,
  Actual final balance: 33333333302289247499999999,
  Abs. error: -47499999999 */


    // TODO: Convert to 25mil issuance schedule
  it.skip("Frequent token issuance: issuance event every day, for 30 years", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Alice opens vault and deposits to SP
    await borrowerOperations.openVault(th._100pct, dec(1, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForMP(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_DAY
    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 30)

    await repeatedlyIssueMP(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated MP
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const MPBalance_A = await mpToken.balanceOf(alice)
    const expectedMPBalance_A = th.toBN('33333333302289200000000000')
    const diff = expectedMPBalance_A.sub(MPBalance_A)

    // logMPBalanceAndError(MPBalance_A, expectedMPBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
  /* Results:

  Expected final balance: 33333333302289200000000000,
  Actual final balance: 33333333302297188866666666,
  Abs. error: -7988866666666  */

  // TODO: Convert to 25mil issuance schedule
  it.skip("Frequent token issuance: issuance event every minute, for 1 month", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Alice opens vault and deposits to SP
    await borrowerOperations.openVault(th._100pct, dec(1, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForMP(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_MINUTE
    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH)

    await repeatedlyIssueMP(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated MP
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const MPBalance_A = await mpToken.balanceOf(alice)
    const expectedMPBalance_A = th.toBN('1845951269598880000000000')
    const diff = expectedMPBalance_A.sub(MPBalance_A)

    // logMPBalanceAndError(MPBalance_A, expectedMPBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
  /* Results:

  Expected final balance: 1845951269598880000000000,
  Actual final balance: 1845951269564420199999999,
  Abs. error: 34459800000001
  */

  // TODO: Convert to 25mil issuance schedule
  it.skip("Frequent token issuance: issuance event every minute, for 1 year", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Alice opens vault and deposits to SP
    await borrowerOperations.openVault(th._100pct, dec(1, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForMP(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_MINUTE
    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR)

    await repeatedlyIssueMP(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated MP
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const MPBalance_A = await mpToken.balanceOf(alice)
    const expectedMPBalance_A = th.toBN('1845951269598880000000000')
    const diff = expectedMPBalance_A.sub(MPBalance_A)

    // logMPBalanceAndError(MPBalance_A, expectedMPBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
})
