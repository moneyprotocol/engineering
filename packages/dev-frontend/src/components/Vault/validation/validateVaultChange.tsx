import {
  Decimal,
  BPD_MINIMUM_DEBT,
  Vault,
  VaultAdjustmentParams,
  VaultChange,
  Percent,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  MoneypStoreState
} from "@moneyprotocol/lib-base";

import { COIN } from "../../../strings";

import { ActionDescription, Amount } from "../../ActionDescription";
import { ErrorDescription } from "../../ErrorDescription";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);
const ccrPercent = new Percent(CRITICAL_COLLATERAL_RATIO).toString(0);

type VaultAdjustmentDescriptionParams = {
  params: VaultAdjustmentParams<Decimal>;
};

const VaultAdjustmentDescription: React.FC<VaultAdjustmentDescriptionParams> = ({ params }) => (
  <ActionDescription>
    {params.depositCollateral && params.borrowBPD ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} RBTC</Amount> and receive{" "}
        <Amount>
          {params.borrowBPD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.repayBPD && params.withdrawCollateral ? (
      <>
        You will pay{" "}
        <Amount>
          {params.repayBPD.prettify()} {COIN}
        </Amount>{" "}
        and receive <Amount>{params.withdrawCollateral.prettify()} RBTC</Amount>
      </>
    ) : params.depositCollateral && params.repayBPD ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} RBTC</Amount> and pay{" "}
        <Amount>
          {params.repayBPD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.borrowBPD && params.withdrawCollateral ? (
      <>
        You will receive <Amount>{params.withdrawCollateral.prettify()} RBTC</Amount> and{" "}
        <Amount>
          {params.borrowBPD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.depositCollateral ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} RBTC</Amount>
      </>
    ) : params.withdrawCollateral ? (
      <>
        You will receive <Amount>{params.withdrawCollateral.prettify()} RBTC</Amount>
      </>
    ) : params.borrowBPD ? (
      <>
        You will receive{" "}
        <Amount>
          {params.borrowBPD.prettify()} {COIN}
        </Amount>
      </>
    ) : (
      <>
        You will pay{" "}
        <Amount>
          {params.repayBPD.prettify()} {COIN}
        </Amount>
      </>
    )}
    .
  </ActionDescription>
);

export const selectForVaultChangeValidation = ({
  price,
  total,
  bpdBalance,
  numberOfVaults
}: MoneypStoreState) => ({ price, total, bpdBalance, numberOfVaults });

type VaultChangeValidationContext = ReturnType<typeof selectForVaultChangeValidation>;

export const validateVaultChange = (
  original: Vault,
  edited: Vault,
  borrowingRate: Decimal,
  { price, total, bpdBalance, numberOfVaults }: VaultChangeValidationContext
): [
  validChange: Exclude<VaultChange<Decimal>, { type: "invalidCreation" }> | undefined,
  description: JSX.Element | undefined
] => {
  const change = original.whatChanged(edited, borrowingRate);
  // Reapply change to get the exact state the Vault will end up in (which could be slightly
  // different from `edited` due to imprecision).
  const afterFee = original.apply(change, borrowingRate);

  if (!change) {
    return [undefined, undefined];
  }

  if (
    change.type === "invalidCreation" ||
    (change.type !== "closure" && afterFee.debt.lt(BPD_MINIMUM_DEBT))
  ) {
    return [
      undefined,
      <ErrorDescription>
        Debt must be be at least{" "}
        <Amount>
          {BPD_MINIMUM_DEBT.toString()} {COIN}
        </Amount>
        .
      </ErrorDescription>
    ];
  }

  if (
    (change.type === "creation" ||
      (change.type === "adjustment" &&
        (change.params.withdrawCollateral || change.params.borrowBPD))) &&
    afterFee.collateralRatioIsBelowMinimum(price)
  ) {
    return [
      undefined,
      <ErrorDescription>
        Collateral ratio must be at least <Amount>{mcrPercent}</Amount>.
      </ErrorDescription>
    ];
  }

  if (
    (change.type === "creation" || change.type === "adjustment") &&
    !total.collateralRatioIsBelowCritical(price) &&
    total.subtract(original).add(afterFee).collateralRatioIsBelowCritical(price)
  ) {
    return [
      undefined,
      change.type === "creation" ? (
        <ErrorDescription>
          You're not allowed to open a Vault that would cause the total collateral ratio to fall
          below <Amount>{ccrPercent}</Amount>. Please increase your collateral ratio.
        </ErrorDescription>
      ) : (
        <ErrorDescription>
          The adjustment you're trying to make would cause the total collateral ratio to fall below{" "}
          <Amount>{ccrPercent}</Amount>. Please increase your collateral ratio.
        </ErrorDescription>
      )
    ];
  }

  if (change.params.repayBPD?.gt(bpdBalance)) {
    return [
      undefined,
      edited.isEmpty ? (
        <ErrorDescription>
          You need{" "}
          <Amount>
            {change.params.repayBPD.sub(bpdBalance).prettify()} {COIN}
          </Amount>{" "}
          more to close your Vault.
        </ErrorDescription>
      ) : (
        <ErrorDescription>
          The amount you're trying to repay exceeds your balance by{" "}
          <Amount>
            {change.params.repayBPD.sub(bpdBalance).prettify()} {COIN}
          </Amount>
          .
        </ErrorDescription>
      )
    ];
  }

  if (
    change.type === "creation" &&
    total.collateralRatioIsBelowCritical(price) &&
    !afterFee.isOpenableInRecoveryMode(price)
  ) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to open a Vault with less than <Amount>{ccrPercent}</Amount> collateral
        ratio during recovery mode. Please increase your collateral ratio.
      </ErrorDescription>
    ];
  }

  if (change.type === "closure" && total.collateralRatioIsBelowCritical(price)) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to close your Vault during recovery mode.
      </ErrorDescription>
    ];
  }

  if (change.type === "closure" && numberOfVaults === 1) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to close your Vault when there are no other Vaults in the system.
      </ErrorDescription>
    ];
  }

  if (
    change.type === "adjustment" &&
    total.collateralRatioIsBelowCritical(price) &&
    afterFee.collateralRatio(price).lt(original.collateralRatio(price))
  ) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to decrease your collateral ratio during recovery mode.
      </ErrorDescription>
    ];
  }

  return [change, <VaultAdjustmentDescription params={change.params} />];
};
