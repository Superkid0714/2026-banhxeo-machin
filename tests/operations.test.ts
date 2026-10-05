import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OrderStore, StoreError } from '../server/orderStore.ts'
import { processSms } from '../server/solapi.ts'
import type { SubmissionPayload } from '../src/domain.ts'

const payload = (quantity=2): SubmissionPayload => ({requestId:randomUUID(),productId:'banh-xeo',expectedUnitPrice:6000,quantity,notificationMethod:'sms',phone:'01000000000',consent:true})
const create = (store:OrderStore,quantity=2) => {const p=payload(quantity);return store.create(p,JSON.stringify(p)).order}
test('history deletion persists, removes customer data and never reuses a number or request',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-delete-')),file=join(dir,'orders.sqlite'),key='ab'.repeat(32)
  const p=payload(),raw=JSON.stringify(p)
  let store=new OrderStore(file,()=>Date.now(),key)
  try {
    let order=store.create(p,raw).order
    assert.throws(()=>store.deleteHistory(order.id,order.version,order.number),(e)=>e instanceof StoreError&&e.code==='ORDER_HISTORY_NOT_DELETABLE')
    order=store.action(order.id,'cancel',order.version,false,'test')
    store.deleteHistory(order.id,order.version,order.number)
    store.close();store=new OrderStore(file,()=>Date.now(),key)
    assert.equal(store.get(order.id),null)
    assert.equal(store.snapshot().historyOrders.length,0)
    assert.throws(()=>store.submission(p.requestId),(e)=>e instanceof StoreError&&e.status===410)
    assert.throws(()=>store.create(p,raw),(e)=>e instanceof StoreError&&e.status===410)
    assert.equal(create(store).number,order.number+1)
  }finally{store.close();rmSync(dir,{recursive:true,force:true})}
})
test('history deletion protects refunds and active sends, but allows completed orders after SMS acceptance',()=>{
  const store=new OrderStore()
  try {
    let order=create(store)
    order=store.action(order.id,'pay',order.version,true,'test')
    order=store.action(order.id,'cancel',order.version,true,'test')
    assert.throws(()=>store.deleteHistory(order.id,order.version,order.number),(e)=>e instanceof StoreError&&e.code==='ORDER_HISTORY_NOT_DELETABLE')
    order=store.action(order.id,'refund',order.version,true,'test')
    store.deleteHistory(order.id,order.version,order.number)
    order=create(store)
    for(const action of ['pay','cook','ready'] as const)order=store.action(order.id,action,order.version,true,'test')
    const claimed=store.claimSms()!
    order=store.action(order.id,'complete',store.get(order.id)!.version,true,'test')
    assert.throws(()=>store.deleteHistory(order.id,order.version,order.number),(e)=>e instanceof StoreError&&e.code==='ORDER_HISTORY_NOT_DELETABLE')
    store.finishSms(order.id,claimed.smsLease!,'submitted','message','group')
    order=store.get(order.id)!
    store.deleteHistory(order.id,order.version,order.number)
    store.delivery(order.id,'message','sent')
    assert.equal(store.get(order.id),null)
  }finally{store.close()}
})
test('manual payment flow retains unpaid orders until staff confirm or cancel',()=>{
  let now=Date.now();const store=new OrderStore(':memory:',()=>now)
  try {
    const order=create(store)
    assert.equal(order.paymentWindowMinutes,0)
    now+=24*60*60*1000;store.expire()
    assert.equal(store.get(order.id)?.status,'paymentPending')
    assert.equal(store.action(order.id,'pay',order.version,false,'test').status,'accepted')
  } finally {store.close()}
})
test('orders persist encrypted across restarts and deduplicate stock reservations',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-store-')),file=join(dir,'orders.sqlite'),key='ab'.repeat(32)
  const p=payload(),raw=JSON.stringify(p)
  let store=new OrderStore(file,()=>Date.now(),key)
  try {
    store.settings({version:store.snapshot().settings.version,stockTracking:true,stock:41},'test')
    const first=store.create(p,raw).order
    assert.equal(store.create(p,raw).created,false)
    assert.equal(store.snapshot().settings.stock,39)
    store.close();store=new OrderStore(file,()=>Date.now(),key)
    assert.equal(store.submission(p.requestId)?.id,first.id)
    let order=store.action(first.id,'pay',first.version,true,'test')
    order=store.action(order.id,'cook',order.version,true,'test')
    store.action(order.id,'ready',order.version,true,'test')
    const claimed=store.claimSms()!
    assert.equal(store.decryptPhone(claimed),p.phone)
    assert.ok(!readFileSync(file).includes(Buffer.from(p.phone)))
    assert.ok(!JSON.stringify(store.snapshot()).includes(p.phone))
  } finally {store.close();rmSync(dir,{recursive:true,force:true})}
})
test('expiry, restoration, cancellations and stale actions keep stock consistent',()=>{
  let now=Date.now();const store=new OrderStore(':memory:',()=>now)
  try {
    store.settings({version:store.snapshot().settings.version,stockTracking:true,stock:41,retentionMinutes:10},'test')
    let order=create(store)
    now+=600001;store.expire();store.expire()
    assert.equal(store.get(order.id)?.status,'expired');assert.equal(store.snapshot().settings.stock,41)
    order=store.action(order.id,'restore',store.get(order.id)!.version,true,'test')
    assert.equal(store.snapshot().settings.stock,39)
    const stale=order.version;order=store.action(order.id,'pay',order.version,true,'test')
    assert.throws(()=>store.action(order.id,'pay',stale,true,'test'),(e)=>e instanceof StoreError&&e.code==='ALREADY_PROCESSED')
    order=store.action(order.id,'cancel',order.version,true,'test')
    assert.equal(order.paymentStatus,'refundRequired');assert.equal(store.snapshot().settings.stock,41)
    assert.equal(store.action(order.id,'refund',order.version,true,'test').paymentStatus,'refunded')
    order=create(store);order=store.action(order.id,'pay',order.version,true,'test');order=store.action(order.id,'cook',order.version,true,'test')
    store.action(order.id,'cancel',order.version,true,'test');assert.equal(store.snapshot().settings.stock,39)
  } finally {store.close()}
})
test('stock limits are optional and cancelling an unlimited order never creates tracked stock',()=>{
  const store=new OrderStore()
  try {
    assert.equal(store.snapshot().settings.stockTracking,false)
    const unlimited=create(store,60)
    assert.equal(store.snapshot().settings.stock,0)
    store.settings({version:store.snapshot().settings.version,stockTracking:true,stock:2},'test')
    store.action(unlimited.id,'cancel',unlimited.version,false,'test')
    assert.equal(store.snapshot().settings.stock,2)
    assert.throws(()=>create(store,3),(e)=>e instanceof StoreError&&e.code==='SOLD_OUT')
    const tracked=create(store,2)
    store.settings({version:store.snapshot().settings.version,stockTracking:false},'test')
    store.action(tracked.id,'cancel',tracked.version,false,'test')
    assert.equal(store.snapshot().settings.stock,2)
    assert.ok(create(store,100))
    store.settings({version:store.snapshot().settings.version,paused:true},'test')
    assert.throws(()=>create(store),(e)=>e instanceof StoreError&&e.code==='SOLD_OUT')
  } finally {store.close()}
})
test('completed orders remain in history after a new operation starts',()=>{
  const store=new OrderStore()
  try {
    let order=create(store)
    for(const action of ['pay','cook','ready','complete'] as const)order=store.action(order.id,action,order.version,false,'test')
    assert.equal(store.snapshot().orders[0].status,'completed')
    store.settings({version:store.snapshot().settings.version,operation:'end'},'test')
    store.settings({version:store.snapshot().settings.version,operation:'start'},'test')
    assert.equal(store.snapshot().orders.length,0)
    assert.equal(store.snapshot().historyOrders[0].id,order.id)
    assert.equal(store.snapshot().historyOrders[0].status,'completed')
    assert.equal(store.get(order.id)?.history.at(-1)?.label,'수령 완료')
  } finally {store.close()}
})
test('legacy database migration preserves orders and disables fixed stock limits only once',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-migration-')),file=join(dir,'orders.sqlite'),key='cd'.repeat(32)
  let store=new OrderStore(file,()=>Date.now(),key)
  try {
    store.settings({version:store.snapshot().settings.version,stockTracking:true,stock:40},'test')
    const order=create(store)
    store.close()
    const legacy=new DatabaseSync(file)
    const state=JSON.parse(legacy.prepare('SELECT value FROM operation_state WHERE id=1').get()!.value as string)
    delete state.settings.stockTracking;for(const o of state.orders)delete o.stockReserved
    legacy.prepare('UPDATE operation_state SET value=? WHERE id=1').run(JSON.stringify(state));legacy.close()
    store=new OrderStore(file,()=>Date.now(),key)
    assert.equal(store.get(order.id)?.id,order.id);assert.equal(store.snapshot().settings.stockTracking,false)
    store.action(order.id,'cancel',order.version,false,'test')
    assert.equal(store.snapshot().settings.stock,40)
    store.settings({version:store.snapshot().settings.version,stockTracking:true},'test')
    store.close();store=new OrderStore(file,()=>Date.now(),key)
    assert.equal(store.snapshot().settings.stockTracking,true)
  } finally {store.close();rmSync(dir,{recursive:true,force:true})}
})
test('SMS submits once after ready, distinguishes provider acceptance from delivery and fences late responses',async()=>{
  const old={...process.env};process.env.SOLAPI_API_KEY='test';process.env.SOLAPI_API_SECRET='test';process.env.SOLAPI_SENDER_NUMBER='01000000000'
  let now=Date.now();const store=new OrderStore(':memory:',()=>now)
  try {
    let order=create(store);assert.equal(store.claimSms(),null)
    order=store.action(order.id,'pay',order.version,true,'test');order=store.action(order.id,'cook',order.version,true,'test');order=store.action(order.id,'ready',order.version,true,'test')
    let posts=0,delivered=false
    const transport:typeof fetch=async(_url,options)=>{
      if(options?.method==='POST'){posts++;assert.match(String((options.headers as Record<string,string>).Authorization),/^HMAC-SHA256/);return Response.json({messageList:[{messageId:'m1',statusCode:'2000'}],groupInfo:{groupId:'g1'},failedMessageList:[]})}
      return Response.json({messageList:{m1:{status:delivered?'COMPLETE':'SENDING',statusCode:delivered?'4000':'2000'}}})
    }
    await processSms(store,transport);assert.equal(store.get(order.id)?.smsStatus,'submitted')
    delivered=true;await processSms(store,transport);assert.equal(store.get(order.id)?.smsStatus,'sent');assert.equal(posts,1)
    order=store.get(order.id)!;store.action(order.id,'resend',order.version,true,'test')
    const claim=store.claimSms()!;now+=60001;store.expire()
    store.finishSms(claim.id,claim.smsLease!,'submitted','late','g1')
    assert.equal(store.get(order.id)?.smsStatus,'unknown')
  } finally {store.close();for(const name of ['SOLAPI_API_KEY','SOLAPI_API_SECRET','SOLAPI_SENDER_NUMBER']){if(old[name]===undefined)delete process.env[name];else process.env[name]=old[name]}}
})
test('an uncertain SMS response does not trigger an automatic second send',async()=>{
  const names=['SOLAPI_API_KEY','SOLAPI_API_SECRET','SOLAPI_SENDER_NUMBER'] as const
  const old=names.map(name=>process.env[name]);process.env.SOLAPI_API_KEY='test';process.env.SOLAPI_API_SECRET='test';process.env.SOLAPI_SENDER_NUMBER='01000000000'
  const store=new OrderStore()
  try {
    let order=create(store);for(const action of ['pay','cook','ready'] as const)order=store.action(order.id,action,order.version,true,'test')
    let attempts=0
    const transport:typeof fetch=async()=>{attempts++;throw new Error('Response lost')}
    await processSms(store,transport);await processSms(store,transport)
    assert.equal(store.get(order.id)?.smsStatus,'unknown');assert.equal(attempts,1)
  } finally {store.close();names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})
