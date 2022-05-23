import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Decimal, Decimalish, StabilityDeposit, MoneypStoreState } from "@liquity/lib-base";

import { useMoneypSelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, StaticRow } from "../Vault/Editor";
import { LoadingOverlay } from "../LoadingOverlay";

const selectBPDBalance = ({ bpdBalance }: MoneypStoreState) => bpdBalance;

type StabilityDepositEditorProps = {
  originalDeposit: StabilityDeposit;
  editedBPD: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "setDeposit"; newValue: Decimalish } | { type: "revert" }) => void;
};

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  originalDeposit,
  editedBPD,
  changePending,
  dispatch,
  children
}) => {
  const bpdBalance = useMoneypSelector(selectBPDBalance);
  const editingState = useState<string>();

  const edited = !editedBPD.eq(originalDeposit.currentBPD);

  const maxAmount = originalDeposit.currentBPD.add(bpdBalance);
  const maxedOut = editedBPD.eq(maxAmount);

  return (
    <Card>
      <Heading>
        Stability Pool
        {edited && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => dispatch({ type: "revert" })}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Deposit"
          inputId="deposit-mp"
          amount={editedBPD.prettify()}
          maxAmount={maxAmount.toString()}
          maxedOut={maxedOut}
          unit={COIN}
          {...{ editingState }}
          editedAmount={editedBPD.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setDeposit", newValue })}
        />

        {!originalDeposit.isEmpty && (
          <>
            <StaticRow
              label="Liquidation gain"
              inputId="deposit-gain"
              amount={originalDeposit.collateralGain.prettify(4)}
              color={originalDeposit.collateralGain.nonZero && "success"}
              unit="RBTC"
            />

            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={originalDeposit.mpReward.prettify()}
              color={originalDeposit.mpReward.nonZero && "success"}
              unit={GT}
            />
          </>
        )}
        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
