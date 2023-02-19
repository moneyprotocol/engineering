import React from "react";
import { Container, Card, Box, Paragraph } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskiestVaults } from "../components/RiskiestVaults";
import { InfoMessage } from "../components/InfoMessage";

export const Liquidation: React.FC = () => (
  <Container variant="columns">
    <Container variant="left">
      <Card>
        <Box sx={{ pt: '20px' }}>
          <InfoMessage title="Bot functionality">
            <Paragraph>This functionality is expected to be carried out by bots.</Paragraph>
            <Paragraph>
              Early on you may be able to manually liquidate Vaults, but as the system matures this
              will become less likely.
            </Paragraph>
          </InfoMessage>
        </Box>
      </Card>
      <LiquidationManager />
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
    <RiskiestVaults pageSize={10} />
  </Container>
);
