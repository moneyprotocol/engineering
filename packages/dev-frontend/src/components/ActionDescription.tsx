import { Text } from "theme-ui"
import { Alert } from "./Alert"

export const ActionDescription: React.FC = ({ children }) => <Alert type="info">{children}</Alert>

export const Amount: React.FC = ({ children }) => (
  <Text sx={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{children}</Text>
)
