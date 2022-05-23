import {
  UserDepositChanged,
  RBTCGainWithdrawn
} from "../../generated/templates/StabilityPool/StabilityPool";

import {
  updateStabilityDeposit,
  withdrawCollateralGainFromStabilityDeposit
} from "../entities/StabilityDeposit";

export function handleUserDepositChanged(event: UserDepositChanged): void {
  updateStabilityDeposit(event, event.params._depositor, event.params._newDeposit);
}

export function handleRBTCGainWithdrawn(event: RBTCGainWithdrawn): void {
  withdrawCollateralGainFromStabilityDeposit(
    event,
    event.params._depositor,
    event.params._RBTC,
    event.params._BPDLoss
  );
}
