import type { Availability } from '../../domain'
import { BoothIdentity } from './BoothIdentity'
import { FestivalInfo } from './FestivalInfo'
export function HomeHeader({ availability }: { availability: Availability }) {
  const available = availability === 'available'
  return <>
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line bg-white px-[40px]">
      <div className="flex items-center gap-[12px] whitespace-nowrap"><img src="/assets/utensils.svg" width="24" height="24" alt="" /><BoothIdentity /></div>
      <div className={`rounded-[6px] border border-line bg-disabled px-[16px] py-[8px] text-[16px] font-bold ${available ? 'text-available' : 'text-muted'}`}>{available ? '● 주문 가능' : 'SOLD OUT'}</div>
    </header><FestivalInfo expanded />
  </>
}
