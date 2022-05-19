import { BigNumber } from "@ethersproject/bignumber";
import { Event } from "@ethersproject/contracts";

import {
  Decimal,
  ObservableMoneyp,
  StabilityDeposit,
  Vault,
  VaultWithPendingRedistribution
} from "@liquity/lib-base";

import { _getContracts, _requireAddress } from "./BitcoinsMoneypConnection";
import { ReadableBitcoinsMoneyp } from "./ReadableBitcoinsMoneyp";

const debouncingDelayMs = 50;

const debounce = (listener: (latestBlock: number) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  let latestBlock = 0;

  return (...args: unknown[]) => {
    const event = args[args.length - 1] as Event;

    if (event.blockNumber !== undefined && event.blockNumber > latestBlock) {
      latestBlock = event.blockNumber;
    }

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      listener(latestBlock);
      timeoutId = undefined;
    }, debouncingDelayMs);
  };
};

/** @alpha */
export class ObservableBitcoinsMoneyp implements ObservableMoneyp {
  private readonly _readable: ReadableBitcoinsMoneyp;

  constructor(readable: ReadableBitcoinsMoneyp) {
    this._readable = readable;
  }

  watchTotalRedistributed(
    onTotalRedistributedChanged: (totalRedistributed: Vault) => void
  ): () => void {
    const { activePool, defaultPool } = _getContracts(this._readable.connection);
    const etherSent = activePool.filters.BitcoinSent();

    const redistributionListener = debounce((blockTag: number) => {
      this._readable.getTotalRedistributed({ blockTag }).then(onTotalRedistributedChanged);
    });

    const etherSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === defaultPool.address) {
        redistributionListener(event);
      }
    };

    activePool.on(etherSent, etherSentListener);

    return () => {
      activePool.removeListener(etherSent, etherSentListener);
    };
  }

  watchVaultWithoutRewards(
    onVaultChanged: (vault: VaultWithPendingRedistribution) => void,
    address?: string
  ): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { vaultManager, borrowerOperations } = _getContracts(this._readable.connection);
    const vaultUpdatedByVaultManager = vaultManager.filters.VaultUpdated(address);
    const vaultUpdatedByBorrowerOperations = borrowerOperations.filters.VaultUpdated(address);

    const vaultListener = debounce((blockTag: number) => {
      this._readable.getVaultBeforeRedistribution(address, { blockTag }).then(onVaultChanged);
    });

    vaultManager.on(vaultUpdatedByVaultManager, vaultListener);
    borrowerOperations.on(vaultUpdatedByBorrowerOperations, vaultListener);

    return () => {
      vaultManager.removeListener(vaultUpdatedByVaultManager, vaultListener);
      borrowerOperations.removeListener(vaultUpdatedByBorrowerOperations, vaultListener);
    };
  }

  watchNumberOfVaults(onNumberOfVaultsChanged: (numberOfVaults: number) => void): () => void {
    const { vaultManager } = _getContracts(this._readable.connection);
    const { VaultUpdated } = vaultManager.filters;
    const vaultUpdated = VaultUpdated();

    const vaultUpdatedListener = debounce((blockTag: number) => {
      this._readable.getNumberOfVaults({ blockTag }).then(onNumberOfVaultsChanged);
    });

    vaultManager.on(vaultUpdated, vaultUpdatedListener);

    return () => {
      vaultManager.removeListener(vaultUpdated, vaultUpdatedListener);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watchPrice(onPriceChanged: (price: Decimal) => void): () => void {
    // TODO revisit
    // We no longer have our own PriceUpdated events. If we want to implement this in an event-based
    // manner, we'll need to listen to aggregator events directly. Or we could do polling.
    throw new Error("Method not implemented.");
  }

  watchTotal(onTotalChanged: (total: Vault) => void): () => void {
    const { vaultManager } = _getContracts(this._readable.connection);
    const { VaultUpdated } = vaultManager.filters;
    const vaultUpdated = VaultUpdated();

    const totalListener = debounce((blockTag: number) => {
      this._readable.getTotal({ blockTag }).then(onTotalChanged);
    });

    vaultManager.on(vaultUpdated, totalListener);

    return () => {
      vaultManager.removeListener(vaultUpdated, totalListener);
    };
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (stabilityDeposit: StabilityDeposit) => void,
    address?: string
  ): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { activePool, stabilityPool } = _getContracts(this._readable.connection);
    const { UserDepositChanged } = stabilityPool.filters;
    const { BitcoinSent } = activePool.filters;

    const userDepositChanged = UserDepositChanged(address);
    const etherSent = BitcoinSent();

    const depositListener = debounce((blockTag: number) => {
      this._readable.getStabilityDeposit(address, { blockTag }).then(onStabilityDepositChanged);
    });

    const etherSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === stabilityPool.address) {
        // Liquidation while Stability Pool has some deposits
        // There may be new gains
        depositListener(event);
      }
    };

    stabilityPool.on(userDepositChanged, depositListener);
    activePool.on(etherSent, etherSentListener);

    return () => {
      stabilityPool.removeListener(userDepositChanged, depositListener);
      activePool.removeListener(etherSent, etherSentListener);
    };
  }

  watchBPDInStabilityPool(
    onBPDInStabilityPoolChanged: (bpdInStabilityPool: Decimal) => void
  ): () => void {
    const { bpdToken, stabilityPool } = _getContracts(this._readable.connection);
    const { Transfer } = bpdToken.filters;

    const transferBPDFromStabilityPool = Transfer(stabilityPool.address);
    const transferBPDToStabilityPool = Transfer(null, stabilityPool.address);

    const stabilityPoolBPDFilters = [transferBPDFromStabilityPool, transferBPDToStabilityPool];

    const stabilityPoolBPDListener = debounce((blockTag: number) => {
      this._readable.getBPDInStabilityPool({ blockTag }).then(onBPDInStabilityPoolChanged);
    });

    stabilityPoolBPDFilters.forEach(filter => bpdToken.on(filter, stabilityPoolBPDListener));

    return () =>
      stabilityPoolBPDFilters.forEach(filter =>
        bpdToken.removeListener(filter, stabilityPoolBPDListener)
      );
  }

  watchBPDBalance(onBPDBalanceChanged: (balance: Decimal) => void, address?: string): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { bpdToken } = _getContracts(this._readable.connection);
    const { Transfer } = bpdToken.filters;
    const transferBPDFromUser = Transfer(address);
    const transferBPDToUser = Transfer(null, address);

    const bpdTransferFilters = [transferBPDFromUser, transferBPDToUser];

    const bpdTransferListener = debounce((blockTag: number) => {
      this._readable.getBPDBalance(address, { blockTag }).then(onBPDBalanceChanged);
    });

    bpdTransferFilters.forEach(filter => bpdToken.on(filter, bpdTransferListener));

    return () =>
      bpdTransferFilters.forEach(filter => bpdToken.removeListener(filter, bpdTransferListener));
  }
}
