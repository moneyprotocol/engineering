import React from "react";
import { MoneypStoreState } from "@moneyprotocol/lib-base";
import { useMoneypSelector } from "@moneyprotocol/lib-react";
import { Container, Flex, Box } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { useMoneyp } from "../hooks/MoneypContext";

import { MoneypLogo } from "./MoneypLogo";
import { Nav } from "./Nav";
import { SideNav } from "./SideNav";

const logoHeight = "32px";

const select = ({ frontend }: MoneypStoreState) => ({
  frontend
});

export const Header: React.FC = ({ children }) => {
  const {
    config: { frontendTag }
  } = useMoneyp();
  const { frontend } = useMoneypSelector(select);
  const isFrontendRegistered = frontendTag === AddressZero || frontend.status === "registered";

  return (
    <Container variant="header" sx={{padding: '0px !important', width: '100%',
    '@media screen and (min-width: 700px)': {
      mt: '55px',
      padding: '24px !important',
      border: '1px solid #E1E1E1',
      borderRadius: '16px',
      background: 'white !important'
    },}}>
      <Flex sx={{ alignItems: "center", flex: 1 }}>
        <MoneypLogo height={logoHeight} />

        <Box
          sx={{
            mx: [2, 3],
            width: "0px",
            height: "100%",
            borderLeft: ["none", "1px solid lightgrey"]
          }}
        />
        {isFrontendRegistered && (
          <>
            <SideNav />
            <Nav />
          </>
        )}
      </Flex>

      {children}
    </Container>
  );
};
