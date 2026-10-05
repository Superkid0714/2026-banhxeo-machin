import { snapshot, type Order, type SubmissionPayload } from '../../domain.ts'

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const key = 'order-submission-v1'
type Record = { pending: SubmissionPayload | null; completed: Order | null }
export function submissionJournal(storage: StoragePort) {
  const read = (): Record => {
    const raw = storage.getItem(key)
    if (!raw) return { pending: null, completed: null }
    const value = JSON.parse(raw) as Record
    if (value.pending) {
      const p = value.pending
      if (!/^[0-9a-f-]{36}$/i.test(p.requestId) || !Number.isSafeInteger(p.expectedUnitPrice) || p.expectedUnitPrice < 1) throw new Error('Invalid submission journal')
      const validated = snapshot({ quantity: p.quantity, notificationMethod: p.notificationMethod, phone: p.phone ?? '', consent: p.consent }, p.requestId)
      if (validated.productId !== p.productId || validated.phone !== p.phone || validated.consent !== p.consent) throw new Error('Invalid submission journal')
      return { pending: Object.freeze({ ...validated, expectedUnitPrice: p.expectedUnitPrice }), completed: null }
    }
    return { pending: null, completed: value.completed }
  }
  return {
    read,
    prepare: (payload: SubmissionPayload) => storage.setItem(key, JSON.stringify({ pending: payload, completed: null })),
    complete: (order: Order) => storage.setItem(key, JSON.stringify({ pending: null, completed: order })),
    clear: () => storage.removeItem(key),
  }
}
