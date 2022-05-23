type NoneView = "NONE";
type LiquidatedView = "LIQUIDATED";
type RedeemedView = "REDEEMED";
type OpeningView = "OPENING";
type AdjustingView = "ADJUSTING";
type ClosingView = "CLOSING";
type ActiveView = "ACTIVE";

export type VaultView =
  | NoneView
  | LiquidatedView
  | RedeemedView
  | OpeningView
  | AdjustingView
  | ClosingView
  | ActiveView;

type OpenVaultPressedEvent = "OPEN_TROVE_PRESSED";
type AdjustVaultPressedEvent = "ADJUST_TROVE_PRESSED";
type CloseVaultPressedEvent = "CLOSE_TROVE_PRESSED";
type CancelAdjustVaultPressed = "CANCEL_ADJUST_TROVE_PRESSED";
type VaultAdjustedEvent = "TROVE_ADJUSTED";
type VaultOpenedEvent = "TROVE_OPENED";
type VaultClosedEvent = "TROVE_CLOSED";
type VaultLiquidatedEvent = "TROVE_LIQUIDATED";
type VaultRedeemedEvent = "TROVE_REDEEMED";
type VaultSurplusCollateralClaimedEvent = "TROVE_SURPLUS_COLLATERAL_CLAIMED";

export type VaultEvent =
  | OpenVaultPressedEvent
  | AdjustVaultPressedEvent
  | CloseVaultPressedEvent
  | CancelAdjustVaultPressed
  | VaultClosedEvent
  | VaultLiquidatedEvent
  | VaultRedeemedEvent
  | VaultAdjustedEvent
  | VaultSurplusCollateralClaimedEvent
  | VaultOpenedEvent;
