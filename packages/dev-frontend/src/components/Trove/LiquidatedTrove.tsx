import React, { useCallback } from "react";
import { Card, Heading, Box, Button, Flex } from "theme-ui";
import { CollateralSurplusAction } from "../CollateralSurplusAction";
import { MoneypStoreState } from "@liquity/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";
import { useVaultView } from "./context/VaultViewContext";
import { InfoMessage } from "../InfoMessage";

const select = ({ collateralSurplusBalance }: MoneypStoreState) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero
});

export const LiquidatedVault: React.FC = () => {
  const { hasSurplusCollateral } = useMoneypSelector(select);
  const { dispatchEvent } = useVaultView();

  const handleOpenVault = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>Vault</Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="Your Vault has been liquidated.">
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
  );
};
