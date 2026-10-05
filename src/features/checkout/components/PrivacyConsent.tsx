import { ActionButton } from '../../../components/ActionButton'
import { useOrderDraft } from '../OrderDraftProvider'
export function PrivacyConsent({ onContinue }: { onContinue: () => void }) {
  const { draft, update } = useOrderDraft()
  return <main className="flex flex-1 flex-col gap-[24px] px-[120px] pt-[36px] pb-[32px]">
    <h1 className="text-[32px] font-bold">주문을 위해 휴대전화번호를 수집합니다.</h1>
    <dl>{[['수집 항목','휴대전화번호'],['수집 목적','주문 확인 및 준비 완료 문자 안내'],['보유 기간','행사 종료 후 7일'],['안내','휴대전화번호 수집 및 이용에 동의해야 주문할 수 있습니다.']].map(([label,value]) => <div key={label} className="flex h-[64px] items-center gap-[32px] border-b border-line"><dt className="w-[120px] shrink-0 text-[19px] text-muted">{label}</dt><dd className="text-[20px]">{value}</dd></div>)}</dl>
    <label className={`flex h-[80px] shrink-0 cursor-pointer items-center gap-[16px] rounded-[8px] border p-[20px] ${draft.consent ? 'border-order' : 'border-line'}`}>
      <span className="relative size-[32px] shrink-0"><input type="checkbox" checked={draft.consent} onChange={event => update({ consent: event.target.checked })} className={`size-[32px] cursor-pointer appearance-none rounded-[4px] border-2 ${draft.consent ? 'border-order bg-order' : 'border-muted bg-white'}`} />{draft.consent && <img src="/assets/check.svg" width="24" height="24" alt="" className="pointer-events-none absolute top-[4px] left-[4px]" />}</span>
      <span className="text-[20px] font-bold">위 개인정보 수집 및 이용에 동의합니다.</span>
    </label>
    <div className="flex flex-1 flex-col justify-end gap-[16px]"><ActionButton variant="order" className="w-full" disabled={!draft.consent} onClick={onContinue}>동의하고 주문 확인하기</ActionButton></div>
  </main>
}
