import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory, Overrides } from "@ethersproject/contracts";

import { Decimal } from "@moneyprotocol/lib-base";

import { BigNumber } from "ethers";

import {
  _MoneypContractAddresses,
  _MoneypContracts,
  _MoneypDeploymentJSON,
  _connectToContracts
} from "../src/contracts";

let silent = true;

export const log = (...args: unknown[]): void => {
  if (!silent) {
    console.log(...args);
  }
};

export const setSilent = (s: boolean): void => {
  silent = s;
};

const deployContract = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  contractName: string,
  ...args: unknown[]
) => {
  log(`Deploying ${contractName} ...`);
  const contractFactory = await getContractFactory(contractName, deployer);

  log(`Successfully fetched contract factory ...`);
  log(`ARGS: ${JSON.stringify(args)}`);
  const contract = await contractFactory.deploy(...args);

  log(`Waiting for transaction ${contract.deployTransaction.hash} ...`);
  const receipt = await contract.deployTransaction.wait();

  log({
    contractAddress: contract.address,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toNumber()
  });

  log();

  return contract.address;
};

const deployContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  priceFeedIsTestnet = true,
  overrides?: Overrides
): Promise<_MoneypContractAddresses> => {
  const addresses = {
    activePool: await deployContract(deployer, getContractFactory, "ActivePool", { ...overrides }),
    borrowerOperations: await deployContract(deployer, getContractFactory, "BorrowerOperations", {
      ...overrides
    }),
    vaultManager: await deployContract(deployer, getContractFactory, "VaultManager", {
      ...overrides
    }),
    collSurplusPool: await deployContract(deployer, getContractFactory, "CollSurplusPool", {
      ...overrides
    }),
    communityIssuance: await deployContract(deployer, getContractFactory, "CommunityIssuance", {
      ...overrides
    }),
    defaultPool: await deployContract(deployer, getContractFactory, "DefaultPool", { ...overrides }),
    hintHelpers: await deployContract(deployer, getContractFactory, "HintHelpers", { ...overrides }),
    lockupContractFactory: await deployContract(
      deployer,
      getContractFactory,
      "LockupContractFactory",
      { ...overrides }
    ),
    mpStaking: await deployContract(deployer, getContractFactory, "MPStaking", { ...overrides }),
    priceFeed: await deployContract(
      deployer,
      getContractFactory,
      priceFeedIsTestnet ? "PriceFeedTestnet" : "PriceFeed",
      { ...overrides }
    ),
    sortedVaults: await deployContract(deployer, getContractFactory, "SortedVaults", {
      ...overrides
    }),
    stabilityPool: await deployContract(deployer, getContractFactory, "StabilityPool", {
      ...overrides
    }),
    gasPool: await deployContract(deployer, getContractFactory, "GasPool", {
      ...overrides
    }),
  };

  return {
    ...addresses,
    bpdToken: await deployContract(
      deployer,
      getContractFactory,
      "BPDToken",
      addresses.vaultManager,
      addresses.stabilityPool,
      addresses.borrowerOperations,
      { ...overrides }
    ),

    mpToken: await deployContract(
      deployer,
      getContractFactory,
      "MPToken",
      addresses.communityIssuance,
      addresses.mpStaking,
      addresses.lockupContractFactory,
      '', // _bountyAddress (TODO: parameterize this)
      '', // _lpRewardsAddress
      '', // _multisigAddress (TODO: parameterize this)
      { ...overrides }
    ),

    multiVaultGetter: await deployContract(
      deployer,
      getContractFactory,
      "MultiVaultGetter",
      addresses.vaultManager,
      addresses.sortedVaults,
      { ...overrides }
    )
  };
};

