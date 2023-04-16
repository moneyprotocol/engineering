import React from "react"
import { Box, Image } from "theme-ui"

type MoneypLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string
}

export const MoneypLogo: React.FC<MoneypLogoProps> = ({ height, ...boxProps }) => (
  <Box sx={{ lineHeight: 0 }} {...boxProps}>
    <Image src="./bpd-icon.png" sx={{ height }} />
  </Box>
)
