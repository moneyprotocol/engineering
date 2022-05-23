import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { isBatchedProvider, isWebSocketAugmentedProvider } from "@liquity/providers";
import {
  BlockPolledMoneypStore,
  BitcoinsMoneyp,
  BitcoinsMoneypWithStore,
  _connectByChainId
} from "@liquity/lib-ethers";

import { MoneypFrontendConfig, getConfig } from "../config";

type MoneypContextValue = {
  config: MoneypFrontendConfig;
  account: string;
  provider: Provider;
  moneyp: BitcoinsMoneypWithStore<BlockPolledMoneypStore>;
};

const MoneypContext = createContext<MoneypContextValue | undefined>(undefined);

type MoneypProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
};

const wsParams = (network: string, infuraApiKey: string): [string, string] => [
  `wss://${network === "homestead" ? "mainnet" : network}.infura.io/ws/v3/${infuraApiKey}`,
  network
];

const supportedNetworks = ["homestead", "kovan", "rinkeby", "ropsten", "goerli"];

export const MoneypProvider: React.FC<MoneypProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback
}) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();
  const [config, setConfig] = useState<MoneypFrontendConfig>();

  const connection = useMemo(() => {
    if (config && provider && account && chainId) {
      try {
        return _connectByChainId(provider, provider.getSigner(account), chainId, {
          userAddress: account,
          frontendTag: config.frontendTag,
          useStore: "blockPolled"
        });
      } catch {}
    }
  }, [config, provider, account, chainId]);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (config && connection) {
      const { provider, chainId } = connection;

      if (isBatchedProvider(provider) && provider.chainId !== chainId) {
        provider.chainId = chainId;
      }

      if (isWebSocketAugmentedProvider(provider)) {
        const network = getNetwork(chainId);

        if (network.name && supportedNetworks.includes(network.name) && config.infuraApiKey) {
          provider.openWebSocket(...wsParams(network.name, config.infuraApiKey));
        } else if (connection._isDev) {
          provider.openWebSocket(`ws://${window.location.hostname}:8546`, chainId);
        }

        return () => {
          provider.closeWebSocket();
        };
      }
    }
  }, [config, connection]);

  if (!config || !provider || !account || !chainId) {
    return <>{loader}</>;
  }

  if (!connection) {
    return unsupportedNetworkFallback ? <>{unsupportedNetworkFallback(chainId)}</> : null;
  }

  const moneyp = BitcoinsMoneyp._from(connection);
  moneyp.store.logging = true;

  return (
    <MoneypContext.Provider value={{ config, account, provider, moneyp }}>
      {children}
    </MoneypContext.Provider>
  );
};

export const useMoneyp = () => {
  const moneypContext = useContext(MoneypContext);

  if (!moneypContext) {
    throw new Error("You must provide a MoneypContext via MoneypProvider");
  }

  return moneypContext;
};
