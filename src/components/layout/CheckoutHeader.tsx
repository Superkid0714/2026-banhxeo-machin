import { ActionButton } from '../ActionButton'
import { BoothIdentity } from './BoothIdentity'
export function CheckoutHeader({ review, locked, onBack }: { review: boolean; locked: boolean; onBack: () => void }) {
  return <>
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-[40px]">
      <div className="flex items-center gap-[12px] whitespace-nowrap"><ActionButton variant="secondary" height={48} className="w-[56px] px-[8px]" disabled={locked} mutedDisabled={false} onClick={onBack} aria-label="이전 단계">←</ActionButton><BoothIdentity /></div>
      <div className="flex gap-[24px] text-[18px]"><p className="text-muted">1 주문</p><p className={review ? 'text-muted' : 'font-bold'}>2 알림</p><p className={review ? 'font-bold' : 'text-muted'}>3 확인</p></div>
    </header><div aria-hidden="true" className="h-[15px] shrink-0" />
  </>
}
