import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";

import { Vault, VaultChange } from "../../generated/schema";

import { decimalize, BIGINT_SCALING_FACTOR, BIGINT_ZERO, DECIMAL_ZERO } from "../utils/bignumbers";
import { calculateCollateralRatio } from "../utils/collateralRatio";

import { isLiquidation, isRedemption } from "../types/VaultOperation";

import {
  increaseNumberOfLiquidatedVaults,
  increaseNumberOfRedeemedVaults,
  increaseNumberOfOpenVaults,
  increaseNumberOfVaultsClosedByOwner
} from "./Global";
import { beginChange, initChange, finishChange } from "./Change";
import { getCurrentPrice, updateSystemStateByVaultChange } from "./SystemState";
import { getCurrentLiquidation } from "./Liquidation";
import { getCurrentRedemption } from "./Redemption";
import { getUser } from "./User";

function getCurrentVaultOfOwner(_user: Address): Vault {
  let owner = getUser(_user);
  let currentVault: Vault;

  if (owner.currentVault == null) {
    let vaultSubId = owner.vaultCount++;

    currentVault = new Vault(_user.toHexString() + "-" + vaultSubId.toString());
    currentVault.owner = owner.id;
    currentVault.status = "open";
    currentVault.collateral = DECIMAL_ZERO;
    currentVault.debt = DECIMAL_ZERO;
    owner.currentVault = currentVault.id;
    owner.save();

    increaseNumberOfOpenVaults();
  } else {
    currentVault = Vault.load(owner.currentVault) as Vault;
  }

  return currentVault;
}

function closeCurrentVaultOfOwner(_user: Address): void {
  let owner = getUser(_user);

  owner.currentVault = null;
  owner.save();
}

function createVaultChange(event: ethereum.Event): VaultChange {
  let sequenceNumber = beginChange(event);
  let vaultChange = new VaultChange(sequenceNumber.toString());
  initChange(vaultChange, event, sequenceNumber);

  return vaultChange;
}

function finishVaultChange(vaultChange: VaultChange): void {
  finishChange(vaultChange);
  vaultChange.save();
}

export function updateVault(
  event: ethereum.Event,
  operation: string,
  _borrower: Address,
  _coll: BigInt,
  _debt: BigInt,
  stake: BigInt,
  snapshotRBTC: BigInt,
  snapshotBPDDebt: BigInt
): void {
  let vault = getCurrentVaultOfOwner(_borrower);
  let newCollateral = decimalize(_coll);
  let newDebt = decimalize(_debt);

  if (newCollateral == vault.collateral && newDebt == vault.debt) {
    return;
  }

  let vaultChange = createVaultChange(event);
  let price = getCurrentPrice();

  vaultChange.vault = vault.id;
  vaultChange.vaultOperation = operation;

  vaultChange.collateralBefore = vault.collateral;
  vaultChange.debtBefore = vault.debt;
  vaultChange.collateralRatioBefore = calculateCollateralRatio(vault.collateral, vault.debt, price);

  vault.collateral = newCollateral;
  vault.debt = newDebt;

  vaultChange.collateralAfter = vault.collateral;
  vaultChange.debtAfter = vault.debt;
  vaultChange.collateralRatioAfter = calculateCollateralRatio(vault.collateral, vault.debt, price);

  vaultChange.collateralChange = vaultChange.collateralAfter - vaultChange.collateralBefore;
  vaultChange.debtChange = vaultChange.debtAfter - vaultChange.debtBefore;

  if (isLiquidation(operation)) {
    let currentLiquidation = getCurrentLiquidation(event);
    vaultChange.liquidation = currentLiquidation.id;
  }

  if (isRedemption(operation)) {
    let currentRedemption = getCurrentRedemption(event);
    vaultChange.redemption = currentRedemption.id;
  }

  updateSystemStateByVaultChange(vaultChange);
  finishVaultChange(vaultChange);

  vault.rawCollateral = _coll;
  vault.rawDebt = _debt;
  vault.rawStake = stake;
  vault.rawSnapshotOfTotalRedistributedCollateral = snapshotRBTC;
  vault.rawSnapshotOfTotalRedistributedDebt = snapshotBPDDebt;

  if (stake != BIGINT_ZERO) {
    vault.collateralRatioSortKey = (_debt * BIGINT_SCALING_FACTOR) / stake - snapshotBPDDebt;
  } else {
    vault.collateralRatioSortKey = null;
  }

  if (_coll == BIGINT_ZERO) {
    closeCurrentVaultOfOwner(_borrower);

    if (isLiquidation(operation)) {
      vault.status = "closedByLiquidation";
      increaseNumberOfLiquidatedVaults();
    } else if (isRedemption(operation)) {
      vault.status = "closedByRedemption";
      increaseNumberOfRedeemedVaults();
    } else {
      vault.status = "closedByOwner";
      increaseNumberOfVaultsClosedByOwner();
    }
  }

  vault.save();
}
