import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDraft, snapshot } from '../src/domain.ts'

test('submission snapshot does not change when the mutable draft changes', () => {
  const draft = { ...emptyDraft(), quantity: 2, notificationMethod: 'sms' as const, phone: '01012345678', consent: true }
  const payload = snapshot(draft, 'test-key')
  draft.quantity = 9
  draft.phone = '01099999999'
  draft.consent = false
  assert.equal(payload.quantity, 2)
  assert.equal(payload.phone, '01012345678')
  assert.equal(payload.consent, true)
  assert.equal(Object.isFrozen(payload), true)
  assert.throws(() => { Object.assign(payload, { quantity: 10 }) }, TypeError)
})
test('SMS cannot be submitted without a valid phone and consent', () => {
  assert.throws(() => snapshot({ ...emptyDraft(), notificationMethod: 'sms', phone: '01012345678' }, 'key'))
  assert.throws(() => snapshot({ ...emptyDraft(), notificationMethod: 'sms', phone: '0101234567', consent: true }, 'key'))
})
test('all orders require a valid phone, even without SMS', () => {
  const payload = snapshot({ quantity: 1, notificationMethod: 'orderNumber', phone: '01012345678', consent: true }, 'key')
  assert.equal(payload.phone, '01012345678')
  assert.throws(() => snapshot({ ...emptyDraft(), notificationMethod: 'orderNumber' }, 'key'))
  assert.throws(() => snapshot({ ...emptyDraft(), notificationMethod: 'orderNumber', phone: '0101234567' }, 'key'))
})
