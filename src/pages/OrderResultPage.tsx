import { useEffect, useState } from 'react'
import { won, type Availability, type Order } from '../domain'
import { frames } from '../design/figmaFrameMap'
import { FrameLayout } from '../components/layout/FrameLayout'
import { HomeHeader } from '../components/layout/HomeHeader'
import { ActionButton } from '../components/ActionButton'
import { orderService } from '../features/orders/orderService'
export function OrderResultPage({ id, availability, onHome, initialOrder }: { id: string; availability: Availability; onHome: () => void; initialOrder: Order | null }) {
  const [order, setOrder] = useState<Order | null>(initialOrder)
  useEffect(() => {
    let active = true
    const refresh = () => { void orderService.get(id).then(value => { if (active) setOrder(value) }).catch(() => { /* Keep the result URL and last server response on transient failure. */ }) }
    refresh()
    const interval = window.setInterval(refresh, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [id]) // Navigation callbacks need not restart the order request.
  if (!order) return null
  const heading = order.reservationId && order.status==='accepted' ? '사전 예약 주문이 접수되었습니다.' : { paymentPending: '주문번호가 발급되었습니다', accepted: '결제가 확인되었습니다.', cooking: '조리 중입니다.', ready: '음식이 준비되었습니다.', completed: '수령이 완료되었습니다.', cancelled: '주문이 취소되었습니다.', expired: '결제 시간이 지나 자동취소되었습니다.' }[order.status]
  return <FrameLayout frame={frames.result[order.notificationMethod]}>
    <HomeHeader availability={availability} />
    <main className="flex flex-1 flex-col items-center gap-[16px] px-[240px] py-[24px]">
      <div className="flex items-center gap-[12px]"><img src="/assets/circle-check.svg" width="32" height="32" alt=""/><h1 className="text-[26px] font-bold">{heading}</h1></div>
      <p className="text-center text-[18px] leading-[1.4] text-muted">{order.status==='paymentPending'?'부스에서 결제해주세요. 결제 확인 후 제작을 시작합니다.':order.status==='ready'?'후문 일대 15번 부스에서 받아주세요.':order.status==='completed'?'이용해 주셔서 감사합니다.':order.status==='cancelled'||order.status==='expired'?'확인이 필요하면 부스 직원에게 문의해주세요.':'주문번호로 준비 현황을 확인해주세요.'}</p>
      <div className="flex flex-col items-center gap-[8px]"><p className="text-[16px] text-muted">주문번호</p><p className="text-[140px] font-bold leading-[1.1]">{order.number}</p></div>
      <div className="flex w-full flex-col gap-[12px] rounded-[12px] border border-line bg-white p-[20px]"><div className="flex items-center justify-between"><p className="text-[18px] text-muted">총 결제금액</p><p className="text-[30px] font-bold">{won(order.total)}</p></div><div className="h-px bg-line"/><p className="text-[16px] text-muted">{order.quantity}개 · {order.productName}</p>{order.status==='paymentPending'&&<p className="text-[16px] text-muted">결제는 카운터에서 도와드리겠습니다</p>}{!['cancelled','expired','completed'].includes(order.status)&&(order.notificationMethod==='sms'||!order.reservationId)&&<p className="text-[18px] leading-[1.4] text-muted">{order.notificationMethod==='sms'?(order.status==='ready'?'문자를 받지 못했어도 주문번호로 수령할 수 있어요.':'준비가 완료되면 문자메세지로 알려드려요'):`준비 현황에서 ${order.number}번을 확인해주세요.`}</p>}{order.status==='paymentPending'&&order.paymentWindowMinutes>0&&<p className="text-[16px] text-muted">{order.paymentWindowMinutes}분 이내 결제를 완료해주세요.</p>}</div>
      <ActionButton variant="secondary" height={64} className="w-[440px] !bg-disabled !text-[18px]" onClick={onHome}>처음 화면으로</ActionButton>
    </main>
  </FrameLayout>
}
