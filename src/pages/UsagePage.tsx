import { useState } from 'react'
import { FrameLayout } from '../components/layout/FrameLayout'
import { BoothIdentity } from '../components/layout/BoothIdentity'
import { FestivalInfo } from '../components/layout/FestivalInfo'
import { ActionButton } from '../components/ActionButton'
export function UsagePage({onBack,onNew,onReservation}:{onBack:()=>void;onNew:()=>void;onReservation:()=>void}) {
  const [choice,setChoice]=useState<'new'|'reservation'|null>(null)
  return <FrameLayout frame={choice==='new'?'4:43068':choice==='reservation'?'4:43100':'4:43036'}>
    <header className="flex h-[72px] items-center justify-between border-b border-line bg-white px-[40px]"><div className="flex items-center gap-[12px]"><ActionButton height={48} variant="secondary" aria-label="이전 단계" onClick={onBack}>←</ActionButton><BoothIdentity/></div><p className="text-[16px] text-muted">① 이용 방식 › <b className="text-order">② 상세 선택</b> › ③ 확인</p></header><FestivalInfo/>
    <main className="flex flex-1 flex-col gap-[28px] px-[96px] pt-[44px] pb-[32px]"><div className="flex flex-col gap-[10px]"><p className="text-[13px] font-bold text-muted">STEP 2 · 이용 방식 선택</p><h1 className="text-[34px] font-bold">이용 방법을 선택해주세요</h1><p className="text-[16px] text-muted">새로 주문하거나, 수령코드로 사전 예약 주문을 접수할 수 있어요.</p></div>
      <div role="radiogroup" aria-label="이용 방법" className="flex gap-[20px]">{([['new','현장 신규 주문','새 주문을 진행하고, 음식이 준비되면 문자로 알려드려요.','준비 완료 문자 안내','/assets/message-square.svg'],['reservation','사전 예약 주문 접수','수령코드를 입력하면 예약 수량 그대로 조리 대기에 접수돼요.','사전 예약 고객 전용','/assets/festival-ticket.svg']] as const).map(([key,title,description,note,icon])=><button key={key} role="radio" aria-checked={choice===key} onClick={()=>setChoice(key)} className={`flex h-[272px] min-w-0 flex-1 flex-col gap-[16px] rounded-[10px] bg-white p-[28px] text-left ${choice===key?'border-2 border-[#e14d00]':'border border-line'}`}><div className="flex w-full justify-between"><img src={icon} width={36} height={36} alt=""/>{choice===key&&<span className="rounded-[4px] border border-order px-[10px] py-[5px] text-[13px] font-bold text-order">선택됨</span>}</div><div className="flex flex-col gap-[8px]"><h2 className="text-[26px] font-bold">{title}</h2><p className="text-[17px] leading-[1.4] text-muted">{description}</p></div><span className={`mt-auto inline-flex min-h-[44px] items-center gap-[8px] self-start rounded-[8px] border px-[16px] py-[8px] text-[17px] font-bold leading-[1.4] ${key==='new'?'border-[#f0b18d] bg-[#fff0e6] text-[#a43d00]':'border-[#97cbbc] bg-[#e8f6f0] text-[#14624e]'}`}><img src={icon} width={20} height={20} alt=""/>{note}</span></button>)}</div>
      <div className="flex flex-1 flex-col justify-end"><ActionButton variant="order" className="w-full !text-[22px]" disabled={!choice} onClick={()=>choice==='reservation'?onReservation():onNew()}>{choice==='reservation'?'예약번호 입력하기':'현장 주문 계속하기'}</ActionButton></div>
    </main>
  </FrameLayout>
}
