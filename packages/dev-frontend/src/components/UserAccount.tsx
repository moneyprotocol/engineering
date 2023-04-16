import React from "react";
import { Text, Flex, Box } from "theme-ui";

import { MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@moneyprotocol/lib-react";

import { COIN, GT } from "../strings";
import { useMoneyp } from "../hooks/MoneypContext";
import { shortenAddress } from "../utils/shortenAddress";

const select = ({ accountBalance, bpdBalance, mpBalance }: MoneypStoreState) => ({
  accountBalance,
  bpdBalance,
  mpBalance
});

const UserIcon = () => (<svg width="38" height="40" viewBox="0 0 48 49" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M40 42.5V38.5C40 36.3783 39.1571 34.3434 37.6569 32.8431C36.1566 31.3429 34.1217 30.5 32 30.5H16C13.8783 30.5 11.8434 31.3429 10.3431 32.8431C8.84285 34.3434 8 36.3783 8 38.5V42.5" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M24 22.5C28.4183 22.5 32 18.9183 32 14.5C32 10.0817 28.4183 6.5 24 6.5C19.5817 6.5 16 10.0817 16 14.5C16 18.9183 19.5817 22.5 24 22.5Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
);

export const UserAccount: React.FC = () => {
  const { account } = useMoneyp();
  const { accountBalance, bpdBalance, mpBalance } = useMoneypSelector(select);

  return (
    <Box sx={{ display: ["none", "flex"] }}>
      <Flex sx={{ alignItems: "center" }}>
        <UserIcon/>
        <Flex sx={{ ml: 3, mr: 4, flexDirection: "column" }}>
          <Text sx={{ fontSize: 1 }}>Connected as</Text>
          <Text as="span" sx={{ fontSize: 1, fontWeight: '400', color: "#777777" }}>
            {shortenAddress(account)}
          </Text>
        </Flex>
      </Flex>

      <Flex sx={{ alignItems: "center" }}>
        {([
          ["RBTC", accountBalance],
          [COIN, bpdBalance],
          [GT, mpBalance]
        ] as const).map(([currency, balance], i) => (
          <Flex key={i} sx={{ mr: 3, flexDirection: "column" }}>
            <Text sx={{ fontSize: 1 }}>{currency}</Text>
            <Text sx={{ fontSize: 1, fontWeight: '400', color: "#777777" }}>{balance.prettify()}</Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
};
