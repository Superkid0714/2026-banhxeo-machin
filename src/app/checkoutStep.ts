import { validPhone, type CheckoutStep, type OrderDraft } from '../domain.ts'

// Old notification and usage links enter the phone step; review remains a payment alias.
export function resolveCheckoutStep(requested: string | null, draft: Pick<OrderDraft, 'phone' | 'consent'>, recovering = false): CheckoutStep {
  if (recovering) return 'payment'
  const step = requested === 'review' ? 'payment' : requested === 'consent' || requested === 'payment' ? requested : 'phone'
  if (step !== 'phone' && !validPhone(draft.phone)) return 'phone'
  if (step === 'payment' && !draft.consent) return 'consent'
  return step
}
