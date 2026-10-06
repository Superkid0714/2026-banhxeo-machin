import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WaitTimeEstimator } from '../server/waitTimeModel.ts'
import type { AdminOrder } from '../src/domain.ts'
import { OrderStore } from '../server/orderStore.ts'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type TimingOrder = Pick<AdminOrder,'id'|'number'|'quantity'|'status'|'createdAt'|'pickupReady'|'history'>
const minute = 60000, epoch = Date.parse('2026-10-07T08:30:00Z')
const timing = (number:number, start:number, duration:number|null, quantity=1):TimingOrder => ({
  id:`order-${number}`,number,quantity,status:duration === null ? 'paymentPending' : 'completed',createdAt:new Date(start).toISOString(),pickupReady:duration !== null,
  history:[{at:new Date(start+minute).toISOString(),label:'결제 확인 / 조리중',actor:'admin'},...(duration === null ? [] : [{at:new Date(start+duration*minute).toISOString(),label:'수령 완료',actor:'admin'}])],
})
function history() {
  const orders:TimingOrder[]=[]
  for(let i=0;i<30;i++) {
    const start=epoch+i*5*minute,quantity=1+i%3
    const ahead=orders.filter(order=>Date.parse(order.history.at(-1)!.at)>start).reduce((sum,order)=>sum+order.quantity,0)
    orders.push(timing(i+1,start,4+ahead+quantity*2,quantity))
  }
  return orders
}

test('insufficient data does not invent a wait, and training uses receipt to first preparation',()=>{
  const orders=[timing(1,epoch,10),timing(2,epoch+20*minute,20)]
  const estimator=new WaitTimeEstimator()
  assert.equal(estimator.snapshot(orders,[],epoch+50*minute).newOrder,null)
  const third=timing(3,epoch+40*minute,15)
  third.history.unshift({at:new Date(epoch+45*minute).toISOString(),label:'조리 완료 / 픽업 안내',actor:'admin'})
  third.history.push({at:new Date(epoch+100*minute).toISOString(),label:'문자 재안내 요청',actor:'admin'})
  const model=estimator.snapshot([...orders,third],[],epoch+110*minute)
  assert.equal(model.sampleCount,3)
  assert.equal(model.status,'learning')
  assert.equal(model.lastCompletedAt,new Date(epoch+45*minute).toISOString())
})

test('queued units increase the new-order wait; later orders do not delay earlier orders',()=>{
  const orders=history(),now=epoch+180*minute,estimator=new WaitTimeEstimator()
  const empty=estimator.snapshot(orders,[],now)
  assert.equal(empty.status,'trained');assert.ok(empty.validationCount>0)
  assert.ok(empty.validationMaeMinutes!==null)
  const first=timing(100,now,null),later=timing(101,now+minute,null,5)
  const initial=estimator.snapshot([...orders,first],[first],now)
  const queued=estimator.snapshot([...orders,first,later],[first,later],now+minute)
  assert.equal(queued.queueOrders,2);assert.equal(queued.queueUnits,6)
  assert.ok(queued.newOrder!.upperMinutes>=empty.newOrder!.upperMinutes)
  assert.equal(queued.orders[first.id].estimatedReadyAt,initial.orders[first.id].estimatedReadyAt)
  assert.ok(Date.parse(queued.orders[later.id].estimatedReadyAt)>Date.parse(queued.orders[first.id].estimatedReadyAt))
})

test('new completion feedback retrains the model and a fresh instance reproduces predictions',()=>{
  const orders=history(),now=epoch+180*minute,estimator=new WaitTimeEstimator()
  const before=estimator.snapshot(orders,[],now)
  const slower=timing(100,now,30)
  const after=estimator.snapshot([...orders,slower],[],now+31*minute)
  assert.equal(after.sampleCount,before.sampleCount+1)
  assert.ok(after.newOrder!.upperMinutes>before.newOrder!.upperMinutes)
  assert.deepEqual(new WaitTimeEstimator().snapshot([...orders,slower],[],now+31*minute),after)
})

test('unpaid overdue orders stay visible; prepared and cancelled orders leave the queue',()=>{
  const orders=history(),now=epoch+240*minute
  const overdue=timing(100,epoch+180*minute,null),ready={...timing(101,now,null),status:'cooking' as const,pickupReady:true},cancelled={...timing(102,now,null),status:'cancelled' as const}
  const model=new WaitTimeEstimator().snapshot([...orders,overdue,ready,cancelled],[overdue,ready,cancelled],now)
  assert.equal(model.queueOrders,1);assert.equal(model.orders[overdue.id].overdue,true)
  assert.equal(model.orders[ready.id],undefined);assert.equal(model.orders[cancelled.id],undefined)
})

test('instant clicks, reversed clocks and future completions do not train the model',()=>{
  const orders=[timing(1,epoch,.1),timing(2,epoch,-1),timing(3,epoch,10),timing(4,epoch,200),timing(5,epoch+100*minute,10)]
  const model=new WaitTimeEstimator().snapshot(orders,[],epoch+50*minute)
  assert.equal(model.sampleCount,1);assert.equal(model.newOrder,null)
  assert.equal(model.validationMaeMinutes,null)
})

test('receipt forecasts stay private, measure actual outcomes and survive restart',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-wait-')),file=join(dir,'orders.sqlite'),key='cd'.repeat(32)
  let now=epoch,store=new OrderStore(file,()=>now,key)
  try {
    for(let i=0;i<4;i++) {
      const payload={requestId:randomUUID(),productId:'banh-xeo',expectedUnitPrice:6000,quantity:2,notificationMethod:'orderNumber' as const,phone:'01000000000',consent:true}
      let order=store.create(payload,JSON.stringify(payload)).order
      assert.equal('waitQuote' in order,false)
      assert.equal('waitQuote' in store.snapshot().orders[0],false)
      now+=minute
      order=store.action(order.id,'pay',order.version,false,'test')
      now+=(i===3?18:9)*minute
      store.action(order.id,'complete',order.version,false,'test')
      now+=10*minute
    }
    const before=store.snapshot().waitTimes
    assert.equal(before.liveValidationCount,1)
    assert.ok(before.liveMaeMinutes!==null&&before.liveMaeMinutes>0)
    assert.ok(before.newOrder!.estimatedMinutes>0)
    store.close();store=new OrderStore(file,()=>now,key)
    assert.deepEqual(store.snapshot().waitTimes,before)
  }finally{store.close();rmSync(dir,{recursive:true,force:true})}
})
