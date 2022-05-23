import { Button } from "theme-ui";

import { MoneypStoreState } from "@liquity/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";

import { useMoneyp } from "../../hooks/MoneypContext";
import { useTransactionFunction } from "../Transaction";

const selectMPStake = ({ mpStake }: MoneypStoreState) => mpStake;

export const StakingGainsAction: React.FC = () => {
  const { moneyp } = useMoneyp();
  const { collateralGain, bpdGain } = useMoneypSelector(selectMPStake);

  const [sendTransaction] = useTransactionFunction(
    "stake",
    moneyp.send.withdrawGainsFromStaking.bind(moneyp.send)
  );

  return (
    <Button onClick={sendTransaction} disabled={collateralGain.isZero && bpdGain.isZero}>
      Claim gains
    </Button>
  );
};
