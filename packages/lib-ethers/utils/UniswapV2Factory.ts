/* eslint-disable @typescript-eslint/no-non-null-assertion */
import assert from "assert";

import { Log } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Overrides } from "@ethersproject/contracts";

import { _MoneypContract, _TypedMoneypContract, _TypedLogDescription } from "../src/contracts";
import { log } from "./deploy";

const factoryAbi = [
  "function createPair(address tokenA, address tokenB) returns (address pair)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
];

const factoryAddress = "0xfaa7762f551bba9b0eba34d6443d49d0a577c0e1";

const hasFactory = (chainId: number) => [1, 3, 4, 5, 42, 31].includes(chainId);

interface UniswapV2Factory
  extends _TypedMoneypContract<
    unknown,
    { createPair(tokenA: string, tokenB: string, _overrides?: Overrides): Promise<string> }
  > {
  extractEvents(
    logs: Log[],
    name: "PairCreated"
  ): _TypedLogDescription<{ token0: string; token1: string; pair: string }>[];
}

export const createUniswapV2Pair = async (
  signer: Signer,
  tokenA: string,
  tokenB: string,
  overrides?: Overrides
): Promise<string> => {
  const chainId = await signer.getChainId();

  if (!hasFactory(chainId)) {
    throw new Error(`UniswapV2Factory is not deployed on this network (chainId = ${chainId})`);
  }

  const factory = (new _MoneypContract(
    factoryAddress,
    factoryAbi,
    signer
  ) as unknown) as UniswapV2Factory;

  log(`Creating Uniswap v2 WRBTC <=> BPD pair...`);
  log(`[ARGS] ${tokenA} | ${tokenB} | ${JSON.stringify(overrides)}`)

  const tx = await factory.createPair(tokenA, tokenB, { ...overrides });
  const receipt = await tx.wait();
  log(JSON.stringify(receipt));

  // const pairCreatedEvents = factory.extractEvents(receipt.logs, "PairCreated");
  // log(JSON.stringify(pairCreatedEvents));

  // assert(pairCreatedEvents.length === 1);
  // return pairCreatedEvents[0].args.pair;

  const pairCreatedEvent = receipt.events![0];

  if (pairCreatedEvent.event === 'PairCreated') {
    return pairCreatedEvent.args![2]
  }

  log(`Could not find PairCreated event within the transaction.`);
  throw Error('I')
};
