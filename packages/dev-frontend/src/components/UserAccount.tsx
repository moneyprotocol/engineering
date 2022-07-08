import React from "react";
import { Text, Flex, Box, Heading } from "theme-ui";

import { MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";

import { COIN, GT } from "../strings";
import { useMoneyp } from "../hooks/MoneypContext";
import { shortenAddress } from "../utils/shortenAddress";

import { Icon } from "./Icon";

const select = ({ accountBalance, bpdBalance, mpBalance }: MoneypStoreState) => ({
  accountBalance,
  bpdBalance,
  mpBalance
});

export const UserAccount: React.FC = () => {
  const { account } = useMoneyp();
  const { accountBalance, bpdBalance, mpBalance } = useMoneypSelector(select);

  return (
    <Box sx={{ display: ["none", "flex"] }}>
      <Flex sx={{ alignItems: "center" }}>
        <Icon name="user-circle" size="lg" />
        <Flex sx={{ ml: 3, mr: 4, flexDirection: "column" }}>
          <Heading sx={{ fontSize: 1 }}>Connected as</Heading>
          <Text as="span" sx={{ fontSize: 1 }}>
            {shortenAddress(account)}
          </Text>
        </Flex>
      </Flex>

      <Flex sx={{ alignItems: "center" }}>
        <Icon name="wallet" size="lg" />

        {([
          ["RBTC", accountBalance],
          [COIN, bpdBalance],
          [GT, mpBalance]
        ] as const).map(([currency, balance], i) => (
          <Flex key={i} sx={{ ml: 3, flexDirection: "column" }}>
            <Heading sx={{ fontSize: 1 }}>{currency}</Heading>
            <Text sx={{ fontSize: 1 }}>{balance.prettify()}</Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
};
