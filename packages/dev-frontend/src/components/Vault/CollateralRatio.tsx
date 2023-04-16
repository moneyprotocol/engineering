import React from "react"
import { Card } from "theme-ui"

import {
  CRITICAL_COLLATERAL_RATIO,
  Decimal,
  Difference,
  MINIMUM_COLLATERAL_RATIO,
  Percent,
} from "@moneyprotocol/lib-base"

import { StaticRow } from "./Editor"
import { InfoIcon } from "../InfoIcon"

type CollateralRatioProps = {
  value?: Decimal
  change?: Difference
}

export const CollateralRatio: React.FC<CollateralRatioProps> = ({ value, change }) => {
  const collateralRatioPct = new Percent(value ?? { toString: () => "N/A" })
  const changePct = change && new Percent(change)

  return (
    <StaticRow
      label="Collateral Ratio"
      inputId="vault-collateral-ratio"
      amount={collateralRatioPct.prettify()}
      color={
        value?.gt(CRITICAL_COLLATERAL_RATIO)
          ? "blueSuccess"
          : value?.gt(MINIMUM_COLLATERAL_RATIO)
          ? "warning"
          : value?.lte(MINIMUM_COLLATERAL_RATIO)
          ? "danger"
          : "muted"
      }
      pendingAmount={
        change?.positive?.absoluteValue?.gt(10)
          ? "++"
          : change?.negative?.absoluteValue?.gt(10)
          ? "--"
          : changePct?.nonZeroish(2)?.prettify()
      }
      pendingColor={change?.positive ? "blueSuccess" : "danger"}
      infoIcon={
        <InfoIcon
          size={"xs"}
          tooltip={
            <Card variant="tooltip" sx={{ width: "220px" }}>
              This is the ratio between the dollar value of the collateral and debt you are
              depositing.
            </Card>
          }
        />
      }
    />
  )
}
