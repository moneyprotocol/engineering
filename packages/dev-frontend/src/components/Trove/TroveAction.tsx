import { Button } from "theme-ui";

import { Decimal, VaultChange } from "@liquity/lib-base";

import { useMoneyp } from "../../hooks/MoneypContext";
import { useTransactionFunction } from "../Transaction";

type VaultActionProps = {
  transactionId: string;
  change: Exclude<VaultChange<Decimal>, { type: "invalidCreation" }>;
  maxBorrowingRate: Decimal;
};

export const VaultAction: React.FC<VaultActionProps> = ({
  children,
  transactionId,
  change,
  maxBorrowingRate
}) => {
  const { moneyp } = useMoneyp();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.type === "creation"
      ? moneyp.send.openVault.bind(moneyp.send, change.params, maxBorrowingRate)
      : change.type === "closure"
      ? moneyp.send.closeVault.bind(moneyp.send)
      : moneyp.send.adjustVault.bind(moneyp.send, change.params, maxBorrowingRate)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
