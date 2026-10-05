import type { Availability } from '../../domain'
import { BoothIdentity } from './BoothIdentity'
export function HomeHeader({ availability }: { availability: Availability }) {
  const available = availability === 'available'
  return <>
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-[40px]">
      <div className="flex items-center gap-[12px] whitespace-nowrap"><img src="/assets/utensils.svg" width="24" height="24" alt="" /><BoothIdentity /></div>
      <div className={`rounded-[4px] px-[12px] py-[6px] text-[16px] font-bold ${available ? 'bg-available-bg text-available' : 'bg-disabled text-ink'}`}>{available ? '● 주문 가능' : '판매 종료'}</div>
    </header><div aria-hidden="true" className="h-[15px] shrink-0" />
  </>
}
