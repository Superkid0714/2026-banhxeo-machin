export type Availability = 'available' | 'soldOut' | 'paused'
export type CheckoutStep = 'notification' | 'phone' | 'consent' | 'payment'
export type NotificationMethod = 'sms' | 'orderNumber'
export type OrderDraft = { quantity: number; notificationMethod: NotificationMethod | null; phone: string; consent: boolean }
export type SubmissionPayload = Readonly<{ requestId: string; productId: string; expectedUnitPrice: number; quantity: number; notificationMethod: NotificationMethod; phone: string; consent: boolean }>
export type OrderStatus = 'paymentPending' | 'accepted' | 'cooking' | 'ready' | 'completed' | 'cancelled' | 'expired'
export type PaymentStatus = 'unpaid' | 'paid' | 'refundRequired' | 'refunded'
export type SmsStatus = 'notUsed' | 'notConfigured' | 'pending' | 'sending' | 'submitted' | 'sent' | 'failed' | 'unknown'
export type Order = Readonly<{ id: string; number: number; productId: string; productName: string; quantity: number; unitPrice: number; total: number; notificationMethod: NotificationMethod; maskedPhone: string | null; status: OrderStatus; createdAt: string; paymentWindowMinutes: number; reservationId?: number; pickupReady?: boolean; finishedAt?: string }>
export type AdminOrder = Order & { phone?: string | null; phoneLast4?: string | null; version: number; paymentStatus: PaymentStatus; smsStatus: SmsStatus; deadline: string; updatedAt: string; history: { at: string; label: string; actor: string }[] }
export type OperationSettings = { stock: number; stockTracking: boolean; paused: boolean; active: boolean; retentionMinutes: 0 | 10 | 20; sessionId: string; version: number }
export type WaitPrediction = { estimatedMinutes: number; lowerMinutes: number; upperMinutes: number; estimatedReadyAt: string; overdue: boolean }
export type WaitTimeSnapshot = { basis: 'orderCreated'; status: 'insufficient' | 'learning' | 'trained'; sampleCount: number; validationCount: number; validationMaeMinutes: number | null; baselineMaeMinutes: number | null; recencyHalfLifeMinutes: number; liveValidationCount: number; liveMaeMinutes: number | null; lastCompletedAt: string | null; queueOrders: number; queueUnits: number; newOrder: WaitPrediction | null; orders: Record<string, WaitPrediction> }
export type AdminSnapshot = { orders: AdminOrder[]; historyOrders: AdminOrder[]; settings: OperationSettings; smsConfigured: boolean; waitTimes: WaitTimeSnapshot }
export const canDeleteOrderHistory = (order: AdminOrder) => ['completed', 'cancelled', 'expired'].includes(order.status) && order.paymentStatus !== 'refundRequired' && order.smsStatus !== 'sending'
export const PRODUCT = { id: 'banh-xeo', name: '불닭 치즈 반쎄오', unitPrice: 6000 } as const
export const RESERVATION_UNIT_PRICE = 5500
export const emptyDraft = (): OrderDraft => ({ quantity: 1, notificationMethod: null, phone: '', consent: false })
export const validPhone = (phone: string) => /^010\d{8}$/.test(phone)
export const formatPhone = (phone: string) => [phone.slice(0, 3), phone.slice(3, 7), phone.slice(7, 11)].filter(Boolean).join(' - ')
export const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`
export function snapshot(draft: OrderDraft, requestId: string): SubmissionPayload {
  if (!Number.isSafeInteger(draft.quantity) || draft.quantity < 1 || !draft.notificationMethod) throw new Error('Invalid draft')
  if (!validPhone(draft.phone)) throw new Error('Phone is required')
  if (!draft.consent) throw new Error('Privacy consent is required')
  return Object.freeze({ requestId, productId: PRODUCT.id, expectedUnitPrice: PRODUCT.unitPrice, quantity: draft.quantity, notificationMethod: draft.notificationMethod, phone: draft.phone, consent: draft.consent })
}
