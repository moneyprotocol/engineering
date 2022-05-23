import React from "react";
import { Card, Heading, Link, Box, Text } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { Decimal, Percent, MoneypStoreState } from "@liquity/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";

import { useMoneyp } from "../hooks/MoneypContext";
import { COIN, GT } from "../strings";
import { Statistic } from "./Statistic";

const selectBalances = ({ accountBalance, bpdBalance, mpBalance }: MoneypStoreState) => ({
  accountBalance,
  bpdBalance,
  mpBalance
});

const Balances: React.FC = () => {
  const { accountBalance, bpdBalance, mpBalance } = useMoneypSelector(selectBalances);

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
  );
};

const GitHubCommit: React.FC<{ children?: string }> = ({ children }) =>
  children?.match(/[0-9a-f]{40}/) ? (
    <Link href={`https://github.com/moneyp/dev/commit/${children}`}>{children.substr(0, 7)}</Link>
  ) : (
    <>unknown</>
  );

type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
};

const select = ({
  numberOfVaults,
  price,
  total,
  bpdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedMP,
  frontend
}: MoneypStoreState) => ({
  numberOfVaults,
  price,
  total,
  bpdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedMP,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {
  const {
    moneyp: {
      connection: { version: contractsVersion, deploymentDate, frontendTag }
    }
  } = useMoneyp();

  const {
    numberOfVaults,
    price,
    bpdInStabilityPool,
    total,
    borrowingRate,
    redemptionRate,
    totalStakedMP,
    kickbackRate
  } = useMoneypSelector(select);

  const bpdInStabilityPoolPct =
    total.debt.nonZero && new Percent(bpdInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  const borrowingFeePct = new Percent(borrowingRate);
  const redemptionFeePct = new Percent(redemptionRate);
  const kickbackRatePct = frontendTag === AddressZero ? "100" : kickbackRate?.mul(100).prettify();

  return (
    <Card {...{ variant }}>
      {showBalances && <Balances />}

      <Heading>Moneyp statistics</Heading>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Protocol
      </Heading>

      <Statistic name="Borrowing fee" tooltip="TBD">
        {borrowingFeePct.toString(2)}
      </Statistic>
      <Statistic name="Redemption fee" tooltip="TBD">
        {redemptionFeePct.toString(2)}
      </Statistic>

      <Statistic name="TVL" tooltip="TBD">
        {total.collateral.shorten()} RBTC
        <Text sx={{ fontSize: 1 }}>
          &nbsp;(${Decimal.from(total.collateral.mul(price)).shorten()})
        </Text>
      </Statistic>
      <Statistic name="Vaults" tooltip="TBD">
        {Decimal.from(numberOfVaults).prettify(0)}
      </Statistic>
      <Statistic name="BPD" tooltip="TBD">
        {total.debt.shorten()}
      </Statistic>
      {bpdInStabilityPoolPct && (
        <Statistic name="Stability Pool BPD" tooltip="TBD">
          {bpdInStabilityPool.shorten()}
          <Text sx={{ fontSize: 1 }}>&nbsp;({bpdInStabilityPoolPct.toString(1)})</Text>
        </Statistic>
      )}
      <Statistic name="Staked MP" tooltip="TBD">
        {totalStakedMP.shorten()}
      </Statistic>
      <Statistic name="Collateral ratio" tooltip="TBD">
        {totalCollateralRatioPct.prettify()}
      </Statistic>
      {total.collateralRatioIsBelowCritical(price) && (
        <Box color="danger">The system is in recovery mode!</Box>
      )}

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Frontend
      </Heading>
      {kickbackRatePct && (
        <Statistic name="Kickback rate" tooltip="TBD">
          {kickbackRatePct}%
        </Statistic>
      )}

      <Box sx={{ mt: 3, opacity: 0.66 }}>
        <Box sx={{ fontSize: 0 }}>
          Contracts version: <GitHubCommit>{contractsVersion}</GitHubCommit>
        </Box>
        <Box sx={{ fontSize: 0 }}>Deployed: {deploymentDate.toLocaleString()}</Box>
        <Box sx={{ fontSize: 0 }}>
          Frontend version:{" "}
          {process.env.NODE_ENV === "development" ? (
            "development"
          ) : (
            <GitHubCommit>{process.env.REACT_APP_VERSION}</GitHubCommit>
          )}
        </Box>
      </Box>
    </Card>
  );
};
