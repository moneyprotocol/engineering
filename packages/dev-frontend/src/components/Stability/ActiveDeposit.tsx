import React, { useCallback, useEffect } from "react"
import { Card, Heading, Box, Flex, Button } from "theme-ui"

import { MoneypStoreState } from "@money-protocol/lib-base"
import { useMoneypSelector } from "@moneyprotocol/lib-react"

import { COIN, GT } from "../../strings"
import { LoadingOverlay } from "../LoadingOverlay"
import { useMyTransactionState } from "../Transaction"
import { DisabledEditableRow, StaticRow } from "../Vault/Editor"
import { ClaimAndMove } from "./actions/ClaimAndMove"
import { ClaimRewards } from "./actions/ClaimRewards"
import { useStabilityView } from "./context/StabilityViewContext"
import { RemainingMP } from "./RemainingMP"
import { Yield } from "./Yield"

const selector = ({ stabilityDeposit, vault }: MoneypStoreState) => ({ stabilityDeposit, vault })

export const ActiveDeposit: React.FC = () => {
  const { dispatchEvent } = useStabilityView()
  const { stabilityDeposit, vault } = useMoneypSelector(selector)

  const handleAdjustDeposit = useCallback(() => {
    dispatchEvent("ADJUST_DEPOSIT_PRESSED")
  }, [dispatchEvent])

  const hasReward = !stabilityDeposit.mpReward.isZero
  const hasGain = !stabilityDeposit.collateralGain.isZero
  const hasVault = !vault.isEmpty

  const transactionId = "stability-deposit"
  const transactionState = useMyTransactionState(transactionId)
  const isWaitingForTransaction =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation"

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("REWARDS_CLAIMED")
    }
  }, [transactionState.type, dispatchEvent])

  return (
    <Card>
      <Heading>
        Stability Pool
        {!isWaitingForTransaction && (
          <Flex sx={{ justifyContent: "flex-end" }}>
            <RemainingMP />
          </Flex>
        )}
      </Heading>
      <Box sx={{ pt: "20px" }}>
        <Box>
          <DisabledEditableRow
            label="Deposit"
            inputId="deposit-bpd"
            amount={stabilityDeposit.currentBPD.prettify()}
            unit={COIN}
          />

          <StaticRow
            label="Liquidation gain"
            inputId="deposit-gain"
            amount={stabilityDeposit.collateralGain.prettify(4)}
            color={stabilityDeposit.collateralGain.nonZero && "blueSuccess"}
            unit="RBTC"
          />

          <Flex sx={{ alignItems: "center" }}>
            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={stabilityDeposit.mpReward.prettify()}
              color={stabilityDeposit.mpReward.nonZero && "blueSuccess"}
              unit={GT}
            />
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <Yield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={handleAdjustDeposit}>
            Adjust
          </Button>

          <ClaimRewards disabled={!hasGain && !hasReward}>Claim RBTC and MP</ClaimRewards>
        </Flex>

        {hasVault && (
          <ClaimAndMove disabled={!hasGain && !hasReward}>
            Claim MP and move RBTC to Vault
          </ClaimAndMove>
        )}
      </Box>

      {isWaitingForTransaction && <LoadingOverlay />}
    </Card>
  )
}
