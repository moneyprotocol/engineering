import React from "react";
import { Text } from "theme-ui";
import { useMoneyp } from "../../../hooks/MoneypContext";
import { LP } from "../../../strings";
import { Transaction } from "../../Transaction";
import { Decimal } from "@liquity/lib-base";
import { ActionDescription } from "../../ActionDescription";
import { useValidationState } from "../context/useValidationState";

type DescriptionProps = {
  amount: Decimal;
};

const transactionId = "farm-stake";

export const Description: React.FC<DescriptionProps> = ({ amount }) => {
  const {
    moneyp: { send: moneyp }
  } = useMoneyp();
  const { isValid, hasApproved, isWithdrawing, amountChanged } = useValidationState(amount);

  if (!hasApproved) {
    return (
      <ActionDescription>
        <Text>To stake your {LP} tokens you need to allow Moneyp to stake them for you</Text>
      </ActionDescription>
    );
  }

  if (!isValid || amountChanged.isZero) {
    return null;
  }

  return (
    <ActionDescription>
      {isWithdrawing && (
        <Transaction id={transactionId} send={moneyp.unstakeRskSwapTokens.bind(moneyp, amountChanged)}>
          <Text>
            You are unstaking {amountChanged.prettify(4)} {LP}
          </Text>
        </Transaction>
      )}
      {!isWithdrawing && (
        <Transaction id={transactionId} send={moneyp.stakeRskSwapTokens.bind(moneyp, amountChanged)}>
          <Text>
            You are staking {amountChanged.prettify(4)} {LP}
          </Text>
        </Transaction>
      )}
    </ActionDescription>
  );
};
