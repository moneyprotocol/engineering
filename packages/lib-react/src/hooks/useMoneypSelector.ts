import { useEffect, useReducer } from "react";

import { MoneypStoreState } from "@money-protocol/lib-base";

import { equals } from "../utils/equals";
import { useMoneypStore } from "./useMoneypStore";

export const useMoneypSelector = <S, T>(
  select: (state: MoneypStoreState<T>) => S
): S => {
  const store = useMoneypStore<T>();
  const [, rerender] = useReducer(() => ({}), {});

  useEffect(
    () =>
      store.subscribe(({ newState, oldState }) => {
        if (!equals(select(newState), select(oldState))) {
          rerender();
        }
      }),
    [store, select]
  );

  return select(store.state);
};
