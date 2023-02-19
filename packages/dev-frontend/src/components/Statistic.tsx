import React from "react";
import { Flex, Card } from "theme-ui";
import { InfoIcon } from "./InfoIcon";

type StatisticProps = {
  name: React.ReactNode;
  tooltip: React.ReactNode;
};

export const Statistic: React.FC<StatisticProps> = ({ name, tooltip, children }) => {
  return (
    <Flex sx={{ flexDirection: 'column', mb: '12px' }}>
      <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.1, fontWeight: 200, color: '#777777', fontSize: '14px' }}>
        <Flex>{name}</Flex>
        <InfoIcon size="xs" tooltip={<Card variant="tooltip">{tooltip}</Card>} />
      </Flex>
      <Flex sx={{ justifyContent: "flex-start", flex: 0.9, alignItems: "center", fontSize: '16px' }}>{children}</Flex>
    </Flex>
  );
};
