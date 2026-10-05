export const FESTIVAL = { name: '2026 전남대학교 용봉대동풀이', dates: '10. 6.(화) ~ 10. 7.(수)', hours: '17:30 ~ 22:30', location: '후문 일대 15번 부스', slogan: '오늘의 기록, 내일의 Nostalgia' }
export function FestivalInfo({ expanded = false }: { expanded?: boolean }) {
  return <div className={`flex shrink-0 items-center border-b border-line bg-white px-[40px] ${expanded ? 'h-[60px] gap-[16px]' : 'h-[44px] gap-[16px]'}`}>
    {([['calendar','운영 기간',FESTIVAL.dates],['clock','운영 시간',FESTIVAL.hours],['map','부스 위치',FESTIVAL.location]] as const).map(([icon,label,value],index)=><div key={icon} className={`flex items-center gap-[8px] ${expanded?'h-full px-[16px]':''} ${expanded&&index===0?'bg-disabled':''}`}><img src={`/assets/festival-${icon}.svg`} width={expanded?18:14} height={expanded?18:14} alt=""/><div>{expanded&&<p className="text-[11px] font-bold text-muted">{label}</p>}<p className={`${expanded?'text-[15px] font-bold':'text-[13px] text-muted'} whitespace-nowrap`}>{value}</p></div></div>)}
    <p className="ml-auto text-[13px] text-[#868b94]">{FESTIVAL.slogan}</p>
  </div>
}
