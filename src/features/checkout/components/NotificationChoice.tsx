import { ActionButton } from '../../../components/ActionButton'
import { useOrderDraft } from '../OrderDraftProvider'
export function NotificationChoice({ onNext }: { onNext: () => void }) {
  const { update } = useOrderDraft()
  return <main className="flex flex-1 flex-col gap-[36px] px-[96px] pt-[56px] pb-[40px]">
    <h1 className="text-[36px] font-bold">음식이 준비되면 문자로 알려드려요</h1>
    <p className="text-[20px] text-muted">준비 완료 안내를 받을 휴대전화번호를 입력해주세요.</p>
    <div className="flex flex-1 items-end"><ActionButton variant="order" className="w-full" onClick={() => { update({ notificationMethod: 'sms' }); onNext() }}>휴대전화번호 입력하기</ActionButton></div>
  </main>
}
