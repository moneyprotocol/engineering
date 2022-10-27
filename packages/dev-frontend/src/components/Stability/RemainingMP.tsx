import React from "react";
import { Flex } from "theme-ui";

import { MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";

const selector = ({ remainingStabilityPoolMPReward }: MoneypStoreState) => ({
  remainingStabilityPoolMPReward
});

export const RemainingMP: React.FC = () => {
  const { remainingStabilityPoolMPReward } = useMoneypSelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingStabilityPoolMPReward.prettify(0)} MP remaining
    </Flex>
  );
};
