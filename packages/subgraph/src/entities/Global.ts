import { Value, BigInt, Address } from "@graphprotocol/graph-ts";

import { Global } from "../../generated/schema";

import { BIGINT_ZERO } from "../utils/bignumbers";

const onlyGlobalId = "only";

export function getGlobal(): Global {
  let globalOrNull = Global.load(onlyGlobalId);

  if (globalOrNull != null) {
    return globalOrNull as Global;
  } else {
    let newGlobal = new Global(onlyGlobalId);

    newGlobal.systemStateCount = 0;
    newGlobal.transactionCount = 0;
    newGlobal.changeCount = 0;
    newGlobal.liquidationCount = 0;
    newGlobal.redemptionCount = 0;
    newGlobal.numberOfOpenVaults = 0;
    newGlobal.numberOfLiquidatedVaults = 0;
    newGlobal.numberOfRedeemedVaults = 0;
    newGlobal.numberOfVaultsClosedByOwner = 0;
    newGlobal.totalNumberOfVaults = 0;
    newGlobal.rawTotalRedistributedCollateral = BIGINT_ZERO;
    newGlobal.rawTotalRedistributedDebt = BIGINT_ZERO;

    return newGlobal;
  }
}

function increaseCounter(key: string): i32 {
  let global = getGlobal();

  let count = global.get(key).toI32();
  global.set(key, Value.fromI32(count + 1));
  global.save();

  return count;
}

export function getSystemStateSequenceNumber(): i32 {
  return increaseCounter("systemStateCount");
}

export function getTransactionSequenceNumber(): i32 {
  return increaseCounter("transactionCount");
}

export function getChangeSequenceNumber(): i32 {
  return increaseCounter("changeCount");
}

export function getLiquidationSequenceNumber(): i32 {
  return increaseCounter("liquidationCount");
}

export function getRedemptionSequenceNumber(): i32 {
  return increaseCounter("redemptionCount");
}

export function updatePriceFeedAddress(priceFeedAddress: Address): void {
  let global = getGlobal();

  global.priceFeedAddress = priceFeedAddress;
  global.save();
}

export function getPriceFeedAddress(): Address {
  return getGlobal().priceFeedAddress as Address;
}

export function updateTotalRedistributed(B_RBTC: BigInt, B_BPDDebt: BigInt): void {
  let global = getGlobal();

  global.rawTotalRedistributedCollateral = B_RBTC;
  global.rawTotalRedistributedDebt = B_BPDDebt;
  global.save();
}

export function increaseNumberOfOpenVaults(): void {
  let global = getGlobal();

  global.numberOfOpenVaults++;
  global.totalNumberOfVaults++;
  global.save();
}

export function increaseNumberOfLiquidatedVaults(): void {
  let global = getGlobal();

  global.numberOfLiquidatedVaults++;
  global.numberOfOpenVaults--;
  global.save();
}

export function increaseNumberOfRedeemedVaults(): void {
  let global = getGlobal();

  global.numberOfRedeemedVaults++;
  global.numberOfOpenVaults--;
  global.save();
}

export function increaseNumberOfVaultsClosedByOwner(): void {
  let global = getGlobal();

  global.numberOfVaultsClosedByOwner++;
  global.numberOfOpenVaults--;
  global.save();
}
