const testHelpers = require("../utils/testHelpers.js")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper
const dec = th.dec

contract('DefaultPool', async accounts => {
  let defaultPool
  let nonPayable
  let mockActivePool
  let mockVaultManager

  let [owner] = accounts

  beforeEach('Deploy contracts', async () => {
    defaultPool = await DefaultPool.new()
    nonPayable = await NonPayable.new()
    mockVaultManager = await NonPayable.new()
    mockActivePool = await NonPayable.new()
    await defaultPool.setAddresses(mockVaultManager.address, mockActivePool.address)
  })

  it('sendRBTCToActivePool(): fails if receiver cannot receive RBTC', async () => {
    const amount = dec(1, 'ether')

    // start pool with `amount`
    //await web3.eth.sendTransaction({ to: defaultPool.address, from: owner, value: amount })
    const tx = await mockActivePool.forward(defaultPool.address, '0x', { from: owner, value: amount })
    assert.isTrue(tx.receipt.status)

    // try to send ether from pool to non-payable
    //await th.assertRevert(defaultPool.sendRBTCToActivePool(amount, { from: owner }), 'DefaultPool: sending RBTC failed')
    const sendRBTCData = th.getTransactionData('sendRBTCToActivePool(uint256)', [web3.utils.toHex(amount)])
    await th.assertRevert(mockVaultManager.forward(defaultPool.address, sendRBTCData, { from: owner }), 'DefaultPool: sending RBTC failed')
  })
})

contract('Reset chain state', async accounts => { })
