import React, { useState } from "react"
import { Heading, Box, Card, Button } from "theme-ui"

import {
  Percent,
  Difference,
  Decimalish,
  Decimal,
  Vault,
  MoneypStoreState,
  BPD_LIQUIDATION_RESERVE,
} from "@moneyprotocol/lib-base"
import { useMoneypSelector } from "@moneyprotocol/lib-react"

import { COIN } from "../../strings"

import { ResetIcon } from "../shared/ResetIcon"
import { EditableRow, StaticRow } from "./Editor"
import { LoadingOverlay } from "../LoadingOverlay"
import { CollateralRatio } from "./CollateralRatio"
import { InfoIcon } from "../InfoIcon"

const gasRoomRBTC = Decimal.from(0.1)

type VaultEditorProps = {
  original: Vault
  edited: Vault
  fee: Decimal
  borrowingRate: Decimal
  changePending: boolean
  dispatch: (
    action: { type: "setCollateral" | "setDebt"; newValue: Decimalish } | { type: "revert" }
  ) => void
}

const select = ({ price, accountBalance }: MoneypStoreState) => ({ price, accountBalance })

export const VaultEditor: React.FC<VaultEditorProps> = ({
  children,
  original,
  edited,
  fee,
  borrowingRate,
  changePending,
  dispatch,
}) => {
  const { price, accountBalance } = useMoneypSelector(select)

  const editingState = useState<string>()

  const feePct = new Percent(borrowingRate)

  const originalCollateralRatio = !original.isEmpty ? original.collateralRatio(price) : undefined
  const collateralRatio = !edited.isEmpty ? edited.collateralRatio(price) : undefined
  const collateralRatioChange = Difference.between(collateralRatio, originalCollateralRatio)

  const maxEth = accountBalance.gt(gasRoomRBTC) ? accountBalance.sub(gasRoomRBTC) : Decimal.ZERO
  const maxCollateral = original.collateral.add(maxEth)
  const collateralMaxedOut = edited.collateral.eq(maxCollateral)

  const dirty = !edited.equals(original)

  return (
    <Card>
      <Heading>
        Vault
        {dirty && !changePending && (
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
          label="Collateral"
          inputId="vault-collateral"
          amount={edited.collateral.prettify(4)}
          maxAmount={maxCollateral.toString()}
          maxedOut={collateralMaxedOut}
          unit="RBTC"
          {...{ editingState }}
          editedAmount={edited.collateral.toString(4)}
          setEditedAmount={(editedCollateral: string) =>
            dispatch({ type: "setCollateral", newValue: editedCollateral })
          }
        />

        <EditableRow
          label="Debt"
          inputId="vault-debt"
          amount={edited.debt.prettify()}
          unit={COIN}
          {...{ editingState }}
          editedAmount={edited.debt.toString(2)}
          setEditedAmount={(editedDebt: string) =>
            dispatch({ type: "setDebt", newValue: editedDebt })
          }
        />

        {original.isEmpty && (
          <StaticRow
            label="Liquidation reserve"
            inputId="vault-liquidation-reserve"
            amount={`${BPD_LIQUIDATION_RESERVE}`}
            unit={COIN}
            infoIcon={
              <InfoIcon
                tooltip={
                  <Card variant="tooltip" sx={{ width: "200px" }}>
                    This fee covers the gas cost a liquidator would pay to liquidate your Vault. You
                    are refunded this fee when you repay your debt.
                  </Card>
                }
              />
            }
          />
        )}

        <StaticRow
          label="Fee"
          inputId="vault-borrowing-fee"
          amount={fee.toString(2)}
          pendingAmount={feePct.toString(2)}
          unit={COIN}
          infoIcon={
            <InfoIcon
              size="xs"
              tooltip={
                <Card variant="tooltip" sx={{ width: "240px" }}>
                  This is a one-time fee applied to your borrowed amount. It has 0% interest.
                </Card>
              }
            />
          }
        />

        <CollateralRatio value={collateralRatio} change={collateralRatioChange} />

        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  )
}
