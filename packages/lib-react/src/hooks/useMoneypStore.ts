import { useContext } from "react";

import { MoneypStore } from "@liquity/lib-base";

import { MoneypStoreContext } from "../components/MoneypStoreProvider";

export const useMoneypStore = <T>(): MoneypStore<T> => {
  const store = useContext(MoneypStoreContext);

  if (!store) {
    throw new Error("You must provide a MoneypStore via MoneypStoreProvider");
  }

  return store as MoneypStore<T>;
};
