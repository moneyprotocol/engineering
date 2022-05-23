import {
  VaultManager,
  VaultUpdated,
  VaultLiquidated,
  Liquidation,
  Redemption,
  BorrowerOperationsAddressChanged,
  StabilityPoolAddressChanged,
  CollSurplusPoolAddressChanged,
  PriceFeedAddressChanged
} from "../../generated/VaultManager/VaultManager";
import { BorrowerOperations, StabilityPool, CollSurplusPool } from "../../generated/templates";

import { BIGINT_ZERO } from "../utils/bignumbers";

import { getVaultOperationFromVaultManagerOperation } from "../types/VaultOperation";

import { finishCurrentLiquidation } from "../entities/Liquidation";
import { finishCurrentRedemption } from "../entities/Redemption";
import { updateVault } from "../entities/Vault";
import { updatePriceFeedAddress, updateTotalRedistributed } from "../entities/Global";

export function handleBorrowerOperationsAddressChanged(
  event: BorrowerOperationsAddressChanged
): void {
  BorrowerOperations.create(event.params._newBorrowerOperationsAddress);
}

export function handleStabilityPoolAddressChanged(event: StabilityPoolAddressChanged): void {
  StabilityPool.create(event.params._stabilityPoolAddress);
}

export function handleCollSurplusPoolAddressChanged(event: CollSurplusPoolAddressChanged): void {
  CollSurplusPool.create(event.params._collSurplusPoolAddress);
}

export function handlePriceFeedAddressChanged(event: PriceFeedAddressChanged): void {
  updatePriceFeedAddress(event.params._newPriceFeedAddress);
}

export function handleVaultUpdated(event: VaultUpdated): void {
  let vaultManager = VaultManager.bind(event.address);
  let snapshots = vaultManager.rewardSnapshots(event.params._borrower);

  updateVault(
    event,
    getVaultOperationFromVaultManagerOperation(event.params._operation),
    event.params._borrower,
    event.params._coll,
    event.params._debt,
    event.params._stake,
    snapshots.value0,
    snapshots.value1
  );
}

export function handleVaultLiquidated(event: VaultLiquidated): void {
  updateVault(
    event,
    "accrueRewards",
    event.params._borrower,
    event.params._coll,
    event.params._debt,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO
  );

  updateVault(
    event,
    getVaultOperationFromVaultManagerOperation(event.params._operation),
    event.params._borrower,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO
  );
}

export function handleLiquidation(event: Liquidation): void {
  let vaultManager = VaultManager.bind(event.address);

  finishCurrentLiquidation(
    event,
    event.params._liquidatedColl,
    event.params._liquidatedDebt,
    event.params._collGasCompensation,
    event.params._BPDGasCompensation
  );

  updateTotalRedistributed(vaultManager.B_RBTC(), vaultManager.B_BPDDebt());
}

export function handleRedemption(event: Redemption): void {
  finishCurrentRedemption(
    event,
    event.params._attemptedBPDAmount,
    event.params._actualBPDAmount,
    event.params._RBTCSent
  );
}
