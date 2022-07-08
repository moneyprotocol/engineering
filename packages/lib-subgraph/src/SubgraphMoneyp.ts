import fetch from "cross-fetch";
import { ApolloClient, gql, HttpLink, InMemoryCache, NormalizedCacheObject } from "@apollo/client";
import { getAddress } from "@ethersproject/address";

import {
  Decimal,
  Fees,
  FrontendStatus,
  MPStake,
  ObservableMoneyp,
  ReadableMoneyp,
  StabilityDeposit,
  Vault,
  VaultListingParams,
  VaultWithPendingRedistribution,
  UserVault,
  _emptyVault
} from "@moneyprotocol/lib-base";

import { OrderDirection } from "../types/globalTypes";
import { Global } from "../types/Global";
import { BlockNumberDummy, BlockNumberDummyVariables } from "../types/BlockNumberDummy";
import { VaultRawFields } from "../types/VaultRawFields";
import { Vaults, VaultsVariables } from "../types/Vaults";
import { VaultWithoutRewards, VaultWithoutRewardsVariables } from "../types/VaultWithoutRewards";

import { Query } from "./Query";

const normalizeAddress = (address?: string) => {
  if (address === undefined) {
    throw new Error("An address is required");
  }

  return address.toLowerCase();
};

const decimalify = (bigNumberString: string) => Decimal.fromBigNumberString(bigNumberString);

const queryGlobal = gql`
  query Global {
    global(id: "only") {
      id
      numberOfOpenVaults
      rawTotalRedistributedCollateral
      rawTotalRedistributedDebt

      currentSystemState {
        id
        price
        totalCollateral
        totalDebt
        tokensInStabilityPool
      }
    }
  }
`;

const numberOfVaults = new Query<number, Global>(
  queryGlobal,
  ({ data: { global } }) => global?.numberOfOpenVaults ?? 0
);

const totalRedistributed = new Query<Vault, Global>(queryGlobal, ({ data: { global } }) => {
  if (global) {
    const { rawTotalRedistributedCollateral, rawTotalRedistributedDebt } = global;

    return new Vault(
      decimalify(rawTotalRedistributedCollateral),
      decimalify(rawTotalRedistributedDebt)
    );
  } else {
    return _emptyVault;
  }
});

const price = new Query<Decimal, Global>(queryGlobal, ({ data: { global } }) =>
  Decimal.from(global?.currentSystemState?.price ?? 200)
);

const total = new Query<Vault, Global>(queryGlobal, ({ data: { global } }) => {
  if (global?.currentSystemState) {
    const { totalCollateral, totalDebt } = global.currentSystemState;

    return new Vault(totalCollateral, totalDebt);
  } else {
    return _emptyVault;
  }
});

const tokensInStabilityPool = new Query<Decimal, Global>(queryGlobal, ({ data: { global } }) =>
  Decimal.from(global?.currentSystemState?.tokensInStabilityPool ?? 0)
);

const vaultRawFields = gql`
  fragment VaultRawFields on Vault {
    owner {
      id
    }
    status
    rawCollateral
    rawDebt
    rawStake
    rawSnapshotOfTotalRedistributedCollateral
    rawSnapshotOfTotalRedistributedDebt
  }
`;

const vaultFromRawFields = ({
  owner: { id: ownerAddress },
  status,
  rawCollateral,
  rawDebt,
  rawStake,
  rawSnapshotOfTotalRedistributedCollateral,
  rawSnapshotOfTotalRedistributedDebt
}: VaultRawFields) =>
  new VaultWithPendingRedistribution(
    getAddress(ownerAddress),
    status,
    decimalify(rawCollateral),
    decimalify(rawDebt),
    decimalify(rawStake),

    new Vault(
      decimalify(rawSnapshotOfTotalRedistributedCollateral),
      decimalify(rawSnapshotOfTotalRedistributedDebt)
    )
  );

const vaultBeforeRedistribution = new Query<
  VaultWithPendingRedistribution,
  VaultWithoutRewards,
  VaultWithoutRewardsVariables
>(
  gql`
    query VaultWithoutRewards($address: ID!) {
      user(id: $address) {
        id
        currentVault {
          id
          ...VaultRawFields
        }
      }
    }
    ${vaultRawFields}
  `,
  ({ data: { user } }, { address }) => {
    if (user?.currentVault) {
      return vaultFromRawFields(user.currentVault);
    } else {
      return new VaultWithPendingRedistribution(address, "nonExistent");
    }
  }
);

const vaults = new Query<VaultWithPendingRedistribution[], Vaults, VaultsVariables>(
  gql`
    query Vaults($orderDirection: OrderDirection!, $startingAt: Int!, $first: Int!) {
      vaults(
        where: { status: open }
        orderBy: collateralRatioSortKey
        orderDirection: $orderDirection
        skip: $startingAt
        first: $first
      ) {
        id
        ...VaultRawFields
      }
    }
    ${vaultRawFields}
  `,
  ({ data: { vaults } }) => vaults.map(vault => vaultFromRawFields(vault))
);

