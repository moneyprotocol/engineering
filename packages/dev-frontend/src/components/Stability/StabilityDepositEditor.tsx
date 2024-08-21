import React, { useState } from "react"
import { Heading, Box, Card, Button } from "theme-ui"

import { Decimal, Decimalish, StabilityDeposit, MoneypStoreState } from "@money-protocol/lib-base"

import { useMoneypSelector } from "@moneyprotocol/lib-react"

import { COIN, GT } from "../../strings"

import { EditableRow, StaticRow } from "../Vault/Editor"
import { LoadingOverlay } from "../LoadingOverlay"
import { ResetIcon } from "../shared/ResetIcon"

const selectBPDBalance = ({ bpdBalance }: MoneypStoreState) => bpdBalance

type StabilityDepositEditorProps = {
  originalDeposit: StabilityDeposit
  editedBPD: Decimal
  changePending: boolean
  dispatch: (action: { type: "setDeposit"; newValue: Decimalish } | { type: "revert" }) => void
}

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  originalDeposit,
  editedBPD,
  changePending,
  dispatch,
  children,
}) => {
  const bpdBalance = useMoneypSelector(selectBPDBalance)
  const editingState = useState<string>()

  const edited = !editedBPD.eq(originalDeposit.currentBPD)

  const maxAmount = originalDeposit.currentBPD.add(bpdBalance)
  const maxedOut = editedBPD.eq(maxAmount)

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
            <ResetIcon />
          </Button>
        )}
      </Heading>

      <Box sx={{ pt: "20px" }}>
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
              color={originalDeposit.collateralGain.nonZero && "blueSuccess"}
              unit="RBTC"
            />

            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={originalDeposit.mpReward.prettify()}
              color={originalDeposit.mpReward.nonZero && "blueSuccess"}
              unit={GT}
            />
          </>
        )}
        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  )
}
