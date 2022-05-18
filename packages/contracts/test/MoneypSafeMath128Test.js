const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const MoneypSafeMath128Tester = artifacts.require("MoneypSafeMath128Tester")

contract('MoneypSafeMath128Tester', async accounts => {
  let mathTester

  beforeEach(async () => {
    mathTester = await MoneypSafeMath128Tester.new()
  })

  it('add(): reverts if overflows', async () => {
    const MAX_UINT_128 = th.toBN(2).pow(th.toBN(128)).sub(th.toBN(1))
    await th.assertRevert(mathTester.add(MAX_UINT_128, 1), 'MoneypSafeMath128: addition overflow')
  })

  it('sub(): reverts if underflows', async () => {
    await th.assertRevert(mathTester.sub(1, 2), 'MoneypSafeMath128: subtraction overflow')
  })
})
