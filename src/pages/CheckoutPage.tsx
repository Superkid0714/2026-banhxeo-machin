import { useState } from 'react'
import type { CheckoutStep } from '../domain'
import type { Navigation } from '../app/useNavigation'
import { frames } from '../design/figmaFrameMap'
import { FrameLayout } from '../components/layout/FrameLayout'
import { CheckoutHeader } from '../components/layout/CheckoutHeader'
import { useOrderDraft } from '../features/checkout/OrderDraftProvider'
import { NotificationChoice } from '../features/checkout/components/NotificationChoice'
import { PhoneNumberEntry } from '../features/checkout/components/PhoneNumberEntry'
import { PrivacyConsent } from '../features/checkout/components/PrivacyConsent'
import { OrderReview } from '../features/checkout/components/OrderReview'
export function CheckoutPage({ step, navigation }: { step: CheckoutStep; navigation: Navigation }) {
  const { draft, submission, pending, phoneValid, submit } = useOrderDraft()
  const [errorPhone, setErrorPhone] = useState<string | null>(null)
  const error = errorPhone === draft.phone && !phoneValid
  const go = (next: CheckoutStep) => navigation.navigate(`/checkout?step=${next}`)
  const frame = step === 'notification' ? frames.notification[draft.notificationMethod ?? 'unselected'] : step === 'phone' ? frames.phone[error ? 'invalid' : 'valid'] : step === 'consent' ? frames.consent[draft.consent ? 'checked' : 'unchecked'] : submission === 'submitting' ? frames.review.submitting : frames.review[draft.notificationMethod ?? 'orderNumber']
  const onSubmit = async () => { const order = await submit(); if (order) navigation.navigate(`/orders/${order.id}`, true) }
  return <FrameLayout frame={frame}>
    <CheckoutHeader review={step === 'review'} locked={submission === 'submitting' || pending} onBack={() => navigation.back(step === 'notification' ? '/' : '/checkout?step=notification')} />
    {step === 'notification' && <NotificationChoice onNext={() => go('phone')} />}
    {step === 'phone' && <PhoneNumberEntry error={error} onValidate={() => setErrorPhone(phoneValid ? null : draft.phone)} onContinue={() => { if (phoneValid) go('consent') }} />}
    {step === 'consent' && <PrivacyConsent onContinue={() => { if (draft.consent) go('review') }} />}
    {step === 'review' && <OrderReview onEditPhone={() => go('phone')} onSubmit={() => { void onSubmit() }} />}
  </FrameLayout>
}
