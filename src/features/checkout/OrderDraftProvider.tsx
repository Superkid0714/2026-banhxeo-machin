import { createContext, useContext, useRef, useState, type PropsWithChildren } from 'react'
import { emptyDraft, snapshot, validPhone, type OrderDraft, type SubmissionPayload } from '../../domain'
import { OrderApiError, orderService } from '../orders/orderService'
import { submissionJournal } from './submissionJournal'
import { recoverSubmission } from './recoverSubmission'
function restore(): OrderDraft {
  try {
    const value = JSON.parse(sessionStorage.getItem('order-draft') || 'null') as OrderDraft | null
    if (value && Number.isSafeInteger(value.quantity) && value.quantity > 0 && ['sms', 'orderNumber', null].includes(value.notificationMethod) && typeof value.phone === 'string' && /^\d{0,11}$/.test(value.phone) && typeof value.consent === 'boolean') return { ...value, notificationMethod: 'sms' }
  } catch { /* Invalid storage starts a new draft. */ }
  return emptyDraft()
}
function persist(draft: OrderDraft) {
  try { sessionStorage.setItem('order-draft', JSON.stringify(draft)) } catch { /* In-memory flow remains usable. */ }
}
function useDraftController() {
  const [journal] = useState(() => submissionJournal(sessionStorage))
  const [initial] = useState(() => journal.read())
  const [draft, setDraft] = useState(() => initial.pending ? { quantity: initial.pending.quantity, notificationMethod: initial.pending.notificationMethod, phone: initial.pending.phone ?? '', consent: initial.pending.consent } : window.location.pathname === '/checkout' && !initial.completed ? restore() : emptyDraft())
  const [completedOrder, setCompletedOrder] = useState(initial.completed)
  const [pending, setPending] = useState(Boolean(initial.pending))
  const [submission, setSubmission] = useState<'idle' | 'submitting' | 'failed'>('idle')
  const draftRef = useRef(draft)
  const locked = useRef(false)
  const payloadRef = useRef<SubmissionPayload | null>(initial.pending)
  const update = (patch: Partial<OrderDraft>) => {
    if (locked.current || payloadRef.current) return
    const next = { ...draftRef.current, ...patch }
    if (!Number.isSafeInteger(next.quantity) || next.quantity < 1) return
    if (patch.phone !== undefined && patch.phone !== draftRef.current.phone) next.consent = false
    draftRef.current = next
    payloadRef.current = null
    setDraft(next)
    setSubmission('idle')
    persist(next)
  }
  const reset = (quantity = 1) => {
    if (locked.current || payloadRef.current) return
    const next = { ...emptyDraft(), quantity }
    draftRef.current = next
    payloadRef.current = null
    setDraft(next)
    setSubmission('idle')
    persist(next)
    journal.clear()
    setCompletedOrder(null)
  }
  const submit = async () => {
    // Synchronous ref guard also blocks clicks before the next React render.
    if (locked.current) return null
    let payload: SubmissionPayload
    try { payload = payloadRef.current ?? snapshot({ ...draftRef.current, notificationMethod: 'sms' }, crypto.randomUUID()) } catch { return null }
    payloadRef.current = payload
    locked.current = true
    setSubmission('submitting')
    try {
      // Persist before any network request. Storage failure must prevent submission.
      setPending(true)
      journal.prepare(payload)
      const order = await recoverSubmission(payload, orderService)
      journal.complete(order)
      sessionStorage.removeItem('order-draft')
      setCompletedOrder(order)
      payloadRef.current = null
      setPending(false)
      draftRef.current = emptyDraft()
      setDraft(draftRef.current)
      locked.current = false
      setSubmission('idle')
      return order
    } catch (error) {
      // These responses definitively reject creation. Unknown outcomes retain the key.
      if (error instanceof OrderApiError && ['PRICE_CHANGED', 'SOLD_OUT', 'Invalid order', 'Invalid SMS consent', 'Unexpected SMS data', 'Phone is required', 'Privacy consent is required'].includes(error.code)) {
        journal.clear()
        payloadRef.current = null
        setPending(false)
      }
      locked.current = false
      setSubmission('failed')
      // Reuse the payload/idempotency key on retry; do not invent error UI.
      return null
    }
  }
  const clearCustomer = () => {
    if (locked.current || payloadRef.current) return
    const next = { ...emptyDraft(), quantity: draftRef.current.quantity }
    draftRef.current = next
    setDraft(next)
    sessionStorage.removeItem('order-draft')
  }
  return { draft, submission, locked, pending, completedOrder, update, reset, clearCustomer, submit, phoneValid: validPhone(draft.phone) }
}
type Controller = ReturnType<typeof useDraftController>
const DraftContext = createContext<Controller | null>(null)
export function OrderDraftProvider({ children }: PropsWithChildren) {
  return <DraftContext.Provider value={useDraftController()}>{children}</DraftContext.Provider>
}
export function useOrderDraft() {
  const value = useContext(DraftContext)
  if (!value) throw new Error('Missing OrderDraftProvider')
  return value
}
