import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import {
  Decimal,
  MoneypStoreState,
  MoneypStoreBaseState,
  VaultWithPendingRedistribution,
  StabilityDeposit,
  MPStake,
  MoneypStore,
} from "@money-protocol/lib-base";

import { ReadableBitcoinsMoneyp } from "./ReadableBitcoinsMoneyp";
import {
  BitcoinsMoneypConnection,
  _getBlockTimestamp,
  _getProvider,
} from "./BitcoinsMoneypConnection";
import { BitcoinsCallOverrides, BitcoinsProvider } from "./types";

/**
 * Extra state added to {@link @money-protocol/lib-base#MoneypStoreState} by
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
 * {@link @money-protocol/lib-base#MoneypStore.state | state}.
 *
 * @public
 */
export type BlockPolledMoneypStoreState =
  MoneypStoreState<BlockPolledMoneypStoreExtraState>;

type Resolved<T> = T extends Promise<infer U> ? U : T;
type ResolvedValues<T> = { [P in keyof T]: Resolved<T[P]> };

const promiseAllValues = <T>(object: T) => {
  const keys = Object.keys(object);

  return Promise.all(Object.values(object)).then((values) =>
    Object.fromEntries(values.map((value, i) => [keys[i], value]))
  ) as Promise<ResolvedValues<T>>;
};

const decimalify = (bigNumber: BigNumber) =>
  Decimal.fromBigNumberString(bigNumber.toHexString());

/**
 * Bitcoins-based {@link @money-protocol/lib-base#MoneypStore} that updates state whenever there's a new
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
      {
        first: 1,
        sortedBy: "ascendingCollateralRatio",
        beforeRedistribution: true,
      },
      overrides
    );

    if (riskiestVaults.length === 0) {
      return new VaultWithPendingRedistribution(AddressZero, "nonExistent");
    }

    return riskiestVaults[0];
  }

  private async _get(
    blockTag?: number
  ): Promise<
    [
      baseState: MoneypStoreBaseState,
      extraState: BlockPolledMoneypStoreExtraState
    ]
  > {
    const { userAddress, frontendTag } = this.connection;

    const errCatch = (key: string) => (err: unknown) => {
      console.error(`[BPMS] _get ${blockTag} ${key}:`, err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return err as any;
    };

    const { blockTimestamp, createFees, ...baseState } = await promiseAllValues(
      {
        blockTimestamp: _getBlockTimestamp(this.connection, blockTag).catch(
          errCatch("blockTimestamp")
        ),
        createFees: this._readable
          ._getFeesFactory({ blockTag })
          .catch(errCatch("createFees")),

        price: this._readable.getPrice({ blockTag }).catch(errCatch("price")),
        numberOfVaults: this._readable
          .getNumberOfVaults({ blockTag })
          .catch(errCatch("numberOfVaults")),
        totalRedistributed: this._readable
          .getTotalRedistributed({ blockTag })
          .catch(errCatch("totalRedistributed")),
        total: this._readable.getTotal({ blockTag }).catch(errCatch("total")),
        bpdInStabilityPool: this._readable
          .getBPDInStabilityPool({ blockTag })
          .catch(errCatch("bpdInStabilityPool")),
        totalStakedMP: this._readable
          .getTotalStakedMP({ blockTag })
          .catch(errCatch("totalStakedMP")),
        _riskiestVaultBeforeRedistribution:
          this._getRiskiestVaultBeforeRedistribution({ blockTag }).catch(
            errCatch("_riskiestVaultBeforeRedistribution")
          ),
        remainingStabilityPoolMPReward: this._readable
          .getRemainingStabilityPoolMPReward({
            blockTag,
          })
          .catch(errCatch("remainingStabilityPoolMPReward")),

        frontend: frontendTag
          ? this._readable
              .getFrontendStatus(frontendTag, { blockTag })
              .catch(errCatch("frontend"))
          : { status: "unregistered" as const },

        ...(userAddress
          ? {
              accountBalance: this._provider
                .getBalance(userAddress, blockTag)
                .then(decimalify)
                .catch(errCatch("accountBalance")),
              bpdBalance: this._readable
                .getBPDBalance(userAddress, { blockTag })
                .catch(errCatch("bpdBalance")),
              mpBalance: this._readable
                .getMPBalance(userAddress, { blockTag })
                .catch(errCatch("mpBalance")),
              collateralSurplusBalance: this._readable
                .getCollateralSurplusBalance(userAddress, {
                  blockTag,
                })
                .catch(errCatch("collateralSurplusBalance")),
              vaultBeforeRedistribution: this._readable
                .getVaultBeforeRedistribution(userAddress, {
                  blockTag,
                })
                .catch(errCatch("vaultBeforeRedistribution")),
              stabilityDeposit: this._readable
                .getStabilityDeposit(userAddress, { blockTag })
                .catch(errCatch("stabilityDeposit")),
              mpStake: this._readable
                .getMPStake(userAddress, { blockTag })
                .catch(errCatch("mpStake")),
              ownFrontend: this._readable
                .getFrontendStatus(userAddress, { blockTag })
                .catch(errCatch("ownFrontend")),
            }
          : {
              accountBalance: Decimal.ZERO,
              bpdBalance: Decimal.ZERO,
              mpBalance: Decimal.ZERO,
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
              ownFrontend: { status: "unregistered" as const },
            }),
      }
    );

    return [
      {
        ...baseState,
        _feesInNormalMode: createFees(blockTimestamp, false),
      },
      {
        blockTag,
        blockTimestamp,
      },
    ];
  }

  /** @internal @override */
  protected _doStart(): () => void {
    console.log("[BPMS] _doStart!");
    this._get()
      .then((state) => {
        console.log("[BPMS] _get state:", state);
        if (!this._loaded) {
          this._load(...state);
        }
      })
      .catch((error) => {
        console.error("[BPMS] _get error:", error);
      });

    const blockListener = async (blockTag: number) => {
      console.log("[BPMS] blockListener blockTag:", blockTag);
      const state = await this._get(blockTag);
      console.log("[BPMS] blockListener _get state:", state);

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
      blockTimestamp: stateUpdate.blockTimestamp ?? oldState.blockTimestamp,
    };
  }
}
