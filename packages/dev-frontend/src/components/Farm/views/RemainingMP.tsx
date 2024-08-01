import React from "react";
import { Flex } from "theme-ui";

import { MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@moneyprotocol/lib-react";

const selector = ({ remainingLiquidityMiningMPReward }: MoneypStoreState) => ({
  remainingLiquidityMiningMPReward
});

export const RemainingMP: React.FC = () => {
  const { remainingLiquidityMiningMPReward } = useMoneypSelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingLiquidityMiningMPReward.prettify(0)} MP remaining
    </Flex>
  );
};
