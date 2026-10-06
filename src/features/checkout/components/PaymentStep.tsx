import { ActionButton } from '../../../components/ActionButton'
import { PRODUCT, won } from '../../../domain'
import { useOrderDraft } from '../OrderDraftProvider'
import { PaymentAccount } from './PaymentAccount'

export function PaymentStep({ onSubmit }: { onSubmit: () => void }) {
  const { draft, submission, pending } = useOrderDraft()
  const submitting = submission === 'submitting'
  const total = PRODUCT.unitPrice * draft.quantity
  return <main className="flex flex-1 flex-col gap-[24px] px-[120px] py-[32px]" aria-busy={submitting}>
    <h1 className="text-[32px] font-bold">입금 계좌를 확인해주세요</h1>
    <p className="text-[22px] font-bold">{PRODUCT.name} {draft.quantity}개 · {won(total)}</p>
    <PaymentAccount total={total} beforeOrder />
    {submission === 'failed' && <p role="alert" className="text-[18px] text-error">주문 접수를 확인하지 못했습니다. 다시 시도해주세요.</p>}
    <div className="flex flex-1 flex-col justify-end"><ActionButton variant="order" className="w-full" disabled={submitting} onClick={onSubmit}>{submitting ? '주문을 접수하고 있어요' : pending ? '주문 접수 다시 시도' : `${won(total)} 주문 접수하기`}</ActionButton></div>
  </main>
}
