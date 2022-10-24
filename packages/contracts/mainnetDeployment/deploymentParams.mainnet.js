const externalAddrs  = {
  // https://uniswap.org/docs/v2/smart-contracts/factory/
  UNISWAP_V2_FACTORY: "0xfaa7762f551bba9b0eba34d6443d49d0a577c0e1",
  UNIWAP_V2_ROUTER02: "0xf55c496bb1058690DB1401c4b9C19F3f44374961",
  // https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
  RBTC_ERC20: "0xF023155DE70A8D1De2D0C31B70BbEDf06Fd36f23",
  MOC_ORACLE: "0xb9C42EFc8ec54490a37cA91c423F7285Fa01e257",
  RSK_ORACLE: "0x97a9100de6fcabebe75fa5c8ef88c55b232f73f1"
}

const moneypAddrs = {
  // to be passed to MPToken as the bounties/hackathons address
  GENERAL_SAFE: "0xe0C25A64f71E9E9ECABE09ADBb8c1Bb1d9cE5513",

  // to be passed to MPToken as the MP multisig address
  MP_SAFE: "0x14986801Bd0F2e5ec98cf412526360fC9ae71c80",

  // Testnet deployer address
  DEPLOYER: "0xb9f6743674Eab7CDf2714a0341D731d2F4395094"
}

// Beneficiaries for lockup contracts. 
const beneficiaries = {
  // Account 2 wallet address
  ACCOUNT_2: "0xB4898fc16851B81a2CC4F2303B74077833594D02",

  // Beneficiary 1 wallet address
  BENEFICIARY_1: "0xF764064E59344e6173BA05C85682c0dc12537c15",

  // Beneficiary 2 wallet address
  BENEFICIARY_2: "0xDF15e7aF6684aBb52A7ccB7461C2E00CcbC08c33",
}

const OUTPUT_FILE = './mainnetDeployment/mainnetDeploymentOutput.json'

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => {
  return delay(90000) // wait 90s
}

const GAS_PRICE = 130000000
const TX_CONFIRMATIONS = 3 // for mainnet

const ASDFGSCAN_BASE_URL = 'https://etherscan.io/address'

module.exports = {
  externalAddrs,
  moneypAddrs,
  beneficiaries,
  OUTPUT_FILE,
  waitFunction,
  GAS_PRICE,
  TX_CONFIRMATIONS,
  // ASDFGSCAN_BASE_URL,
};
