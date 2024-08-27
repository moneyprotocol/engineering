import React, { useCallback } from "react"

import { FarmViewContext } from "./FarmViewContext"
import { FarmEvent } from "./transitions"

export const FarmViewProvider: React.FC = props => {
  const { children } = props

  const dispatchEvent = useCallback((event: FarmEvent) => {}, [])

  const provider = {
    dispatchEvent,
  }

  return <FarmViewContext.Provider value={provider}>{children}</FarmViewContext.Provider>
}
