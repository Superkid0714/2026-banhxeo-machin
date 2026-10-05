import { useState } from 'react'
import { FrameLayout } from '../components/layout/FrameLayout'
import { BoothIdentity } from '../components/layout/BoothIdentity'
import { FestivalInfo } from '../components/layout/FestivalInfo'
import { ActionButton } from '../components/ActionButton'
import { NumberPad } from '../features/checkout/components/NumberPad'
import type { Availability, Order } from '../domain'
export function ReservationPage({availability,onHome,onBack,onAccepted}:{availability:Availability;onHome:()=>void;onBack:()=>void;onAccepted:(id:string)=>void}) {
  const [number,setNumber]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const unavailable=availability!=='available'
  const changeNumber=(value:string)=>{setNumber(value);setError('')}
  const lookup=async()=>{
    if(busy||!number||unavailable)return
    setBusy(true);setError('')
    try {
      const response=await fetch('/api/reservations/check-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pickupCode:number}),cache:'no-store',signal:AbortSignal.timeout(15000)})
      if(response.ok){const order=await response.json() as Order;onAccepted(order.id)}
      else if(response.status===409||response.status===410){
        const result=await response.json() as {error:string}
        setError(({RESERVATION_UNPAID:'아직 입금이 확인되지 않았어요. 부스 직원에게 문의해주세요.',RESERVATION_WRONG_DATE:'오늘 수령하는 예약이 아닙니다. 예약한 수령일을 확인해주세요.',SOLD_OUT:'주문 접수를 잠시 중단했습니다. 잠시 후 다시 시도해주세요.',OPERATION_ENDED:'부스 운영이 종료되었습니다. 직원에게 문의해주세요.',ORDER_DELETED:'이미 처리된 예약입니다. 부스 직원에게 문의해주세요.'} as Record<string,string>)[result.error]??'접수할 수 없습니다. 부스 직원에게 문의해주세요.')
      }
      else if(response.status===404)setError('예약 내역을 찾을 수 없어요. 수령코드를 확인하고 다시 입력해주세요.')
      else if(response.status===429)setError('조회 요청이 많습니다. 잠시 후 다시 시도해주세요.')
      else if(response.status===503)setError('예약 조회를 이용할 수 없습니다. 문자로 받은 예약 확인 링크를 열거나 부스 직원에게 문의해주세요.')
      else setError('예약 접수에 실패했습니다. 같은 코드를 다시 입력해주세요.')
    }catch{setError('접수 결과를 확인하지 못했습니다. 같은 코드를 다시 입력하면 기존 주문을 확인할 수 있어요.')}
    finally{setBusy(false)}
  }
  return <FrameLayout frame="44:1285"><header className="flex h-[72px] items-center justify-between border-b border-line bg-white px-[40px]"><div className="flex items-center gap-[12px]"><ActionButton variant="secondary" height={48} aria-label="이전 단계" disabled={busy} onClick={onBack}>←</ActionButton><BoothIdentity/></div><p className="text-[18px] font-bold">사전 예약 수령</p></header><FestivalInfo/>
    <main className="flex flex-1 gap-[64px] px-[64px] py-[48px]"><div className="flex min-w-0 flex-1 flex-col gap-[24px]"><div className="flex flex-col gap-[12px]"><p className="text-[14px] font-bold text-muted">사전 예약 · 번호 입력</p><h1 className="text-[34px] font-bold leading-[1.3]">수령코드로 주문을 접수할게요</h1><p className="text-[20px] leading-[1.5] text-muted">사전 예약 시 받은 수령코드를 입력해주세요.</p></div><label className="flex flex-col gap-[8px] border-b border-line py-[16px] text-[16px] text-muted">수령코드<input inputMode="numeric" autoComplete="off" maxLength={12} value={number} disabled={busy} onChange={event=>changeNumber(event.target.value.replace(/\D/g,''))} onKeyDown={event=>{if(event.key==='Enter')void lookup()}} className="w-full bg-transparent text-[64px] font-bold leading-[1.2] text-ink outline-none"/></label><p className="text-[16px] leading-[1.5] text-muted">접수하면 예약 수량 그대로 조리 대기 목록에 들어갑니다.</p>{unavailable&&<p role="status" className="text-[18px] text-muted">주문 접수를 잠시 중단했습니다.</p>}{error&&<p role="alert" className="rounded-[8px] border border-line bg-white p-[16px] text-[18px] leading-[1.5] text-muted">{error}</p>}<div className="flex flex-1 flex-col justify-end gap-[12px]"><ActionButton variant="order" className="w-full !text-[22px]" disabled={busy||!number||unavailable} onClick={()=>{void lookup()}}>{busy?'예약 접수 중…':'예약 주문 접수하기'}</ActionButton><ActionButton variant="secondary" height={64} className="w-full !text-muted" disabled={busy} onClick={onHome}>처음 화면으로</ActionButton></div></div><div className="flex w-[432px] flex-col justify-center gap-[20px]"><fieldset disabled={busy}><NumberPad onDigit={digit=>changeNumber((number+digit).slice(0,12))} onDelete={()=>changeNumber(number.slice(0,-1))} onDone={()=>changeNumber('')} doneLabel="전체 지우기"/></fieldset><p className="text-center text-[16px] text-muted">받으신 수령코드의 숫자를 입력해주세요.</p></div></main>
  </FrameLayout>
}
