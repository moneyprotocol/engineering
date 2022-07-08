import { Button } from "theme-ui";

import { Decimal, MPStakeChange } from "@moneyprotocol/lib-base";

import { useMoneyp } from "../../hooks/MoneypContext";
import { useTransactionFunction } from "../Transaction";

type StakingActionProps = {
  change: MPStakeChange<Decimal>;
};

export const StakingManagerAction: React.FC<StakingActionProps> = ({ change, children }) => {
  const { moneyp } = useMoneyp();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeMP
      ? moneyp.send.stakeMP.bind(moneyp.send, change.stakeMP)
      : moneyp.send.unstakeMP.bind(moneyp.send, change.unstakeMP)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
