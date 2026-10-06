import { useEffect, useRef, type PropsWithChildren } from 'react'
import { ActionButton } from '../../components/ActionButton'
import { won, type AdminOrder, type OperationSettings, type OrderStatus, type SmsStatus } from '../../domain'

export const statusLabels: Record<OrderStatus,string> = {paymentPending:'결제확인',accepted:'조리중',cooking:'조리중',ready:'준비 완료',completed:'수령 완료',cancelled:'취소',expired:'자동취소'}
export const smsLabels: Record<SmsStatus,string> = {notUsed:'문자 미사용',notConfigured:'솔라피 연동 필요',pending:'발송 전',sending:'발송 요청 중',submitted:'발송 처리 중',sent:'발송 완료',failed:'발송 실패',unknown:'발송 여부 확인 필요'}
export type AdminView = 'board'|'history'|'refunds'|'expired'|'sms'
export const paymentLabels = {unpaid:'미결제',paid:'결제 완료',refundRequired:'환불 필요',refunded:'환불 완료'}
export const time = (at:string) => new Date(at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false})
export function Badge({warning=false,children}: PropsWithChildren<{warning?:boolean}>) {return <span className={`rounded-[4px] px-[12px] py-[6px] text-[16px] font-bold ${warning?'bg-[#fff8e6] text-[#946200]':'bg-disabled text-ink'}`}>{children}</span>}
export function OperatingBadge({settings}:{settings:OperationSettings}) {return <span className={`shrink-0 rounded-[4px] px-[12px] py-[6px] text-[16px] font-bold ${settings.active?'bg-available-bg text-available':'bg-disabled text-muted'}`}>● {settings.active?'운영 중':'운영 종료'}</span>}
export function AdminHeader({view,settings,orders,clock,onView,onLogout,onToggleSales,busy}:{view:AdminView;settings:OperationSettings;orders:AdminOrder[];clock:number;onView:(view:AdminView)=>void;onLogout:()=>void;onToggleSales:()=>void;busy:boolean}) {
  return <header className="shrink-0 bg-white">
    <div className="flex h-[64px] items-center gap-[16px] border-b border-line px-[28px]"><img src="/assets/utensils.svg" width={22} height={22} alt=""/><h1 className="shrink-0 text-[22px] font-bold"><button type="button" aria-label="반쎄오갱끼데스까 관리자 메인 대시보드로 이동" onClick={()=>onView('board')} className="rounded-[4px] text-left hover:text-order">반쎄오갱끼데스까</button></h1><p className="text-[14px] text-muted">2026 전남대학교 용봉대동풀이</p><span className="rounded-[4px] bg-disabled px-[8px] py-[4px] text-[13px] font-bold text-muted">관리자</span><div className="ml-auto flex items-center gap-[16px]"><OperatingBadge settings={settings}/><p className="text-[20px] font-bold">{time(new Date(clock).toISOString())}</p><ActionButton height={48} variant="secondary" className="!text-[15px]" onClick={()=>onView(view==='board'?'history':'board')}>{view==='board'?'전체 주문 이력':'← 주문 현황'}</ActionButton><button className="text-[14px] text-muted underline" onClick={onLogout}>로그아웃</button></div></div>
    <div className="flex h-[40px] items-center justify-between border-b border-line px-[28px]"><p className="text-[17px] font-bold">불닭 치즈 반쎄오 · 6,000원</p><div className="flex items-center gap-[16px]"><button type="button" onClick={()=>onView('refunds')} className="text-[14px] font-bold text-muted hover:text-order">환불 필요 {orders.filter(o=>o.paymentStatus==='refundRequired').length}건</button><button type="button" onClick={()=>onView('sms')} className="text-[14px] font-bold text-muted hover:text-order">문자 안내</button><p className="text-[14px] text-muted">10. 6.(화) ~ 10. 7.(수)　 |　17:30 ~ 22:30　 |　후문 일대 15번 부스</p></div></div>
    {view==='board'&&<div className="flex h-[104px] items-center justify-between px-[28px]"><div className="flex gap-[24px]">{([['결제확인','paymentPending'],['조리중','cooking'],['수령완료','completed']] as const).map(([label,status])=><div key={status} className="w-[92px]"><p className="text-[13px] font-bold text-muted">{label}</p><p className={`mt-[6px] text-[26px] font-bold ${status==='paymentPending'?'text-order':status==='completed'?'text-available':'text-muted'}`}>{orders.filter(o=>o.status===status||(status==='cooking'&&o.status==='accepted')).length}</p></div>)}</div><div className="flex w-[480px] items-center gap-[24px]"><div className="w-[132px] shrink-0"><p className="text-[12px] text-muted">현장 주문 판매</p><p className={`mt-[6px] text-[14px] font-bold ${settings.paused?'text-muted':'text-available'}`}>{!settings.active?'운영 종료':settings.paused?'SOLD OUT':'판매 중'}</p></div><ActionButton variant="secondary" height={48} className="flex-1 !text-[15px] !text-muted" disabled={busy||!settings.active} onClick={onToggleSales}>{settings.paused?'판매 재개':'SOLD OUT으로 전환'}</ActionButton></div></div>}
  </header>
}
export const nextActions: Partial<Record<OrderStatus,{action:string;label:string}>> = {paymentPending:{action:'pay',label:'결제 확인'},accepted:{action:'complete',label:'수령 완료'},cooking:{action:'complete',label:'수령 완료'},ready:{action:'complete',label:'수령 완료'},completed:{action:'archive',label:'처리 완료 · 내역으로 이동'}}
export const adminPhoneLabel = (order: AdminOrder) => order.phone ? order.phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3') : order.maskedPhone ?? '미등록'
export function AdminPhone({ order }: { order: AdminOrder }) {
  return <span className="mt-[8px] flex w-fit flex-wrap items-center gap-[8px] rounded-[6px] border border-line bg-disabled px-[10px] py-[6px] leading-[1.25] text-ink"><span className="text-[12px] font-medium text-muted">전화번호</span><strong className="text-[20px] font-bold tabular-nums">{adminPhoneLabel(order)}</strong></span>
}
export function PickupResendButton({order,busy,smsConfigured,onAction}:{order:AdminOrder;busy:boolean;smsConfigured:boolean;onAction:(order:AdminOrder,action:string)=>void}) {
  if(order.status!=='completed'||order.finishedAt||order.notificationMethod!=='sms')return null
  const sending=['pending','sending','submitted'].includes(order.smsStatus)
  return <ActionButton height={48} variant="secondary" className="w-full !text-[15px]" disabled={busy||!smsConfigured||sending} aria-label={`${order.number}번 픽업 문자 다시 보내기`} onClick={()=>onAction(order,'resend')}>{sending?'픽업 문자 발송 처리 중':'픽업 문자 다시 보내기'}</ActionButton>
}
export function OrderCard({order,now,busy,smsConfigured,onAction,onDetail}:{order:AdminOrder;now:number;busy:boolean;smsConfigured:boolean;onAction:(order:AdminOrder,action:string)=>void;onDetail:()=>void}) {
  const action=nextActions[order.status]
  const minutes=Math.max(0,Math.floor((now-Date.parse(order.status==='paymentPending'?order.createdAt:order.updatedAt))/60000))
  return <article className={`flex min-h-[246px] shrink-0 flex-col gap-[6px] rounded-[8px] border border-line p-[10px] ${order.status==='completed'?'bg-available-bg':'bg-white'}`}>
    <button aria-label={`${order.number}번 주문 상세, 전화번호 ${adminPhoneLabel(order)}`} onClick={onDetail} className="text-left text-[38px] font-bold leading-[1.0]">#{order.number}{order.status==='ready'&&<span className="ml-[12px] text-[16px] text-available">READY</span>}<AdminPhone order={order} /></button>
    <div className="flex flex-col gap-[4px] text-[14px] leading-[1.25]"><p className="text-[17px] font-bold">{order.quantity}개 · {won(order.total)}</p><p className={minutes>=7&&order.status!=='completed'?'text-[#946200]':'text-muted'}>{order.status==='paymentPending'?`주문 ${minutes}분 전`:order.status==='accepted'?`제작 ${minutes}분째`:order.status==='cooking'?`제작 ${minutes}분째`:order.status==='completed'?`수령 ${time(order.history.find(h=>h.label==='수령 완료')?.at??order.updatedAt)}`:`준비 후 ${minutes}분`}</p><p className={order.paymentStatus==='paid'?'text-available':'text-muted'}>{order.reservationId?'사전 예약 · ':''}{paymentLabels[order.paymentStatus]} · {order.notificationMethod==='sms'?smsLabels[order.smsStatus]:'문자 미사용'}</p></div>
    {action&&<ActionButton height={64} variant="order" className={`w-full !text-[18px] ${order.status==='ready'?'!bg-available':''}`} disabled={busy} aria-label={`${order.number}번 ${action.label}`} onClick={()=>onAction(order,action.action)}>{action.label}</ActionButton>}
    <PickupResendButton order={order} busy={busy} smsConfigured={smsConfigured} onAction={onAction}/>
    {order.status==='paymentPending'&&<ActionButton height={48} variant="secondary" className="w-full !text-[15px] !text-muted" disabled={busy} aria-label={`${order.number}번 취소`} onClick={()=>onAction(order,'cancel')}>취소</ActionButton>}
  </article>
}
export function Dialog({children,onClose,label,drawer=false}:PropsWithChildren<{onClose:()=>void;label:string;drawer?:boolean}>) {
  const ref=useRef<HTMLDivElement>(null)
  const closeRef=useRef(onClose)
  closeRef.current=onClose
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    const first=ref.current?.querySelector<HTMLElement>('button, input, [tabindex="0"]');first?.focus()
    const key=(event:KeyboardEvent)=>{
      const dialogs=document.querySelectorAll('[role="dialog"]')
      if(dialogs[dialogs.length-1]!==ref.current)return
      if(event.key==='Escape'){event.preventDefault();closeRef.current()}
      if(event.key==='Tab'){const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')??[]);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
    }
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus()}
  },[])
  return <div className={`fixed inset-0 z-30 flex bg-black/35 ${drawer?'justify-end':'items-center justify-center'}`} onClick={onClose}><div ref={ref} role="dialog" aria-modal="true" aria-label={label} onClick={e=>e.stopPropagation()} className={drawer?'flex h-full w-[464px] flex-col overflow-y-auto bg-white p-[24px]':'w-[600px] rounded-[8px] bg-white p-[36px]'}>{children}</div></div>
}
