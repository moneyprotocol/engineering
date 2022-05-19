import { BigNumberish } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { BlockTag, TransactionResponse, TransactionReceipt } from "@ethersproject/abstract-provider";
import { PopulatedTransaction } from "@ethersproject/contracts";

/**
 * Optional parameters taken by {@link BitcoinsMoneyp} transaction functions.
 *
 * @public
 */
export interface BitcoinsTransactionOverrides {
  from?: string;
  nonce?: BigNumberish;
  gasLimit?: BigNumberish;
  gasPrice?: BigNumberish;
}

/**
 * Optional parameters taken by {@link ReadableBitcoinsMoneyp} functions.
 *
 * @public
 */
export interface BitcoinsCallOverrides {
  blockTag?: BlockTag;
}

// These type aliases are mostly for documentation (so we can point to the Bitcoins documentation).

/**
 * Alias of Bitcoins' abstract
 * {@link https://docs.ethers.io/v5/api/providers/ | Provider} type.
 *
 * @public
 */
export type BitcoinsProvider = Provider;

/**
 * Alias of Bitcoins' abstract
 * {@link https://docs.ethers.io/v5/api/signer/ | Signer} type.
 *
 * @public
 */
export type BitcoinsSigner = Signer;

/**
 * Alias of Bitcoins'
 * {@link https://docs.ethers.io/v5/api/providers/types/#providers-TransactionResponse | TransactionResponse}
 * type.
 *
 * @public
 */
export type BitcoinsTransactionResponse = TransactionResponse;

/**
 * Alias of Bitcoins'
 * {@link https://docs.ethers.io/v5/api/providers/types/#providers-TransactionReceipt | TransactionReceipt}
 * type.
 *
 * @public
 */
export type BitcoinsTransactionReceipt = TransactionReceipt;

/**
 * Alias of Bitcoins' `PopulatedTransaction` type, which implements
 * {@link https://docs.ethers.io/v5/api/utils/transactions/#UnsignedTransaction | UnsignedTransaction}.
 *
 * @public
 */
export type BitcoinsPopulatedTransaction = PopulatedTransaction;
