import { Flex, Box } from "theme-ui";
import { Link } from "./Link";

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{ display: ["none", "flex"], alignItems: "center", flex: 1 }}>
      <Flex>
        <Link to="/" sx={{fontWeight: "400"}}>Dashboard</Link>
        <Link to="/farm" sx={{fontWeight: "400"}}>Farm</Link>
        <Link to="/liquidation" sx={{fontWeight: "400"}}>
          Liquidation
        </Link>
        <Link to="/redemption" sx={{fontWeight: "400"}}>
          Redemption
        </Link>
      </Flex>
      <Flex sx={{ justifyContent: "flex-end", mr: 3, flex: 1 }}>
      </Flex>
    </Box>
  );
};
