import type { Availability } from '../domain'
import { PRODUCT, won } from '../domain'
import { frames } from '../design/figmaFrameMap'
import { useOrderDraft } from '../features/checkout/OrderDraftProvider'
import { FrameLayout } from '../components/layout/FrameLayout'
import { HomeHeader } from '../components/layout/HomeHeader'
import { ActionButton } from '../components/ActionButton'
import { QuantityStepper } from '../components/QuantityStepper'

export function OrderHomePage({ availability, onStart }: { availability: Availability; onStart: () => void }) {
  const { draft, update } = useOrderDraft()
  const unavailable = availability !== 'available'
  const total = won(PRODUCT.unitPrice * draft.quantity)
  return <FrameLayout frame={unavailable ? frames.home.unavailable : frames.home.available}>
    <HomeHeader availability={availability} />
    <main className="flex flex-1 items-start gap-[40px] p-[32px]">
      <figure className="flex w-[656px] shrink-0 flex-col gap-[16px]">
        <img src="/assets/banh-xeo.png" alt={PRODUCT.name} width="656" height="596" className="h-[596px] w-[656px] rounded-[8px] object-cover" />
        <figcaption className="text-[16px] text-muted">바삭하게 구워, 따뜻하게 전해드려요.</figcaption>
      </figure>
      <section aria-labelledby="menu-name" className="flex min-w-0 flex-1 self-stretch flex-col gap-[24px]">
        <p className="text-[16px] font-bold text-muted">TODAY'S MENU</p>
        <h1 id="menu-name" className="text-[36px] font-bold">{PRODUCT.name}</h1>
        <p className="text-[32px] font-bold">{won(PRODUCT.unitPrice)}</p>
        <p className="text-[20px] text-muted">매콤한 불닭과 고소한 치즈를 넣은 바삭한 반쎄오.</p>
        {unavailable && <div className="flex flex-col items-start gap-[8px]"><span className="rounded-[4px] bg-disabled px-[12px] py-[6px] text-[16px] font-bold">SOLD OUT</span><p className="text-[19px]">오늘 준비한 수량이 모두 판매되었습니다.</p></div>}
        <div className="flex items-center justify-between"><p className="text-[20px] font-bold">수량</p><QuantityStepper value={draft.quantity} onChange={quantity => update({ quantity })} disabled={unavailable} /></div>
        <div className="h-px shrink-0 bg-line" />
        <div className="flex items-center justify-between"><p className="text-[20px]">총 주문금액</p><output aria-live="polite" className="text-[32px] font-bold">{total}</output></div>
        <div className="flex flex-1 flex-col justify-end gap-[16px]"><ActionButton variant="order" disabled={unavailable} className="w-full" onClick={onStart}>주문하기 · {total}</ActionButton><p className="text-center text-[16px] text-muted">결제는 주문 후 부스에서 진행됩니다.</p></div>
      </section>
    </main>
  </FrameLayout>
}
