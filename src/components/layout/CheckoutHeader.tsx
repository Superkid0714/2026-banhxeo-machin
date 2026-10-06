import { ActionButton } from '../ActionButton'
import { BoothIdentity } from './BoothIdentity'
import { FestivalInfo } from './FestivalInfo'
export function CheckoutHeader({ payment = false, locked, onBack }: { payment?: boolean; locked: boolean; onBack: () => void }) {
  return <>
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line bg-white px-[40px]">
      <div className="flex items-center gap-[12px] whitespace-nowrap"><ActionButton variant="secondary" height={48} className="w-[56px] px-[8px]" disabled={locked} mutedDisabled={false} onClick={onBack} aria-label="이전 단계">←</ActionButton><BoothIdentity /></div>
      <div className="flex gap-[24px] text-[18px]"><p className="text-muted">주문</p><p className={payment ? 'text-muted' : 'font-bold'}>전화번호 · 개인정보 동의</p><p className={payment ? 'font-bold' : 'text-muted'}>입금 안내</p></div>
    </header><FestivalInfo />
  </>
}
