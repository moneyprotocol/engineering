import React, { useCallback, useEffect } from "react";
import { Flex, Button } from "theme-ui";

import { MoneypStoreState, Decimal, Vault, Decimalish, BPD_MINIMUM_DEBT } from "@moneyprotocol/lib-base";

import { MoneypStoreUpdate, useMoneypReducer, useMoneypSelector } from "@liquity/lib-react";

import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";

import { VaultEditor } from "./VaultEditor";
import { VaultAction } from "./VaultAction";
import { useVaultView } from "./context/VaultViewContext";

import {
  selectForVaultChangeValidation,
  validateVaultChange
} from "./validation/validateVaultChange";

const init = ({ vault }: MoneypStoreState) => ({
  original: vault,
  edited: new Vault(vault.collateral, vault.debt),
  changePending: false,
  debtDirty: false,
  addedMinimumDebt: false
});

type VaultManagerState = ReturnType<typeof init>;
type VaultManagerAction =
  | MoneypStoreUpdate
  | { type: "startChange" | "finishChange" | "revert" | "addMinimumDebt" | "removeMinimumDebt" }
  | { type: "setCollateral" | "setDebt"; newValue: Decimalish };

const reduceWith = (action: VaultManagerAction) => (state: VaultManagerState): VaultManagerState =>
  reduce(state, action);

const addMinimumDebt = reduceWith({ type: "addMinimumDebt" });
const removeMinimumDebt = reduceWith({ type: "removeMinimumDebt" });
const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (state: VaultManagerState, action: VaultManagerAction): VaultManagerState => {
  // console.log(state);
  // console.log(action);

  const { original, edited, changePending, debtDirty, addedMinimumDebt } = state;

  switch (action.type) {
    case "startChange": {
      console.log("starting change");
      return { ...state, changePending: true };
    }

    case "finishChange":
      return { ...state, changePending: false };

    case "setCollateral": {
      const newCollateral = Decimal.from(action.newValue);

      const newState = {
        ...state,
        edited: edited.setCollateral(newCollateral)
      };

      if (!debtDirty) {
        if (edited.isEmpty && newCollateral.nonZero) {
          return addMinimumDebt(newState);
        }
        if (addedMinimumDebt && newCollateral.isZero) {
          return removeMinimumDebt(newState);
        }
      }

      return newState;
    }

    case "setDebt":
      return {
        ...state,
        edited: edited.setDebt(action.newValue),
        debtDirty: true
      };

    case "addMinimumDebt":
      return {
        ...state,
        edited: edited.setDebt(BPD_MINIMUM_DEBT),
        addedMinimumDebt: true
      };

    case "removeMinimumDebt":
      return {
        ...state,
        edited: edited.setDebt(0),
        addedMinimumDebt: false
      };

    case "revert":
      return {
        ...state,
        edited: new Vault(original.collateral, original.debt),
        debtDirty: false,
        addedMinimumDebt: false
      };

    case "updateStore": {
      const {
        newState: { vault },
        stateChange: { vaultBeforeRedistribution: changeCommitted }
      } = action;

      const newState = {
        ...state,
        original: vault
      };

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      const change = original.whatChanged(edited, 0);

      if (
        (change?.type === "creation" && !vault.isEmpty) ||
        (change?.type === "closure" && vault.isEmpty)
      ) {
        return revert(newState);
      }

      return { ...newState, edited: vault.apply(change, 0) };
    }
  }
};

const feeFrom = (original: Vault, edited: Vault, borrowingRate: Decimal): Decimal => {
  const change = original.whatChanged(edited, borrowingRate);

  if (change && change.type !== "invalidCreation" && change.params.borrowBPD) {
    return change.params.borrowBPD.mul(borrowingRate);
  } else {
    return Decimal.ZERO;
  }
};

const select = (state: MoneypStoreState) => ({
  fees: state.fees,
  validationContext: selectForVaultChangeValidation(state)
});

const transactionId = "vault";

type VaultManagerProps = {
  collateral?: Decimalish;
  debt?: Decimalish;
};

export const VaultManager: React.FC<VaultManagerProps> = ({ collateral, debt }) => {
  const [{ original, edited, changePending }, dispatch] = useMoneypReducer(reduce, init);
  const { fees, validationContext } = useMoneypSelector(select);

  useEffect(() => {
    if (collateral !== undefined) {
      dispatch({ type: "setCollateral", newValue: collateral });
    }
    if (debt !== undefined) {
      dispatch({ type: "setDebt", newValue: debt });
    }
  }, [collateral, debt, dispatch]);

  const borrowingRate = fees.borrowingRate();
  const maxBorrowingRate = borrowingRate.add(0.005); // TODO slippage tolerance

  const [validChange, description] = validateVaultChange(
    original,
    edited,
    borrowingRate,
    validationContext
  );

  // console.log("VaultManager render", { original, edited, change });
  const { dispatchEvent } = useVaultView();

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);

  const openingNewVault = original.isEmpty;

  const myTransactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      if (validChange?.type === "closure") {
        dispatchEvent("TROVE_CLOSED");
      } else if (validChange?.type === "creation" || validChange?.type === "adjustment") {
        dispatchEvent("TROVE_ADJUSTED");
      }
    }
  }, [myTransactionState.type, dispatch, dispatchEvent, validChange?.type]);

  return (
    <VaultEditor
      original={original}
      edited={edited}
      fee={feeFrom(original, edited, borrowingRate)}
      borrowingRate={borrowingRate}
      changePending={changePending}
      dispatch={dispatch}
    >
      {description ??
        (openingNewVault ? (
          <ActionDescription>
            Start by entering the amount of RBTC you'd like to deposit as collateral.
          </ActionDescription>
        ) : (
          <ActionDescription>
            Adjust your Vault by modifying its collateral, debt, or both.
          </ActionDescription>
        ))}

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleCancel}>
          Cancel
        </Button>

        {validChange ? (
          <VaultAction
            transactionId={transactionId}
            change={validChange}
            maxBorrowingRate={maxBorrowingRate}
          >
            Confirm
          </VaultAction>
        ) : (
          <Button disabled>Confirm</Button>
        )}
      </Flex>
    </VaultEditor>
  );
};
