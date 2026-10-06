import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OrderStore, StoreError } from '../server/orderStore.ts'
import { createOrderMiddleware } from '../server/orderApi.ts'
import type { Reservation } from '../server/reservationLookup.ts'

const now = Date.parse('2026-10-06T09:00:00Z')
const reservation: Reservation = {reservationId: 12, quantity: 3, pickupDate: '2026-10-06', paymentConfirmed: true}
const rejects = (store:OrderStore, value:Reservation, code:string) => assert.throws(()=>store.checkInReservation(value), (e)=>e instanceof StoreError && e.code===code)

test('arrival creates a paid order at the current time and joins normal cooking flow',()=>{
  const store = new OrderStore(':memory:',()=>now)
  try {
    const {order,created} = store.checkInReservation(reservation)
    assert.equal(created,true)
    assert.equal(order.quantity,3)
    assert.equal(order.total,16500)
    assert.equal(order.status,'cooking')
    assert.equal(order.paymentStatus,'paid')
    assert.equal(order.createdAt,new Date(now).toISOString())
    assert.equal(order.smsStatus,'notUsed')
    assert.equal(order.maskedPhone,null)
    assert.equal(store.snapshot().orders[0].id,order.id)
    let latest = order
    for (const action of ['cook','ready','complete'] as const) latest=store.action(latest.id,action,latest.version,false,'test')
    assert.equal(latest.status,'completed')
    assert.equal(store.checkInReservation(reservation).order.id,order.id)
    assert.equal(store.snapshot().orders.length,1)
  } finally {store.close()}
})

test('paused reservations reject new arrivals and resume without consuming sales stock',()=>{
  const store = new OrderStore(':memory:',()=>now)
  try {
    rejects(store,{...reservation,paymentConfirmed:false},'RESERVATION_UNPAID')
    rejects(store,{...reservation,pickupDate:'2026-10-07'},'RESERVATION_WRONG_DATE')
    rejects(store,{...reservation,quantity:Number.MAX_SAFE_INTEGER},'INVALID_RESERVATION')
    store.settings({version:store.snapshot().settings.version,stockTracking:true,stock:0,paused:true},'test')
    rejects(store,reservation,'SOLD_OUT')
    assert.equal(store.snapshot().orders.length,0)
    store.settings({version:store.snapshot().settings.version,paused:false},'test')
    assert.equal(store.checkInReservation(reservation).created,true)
    assert.equal(store.snapshot().settings.stock,0)
    store.settings({version:store.snapshot().settings.version,paused:true},'test')
    assert.equal(store.checkInReservation(reservation).created,false)
    store.settings({version:store.snapshot().settings.version,operation:'end'},'test')
    rejects(store,{...reservation,reservationId:13},'OPERATION_ENDED')
    assert.equal(store.checkInReservation(reservation).created,false)
  } finally {store.close()}
})

test('pickup dates use Korea time at midnight',()=>{
  const store=new OrderStore(':memory:',()=>Date.parse('2026-10-05T15:00:00Z'))
  try {assert.equal(store.checkInReservation(reservation).created,true)} finally {store.close()}
})

test('reservation deduplication persists through restarts, new sessions and history deletion',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-reservation-')),file=join(dir,'orders.sqlite'),key='ab'.repeat(32)
  let store=new OrderStore(file,()=>now,key)
  try {
    let order=store.checkInReservation(reservation).order
    store.close();store=new OrderStore(file,()=>now,key)
    assert.equal(store.checkInReservation(reservation).order.id,order.id)
    for(const action of ['cook','ready','complete'] as const) order=store.action(order.id,action,order.version,false,'test')
    store.settings({version:store.snapshot().settings.version,operation:'end'},'test')
    store.settings({version:store.snapshot().settings.version,operation:'start'},'test')
    assert.equal(store.checkInReservation(reservation).order.id,order.id)
    assert.equal(store.snapshot().orders.length,0)
    store.deleteHistory(order.id,order.version,order.number)
    store.close();store=new OrderStore(file,()=>now,key)
    rejects(store,reservation,'ORDER_DELETED')
  } finally {store.close();rmSync(dir,{recursive:true,force:true})}
})

test('check-in API verifies server data and concurrent retries return one order',async()=>{
  const today=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10)
  const middleware=createOrderMiddleware(async code=>code==='001234'
    ? {status:200,value:{...reservation,pickupDate:today}}
    : {status:404,value:{error:'RESERVATION_NOT_FOUND'}})
  const server=createServer((req,res)=>{void middleware(req,res,()=>{res.statusCode=404;res.end()})})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address() as {port:number}
  const base=`http://127.0.0.1:${address.port}`
  const checkIn=(value:unknown)=>fetch(`${base}/api/reservations/check-in`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})
  try {
    // The client cannot override quantity, payment or price.
    const responses=await Promise.all(Array.from({length:4},()=>checkIn({pickupCode:'001234',quantity:99,paymentConfirmed:false,total:1})))
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,200,200,201])
    const orders=await Promise.all(responses.map(r=>r.json()))
    assert.equal(new Set(orders.map(o=>o.id)).size,1)
    assert.equal(orders[0].quantity,3)
    assert.equal(orders[0].total,16500)
    assert.equal(orders[0].status,'cooking')
    assert.equal((await fetch(`${base}/api/orders/${orders[0].id}`)).status,200)
    assert.equal((await checkIn({pickupCode:'missing'})).status,404)
    assert.equal((await checkIn({pickupCode:1234})).status,400)
    const lookup=await fetch(`${base}/api/reservations/001234`)
    assert.equal(lookup.status,200)
    assert.equal((await lookup.json()).quantity,3)
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
