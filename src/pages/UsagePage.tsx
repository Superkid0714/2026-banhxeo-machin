import { useState } from 'react'
import { FrameLayout } from '../components/layout/FrameLayout'
import { BoothIdentity } from '../components/layout/BoothIdentity'
import { FestivalInfo } from '../components/layout/FestivalInfo'
import { ActionButton } from '../components/ActionButton'
export function UsagePage({onBack,onNew}:{onBack:()=>void;onNew:()=>void}) {
  const [choice,setChoice]=useState<'new'|null>(null)
  return <FrameLayout frame={choice==='new'?'4:43068':'4:43036'}>
    <header className="flex h-[72px] items-center justify-between border-b border-line bg-white px-[40px]"><div className="flex items-center gap-[12px]"><ActionButton height={48} variant="secondary" aria-label="이전 단계" onClick={onBack}>←</ActionButton><BoothIdentity/></div><p className="text-[16px] text-muted">① 이용 방식 › <b className="text-order">② 상세 선택</b> › ③ 확인</p></header><FestivalInfo/>
    <main className="flex flex-1 flex-col gap-[28px] px-[96px] pt-[44px] pb-[32px]"><div className="flex flex-col gap-[10px]"><p className="text-[13px] font-bold text-muted">STEP 2 · 이용 방식 선택</p><h1 className="text-[34px] font-bold">이용 방법을 선택해주세요</h1><p className="text-[16px] text-muted">현장 신규 주문을 선택하고 주문을 진행해주세요.</p></div>
      <div role="radiogroup" aria-label="이용 방법" className="flex gap-[20px]"><button role="radio" aria-checked={choice==='new'} onClick={()=>setChoice('new')} className={`flex h-[272px] min-w-0 flex-1 flex-col gap-[16px] rounded-[10px] bg-white p-[28px] text-left ${choice==='new'?'border-2 border-[#e14d00]':'border border-line'}`}><div className="flex w-full justify-between"><img src="/assets/message-square.svg" width={36} height={36} alt=""/>{choice==='new'&&<span className="rounded-[4px] border border-order px-[10px] py-[5px] text-[13px] font-bold text-order">선택됨</span>}</div><div className="flex flex-col gap-[8px]"><h2 className="text-[26px] font-bold">현장 신규 주문</h2><p className="text-[17px] leading-[1.4] text-muted">새 주문을 진행하고, 음식이 준비되면 문자로 알려드려요.</p></div><span className="mt-auto inline-flex min-h-[44px] items-center gap-[8px] self-start rounded-[8px] border border-[#f0b18d] bg-[#fff0e6] px-[16px] py-[8px] text-[17px] font-bold leading-[1.4] text-[#a43d00]"><img src="/assets/message-square.svg" width={20} height={20} alt=""/>준비 완료 문자 안내</span></button></div>
      <div className="flex flex-1 flex-col justify-end"><ActionButton variant="order" className="w-full !text-[22px]" disabled={!choice} onClick={onNew}>현장 주문 계속하기</ActionButton></div>
    </main>
  </FrameLayout>
}
