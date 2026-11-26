import { useEffect, useState } from 'react'
import type { Availability } from '../domain'
import { resolveCheckoutStep } from './checkoutStep'
import { useOrderDraft } from '../features/checkout/OrderDraftProvider'
import { orderService } from '../features/orders/orderService'
import { OrderHomePage } from '../pages/OrderHomePage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { ReservationPage } from '../pages/ReservationPage'
import { OrderResultPage } from '../pages/OrderResultPage'
import { useNavigation } from './useNavigation'
export function AppRouter() {
  const { draft, locked, reset, pending, completedOrder, clearCustomer, update } = useOrderDraft()
  const navigation = useNavigation(locked)
  const [availability, setAvailability] = useState<Availability>('available')
  useEffect(() => {
    const refresh = () => { void orderService.availability().then(value => setAvailability(value.availability)).catch(() => {}) }
    refresh()
    const interval = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [])
  const location = new URL(navigation.url, window.location.origin)
  const checkout = location.pathname === '/checkout'
  const requested = location.searchParams.get('step')
  const step = resolveCheckoutStep(requested, draft, pending || Boolean(checkout && completedOrder))
  useEffect(() => {
    if ((checkout || location.pathname === '/usage') && draft.notificationMethod !== 'sms') update({notificationMethod:'sms'})
    if (checkout && completedOrder) {
      reset()
      navigation.navigate('/', true)
    }
    else if (pending && (!checkout || requested !== 'payment')) navigation.navigate('/checkout?step=payment', true)
    else if (location.pathname === '/usage') {
      update({notificationMethod:'sms'})
      navigation.navigate('/checkout?step=phone', true)
    }
    else if (checkout && requested !== step) navigation.navigate(`/checkout?step=${step}`, true)
    else if (location.pathname === '/' && !pending) clearCustomer()
  }, [checkout, requested, step, pending, completedOrder, location.pathname, draft.notificationMethod])
  const result = /^\/orders\/([^/]+)$/.exec(location.pathname)
  const home = () => { reset(); navigation.navigate('/') }
  if (location.pathname === '/usage') return null
  if (location.pathname === '/reservation') return <ReservationPage availability={availability} onHome={home} onBack={() => navigation.back('/')} onAccepted={id=>navigation.navigate(`/orders/${id}`)} />
  if (checkout && completedOrder) return null
  if (checkout) return <CheckoutPage step={step} navigation={navigation} />
  if (result) return <OrderResultPage key={result[1]} id={result[1]} availability={availability} initialOrder={completedOrder?.id === result[1] ? completedOrder : null} onHome={home} />
  return <OrderHomePage availability={availability} onStart={() => { if (completedOrder) reset(draft.quantity); update({notificationMethod:'sms'}); navigation.navigate('/checkout?step=phone') }} onReservation={() => navigation.navigate('/reservation')} />
}
