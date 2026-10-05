import { RESERVATION_UNIT_PRICE } from '../src/domain.ts'

const lookupUrl = 'https://reservation-production-6599.up.railway.app/api/v1/orders/reservations/lookup'
export type Reservation = { reservationId: number; quantity: number; pickupDate: string; paymentConfirmed: boolean }

export async function lookupReservation(pickupCode: string, request: typeof fetch = fetch): Promise<{ status: 200; value: Reservation } | { status: number; value: { error: string } }> {
  if (!/^\d{1,12}$/.test(pickupCode)) return { status: 400, value: { error: 'INVALID_PICKUP_CODE' } }
  const key = process.env.ORDER_API_KEY
  if (!key) return { status: 503, value: { error: 'RESERVATION_LOOKUP_NOT_CONFIGURED' } }
  try {
    const response = await request(lookupUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickupCode }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    })
    if (response.status === 404) return { status: 404, value: { error: 'RESERVATION_NOT_FOUND' } }
    if (response.status === 429) return { status: 429, value: { error: 'RESERVATION_LOOKUP_RATE_LIMITED' } }
    if (!response.ok) return { status: 502, value: { error: 'RESERVATION_LOOKUP_UNAVAILABLE' } }
    const value = await response.json()
    if (!value || !Number.isSafeInteger(value.reservationId) || value.reservationId < 1 ||
        !Number.isSafeInteger(value.quantity) || value.quantity < 1 || !Number.isSafeInteger(value.quantity * RESERVATION_UNIT_PRICE) ||
        typeof value.pickupDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.pickupDate) ||
        typeof value.paymentConfirmed !== 'boolean') {
      return { status: 502, value: { error: 'RESERVATION_LOOKUP_UNAVAILABLE' } }
    }
    return { status: 200, value: {
      reservationId: value.reservationId, quantity: value.quantity,
      pickupDate: value.pickupDate, paymentConfirmed: value.paymentConfirmed,
    } }
  } catch {
    return { status: 502, value: { error: 'RESERVATION_LOOKUP_UNAVAILABLE' } }
  }
}
