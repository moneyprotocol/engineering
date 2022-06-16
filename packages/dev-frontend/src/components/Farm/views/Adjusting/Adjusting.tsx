import React, { useCallback, useState } from "react";
import { Heading, Box, Flex, Card, Button } from "theme-ui";
import { Decimal, MoneypStoreState } from "@liquity/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";

import { LP, GT } from "../../../../strings";
import { Icon } from "../../../Icon";
import { EditableRow, StaticRow } from "../../../Vault/Editor";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useFarmView } from "../../context/FarmViewContext";
import { useMyTransactionState } from "../../../Transaction";
import { Confirm } from "../Confirm";
import { Description } from "../Description";
import { Approve } from "../Approve";
import { Validation } from "../Validation";

const selector = ({
  liquidityMiningStake,
  liquidityMiningMPReward,
  rskSwapTokenBalance
}: MoneypStoreState) => ({
  liquidityMiningStake,
  liquidityMiningMPReward,
  rskSwapTokenBalance
});

const transactionId = /farm-/;

export const Adjusting: React.FC = () => {
  const { dispatchEvent } = useFarmView();
  const { liquidityMiningStake, liquidityMiningMPReward, rskSwapTokenBalance } = useMoneypSelector(
    selector
  );
  const [amount, setAmount] = useState<Decimal>(liquidityMiningStake);
  const editingState = useState<string>();

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";
  const isDirty = !amount.eq(liquidityMiningStake);
  const maximumAmount = liquidityMiningStake.add(rskSwapTokenBalance);
  const hasSetMaximumAmount = amount.eq(maximumAmount);

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        Liquidity farm
        {isDirty && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setAmount(liquidityMiningStake)}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="farm-stake-amount"
          amount={isDirty ? amount.prettify(4) : liquidityMiningStake.prettify(4)}
          unit={LP}
          editingState={editingState}
          editedAmount={amount.toString(4)}
          setEditedAmount={amount => setAmount(Decimal.from(amount))}
          maxAmount={maximumAmount.toString()}
          maxedOut={hasSetMaximumAmount}
        ></EditableRow>

        <StaticRow
          label="Reward"
          inputId="farm-reward-amount"
          amount={liquidityMiningMPReward.prettify(4)}
          color={liquidityMiningMPReward.nonZero && "success"}
          unit={GT}
        />

        {isDirty && <Validation amount={amount} />}
        {isDirty && <Description amount={amount} />}

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>
          <Approve amount={amount} />
          <Confirm amount={amount} />
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
