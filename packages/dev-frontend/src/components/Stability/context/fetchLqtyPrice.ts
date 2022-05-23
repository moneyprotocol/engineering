import { Decimal } from "@liquity/lib-base";

type UniswapResponse = {
  data?: {
    bundle: {
      ethPrice: string;
    } | null;
    token: {
      derivedRBTC: string;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

const uniswapQuery = (mpTokenAddress: string) => `{
  token(id: "${mpTokenAddress.toLowerCase()}") {
    derivedRBTC
  },
  bundle(id: 1) {
    ethPrice
  },
}`;

export async function fetchLqtyPrice(mpTokenAddress: string) {
  const response = await window.fetch("https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: uniswapQuery(mpTokenAddress),
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

  if (typeof data?.token?.derivedRBTC === "string" && typeof data?.bundle?.ethPrice === "string") {
    const ethPriceUSD = Decimal.from(data.bundle.ethPrice);
    const mpPriceUSD = Decimal.from(data.token.derivedRBTC).mul(ethPriceUSD);

    return { mpPriceUSD };
  }

  return Promise.reject("Uniswap doesn't have the required data to calculate yield");
}
