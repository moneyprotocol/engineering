import React, { useState } from "react";
import { Card, Box, Heading, Flex, Button, Label, Input } from "theme-ui";

import { useMoneyp } from "../hooks/MoneypContext";

import { Icon } from "./Icon";
import { Transaction } from "./Transaction";

export const LiquidationManager: React.FC = () => {
  const {
    moneyp: { send: moneyp }
  } = useMoneyp();
  const [numberOfVaultsToLiquidate, setNumberOfVaultsToLiquidate] = useState("40");

  return (
    <Card>
      <Heading>Liquidation</Heading>

      <Box sx={{ p: [2, 3] }}>
        <Flex sx={{ alignItems: "stretch" }}>
          <Label>Up to</Label>

          <Input
            type="number"
            min="1"
            step="1"
            value={numberOfVaultsToLiquidate}
            onChange={e => setNumberOfVaultsToLiquidate(e.target.value)}
          />

          <Label>Vaults</Label>

          <Flex sx={{ ml: 2, alignItems: "center" }}>
            <Transaction
              id="batch-liquidate"
              tooltip="Liquidate"
              tooltipPlacement="bottom"
              send={overrides => {
                if (!numberOfVaultsToLiquidate) {
                  throw new Error("Invalid number");
                }
                return moneyp.liquidateUpTo(parseInt(numberOfVaultsToLiquidate, 10), overrides);
              }}
            >
              <Button variant="dangerIcon">
                <Icon name="trash" size="lg" />
              </Button>
            </Transaction>
          </Flex>
        </Flex>
      </Box>
    </Card>
  );
};
