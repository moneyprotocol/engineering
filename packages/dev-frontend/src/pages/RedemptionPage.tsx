import React from "react"
import { Box, Container, Link, Paragraph } from "theme-ui"
import { SystemStats } from "../components/SystemStats"
import { Redemption } from "../components/Redemption/Redemption"
import { InfoMessage } from "../components/InfoMessage"
import { useMoneyp } from "../hooks/MoneypContext"
import { Icon } from "../components/Icon"

const uniLink = (bpdAddress: string) =>
  `https://app.uniswap.org/#/swap?inputCurrency=${bpdAddress}&outputCurrency=RBTC`

export const RedemptionPage: React.FC = () => {
  const {
    moneyp: {
      connection: { addresses },
    },
  } = useMoneyp()

  return (
    <>
      <Box sx={{ mt: 3, width: "100%" }}>
        <InfoMessage title="Bot functionality">
          <Paragraph>
            {" "}
            This functionality is expected to be carried out by bots when arbitrage opportunities
            emerge.
          </Paragraph>
          <Paragraph>
            You will probably be able to get a better rate for converting BPD to RBTC on{" "}
            <Link href={uniLink(addresses["bpdToken"])} target="_blank">
              Uniswap <Icon name="external-link-alt" size="xs" />
            </Link>
          </Paragraph>
        </InfoMessage>
      </Box>

      <Container variant="columns">
        <Container variant="left">
          <Redemption />
        </Container>

        <Container variant="right">
          <SystemStats />
        </Container>
      </Container>
    </>
  )
}
