import React, { useState, useCallback, useEffect, useRef } from "react";
import { MoneypStoreState, Decimal } from "@liquity/lib-base";
import { useMoneypSelector } from "@liquity/lib-react";
import { FarmViewContext } from "./FarmViewContext";
import { transitions } from "./transitions";
import type { FarmView, FarmEvent } from "./transitions";

const transition = (view: FarmView, event: FarmEvent): FarmView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (
  liquidityMiningStake: Decimal,
  remainingLiquidityMiningMPReward: Decimal
): FarmView => {
  if (remainingLiquidityMiningMPReward.isZero) return "DISABLED";
  if (liquidityMiningStake.isZero) return "INACTIVE";
  return "ACTIVE";
};

const selector = ({
  liquidityMiningStake,
  remainingLiquidityMiningMPReward
}: MoneypStoreState) => ({ liquidityMiningStake, remainingLiquidityMiningMPReward });

export const FarmViewProvider: React.FC = props => {
  const { children } = props;
  const { liquidityMiningStake, remainingLiquidityMiningMPReward } = useMoneypSelector(selector);

  const [view, setView] = useState<FarmView>(
    getInitialView(liquidityMiningStake, remainingLiquidityMiningMPReward)
  );
  const viewRef = useRef<FarmView>(view);

  const dispatchEvent = useCallback((event: FarmEvent) => {
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
    if (liquidityMiningStake.isZero) {
      dispatchEvent("UNSTAKE_AND_CLAIM_CONFIRMED");
    }
  }, [liquidityMiningStake.isZero, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };

  return <FarmViewContext.Provider value={provider}>{children}</FarmViewContext.Provider>;
};
