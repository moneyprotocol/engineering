import { BlockPolledMoneypStoreState } from "@moneyprotocol/lib-ethers";
import { useMoneypSelector } from "@liquity/lib-react";

import { useMoneyp } from "../../hooks/MoneypContext";
import { DisabledRedemption } from "./DisabledRedemption";
import { RedemptionManager } from "./RedemptionManager";

const SECONDS_IN_ONE_DAY = 24 * 60 * 60;

const selectBlockTimestamp = ({ blockTimestamp }: BlockPolledMoneypStoreState) => blockTimestamp;

export const Redemption: React.FC = () => {
  const {
    moneyp: {
      connection: { deploymentDate, bootstrapPeriod }
    }
  } = useMoneyp();

  const blockTimestamp = useMoneypSelector(selectBlockTimestamp);

  const bootstrapPeriodDays = Math.round(bootstrapPeriod / SECONDS_IN_ONE_DAY);
  const deploymentTime = deploymentDate.getTime() / 1000;
  const bootstrapEndTime = deploymentTime + bootstrapPeriod;
  const bootstrapEndDate = new Date(bootstrapEndTime * 1000);
  const redemptionDisabled = blockTimestamp < bootstrapEndTime;

  if (redemptionDisabled) {
    return <DisabledRedemption disabledDays={bootstrapPeriodDays} unlockDate={bootstrapEndDate} />;
  }

  return <RedemptionManager />;
};
