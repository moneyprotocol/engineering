const externalAddrs  = {
  // https://data.chain.link/eth-usd
  CHAINLINK_RBTCUSD_PROXY: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", 
  // https://docs.tellor.io/tellor/integration/reference-page
  TELLOR_MASTER:"0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0",
  // https://uniswap.org/docs/v2/smart-contracts/factory/
  UNISWAP_V2_FACTORY: "0xfaa7762f551bba9b0eba34d6443d49d0a577c0e1",
  UNIWAP_V2_ROUTER02: "0xf55c496bb1058690DB1401c4b9C19F3f44374961",
  // https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
  RBTC_ERC20: "0xF023155DE70A8D1De2D0C31B70BbEDf06Fd36f23",
  MOC_ORACLE: "0xb9C42EFc8ec54490a37cA91c423F7285Fa01e257",
  RSK_ORACLE: "0x97a9100de6fcabebe75fa5c8ef88c55b232f73f1"
}

const moneypAddrs = {
  GENERAL_SAFE:"0x8be7e24263c199ebfcfd6aebca83f8d7ed85a5dd", // TODO - 
  MP_SAFE:"0x20c81d658aae3a8580d990e441a9ef2c9809be74", // TODO - 
  DEPLOYER: "0xb9f6743674Eab7CDf2714a0341D731d2F4395094" // Mainnet TEST deployment address
}

const beneficiaries = {
  ACCOUNT_2: "0x774bbfd4D640ad5EcCCADce45daCa741AC79CefB",  
  ACCOUNT_3: "0xC6d15E60dBd01F694d6d955e205Df10C5fa9c417",
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
