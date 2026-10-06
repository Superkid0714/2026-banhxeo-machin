import type { WaitPrediction, WaitTimeSnapshot } from '../../domain'

export const waitLabel = (prediction: WaitPrediction) => `약 ${prediction.estimatedMinutes <= 5 ? prediction.estimatedMinutes : Math.round(prediction.estimatedMinutes / 5) * 5}분`

export function WaitTimesPanel({model,active,disconnected}:{model:WaitTimeSnapshot;active:boolean;disconnected:boolean}) {
  return <section aria-label="예상 대기시간" className="border-b border-line bg-[#fff9f4] px-[28px] py-[14px]">
    <p className="text-[22px] font-bold">{disconnected ? '예상 대기시간 확인 중' : !active ? '운영 종료' : model.newOrder ? `지금 주문하면 ${waitLabel(model.newOrder)}` : '예상 대기시간 계산 중'}</p>
  </section>
}
