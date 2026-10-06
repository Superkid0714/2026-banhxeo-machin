import { useEffect, useState } from 'react'
import { won, type Availability, type Order } from '../domain'
import { frames } from '../design/figmaFrameMap'
import { FrameLayout } from '../components/layout/FrameLayout'
import { HomeHeader } from '../components/layout/HomeHeader'
import { ActionButton } from '../components/ActionButton'
import { orderService, OrderApiError } from '../features/orders/orderService'
import { PaymentAccount } from '../features/checkout/components/PaymentAccount'
export function OrderResultPage({ id, availability, onHome, initialOrder }: { id: string; availability: Availability; onHome: () => void; initialOrder: Order | null }) {
  const [order, setOrder] = useState<Order | null>(initialOrder)
  const [removed, setRemoved] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = () => { void orderService.get(id).then(value => { if (active) { setOrder(value); setRemoved(false) } }).catch(error => { if (active && error instanceof OrderApiError && error.status === 404) setRemoved(true) }) }
    refresh()
    const interval = window.setInterval(refresh, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [id]) // Navigation callbacks need not restart the order request.
  if (removed) return <FrameLayout frame={frames.result.sms}><HomeHeader availability={availability} /><main className="flex flex-1 flex-col items-center justify-center gap-[24px] p-[40px]"><h1 role="status" className="text-[36px] font-bold">취소되거나 삭제된 주문입니다</h1><p className="text-[20px] text-muted">확인이 필요하면 부스 직원에게 문의해주세요.</p><ActionButton variant="secondary" className="w-[440px]" onClick={onHome}>처음 화면으로</ActionButton></main></FrameLayout>
  if (!order) return <FrameLayout frame={frames.result.sms}><HomeHeader availability={availability} /><main role="status" className="flex flex-1 items-center justify-center gap-[16px] text-[28px] font-bold"><img src="/assets/loader-circle.svg" width="32" height="32" alt="" className="animate-spin motion-reduce:animate-none" />주문 접수 내역을 확인하고 있어요</main></FrameLayout>
  const paymentPending = order.status === 'paymentPending'
  const stopped = order.status === 'cancelled' || order.status === 'expired'
  const heading = !order.finishedAt && order.pickupReady && ['cooking','completed'].includes(order.status) ? '조리가 완료되었습니다!' : order.reservationId && (order.status==='accepted' || order.status==='cooking') ? '사전 예약 주문 접수 완료!' : { paymentPending: '주문 접수 완료!', accepted: '결제 확인 완료!', cooking: '결제 접수 완료! 조리 중이에요', ready: '음식이 준비되었습니다!', completed: '수령이 완료되었습니다', cancelled: '주문이 취소되었습니다', expired: '결제 시간이 지나 자동취소되었습니다' }[order.status]
  const description = paymentPending ? '주문이 정상적으로 접수되어 주문번호가 발급되었습니다.' : (order.status==='ready'||(order.pickupReady&&!order.finishedAt)) ? '후문 일대 15번 부스에서 주문번호를 보여주고 받아주세요.' : order.status==='completed' ? '이용해 주셔서 감사합니다.' : stopped ? '확인이 필요하면 부스 직원에게 문의해주세요.' : '주문이 접수되어 제작을 진행하고 있습니다. 주문번호로 준비 현황을 확인해주세요.'
  return <FrameLayout frame={frames.result[order.notificationMethod]}>
    <HomeHeader availability={availability} />
    <main className="flex flex-1 flex-col items-center gap-[16px] px-[120px] py-[24px]">
      <div role="status" aria-live="polite" aria-atomic="true" className={`flex w-full flex-col items-center gap-[12px] rounded-[16px] border p-[24px] text-center ${stopped ? 'border-line bg-disabled' : 'border-available bg-available-bg'}`}>
        <span aria-hidden="true" className={`flex h-[56px] w-[56px] items-center justify-center rounded-full text-[36px] font-bold ${stopped ? 'bg-muted text-white' : 'bg-available text-white'}`}>{stopped ? '!' : '✓'}</span>
        <h1 className={`text-[40px] font-bold ${stopped ? 'text-ink' : 'text-available'}`}>{heading}</h1>
        <p className="text-[20px] leading-[1.4]">{description}</p>
        {paymentPending && <p className="rounded-full bg-white px-[20px] py-[8px] text-[18px] font-bold text-muted">주문 접수 완료 · 입금 확인 대기</p>}
      </div>
      <section aria-label="접수된 주문 내역" className="flex w-full items-center gap-[40px] rounded-[16px] border border-line bg-white px-[32px] py-[20px]">
        <div className="flex min-w-[240px] flex-col items-center gap-[4px]"><h2 className="text-[20px] font-bold text-muted">내 주문번호</h2><p className="text-[100px] font-bold leading-[1.1] tabular-nums">{order.number}</p></div>
        <div className="flex flex-1 flex-col gap-[12px] border-l border-line pl-[32px]">
          <p className="text-[20px] font-bold">{order.productName} · {order.quantity}개</p>
          <div className="flex items-center justify-between"><p className="text-[18px] text-muted">총 결제금액</p><p className="text-[30px] font-bold">{won(order.total)}</p></div>
          {!stopped && (order.status !== 'completed' || (order.pickupReady&&!order.finishedAt)) && <p className="text-[18px] leading-[1.4] text-muted">수령할 때 이 주문번호를 보여주세요.{order.notificationMethod === 'sms' && <><br />{order.status === 'ready' ? '문자를 받지 못했어도 주문번호로 수령할 수 있어요.' : paymentPending ? '결제가 확인되면 문자로 알려드려요.' : order.pickupReady ? '픽업 안내 문자를 확인한 후 방문해주세요.' : '조리가 완료되면 한 번 더 문자를 보내드리니 문자를 확인한 후 픽업하러 와주세요 :)'}</>}</p>}
        </div>
      </section>
      {paymentPending && <><PaymentAccount total={order.total} /><p className="text-[18px] font-bold text-muted">이미 입금하셨다면 부스 직원에게 주문번호 {order.number}번을 알려주세요.</p>{order.paymentWindowMinutes > 0 && <p className="text-[18px] text-error">{order.paymentWindowMinutes}분 이내 결제를 완료해주세요.</p>}</>}
      <ActionButton variant="secondary" height={64} className="w-[440px] !bg-disabled !text-[18px]" onClick={onHome}>처음 화면으로</ActionButton>
    </main>
  </FrameLayout>
}
