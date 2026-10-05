import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'

const base = process.env.TEST_API_URL || 'http://127.0.0.1:5173'
test('server creates an authoritative order and deduplicates the submission key', async () => {
  const payload = { requestId: randomUUID(), productId: 'banh-xeo', expectedUnitPrice: 6000, quantity: 1, notificationMethod: 'orderNumber', phone: '01012345678', consent: true }
  const post = value => fetch(`${base}/api/orders`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(value) })
  const [first, second] = await Promise.all([post(payload), post(payload)])
  assert.ok(first.ok && second.ok)
  const a = await first.json()
  const b = await second.json()
  assert.equal(a.id, b.id)
  assert.equal(a.number, b.number)
  assert.equal(a.total, 6000)
  assert.equal(a.status, 'paymentPending')
  assert.equal(a.maskedPhone, '010-12**-56**')
  const response = await fetch(`${base}/api/orders/${a.id}`)
  assert.deepEqual(await response.json(), a)
  assert.deepEqual(await (await fetch(`${base}/api/submissions/${payload.requestId}`)).json(), a)
  assert.equal((await post({...payload, quantity: 2})).status, 409)
})
test('50 concurrent submissions return the same order; semantic price changes reject creation', async () => {
  const payload = { requestId: randomUUID(), productId: 'banh-xeo', expectedUnitPrice: 6000, quantity: 1, notificationMethod: 'orderNumber', phone: '01012345678', consent: true }
  const post = value => fetch(`${base}/api/orders`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(value) })
  const responses = await Promise.all(Array.from({length:50}, () => post(payload)))
  assert.ok(responses.every(response => response.ok))
  const orders = await Promise.all(responses.map(response => response.json()))
  assert.equal(new Set(orders.map(order => order.id)).size, 1)
  const rejectedKey = randomUUID()
  const rejection = await post({...payload, requestId:rejectedKey, expectedUnitPrice:7000})
  assert.equal(rejection.status,409)
  assert.equal((await rejection.json()).error,'PRICE_CHANGED')
  assert.equal((await fetch(`${base}/api/submissions/${rejectedKey}`)).status,404)
  const next = await (await post({...payload, requestId:randomUUID()})).json()
  assert.equal(next.number,orders[0].number+1)
})
test('server rejects SMS without consent', async () => {
  const response = await fetch(`${base}/api/orders`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({requestId:randomUUID(), productId:'banh-xeo', quantity:1, notificationMethod:'sms', phone:'01012345678', consent:false})})
  assert.equal(response.status, 400)
})
test('order-number orders cannot bypass phone and privacy consent', async () => {
  const post = value => fetch(`${base}/api/orders`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({requestId:randomUUID(), productId:'banh-xeo', expectedUnitPrice:6000, quantity:1, notificationMethod:'orderNumber', ...value})})
  for (const phone of [null, '', '0101234567']) {
    assert.equal((await post({phone,consent:true})).status,400)
  }
  assert.equal((await post({phone:'01012345678',consent:false})).status,400)
})

