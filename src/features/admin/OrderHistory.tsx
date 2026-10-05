import { Fragment, useEffect, useState } from 'react'
import { won, canDeleteOrderHistory, type AdminOrder, type OrderStatus } from '../../domain'
import { ActionButton } from '../../components/ActionButton'
import { Badge, paymentLabels, smsLabels, statusLabels, time } from './components'

export const orderDate = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const dateKey = (value: string) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

export function OrderHistory({ historyOrders, onDetail, onDelete, busy }: { historyOrders: AdminOrder[]; onDetail: (id: string) => void; onDelete: (order: AdminOrder) => void; busy: boolean }) {
  const [date, setDate] = useState('all')
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [date, filter, search])
  const dates = [...new Set(historyOrders.map(order => dateKey(order.createdAt)))].sort().reverse()
  const source = date === 'all' ? historyOrders : historyOrders.filter(order => dateKey(order.createdAt) === date)
  const paid = source.filter(order => order.paymentStatus === 'paid')
  const matching = source.filter(order => (filter === 'all' || order.status === filter) && `${order.number} ${order.productName} ${order.maskedPhone ?? ''}`.toLowerCase().includes(search.trim().replace(/^#/, '').toLowerCase())).sort((a, b) => b.number - a.number)
  const pages = Math.max(1, Math.ceil(matching.length / 20)), current = Math.min(page, pages)
  const shown = matching.slice((current - 1) * 20, current * 20)
  return <main className="flex flex-1 flex-col gap-[24px] bg-[#f7f8fa] px-[28px] py-[24px]">
    <div className="flex items-center justify-between"><div><h2 className="text-[30px] font-bold">전체 주문 이력</h2><p className="mt-[8px] text-[16px] text-muted">주문을 선택하면 처리 이력을 볼 수 있습니다. 수령 완료·취소·만료된 주문은 이력을 삭제할 수 있습니다.</p></div><label className="flex items-center gap-[12px] text-[16px]">주문 날짜<select aria-label="주문 이력 날짜" value={date} onChange={event => setDate(event.target.value)} className="rounded-[8px] border border-line bg-white p-[12px]"><option value="all">전체 날짜</option>{dates.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <div className="grid grid-cols-4 gap-[16px]">{[
      ['전체 주문', `${source.length}건`],
      ['결제 완료 수량', `${paid.reduce((sum, order) => sum + order.quantity, 0)}개`],
      ['결제 확인 금액', won(paid.reduce((sum, order) => sum + order.total, 0))],
      ['수령 완료', `${source.filter(order => order.status === 'completed').length}건`],
    ].map(([label, value]) => <div key={label} className="rounded-[8px] border border-line bg-white p-[20px]"><p className="text-[16px] text-muted">{label}</p><p className="mt-[10px] text-[28px] font-bold">{value}</p></div>)}</div>
    <p className="text-[15px] text-muted">결제 확인 금액은 현장 결제 완료로 처리한 주문의 합계입니다. 환불 필요·환불 완료 주문은 제외합니다. 삭제한 주문은 집계에서도 제외됩니다.</p>
    <div className="flex flex-wrap items-center gap-[12px]"><label className="flex-1"><span className="sr-only">주문번호 또는 마스킹 연락처 검색</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="주문번호 또는 마스킹 연락처 검색" className="h-[48px] w-full rounded-[8px] border border-line bg-white px-[16px] text-[18px]"/></label><label className="flex items-center gap-[12px] text-[16px]">주문 상태<select aria-label="주문 상태 필터" value={filter} onChange={event => setFilter(event.target.value as OrderStatus | 'all')} className="h-[48px] rounded-[8px] border border-line bg-white px-[16px]"><option value="all">전체 상태</option>{Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label><span className="text-[16px] text-muted">{matching.length}건</span></div>
    <div className="overflow-x-auto rounded-[8px] border border-line bg-white"><table className="w-full min-w-[1120px] text-left text-[16px]"><thead className="bg-disabled text-muted"><tr>{['주문번호', '상품 · 수량 / 금액', '주문 · 수령 시각', '상태 / 결제', '연락처', '문자', '상세 / 삭제'].map(label => <th key={label} className="px-[16px] py-[16px] font-bold">{label}</th>)}</tr></thead><tbody>{shown.map((order, index) => {
      const completed = order.history.find(event => event.label === '수령 완료')
      return <Fragment key={order.id}>{(index === 0 || dateKey(shown[index - 1].createdAt) !== dateKey(order.createdAt)) && <tr className="border-t border-line bg-disabled"><th colSpan={7} scope="rowgroup" className="px-[16px] py-[12px] font-bold">{dateKey(order.createdAt)}</th></tr>}<tr className="border-t border-line hover:bg-[#fff9f4]"><td className="px-[16px] py-[20px]"><button aria-label={`${order.number}번 주문 이력 상세`} onClick={() => onDetail(order.id)} className="text-[26px] font-bold text-order">#{order.number}</button></td><td className="px-[16px] py-[20px]"><p>{order.productName} × {order.quantity}</p><p className="mt-[6px] font-bold">{won(order.total)}</p></td><td className="px-[16px] py-[20px]"><p>주문 {orderDate(order.createdAt)}</p><p className="mt-[6px] text-muted">{completed ? `수령 ${time(completed.at)}` : `최근 ${time(order.updatedAt)}`}</p></td><td className="px-[16px] py-[20px]"><Badge warning={['cancelled', 'expired'].includes(order.status)}>{statusLabels[order.status]}</Badge><p className="mt-[10px] text-muted">{paymentLabels[order.paymentStatus]}</p></td><td className="px-[16px] py-[20px]">{order.maskedPhone ?? '—'}</td><td className="px-[16px] py-[20px]">{smsLabels[order.smsStatus]}</td><td className="px-[16px] py-[20px]"><button aria-label={`${order.number}번 처리 이력 보기`} onClick={() => onDetail(order.id)} className="font-bold underline">보기</button>{canDeleteOrderHistory(order)&&<button type="button" aria-label={`${order.number}번 주문 이력 삭제`} disabled={busy} onClick={()=>onDelete(order)} className="mt-[12px] block rounded-[6px] border border-error px-[12px] py-[8px] font-bold text-error disabled:opacity-40">이력 삭제</button>}</td></tr></Fragment>
    })}</tbody></table>{!shown.length && <p className="p-[48px] text-center text-[18px] text-muted">조건에 맞는 주문이 없습니다.</p>}</div>
    <div className="flex items-center justify-between"><p className="text-[16px] text-muted">{current} / {pages} 페이지 · 최신 주문부터 표시</p><div className="flex gap-[12px]"><ActionButton height={48} variant="secondary" className="w-[100px]" disabled={current === 1} onClick={() => setPage(current - 1)}>이전</ActionButton><ActionButton height={48} variant="secondary" className="w-[100px]" disabled={current === pages} onClick={() => setPage(current + 1)}>다음</ActionButton></div></div>
  </main>
}
