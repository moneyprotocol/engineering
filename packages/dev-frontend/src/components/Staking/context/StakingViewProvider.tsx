import { useEffect } from "react"

import { MoneypStoreState, MPStake } from "@money-protocol/lib-base"
import { MoneypStoreUpdate, useMoneypReducer } from "@moneyprotocol/lib-react"

import { useMyTransactionState } from "../../Transaction"

import { StakingViewAction, StakingViewContext } from "./StakingViewContext"

type StakingViewProviderAction =
  | MoneypStoreUpdate
  | StakingViewAction
  | { type: "startChange" | "abortChange" }

type StakingViewProviderState = {
  mpStake: MPStake
  changePending: boolean
  adjusting: boolean
}

const init = ({ mpStake }: MoneypStoreState): StakingViewProviderState => ({
  mpStake,
  changePending: false,
  adjusting: false,
})

const reduce = (
  state: StakingViewProviderState,
  action: StakingViewProviderAction
): StakingViewProviderState => {
  // console.log(state);
  // console.log(action);

  switch (action.type) {
    case "startAdjusting":
      return { ...state, adjusting: true }

    case "cancelAdjusting":
      return { ...state, adjusting: false }

    case "startChange":
      return { ...state, changePending: true }

    case "abortChange":
      return { ...state, changePending: false }

    case "updateStore": {
      const {
        oldState: { mpStake: oldStake },
        stateChange: { mpStake: updatedStake },
      } = action

      if (updatedStake) {
        const changeCommitted =
          !updatedStake.stakedMP.eq(oldStake.stakedMP) ||
          updatedStake.collateralGain.lt(oldStake.collateralGain) ||
          updatedStake.bpdGain.lt(oldStake.bpdGain)

        return {
          ...state,
          mpStake: updatedStake,
          adjusting: false,
          changePending: changeCommitted ? false : state.changePending,
        }
      }
    }
  }

  return state
}

export const StakingViewProvider: React.FC = ({ children }) => {
  const stakingTransactionState = useMyTransactionState("stake")
  const [{ adjusting, changePending, mpStake }, dispatch] = useMoneypReducer(reduce, init)

  useEffect(() => {
    if (stakingTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" })
    } else if (
      stakingTransactionState.type === "failed" ||
      stakingTransactionState.type === "cancelled"
    ) {
      dispatch({ type: "abortChange" })
    }
  }, [stakingTransactionState.type, dispatch])

  return (
    <StakingViewContext.Provider
      value={{
        view: adjusting ? "ADJUSTING" : mpStake.isEmpty ? "NONE" : "ACTIVE",
        changePending,
        dispatch,
      }}
    >
      {children}
    </StakingViewContext.Provider>
  )
}
