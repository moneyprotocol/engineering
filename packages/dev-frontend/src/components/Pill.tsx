import { ReactNode } from "react"
import { Box } from "theme-ui"

type PillType = "success" | "warning" | "error"

interface PillProps {
  type: PillType
  children: ReactNode
}

const PillStyle: Record<PillType, { borderColor: string; backgroundColor: string }> = {
  success: {
    backgroundColor: "#F9FFF9",
    borderColor: "#28AE25",
  },
  warning: {
    backgroundColor: "#FFFEF6",
    borderColor: "#EF8B2E",
  },
  error: {
    backgroundColor: "#FFF0F0",
    borderColor: "#CB3636",
  },
}

export const Pill = ({ children, type }: PillProps) => {
  return (
    <Box
      sx={{
        width: "fit-content",
        padding: "1px 8px",
        fontSize: "13px",
        color: PillStyle[type].borderColor,
        background: PillStyle[type].backgroundColor,
        border: `1px solid ${PillStyle[type].borderColor}`,
        borderRadius: "4px",
        fontWeight: "300",
      }}
    >
      {children}
    </Box>
  )
}
