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
import { PaymentStep } from '../features/checkout/components/PaymentStep'
export function CheckoutPage({ step, navigation }: { step: CheckoutStep; navigation: Navigation }) {
  const { draft, submission, pending, phoneValid, submit } = useOrderDraft()
  const [errorPhone, setErrorPhone] = useState<string | null>(null)
  const error = errorPhone === draft.phone && !phoneValid
  const go = (next: CheckoutStep) => navigation.navigate(`/checkout?step=${next}`)
  const frame = step === 'notification' ? frames.notification[draft.notificationMethod ?? 'unselected'] : step === 'phone' ? frames.phone[error ? 'invalid' : 'valid'] : frames.consent[draft.consent ? 'checked' : 'unchecked']
  const onSubmit = async () => { await submit() }
  return <FrameLayout frame={frame}>
    <CheckoutHeader payment={step === 'payment'} locked={submission === 'submitting' || pending} onBack={() => step === 'phone' ? navigation.navigate('/') : navigation.back(step === 'payment' ? '/checkout?step=consent' : '/checkout?step=phone')} />
    {step === 'notification' && <NotificationChoice onNext={() => go('phone')} />}
    {step === 'phone' && <PhoneNumberEntry error={error} onValidate={() => setErrorPhone(phoneValid ? null : draft.phone)} onContinue={() => { if (phoneValid) go('consent') }} />}
    {step === 'consent' && <PrivacyConsent onContinue={() => { if (draft.consent) go('payment') }} />}
    {step === 'payment' && <PaymentStep onSubmit={() => { void onSubmit() }} />}
  </FrameLayout>
}
