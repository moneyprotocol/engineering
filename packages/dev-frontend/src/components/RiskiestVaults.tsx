import React, { useState, useEffect, useCallback } from "react"
import CopyToClipboard from "react-copy-to-clipboard"
import { Card, Button, Text, Box, Heading, Flex, Container } from "theme-ui"

import {
  Percent,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  UserVault,
  Decimal,
} from "@money-protocol/lib-base"
import { BlockPolledMoneypStoreState } from "@money-protocol/lib-ethers"
import { useMoneypSelector } from "@moneyprotocol/lib-react"

import { shortenAddress } from "../utils/shortenAddress"
import { useMoneyp } from "../hooks/MoneypContext"

import { Icon } from "./Icon"
import { LoadingOverlay } from "./LoadingOverlay"
import { Tooltip } from "./Tooltip"
import { Abbreviation } from "./Abbreviation"
import { Pill } from "./Pill"
import { ResetIcon } from "./shared"
import { Transaction } from "./Transaction"

const liquidatableInNormalMode = (vault: UserVault, price: Decimal) =>
  [vault.collateralRatioIsBelowMinimum(price), "Collateral ratio not low enough"] as const

const liquidatableInRecoveryMode = (
  vault: UserVault,
  price: Decimal,
  totalCollateralRatio: Decimal,
  bpdInStabilityPool: Decimal
) => {
  const collateralRatio = vault.collateralRatio(price)

  if (collateralRatio.gte(MINIMUM_COLLATERAL_RATIO) && collateralRatio.lt(totalCollateralRatio)) {
    return [
      vault.debt.lte(bpdInStabilityPool),
      "There's not enough BPD in the Stability pool to cover the debt",
    ] as const
  } else {
    return liquidatableInNormalMode(vault, price)
  }
}

type RiskiestVaultsProps = {
  pageSize: number
}

const select = ({
  numberOfVaults,
  price,
  total,
  bpdInStabilityPool,
  blockTag,
}: BlockPolledMoneypStoreState) => ({
  numberOfVaults,
  price,
  recoveryMode: total.collateralRatioIsBelowCritical(price),
  totalCollateralRatio: total.collateralRatio(price),
  bpdInStabilityPool,
  blockTag,
})

