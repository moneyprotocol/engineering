import React from "react";
import { Button, Flex } from "theme-ui";

import {
  Decimal,
  Decimalish,
  MoneypStoreState,
  MPStake,
  MPStakeChange
} from "@liquity/lib-base";

import { MoneypStoreUpdate, useMoneypReducer, useMoneypSelector } from "@liquity/lib-react";

import { GT, COIN } from "../../strings";

import { useStakingView } from "./context/StakingViewContext";
import { StakingEditor } from "./StakingEditor";
import { StakingManagerAction } from "./StakingManagerAction";
import { ActionDescription, Amount } from "../ActionDescription";
import { ErrorDescription } from "../ErrorDescription";

const init = ({ mpStake }: MoneypStoreState) => ({
  originalStake: mpStake,
  editedMP: mpStake.stakedMP
});

type StakeManagerState = ReturnType<typeof init>;
type StakeManagerAction =
  | MoneypStoreUpdate
  | { type: "revert" }
  | { type: "setStake"; newValue: Decimalish };

const reduce = (state: StakeManagerState, action: StakeManagerAction): StakeManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalStake, editedMP } = state;

  switch (action.type) {
    case "setStake":
      return { ...state, editedMP: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedMP: originalStake.stakedMP };

    case "updateStore": {
      const {
        stateChange: { mpStake: updatedStake }
      } = action;

      if (updatedStake) {
        return {
          originalStake: updatedStake,
          editedMP: updatedStake.apply(originalStake.whatChanged(editedMP))
        };
      }
    }
  }

  return state;
};

const selectMPBalance = ({ mpBalance }: MoneypStoreState) => mpBalance;

type StakingManagerActionDescriptionProps = {
  originalStake: MPStake;
  change: MPStakeChange<Decimal>;
};

const StakingManagerActionDescription: React.FC<StakingManagerActionDescriptionProps> = ({
  originalStake,
  change
}) => {
  const stakeMP = change.stakeMP?.prettify().concat(" ", GT);
  const unstakeMP = change.unstakeMP?.prettify().concat(" ", GT);
  const collateralGain = originalStake.collateralGain.nonZero?.prettify(4).concat(" RBTC");
  const bpdGain = originalStake.bpdGain.nonZero?.prettify().concat(" ", COIN);

  if (originalStake.isEmpty && stakeMP) {
    return (
      <ActionDescription>
        You are staking <Amount>{stakeMP}</Amount>.
      </ActionDescription>
    );
  }

  return (
    <ActionDescription>
      {stakeMP && (
        <>
          You are adding <Amount>{stakeMP}</Amount> to your stake
        </>
      )}
      {unstakeMP && (
        <>
          You are withdrawing <Amount>{unstakeMP}</Amount> to your wallet
        </>
      )}
      {(collateralGain || bpdGain) && (
        <>
          {" "}
          and claiming{" "}
          {collateralGain && bpdGain ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{bpdGain}</Amount>
            </>
          ) : (
            <>
              <Amount>{collateralGain ?? bpdGain}</Amount>
            </>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};

export const StakingManager: React.FC = () => {
  const { dispatch: dispatchStakingViewAction } = useStakingView();
  const [{ originalStake, editedMP }, dispatch] = useMoneypReducer(reduce, init);
  const mpBalance = useMoneypSelector(selectMPBalance);

  const change = originalStake.whatChanged(editedMP);
  const [validChange, description] = !change
    ? [undefined, undefined]
    : change.stakeMP?.gt(mpBalance)
    ? [
        undefined,
        <ErrorDescription>
          The amount you're trying to stake exceeds your balance by{" "}
          <Amount>
            {change.stakeMP.sub(mpBalance).prettify()} {GT}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [change, <StakingManagerActionDescription originalStake={originalStake} change={change} />];

  const makingNewStake = originalStake.isEmpty;

  return (
    <StakingEditor title={"Staking"} {...{ originalStake, editedMP, dispatch }}>
      {description ??
        (makingNewStake ? (
          <ActionDescription>Enter the amount of {GT} you'd like to stake.</ActionDescription>
        ) : (
          <ActionDescription>Adjust the {GT} amount to stake or withdraw.</ActionDescription>
        ))}

      <Flex variant="layout.actions">
        <Button
          variant="cancel"
          onClick={() => dispatchStakingViewAction({ type: "cancelAdjusting" })}
        >
          Cancel
        </Button>

        {validChange ? (
          <StakingManagerAction change={validChange}>Confirm</StakingManagerAction>
        ) : (
          <Button disabled>Confirm</Button>
        )}
      </Flex>
    </StakingEditor>
  );
};
