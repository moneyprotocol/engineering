import React, { useState, useEffect } from "react"
import { Card, Box, Heading, Flex, Button, Label, Input } from "theme-ui"

import { Decimal, MoneypStoreState } from "@moneyprotocol/lib-base"
import { useMoneypSelector } from "@moneyprotocol/lib-react"

import { useMoneyp } from "../hooks/MoneypContext"

import { Icon } from "./Icon"
import { Transaction } from "./Transaction"
import { DisabledEditableRow } from "./Vault/Editor"

const selectPrice = ({ price }: MoneypStoreState) => price

export const PriceManager: React.FC = () => {
  const {
    moneyp: {
      send: moneyp,
      connection: { _priceFeedIsTestnet: canSetPrice },
    },
  } = useMoneyp()

  const price = useMoneypSelector(selectPrice)
  const [editedPrice, setEditedPrice] = useState(price.toString(2))

  useEffect(() => {
    setEditedPrice(price.toString(2))
  }, [price])

  return (
    <Card>
      <Heading>Price feed</Heading>

      <Box sx={{ pt: "20px" }}>
        {!canSetPrice ? (
          <DisabledEditableRow
            label="RBTC"
            inputId="rbtc-usd-value"
            amount={editedPrice}
            unit={"USD"}
          />
        ) : (
          <Flex sx={{ flexDirection: "column" }}>
            <Box sx={{ mb: 2, fontSize: "13px", fontWeight: "300" }}>RBTC</Box>

            <Flex>
              <Input
                type={"number"}
                step="any"
                value={editedPrice}
                onChange={e => setEditedPrice(e.target.value)}
                disabled={!canSetPrice}
              />
              <Flex sx={{ ml: 2, alignItems: "center" }}>
                <Transaction
                  id="set-price"
                  tooltip="Set"
                  tooltipPlacement="bottom"
                  send={overrides => {
                    if (!editedPrice) {
                      throw new Error("Invalid price")
                    }
                    return moneyp.setPrice(Decimal.from(editedPrice), overrides)
                  }}
                >
                  <Button variant="icon">
                    <Icon name="chart-line" size="lg" />
                  </Button>
                </Transaction>
              </Flex>
            </Flex>
          </Flex>
        )}
      </Box>
    </Card>
  )
}
