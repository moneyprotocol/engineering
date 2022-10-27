import { Decimal, MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";

const selector = ({
  rskSwapTokenBalance,
  rskSwapTokenAllowance,
  liquidityMiningStake
}: MoneypStoreState) => ({
  rskSwapTokenBalance,
  rskSwapTokenAllowance,
  liquidityMiningStake
});

type FarmStakeValidation = {
  isValid: boolean;
  hasApproved: boolean;
  hasEnoughRskSwapToken: boolean;
  isWithdrawing: boolean;
  amountChanged: Decimal;
  maximumStake: Decimal;
  hasSetMaximumStake: boolean;
};

export const useValidationState = (amount: Decimal): FarmStakeValidation => {
  const { rskSwapTokenBalance, rskSwapTokenAllowance, liquidityMiningStake } = useMoneypSelector(selector);
  const isWithdrawing = liquidityMiningStake.gt(amount);
  const amountChanged = isWithdrawing
    ? liquidityMiningStake.sub(amount)
    : Decimal.from(amount).sub(liquidityMiningStake);
  const maximumStake = liquidityMiningStake.add(rskSwapTokenBalance);
  const hasSetMaximumStake = amount.eq(maximumStake);

  if (isWithdrawing) {
    return {
      isValid: true,
      hasApproved: true,
      hasEnoughRskSwapToken: true,
      isWithdrawing,
      amountChanged,
      maximumStake,
      hasSetMaximumStake
    };
  }

  const hasApproved = !rskSwapTokenAllowance.isZero && rskSwapTokenAllowance.gte(amountChanged);
  const hasEnoughRskSwapToken = !rskSwapTokenBalance.isZero && rskSwapTokenBalance.gte(amountChanged);

  return {
    isValid: hasApproved && hasEnoughRskSwapToken,
    hasApproved,
    hasEnoughRskSwapToken,
    isWithdrawing,
    amountChanged,
    maximumStake,
    hasSetMaximumStake
  };
};
