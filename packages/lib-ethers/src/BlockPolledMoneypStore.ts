import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import {
  Decimal,
  MoneypStoreState,
  MoneypStoreBaseState,
  VaultWithPendingRedistribution,
  StabilityDeposit,
  MPStake,
  MoneypStore
} from "@liquity/lib-base";

import { ReadableBitcoinsMoneyp } from "./ReadableBitcoinsMoneyp";
import {
  BitcoinsMoneypConnection,
  _getBlockTimestamp,
  _getProvider
} from "./BitcoinsMoneypConnection";
import { BitcoinsCallOverrides, BitcoinsProvider } from "./types";

/**
 * Extra state added to {@link @liquity/lib-base#MoneypStoreState} by
 * {@link BlockPolledMoneypStore}.
 *
 * @public
 */
export interface BlockPolledMoneypStoreExtraState {
  /**
   * Number of block that the store state was fetched from.
   *
   * @remarks
   * May be undefined when the store state is fetched for the first time.
   */
  blockTag?: number;

  /**
   * Timestamp of latest block (number of seconds since epoch).
   */
  blockTimestamp: number;
}

/**
 * The type of {@link BlockPolledMoneypStore}'s
 * {@link @liquity/lib-base#MoneypStore.state | state}.
 *
 * @public
 */
export type BlockPolledMoneypStoreState = MoneypStoreState<BlockPolledMoneypStoreExtraState>;

type Resolved<T> = T extends Promise<infer U> ? U : T;
type ResolvedValues<T> = { [P in keyof T]: Resolved<T[P]> };

const promiseAllValues = <T>(object: T) => {
  const keys = Object.keys(object);

  return Promise.all(Object.values(object)).then(values =>
    Object.fromEntries(values.map((value, i) => [keys[i], value]))
  ) as Promise<ResolvedValues<T>>;
};

const decimalify = (bigNumber: BigNumber) => Decimal.fromBigNumberString(bigNumber.toHexString());

/**
 * Bitcoins-based {@link @liquity/lib-base#MoneypStore} that updates state whenever there's a new
 * block.
 *
 * @public
 */
export class BlockPolledMoneypStore extends MoneypStore<BlockPolledMoneypStoreExtraState> {
  readonly connection: BitcoinsMoneypConnection;

  private readonly _readable: ReadableBitcoinsMoneyp;
  private readonly _provider: BitcoinsProvider;

  constructor(readable: ReadableBitcoinsMoneyp) {
    super();

    this.connection = readable.connection;
    this._readable = readable;
    this._provider = _getProvider(readable.connection);
  }

  private async _getRiskiestVaultBeforeRedistribution(
    overrides?: BitcoinsCallOverrides
  ): Promise<VaultWithPendingRedistribution> {
    const riskiestVaults = await this._readable.getVaults(
      { first: 1, sortedBy: "ascendingCollateralRatio", beforeRedistribution: true },
      overrides
    );

    if (riskiestVaults.length === 0) {
      return new VaultWithPendingRedistribution(AddressZero, "nonExistent");
    }

    return riskiestVaults[0];
  }

  private async _get(
    blockTag?: number
  ): Promise<[baseState: MoneypStoreBaseState, extraState: BlockPolledMoneypStoreExtraState]> {
    const { userAddress, frontendTag } = this.connection;

    const {
      blockTimestamp,
      createFees,
      calculateRemainingMP,
      ...baseState
    } = await promiseAllValues({
      blockTimestamp: _getBlockTimestamp(this.connection, blockTag),
      createFees: this._readable._getFeesFactory({ blockTag }),
      calculateRemainingMP: this._readable._getRemainingLiquidityMiningMPRewardCalculator({
        blockTag
      }),

      price: this._readable.getPrice({ blockTag }),
      numberOfVaults: this._readable.getNumberOfVaults({ blockTag }),
      totalRedistributed: this._readable.getTotalRedistributed({ blockTag }),
      total: this._readable.getTotal({ blockTag }),
      bpdInStabilityPool: this._readable.getBPDInStabilityPool({ blockTag }),
      totalStakedMP: this._readable.getTotalStakedMP({ blockTag }),
      _riskiestVaultBeforeRedistribution: this._getRiskiestVaultBeforeRedistribution({ blockTag }),
      totalStakedUniTokens: this._readable.getTotalStakedUniTokens({ blockTag }),
      remainingStabilityPoolMPReward: this._readable.getRemainingStabilityPoolMPReward({
        blockTag
      }),

      frontend: frontendTag
        ? this._readable.getFrontendStatus(frontendTag, { blockTag })
        : { status: "unregistered" as const },

      ...(userAddress
        ? {
            accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
            bpdBalance: this._readable.getBPDBalance(userAddress, { blockTag }),
            mpBalance: this._readable.getMPBalance(userAddress, { blockTag }),
            uniTokenBalance: this._readable.getUniTokenBalance(userAddress, { blockTag }),
            uniTokenAllowance: this._readable.getUniTokenAllowance(userAddress, { blockTag }),
            liquidityMiningStake: this._readable.getLiquidityMiningStake(userAddress, { blockTag }),
            liquidityMiningMPReward: this._readable.getLiquidityMiningMPReward(userAddress, {
              blockTag
            }),
            collateralSurplusBalance: this._readable.getCollateralSurplusBalance(userAddress, {
              blockTag
            }),
            vaultBeforeRedistribution: this._readable.getVaultBeforeRedistribution(userAddress, {
              blockTag
            }),
            stabilityDeposit: this._readable.getStabilityDeposit(userAddress, { blockTag }),
            mpStake: this._readable.getMPStake(userAddress, { blockTag }),
            ownFrontend: this._readable.getFrontendStatus(userAddress, { blockTag })
          }
        : {
            accountBalance: Decimal.ZERO,
            bpdBalance: Decimal.ZERO,
            mpBalance: Decimal.ZERO,
            uniTokenBalance: Decimal.ZERO,
            uniTokenAllowance: Decimal.ZERO,
            liquidityMiningStake: Decimal.ZERO,
            liquidityMiningMPReward: Decimal.ZERO,
            collateralSurplusBalance: Decimal.ZERO,
            vaultBeforeRedistribution: new VaultWithPendingRedistribution(
              AddressZero,
              "nonExistent"
            ),
            stabilityDeposit: new StabilityDeposit(
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO,
              AddressZero
            ),
            mpStake: new MPStake(),
            ownFrontend: { status: "unregistered" as const }
          })
    });

    return [
      {
        ...baseState,
        _feesInNormalMode: createFees(blockTimestamp, false),
        remainingLiquidityMiningMPReward: calculateRemainingMP(blockTimestamp)
      },
      {
        blockTag,
        blockTimestamp
      }
    ];
  }

  /** @internal @override */
  protected _doStart(): () => void {
    this._get().then(state => {
      if (!this._loaded) {
        this._load(...state);
      }
    });

    const blockListener = async (blockTag: number) => {
      const state = await this._get(blockTag);

      if (this._loaded) {
        this._update(...state);
      } else {
        this._load(...state);
      }
    };

    this._provider.on("block", blockListener);

    return () => {
      this._provider.off("block", blockListener);
    };
  }

  /** @internal @override */
  protected _reduceExtra(
    oldState: BlockPolledMoneypStoreExtraState,
    stateUpdate: Partial<BlockPolledMoneypStoreExtraState>
  ): BlockPolledMoneypStoreExtraState {
    return {
      blockTag: stateUpdate.blockTag ?? oldState.blockTag,
      blockTimestamp: stateUpdate.blockTimestamp ?? oldState.blockTimestamp
    };
  }
}
