import { QuantityStepper } from '../../../components/QuantityStepper'
import { PRODUCT, won } from '../../../domain'
export function OrderSummary({ quantity, locked, onQuantity }: { quantity: number; locked: boolean; onQuantity: (value: number) => void }) {
  return <div className="flex flex-col gap-[24px]">
    <div className="flex items-center gap-[24px]"><img src="/assets/order-thumbnail.png" width="144" height="132" alt={PRODUCT.name} className="h-[132px] w-[144px] shrink-0 rounded-[8px] object-cover" /><div className="flex min-w-0 flex-1 flex-col gap-[8px]"><p className="text-[26px] font-bold">{PRODUCT.name}</p><p className="text-[20px] text-muted">{won(PRODUCT.unitPrice)} × {quantity}</p><QuantityStepper size="small" value={quantity} disabled={locked} mutedDisabled={false} onChange={onQuantity} /></div><p className="text-[32px] font-bold">{won(PRODUCT.unitPrice * quantity)}</p></div>
    <div className="h-px bg-line" />
  </div>
}
