import React, { useState } from "react"
import { Card, Box, Heading, Flex, Button } from "theme-ui"

import { useMoneyp } from "../hooks/MoneypContext"

import { Transaction } from "./Transaction"
import { EditableRow } from "./Vault/Editor"

export const LiquidationManager: React.FC = () => {
  const {
    moneyp: { send: moneyp },
  } = useMoneyp()
  const [numberOfVaultsToLiquidate, setNumberOfVaultsToLiquidate] = useState("40")
  const editingState = useState<string>()

  return (
    <Card>
      <Heading>Liquidation</Heading>

      <Box sx={{ pt: "20px" }}>
        <EditableRow
          label="Up to"
          inputId="liquidate-vault-count-input"
          amount={numberOfVaultsToLiquidate}
          unit={"Vaults"}
          editingState={editingState}
          editedAmount={numberOfVaultsToLiquidate}
          setEditedAmount={amount => setNumberOfVaultsToLiquidate(amount)}
        ></EditableRow>

        <Transaction
          id="batch-liquidate"
          tooltip="Liquidate"
          tooltipPlacement="bottom"
          send={overrides => {
            if (!numberOfVaultsToLiquidate) {
              throw new Error("Invalid number")
            }
            return moneyp.liquidateUpTo(parseInt(numberOfVaultsToLiquidate, 10), overrides)
          }}
        >
          <Flex variant="layout.actions">
            <Button variant="primary">Liquidate Now</Button>
          </Flex>
        </Transaction>
      </Box>
    </Card>
  )
}
