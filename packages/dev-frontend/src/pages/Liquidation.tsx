import React from "react"
import { Container, Box, Paragraph } from "theme-ui"
import { SystemStats } from "../components/SystemStats"
import { LiquidationManager } from "../components/LiquidationManager"
import { RiskiestVaults } from "../components/RiskiestVaults"
import { InfoMessage } from "../components/InfoMessage"

export const Liquidation: React.FC = () => (
  <>
    <Box sx={{ mt: 3, width: "100%" }}>
      <InfoMessage title="Bot functionality">
        <Paragraph>This functionality is expected to be carried out by bots.</Paragraph>
        <Paragraph>
          Early on you may be able to manually liquidate Vaults, but as the system matures this will
          become less likely.
        </Paragraph>
      </InfoMessage>
    </Box>

    <Container variant="columns">
      <Container variant="left">
        <LiquidationManager />
        <RiskiestVaults pageSize={10} />
      </Container>

      <Container variant="right">
        <SystemStats />
      </Container>
    </Container>
  </>
)
