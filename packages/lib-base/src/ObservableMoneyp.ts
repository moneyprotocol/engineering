import { Decimal } from "./Decimal";
import { Vault, VaultWithPendingRedistribution } from "./Vault";
import { StabilityDeposit } from "./StabilityDeposit";

/** @alpha */
export interface ObservableMoneyp {
  watchTotalRedistributed(
    onTotalRedistributedChanged: (totalRedistributed: Vault) => void
  ): () => void;

  watchVaultWithoutRewards(
    onVaultChanged: (vault: VaultWithPendingRedistribution) => void,
    address?: string
  ): () => void;

  watchNumberOfVaults(onNumberOfVaultsChanged: (numberOfVaults: number) => void): () => void;

  watchPrice(onPriceChanged: (price: Decimal) => void): () => void;

  watchTotal(onTotalChanged: (total: Vault) => void): () => void;

  watchStabilityDeposit(
    onStabilityDepositChanged: (stabilityDeposit: StabilityDeposit) => void,
    address?: string
  ): () => void;

  watchBPDInStabilityPool(
    onBPDInStabilityPoolChanged: (bpdInStabilityPool: Decimal) => void
  ): () => void;

  watchBPDBalance(onBPDBalanceChanged: (balance: Decimal) => void, address?: string): () => void;
}
