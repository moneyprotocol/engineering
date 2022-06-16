import { Decimal } from "@liquity/lib-base";

type UniswapResponse = {
  data?: {
    bundle: {
      ethPrice: string;
    } | null;
    token: {
      derivedRBTC: string;
    } | null;
    pair: {
      reserveUSD: string;
      totalSupply: string;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

const uniswapQuery = (mpTokenAddress: string, rskSwapTokenAddress: string) => `{
  token(id: "${mpTokenAddress.toLowerCase()}") {
    derivedRBTC
  },
  bundle(id: 1) {
    ethPrice
  },
  pair(id: "${rskSwapTokenAddress.toLowerCase()}") {
    totalSupply
    reserveUSD
  }
}`;

export async function fetchPrices(mpTokenAddress: string, rskSwapTokenAddress: string) {
  const response = await window.fetch("https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: uniswapQuery(mpTokenAddress, rskSwapTokenAddress),
      variables: null
    })
  });

  if (!response.ok) {
    return Promise.reject("Network error connecting to Uniswap subgraph");
  }

  const { data, errors }: UniswapResponse = await response.json();

  if (errors) {
    return Promise.reject(errors);
  }

  if (
    typeof data?.token?.derivedRBTC === "string" &&
    typeof data?.pair?.reserveUSD === "string" &&
    typeof data?.pair?.totalSupply === "string" &&
    typeof data?.bundle?.ethPrice === "string"
  ) {
    const ethPriceUSD = Decimal.from(data.bundle.ethPrice);
    const mpPriceUSD = Decimal.from(data.token.derivedRBTC).mul(ethPriceUSD);
    const uniLpPriceUSD = Decimal.from(data.pair.reserveUSD).div(
      Decimal.from(data.pair.totalSupply)
    );

    return { mpPriceUSD, uniLpPriceUSD };
  }

  return Promise.reject("Uniswap doesn't have the required data to calculate yield");
}
