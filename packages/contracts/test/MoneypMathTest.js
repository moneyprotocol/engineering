const MoneypMathTester = artifacts.require("./MoneypMathTester.sol")

contract('MoneypMath', async accounts => {
  let moneypMathTester
  beforeEach('deploy tester', async () => {
    moneypMathTester = await MoneypMathTester.new()
  })

  const checkFunction = async (func, cond, params) => {
    assert.equal(await moneypMathTester[func](...params), cond(...params))
  }

  it('max works if a > b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 1])
  })

  it('max works if a = b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 2])
  })

  it('max works if a < b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [1, 2])
  })
})
