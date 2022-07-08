import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { LP, GT } from "../../../../strings";
import { MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";
import { Icon } from "../../../Icon";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMyTransactionState } from "../../../Transaction";
import { DisabledEditableRow, StaticRow } from "../../../Vault/Editor";
import { useFarmView } from "../../context/FarmViewContext";
import { RemainingMP } from "../RemainingMP";
import { ClaimReward } from "./ClaimReward";
import { UnstakeAndClaim } from "../UnstakeAndClaim";
import { Yield } from "../Yield";

const selector = ({ liquidityMiningStake, liquidityMiningMPReward }: MoneypStoreState) => ({
  liquidityMiningStake,
  liquidityMiningMPReward
});
const transactionId = /farm-/i;

export const Active: React.FC = () => {
  const { dispatchEvent } = useFarmView();
  const { liquidityMiningStake, liquidityMiningMPReward } = useMoneypSelector(selector);

  const handleAdjustPressed = useCallback(() => {
    dispatchEvent("ADJUST_PRESSED");
  }, [dispatchEvent]);

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  return (
    <Card>
      <Heading>
        Liquidity farm
        {!isTransactionPending && (
          <Flex sx={{ justifyContent: "flex-end" }}>
            <RemainingMP />
          </Flex>
        )}
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Stake"
            inputId="farm-stake"
            amount={liquidityMiningStake.prettify(4)}
            unit={LP}
          />
          <Flex sx={{ alignItems: "center" }}>
            <StaticRow
              label="Reward"
              inputId="farm-reward"
              amount={liquidityMiningMPReward.prettify(4)}
              color={liquidityMiningMPReward.nonZero && "success"}
              unit={GT}
            />
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <Yield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={handleAdjustPressed}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
          <ClaimReward />
        </Flex>
        <Flex>
          <UnstakeAndClaim />
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
