import React, { useCallback, useEffect } from "react"
import { Button, Flex } from "theme-ui"

import { Decimal, Decimalish, MoneypStoreState } from "@money-protocol/lib-base"
import { MoneypStoreUpdate, useMoneypReducer, useMoneypSelector } from "@moneyprotocol/lib-react"

import { COIN } from "../../strings"

import { ActionDescription } from "../ActionDescription"
import { useMyTransactionState } from "../Transaction"

import { StabilityDepositEditor } from "./StabilityDepositEditor"
import { StabilityDepositAction } from "./StabilityDepositAction"
import { useStabilityView } from "./context/StabilityViewContext"
import {
  selectForStabilityDepositChangeValidation,
  validateStabilityDepositChange,
} from "./validation/validateStabilityDepositChange"

const init = ({ stabilityDeposit }: MoneypStoreState) => ({
  originalDeposit: stabilityDeposit,
  editedBPD: stabilityDeposit.currentBPD,
  changePending: false,
})

type StabilityDepositManagerState = ReturnType<typeof init>
type StabilityDepositManagerAction =
  | MoneypStoreUpdate
  | { type: "startChange" | "finishChange" | "revert" }
  | { type: "setDeposit"; newValue: Decimalish }

const reduceWith =
  (action: StabilityDepositManagerAction) =>
  (state: StabilityDepositManagerState): StabilityDepositManagerState =>
    reduce(state, action)

const finishChange = reduceWith({ type: "finishChange" })
const revert = reduceWith({ type: "revert" })

const reduce = (
  state: StabilityDepositManagerState,
  action: StabilityDepositManagerAction
): StabilityDepositManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalDeposit, editedBPD, changePending } = state

  switch (action.type) {
    case "startChange": {
      console.log("changeStarted")
      return { ...state, changePending: true }
    }

    case "finishChange":
      return { ...state, changePending: false }

    case "setDeposit":
      return { ...state, editedBPD: Decimal.from(action.newValue) }

    case "revert":
      return { ...state, editedBPD: originalDeposit.currentBPD }

    case "updateStore": {
      const {
        stateChange: { stabilityDeposit: updatedDeposit },
      } = action

      if (!updatedDeposit) {
        return state
      }

      const newState = { ...state, originalDeposit: updatedDeposit }

      const changeCommitted =
        !updatedDeposit.initialBPD.eq(originalDeposit.initialBPD) ||
        updatedDeposit.currentBPD.gt(originalDeposit.currentBPD) ||
        updatedDeposit.collateralGain.lt(originalDeposit.collateralGain) ||
        updatedDeposit.mpReward.lt(originalDeposit.mpReward)

      if (changePending && changeCommitted) {
        return finishChange(revert(newState))
      }

      return {
        ...newState,
        editedBPD: updatedDeposit.apply(originalDeposit.whatChanged(editedBPD)),
      }
    }
  }
}

const transactionId = "stability-deposit"

export const StabilityDepositManager: React.FC = () => {
  const [{ originalDeposit, editedBPD, changePending }, dispatch] = useMoneypReducer(reduce, init)
  const validationContext = useMoneypSelector(selectForStabilityDepositChangeValidation)
  const { dispatchEvent } = useStabilityView()

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED")
  }, [dispatchEvent])

  const [validChange, description] = validateStabilityDepositChange(
    originalDeposit,
    editedBPD,
    validationContext
  )

  const makingNewDeposit = originalDeposit.isEmpty

  const myTransactionState = useMyTransactionState(transactionId)

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" })
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" })
    } else if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("DEPOSIT_CONFIRMED")
    }
  }, [myTransactionState.type, dispatch, dispatchEvent])

  return (
    <StabilityDepositEditor
      originalDeposit={originalDeposit}
      editedBPD={editedBPD}
      changePending={changePending}
      dispatch={dispatch}
    >
      {description ??
        (makingNewDeposit ? (
          <ActionDescription>Enter the amount of {COIN} you'd like to deposit.</ActionDescription>
        ) : (
          <ActionDescription>Adjust the {COIN} amount to deposit or withdraw.</ActionDescription>
        ))}

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleCancel}>
          Cancel
        </Button>

        {validChange ? (
          <StabilityDepositAction transactionId={transactionId} change={validChange}>
            Confirm
          </StabilityDepositAction>
        ) : (
          <Button disabled>Confirm</Button>
        )}
      </Flex>
    </StabilityDepositEditor>
  )
}
