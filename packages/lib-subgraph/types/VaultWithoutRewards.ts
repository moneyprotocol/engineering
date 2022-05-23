/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { VaultStatus } from "./globalTypes";

// ====================================================
// GraphQL query operation: VaultWithoutRewards
// ====================================================

export interface VaultWithoutRewards_user_currentVault_owner {
  __typename: "User";
  /**
   * User's Ethereum address as a hex-string
   */
  id: string;
}

export interface VaultWithoutRewards_user_currentVault {
  __typename: "Vault";
  /**
   * Owner's ID + '-' + an incremented integer
   */
  id: string;
  owner: VaultWithoutRewards_user_currentVault_owner;
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

export interface VaultWithoutRewards_user {
  __typename: "User";
  /**
   * User's Ethereum address as a hex-string
   */
  id: string;
  currentVault: VaultWithoutRewards_user_currentVault | null;
}

export interface VaultWithoutRewards {
  user: VaultWithoutRewards_user | null;
}

export interface VaultWithoutRewardsVariables {
  address: string;
}