const connectContracts = async (
  {
    activePool,
    borrowerOperations,
    vaultManager,
    bpdToken,
    collSurplusPool,
    communityIssuance,
    defaultPool,
    mpToken,
    hintHelpers,
    lockupContractFactory,
    mpStaking,
    priceFeed,
    sortedVaults,
    stabilityPool,
    gasPool,
  }: _MoneypContracts,
  deployer: Signer,
  overrides?: Overrides
) => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  const txCount = await deployer.provider.getTransactionCount(deployer.getAddress());

  const connections: ((nonce: number) => Promise<ContractTransaction>)[] = [
    nonce =>
      sortedVaults.setParams(1e6, vaultManager.address, borrowerOperations.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      vaultManager.setAddresses(
        borrowerOperations.address,
        activePool.address,
        defaultPool.address,
        stabilityPool.address,
        gasPool.address,
        collSurplusPool.address,
        priceFeed.address,
        bpdToken.address,
        sortedVaults.address,
        mpToken.address,
        mpStaking.address,
        { ...overrides, nonce }
      ),

    nonce =>
      borrowerOperations.setAddresses(
        vaultManager.address,
        activePool.address,
        defaultPool.address,
        stabilityPool.address,
        gasPool.address,
        collSurplusPool.address,
        priceFeed.address,
        sortedVaults.address,
        bpdToken.address,
        mpStaking.address,
        { ...overrides, nonce }
      ),

    nonce =>
      stabilityPool.setAddresses(
        borrowerOperations.address,
        vaultManager.address,
        activePool.address,
        bpdToken.address,
        sortedVaults.address,
        priceFeed.address,
        communityIssuance.address,
        { ...overrides, nonce }
      ),

    nonce =>
      activePool.setAddresses(
        borrowerOperations.address,
        vaultManager.address,
        stabilityPool.address,
        defaultPool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      defaultPool.setAddresses(vaultManager.address, activePool.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      collSurplusPool.setAddresses(
        borrowerOperations.address,
        vaultManager.address,
        activePool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      hintHelpers.setAddresses(sortedVaults.address, vaultManager.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      mpStaking.setAddresses(
        mpToken.address,
        bpdToken.address,
        vaultManager.address,
        borrowerOperations.address,
        activePool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      lockupContractFactory.setMPTokenAddress(mpToken.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      communityIssuance.setAddresses(mpToken.address, stabilityPool.address, {
        ...overrides,
        nonce
      }),
  ];

  for (let i = 0; i < connections.length; i++) {
    const connect = connections[i];
    const tx = await connect(txCount + i);

    console.log(JSON.stringify(tx));
    await tx.wait();

    log(`Connected ${i}`);
  }
};

/**
 * Deploys a single LockupContract instance via the factory for a beneficiary
 */
const deployLockupContractForBeneficiary = async ({
  mpTokenDeploymentTime,
  contracts,
  overrides,
  beneficiaryAddress,
}: {
  mpTokenDeploymentTime: BigNumber;
  contracts: _MoneypContracts;
  overrides?: Overrides;
  beneficiaryAddress: string;
}) => {
  console.log(`Deploying LockupContract for ${beneficiaryAddress}...`);
  const SECONDS_IN_ONE_YEAR = 31536000;
  const unlockTime = mpTokenDeploymentTime.toNumber() + SECONDS_IN_ONE_YEAR;
  
  const deployLockupTx = await contracts.lockupContractFactory.deployLockupContract(
    beneficiaryAddress,
    unlockTime,
    { ...overrides }
  );
  
  log(`Waiting for LockupContract deployment transaction ${deployLockupTx.hash} ...`);
  const deployLockupReceipt = await deployLockupTx.wait();
  
  // Extract the lockup contract address from the first log (LockupContractCreated event)
  const lockupContractAddress = deployLockupReceipt.logs[0].address;
  console.log(`Deployed LockupContract at: ${lockupContractAddress}`);
  log(`LockupContract deployed at: ${lockupContractAddress}`);
  return lockupContractAddress;
};

export const deployAndSetupContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  _priceFeedIsTestnet = true,
  _isDev = true,
  wrbtcAddress?: string,
  overrides?: Overrides
): Promise<_MoneypDeploymentJSON> => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }
  log("Deploying contracts...");
  log();
  log(`wrbtcAddress: ${wrbtcAddress}`);

  const deployment: _MoneypDeploymentJSON = {
    chainId: await deployer.getChainId(),
    version: "unknown",
    deploymentDate: new Date().getTime(),
    bootstrapPeriod: 0,
    totalStabilityPoolMPReward: "0",
    _priceFeedIsTestnet,
    _isDev,

    addresses: await deployContracts(
      deployer,
      getContractFactory,
      _priceFeedIsTestnet,
      overrides
    ).then(async addresses => ({
      ...addresses,
    }))
  };

  const contracts = _connectToContracts(deployer, deployment);
  const mpTokenDeploymentTime = await contracts.mpToken.getDeploymentStartTime();
  const bootstrapPeriod = await contracts.vaultManager.BOOTSTRAP_PERIOD();
  const totalStabilityPoolMPReward = await contracts.communityIssuance.MPSupplyCap();

  log("Connecting contracts...");
  console.log("Contracts connected check.");
  await connectContracts(contracts, deployer, overrides);
  console.log("Contracts connected successfully.");

  const lockupContractAddressBeneficiary1 = await deployLockupContractForBeneficiary({
    mpTokenDeploymentTime,
    contracts,
    overrides,
    beneficiaryAddress: "0x0000000000000000000000000000000000000000",
  });

  const lockupContractAddressBeneficiary2 = await deployLockupContractForBeneficiary({
    mpTokenDeploymentTime,
    contracts,
    overrides,
    beneficiaryAddress: "0x0000000000000000000000000000000000000000",
  });

  const lockupContractAddressBeneficiary3 = await deployLockupContractForBeneficiary({
    mpTokenDeploymentTime,
    contracts,
    overrides,
    beneficiaryAddress: "0x0000000000000000000000000000000000000000",
  });

  const lockupContractAddressBeneficiary4 = await deployLockupContractForBeneficiary({
    mpTokenDeploymentTime,
    contracts,
    overrides,
    beneficiaryAddress: "0x0000000000000000000000000000000000000000",
  });

  return {
    ...deployment,
    deploymentDate: mpTokenDeploymentTime.toNumber() * 1000,
    bootstrapPeriod: bootstrapPeriod.toNumber(),
    totalStabilityPoolMPReward: `${Decimal.fromBigNumberString(
      totalStabilityPoolMPReward.toHexString()
    )}`,
    lockupContractAddressBeneficiary1,
    lockupContractAddressBeneficiary2,
    lockupContractAddressBeneficiary3,
    lockupContractAddressBeneficiary4,
  };
};
