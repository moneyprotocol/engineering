import React from "react";
import { VaultManager } from "./VaultManager";
import { ReadOnlyVault } from "./ReadOnlyVault";
import { NoVault } from "./NoVault";
import { RedeemedVault } from "./RedeemedVault";
import { useVaultView } from "./context/VaultViewContext";
import { LiquidatedVault } from "./LiquidatedVault";
import { Decimal } from "@liquity/lib-base";

export const Vault: React.FC = props => {
  const { view } = useVaultView();

  switch (view) {
    // loading state not needed, as main app has a loading spinner that blocks render until the moneyp backend data is available
    case "ACTIVE": {
      return <ReadOnlyVault {...props} />;
    }
    case "ADJUSTING": {
      return <VaultManager {...props} />;
    }
    case "CLOSING": {
      return <VaultManager {...props} collateral={Decimal.ZERO} debt={Decimal.ZERO} />;
    }
    case "OPENING": {
      return <VaultManager {...props} />;
    }
    case "LIQUIDATED": {
      return <LiquidatedVault {...props} />;
    }
    case "REDEEMED": {
      return <RedeemedVault {...props} />;
    }
    case "NONE": {
      return <NoVault {...props} />;
    }
  }
};
