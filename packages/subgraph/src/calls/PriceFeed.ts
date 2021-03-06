import { Address, BigInt } from "@graphprotocol/graph-ts";

import { PriceFeed } from "../../generated/VaultManager/PriceFeed";

export function getPrice(priceFeedAddress: Address): BigInt {
  let priceFeed = PriceFeed.bind(priceFeedAddress);

  return priceFeed.fetchPrice();
}
