import React, { useEffect, useState } from "react";
import { Button, Box, Flex, Card, Heading } from "theme-ui";

import { Decimal, Percent, MoneypStoreState, MINIMUM_COLLATERAL_RATIO } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@moneyprotocol/lib-react";

import { COIN } from "../../strings";

import { Icon } from "../Icon";
import { LoadingOverlay } from "../LoadingOverlay";
import { EditableRow, StaticRow } from "../Vault/Editor";
import { ActionDescription, Amount } from "../ActionDescription";
import { ErrorDescription } from "../ErrorDescription";
import { useMyTransactionState } from "../Transaction";

import { RedemptionAction } from "./RedemptionAction";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);

const select = ({ price, fees, total, bpdBalance }: MoneypStoreState) => ({
  price,
  fees,
  total,
  bpdBalance
});

const transactionId = "redemption";

export const RedemptionManager: React.FC = () => {
  const { price, fees, total, bpdBalance } = useMoneypSelector(select);
  const [bpdAmount, setBPDAmount] = useState(Decimal.ZERO);
  const [changePending, setChangePending] = useState(false);
  const editingState = useState<string>();

  const dirty = !bpdAmount.isZero;
  const ethAmount = bpdAmount.div(price);
  const redemptionRate = fees.redemptionRate(bpdAmount.div(total.debt));
  const feePct = new Percent(redemptionRate);
  const ethFee = ethAmount.mul(redemptionRate);
  const maxRedemptionRate = redemptionRate.add(0.001); // TODO slippage tolerance

  const myTransactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    } else if (myTransactionState.type === "confirmed") {
      setBPDAmount(Decimal.ZERO);
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending, setBPDAmount]);

  const [canRedeem, description] = total.collateralRatioIsBelowMinimum(price)
    ? [
        false,
        <ErrorDescription>
          You can't redeem BPD when the total collateral ratio is less than{" "}
          <Amount>{mcrPercent}</Amount>. Please try again later.
        </ErrorDescription>
      ]
    : bpdAmount.gt(bpdBalance)
    ? [
        false,
        <ErrorDescription>
          The amount you're trying to redeem exceeds your balance by{" "}
          <Amount>
            {bpdAmount.sub(bpdBalance).prettify()} {COIN}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [
        true,
        <ActionDescription>
          You will receive <Amount>{ethAmount.sub(ethFee).prettify(4)} RBTC</Amount> in exchange for{" "}
          <Amount>
            {bpdAmount.prettify()} {COIN}
          </Amount>
          .
        </ActionDescription>
      ];

  return (
    <Card>
      <Heading>
        Redemption
        {dirty && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setBPDAmount(Decimal.ZERO)}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Redeem"
          inputId="redeem-bpd"
          amount={bpdAmount.prettify()}
          maxAmount={bpdBalance.toString()}
          maxedOut={bpdAmount.eq(bpdBalance)}
          unit={COIN}
          {...{ editingState }}
          editedAmount={bpdAmount.toString(2)}
          setEditedAmount={amount => setBPDAmount(Decimal.from(amount))}
        />

        {dirty && (
          <StaticRow
            label="Fee"
            inputId="redeem-fee"
            amount={ethFee.toString(4)}
            pendingAmount={feePct.toString(2)}
            unit="RBTC"
          />
        )}

        {((dirty || !canRedeem) && description) || (
          <ActionDescription>Enter the amount of {COIN} you'd like to redeem.</ActionDescription>
        )}

        <Flex variant="layout.actions">
          <RedemptionAction
            transactionId={transactionId}
            disabled={!dirty || !canRedeem}
            bpdAmount={bpdAmount}
            maxRedemptionRate={maxRedemptionRate}
          />
        </Flex>
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
