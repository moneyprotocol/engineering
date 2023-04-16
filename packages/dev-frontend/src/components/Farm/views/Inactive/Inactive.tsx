import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button, Link, Paragraph } from "theme-ui";
import { useMoneyp } from "../../../../hooks/MoneypContext";
import { Icon } from "../../../Icon";
import { InfoMessage } from "../../../InfoMessage";
import { useFarmView } from "../../context/FarmViewContext";
import { RemainingMP } from "../RemainingMP";
import { Yield } from "../Yield";

const uniLink = (bpdAddress: string) => `https://app.uniswap.org/#/add/RBTC/${bpdAddress}`;

export const Inactive: React.FC = () => {
  const { dispatchEvent } = useFarmView();

  const {
    moneyp: {
      connection: { addresses }
    }
  } = useMoneyp();

  const handleStakePressed = useCallback(() => {
    dispatchEvent("STAKE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        Liquidity farm
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingMP />
        </Flex>
      </Heading>
      <Box sx={{ pt: '20px' }}>
        <InfoMessage title="You aren't farming MP.">
          <Paragraph>You can farm MP by staking your Uniswap RBTC/BPD LP tokens.</Paragraph>

          <Paragraph sx={{ mt: 2 }}>
            You can obtain LP tokens by adding liquidity to the{" "}
            <Link href={uniLink(addresses["bpdToken"])} target="_blank">
              RBTC/BPD pool on Uniswap. <Icon name="external-link-alt" size="xs" />
            </Link>
          </Paragraph>
        </InfoMessage>

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", alignItems: "center", flex: 1 }}>
            <Yield />
          </Flex>
          <Button onClick={handleStakePressed}>Stake</Button>
        </Flex>
      </Box>
    </Card>
  );
};
