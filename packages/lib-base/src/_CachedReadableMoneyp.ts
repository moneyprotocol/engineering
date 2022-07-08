import { Decimal } from "./Decimal";
import { Fees } from "./Fees";
import { MPStake } from "./MPStake";
import { StabilityDeposit } from "./StabilityDeposit";
import { Vault, VaultWithPendingRedistribution, UserVault } from "./Vault";
import { FrontendStatus, ReadableMoneyp, VaultListingParams } from "./ReadableMoneyp";

/** @internal */
export type _ReadableMoneypWithExtraParamsBase<T extends unknown[]> = {
  [P in keyof ReadableMoneyp]: ReadableMoneyp[P] extends (...params: infer A) => infer R
    ? (...params: [...originalParams: A, ...extraParams: T]) => R
    : never;
};

/** @internal */
export type _MoneypReadCacheBase<T extends unknown[]> = {
  [P in keyof ReadableMoneyp]: ReadableMoneyp[P] extends (...args: infer A) => Promise<infer R>
    ? (...params: [...originalParams: A, ...extraParams: T]) => R | undefined
    : never;
};

// Overloads get lost in the mapping, so we need to define them again...

/** @internal */
export interface _ReadableMoneypWithExtraParams<T extends unknown[]>
  extends _ReadableMoneypWithExtraParamsBase<T> {
  getVaults(
    params: VaultListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<VaultWithPendingRedistribution[]>;

  getVaults(params: VaultListingParams, ...extraParams: T): Promise<UserVault[]>;
}

/** @internal */
export interface _MoneypReadCache<T extends unknown[]> extends _MoneypReadCacheBase<T> {
  getVaults(
    params: VaultListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): VaultWithPendingRedistribution[] | undefined;

  getVaults(params: VaultListingParams, ...extraParams: T): UserVault[] | undefined;
}

/** @internal */
export class _CachedReadableMoneyp<T extends unknown[]>
  implements _ReadableMoneypWithExtraParams<T> {
  private _readable: _ReadableMoneypWithExtraParams<T>;
  private _cache: _MoneypReadCache<T>;

  constructor(readable: _ReadableMoneypWithExtraParams<T>, cache: _MoneypReadCache<T>) {
    this._readable = readable;
    this._cache = cache;
  }

  async getTotalRedistributed(...extraParams: T): Promise<Vault> {
    return (
      this._cache.getTotalRedistributed(...extraParams) ??
      this._readable.getTotalRedistributed(...extraParams)
    );
  }

  async getVaultBeforeRedistribution(
    address?: string,
    ...extraParams: T
  ): Promise<VaultWithPendingRedistribution> {
    return (
      this._cache.getVaultBeforeRedistribution(address, ...extraParams) ??
      this._readable.getVaultBeforeRedistribution(address, ...extraParams)
    );
  }

  async getVault(address?: string, ...extraParams: T): Promise<UserVault> {
    const [vaultBeforeRedistribution, totalRedistributed] = await Promise.all([
      this.getVaultBeforeRedistribution(address, ...extraParams),
      this.getTotalRedistributed(...extraParams)
    ]);

    return vaultBeforeRedistribution.applyRedistribution(totalRedistributed);
  }

  async getNumberOfVaults(...extraParams: T): Promise<number> {
    return (
      this._cache.getNumberOfVaults(...extraParams) ??
      this._readable.getNumberOfVaults(...extraParams)
    );
  }

  async getPrice(...extraParams: T): Promise<Decimal> {
    return this._cache.getPrice(...extraParams) ?? this._readable.getPrice(...extraParams);
  }

  async getTotal(...extraParams: T): Promise<Vault> {
    return this._cache.getTotal(...extraParams) ?? this._readable.getTotal(...extraParams);
  }

  async getStabilityDeposit(address?: string, ...extraParams: T): Promise<StabilityDeposit> {
    return (
      this._cache.getStabilityDeposit(address, ...extraParams) ??
      this._readable.getStabilityDeposit(address, ...extraParams)
    );
  }

  async getRemainingStabilityPoolMPReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingStabilityPoolMPReward(...extraParams) ??
      this._readable.getRemainingStabilityPoolMPReward(...extraParams)
    );
  }

  async getBPDInStabilityPool(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getBPDInStabilityPool(...extraParams) ??
      this._readable.getBPDInStabilityPool(...extraParams)
    );
  }

  async getBPDBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getBPDBalance(address, ...extraParams) ??
      this._readable.getBPDBalance(address, ...extraParams)
    );
  }

  async getMPBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getMPBalance(address, ...extraParams) ??
      this._readable.getMPBalance(address, ...extraParams)
    );
  }

  async getRskSwapTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRskSwapTokenBalance(address, ...extraParams) ??
      this._readable.getRskSwapTokenBalance(address, ...extraParams)
    );
  }

  async getRskSwapTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRskSwapTokenAllowance(address, ...extraParams) ??
      this._readable.getRskSwapTokenAllowance(address, ...extraParams)
    );
  }

  async getRemainingLiquidityMiningMPReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingLiquidityMiningMPReward(...extraParams) ??
      this._readable.getRemainingLiquidityMiningMPReward(...extraParams)
    );
  }

  async getLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLiquidityMiningStake(address, ...extraParams) ??
      this._readable.getLiquidityMiningStake(address, ...extraParams)
    );
  }

  async getTotalStakedRskSwapTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedRskSwapTokens(...extraParams) ??
      this._readable.getTotalStakedRskSwapTokens(...extraParams)
    );
  }

  async getLiquidityMiningMPReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLiquidityMiningMPReward(address, ...extraParams) ??
      this._readable.getLiquidityMiningMPReward(address, ...extraParams)
    );
  }

  async getCollateralSurplusBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getCollateralSurplusBalance(address, ...extraParams) ??
      this._readable.getCollateralSurplusBalance(address, ...extraParams)
    );
  }

  getVaults(
    params: VaultListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<VaultWithPendingRedistribution[]>;

  getVaults(params: VaultListingParams, ...extraParams: T): Promise<UserVault[]>;

  async getVaults(params: VaultListingParams, ...extraParams: T): Promise<UserVault[]> {
    const { beforeRedistribution, ...restOfParams } = params;

    const [totalRedistributed, vaults] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(...extraParams),
      this._cache.getVaults({ beforeRedistribution: true, ...restOfParams }, ...extraParams) ??
        this._readable.getVaults({ beforeRedistribution: true, ...restOfParams }, ...extraParams)
    ]);

    if (totalRedistributed) {
      return vaults.map(vault => vault.applyRedistribution(totalRedistributed));
    } else {
      return vaults;
    }
  }

  async getFees(...extraParams: T): Promise<Fees> {
    return this._cache.getFees(...extraParams) ?? this._readable.getFees(...extraParams);
  }

  async getMPStake(address?: string, ...extraParams: T): Promise<MPStake> {
    return (
      this._cache.getMPStake(address, ...extraParams) ??
      this._readable.getMPStake(address, ...extraParams)
    );
  }

  async getTotalStakedMP(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedMP(...extraParams) ??
      this._readable.getTotalStakedMP(...extraParams)
    );
  }

  async getFrontendStatus(address?: string, ...extraParams: T): Promise<FrontendStatus> {
    return (
      this._cache.getFrontendStatus(address, ...extraParams) ??
      this._readable.getFrontendStatus(address, ...extraParams)
    );
  }
}
