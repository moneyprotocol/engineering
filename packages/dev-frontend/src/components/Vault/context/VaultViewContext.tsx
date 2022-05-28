import { createContext, useContext } from "react";
import type { VaultView, VaultEvent } from "./types";

type VaultViewContextType = {
  view: VaultView;
  dispatchEvent: (event: VaultEvent) => void;
};

export const VaultViewContext = createContext<VaultViewContextType | null>(null);

export const useVaultView = (): VaultViewContextType => {
  const context: VaultViewContextType | null = useContext(VaultViewContext);

  if (context === null) {
    throw new Error("You must add a <VaultViewProvider> into the React tree");
  }

  return context;
};
