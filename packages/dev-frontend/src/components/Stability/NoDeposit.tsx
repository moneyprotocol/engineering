import React, { useCallback } from "react"
import { Card, Heading, Box, Flex, Button } from "theme-ui"
import { EmptyMessage } from "../shared"
import { useStabilityView } from "./context/StabilityViewContext"
import { RemainingMP } from "./RemainingMP"
import { Yield } from "./Yield"

export const NoDeposit: React.FC = props => {
  const { dispatchEvent } = useStabilityView()

  const handleOpenVault = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED")
  }, [dispatchEvent])

  return (
    <Card>
      <Heading>
        Stability Pool
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingMP />
        </Flex>
      </Heading>
      <Box sx={{ pt: "20px" }}>
        <EmptyMessage
          title="You have no BPD in the Stability Pool."
          message="You can earn RBTC and MP rewards by depositing BPD."
        />

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", flex: 1, alignItems: "center" }}>
            <Yield />
          </Flex>
          <Button onClick={handleOpenVault}>Deposit</Button>
        </Flex>
      </Box>
    </Card>
  )
}
