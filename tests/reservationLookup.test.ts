import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lookupReservation } from '../server/reservationLookup.ts'

test('reservation lookup uses the server key and preserves leading zeros', async () => {
  const previous = process.env.ORDER_API_KEY
  process.env.ORDER_API_KEY = 'test-server-secret'
  try {
    const reservation = { reservationId: 1, quantity: 2, pickupDate: '2026-10-06', paymentConfirmed: true }
    const result = await lookupReservation('001234', (async (url, options) => {
      assert.equal(url, 'https://reservation-production-6599.up.railway.app/api/v1/orders/reservations/lookup')
      assert.equal(options?.method, 'POST')
      assert.deepEqual(options?.headers, { Authorization: 'Bearer test-server-secret', 'Content-Type': 'application/json' })
      assert.deepEqual(JSON.parse(options?.body as string), { pickupCode: '001234' })
      assert.equal(options?.redirect, 'error')
      assert.ok(options?.signal)
      return Response.json({ ...reservation, phone: 'private phone', accessToken: 'private token' })
    }) as typeof fetch)
    assert.deepEqual(result, { status: 200, value: reservation })
    for (const status of [401, 403, 500]) {
      const result = await lookupReservation('123456', (async () => Response.json({ error: 'private upstream details' }, { status })) as typeof fetch)
      assert.deepEqual(result, { status: 502, value: { error: 'RESERVATION_LOOKUP_UNAVAILABLE' } })
    }
    assert.equal((await lookupReservation('123456', (async () => Response.json({}, { status: 404 })) as typeof fetch)).status, 404)
    assert.equal((await lookupReservation('123456', (async () => { throw new Error('timeout') }) as typeof fetch)).status, 502)
    assert.equal((await lookupReservation('123456', (async () => new Response('not json')) as typeof fetch)).status, 502)
    assert.equal((await lookupReservation('123456', (async () => Response.json({ quantity: 1 })) as typeof fetch)).status, 502)
    assert.equal((await lookupReservation('../orders')).status, 400)
    delete process.env.ORDER_API_KEY
    assert.equal((await lookupReservation('123456')).status, 503)
  } finally {
    if (previous === undefined) delete process.env.ORDER_API_KEY
    else process.env.ORDER_API_KEY = previous
  }
})
