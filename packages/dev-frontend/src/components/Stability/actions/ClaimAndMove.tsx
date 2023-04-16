import React from "react"
import { Button } from "theme-ui"
import { useMoneyp } from "../../../hooks/MoneypContext"
import { useTransactionFunction } from "../../Transaction"

type ClaimAndMoveProps = {
  disabled?: boolean
}

export const ClaimAndMove: React.FC<ClaimAndMoveProps> = ({ disabled, children }) => {
  const { moneyp } = useMoneyp()

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    moneyp.send.transferCollateralGainToVault.bind(moneyp.send)
  )

  return (
    <Button
      variant="outline"
      sx={{ mt: 3, width: "100%", borderRadius: "6px" }}
      onClick={sendTransaction}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}
