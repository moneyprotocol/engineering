import React from "react"
import { Card, Heading, Link, Box, Text, Container } from "theme-ui"
import { AddressZero } from "@ethersproject/constants"
import { Decimal, Percent, MoneypStoreState } from "@moneyprotocol/lib-base"
import { useMoneypSelector } from "@moneyprotocol/lib-react"

import { useMoneyp } from "../hooks/MoneypContext"
import { COIN, GT } from "../strings"
import { Statistic } from "./Statistic"

const selectBalances = ({ accountBalance, bpdBalance, mpBalance }: MoneypStoreState) => ({
  accountBalance,
  bpdBalance,
  mpBalance,
})

const Balances: React.FC = () => {
  const { accountBalance, bpdBalance, mpBalance } = useMoneypSelector(selectBalances)

  return (
    <Box sx={{ mb: 3 }}>
      <Heading>My Account Balances</Heading>
      <Box>RBTC: {accountBalance.prettify(4)}</Box>
      <Box>
        {COIN}: {bpdBalance.prettify()}
      </Box>
      <Box>
        {GT}: {mpBalance.prettify()}
      </Box>
    </Box>
  )
}

const GitHubCommit: React.FC<{ children?: string }> = ({ children }) =>
  children?.match(/[0-9a-f]{40}/) ? (
    <Link href={`https://github.com/moneyp/dev/commit/${children}`}>{children.substr(0, 7)}</Link>
  ) : (
    <>unknown</>
  )

type SystemStatsProps = {
  variant?: string
  showBalances?: boolean
}

const select = ({
  numberOfVaults,
  price,
  total,
  bpdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedMP,
  frontend,
}: MoneypStoreState) => ({
  numberOfVaults,
  price,
  total,
  bpdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedMP,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null,
})

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {
  const {
    moneyp: {
      connection: { version: contractsVersion, deploymentDate, frontendTag },
    },
  } = useMoneyp()

  const {
    numberOfVaults,
    price,
    bpdInStabilityPool,
    total,
    borrowingRate,
    redemptionRate,
    totalStakedMP,
    kickbackRate,
  } = useMoneypSelector(select)

  const bpdInStabilityPoolPct =
    total.debt.nonZero && new Percent(bpdInStabilityPool.div(total.debt))
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price))
  const borrowingFeePct = new Percent(borrowingRate)
  const redemptionFeePct = new Percent(redemptionRate)
  const kickbackRatePct = frontendTag === AddressZero ? "100" : kickbackRate?.mul(100).prettify()

  return (
    <Card>
      {showBalances && <Balances />}

      <Heading>Moneyp Statistics</Heading>

      <Container sx={{ mt: 3, fontWeight: "400", fontSize: "16px", my: "10px" }}>
        Protocol
      </Container>

      <Container variant="columns">
        <Container variant="left">
          <Statistic
            name="Borrowing Fee"
            tooltip="The Borrowing Fee is a one-time fee as a percentage of the borrowed amount, which is added to the Vault’s debt.  The range of the Borrowing can be from 0.5% to 5% depending on how much BPD is being borrowed or redeemed at any given span of time."
          >
            {borrowingFeePct.toString(2)}
          </Statistic>

          <Statistic
            name="TVL"
            tooltip="TVL is Total Value of Bitcoin Locked in Money Protocol.  Represented in BTC and USD terms."
          >
            {total.collateral.shorten()} RBTC
            <Text sx={{ fontSize: 1 }}>
              &nbsp;(${Decimal.from(total.collateral.mul(price)).shorten()})
            </Text>
          </Statistic>

          <Statistic name="Vaults" tooltip="The total number of Vaults open in Money Protocol.">
            {Decimal.from(numberOfVaults).prettify(0)}
          </Statistic>

          {bpdInStabilityPoolPct && (
            <Statistic
              name="Stability Pool BPD"
              tooltip="The amount of BPD in Stability Pool expressed.  The percentage represents amount of total BPD minted deposited in Stability Pool."
            >
              {bpdInStabilityPool.shorten()}
              <Text sx={{ fontSize: 1 }}>&nbsp;({bpdInStabilityPoolPct.toString(1)})</Text>
            </Statistic>
          )}
        </Container>

        <Container variant="right">
          <Statistic
            name="Redemption Fee"
            tooltip="The fee charged as a percentage of BTC being redeemed.  The minimum redemption fee is 0.5% and can increase depending on how much BPD is being redeemed at any given span of time.  The Redemption Fee is deducted from the redeemed BPD, decreasing the amount of BTC the redeemer receives in return."
          >
            {redemptionFeePct.toString(2)}
          </Statistic>

          <Statistic name="BPD" tooltip="The total amount of BPD minted by Money Protocol.">
            {total.debt.shorten()}
          </Statistic>

          <Statistic name="Staked MP" tooltip="The amount of MP staked for earning fee revenue.">
            {totalStakedMP.shorten()}
          </Statistic>

          <Statistic
            name="Collateral Ratio"
            tooltip="The total collateral value (BTC value in USD) divided by the total debt in BPD terms across all vaults in the system."
          >
            {totalCollateralRatioPct.prettify()}
          </Statistic>
        </Container>
      </Container>

      {total.collateralRatioIsBelowCritical(price) && (
        <Box color="danger">The system is in recovery mode!</Box>
      )}

      <Container
        sx={{
          mt: 3,
          pt: 3,
          borderTop: "1px solid #E2E4F1",
          fontWeight: "400",
          fontSize: "16px",
          my: "10px",
        }}
      >
        Frontend
      </Container>
      {kickbackRatePct && (
        <Statistic name="Kickback rate" tooltip="TBD">
          {kickbackRatePct}%
        </Statistic>
      )}

      <Box sx={{ mt: 3, color: "#777777", fontWeight: "200" }}>
        <Box sx={{ fontSize: 0 }}>
          Contracts version: <GitHubCommit>{contractsVersion}</GitHubCommit>
        </Box>
        <Box sx={{ fontSize: 0 }}>
          Deployed:{" "}
          <Text sx={{ fontWeight: "400", color: "black" }}>{deploymentDate.toLocaleString()}</Text>
        </Box>
        <Box sx={{ fontSize: 0 }}>
          Frontend version:{" "}
          <Text sx={{ fontWeight: "400", color: "black" }}>
            {process.env.NODE_ENV === "development" ? (
              "development"
            ) : (
              <GitHubCommit>{process.env.REACT_APP_VERSION}</GitHubCommit>
            )}
          </Text>
        </Box>
      </Box>
    </Card>
  )
}
