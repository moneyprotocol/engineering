import React from "react";
import { Card, Heading, Box, Flex } from "theme-ui";
import { MoneypStoreState } from "@liquity/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";
import { InfoMessage } from "../../../InfoMessage";
import { UnstakeAndClaim } from "../UnstakeAndClaim";
import { RemainingMP } from "../RemainingMP";
import { StaticRow } from "../../../Vault/Editor";
import { GT, LP } from "../../../../strings";

const selector = ({ liquidityMiningStake, liquidityMiningMPReward }: MoneypStoreState) => ({
  liquidityMiningStake,
  liquidityMiningMPReward
});

export const Disabled: React.FC = () => {
  const { liquidityMiningStake, liquidityMiningMPReward } = useMoneypSelector(selector);
  const hasStake = !liquidityMiningStake.isZero;

  return (
    <Card>
      <Heading>
        Liquidity farm
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingMP />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="Liquidity farming period has finished">
          <Flex>There are no more MP rewards left to farm</Flex>
        </InfoMessage>
        {hasStake && (
          <>
            <Box sx={{ border: 1, pt: 3, borderRadius: 3 }}>
              <StaticRow
                label="Stake"
                inputId="farm-deposit"
                amount={liquidityMiningStake.prettify(4)}
                unit={LP}
              />
              <StaticRow
                label="Reward"
                inputId="farm-reward"
                amount={liquidityMiningMPReward.prettify(4)}
                color={liquidityMiningMPReward.nonZero && "success"}
                unit={GT}
              />
            </Box>
            <UnstakeAndClaim />
          </>
        )}
      </Box>
    </Card>
  );
};
