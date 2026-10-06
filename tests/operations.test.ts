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

test('admin snapshots decrypt full phone numbers for persisted orders while customer responses stay masked',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-phone-')),file=join(dir,'orders.sqlite'),key='ab'.repeat(32)
  const p={...payload(),phone:'01012340007'}
  let store=new OrderStore(file,()=>Date.now(),key)
  try {
    const order=store.create(p,JSON.stringify(p)).order
    assert.equal(order.maskedPhone,'010-12**-00**')
    assert.equal(order.phoneLast4,undefined)
    assert.equal(order.phone,undefined)
    store.close();store=new OrderStore(file,()=>Date.now(),key)
    assert.equal(store.snapshot().orders[0].phoneLast4,'0007')
    assert.equal(store.snapshot().historyOrders[0].phoneLast4,'0007')
    assert.equal(store.snapshot().orders[0].phone,p.phone)
    assert.equal(store.snapshot().historyOrders[0].phone,p.phone)
    assert.equal(store.get(order.id)?.phoneLast4,undefined)
    assert.equal(store.submission(p.requestId)?.phoneLast4,undefined)
    assert.equal(store.get(order.id)?.phone,undefined)
    assert.equal(store.submission(p.requestId)?.phone,undefined)
    const persisted=new DatabaseSync(file)
    try { assert.ok(!String(persisted.prepare('SELECT value FROM operation_state WHERE id=1').get()!.value).includes(p.phone)) }
    finally { persisted.close() }
  } finally {store.close();rmSync(dir,{recursive:true,force:true})}
})
test('cancellation removes unpaid and paid orders without a refund queue and fences retries and late SMS responses',()=>{
  for(const actions of [[],['pay'],['pay','cook'],['pay','cook','ready']] as const){
    const store=new OrderStore(),p=payload(),raw=JSON.stringify(p)
    try {
      let order=store.create(p,raw).order
      for(const action of actions)order=store.action(order.id,action,order.version,true,'test')
      const claimed=order.status==='ready'?store.claimSms():null
      order=store.get(order.id)!
      const cancelled=store.action(order.id,'cancel',order.version,true,'test')
      assert.equal(cancelled.status,'cancelled')
      assert.notEqual(cancelled.paymentStatus,'refundRequired')
      assert.equal(store.get(order.id),null)
      assert.equal(store.snapshot().orders.length,0)
      assert.equal(store.snapshot().historyOrders.length,0)
      assert.throws(()=>store.create(p,raw),(e)=>e instanceof StoreError&&e.status===410)
      assert.throws(()=>store.action(order.id,'cancel',order.version,true,'test'),(e)=>e instanceof StoreError&&e.status===404)
      if(claimed)store.finishSms(order.id,claimed.smsLease!,'submitted','late','group')
      assert.equal(store.get(order.id),null)
      assert.equal(create(store).number,order.number+1)
    }finally{store.close()}
  }
})

