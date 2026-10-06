import { createHmac, randomBytes } from 'node:crypto'
import type { OrderStore } from './orderStore.ts'
import { won } from '../src/domain.ts'

export const smsConfigured = () => Boolean(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && /^\d{8,11}$/.test(process.env.SOLAPI_SENDER_NUMBER ?? ''))
export function solapiAuthorization() {
  const date = new Date().toISOString(), salt = randomBytes(16).toString('hex')
  const signature = createHmac('sha256', process.env.SOLAPI_API_SECRET!).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`
}
export async function processSms(store: OrderStore, transport: typeof fetch = fetch) {
  if (!smsConfigured()) return
  const order = store.claimSms()
  if (order) {
    try {
      const text = order.smsKind === 'payment' ? `[반쎄오갱기데스까]
결제가 정상적으로 접수되었습니다!

주문번호: ${order.number}번
${order.productName} ${order.quantity}개 · ${won(order.total)}
결제를 확인하여 조리를 시작합니다.
조리가 완료되면 한 번 더 문자를 보내드리니 문자를 확인한 후 픽업하러 와주세요 :)

수령 장소: CU 편의점 앞 · 후문 야간부스 15번
수령할 때 부스 직원에게 주문번호를 보여주세요.` : `[반쎄오갱기데스까]
반쎄오 나왔어요!
따끈하고 바삭한 ${order.productName} ${order.quantity}개가 준비됐습니다.

주문번호: ${order.number}번
수령 장소: CU 편의점 앞 · 후문 야간부스 15번
부스 직원에게 주문번호를 보여주세요.

따끈할 때 만나요!`
      const response = await transport('https://api.solapi.com/messages/v4/send-many/detail', { method: 'POST', headers: { Authorization: solapiAuthorization(), 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000), body: JSON.stringify({ messages: [{ to: store.decryptPhone(order), from: process.env.SOLAPI_SENDER_NUMBER, text, customFields: { orderId: order.id, attemptId: order.smsLease } }], showMessageList: true }) })
      if (!response.ok) { store.finishSms(order.id, order.smsLease!, response.status >= 500 ? 'unknown' : 'failed') }
      else {
        const data = await response.json()
        const message = data.messageList?.[0]
        if (data.failedMessageList?.length) store.finishSms(order.id, order.smsLease!, 'failed')
        else if (message?.messageId && data.groupInfo?.groupId && message.statusCode === '2000') store.finishSms(order.id, order.smsLease!, 'submitted', message.messageId, data.groupInfo.groupId)
        else store.finishSms(order.id, order.smsLease!, 'unknown')
      }
    } catch { store.finishSms(order.id, order.smsLease!, 'unknown') }
  }
  for (const pending of store.submittedSms()) {
    if ((pending.smsStartedAt ?? 0) + 600000 < Date.now()) { store.delivery(pending.id, pending.smsMessageId!, 'unknown'); continue }
    try {
      const query = new URLSearchParams({ criteria: 'messageId', cond: 'eq', value: pending.smsMessageId!, limit: '1' })
      const response = await transport(`https://api.solapi.com/messages/v4/list?${query}`, { headers: { Authorization: solapiAuthorization() }, signal: AbortSignal.timeout(10000) })
      if (!response.ok) continue
      const data = await response.json(), message = data.messageList?.[pending.smsMessageId!]
      if (message?.statusCode === '4000') store.delivery(pending.id, pending.smsMessageId!, 'sent')
      else if (message?.status === 'COMPLETE') store.delivery(pending.id, pending.smsMessageId!, 'failed')
    } catch { /* Retain acceptance; never automatically resend an uncertain message. */ }
  }
}
