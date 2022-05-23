import React from "react";

import { Decimal, StabilityDeposit, StabilityDepositChange } from "@liquity/lib-base";

import { COIN, GT } from "../../strings";
import { ActionDescription, Amount } from "../ActionDescription";

type StabilityActionDescriptionProps = {
  originalDeposit: StabilityDeposit;
  change: StabilityDepositChange<Decimal>;
};

export const StabilityActionDescription: React.FC<StabilityActionDescriptionProps> = ({
  originalDeposit,
  change
}) => {
  const collateralGain = originalDeposit.collateralGain.nonZero?.prettify(4).concat(" RBTC");
  const mpReward = originalDeposit.mpReward.nonZero?.prettify().concat(" ", GT);

  return (
    <ActionDescription>
      {change.depositBPD ? (
        <>
          You are depositing{" "}
          <Amount>
            {change.depositBPD.prettify()} {COIN}
          </Amount>{" "}
          in the Stability Pool
        </>
      ) : (
        <>
          You are withdrawing{" "}
          <Amount>
            {change.withdrawBPD.prettify()} {COIN}
          </Amount>{" "}
          to your wallet
        </>
      )}
      {(collateralGain || mpReward) && (
        <>
          {" "}
          and claiming{" "}
          {collateralGain && mpReward ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{mpReward}</Amount>
            </>
          ) : (
            <Amount>{collateralGain ?? mpReward}</Amount>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};