test('history deletion persists, removes customer data and never reuses a number or request',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-delete-')),file=join(dir,'orders.sqlite'),key='ab'.repeat(32)
  const p=payload(),raw=JSON.stringify(p)
  let store=new OrderStore(file,()=>Date.now(),key)
  try {
    let order=store.create(p,raw).order
    assert.throws(()=>store.deleteHistory(order.id,order.version,order.number),(e)=>e instanceof StoreError&&e.code==='ORDER_HISTORY_NOT_DELETABLE')
    for(const action of ['pay','cook','ready','complete'] as const)order=store.action(order.id,action,order.version,false,'test')
    store.deleteHistory(order.id,order.version,order.number)
    store.close();store=new OrderStore(file,()=>Date.now(),key)
    assert.equal(store.get(order.id),null)
    assert.equal(store.snapshot().historyOrders.length,0)
    assert.throws(()=>store.submission(p.requestId),(e)=>e instanceof StoreError&&e.status===410)
    assert.throws(()=>store.create(p,raw),(e)=>e instanceof StoreError&&e.status===410)
    assert.equal(create(store).number,order.number+1)
  }finally{store.close();rmSync(dir,{recursive:true,force:true})}
})
test('history deletion protects active sends, but allows completed orders after SMS acceptance',()=>{
  const store=new OrderStore()
  try {
    let order=create(store)
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
test('paid orders go directly to production and legacy waiting orders migrate once without losing elapsed time',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-production-')),file=join(dir,'orders.sqlite'),key='ab'.repeat(32)
  let store=new OrderStore(file,()=>Date.now(),key)
  try {
    let order=create(store)
    order=store.action(order.id,'pay',order.version,true,'test')
    assert.equal(order.status,'cooking')
    const updatedAt=order.updatedAt
    store.close()
    const legacy=new DatabaseSync(file)
    const state=JSON.parse(legacy.prepare('SELECT value FROM operation_state WHERE id=1').get()!.value as string)
    state.orders[0].status='accepted'
    legacy.prepare('UPDATE operation_state SET value=? WHERE id=1').run(JSON.stringify(state));legacy.close()
    store=new OrderStore(file,()=>Date.now(),key)
    order=store.get(order.id)!
    assert.equal(order.status,'cooking');assert.equal(order.updatedAt,updatedAt)
    const version=order.version
    store.close();store=new OrderStore(file,()=>Date.now(),key)
    order=store.get(order.id)!
    assert.equal(order.version,version)
    order=store.action(order.id,'ready',order.version,true,'test')
    assert.equal(order.status,'cooking');assert.equal(order.smsStatus,'pending')
  }finally{store.close();rmSync(dir,{recursive:true,force:true})}
})

test('final confirmation removes a completed order from the board but preserves history and pending SMS across restarts',()=>{
  const dir=mkdtempSync(join(tmpdir(),'festival-finished-')),file=join(dir,'orders.sqlite'),key='ab'.repeat(32)
  let store=new OrderStore(file,()=>Date.now(),key)
  try {
    let order=create(store)
    assert.throws(()=>store.action(order.id,'archive',order.version,true,'test'),(e)=>e instanceof StoreError&&e.code==='INVALID_TRANSITION')
    order=store.action(order.id,'pay',order.version,true,'test')
    order=store.action(order.id,'complete',order.version,true,'test')
    assert.equal(store.snapshot().orders.length,1)
    const version=order.version
    order=store.action(order.id,'archive',version,true,'test')
    assert.ok(order.finishedAt)
    assert.equal(store.snapshot().orders.length,0)
    assert.equal(store.snapshot().historyOrders[0].id,order.id)
    assert.throws(()=>store.action(order.id,'archive',version,true,'test'),(e)=>e instanceof StoreError&&e.code==='ALREADY_PROCESSED')
    store.close();store=new OrderStore(file,()=>Date.now(),key)
    assert.equal(store.snapshot().orders.length,0)
    assert.equal(store.snapshot().historyOrders[0].finishedAt,order.finishedAt)
    assert.equal(store.get(order.id)?.status,'completed')
    const claimed=store.claimSms()!
    assert.equal(claimed.id,order.id)
    store.finishSms(order.id,claimed.smsLease!,'submitted','payment','group')
    store.delivery(order.id,'payment','sent')
    assert.equal(store.claimSms()?.smsKind,'ready')
    assert.equal(store.snapshot().orders.length,0)
  }finally{store.close();rmSync(dir,{recursive:true,force:true})}
})

test('manual payment flow retains unpaid orders until staff confirm or cancel',()=>{
  let now=Date.now();const store=new OrderStore(':memory:',()=>now)
  try {
    const order=create(store)
    assert.equal(order.paymentWindowMinutes,0)
    now+=24*60*60*1000;store.expire()
    assert.equal(store.get(order.id)?.status,'paymentPending')
    assert.equal(store.action(order.id,'pay',order.version,false,'test').status,'cooking')
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
    assert.equal(store.snapshot().orders[0].phone,p.phone)
    assert.ok(!JSON.stringify(store.get(first.id)).includes(p.phone))
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
    assert.equal(order.paymentStatus,'paid');assert.equal(store.snapshot().settings.stock,39)
    assert.equal(store.get(order.id),null)
    assert.equal(store.snapshot().historyOrders.length,0)
    order=create(store);order=store.action(order.id,'pay',order.version,true,'test');order=store.action(order.id,'cook',order.version,true,'test')
    store.action(order.id,'cancel',order.version,true,'test');assert.equal(store.snapshot().settings.stock,37)
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
test('payment confirmation SMS submits once on entering cooking, distinguishes delivery and fences late responses',async()=>{
  const old={...process.env};process.env.SOLAPI_API_KEY='test';process.env.SOLAPI_API_SECRET='test';process.env.SOLAPI_SENDER_NUMBER='01000000000'
  let now=Date.now();const store=new OrderStore(':memory:',()=>now)
  try {
    let order=create(store);assert.equal(store.claimSms(),null)
    const unpaidVersion=order.version
    order=store.action(order.id,'pay',order.version,true,'test')
    assert.equal(order.status,'cooking');assert.equal(order.smsStatus,'pending')
    assert.throws(()=>store.action(order.id,'pay',unpaidVersion,true,'test'),(e)=>e instanceof StoreError&&e.code==='ALREADY_PROCESSED')
    let posts=0,delivered=false
    const transport:typeof fetch=async(_url,options)=>{
      if(options?.method==='POST'){posts++;assert.match(String((options.headers as Record<string,string>).Authorization),/^HMAC-SHA256/);const message=JSON.parse(String(options.body)).messages[0];assert.equal(message.to,'01000000000');assert.match(message.text,/결제가 정상적으로 접수되었습니다!/);assert.match(message.text,/12,000원/);assert.match(message.text,/수령 장소: CU 편의점 앞/);assert.match(message.text,new RegExp(`주문번호: ${order.number}번`));assert.doesNotMatch(message.text,/준비됐습니다/);return Response.json({messageList:[{messageId:'m1',statusCode:'2000'}],groupInfo:{groupId:'g1'},failedMessageList:[]})}
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
test('completion queues a second pickup SMS after the payment SMS without adding a status or duplicate sends',async()=>{
  const names=['SOLAPI_API_KEY','SOLAPI_API_SECRET','SOLAPI_SENDER_NUMBER'] as const
  const old=names.map(name=>process.env[name]);process.env.SOLAPI_API_KEY='test';process.env.SOLAPI_API_SECRET='test';process.env.SOLAPI_SENDER_NUMBER='01000000000'
  const store=new OrderStore(),texts:string[]=[]
  try {
    let order=create(store);order=store.action(order.id,'pay',order.version,true,'test')
    const transport:typeof fetch=async(_url,options)=>{
      if(options?.method==='POST'){
        texts.push(JSON.parse(String(options.body)).messages[0].text)
        return Response.json({messageList:[{messageId:`m${texts.length}`,statusCode:'2000'}],groupInfo:{groupId:'g'},failedMessageList:[]})
      }
      return Response.json({messageList:{[`m${texts.length}`]:{status:'COMPLETE',statusCode:'4000'}}})
    }
    order=store.action(order.id,'complete',order.version,true,'test')
    assert.equal(order.status,'completed');assert.equal(order.pickupReady,true)
    assert.throws(()=>store.action(order.id,'complete',order.version,true,'test'),(e)=>e instanceof StoreError&&e.code==='INVALID_TRANSITION')
    await processSms(store,transport)
    assert.equal(texts.length,1)
    assert.match(texts[0],/조리가 완료되면 한 번 더 문자를 보내드리니 문자를 확인한 후 픽업하러 와주세요 :\)/)
    await processSms(store,transport);await processSms(store,transport)
    assert.equal(texts.length,2);assert.match(texts[1],/반쎄오 나왔어요!/);assert.match(texts[1],/CU 편의점 앞/)
    assert.equal(store.get(order.id)?.smsStatus,'sent');assert.equal(store.get(order.id)?.status,'completed')
    assert.equal(store.get(order.id)?.pickupReady,true)
    order=store.get(order.id)!
    const version=order.version
    order=store.action(order.id,'resend',version,true,'test')
    assert.equal(order.status,'completed');assert.equal(order.quantity,2)
    assert.equal(order.smsStatus,'pending')
    assert.throws(()=>store.action(order.id,'resend',version,true,'test'),(e)=>e instanceof StoreError&&e.code==='ALREADY_PROCESSED')
    assert.throws(()=>store.action(order.id,'resend',order.version,true,'test'),(e)=>e instanceof StoreError&&e.code==='SMS_IN_PROGRESS')
    await processSms(store,transport);await processSms(store,transport)
    assert.equal(texts.length,3);assert.equal(texts[2],texts[1])
    order=store.get(order.id)!
    store.action(order.id,'resend',order.version,true,'test')
    await processSms(store,transport)
    assert.equal(texts.length,4);assert.equal(texts[3],texts[1])
  }finally{store.close();names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})

test('completed order can explicitly retry uncertain pickup guidance after payment settles',()=>{
  const store=new OrderStore()
  try {
    let order=create(store)
    order=store.action(order.id,'pay',order.version,true,'test')
    order=store.action(order.id,'complete',order.version,true,'test')
    const payment=store.claimSms()!
    assert.equal(payment.smsKind,'payment')
    store.finishSms(payment.id,payment.smsLease!,'unknown')
    const pickup=store.claimSms()!
    assert.equal(pickup.smsKind,'ready')
    store.finishSms(pickup.id,pickup.smsLease!,'unknown')
    order=store.get(order.id)!
    assert.throws(()=>store.action(order.id,'resend',order.version,false,'test'),(e)=>e instanceof StoreError&&e.code==='SMS_NOT_CONFIGURED')
    order=store.action(order.id,'resend',order.version,true,'test')
    assert.equal(order.status,'completed');assert.equal(order.quantity,2)
    assert.equal(store.claimSms()?.smsKind,'ready')
  }finally{store.close()}
})

test('payment SMS survives immediate pickup and never sends for orders without SMS notification',()=>{
  const store=new OrderStore()
  try {
    let order=create(store)
    order=store.action(order.id,'pay',order.version,true,'test')
    order=store.action(order.id,'complete',order.version,true,'test')
    const claimed=store.claimSms()!
    assert.equal(claimed.id,order.id);assert.equal(claimed.smsKind,'payment')
    assert.equal(store.claimSms(),null)
    const p={...payload(),notificationMethod:'orderNumber' as const}
    let noSms=store.create(p,JSON.stringify(p)).order
    noSms=store.action(noSms.id,'pay',noSms.version,true,'test')
    assert.equal(noSms.smsStatus,'notUsed');assert.equal(store.claimSms(),null)
    let unconfigured=create(store)
    unconfigured=store.action(unconfigured.id,'pay',unconfigured.version,false,'test')
    assert.equal(unconfigured.smsStatus,'notConfigured');assert.equal(store.claimSms(),null)
  }finally{store.close()}
})

test('an uncertain SMS response does not trigger an automatic second send',async()=>{
  const names=['SOLAPI_API_KEY','SOLAPI_API_SECRET','SOLAPI_SENDER_NUMBER'] as const
  const old=names.map(name=>process.env[name]);process.env.SOLAPI_API_KEY='test';process.env.SOLAPI_API_SECRET='test';process.env.SOLAPI_SENDER_NUMBER='01000000000'
  const store=new OrderStore()
  try {
    let order=create(store);order=store.action(order.id,'pay',order.version,true,'test')
    let attempts=0
    const transport:typeof fetch=async()=>{attempts++;throw new Error('Response lost')}
    await processSms(store,transport);await processSms(store,transport)
    assert.equal(store.get(order.id)?.smsStatus,'unknown');assert.equal(attempts,1)
  } finally {store.close();names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})
