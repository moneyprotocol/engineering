import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";
import { BytesLike } from "@ethersproject/bytes";
import {
  Overrides,
  CallOverrides,
  PayableOverrides,
  EventFilter,
} from "@ethersproject/contracts";

import { _TypedMoneypContract, _TypedLogDescription } from "../src/contracts";

interface ActivePoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  defaultPoolAddress(_overrides?: CallOverrides): Promise<string>;
  getBPDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getRBTC(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  vaultManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface ActivePoolTransactions {
  decreaseBPDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  increaseBPDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendRBTC(
    _account: string,
    _amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  setAddresses(
    _borrowerOperationsAddress: string,
    _vaultManagerAddress: string,
    _stabilityPoolAddress: string,
    _defaultPoolAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface ActivePool
  extends _TypedMoneypContract<ActivePoolCalls, ActivePoolTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    ActivePoolBPDDebtUpdated(_BPDDebt?: null): EventFilter;
    ActivePoolRBTCBalanceUpdated(_RBTC?: null): EventFilter;
    BPDBalanceUpdated(_newBalance?: null): EventFilter;
    BitcoinSent(_to?: null, _amount?: null): EventFilter;
    BorrowerOperationsAddressChanged(
      _newBorrowerOperationsAddress?: null
    ): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    RBTCBalanceUpdated(_newBalance?: null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    VaultManagerAddressChanged(_newVaultManagerAddress?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "ActivePoolAddressChanged"
  ): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "ActivePoolBPDDebtUpdated"
  ): _TypedLogDescription<{ _BPDDebt: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "ActivePoolRBTCBalanceUpdated"
  ): _TypedLogDescription<{ _RBTC: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BPDBalanceUpdated"
  ): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BitcoinSent"
  ): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BorrowerOperationsAddressChanged"
  ): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "DefaultPoolAddressChanged"
  ): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "RBTCBalanceUpdated"
  ): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "StabilityPoolAddressChanged"
  ): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressChanged"
  ): _TypedLogDescription<{ _newVaultManagerAddress: string }>[];
}

