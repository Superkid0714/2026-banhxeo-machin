import { won } from '../../../domain'

export function PaymentAccount({ total, beforeOrder = false, compact = false }: { total: number; beforeOrder?: boolean; compact?: boolean }) {
  return <section aria-labelledby="payment-account-heading" className="flex w-full flex-col gap-[12px] rounded-[12px] border-2 border-order bg-selected p-[20px]">
    <div className={`flex items-center ${compact ? 'flex-wrap gap-[16px]' : 'gap-[32px]'}`}>
    <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
    <h2 id="payment-account-heading" className="text-[20px] font-bold">{beforeOrder ? '계좌이체 입금 안내' : '다음 단계 · 입금해주세요'}</h2>
    <dl className="flex flex-col gap-[8px]">
      <div className="flex items-center gap-[12px]"><dt className="sr-only">은행</dt><dd className="text-[22px] font-bold">{import.meta.env.VITE_PAYMENT_BANK || '부스 직원에게 문의'}</dd><dt className="border-l border-line pl-[12px] text-[18px] text-muted">예금주</dt><dd className="text-[22px] font-bold">{import.meta.env.VITE_PAYMENT_HOLDER || '현장 확인'}</dd></div>
      <div><dt className="sr-only">계좌번호</dt><dd className={`select-all whitespace-nowrap font-bold tabular-nums tracking-[1px] ${compact ? 'text-[26px]' : 'text-[36px]'}`}>{import.meta.env.VITE_PAYMENT_ACCOUNT || '부스 직원에게 입금 안내를 받아주세요'}</dd></div>
    </dl>
    <p className="text-[18px] leading-[1.4] text-muted">{beforeOrder ? '아래 주문하기 버튼으로 주문을 접수한 뒤' : '위 계좌로'} {beforeOrder && '위 계좌로 '}{won(total)}을 입금해주세요.<br />부스 직원의 입금 확인 후 제작을 시작합니다.</p>
    </div>
    {import.meta.env.VITE_PAYMENT_ACCOUNT && <figure className="flex shrink-0 flex-col items-center gap-[8px] rounded-[12px] border border-line bg-white p-[12px]">
      <img src="/assets/payment-qr.jpg" width="224" height="215" alt="계좌이체 입금용 QR 코드" className={`h-auto ${compact ? 'w-[128px]' : 'w-[224px]'}`} />
      <figcaption className="text-[16px] font-bold">입금 QR · 스캔해주세요</figcaption>
    </figure>}
    </div>
  </section>
}
