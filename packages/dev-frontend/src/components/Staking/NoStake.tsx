import { Card, Heading, Box, Flex, Button } from "theme-ui";

import { GT } from "../../strings";

import { InfoMessage } from "../InfoMessage";
import { useStakingView } from "./context/StakingViewContext";

export const NoStake: React.FC = () => {
  const { dispatch } = useStakingView();

  return (
    <Card>
      <Heading>Staking</Heading>
      <Box sx={{ pt: '20px' }}>
        <InfoMessage title={`You haven't staked ${GT} yet.`}>
          Stake {GT} to earn a share of borrowing and redemption fees.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Button onClick={() => dispatch({ type: "startAdjusting" })}>Start staking</Button>
        </Flex>
      </Box>
    </Card>
  );
};
