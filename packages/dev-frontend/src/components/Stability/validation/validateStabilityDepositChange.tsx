import {
  Decimal,
  MoneypStoreState,
  StabilityDeposit,
  StabilityDepositChange
} from "@moneyprotocol/lib-base";

import { COIN } from "../../../strings";
import { Amount } from "../../ActionDescription";
import { ErrorDescription } from "../../ErrorDescription";
import { StabilityActionDescription } from "../StabilityActionDescription";

export const selectForStabilityDepositChangeValidation = ({
  vault,
  bpdBalance,
  ownFrontend,
  haveUndercollateralizedVaults
}: MoneypStoreState) => ({
  vault,
  bpdBalance,
  haveOwnFrontend: ownFrontend.status === "registered",
  haveUndercollateralizedVaults
});

type StabilityDepositChangeValidationContext = ReturnType<
  typeof selectForStabilityDepositChangeValidation
>;

export const validateStabilityDepositChange = (
  originalDeposit: StabilityDeposit,
  editedBPD: Decimal,
  {
    bpdBalance,
    haveOwnFrontend,
    haveUndercollateralizedVaults
  }: StabilityDepositChangeValidationContext
): [
  validChange: StabilityDepositChange<Decimal> | undefined,
  description: JSX.Element | undefined
] => {
  const change = originalDeposit.whatChanged(editedBPD);

  if (haveOwnFrontend) {
    return [
      undefined,
      <ErrorDescription>
        You can't deposit using the same wallet address that registered this frontend.
      </ErrorDescription>
    ];
  }

  if (!change) {
    return [undefined, undefined];
  }

  if (change.depositBPD?.gt(bpdBalance)) {
    return [
      undefined,
      <ErrorDescription>
        The amount you're trying to deposit exceeds your balance by{" "}
        <Amount>
          {change.depositBPD.sub(bpdBalance).prettify()} {COIN}
        </Amount>
        .
      </ErrorDescription>
    ];
  }

  if (change.withdrawBPD && haveUndercollateralizedVaults) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to withdraw BPD from your Stability Deposit when there are
        undercollateralized Vaults. Please liquidate those Vaults or try again later.
      </ErrorDescription>
    ];
  }

  return [change, <StabilityActionDescription originalDeposit={originalDeposit} change={change} />];
};