export const RiskiestVaults: React.FC<RiskiestVaultsProps> = ({ pageSize }) => {
  const {
    blockTag,
    numberOfVaults,
    recoveryMode,
    totalCollateralRatio,
    bpdInStabilityPool,
    price,
  } = useMoneypSelector(select)
  const { moneyp } = useMoneyp()

  const [loading, setLoading] = useState(true)
  const [vaults, setVaults] = useState<UserVault[]>()

  const [reload, setReload] = useState({})
  const forceReload = useCallback(() => setReload({}), [])

  const [page, setPage] = useState(0)
  const numberOfPages = Math.ceil(numberOfVaults / pageSize) || 1
  const clampedPage = Math.min(page, numberOfPages - 1)

  const nextPage = () => {
    if (clampedPage < numberOfPages - 1) {
      setPage(clampedPage + 1)
    }
  }

  const previousPage = () => {
    if (clampedPage > 0) {
      setPage(clampedPage - 1)
    }
  }

  useEffect(() => {
    if (page !== clampedPage) {
      setPage(clampedPage)
    }
  }, [page, clampedPage])

  useEffect(() => {
    let mounted = true

    setLoading(true)

    moneyp
      .getVaults(
        {
          first: pageSize,
          sortedBy: "ascendingCollateralRatio",
          startingAt: clampedPage * pageSize,
        },
        { blockTag }
      )
      .then(vaults => {
        if (mounted) {
          setVaults(vaults)
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
    // Omit blockTag from deps on purpose
    // eslint-disable-next-line
  }, [moneyp, clampedPage, pageSize, reload])

  useEffect(() => {
    forceReload()
  }, [forceReload, numberOfVaults])

  const [copied, setCopied] = useState<string>()

  useEffect(() => {
    if (copied !== undefined) {
      let cancelled = false

      setTimeout(() => {
        if (!cancelled) {
          setCopied(undefined)
        }
      }, 2000)

      return () => {
        cancelled = true
      }
    }
  }, [copied])

  return (
    <Card sx={{ width: "100%" }}>
      <Heading>
        <Abbreviation short="Vaults">Riskiest Vaults</Abbreviation>

        <Flex sx={{ alignItems: "center" }}>
          {numberOfVaults !== 0 && (
            <>
              <Abbreviation
                short={`page ${clampedPage + 1} / ${numberOfPages}`}
                sx={{ mr: [0, 3], fontWeight: "body", fontSize: [1, 2], letterSpacing: [-1, 0] }}
              >
                {clampedPage * pageSize + 1}-
                {Math.min((clampedPage + 1) * pageSize, numberOfVaults)} of {numberOfVaults}
              </Abbreviation>

              <Button variant="titleIcon" onClick={previousPage} disabled={clampedPage <= 0}>
                <Icon name="chevron-left" size="lg" />
              </Button>

              <Button
                variant="titleIcon"
                onClick={nextPage}
                disabled={clampedPage >= numberOfPages - 1}
              >
                <Icon name="chevron-right" size="lg" />
              </Button>
            </>
          )}

          <Button
            variant="titleIcon"
            sx={{ opacity: loading ? 0 : 1, ml: [0, 3] }}
            onClick={forceReload}
          >
            <ResetIcon />
          </Button>
        </Flex>
      </Heading>

      {!vaults || vaults.length === 0 ? (
        <Box sx={{ pt: "20px" }}>
          <Box sx={{ p: 4, fontSize: 3, textAlign: "center" }}>
            {!vaults ? "Loading..." : "There are no Vaults yet"}
          </Box>
        </Box>
      ) : (
        <Box sx={{ pt: "20px" }}>
          {vaults.map(
            vault =>
              !vault.isEmpty && (
                <Box
                  key={vault.ownerAddress}
                  sx={{
                    border: "1px solid #E7E7E7",
                    borderRadius: "4px",
                    padding: "14px 20px",
                    mb: "10px",
                    lineHeight: "1.8",
                  }}
                >
                  <Container sx={{ display: "flex" }}>
                    <Container variant="columns">
                      <Container variant="left">
                        <Box className="vault-label">
                          <Flex sx={{ alignItems: "center" }}>
                            <Box>Owner</Box>
                            <CopyToClipboard
                              text={vault.ownerAddress}
                              onCopy={() => setCopied(vault.ownerAddress)}
                            >
                              <Button variant="icon" sx={{ width: "24px", height: "24px" }}>
                                <Icon
                                  name={
                                    copied === vault.ownerAddress ? "clipboard-check" : "clipboard"
                                  }
                                  size="sm"
                                />
                              </Button>
                            </CopyToClipboard>
                          </Flex>
                        </Box>
                        <Box>
                          <Tooltip message={vault.ownerAddress} placement="top">
                            <Text
                              variant="address"
                              sx={{
                                width: ["73px", "unset"],
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              {shortenAddress(vault.ownerAddress)}
                              <Box
                                sx={{
                                  display: ["block", "none"],
                                  position: "absolute",
                                  top: 0,
                                  right: 0,
                                  width: "50px",
                                  height: "100%",
                                  background:
                                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
                                }}
                              />
                            </Text>
                          </Tooltip>
                        </Box>
                        <Box className="vault-label" sx={{ mt: 2 }}>
                          Debt (BPD)
                        </Box>
                        <Box>
                          <Abbreviation short={vault.debt.shorten()}>
                            {vault.debt.prettify()}
                          </Abbreviation>
                        </Box>
                      </Container>

                      <Container variant="right">
                        <Box className="vault-label">Collateral (RBTC)</Box>
                        <Box>
                          <Abbreviation short={vault.collateral.shorten()}>
                            {vault.collateral.prettify(4)}
                          </Abbreviation>
                        </Box>
                        <Box className="vault-label" sx={{ mt: 2 }}>
                          Collateral Ratio
                        </Box>
                        <Box>
                          {(collateralRatio => (
                            <Pill
                              type={
                                collateralRatio.gt(CRITICAL_COLLATERAL_RATIO)
                                  ? "success"
                                  : collateralRatio.gt(MINIMUM_COLLATERAL_RATIO)
                                  ? "warning"
                                  : "error"
                              }
                            >
                              {new Percent(collateralRatio).prettify()}
                            </Pill>
                          ))(vault.collateralRatio(price))}
                        </Box>
                      </Container>
                    </Container>
                    <div>
                      <Transaction
                        id={`liquidate-${vault.ownerAddress}`}
                        tooltip="Liquidate"
                        requires={[
                          recoveryMode
                            ? liquidatableInRecoveryMode(
                                vault,
                                price,
                                totalCollateralRatio,
                                bpdInStabilityPool
                              )
                            : liquidatableInNormalMode(vault, price),
                        ]}
                        send={moneyp.send.liquidate.bind(moneyp.send, vault.ownerAddress)}
                      >
                        <Button
                          variant="danger"
                          className="liquidate-btn"
                          sx={{ px: 2, py: 1, background: "#E70634", fontSize: "13px" }}
                        >
                          <Text>Liquidate</Text>
                        </Button>
                      </Transaction>
                    </div>
                  </Container>
                </Box>
              )
          )}
        </Box>
      )}

      {loading && <LoadingOverlay />}
    </Card>
  )
}
