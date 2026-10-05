import type { Availability } from '../domain'
import { PRODUCT, won } from '../domain'
import { frames } from '../design/figmaFrameMap'
import { useOrderDraft } from '../features/checkout/OrderDraftProvider'
import { FrameLayout } from '../components/layout/FrameLayout'
import { HomeHeader } from '../components/layout/HomeHeader'
import { ActionButton } from '../components/ActionButton'
import { QuantityStepper } from '../components/QuantityStepper'

export function OrderHomePage({ availability, onStart, onReservation }: { availability: Availability; onStart: () => void; onReservation: () => void }) {
  const { draft, update } = useOrderDraft()
  const unavailable = availability !== 'available'
  const total = won(PRODUCT.unitPrice * draft.quantity)
  return <FrameLayout frame={unavailable ? frames.home.unavailable : frames.home.available}>
    <HomeHeader availability={availability} />
    <main className="flex flex-1 items-stretch gap-[40px] px-[40px] py-[20px]">
      <figure className="relative min-h-[628px] min-w-0 flex-1 overflow-hidden rounded-[12px] bg-[#560909]"><img src="/assets/banhxeo-poster.png" alt={PRODUCT.name} className="absolute h-full w-full object-contain"/>{unavailable&&<div className="absolute inset-0 flex items-center justify-center bg-black/35 text-[64px] font-bold text-white">SOLD OUT</div>}</figure>
      <section aria-labelledby="menu-name" className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-[10px] rounded-[10px] border border-line bg-white px-[20px] py-[16px]"><p className="text-[12px] font-bold text-muted">TODAY'S MENU</p><h1 id="menu-name" className="text-[32px] font-bold">{PRODUCT.name}</h1><p className="text-[16px] leading-[1.5] text-muted">매콤한 불닭과 고소한 치즈를 넣은 바삭한 반쎄오.</p><p className="text-[36px] font-bold">{won(PRODUCT.unitPrice)}</p></div>
        <div className="flex h-[104px] items-center justify-between border border-line bg-white px-[20px] py-[16px]"><p className="text-[20px] font-bold">수량</p><QuantityStepper value={draft.quantity} onChange={quantity => update({ quantity })} disabled={unavailable}/></div>
        <div className="flex h-[77px] items-center justify-between border border-line bg-white px-[20px] py-[16px]"><p className="text-[18px] text-muted">총 주문금액</p><output aria-live="polite" className="text-[36px] font-bold">{total}</output></div>
        <div className="flex flex-1 flex-col justify-end gap-[12px]"><ActionButton variant="order" disabled={unavailable} className="w-full !text-[24px]" onClick={onStart}>{unavailable?'현장 주문을 잠시 받지 않습니다':`주문하기 · ${total}`}</ActionButton><ActionButton variant="secondary" height={48} disabled={unavailable} className="w-full border-2 !text-muted" onClick={onReservation}>사전 예약 주문 접수하기</ActionButton><div className="pt-[8px] text-center text-[13px] text-[#868b94]"><p>결제는 주문 후 부스에서 진행됩니다.</p><p className="mt-[4px] font-bold text-muted">📍 후문 일대 15번 부스 · 17:30 ~ 22:30</p></div></div>
      </section>
    </main>
  </FrameLayout>
}
