import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { Provider } from "@ethersproject/abstract-provider"
import { Web3Provider } from "@ethersproject/providers"
import { useWeb3React } from "@web3-react/core"

import { isBatchedProvider } from "@money-protocol/providers"
import {
  BlockPolledMoneypStore,
  BitcoinsMoneyp,
  BitcoinsMoneypWithStore,
  _connectByChainId,
} from "@money-protocol/lib-ethers"

import { MoneypFrontendConfig, getConfig } from "../config"

type MoneypContextValue = {
  config: MoneypFrontendConfig
  account: string
  provider: Provider
  moneyp: BitcoinsMoneypWithStore<BlockPolledMoneypStore>
}

const MoneypContext = createContext<MoneypContextValue | undefined>(undefined)

type MoneypProviderProps = {
  loader?: React.ReactNode
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode
}

export const MoneypProvider: React.FC<MoneypProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback,
}) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>()
  const [config, setConfig] = useState<MoneypFrontendConfig>()

  const connection = useMemo(() => {
    console.group()
    console.log("[MoneypProvider] Creating connection...")
    console.log("config:", config)
    console.log("provider:", provider)
    console.log("account:", account)
    console.log("chainId:", chainId)

    if (config && provider && account && chainId) {
      try {
        const _connection = _connectByChainId(provider, provider.getSigner(account), chainId, {
          userAddress: account,
          frontendTag: config.frontendTag,
          useStore: "blockPolled",
        })

        console.log("connection:", _connection)
        console.groupEnd()
        return _connection
      } catch (exception) {
        console.log("exception:", exception)
        console.groupEnd()
      }
    }
  }, [config, provider, account, chainId])

  useEffect(() => {
    getConfig().then(setConfig)
  }, [])

  useEffect(() => {
    if (config && connection) {
      const { provider, chainId } = connection

      if (isBatchedProvider(provider) && provider.chainId !== chainId) {
        console.log("[MoneypProvider] isBatchedProvider: true")
        provider.chainId = chainId
      }

      // if (isWebSocketAugmentedProvider(provider)) {
      //   console.log('[MoneypProvider] isWebSocketAugmentedProvider: true');
      //   const network = getNetwork(chainId);

      //   if (network.name && supportedNetworks.includes(network.name) && config.infuraApiKey) {
      //     provider.openWebSocket(...wsParams(network.name, config.infuraApiKey));
      //   } else if (connection._isDev) {
      //     provider.openWebSocket(`ws://${window.location.hostname}:8546`, chainId);
      //   }

      //   return () => {
      //     provider.closeWebSocket();
      //   };
      // }
    }
  }, [config, connection])

  if (!config || !provider || !account || !chainId) {
    console.log("[MoneypProvider] loading...")
    return <>{loader}</>
  }

  if (!connection) {
    console.log("[MoneypProvider] No connection!")
    return unsupportedNetworkFallback ? <>{unsupportedNetworkFallback(chainId)}</> : null
  }

  const moneyp = BitcoinsMoneyp._from(connection)
  moneyp.store.logging = true

  console.log("[MoneypProvider] moneyp:", moneyp)

  return (
    <MoneypContext.Provider value={{ config, account, provider, moneyp }}>
      {children}
    </MoneypContext.Provider>
  )
}

export const useMoneyp = () => {
  const moneypContext = useContext(MoneypContext)

  if (!moneypContext) {
    throw new Error("You must provide a MoneypContext via MoneypProvider")
  }

  return moneypContext
}
