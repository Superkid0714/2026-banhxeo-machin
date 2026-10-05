import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'quantity' | 'order' | 'secondary'
  height?: number
  mutedDisabled?: boolean
}

export function ActionButton({ variant = 'quantity', height = 72, mutedDisabled = true, className = '', disabled, style, ...props }: Props) {
  const appearance = disabled && mutedDisabled ? 'border border-line bg-disabled text-muted' : variant === 'order' ? 'bg-order text-ink' : 'border border-line bg-white text-ink'
  return <button type="button" disabled={disabled} style={{ height, ...(variant === 'quantity' ? { width: height } : {}), ...style }} className={`flex shrink-0 items-center justify-center gap-[8px] overflow-hidden rounded-[8px] px-[16px] text-[20px] font-bold leading-[1.25] ${appearance} ${className}`} {...props} />
}
