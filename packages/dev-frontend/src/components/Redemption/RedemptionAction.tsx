import { Button } from "theme-ui"

import { Decimal } from "@money-protocol/lib-base"

import { useMoneyp } from "../../hooks/MoneypContext"
import { useTransactionFunction } from "../Transaction"

type RedemptionActionProps = {
  transactionId: string
  disabled?: boolean
  bpdAmount: Decimal
  maxRedemptionRate: Decimal
}

export const RedemptionAction: React.FC<RedemptionActionProps> = ({
  transactionId,
  disabled,
  bpdAmount,
  maxRedemptionRate,
}) => {
  const {
    moneyp: { send: moneyp },
  } = useMoneyp()

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    moneyp.redeemBPD.bind(moneyp, bpdAmount, maxRedemptionRate)
  )

  return (
    <Button disabled={disabled} onClick={sendTransaction}>
      Confirm
    </Button>
  )
}
