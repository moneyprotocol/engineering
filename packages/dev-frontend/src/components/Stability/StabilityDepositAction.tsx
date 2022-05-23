import { Button } from "theme-ui";
import { Decimal, MoneypStoreState, StabilityDepositChange } from "@liquity/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";

import { useMoneyp } from "../../hooks/MoneypContext";
import { useTransactionFunction } from "../Transaction";

type StabilityDepositActionProps = {
  transactionId: string;
  change: StabilityDepositChange<Decimal>;
};

const selectFrontendRegistered = ({ frontend }: MoneypStoreState) =>
  frontend.status === "registered";

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  children,
  transactionId,
  change
}) => {
  const { config, moneyp } = useMoneyp();
  const frontendRegistered = useMoneypSelector(selectFrontendRegistered);

  const frontendTag = frontendRegistered ? config.frontendTag : undefined;

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.depositBPD
      ? moneyp.send.depositBPDInStabilityPool.bind(moneyp.send, change.depositBPD, frontendTag)
      : moneyp.send.withdrawBPDFromStabilityPool.bind(moneyp.send, change.withdrawBPD)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
