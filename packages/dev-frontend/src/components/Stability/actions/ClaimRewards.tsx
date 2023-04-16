import React from "react"
import { Button } from "theme-ui"

import { useMoneyp } from "../../../hooks/MoneypContext"
import { useTransactionFunction } from "../../Transaction"

type ClaimRewardsProps = {
  disabled?: boolean
}

export const ClaimRewards: React.FC<ClaimRewardsProps> = ({ disabled, children }) => {
  const { moneyp } = useMoneyp()

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    moneyp.send.withdrawGainsFromStabilityPool.bind(moneyp.send)
  )

  return (
    <Button onClick={sendTransaction} disabled={disabled} sx={{ borderRadius: "6px" }}>
      {children}
    </Button>
  )
}
