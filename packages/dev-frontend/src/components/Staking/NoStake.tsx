import { Card, Heading, Box, Flex, Button } from "theme-ui"

import { GT } from "../../strings"

import { EmptyMessage } from "../shared"
import { useStakingView } from "./context/StakingViewContext"

export const NoStake: React.FC = () => {
  const { dispatch } = useStakingView()

  return (
    <Card>
      <Heading>Staking</Heading>
      <Box sx={{ pt: "20px" }}>
        <EmptyMessage
          title={`You haven't staked ${GT} yet.`}
          message={`Stake ${GT} to earn a share of borrowing and redemption fees.`}
        />

        <Flex variant="layout.actions">
          <Button onClick={() => dispatch({ type: "startAdjusting" })}>Start staking</Button>
        </Flex>
      </Box>
    </Card>
  )
}
