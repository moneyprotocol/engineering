import React, { useCallback } from "react"
import { Card, Heading, Box, Button, Flex } from "theme-ui"
import { CollateralSurplusAction } from "../CollateralSurplusAction"
import { MoneypStoreState } from "@money-protocol/lib-base"
import { useMoneypSelector } from "@moneyprotocol/lib-react"
import { useVaultView } from "./context/VaultViewContext"
import { InfoMessage } from "../InfoMessage"

const select = ({ collateralSurplusBalance }: MoneypStoreState) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero,
})

export const RedeemedVault: React.FC = () => {
  const { hasSurplusCollateral } = useMoneypSelector(select)
  const { dispatchEvent } = useVaultView()

  const handleOpenVault = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED")
  }, [dispatchEvent])

  return (
    <Card>
      <Heading>Your Vault</Heading>
      <Box sx={{ pt: "20px" }}>
        <InfoMessage title="Your Vault has been redeemed.">
          {hasSurplusCollateral
            ? "Please reclaim your remaining collateral before opening a new Vault."
            : "You can borrow BPD by opening a Vault."}
        </InfoMessage>

        <Flex variant="layout.actions">
          {hasSurplusCollateral && <CollateralSurplusAction />}
          {!hasSurplusCollateral && <Button onClick={handleOpenVault}>Open Vault</Button>}
        </Flex>
      </Box>
    </Card>
  )
}
