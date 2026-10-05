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
  return <FrameLayout frame={frames.result[order.notificationMethod]}>
    <HomeHeader availability={availability} />
    <main className="flex flex-1 flex-col items-center gap-[12px] px-[240px] py-[24px]">
      <div className="flex items-center gap-[12px]"><img src="/assets/circle-check.svg" width="32" height="32" alt="" /><h1 className="text-[26px] font-bold">주문이 접수되었습니다.</h1></div>
      <p className="text-[20px] text-muted">주문번호</p><p className="text-[144px] font-bold">{order.number}</p><div className="h-px w-full shrink-0 bg-line" />
      <p className="text-[30px] font-bold">부스에서 결제해주세요</p><div className="flex items-center gap-[24px]"><p className="text-[20px] text-muted">총 결제금액</p><p className="text-[32px] font-bold">{won(order.total)}</p></div>
      <p className="text-[18px] text-muted">카드 · 계좌이체 · 현금</p>
      <div className="text-center text-[20px]">{order.notificationMethod === 'sms' ? <><p>준비가 완료되면</p><p>{order.maskedPhone}으로 알려드릴게요.</p></> : <p>준비 현황에서 {order.number}번을 확인해주세요.</p>}</div>
      <div className="flex items-center gap-[10px]"><img src="/assets/clock.svg" width="20" height="20" alt="" /><p className="text-[18px] text-muted">{order.paymentWindowMinutes}분 이내 결제를 완료해주세요.</p></div>
      <ActionButton variant="secondary" height={64} className="w-[400px]" onClick={onHome}>처음 화면으로</ActionButton>
    </main>
  </FrameLayout>
}
