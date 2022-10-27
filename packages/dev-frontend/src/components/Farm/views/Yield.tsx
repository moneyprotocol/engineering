import React, { useEffect, useState } from "react";
import { Card, Paragraph, Text } from "theme-ui";
import { useWeb3React } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { Decimal, MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@moneyprotocol/lib-react";
import { InfoIcon } from "../../InfoIcon";
import { useMoneyp } from "../../../hooks/MoneypContext";
import { Badge } from "../../Badge";
import { fetchPrices } from "../context/fetchPrices";

const selector = ({
  remainingLiquidityMiningMPReward,
  totalStakedRskSwapTokens
}: MoneypStoreState) => ({
  remainingLiquidityMiningMPReward,
  totalStakedRskSwapTokens
});

export const Yield: React.FC = () => {
  const {
    moneyp: {
      connection: { addresses }
    }
  } = useMoneyp();
  const { chainId } = useWeb3React<Web3Provider>();
  const isMainnet = chainId === 1;

  const { remainingLiquidityMiningMPReward, totalStakedRskSwapTokens } = useMoneypSelector(selector);
  const [mpPrice, setLqtyPrice] = useState<Decimal | undefined>(undefined);
  const [uniLpPrice, setUniLpPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingLiquidityMiningMPReward.isZero || totalStakedRskSwapTokens.isZero;
  let mpTokenAddress = addresses["mpToken"];
  let rskSwapTokenAddress = addresses["rskSwapToken"];

  // TODO: remove after Team has reviewed on /next
  if (!isMainnet) {
    mpTokenAddress = "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2";
    rskSwapTokenAddress = "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11";
  }

  useEffect(() => {
    (async () => {
      try {
        const { mpPriceUSD, uniLpPriceUSD } = await fetchPrices(mpTokenAddress, rskSwapTokenAddress);
        setLqtyPrice(mpPriceUSD);
        setUniLpPrice(uniLpPriceUSD);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [mpTokenAddress, rskSwapTokenAddress]);

  // TODO: switch to this condition after team has reviewed on /next
  // if (!isMainnet || hasZeroValue || mpPrice === undefined || uniLpPrice === undefined) return null;
  if (hasZeroValue || mpPrice === undefined || uniLpPrice === undefined) return null;

  const remainingLqtyInUSD = remainingLiquidityMiningMPReward.mul(mpPrice);
  const totalStakedUniLpInUSD = totalStakedRskSwapTokens.mul(uniLpPrice);
  const yieldPercentage = remainingLqtyInUSD.div(totalStakedUniLpInUSD).mul(100);

  return (
    <Badge>
      <Text>Yield {yieldPercentage.toString(2)}%</Text>
      <InfoIcon
        tooltip={
          <Card variant="tooltip" sx={{ minWidth: ["auto", "306px"] }}>
            <Paragraph>
              This is an <Text sx={{ fontWeight: "bold" }}>estimate</Text> of the MP return on
              staked UNI LP. The farm runs for 6-weeks, so the return is relative to the time
              remaining.
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              ($MP_REWARDS / $UNI_LP) * 100 = <Text sx={{ fontWeight: "bold" }}> Yield</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingLqtyInUSD.shorten()} / ${totalStakedUniLpInUSD.shorten()}) * 100 =
              <Text sx={{ fontWeight: "bold" }}> {yieldPercentage.toString(2)}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  );
};
