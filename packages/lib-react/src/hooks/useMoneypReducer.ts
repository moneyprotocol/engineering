import { useCallback, useEffect, useReducer, useRef } from "react";

import { MoneypStoreState } from "@liquity/lib-base";

import { equals } from "../utils/equals";
import { useMoneypStore } from "./useMoneypStore";

export type MoneypStoreUpdate<T = unknown> = {
  type: "updateStore";
  newState: MoneypStoreState<T>;
  oldState: MoneypStoreState<T>;
  stateChange: Partial<MoneypStoreState<T>>;
};

export const useMoneypReducer = <S, A, T>(
  reduce: (state: S, action: A | MoneypStoreUpdate<T>) => S,
  init: (storeState: MoneypStoreState<T>) => S
): [S, (action: A | MoneypStoreUpdate<T>) => void] => {
  const store = useMoneypStore<T>();
  const oldStore = useRef(store);
  const state = useRef(init(store.state));
  const [, rerender] = useReducer(() => ({}), {});

  const dispatch = useCallback(
    (action: A | MoneypStoreUpdate<T>) => {
      const newState = reduce(state.current, action);

      if (!equals(newState, state.current)) {
        state.current = newState;
        rerender();
      }
    },
    [reduce]
  );

  useEffect(() => store.subscribe(params => dispatch({ type: "updateStore", ...params })), [
    store,
    dispatch
  ]);

  if (oldStore.current !== store) {
    state.current = init(store.state);
    oldStore.current = store;
  }

  return [state.current, dispatch];
};
