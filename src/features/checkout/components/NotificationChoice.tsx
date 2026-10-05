import { ActionButton } from '../../../components/ActionButton'
import type { NotificationMethod } from '../../../domain'
import { useOrderDraft } from '../OrderDraftProvider'

function NotificationOption({ method, selected, onSelect }: { method: NotificationMethod; selected: boolean; onSelect: () => void }) {
  const sms = method === 'sms'
  return <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={`flex h-[248px] min-w-0 flex-1 flex-col items-start gap-[20px] overflow-hidden rounded-[8px] p-[28px] text-left ${selected ? 'border-2 border-order bg-selected' : 'border border-line bg-white'}`}>
    <span className="flex w-full items-start justify-between"><img src={`/assets/${sms ? 'message-square' : 'ticket'}.svg`} width="36" height="36" alt="" />{sms && <span className="rounded-[4px] bg-selected px-[12px] py-[6px] text-[16px] font-bold">추천</span>}</span>
    <span className="text-[28px] font-bold">{sms ? '문자로 알려주세요' : '주문번호로 확인할게요'}</span>
    <span className="text-[19px] text-muted">{sms ? '음식이 준비되면 문자로 알려드려요.' : '문자 없이 주문번호를 직접 확인할게요.'}</span>
  </button>
}
export function NotificationChoice({ onNext }: { onNext: () => void }) {
  const { draft, update } = useOrderDraft()
  return <main className="flex flex-1 flex-col gap-[36px] px-[96px] pt-[56px] pb-[40px]">
    <h1 className="text-[36px] font-bold">알림 방법을 선택해주세요</h1>
    <div className="flex gap-[24px]" role="radiogroup" aria-label="알림 방법">{(['sms', 'orderNumber'] as const).map(method => <NotificationOption key={method} method={method} selected={draft.notificationMethod === method} onSelect={() => update({ notificationMethod: method })} />)}</div>
    <p className="text-center text-[20px] text-muted">문자 알림을 선택하지 않아도 주문할 수 있습니다.</p>
    <div className="flex flex-1 items-end"><ActionButton variant="order" disabled={!draft.notificationMethod} className="w-full" onClick={onNext}>다음</ActionButton></div>
  </main>
}