interface BorrowerOperationsCalls {
  BORROWING_FEE_FLOOR(_overrides?: CallOverrides): Promise<BigNumber>;
  BPD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  bpdToken(_overrides?: CallOverrides): Promise<string>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  getCompositeDebt(
    _debt: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  mpStaking(_overrides?: CallOverrides): Promise<string>;
  mpStakingAddress(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  sortedVaults(_overrides?: CallOverrides): Promise<string>;
  vaultManager(_overrides?: CallOverrides): Promise<string>;
}

interface BorrowerOperationsTransactions {
  addColl(
    _upperHint: string,
    _lowerHint: string,
    _overrides?: PayableOverrides
  ): Promise<void>;
  adjustVault(
    _maxFeePercentage: BigNumberish,
    _collWithdrawal: BigNumberish,
    _BPDChange: BigNumberish,
    _isDebtIncrease: boolean,
    _upperHint: string,
    _lowerHint: string,
    _overrides?: PayableOverrides
  ): Promise<void>;
  claimCollateral(_overrides?: Overrides): Promise<void>;
  closeVault(_overrides?: Overrides): Promise<void>;
  moveRBTCGainToVault(
    _borrower: string,
    _upperHint: string,
    _lowerHint: string,
    _overrides?: PayableOverrides
  ): Promise<void>;
  openVault(
    _maxFeePercentage: BigNumberish,
    _BPDAmount: BigNumberish,
    _upperHint: string,
    _lowerHint: string,
    _overrides?: PayableOverrides
  ): Promise<void>;
  repayBPD(
    _BPDAmount: BigNumberish,
    _upperHint: string,
    _lowerHint: string,
    _overrides?: Overrides
  ): Promise<void>;
  setAddresses(
    _vaultManagerAddress: string,
    _activePoolAddress: string,
    _defaultPoolAddress: string,
    _stabilityPoolAddress: string,
    _gasPoolAddress: string,
    _collSurplusPoolAddress: string,
    _priceFeedAddress: string,
    _sortedVaultsAddress: string,
    _bpdTokenAddress: string,
    _mpStakingAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
  withdrawBPD(
    _maxFeePercentage: BigNumberish,
    _BPDAmount: BigNumberish,
    _upperHint: string,
    _lowerHint: string,
    _overrides?: Overrides
  ): Promise<void>;
  withdrawColl(
    _collWithdrawal: BigNumberish,
    _upperHint: string,
    _lowerHint: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface BorrowerOperations
  extends _TypedMoneypContract<
    BorrowerOperationsCalls,
    BorrowerOperationsTransactions
  > {
  readonly filters: {
    ActivePoolAddressChanged(_activePoolAddress?: null): EventFilter;
    BPDBorrowingFeePaid(_borrower?: string | null, _BPDFee?: null): EventFilter;
    BPDTokenAddressChanged(_bpdTokenAddress?: null): EventFilter;
    CollSurplusPoolAddressChanged(_collSurplusPoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_defaultPoolAddress?: null): EventFilter;
    GasPoolAddressChanged(_gasPoolAddress?: null): EventFilter;
    MPStakingAddressChanged(_mpStakingAddress?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    SortedVaultsAddressChanged(_sortedVaultsAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_stabilityPoolAddress?: null): EventFilter;
    VaultCreated(_borrower?: string | null, arrayIndex?: null): EventFilter;
    VaultManagerAddressChanged(_newVaultManagerAddress?: null): EventFilter;
    VaultUpdated(
      _borrower?: string | null,
      _debt?: null,
      _coll?: null,
      stake?: null,
      operation?: null
    ): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "ActivePoolAddressChanged"
  ): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BPDBorrowingFeePaid"
  ): _TypedLogDescription<{ _borrower: string; _BPDFee: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BPDTokenAddressChanged"
  ): _TypedLogDescription<{ _bpdTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "CollSurplusPoolAddressChanged"
  ): _TypedLogDescription<{ _collSurplusPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "DefaultPoolAddressChanged"
  ): _TypedLogDescription<{ _defaultPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "GasPoolAddressChanged"
  ): _TypedLogDescription<{ _gasPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "MPStakingAddressChanged"
  ): _TypedLogDescription<{ _mpStakingAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "PriceFeedAddressChanged"
  ): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "SortedVaultsAddressChanged"
  ): _TypedLogDescription<{ _sortedVaultsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "StabilityPoolAddressChanged"
  ): _TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "VaultCreated"
  ): _TypedLogDescription<{ _borrower: string; arrayIndex: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressChanged"
  ): _TypedLogDescription<{ _newVaultManagerAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "VaultUpdated"
  ): _TypedLogDescription<{
    _borrower: string;
    _debt: BigNumber;
    _coll: BigNumber;
    stake: BigNumber;
    operation: number;
  }>[];
}

interface CollSurplusPoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  getCollateral(
    _account: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getRBTC(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  vaultManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface CollSurplusPoolTransactions {
  accountSurplus(
    _account: string,
    _amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  claimColl(_account: string, _overrides?: Overrides): Promise<void>;
  setAddresses(
    _borrowerOperationsAddress: string,
    _vaultManagerAddress: string,
    _activePoolAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface CollSurplusPool
  extends _TypedMoneypContract<
    CollSurplusPoolCalls,
    CollSurplusPoolTransactions
  > {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    BitcoinSent(_to?: null, _amount?: null): EventFilter;
    BorrowerOperationsAddressChanged(
      _newBorrowerOperationsAddress?: null
    ): EventFilter;
    CollBalanceUpdated(
      _account?: string | null,
      _newBalance?: null
    ): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    VaultManagerAddressChanged(_newVaultManagerAddress?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "ActivePoolAddressChanged"
  ): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BitcoinSent"
  ): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BorrowerOperationsAddressChanged"
  ): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "CollBalanceUpdated"
  ): _TypedLogDescription<{ _account: string; _newBalance: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressChanged"
  ): _TypedLogDescription<{ _newVaultManagerAddress: string }>[];
}

interface CommunityIssuanceCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ISSUANCE_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  MPSupplyCap(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  deploymentTime(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  mpToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  totalMPIssued(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface CommunityIssuanceTransactions {
  issueMP(_overrides?: Overrides): Promise<BigNumber>;
  sendMP(
    _account: string,
    _MPamount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  setAddresses(
    _mpTokenAddress: string,
    _stabilityPoolAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface CommunityIssuance
  extends _TypedMoneypContract<
    CommunityIssuanceCalls,
    CommunityIssuanceTransactions
  > {
  readonly filters: {
    MPTokenAddressSet(_mpTokenAddress?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    StabilityPoolAddressSet(_stabilityPoolAddress?: null): EventFilter;
    TotalMPIssuedUpdated(_totalMPIssued?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "MPTokenAddressSet"
  ): _TypedLogDescription<{ _mpTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "StabilityPoolAddressSet"
  ): _TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "TotalMPIssuedUpdated"
  ): _TypedLogDescription<{ _totalMPIssued: BigNumber }>[];
}

interface DefaultPoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  getBPDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getRBTC(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  vaultManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface DefaultPoolTransactions {
  decreaseBPDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  increaseBPDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendRBTCToActivePool(
    _amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  setAddresses(
    _vaultManagerAddress: string,
    _activePoolAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface DefaultPool
  extends _TypedMoneypContract<DefaultPoolCalls, DefaultPoolTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    BPDBalanceUpdated(_newBalance?: null): EventFilter;
    BitcoinSent(_to?: null, _amount?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    DefaultPoolBPDDebtUpdated(_BPDDebt?: null): EventFilter;
    DefaultPoolRBTCBalanceUpdated(_RBTC?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    RBTCBalanceUpdated(_newBalance?: null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    VaultManagerAddressChanged(_newVaultManagerAddress?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "ActivePoolAddressChanged"
  ): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BPDBalanceUpdated"
  ): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BitcoinSent"
  ): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "DefaultPoolAddressChanged"
  ): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "DefaultPoolBPDDebtUpdated"
  ): _TypedLogDescription<{ _BPDDebt: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "DefaultPoolRBTCBalanceUpdated"
  ): _TypedLogDescription<{ _RBTC: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "RBTCBalanceUpdated"
  ): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "StabilityPoolAddressChanged"
  ): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressChanged"
  ): _TypedLogDescription<{ _newVaultManagerAddress: string }>[];
}

interface ERC20MockCalls {
  allowance(
    owner: string,
    spender: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  name(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface ERC20MockTransactions {
  approve(
    spender: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  approveInternal(
    owner: string,
    spender: string,
    value: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  burn(
    account: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  decreaseAllowance(
    spender: string,
    subtractedValue: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  increaseAllowance(
    spender: string,
    addedValue: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  mint(
    account: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  transfer(
    recipient: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  transferFrom(
    sender: string,
    recipient: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  transferInternal(
    from: string,
    to: string,
    value: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface ERC20Mock
  extends _TypedMoneypContract<ERC20MockCalls, ERC20MockTransactions> {
  readonly filters: {
    Approval(
      owner?: string | null,
      spender?: string | null,
      value?: null
    ): EventFilter;
    Transfer(
      from?: string | null,
      to?: string | null,
      value?: null
    ): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "Approval"
  ): _TypedLogDescription<{
    owner: string;
    spender: string;
    value: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "Transfer"
  ): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface GasPoolCalls {}

interface GasPoolTransactions {}

export interface GasPool
  extends _TypedMoneypContract<GasPoolCalls, GasPoolTransactions> {
  readonly filters: {};
}

interface HintHelpersCalls {
  BORROWING_FEE_FLOOR(_overrides?: CallOverrides): Promise<BigNumber>;
  BPD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  computeCR(
    _coll: BigNumberish,
    _debt: BigNumberish,
    _price: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  computeNominalCR(
    _coll: BigNumberish,
    _debt: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  getApproxHint(
    _CR: BigNumberish,
    _numTrials: BigNumberish,
    _inputRandomSeed: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<{
    hintAddress: string;
    diff: BigNumber;
    latestRandomSeed: BigNumber;
  }>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionHints(
    _BPDamount: BigNumberish,
    _price: BigNumberish,
    _maxIterations: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<{
    firstRedemptionHint: string;
    partialRedemptionHintNICR: BigNumber;
    truncatedBPDamount: BigNumber;
  }>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  sortedVaults(_overrides?: CallOverrides): Promise<string>;
  vaultManager(_overrides?: CallOverrides): Promise<string>;
}

interface HintHelpersTransactions {
  setAddresses(
    _sortedVaultsAddress: string,
    _vaultManagerAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface HintHelpers
  extends _TypedMoneypContract<HintHelpersCalls, HintHelpersTransactions> {
  readonly filters: {
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    SortedVaultsAddressChanged(_sortedVaultsAddress?: null): EventFilter;
    VaultManagerAddressChanged(_vaultManagerAddress?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "SortedVaultsAddressChanged"
  ): _TypedLogDescription<{ _sortedVaultsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressChanged"
  ): _TypedLogDescription<{ _vaultManagerAddress: string }>[];
}

interface IERC20Calls {
  allowance(
    owner: string,
    spender: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface IERC20Transactions {
  approve(
    spender: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  transfer(
    recipient: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  transferFrom(
    sender: string,
    recipient: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
}

export interface IERC20
  extends _TypedMoneypContract<IERC20Calls, IERC20Transactions> {
  readonly filters: {
    Approval(
      owner?: string | null,
      spender?: string | null,
      value?: null
    ): EventFilter;
    Transfer(
      from?: string | null,
      to?: string | null,
      value?: null
    ): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "Approval"
  ): _TypedLogDescription<{
    owner: string;
    spender: string;
    value: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "Transfer"
  ): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface LockupContractFactoryCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  SECONDS_IN_ONE_YEAR(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  isRegisteredLockup(
    _contractAddress: string,
    _overrides?: CallOverrides
  ): Promise<boolean>;
  lockupContractToDeployer(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<string>;
  mpTokenAddress(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
}

interface LockupContractFactoryTransactions {
  deployLockupContract(
    _beneficiary: string,
    _unlockTime: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  setMPTokenAddress(
    _mpTokenAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface LockupContractFactory
  extends _TypedMoneypContract<
    LockupContractFactoryCalls,
    LockupContractFactoryTransactions
  > {
  readonly filters: {
    LockupContractDeployedThroughFactory(
      _lockupContractAddress?: null,
      _beneficiary?: null,
      _unlockTime?: null,
      _deployer?: null
    ): EventFilter;
    MPTokenAddressSet(_mpTokenAddress?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "LockupContractDeployedThroughFactory"
  ): _TypedLogDescription<{
    _lockupContractAddress: string;
    _beneficiary: string;
    _unlockTime: BigNumber;
    _deployer: string;
  }>[];
  extractEvents(
    logs: Log[],
    name: "MPTokenAddressSet"
  ): _TypedLogDescription<{ _mpTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
}

interface BPDTokenCalls {
  allowance(
    owner: string,
    spender: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  domainSeparator(_overrides?: CallOverrides): Promise<string>;
  name(_overrides?: CallOverrides): Promise<string>;
  nonces(owner: string, _overrides?: CallOverrides): Promise<BigNumber>;
  permitTypeHash(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  vaultManagerAddress(_overrides?: CallOverrides): Promise<string>;
  version(_overrides?: CallOverrides): Promise<string>;
}

interface BPDTokenTransactions {
  approve(
    spender: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  burn(
    _account: string,
    _amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  decreaseAllowance(
    spender: string,
    subtractedValue: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  increaseAllowance(
    spender: string,
    addedValue: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  mint(
    _account: string,
    _amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  permit(
    owner: string,
    spender: string,
    amount: BigNumberish,
    deadline: BigNumberish,
    v: BigNumberish,
    r: BytesLike,
    s: BytesLike,
    _overrides?: Overrides
  ): Promise<void>;
  returnFromPool(
    _poolAddress: string,
    _receiver: string,
    _amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  sendToPool(
    _sender: string,
    _poolAddress: string,
    _amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  transfer(
    recipient: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  transferFrom(
    sender: string,
    recipient: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
}

export interface BPDToken
  extends _TypedMoneypContract<BPDTokenCalls, BPDTokenTransactions> {
  readonly filters: {
    Approval(
      owner?: string | null,
      spender?: string | null,
      value?: null
    ): EventFilter;
    BPDTokenBalanceUpdated(_user?: null, _amount?: null): EventFilter;
    BorrowerOperationsAddressChanged(
      _newBorrowerOperationsAddress?: null
    ): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    Transfer(
      from?: string | null,
      to?: string | null,
      value?: null
    ): EventFilter;
    VaultManagerAddressChanged(_vaultManagerAddress?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "Approval"
  ): _TypedLogDescription<{
    owner: string;
    spender: string;
    value: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "BPDTokenBalanceUpdated"
  ): _TypedLogDescription<{ _user: string; _amount: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BorrowerOperationsAddressChanged"
  ): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "StabilityPoolAddressChanged"
  ): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "Transfer"
  ): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressChanged"
  ): _TypedLogDescription<{ _vaultManagerAddress: string }>[];
}

interface MPStakingCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  F_BPD(_overrides?: CallOverrides): Promise<BigNumber>;
  F_RBTC(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  bpdToken(_overrides?: CallOverrides): Promise<string>;
  getPendingBPDGain(
    _user: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getPendingRBTCGain(
    _user: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  mpToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  snapshots(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<{ F_RBTC_Snapshot: BigNumber; F_BPD_Snapshot: BigNumber }>;
  stakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalMPStaked(_overrides?: CallOverrides): Promise<BigNumber>;
  vaultManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface MPStakingTransactions {
  increaseF_BPD(_BPDFee: BigNumberish, _overrides?: Overrides): Promise<void>;
  increaseF_RBTC(_RBTCFee: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(
    _mpTokenAddress: string,
    _bpdTokenAddress: string,
    _vaultManagerAddress: string,
    _borrowerOperationsAddress: string,
    _activePoolAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
  stake(_MPamount: BigNumberish, _overrides?: Overrides): Promise<void>;
  unstake(_MPamount: BigNumberish, _overrides?: Overrides): Promise<void>;
}

export interface MPStaking
  extends _TypedMoneypContract<MPStakingCalls, MPStakingTransactions> {
  readonly filters: {
    ActivePoolAddressSet(_activePoolAddress?: null): EventFilter;
    BPDTokenAddressSet(_bpdTokenAddress?: null): EventFilter;
    BitcoinSent(_account?: null, _amount?: null): EventFilter;
    BorrowerOperationsAddressSet(
      _borrowerOperationsAddress?: null
    ): EventFilter;
    F_BPDUpdated(_F_BPD?: null): EventFilter;
    F_RBTCUpdated(_F_RBTC?: null): EventFilter;
    MPTokenAddressSet(_mpTokenAddress?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    StakeChanged(staker?: string | null, newStake?: null): EventFilter;
    StakerSnapshotsUpdated(
      _staker?: null,
      _F_RBTC?: null,
      _F_BPD?: null
    ): EventFilter;
    StakingGainsWithdrawn(
      staker?: string | null,
      BPDGain?: null,
      RBTCGain?: null
    ): EventFilter;
    TotalMPStakedUpdated(_totalMPStaked?: null): EventFilter;
    VaultManagerAddressSet(_vaultManager?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "ActivePoolAddressSet"
  ): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BPDTokenAddressSet"
  ): _TypedLogDescription<{ _bpdTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BitcoinSent"
  ): _TypedLogDescription<{ _account: string; _amount: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BorrowerOperationsAddressSet"
  ): _TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "F_BPDUpdated"
  ): _TypedLogDescription<{ _F_BPD: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "F_RBTCUpdated"
  ): _TypedLogDescription<{ _F_RBTC: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "MPTokenAddressSet"
  ): _TypedLogDescription<{ _mpTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "StakeChanged"
  ): _TypedLogDescription<{ staker: string; newStake: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "StakerSnapshotsUpdated"
  ): _TypedLogDescription<{
    _staker: string;
    _F_RBTC: BigNumber;
    _F_BPD: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "StakingGainsWithdrawn"
  ): _TypedLogDescription<{
    staker: string;
    BPDGain: BigNumber;
    RBTCGain: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "TotalMPStakedUpdated"
  ): _TypedLogDescription<{ _totalMPStaked: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressSet"
  ): _TypedLogDescription<{ _vaultManager: string }>[];
}

interface MPTokenCalls {
  ONE_YEAR_IN_SECONDS(_overrides?: CallOverrides): Promise<BigNumber>;
  allowance(
    owner: string,
    spender: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  communityIssuanceAddress(_overrides?: CallOverrides): Promise<string>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  domainSeparator(_overrides?: CallOverrides): Promise<string>;
  getDeploymentStartTime(_overrides?: CallOverrides): Promise<BigNumber>;
  getLpRewardsEntitlement(_overrides?: CallOverrides): Promise<BigNumber>;
  lockupContractFactory(_overrides?: CallOverrides): Promise<string>;
  mpStakingAddress(_overrides?: CallOverrides): Promise<string>;
  multisigAddress(_overrides?: CallOverrides): Promise<string>;
  name(_overrides?: CallOverrides): Promise<string>;
  nonces(owner: string, _overrides?: CallOverrides): Promise<BigNumber>;
  permitTypeHash(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  version(_overrides?: CallOverrides): Promise<string>;
}

interface MPTokenTransactions {
  approve(
    spender: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  decreaseAllowance(
    spender: string,
    subtractedValue: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  increaseAllowance(
    spender: string,
    addedValue: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  permit(
    owner: string,
    spender: string,
    amount: BigNumberish,
    deadline: BigNumberish,
    v: BigNumberish,
    r: BytesLike,
    s: BytesLike,
    _overrides?: Overrides
  ): Promise<void>;
  sendToMPStaking(
    _sender: string,
    _amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  transfer(
    recipient: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
  transferFrom(
    sender: string,
    recipient: string,
    amount: BigNumberish,
    _overrides?: Overrides
  ): Promise<boolean>;
}

export interface MPToken
  extends _TypedMoneypContract<MPTokenCalls, MPTokenTransactions> {
  readonly filters: {
    Approval(
      owner?: string | null,
      spender?: string | null,
      value?: null
    ): EventFilter;
    CommunityIssuanceAddressSet(_communityIssuanceAddress?: null): EventFilter;
    LockupContractFactoryAddressSet(
      _lockupContractFactoryAddress?: null
    ): EventFilter;
    MPStakingAddressSet(_mpStakingAddress?: null): EventFilter;
    Transfer(
      from?: string | null,
      to?: string | null,
      value?: null
    ): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "Approval"
  ): _TypedLogDescription<{
    owner: string;
    spender: string;
    value: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "CommunityIssuanceAddressSet"
  ): _TypedLogDescription<{ _communityIssuanceAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "LockupContractFactoryAddressSet"
  ): _TypedLogDescription<{ _lockupContractFactoryAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "MPStakingAddressSet"
  ): _TypedLogDescription<{ _mpStakingAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "Transfer"
  ): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface MultiVaultGetterCalls {
  getMultipleSortedVaults(
    _startIdx: BigNumberish,
    _count: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<
    {
      owner: string;
      debt: BigNumber;
      coll: BigNumber;
      stake: BigNumber;
      snapshotRBTC: BigNumber;
      snapshotBPDDebt: BigNumber;
    }[]
  >;
  sortedVaults(_overrides?: CallOverrides): Promise<string>;
  vaultManager(_overrides?: CallOverrides): Promise<string>;
}

interface MultiVaultGetterTransactions {}

export interface MultiVaultGetter
  extends _TypedMoneypContract<
    MultiVaultGetterCalls,
    MultiVaultGetterTransactions
  > {
  readonly filters: {};
}

interface PriceFeedCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lastGoodPrice(_overrides?: CallOverrides): Promise<BigNumber>;
  owner(_overrides?: CallOverrides): Promise<string>;
}

interface PriceFeedTransactions {
  fetchPrice(_overrides?: Overrides): Promise<BigNumber>;
  setAddresses(
    priceFeedAddresses: string[],
    _overrides?: Overrides
  ): Promise<void>;
}

export interface PriceFeed
  extends _TypedMoneypContract<PriceFeedCalls, PriceFeedTransactions> {
  readonly filters: {
    LastGoodPriceUpdated(_lastGoodPrice?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    PriceFeedBroken(index?: null, priceFeedAddress?: null): EventFilter;
    PriceFeedUpdated(index?: null, newPriceFeedAddress?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "LastGoodPriceUpdated"
  ): _TypedLogDescription<{ _lastGoodPrice: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "PriceFeedBroken"
  ): _TypedLogDescription<{ index: number; priceFeedAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "PriceFeedUpdated"
  ): _TypedLogDescription<{ index: number; newPriceFeedAddress: string }>[];
}

interface PriceFeedTestnetCalls {
  getPrice(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface PriceFeedTestnetTransactions {
  fetchPrice(_overrides?: Overrides): Promise<BigNumber>;
  setPrice(price: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface PriceFeedTestnet
  extends _TypedMoneypContract<
    PriceFeedTestnetCalls,
    PriceFeedTestnetTransactions
  > {
  readonly filters: {
    LastGoodPriceUpdated(_lastGoodPrice?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "LastGoodPriceUpdated"
  ): _TypedLogDescription<{ _lastGoodPrice: BigNumber }>[];
}

interface SortedVaultsCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  contains(_id: string, _overrides?: CallOverrides): Promise<boolean>;
  data(_overrides?: CallOverrides): Promise<{
    head: string;
    tail: string;
    maxSize: BigNumber;
    size: BigNumber;
  }>;
  findInsertPosition(
    _NICR: BigNumberish,
    _prevId: string,
    _nextId: string,
    _overrides?: CallOverrides
  ): Promise<[string, string]>;
  getFirst(_overrides?: CallOverrides): Promise<string>;
  getLast(_overrides?: CallOverrides): Promise<string>;
  getMaxSize(_overrides?: CallOverrides): Promise<BigNumber>;
  getNext(_id: string, _overrides?: CallOverrides): Promise<string>;
  getPrev(_id: string, _overrides?: CallOverrides): Promise<string>;
  getSize(_overrides?: CallOverrides): Promise<BigNumber>;
  isEmpty(_overrides?: CallOverrides): Promise<boolean>;
  isFull(_overrides?: CallOverrides): Promise<boolean>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  validInsertPosition(
    _NICR: BigNumberish,
    _prevId: string,
    _nextId: string,
    _overrides?: CallOverrides
  ): Promise<boolean>;
  vaultManager(_overrides?: CallOverrides): Promise<string>;
}

interface SortedVaultsTransactions {
  insert(
    _id: string,
    _NICR: BigNumberish,
    _prevId: string,
    _nextId: string,
    _overrides?: Overrides
  ): Promise<void>;
  reInsert(
    _id: string,
    _newNICR: BigNumberish,
    _prevId: string,
    _nextId: string,
    _overrides?: Overrides
  ): Promise<void>;
  remove(_id: string, _overrides?: Overrides): Promise<void>;
  setParams(
    _size: BigNumberish,
    _vaultManagerAddress: string,
    _borrowerOperationsAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface SortedVaults
  extends _TypedMoneypContract<SortedVaultsCalls, SortedVaultsTransactions> {
  readonly filters: {
    BorrowerOperationsAddressChanged(
      _borrowerOperationsAddress?: null
    ): EventFilter;
    NodeAdded(_id?: null, _NICR?: null): EventFilter;
    NodeRemoved(_id?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    SortedVaultsAddressChanged(_sortedDoublyLLAddress?: null): EventFilter;
    VaultManagerAddressChanged(_vaultManagerAddress?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "BorrowerOperationsAddressChanged"
  ): _TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "NodeAdded"
  ): _TypedLogDescription<{ _id: string; _NICR: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "NodeRemoved"
  ): _TypedLogDescription<{ _id: string }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "SortedVaultsAddressChanged"
  ): _TypedLogDescription<{ _sortedDoublyLLAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressChanged"
  ): _TypedLogDescription<{ _vaultManagerAddress: string }>[];
}

interface StabilityPoolCalls {
  BORROWING_FEE_FLOOR(_overrides?: CallOverrides): Promise<BigNumber>;
  BPD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  P(_overrides?: CallOverrides): Promise<BigNumber>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  SCALE_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  borrowerOperations(_overrides?: CallOverrides): Promise<string>;
  bpdToken(_overrides?: CallOverrides): Promise<string>;
  communityIssuance(_overrides?: CallOverrides): Promise<string>;
  currentEpoch(_overrides?: CallOverrides): Promise<BigNumber>;
  currentScale(_overrides?: CallOverrides): Promise<BigNumber>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  depositSnapshots(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<{
    S: BigNumber;
    P: BigNumber;
    G: BigNumber;
    scale: BigNumber;
    epoch: BigNumber;
  }>;
  deposits(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<{ initialValue: BigNumber; frontEndTag: string }>;
  epochToScaleToG(
    arg0: BigNumberish,
    arg1: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  epochToScaleToSum(
    arg0: BigNumberish,
    arg1: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  frontEndSnapshots(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<{
    S: BigNumber;
    P: BigNumber;
    G: BigNumber;
    scale: BigNumber;
    epoch: BigNumber;
  }>;
  frontEndStakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  frontEnds(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<{ kickbackRate: BigNumber; registered: boolean }>;
  getCompoundedBPDDeposit(
    _depositor: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getCompoundedFrontEndStake(
    _frontEnd: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getDepositorMPGain(
    _depositor: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getDepositorRBTCGain(
    _depositor: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getFrontEndMPGain(
    _frontEnd: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getRBTC(_overrides?: CallOverrides): Promise<BigNumber>;
  getTotalBPDDeposits(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lastBPDLossError_Offset(_overrides?: CallOverrides): Promise<BigNumber>;
  lastMPError(_overrides?: CallOverrides): Promise<BigNumber>;
  lastRBTCError_Offset(_overrides?: CallOverrides): Promise<BigNumber>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  sortedVaults(_overrides?: CallOverrides): Promise<string>;
  vaultManager(_overrides?: CallOverrides): Promise<string>;
}

interface StabilityPoolTransactions {
  offset(
    _debtToOffset: BigNumberish,
    _collToAdd: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  provideToSP(
    _amount: BigNumberish,
    _frontEndTag: string,
    _overrides?: Overrides
  ): Promise<void>;
  registerFrontEnd(
    _kickbackRate: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  setAddresses(
    _borrowerOperationsAddress: string,
    _vaultManagerAddress: string,
    _activePoolAddress: string,
    _bpdTokenAddress: string,
    _sortedVaultsAddress: string,
    _priceFeedAddress: string,
    _communityIssuanceAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
  withdrawFromSP(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  withdrawRBTCGainToVault(
    _upperHint: string,
    _lowerHint: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface StabilityPool
  extends _TypedMoneypContract<StabilityPoolCalls, StabilityPoolTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    BPDTokenAddressChanged(_newBPDTokenAddress?: null): EventFilter;
    BitcoinSent(_to?: null, _amount?: null): EventFilter;
    BorrowerOperationsAddressChanged(
      _newBorrowerOperationsAddress?: null
    ): EventFilter;
    CommunityIssuanceAddressChanged(
      _newCommunityIssuanceAddress?: null
    ): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    DepositSnapshotUpdated(
      _depositor?: string | null,
      _P?: null,
      _S?: null,
      _G?: null
    ): EventFilter;
    EpochUpdated(_currentEpoch?: null): EventFilter;
    FrontEndRegistered(
      _frontEnd?: string | null,
      _kickbackRate?: null
    ): EventFilter;
    FrontEndSnapshotUpdated(
      _frontEnd?: string | null,
      _P?: null,
      _G?: null
    ): EventFilter;
    FrontEndStakeChanged(
      _frontEnd?: string | null,
      _newFrontEndStake?: null,
      _depositor?: null
    ): EventFilter;
    FrontEndTagSet(
      _depositor?: string | null,
      _frontEnd?: string | null
    ): EventFilter;
    G_Updated(_G?: null, _epoch?: null, _scale?: null): EventFilter;
    MPPaidToDepositor(_depositor?: string | null, _MP?: null): EventFilter;
    MPPaidToFrontEnd(_frontEnd?: string | null, _MP?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    P_Updated(_P?: null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    RBTCGainWithdrawn(
      _depositor?: string | null,
      _RBTC?: null,
      _BPDLoss?: null
    ): EventFilter;
    S_Updated(_S?: null, _epoch?: null, _scale?: null): EventFilter;
    ScaleUpdated(_currentScale?: null): EventFilter;
    SortedVaultsAddressChanged(_newSortedVaultsAddress?: null): EventFilter;
    StabilityPoolBPDBalanceUpdated(_newBalance?: null): EventFilter;
    StabilityPoolRBTCBalanceUpdated(_newBalance?: null): EventFilter;
    UserDepositChanged(
      _depositor?: string | null,
      _newDeposit?: null
    ): EventFilter;
    VaultManagerAddressChanged(_newVaultManagerAddress?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "ActivePoolAddressChanged"
  ): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BPDTokenAddressChanged"
  ): _TypedLogDescription<{ _newBPDTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BitcoinSent"
  ): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BorrowerOperationsAddressChanged"
  ): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "CommunityIssuanceAddressChanged"
  ): _TypedLogDescription<{ _newCommunityIssuanceAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "DefaultPoolAddressChanged"
  ): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "DepositSnapshotUpdated"
  ): _TypedLogDescription<{
    _depositor: string;
    _P: BigNumber;
    _S: BigNumber;
    _G: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "EpochUpdated"
  ): _TypedLogDescription<{ _currentEpoch: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "FrontEndRegistered"
  ): _TypedLogDescription<{ _frontEnd: string; _kickbackRate: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "FrontEndSnapshotUpdated"
  ): _TypedLogDescription<{
    _frontEnd: string;
    _P: BigNumber;
    _G: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "FrontEndStakeChanged"
  ): _TypedLogDescription<{
    _frontEnd: string;
    _newFrontEndStake: BigNumber;
    _depositor: string;
  }>[];
  extractEvents(
    logs: Log[],
    name: "FrontEndTagSet"
  ): _TypedLogDescription<{ _depositor: string; _frontEnd: string }>[];
  extractEvents(
    logs: Log[],
    name: "G_Updated"
  ): _TypedLogDescription<{
    _G: BigNumber;
    _epoch: BigNumber;
    _scale: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "MPPaidToDepositor"
  ): _TypedLogDescription<{ _depositor: string; _MP: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "MPPaidToFrontEnd"
  ): _TypedLogDescription<{ _frontEnd: string; _MP: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "P_Updated"
  ): _TypedLogDescription<{ _P: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "PriceFeedAddressChanged"
  ): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "RBTCGainWithdrawn"
  ): _TypedLogDescription<{
    _depositor: string;
    _RBTC: BigNumber;
    _BPDLoss: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "S_Updated"
  ): _TypedLogDescription<{
    _S: BigNumber;
    _epoch: BigNumber;
    _scale: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "ScaleUpdated"
  ): _TypedLogDescription<{ _currentScale: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "SortedVaultsAddressChanged"
  ): _TypedLogDescription<{ _newSortedVaultsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "StabilityPoolBPDBalanceUpdated"
  ): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "StabilityPoolRBTCBalanceUpdated"
  ): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "UserDepositChanged"
  ): _TypedLogDescription<{ _depositor: string; _newDeposit: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "VaultManagerAddressChanged"
  ): _TypedLogDescription<{ _newVaultManagerAddress: string }>[];
}

interface VaultManagerCalls {
  BETA(_overrides?: CallOverrides): Promise<BigNumber>;
  BOOTSTRAP_PERIOD(_overrides?: CallOverrides): Promise<BigNumber>;
  BORROWING_FEE_FLOOR(_overrides?: CallOverrides): Promise<BigNumber>;
  BPD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  B_BPDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  B_RBTC(_overrides?: CallOverrides): Promise<BigNumber>;
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  MAX_BORROWING_FEE(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  MINUTE_DECAY_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  REDEMPTION_FEE_FLOOR(_overrides?: CallOverrides): Promise<BigNumber>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  VaultOwners(arg0: BigNumberish, _overrides?: CallOverrides): Promise<string>;
  Vaults(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<{
    debt: BigNumber;
    coll: BigNumber;
    stake: BigNumber;
    status: number;
    arrayIndex: BigNumber;
  }>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  baseRate(_overrides?: CallOverrides): Promise<BigNumber>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  bpdToken(_overrides?: CallOverrides): Promise<string>;
  checkRecoveryMode(
    _price: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<boolean>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  getBorrowingFee(
    _BPDDebt: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getBorrowingFeeWithDecay(
    _BPDDebt: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getBorrowingRate(_overrides?: CallOverrides): Promise<BigNumber>;
  getBorrowingRateWithDecay(_overrides?: CallOverrides): Promise<BigNumber>;
  getCurrentICR(
    _borrower: string,
    _price: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getEntireDebtAndColl(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<{
    debt: BigNumber;
    coll: BigNumber;
    pendingBPDDebtReward: BigNumber;
    pendingRBTCReward: BigNumber;
  }>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getNominalICR(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getPendingBPDDebtReward(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getPendingRBTCReward(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getRedemptionFeeWithDecay(
    _RBTCDrawn: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getRedemptionRate(_overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionRateWithDecay(_overrides?: CallOverrides): Promise<BigNumber>;
  getTCR(_price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getVaultColl(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getVaultDebt(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getVaultFromVaultOwnersArray(
    _index: BigNumberish,
    _overrides?: CallOverrides
  ): Promise<string>;
  getVaultOwnersCount(_overrides?: CallOverrides): Promise<BigNumber>;
  getVaultStake(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  getVaultStatus(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  hasPendingRewards(
    _borrower: string,
    _overrides?: CallOverrides
  ): Promise<boolean>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lastBPDDebtError_Redistribution(
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
  lastFeeOperationTime(_overrides?: CallOverrides): Promise<BigNumber>;
  lastRBTCError_Redistribution(_overrides?: CallOverrides): Promise<BigNumber>;
  mpStaking(_overrides?: CallOverrides): Promise<string>;
  mpToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  rewardSnapshots(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<{ RBTC: BigNumber; BPDDebt: BigNumber }>;
  sortedVaults(_overrides?: CallOverrides): Promise<string>;
  stabilityPool(_overrides?: CallOverrides): Promise<string>;
  totalCollateralSnapshot(_overrides?: CallOverrides): Promise<BigNumber>;
  totalStakes(_overrides?: CallOverrides): Promise<BigNumber>;
  totalStakesSnapshot(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface VaultManagerTransactions {
  addVaultOwnerToArray(
    _borrower: string,
    _overrides?: Overrides
  ): Promise<BigNumber>;
  applyPendingRewards(_borrower: string, _overrides?: Overrides): Promise<void>;
  batchLiquidateVaults(
    _vaultArray: string[],
    _overrides?: Overrides
  ): Promise<void>;
  closeVault(_borrower: string, _overrides?: Overrides): Promise<void>;
  decayBaseRateFromBorrowing(_overrides?: Overrides): Promise<void>;
  decreaseVaultColl(
    _borrower: string,
    _collDecrease: BigNumberish,
    _overrides?: Overrides
  ): Promise<BigNumber>;
  decreaseVaultDebt(
    _borrower: string,
    _debtDecrease: BigNumberish,
    _overrides?: Overrides
  ): Promise<BigNumber>;
  increaseVaultColl(
    _borrower: string,
    _collIncrease: BigNumberish,
    _overrides?: Overrides
  ): Promise<BigNumber>;
  increaseVaultDebt(
    _borrower: string,
    _debtIncrease: BigNumberish,
    _overrides?: Overrides
  ): Promise<BigNumber>;
  liquidate(_borrower: string, _overrides?: Overrides): Promise<void>;
  liquidateVaults(_n: BigNumberish, _overrides?: Overrides): Promise<void>;
  redeemCollateral(
    _BPDamount: BigNumberish,
    _firstRedemptionHint: string,
    _upperPartialRedemptionHint: string,
    _lowerPartialRedemptionHint: string,
    _partialRedemptionHintNICR: BigNumberish,
    _maxIterations: BigNumberish,
    _maxFeePercentage: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  removeStake(_borrower: string, _overrides?: Overrides): Promise<void>;
  setAddresses(
    _borrowerOperationsAddress: string,
    _activePoolAddress: string,
    _defaultPoolAddress: string,
    _stabilityPoolAddress: string,
    _gasPoolAddress: string,
    _collSurplusPoolAddress: string,
    _priceFeedAddress: string,
    _bpdTokenAddress: string,
    _sortedVaultsAddress: string,
    _mpTokenAddress: string,
    _mpStakingAddress: string,
    _overrides?: Overrides
  ): Promise<void>;
  setVaultStatus(
    _borrower: string,
    _num: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  updateStakeAndTotalStakes(
    _borrower: string,
    _overrides?: Overrides
  ): Promise<BigNumber>;
  updateVaultRewardSnapshots(
    _borrower: string,
    _overrides?: Overrides
  ): Promise<void>;
}

export interface VaultManager
  extends _TypedMoneypContract<VaultManagerCalls, VaultManagerTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_activePoolAddress?: null): EventFilter;
    BPDTokenAddressChanged(_newBPDTokenAddress?: null): EventFilter;
    BaseRateUpdated(_baseRate?: null): EventFilter;
    BorrowerOperationsAddressChanged(
      _newBorrowerOperationsAddress?: null
    ): EventFilter;
    CollSurplusPoolAddressChanged(_collSurplusPoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_defaultPoolAddress?: null): EventFilter;
    GasPoolAddressChanged(_gasPoolAddress?: null): EventFilter;
    LTermsUpdated(_B_RBTC?: null, _B_BPDDebt?: null): EventFilter;
    LastFeeOpTimeUpdated(_lastFeeOpTime?: null): EventFilter;
    Liquidation(
      _liquidatedDebt?: null,
      _liquidatedColl?: null,
      _collGasCompensation?: null,
      _BPDGasCompensation?: null
    ): EventFilter;
    MPStakingAddressChanged(_mpStakingAddress?: null): EventFilter;
    MPTokenAddressChanged(_mpTokenAddress?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    Redemption(
      _attemptedBPDAmount?: null,
      _actualBPDAmount?: null,
      _RBTCSent?: null,
      _RBTCFee?: null
    ): EventFilter;
    SortedVaultsAddressChanged(_sortedVaultsAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_stabilityPoolAddress?: null): EventFilter;
    SystemSnapshotsUpdated(
      _totalStakesSnapshot?: null,
      _totalCollateralSnapshot?: null
    ): EventFilter;
    TotalStakesUpdated(_newTotalStakes?: null): EventFilter;
    VaultIndexUpdated(_borrower?: null, _newIndex?: null): EventFilter;
    VaultLiquidated(
      _borrower?: string | null,
      _debt?: null,
      _coll?: null,
      _operation?: null
    ): EventFilter;
    VaultSnapshotsUpdated(_B_RBTC?: null, _B_BPDDebt?: null): EventFilter;
    VaultUpdated(
      _borrower?: string | null,
      _debt?: null,
      _coll?: null,
      _stake?: null,
      _operation?: null
    ): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "ActivePoolAddressChanged"
  ): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BPDTokenAddressChanged"
  ): _TypedLogDescription<{ _newBPDTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "BaseRateUpdated"
  ): _TypedLogDescription<{ _baseRate: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "BorrowerOperationsAddressChanged"
  ): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "CollSurplusPoolAddressChanged"
  ): _TypedLogDescription<{ _collSurplusPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "DefaultPoolAddressChanged"
  ): _TypedLogDescription<{ _defaultPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "GasPoolAddressChanged"
  ): _TypedLogDescription<{ _gasPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "LTermsUpdated"
  ): _TypedLogDescription<{ _B_RBTC: BigNumber; _B_BPDDebt: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "LastFeeOpTimeUpdated"
  ): _TypedLogDescription<{ _lastFeeOpTime: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "Liquidation"
  ): _TypedLogDescription<{
    _liquidatedDebt: BigNumber;
    _liquidatedColl: BigNumber;
    _collGasCompensation: BigNumber;
    _BPDGasCompensation: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "MPStakingAddressChanged"
  ): _TypedLogDescription<{ _mpStakingAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "MPTokenAddressChanged"
  ): _TypedLogDescription<{ _mpTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "PriceFeedAddressChanged"
  ): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "Redemption"
  ): _TypedLogDescription<{
    _attemptedBPDAmount: BigNumber;
    _actualBPDAmount: BigNumber;
    _RBTCSent: BigNumber;
    _RBTCFee: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "SortedVaultsAddressChanged"
  ): _TypedLogDescription<{ _sortedVaultsAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "StabilityPoolAddressChanged"
  ): _TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "SystemSnapshotsUpdated"
  ): _TypedLogDescription<{
    _totalStakesSnapshot: BigNumber;
    _totalCollateralSnapshot: BigNumber;
  }>[];
  extractEvents(
    logs: Log[],
    name: "TotalStakesUpdated"
  ): _TypedLogDescription<{ _newTotalStakes: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "VaultIndexUpdated"
  ): _TypedLogDescription<{ _borrower: string; _newIndex: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "VaultLiquidated"
  ): _TypedLogDescription<{
    _borrower: string;
    _debt: BigNumber;
    _coll: BigNumber;
    _operation: number;
  }>[];
  extractEvents(
    logs: Log[],
    name: "VaultSnapshotsUpdated"
  ): _TypedLogDescription<{ _B_RBTC: BigNumber; _B_BPDDebt: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "VaultUpdated"
  ): _TypedLogDescription<{
    _borrower: string;
    _debt: BigNumber;
    _coll: BigNumber;
    _stake: BigNumber;
    _operation: number;
  }>[];
}

interface RskSwapPoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  duration(_overrides?: CallOverrides): Promise<BigNumber>;
  earned(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lastTimeRewardApplicable(_overrides?: CallOverrides): Promise<BigNumber>;
  lastUpdateTime(_overrides?: CallOverrides): Promise<BigNumber>;
  mpToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  periodFinish(_overrides?: CallOverrides): Promise<BigNumber>;
  rewardPerToken(_overrides?: CallOverrides): Promise<BigNumber>;
  rewardPerTokenStored(_overrides?: CallOverrides): Promise<BigNumber>;
  rewardRate(_overrides?: CallOverrides): Promise<BigNumber>;
  rewards(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  rskSwapToken(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  userRewardPerTokenPaid(
    arg0: string,
    _overrides?: CallOverrides
  ): Promise<BigNumber>;
}

interface RskSwapPoolTransactions {
  claimReward(_overrides?: Overrides): Promise<void>;
  setParams(
    _mpTokenAddress: string,
    _rskSwapTokenAddress: string,
    _duration: BigNumberish,
    _overrides?: Overrides
  ): Promise<void>;
  stake(amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  withdraw(amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  withdrawAndClaim(_overrides?: Overrides): Promise<void>;
}

export interface RskSwapPool
  extends _TypedMoneypContract<RskSwapPoolCalls, RskSwapPoolTransactions> {
  readonly filters: {
    MPTokenAddressChanged(_mpTokenAddress?: null): EventFilter;
    OwnershipTransferred(
      previousOwner?: string | null,
      newOwner?: string | null
    ): EventFilter;
    RewardAdded(reward?: null): EventFilter;
    RewardPaid(user?: string | null, reward?: null): EventFilter;
    RskSwapTokenAddressChanged(_rskSwapTokenAddress?: null): EventFilter;
    Staked(user?: string | null, amount?: null): EventFilter;
    Withdrawn(user?: string | null, amount?: null): EventFilter;
  };
  extractEvents(
    logs: Log[],
    name: "MPTokenAddressChanged"
  ): _TypedLogDescription<{ _mpTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "OwnershipTransferred"
  ): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(
    logs: Log[],
    name: "RewardAdded"
  ): _TypedLogDescription<{ reward: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "RewardPaid"
  ): _TypedLogDescription<{ user: string; reward: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "RskSwapTokenAddressChanged"
  ): _TypedLogDescription<{ _rskSwapTokenAddress: string }>[];
  extractEvents(
    logs: Log[],
    name: "Staked"
  ): _TypedLogDescription<{ user: string; amount: BigNumber }>[];
  extractEvents(
    logs: Log[],
    name: "Withdrawn"
  ): _TypedLogDescription<{ user: string; amount: BigNumber }>[];
}
