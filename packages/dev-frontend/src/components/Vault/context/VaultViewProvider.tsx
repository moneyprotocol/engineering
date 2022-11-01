import React, { useState, useCallback, useEffect, useRef } from "react";
import { useMoneypSelector } from "@moneyprotocol/lib-react";
import { MoneypStoreState, UserVaultStatus } from "@moneyprotocol/lib-base";
import { VaultViewContext } from "./VaultViewContext";
import type { VaultView, VaultEvent } from "./types";

type VaultEventTransitions = Record<VaultView, Partial<Record<VaultEvent, VaultView>>>;

const transitions: VaultEventTransitions = {
  NONE: {
    OPEN_TROVE_PRESSED: "OPENING",
    TROVE_OPENED: "ACTIVE"
  },
  LIQUIDATED: {
    OPEN_TROVE_PRESSED: "OPENING",
    TROVE_SURPLUS_COLLATERAL_CLAIMED: "NONE",
    TROVE_OPENED: "ACTIVE"
  },
  REDEEMED: {
    OPEN_TROVE_PRESSED: "OPENING",
    TROVE_SURPLUS_COLLATERAL_CLAIMED: "NONE",
    TROVE_OPENED: "ACTIVE"
  },
  OPENING: {
    CANCEL_ADJUST_TROVE_PRESSED: "NONE",
    TROVE_OPENED: "ACTIVE"
  },
  ADJUSTING: {
    CANCEL_ADJUST_TROVE_PRESSED: "ACTIVE",
    TROVE_ADJUSTED: "ACTIVE",
    TROVE_CLOSED: "NONE",
    TROVE_LIQUIDATED: "LIQUIDATED",
    TROVE_REDEEMED: "REDEEMED"
  },
  CLOSING: {
    CANCEL_ADJUST_TROVE_PRESSED: "ACTIVE",
    TROVE_CLOSED: "NONE",
    TROVE_ADJUSTED: "ACTIVE",
    TROVE_LIQUIDATED: "LIQUIDATED",
    TROVE_REDEEMED: "REDEEMED"
  },
  ACTIVE: {
    ADJUST_TROVE_PRESSED: "ADJUSTING",
    CLOSE_TROVE_PRESSED: "CLOSING",
    TROVE_CLOSED: "NONE",
    TROVE_LIQUIDATED: "LIQUIDATED",
    TROVE_REDEEMED: "REDEEMED"
  }
};

type VaultStateEvents = Partial<Record<UserVaultStatus, VaultEvent>>;

const vaultStatusEvents: VaultStateEvents = {
  open: "TROVE_OPENED",
  closedByOwner: "TROVE_CLOSED",
  closedByLiquidation: "TROVE_LIQUIDATED",
  closedByRedemption: "TROVE_REDEEMED"
};

const transition = (view: VaultView, event: VaultEvent): VaultView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (vaultStatus: UserVaultStatus): VaultView => {
  if (vaultStatus === "closedByLiquidation") {
    return "LIQUIDATED";
  }
  if (vaultStatus === "closedByRedemption") {
    return "REDEEMED";
  }
  if (vaultStatus === "open") {
    return "ACTIVE";
  }
  return "NONE";
};

const select = ({ vault: { status } }: MoneypStoreState) => status;

export const VaultViewProvider: React.FC = props => {
  const { children } = props;
  const vaultStatus = useMoneypSelector(select);

  const [view, setView] = useState<VaultView>(getInitialView(vaultStatus));
  const viewRef = useRef<VaultView>(view);

  const dispatchEvent = useCallback((event: VaultEvent) => {
    const nextView = transition(viewRef.current, event);

    console.log(
      "dispatchEvent() [current-view, event, next-view]",
      viewRef.current,
      event,
      nextView
    );
    setView(nextView);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const event = vaultStatusEvents[vaultStatus] ?? null;
    if (event !== null) {
      dispatchEvent(event);
    }
  }, [vaultStatus, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };

  console.log('[VaultViewProvider] vaultStatus:', vaultStatus);
  return <VaultViewContext.Provider value={provider}>{children}</VaultViewContext.Provider>;
};
