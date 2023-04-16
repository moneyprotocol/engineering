import { Heading, Box, Card, Flex, Button } from 'theme-ui'

import { MoneypStoreState } from '@moneyprotocol/lib-base'
import { useMoneypSelector } from '@moneyprotocol/lib-react'

import { COIN, GT } from '../../strings'

import { DisabledEditableRow, StaticRow } from '../Vault/Editor'
import { LoadingOverlay } from '../LoadingOverlay'
import { Icon } from '../Icon'

import { useStakingView } from './context/StakingViewContext'
import { StakingGainsAction } from './StakingGainsAction'

const selectMPStake = ({ mpStake }: MoneypStoreState) => mpStake

export const ReadOnlyStake: React.FC = () => {
  const { changePending, dispatch } = useStakingView()
  const mpStake = useMoneypSelector(selectMPStake)

  return (
    <Card>
      <Heading>Staking</Heading>

      <Box sx={{ pt: '20px' }}>
        <DisabledEditableRow
          label="Stake"
          inputId="stake-mp"
          amount={mpStake.stakedMP.prettify()}
          unit={GT}
        />

        <StaticRow
          label="Redemption gain"
          inputId="stake-gain-eth"
          amount={mpStake.collateralGain.prettify(4)}
          color={mpStake.collateralGain.nonZero && 'blueSuccess'}
          unit="RBTC"
        />

        <StaticRow
          label="Issuance gain"
          inputId="stake-gain-bpd"
          amount={mpStake.bpdGain.prettify()}
          color={mpStake.bpdGain.nonZero && 'blueSuccess'}
          unit={COIN}
        />

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={() => dispatch({ type: 'startAdjusting' })}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>

          <StakingGainsAction />
        </Flex>
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  )
}
