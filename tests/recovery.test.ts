import assert from 'node:assert/strict'
import { test } from 'node:test'
import { snapshot, type Order } from '../src/domain.ts'
import { submissionJournal } from '../src/features/checkout/submissionJournal.ts'
import { recoverSubmission } from '../src/features/checkout/recoverSubmission.ts'

const payload = snapshot({quantity:2, notificationMethod:'sms', phone:'01012345678', consent:true},'11111111-1111-4111-8111-111111111111')
const order: Order = {id:'server-id', number:37, productId:'banh-xeo', productName:'불닭 치즈 반쎄오', quantity:2, unitPrice:6000, total:12000, notificationMethod:'sms', maskedPhone:'010-12**-56**', status:'paymentPending', createdAt:'2026-10-02', paymentWindowMinutes:10}
const storage = () => {
  const records = new Map<string,string>()
  return {getItem:(key:string) => records.get(key) ?? null, setItem:(key:string,value:string) => {records.set(key,value)}, removeItem:(key:string) => {records.delete(key)}, records}
}
test('reload restores the identical immutable payload and key, including the displayed price', () => {
  const port = storage()
  submissionJournal(port).prepare(payload)
  const restored = submissionJournal(port).read().pending
  assert.deepEqual(restored,payload)
  assert.equal(Object.isFrozen(restored),true)
})
test('confirmed order replaces the pending raw phone and consent in the journal', () => {
  const port = storage()
  const journal = submissionJournal(port)
  journal.prepare(payload)
  journal.complete(order)
  assert.equal(journal.read().pending,null)
  assert.deepEqual(journal.read().completed,order)
  assert.ok(![...port.records.values()].join('').includes('01012345678'))
})
test('response loss recovery returns the original server order without another POST', async () => {
  let posts = 0
  const result = await recoverSubmission(payload,{findSubmission:async key => {assert.equal(key,payload.requestId); return order}, create:async () => {posts++; return order}})
  assert.equal(result.id,order.id)
  assert.equal(posts,0)
})
test('lookup outage never creates another order; confirmed absence retries the identical payload', async () => {
  let posts = 0
  const create = async (value:typeof payload) => {posts++; assert.equal(value,payload); return order}
  await assert.rejects(recoverSubmission(payload,{findSubmission:async () => {throw new Error('offline')},create}))
  assert.equal(posts,0)
  await recoverSubmission(payload,{findSubmission:async () => null,create})
  assert.equal(posts,1)
})
