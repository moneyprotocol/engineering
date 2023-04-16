import { Box, Heading } from "theme-ui"
import { Alert } from "./Alert"

type InfoMessageProps = {
  title: string
  icon?: React.ReactNode
}

export const InfoMessage: React.FC<InfoMessageProps> = ({ title, children, icon }) => (
  <Alert type="info">
    <Heading as="h4">{title}</Heading>
    {children && <Box sx={{ fontSize: 1, mt: 2 }}>{children}</Box>}
  </Alert>
)
