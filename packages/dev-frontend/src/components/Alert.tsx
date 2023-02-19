import { ReactNode } from "react"
import { Box, Flex, Text } from "theme-ui"
import { SuccessIcon, InfoIcon, LoadingIcon } from "./shared"

type AlertType = "success" | "error" | "warning" | "info"

interface AlertProps {
  children: ReactNode
  type: AlertType
}

const AlertStyle: Record<
  AlertType,
  { icon: JSX.Element; backgroundColor: string; borderColor: string }
> = {
  success: {
    icon: <SuccessIcon />,
    backgroundColor: "#F9FFF9",
    borderColor: "#28AE25",
  },
  error: {
    icon: <InfoIcon color="#E22F2F" />,
    backgroundColor: "#FFF3F3",
    borderColor: "#E22F2F",
  },
  warning: {
    icon: <LoadingIcon />,
    backgroundColor: "#FFFEF7",
    borderColor: "#CAAA00",
  },
  info: {
    icon: <InfoIcon />,
    backgroundColor: "#F9F5FF",
    borderColor: "#6100FF",
  },
}

export const Alert = ({ children, type }: AlertProps) => {
  return (
    <Box
      sx={{
        backgroundColor: AlertStyle[type].backgroundColor,
        display: "flex",
        borderRadius: "6px",
        borderLeft: `6px solid ${AlertStyle[type].borderColor}`,
        my: 2,
        mb: 3,
      }}
    >
      <Flex sx={{ alignItems: "center", p: 3 }}>
        {AlertStyle[type].icon}
        <Text sx={{ ml: 3 }}>{children}</Text>
      </Flex>
    </Box>
  )
}
