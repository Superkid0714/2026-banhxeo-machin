import type { Connect, Plugin } from 'vite'
import type { IncomingMessage } from 'node:http'
import { createAdminAuth } from './adminAuth.ts'
import { OrderStore, StoreError, type OrderAction } from './orderStore.ts'
import { processSms, smsConfigured } from './solapi.ts'
import { lookupReservation } from './reservationLookup.ts'
import { PRODUCT, validPhone, type Availability, type SubmissionPayload } from '../src/domain.ts'

async function body(req: IncomingMessage) {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 4096) throw new StoreError(413, 'Payload too large') }
  try { return { value: JSON.parse(raw), raw } } catch { throw new StoreError(400, 'Invalid request') }
}
export function createOrderMiddleware(lookup = lookupReservation): Connect.NextHandleFunction {
  const store = new OrderStore(process.env.ORDER_DB_PATH ?? ':memory:')
  const admin = createAdminAuth()
  let smsBusy = false
  const tick = () => {
    try { store.expire() } catch { console.error('Order expiry storage unavailable') }
    if (smsBusy || !smsConfigured()) return
    smsBusy = true
    void processSms(store).catch(() => console.error('SMS processing unavailable')).finally(() => { smsBusy = false })
  }
  const interval = setInterval(tick, 5000); interval.unref()
  return async (req, res, next) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (!pathname.startsWith('/api/')) { next(); return }
    const send = (status: number, value: unknown) => { res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value)) }
    try {
      if (await admin.handle(req,res,pathname)) return
      if (req.method==='GET' && pathname.startsWith('/api/reservations/')) {
        const result = await lookup(pathname.slice('/api/reservations/'.length))
        send(result.status, result.value); return
      }
      if (req.method==='POST' && pathname==='/api/reservations/check-in') {
        const {value}=await body(req)
        if (!value || typeof value.pickupCode!=='string') throw new StoreError(400,'INVALID_PICKUP_CODE')
        const result=await lookup(value.pickupCode)
        if ('error' in result.value) { send(result.status,result.value); return }
        const checkedIn=store.checkInReservation(result.value)
        send(checkedIn.created?201:200,checkedIn.order);return
      }
      if (pathname.startsWith('/api/admin/')) {
        if (!admin.authenticated(req)) { send(401,{error:'UNAUTHORIZED'});return }
        if (req.method==='GET' && pathname==='/api/admin/orders') {send(200,{...store.snapshot(),smsConfigured:smsConfigured()});return}
        if (req.method==='POST' && pathname==='/api/admin/settings') {
          const {value}=await body(req)
          if(!value||!Number.isSafeInteger(value.version))throw new StoreError(400,'INVALID_REQUEST')
          send(200,store.settings(value,process.env.ADMIN_USERNAME??'admin'));return
        }
        const deleteRoute=/^\/api\/admin\/orders\/([^/]+)\/delete-history$/.exec(pathname)
        if(req.method==='POST'&&deleteRoute){
          const {value}=await body(req)
          if(!value||!Number.isSafeInteger(value.version)||!Number.isSafeInteger(value.confirmationNumber))throw new StoreError(400,'INVALID_REQUEST')
          send(200,store.deleteHistory(deleteRoute[1],value.version,value.confirmationNumber));return
        }
        const actionRoute=/^\/api\/admin\/orders\/([^/]+)\/actions$/.exec(pathname)
        if(req.method==='POST'&&actionRoute){
          const {value}=await body(req)
          if(!value||!Number.isSafeInteger(value.version)||typeof value.action!=='string')throw new StoreError(400,'INVALID_REQUEST')
          send(200,store.action(actionRoute[1],value.action as OrderAction,value.version,smsConfigured(),process.env.ADMIN_USERNAME??'admin'));return
        }
        send(404,{error:'Not found'});return
      }
      if(req.method==='GET'&&pathname==='/api/availability'){
        const {settings}=store.snapshot()
        const availability: Availability = !settings.active||settings.paused?'paused':(settings.stockTracking&&settings.stock===0)||process.env.DEMO_AVAILABILITY==='soldOut'?'soldOut':'available'
        send(200,{availability});return
      }
      if(req.method==='GET'&&pathname.startsWith('/api/submissions/')){const order=store.submission(pathname.slice('/api/submissions/'.length));send(order?200:404,order??{error:'Not found'});return}
      if(req.method==='GET'&&pathname.startsWith('/api/orders/')){const order=store.get(pathname.slice('/api/orders/'.length));send(order?200:404,order??{error:'Order not found'});return}
      if(req.method!=='POST'||pathname!=='/api/orders'){send(404,{error:'Not found'});return}
      const {value,raw}=await body(req),payload=value as SubmissionPayload
      if(!payload||typeof payload.requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(payload.requestId)||payload.productId!==PRODUCT.id||!Number.isSafeInteger(payload.quantity)||payload.quantity<1||!Number.isSafeInteger(payload.quantity*PRODUCT.unitPrice)||!['sms','orderNumber'].includes(payload.notificationMethod))throw new StoreError(400,'Invalid order')
      if(typeof payload.phone!=='string'||!validPhone(payload.phone))throw new StoreError(400,'Phone is required')
      if(payload.consent!==true)throw new StoreError(400,'Privacy consent is required')
      const result=store.create(payload,raw)
      if(result.created)await new Promise(resolve=>setTimeout(resolve,800))
      send(result.created?201:200,result.order)
    }catch(e){ if(e instanceof StoreError)send(e.status,{error:e.code});else{console.error('Order storage request failed');send(500,{error:'STORAGE_UNAVAILABLE'})} }
  }
}
export function orderApi(): Plugin {
  const middleware=createOrderMiddleware()
  return {name:'order-api',configureServer(server){server.middlewares.use(middleware)},configurePreviewServer(server){server.middlewares.use(middleware)}}
}
