/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { VaultStatus } from "./globalTypes";

// ====================================================
// GraphQL fragment: VaultRawFields
// ====================================================

export interface VaultRawFields_owner {
  __typename: "User";
  /**
   * User's Ethereum address as a hex-string
   */
  id: string;
}

export interface VaultRawFields {
  __typename: "Vault";
  owner: VaultRawFields_owner;
  status: VaultStatus;
  rawCollateral: any;
  rawDebt: any;
  rawStake: any;
  /**
   * The value of total redistributed per-stake collateral the last time rewards were applied
   */
  rawSnapshotOfTotalRedistributedCollateral: any;
  /**
   * The value of total redistributed per-stake debt the last time rewards were applied
   */
  rawSnapshotOfTotalRedistributedDebt: any;
}
