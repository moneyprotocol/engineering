enum BorrowerOperation {
  openVault,
  closeVault,
  adjustVault
}

export function getVaultOperationFromBorrowerOperation(operation: BorrowerOperation): string {
  switch (operation) {
    case BorrowerOperation.openVault:
      return "openVault";
    case BorrowerOperation.closeVault:
      return "closeVault";
    case BorrowerOperation.adjustVault:
      return "adjustVault";
  }

  // AssemblyScript can't tell we will never reach this, so it insists on a return statement
  return "unreached";
}

export function isBorrowerOperation(vaultOperation: string): boolean {
  return (
    vaultOperation == "openVault" ||
    vaultOperation == "closeVault" ||
    vaultOperation == "adjustVault"
  );
}

enum VaultManagerOperation {
  applyPendingRewards,
  liquidateInNormalMode,
  liquidateInRecoveryMode,
  redeemCollateral
}

export function getVaultOperationFromVaultManagerOperation(
  operation: VaultManagerOperation
): string {
  switch (operation) {
    case VaultManagerOperation.applyPendingRewards:
      return "accrueRewards";
    case VaultManagerOperation.liquidateInNormalMode:
      return "liquidateInNormalMode";
    case VaultManagerOperation.liquidateInRecoveryMode:
      return "liquidateInRecoveryMode";
    case VaultManagerOperation.redeemCollateral:
      return "redeemCollateral";
  }

  // AssemblyScript can't tell we will never reach this, so it insists on a return statement
  return "unreached";
}

export function isLiquidation(vaultOperation: string): boolean {
  return vaultOperation == "liquidateInNormalMode" || vaultOperation == "liquidateInRecoveryMode";
}

export function isRecoveryModeLiquidation(vaultOperation: string): boolean {
  return vaultOperation == "liquidateInRecoveryMode";
}

export function isRedemption(vaultOperation: string): boolean {
  return vaultOperation == "redeemCollateral";
}
