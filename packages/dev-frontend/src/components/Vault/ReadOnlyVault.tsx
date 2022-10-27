import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { useMoneypSelector } from "@liquity/lib-react";
import { MoneypStoreState } from "@moneyprotocol/lib-base";
import { DisabledEditableRow } from "./Editor";
import { useVaultView } from "./context/VaultViewContext";
import { Icon } from "../Icon";
import { COIN } from "../../strings";
import { CollateralRatio } from "./CollateralRatio";

const select = ({ vault, price }: MoneypStoreState) => ({ vault, price });

export const ReadOnlyVault: React.FC = () => {
  const { dispatchEvent } = useVaultView();
  const handleAdjustVault = useCallback(() => {
    dispatchEvent("ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);
  const handleCloseVault = useCallback(() => {
    dispatchEvent("CLOSE_TROVE_PRESSED");
  }, [dispatchEvent]);

  const { vault, price } = useMoneypSelector(select);

  // console.log("READONLY TROVE", vault.collateral.prettify(4));
  return (
    <Card>
      <Heading>Vault</Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Collateral"
            inputId="vault-collateral"
            amount={vault.collateral.prettify(4)}
            unit="RBTC"
          />

          <DisabledEditableRow
            label="Debt"
            inputId="vault-debt"
            amount={vault.debt.prettify()}
            unit={COIN}
          />

          <CollateralRatio value={vault.collateralRatio(price)} />
        </Box>

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={handleCloseVault}>
            Close Vault
          </Button>
          <Button onClick={handleAdjustVault}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
