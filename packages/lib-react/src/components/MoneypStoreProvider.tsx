import { MoneypStore } from "@money-protocol/lib-base";
import React, { createContext, useEffect, useState } from "react";

export const MoneypStoreContext = createContext<MoneypStore | undefined>(
  undefined
);

type MoneypStoreProviderProps = {
  store: MoneypStore;
  loader?: React.ReactNode;
};

export const MoneypStoreProvider: React.FC<MoneypStoreProviderProps> = ({
  store,
  loader,
  children,
}) => {
  const [loadedStore, setLoadedStore] = useState<MoneypStore>();

  useEffect(() => {
    console.log(
      "[MoneypStoreProvider] useEffect store:",
      Object.assign({}, store)
    );
    store.onLoaded = () => {
      console.log(
        "[MoneypStoreProvider] store onLoaded:",
        Object.assign({}, store)
      );
      return setLoadedStore(store);
    };
    const stop = store.start();
    console.log("[MoneypStoreProvider] store started!");

    return () => {
      store.onLoaded = undefined;
      setLoadedStore(undefined);
      stop();
    };
  }, [store]);

  if (!loadedStore) {
    console.log("[MoneypStoreProvider] loading...");
    return <>{loader}</>;
  }

  console.log("[MoneypStoreProvider] loaded store:", loadedStore);

  return (
    <MoneypStoreContext.Provider value={loadedStore}>
      {children}
    </MoneypStoreContext.Provider>
  );
};