const blockNumberDummy = new Query<void, BlockNumberDummy, BlockNumberDummyVariables>(
  gql`
    query BlockNumberDummy($blockNumber: Int!) {
      globals(block: { number: $blockNumber }) {
        id
      }
    }
  `,
  () => {}
);

export class SubgraphMoneyp implements ReadableMoneyp, ObservableMoneyp {
  private client: ApolloClient<NormalizedCacheObject>;

  constructor(uri = "http://localhost:8000/subgraphs/name/moneyp/subgraph", pollInterval = 4000) {
    this.client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ fetch, uri }),
      defaultOptions: {
        query: { fetchPolicy: "network-only" },
        watchQuery: { fetchPolicy: "network-only", pollInterval }
      }
    });
  }

  getTotalRedistributed() {
    return totalRedistributed.get(this.client, undefined);
  }

  watchTotalRedistributed(onTotalRedistributedChanged: (totalRedistributed: Vault) => void) {
    return totalRedistributed.watch(this.client, onTotalRedistributedChanged, undefined);
  }

  getVaultBeforeRedistribution(address?: string) {
    return vaultBeforeRedistribution.get(this.client, { address: normalizeAddress(address) });
  }

  watchVaultWithoutRewards(
    onVaultChanged: (vault: VaultWithPendingRedistribution) => void,
    address?: string
  ) {
    return vaultBeforeRedistribution.watch(this.client, onVaultChanged, {
      address: normalizeAddress(address)
    });
  }

  async getVault(address?: string) {
    const [vault, totalRedistributed] = await Promise.all([
      this.getVaultBeforeRedistribution(address),
      this.getTotalRedistributed()
    ] as const);

    return vault.applyRedistribution(totalRedistributed);
  }

  getNumberOfVaults(): Promise<number> {
    return numberOfVaults.get(this.client, undefined);
  }

  watchNumberOfVaults(onNumberOfVaultsChanged: (numberOfVaults: number) => void): () => void {
    return numberOfVaults.watch(this.client, onNumberOfVaultsChanged, undefined);
  }

  getPrice() {
    return price.get(this.client, undefined);
  }

  watchPrice(onPriceChanged: (price: Decimal) => void) {
    return price.watch(this.client, onPriceChanged, undefined);
  }

  getTotal() {
    return total.get(this.client, undefined);
  }

  watchTotal(onTotalChanged: (total: Vault) => void) {
    return total.watch(this.client, onTotalChanged, undefined);
  }

  getStabilityDeposit(address?: string): Promise<StabilityDeposit> {
    throw new Error("Method not implemented.");
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (stabilityDeposit: StabilityDeposit) => void,
    address?: string
  ): () => void {
    throw new Error("Method not implemented.");
  }

  getBPDInStabilityPool() {
    return tokensInStabilityPool.get(this.client, undefined);
  }

  watchBPDInStabilityPool(onBPDInStabilityPoolChanged: (bpdInStabilityPool: Decimal) => void) {
    return tokensInStabilityPool.watch(this.client, onBPDInStabilityPoolChanged, undefined);
  }

  getBPDBalance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  watchBPDBalance(onBPDBalanceChanged: (balance: Decimal) => void, address?: string): () => void {
    throw new Error("Method not implemented.");
  }

  getMPBalance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getCollateralSurplusBalance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getVaults(
    params: VaultListingParams & { beforeRedistribution: true }
  ): Promise<VaultWithPendingRedistribution[]>;

  getVaults(params: VaultListingParams): Promise<UserVault[]>;

  async getVaults(params: VaultListingParams) {
    const { first, sortedBy, startingAt = 0, beforeRedistribution } = params;

    const [totalRedistributed, _vaults] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(),
      vaults.get(this.client, {
        first,
        startingAt,
        orderDirection:
          sortedBy === "ascendingCollateralRatio" ? OrderDirection.asc : OrderDirection.desc
      })
    ]);

    if (totalRedistributed) {
      return _vaults.map(vault => vault.applyRedistribution(totalRedistributed));
    } else {
      return _vaults;
    }
  }

  async waitForBlock(blockNumber: number) {
    for (;;) {
      try {
        await blockNumberDummy.get(this.client, { blockNumber });
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      return;
    }
  }

  getFees(): Promise<Fees> {
    throw new Error("Method not implemented.");
  }

  getMPStake(address?: string): Promise<MPStake> {
    throw new Error("Method not implemented.");
  }

  getTotalStakedMP(): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getFrontendStatus(address?: string): Promise<FrontendStatus> {
    throw new Error("Method not implemented.");
  }

  getRskSwapTokenBalance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getRskSwapTokenAllowance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getRemainingLiquidityMiningMPReward(): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getLiquidityMiningStake(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getLiquidityMiningMPReward(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getTotalStakedRskSwapTokens(): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getRemainingStabilityPoolMPReward(): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }
}
