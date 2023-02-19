import React, { useCallback, useState } from "react"
import { Heading, Box, Flex, Card, Button } from "theme-ui"
import { Decimal } from "@moneyprotocol/lib-base"
import { LP } from "../../../../strings"
import { Icon } from "../../../Icon"
import { EditableRow } from "../../../Vault/Editor"
import { LoadingOverlay } from "../../../LoadingOverlay"
import { useFarmView } from "../../context/FarmViewContext"
import { useMyTransactionState } from "../../../Transaction"
import { Confirm } from "../Confirm"
import { Description } from "../Description"
import { Approve } from "../Approve"
import { Validation } from "../Validation"
import { useValidationState } from "../../context/useValidationState"
import { ResetIcon } from "../../../shared/ResetIcon"

const transactionId = /farm-/

export const Staking: React.FC = () => {
  const { dispatchEvent } = useFarmView()
  const [amount, setAmount] = useState<Decimal>(Decimal.from(0))
  const editingState = useState<string>()
  const isDirty = !amount.isZero

  const { maximumStake, hasSetMaximumStake } = useValidationState(amount)

  const transactionState = useMyTransactionState(transactionId)
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation"

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED")
  }, [dispatchEvent])

  return (
    <Card>
      <Heading>
        Liquidity farm
        {isDirty && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setAmount(Decimal.from(0))}
          >
            <ResetIcon />
          </Button>
        )}
      </Heading>

      <Box sx={{ pt: "20px" }}>
        <EditableRow
          label="Stake"
          inputId="amount-lp"
          amount={amount.prettify(4)}
          unit={LP}
          editingState={editingState}
          editedAmount={amount.toString(4)}
          setEditedAmount={amount => setAmount(Decimal.from(amount))}
          maxAmount={maximumStake.toString()}
          maxedOut={hasSetMaximumStake}
        ></EditableRow>

        {isDirty && <Validation amount={amount} />}
        <Description amount={amount} />

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
  )
}
