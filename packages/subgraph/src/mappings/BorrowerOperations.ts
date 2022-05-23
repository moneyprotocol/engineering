import { VaultManager } from "../../generated/VaultManager/VaultManager";
import {
  BorrowerOperations,
  VaultUpdated
} from "../../generated/templates/BorrowerOperations/BorrowerOperations";

import { getVaultOperationFromBorrowerOperation } from "../types/VaultOperation";

import { updateVault } from "../entities/Vault";

export function handleVaultUpdated(event: VaultUpdated): void {
  let borrowerOperations = BorrowerOperations.bind(event.address);
  let vaultManagerAddress = borrowerOperations.vaultManager();
  let vaultManager = VaultManager.bind(vaultManagerAddress);
  let snapshots = vaultManager.rewardSnapshots(event.params._borrower);

  updateVault(
    event,
    getVaultOperationFromBorrowerOperation(event.params.operation),
    event.params._borrower,
    event.params._coll,
    event.params._debt,
    event.params.stake,
    snapshots.value0,
    snapshots.value1
  );
}
