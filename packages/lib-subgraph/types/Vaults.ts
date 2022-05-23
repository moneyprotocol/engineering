/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { OrderDirection, VaultStatus } from "./globalTypes";

// ====================================================
// GraphQL query operation: Vaults
// ====================================================

export interface Vaults_vaults_owner {
  __typename: "User";
  /**
   * User's Ethereum address as a hex-string
   */
  id: string;
}

export interface Vaults_vaults {
  __typename: "Vault";
  /**
   * Owner's ID + '-' + an incremented integer
   */
  id: string;
  owner: Vaults_vaults_owner;
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

export interface Vaults {
  vaults: Vaults_vaults[];
}

export interface VaultsVariables {
  orderDirection: OrderDirection;
  startingAt: number;
  first: number;
}
