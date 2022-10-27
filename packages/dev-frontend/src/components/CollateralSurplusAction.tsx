import React, { useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@moneyprotocol/lib-react";

import { useMoneyp } from "../hooks/MoneypContext";

import { Transaction, useMyTransactionState } from "./Transaction";
import { useVaultView } from "./Vault/context/VaultViewContext";

const select = ({ collateralSurplusBalance }: MoneypStoreState) => ({
  collateralSurplusBalance
});

export const CollateralSurplusAction: React.FC = () => {
  const { collateralSurplusBalance } = useMoneypSelector(select);
  const {
    moneyp: { send: moneyp }
  } = useMoneyp();

  const myTransactionId = "claim-coll-surplus";
  const myTransactionState = useMyTransactionState(myTransactionId);

  const { dispatchEvent } = useVaultView();

  useEffect(() => {
    if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("TROVE_SURPLUS_COLLATERAL_CLAIMED");
    }
  }, [myTransactionState.type, dispatchEvent]);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex variant="layout.actions">
      <Button disabled sx={{ mx: 2 }}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : myTransactionState.type !== "waitingForConfirmation" &&
    myTransactionState.type !== "confirmed" ? (
    <Flex variant="layout.actions">
      <Transaction
        id={myTransactionId}
        send={moneyp.claimCollateralSurplus.bind(moneyp, undefined)}
      >
        <Button sx={{ mx: 2 }}>Claim {collateralSurplusBalance.prettify()} RBTC</Button>
      </Transaction>
    </Flex>
  ) : null;
};
