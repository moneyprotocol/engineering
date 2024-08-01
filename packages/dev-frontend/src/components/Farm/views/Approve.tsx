import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { useMoneyp } from "../../../hooks/MoneypContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useFarmView } from "../context/FarmViewContext";
import { useValidationState } from "../context/useValidationState";

type ApproveProps = {
  amount: Decimal;
};

const transactionId = "farm-approve";

export const Approve: React.FC<ApproveProps> = ({ amount }) => {
  const { dispatchEvent } = useFarmView();
  const {
    moneyp: { send: moneyp }
  } = useMoneyp();

  const { hasApproved } = useValidationState(amount);
  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("STAKE_APPROVED");
    }
  }, [transactionState.type, dispatchEvent]);

  if (hasApproved) {
    return null;
  }

  return (
    <Transaction
      id={transactionId}
      send={moneyp.approveRskSwapTokens.bind(moneyp, undefined)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button sx={{ width: "60%" }}>Approve UNI LP</Button>
    </Transaction>
  );
};
