import React, { useEffect, useState } from 'react'
import { Card, Paragraph, Text } from 'theme-ui'
import { useWeb3React } from '@web3-react/core'
import { Web3Provider } from '@ethersproject/providers'
import { Decimal, MoneypStoreState } from '@moneyprotocol/lib-base'
import { useMoneypSelector } from '@moneyprotocol/lib-react'
import { InfoIcon } from '../InfoIcon'
import { useMoneyp } from '../../hooks/MoneypContext'
import { Badge } from '../Badge'
import { fetchLqtyPrice } from './context/fetchLqtyPrice'

const selector = ({ bpdInStabilityPool, remainingStabilityPoolMPReward }: MoneypStoreState) => ({
  bpdInStabilityPool,
  remainingStabilityPoolMPReward,
})

export const Yield: React.FC = () => {
  const {
    moneyp: {
      connection: { addresses },
    },
  } = useMoneyp()
  const { bpdInStabilityPool, remainingStabilityPoolMPReward } = useMoneypSelector(selector)
  const { chainId } = useWeb3React<Web3Provider>()
  const isMainnet = chainId === 1

  const [mpPrice, setLqtyPrice] = useState<Decimal | undefined>(undefined)
  const hasZeroValue = remainingStabilityPoolMPReward.isZero || bpdInStabilityPool.isZero
  let mpTokenAddress = addresses['mpToken']

  // TODO: remove after Team has reviewed on /next
  if (!isMainnet) {
    mpTokenAddress = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'
  }

  useEffect(() => {
    ;(async () => {
      try {
        const { mpPriceUSD } = await fetchLqtyPrice(mpTokenAddress)
        setLqtyPrice(mpPriceUSD)
      } catch (error) {
        console.error(error)
      }
    })()
  }, [mpTokenAddress])

  // TODO: switch to this condition after team has reviewed on /next
  // if (!isMainnet || hasZeroValue || mpPrice === undefined) return null;
  if (hasZeroValue || mpPrice === undefined) return null
  const yearlyHalvingSchedule = 0.5 // 50% see MP distribution schedule for more info
  const remainingLqtyOneYear = remainingStabilityPoolMPReward.mul(yearlyHalvingSchedule)
  const remainingLqtyInUSD = remainingLqtyOneYear.mul(mpPrice)
  const apyPercentage = remainingLqtyInUSD.div(bpdInStabilityPool).mul(100)

  return (
    <Badge>
      <Text>MP APY {apyPercentage.toString(2)}%</Text>
      <InfoIcon
        size="xs"
        tooltip={
          <Card variant="tooltip" sx={{ width: ['220px', '506px'] }}>
            <Paragraph>
              MP APY is an <Text sx={{ fontWeight: 'bold' }}>estimate</Text> of the MP return on
              deposited BPD over the next year. This doesn't include the RBTC gains.
            </Paragraph>
            <Paragraph sx={{ fontSize: '12px', fontFamily: 'monospace', mt: 2 }}>
              ($MP_REWARDS * YEARLY_DISTRIBUTION% / STABILITY_BPD) * 100 ={' '}
              <Text sx={{ fontWeight: 'bold' }}> APY</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
              ($
              {remainingLqtyInUSD.shorten()} * 50% / ${bpdInStabilityPool.shorten()}) * 100 =
              <Text sx={{ fontWeight: 'bold' }}> {apyPercentage.toString(2)}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  )
}
