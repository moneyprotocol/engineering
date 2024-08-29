import React, { useState } from "react"
import { Heading, Box, Card, Button } from "theme-ui"

import { Decimal, Decimalish, MoneypStoreState, MPStake } from "@money-protocol/lib-base"
import { useMoneypSelector } from "@moneyprotocol/lib-react"

import { COIN, GT } from "../../strings"

import { EditableRow, StaticRow } from "../Vault/Editor"
import { LoadingOverlay } from "../LoadingOverlay"

import { useStakingView } from "./context/StakingViewContext"
import { ResetIcon } from "../shared/ResetIcon"

const selectMPBalance = ({ mpBalance }: MoneypStoreState) => mpBalance

type StakingEditorProps = {
  title: string
  originalStake: MPStake
  editedMP: Decimal
  dispatch: (action: { type: "setStake"; newValue: Decimalish } | { type: "revert" }) => void
}

export const StakingEditor: React.FC<StakingEditorProps> = ({
  children,
  title,
  originalStake,
  editedMP,
  dispatch,
}) => {
  const mpBalance = useMoneypSelector(selectMPBalance)
  const { changePending } = useStakingView()
  const editingState = useState<string>()

  const edited = !editedMP.eq(originalStake.stakedMP)

  const maxAmount = originalStake.stakedMP.add(mpBalance)
  const maxedOut = editedMP.eq(maxAmount)

  return (
    <Card>
      <Heading>
        {title}
        {edited && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => dispatch({ type: "revert" })}
          >
            <ResetIcon />
          </Button>
        )}
      </Heading>

      <Box sx={{ pt: "20px" }}>
        <EditableRow
          label="Stake"
          inputId="stake-mp"
          amount={editedMP.prettify()}
          maxAmount={maxAmount.toString()}
          maxedOut={maxedOut}
          unit={GT}
          {...{ editingState }}
          editedAmount={editedMP.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setStake", newValue })}
        />

        {!originalStake.isEmpty && (
          <>
            <StaticRow
              label="Redemption gain"
              inputId="stake-gain-eth"
              amount={originalStake.collateralGain.prettify(4)}
              color={originalStake.collateralGain.nonZero && "blueSuccess"}
              unit="RBTC"
            />

            <StaticRow
              label="Issuance gain"
              inputId="stake-gain-bpd"
              amount={originalStake.bpdGain.prettify()}
              color={originalStake.bpdGain.nonZero && "blueSuccess"}
              unit={COIN}
            />
          </>
        )}

        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  )
}
