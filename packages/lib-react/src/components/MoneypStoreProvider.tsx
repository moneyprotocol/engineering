import { MoneypStore } from "@liquity/lib-base";
import React, { createContext, useEffect, useState } from "react";

export const MoneypStoreContext = createContext<MoneypStore | undefined>(undefined);

type MoneypStoreProviderProps = {
  store: MoneypStore;
  loader?: React.ReactNode;
};

export const MoneypStoreProvider: React.FC<MoneypStoreProviderProps> = ({
  store,
  loader,
  children
}) => {
  const [loadedStore, setLoadedStore] = useState<MoneypStore>();

  useEffect(() => {
    store.onLoaded = () => setLoadedStore(store);
    const stop = store.start();

    return () => {
      store.onLoaded = undefined;
      setLoadedStore(undefined);
      stop();
    };
  }, [store]);

  if (!loadedStore) {
    return <>{loader}</>;
  }

  return <MoneypStoreContext.Provider value={loadedStore}>{children}</MoneypStoreContext.Provider>;
};
