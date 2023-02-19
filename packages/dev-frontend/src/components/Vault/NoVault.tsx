import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useVaultView } from "./context/VaultViewContext";

export const NoVault: React.FC = props => {
  const { dispatchEvent } = useVaultView();

  const handleOpenVault = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>Your Vault</Heading>
      <Box sx={{ pt: '20px' }}>
        <InfoMessage title="You haven't borrowed any BPD yet.">
          You can borrow BPD by opening a Vault.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Button onClick={handleOpenVault}
          className={'text-black black'}>Open Vault</Button>
        </Flex>
      </Box>
    </Card>
  );
};
