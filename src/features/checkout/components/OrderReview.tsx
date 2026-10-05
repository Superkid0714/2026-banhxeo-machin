import { ActionButton } from '../../../components/ActionButton'
import { PRODUCT, won } from '../../../domain'
import { useOrderDraft } from '../OrderDraftProvider'
import { OrderSummary } from './OrderSummary'
export function OrderReview({ onEditPhone, onSubmit }: { onEditPhone: () => void; onSubmit: () => void }) {
  const { draft, submission, pending, update } = useOrderDraft()
  const locked = submission === 'submitting'
  const total = won(PRODUCT.unitPrice * draft.quantity)
  const phone = `${draft.phone.slice(0,3)}-${draft.phone.slice(3,5)}**-${draft.phone.slice(7,9)}**`
  return <main className="flex flex-1 flex-col gap-[28px] px-[120px] pt-[40px] pb-[32px]" aria-busy={locked}>
    <h1 className="text-[36px] font-bold">주문 내용을 확인해주세요</h1>
    <OrderSummary quantity={draft.quantity} locked={locked || pending} onQuantity={quantity => update({ quantity })} />
    <div className="flex h-[64px] shrink-0 items-center justify-between"><div className="flex items-center gap-[24px] text-[20px]"><p className="font-bold">{draft.notificationMethod === 'sms' ? '문자 알림' : '문자 알림 사용 안 함'}</p><p>{phone}</p></div><ActionButton variant="secondary" height={56} className="w-[144px]" disabled={locked || pending} mutedDisabled={false} onClick={onEditPhone}>번호 변경</ActionButton></div>
    <div className="flex gap-[16px] rounded-[8px] bg-disabled p-[20px]"><img src="/assets/info.svg" width="24" height="24" alt="" className="shrink-0 self-start" /><div className="flex flex-col gap-[8px]"><p className="text-[20px] font-bold">주문 후 부스에서 결제를 진행해주세요.</p><p className="text-[18px] text-muted">카드·계좌이체·현금 등 현장 결제 후 주문이 접수됩니다.</p></div></div>
    <div className="flex flex-1 items-end gap-[80px]"><div className="flex flex-1 flex-col gap-[8px]"><p className="text-[20px] text-muted">총 결제금액</p><p className="text-[36px] font-bold">{total}</p></div><ActionButton variant="order" className="w-[520px]" disabled={locked} onClick={onSubmit}>{locked ? <><img src="/assets/loader-circle.svg" width="20" height="20" alt="" className="animate-spin motion-reduce:animate-none" />주문을 접수하고 있어요</> : `${total} 주문하기`}</ActionButton></div>
  </main>
}
