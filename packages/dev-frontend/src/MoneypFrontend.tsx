import React from "react";
import { Flex, Container } from "theme-ui";
import { HashRouter as Router, Switch, Route } from "react-router-dom";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Vault } from "@moneyprotocol/lib-base";
import { MoneypStoreProvider } from "@liquity/lib-react";

import { useMoneyp } from "./hooks/MoneypContext";
import { TransactionMonitor } from "./components/Transaction";
import { UserAccount } from "./components/UserAccount";
import { SystemStatsPopup } from "./components/SystemStatsPopup";
import { Header } from "./components/Header";

import { PageSwitcher } from "./pages/PageSwitcher";
import { Farm } from "./pages/Farm";
import { Liquidation } from "./pages/Liquidation";
import { RedemptionPage } from "./pages/RedemptionPage";

import { VaultViewProvider } from "./components/Vault/context/VaultViewProvider";
import { StabilityViewProvider } from "./components/Stability/context/StabilityViewProvider";
import { StakingViewProvider } from "./components/Staking/context/StakingViewProvider";
import { FarmViewProvider } from "./components/Farm/context/FarmViewProvider";

type MoneypFrontendProps = {
  loader?: React.ReactNode;
};
export const MoneypFrontend: React.FC<MoneypFrontendProps> = ({ loader }) => {
  const { account, provider, moneyp } = useMoneyp();

  // For console tinkering ;-)
  Object.assign(window, {
    account,
    provider,
    moneyp,
    Vault,
    Decimal,
    Difference,
    Wallet
  });

  return (
    <MoneypStoreProvider {...{ loader }} store={moneyp.store}>
      <Router>
        <VaultViewProvider>
          <StabilityViewProvider>
            <StakingViewProvider>
              <FarmViewProvider>
                <Flex sx={{ flexDirection: "column", minHeight: "100%" }}>
                  <Header>
                    <UserAccount />
                    <SystemStatsPopup />
                  </Header>

                  <Container
                    variant="main"
                    sx={{
                      display: "flex",
                      flexGrow: 1,
                      flexDirection: "column",
                      alignItems: "center"
                    }}
                  >
                    <Switch>
                      <Route path="/" exact>
                        <PageSwitcher />
                      </Route>
                      <Route path="/farm">
                        <Farm />
                      </Route>
                      <Route path="/liquidation">
                        <Liquidation />
                      </Route>
                      <Route path="/redemption">
                        <RedemptionPage />
                      </Route>
                    </Switch>
                  </Container>
                </Flex>
              </FarmViewProvider>
            </StakingViewProvider>
          </StabilityViewProvider>
        </VaultViewProvider>
      </Router>
      <TransactionMonitor />
    </MoneypStoreProvider>
  );
};
