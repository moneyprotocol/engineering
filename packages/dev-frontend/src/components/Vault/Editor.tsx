import React, { useState } from 'react'
import { Text, Flex, Label, Input, SxProp, Button, ThemeUICSSProperties, Box } from 'theme-ui'

import { Icon } from '../Icon'

type RowProps = SxProp & {
  label: string
  labelId?: string
  labelFor?: string
  infoIcon?: React.ReactNode
}

export const Row: React.FC<RowProps> = ({ sx, label, labelId, labelFor, children, infoIcon }) => {
  return (
    <Flex sx={{ alignItems: 'stretch', ...sx }}>
      {label && label !== '' && (
        <Label
          id={labelId}
          htmlFor={labelFor}
          sx={{
            p: 0,
            pl: 3,
            pt: '12px',
            position: 'absolute',

            fontSize: 1,
            border: 1,
            borderColor: 'transparent',
          }}
        >
          <Flex sx={{ alignItems: 'center' }}>
            {label}
            {infoIcon && infoIcon}
          </Flex>
        </Label>
      )}
      {children}
    </Flex>
  )
}

type PendingAmountProps = {
  value: string
}

const PendingAmount: React.FC<PendingAmountProps & SxProp> = ({ sx, value }) => (
  <Text {...{ sx }}>
    (
    {value === '++' ? (
      <Icon name="angle-double-up" />
    ) : value === '--' ? (
      <Icon name="angle-double-down" />
    ) : value?.startsWith('+') ? (
      <>
        <Icon name="angle-up" /> {value.substr(1)}
      </>
    ) : value?.startsWith('-') ? (
      <>
        <Icon name="angle-down" /> {value.substr(1)}
      </>
    ) : (
      value
    )}
    )
  </Text>
)

type StaticAmountsProps = {
  inputId: string
  labelledBy?: string
  amount: string
  unit?: string
  color?: string
  pendingAmount?: string
  pendingColor?: string
  onClick?: () => void
}

export const StaticAmounts: React.FC<StaticAmountsProps & SxProp> = ({
  sx,
  inputId,
  labelledBy,
  amount,
  unit,
  color,
  pendingAmount,
  pendingColor,
  onClick,
  children,
}) => {
  return (
    <Flex
      id={inputId}
      aria-labelledby={labelledBy}
      {...{ onClick }}
      sx={{
        justifyContent: 'space-between',
        alignItems: 'center',

        ...(onClick ? { cursor: 'text' } : {}),

        ...staticStyle,
        ...sx,
      }}
    >
      <Flex sx={{ alignItems: 'center' }}>
        <Text sx={{ color }}>{amount}</Text>

        {unit && (
          <>
            &nbsp;
            <Text sx={{ fontWeight: '300', color: '#BCBED1' }}>{unit}</Text>
          </>
        )}

        {pendingAmount && (
          <>
            &nbsp;
            <PendingAmount
              sx={{ color: pendingColor, opacity: 0.8, fontSize: '0.666em' }}
              value={pendingAmount}
            />
          </>
        )}
      </Flex>

      {children}
    </Flex>
  )
}

const staticStyle: ThemeUICSSProperties = {
  flexGrow: 1,

  mb: 0,
  pl: 3,
  pr: '11px',
  pb: 0,
  pt: 0,

  fontSize: 3,

  border: 1,
  borderColor: 'transparent',
}

const editableStyle: ThemeUICSSProperties = {
  flexGrow: 1,

  mb: [2, 3],
  pl: 3,
  pr: '11px',
  pb: 3,
  pt: 3,

  fontSize: 4,

  boxShadow: [1, 2],
  border: 1,
  borderRadius: '8px',
  borderColor: 'muted',
}

type StaticRowProps = RowProps & StaticAmountsProps

export const StaticRow: React.FC<StaticRowProps> = ({
  label,
  labelId,
  labelFor,
  infoIcon,
  ...props
}) => (
  <Flex
    sx={{ alignItems: 'center', borderRadius: '6px', p: '18px', height: '60px', mb: '10px' }}
    className="bg-light"
  >
    <div className="font-light">
      {label}
      {infoIcon}:
    </div>

    <Row {...{ label: '', labelId, labelFor }} sx={{ pb: '0' }}>
      <StaticAmounts {...props} sx={{ px: '12px', py: '0px', m: '0px', fontWeight: '600' }} />
    </Row>
  </Flex>
)

type DisabledEditableRowProps = Omit<StaticAmountsProps, 'labelledBy' | 'onClick'> & {
  label: string
}

export const DisabledEditableRow: React.FC<DisabledEditableRowProps> = ({
  inputId,
  label,
  unit,
  amount,
  color,
  pendingAmount,
  pendingColor,
}) => (
  <div>
    <Box sx={{ mb: 2, fontSize: '13px', fontWeight: '300' }}>{label}</Box>
    <Row labelId={`${inputId}-label`} {...{ label: '', unit }}>
      <StaticAmounts
        sx={{ ...editableStyle, boxShadow: 0 }}
        labelledBy={`${inputId}-label`}
        {...{ inputId, amount, unit, color, pendingAmount, pendingColor }}
      />
    </Row>
  </div>
)

type EditableRowProps = DisabledEditableRowProps & {
  editingState: [string | undefined, (editing: string | undefined) => void]
  editedAmount: string
  setEditedAmount: (editedAmount: string) => void
  maxAmount?: string
  maxedOut?: boolean
}

export const EditableRow: React.FC<EditableRowProps> = ({
  label,
  inputId,
  unit,
  amount,
  color,
  pendingAmount,
  pendingColor,
  editingState,
  editedAmount,
  setEditedAmount,
  maxAmount,
  maxedOut,
}) => {
  const [editing, setEditing] = editingState
  const [invalid, setInvalid] = useState(false)

  return editing === inputId ? (
    <div>
      <Box sx={{ mb: 2, fontSize: '13px', fontWeight: '300' }}>{label}</Box>
      <Row {...{ label: '', labelFor: inputId, unit }}>
        <Input
          autoFocus
          id={inputId}
          type="number"
          step="any"
          defaultValue={editedAmount}
          {...{ invalid }}
          onChange={e => {
            try {
              setEditedAmount(e.target.value)
              setInvalid(false)
            } catch {
              setInvalid(true)
            }
          }}
          onBlur={() => {
            setEditing(undefined)
            setInvalid(false)
          }}
          variant="editor"
          sx={{
            ...editableStyle,
            fontWeight: 'medium',
            bg: invalid ? 'invalid' : 'background',
          }}
        />
      </Row>
    </div>
  ) : (
    <div>
      <Box sx={{ mb: 2, fontSize: '13px', fontWeight: '300' }}>{label}</Box>
      <Row labelId={`${inputId}-label`} {...{ label: '', unit }}>
        <StaticAmounts
          sx={{
            ...editableStyle,
            bg: invalid ? 'invalid' : 'background',
          }}
          labelledBy={`${inputId}-label`}
          onClick={() => setEditing(inputId)}
          {...{ inputId, amount, unit, color, pendingAmount, pendingColor, invalid }}
        >
          {maxAmount && (
            <Button
              sx={{ fontSize: 1, p: 1, px: 3 }}
              onClick={event => {
                setEditedAmount(maxAmount)
                event.stopPropagation()
              }}
              disabled={maxedOut}
            >
              max
            </Button>
          )}
        </StaticAmounts>
      </Row>
    </div>
  )
}
