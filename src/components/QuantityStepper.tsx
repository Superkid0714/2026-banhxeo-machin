import { ActionButton } from './ActionButton'

type Props = { value: number; onChange: (value: number) => void; size?: 'large' | 'small'; disabled?: boolean; mutedDisabled?: boolean }

export function QuantityStepper({ value, onChange, size = 'large', disabled = false, mutedDisabled = true }: Props) {
  const small = size === 'small'
  return (
    <div className={`flex shrink-0 items-center justify-between ${small ? 'h-[56px] w-[216px]' : 'h-[72px] w-[280px]'}`} role="group" aria-label="주문 수량">
      <ActionButton height={small ? 56 : 72} className={small?'':'!text-[28px]'} disabled={disabled || value === 1} mutedDisabled={disabled && mutedDisabled} aria-label="수량 줄이기" onClick={() => onChange(Math.max(1, value - 1))}>−</ActionButton>
      <output aria-label="수량" aria-live="polite" className={`font-bold leading-[1.25] ${small ? 'text-[28px]' : 'text-[44px]'} ${disabled && mutedDisabled ? 'text-muted' : ''}`}>{value}</output>
      <ActionButton height={small ? 56 : 72} className={small?'':'!text-[28px]'} disabled={disabled} mutedDisabled={mutedDisabled} aria-label="수량 늘리기" onClick={() => onChange(value + 1)}>+</ActionButton>
    </div>
  )
}
