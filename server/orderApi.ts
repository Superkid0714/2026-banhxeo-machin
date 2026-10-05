import { randomUUID } from 'node:crypto'
import type { Connect, Plugin } from 'vite'
import { PRODUCT, validPhone, type Availability, type Order, type SubmissionPayload } from '../src/domain'

// Local development adapter, not a production payment or SMS backend.
export function createOrderMiddleware(): Connect.NextHandleFunction {
  const orders = new Map<string, Order>()
  const requests = new Map<string, { payload: string; order: Order }>()
  let number = 36
  let stock = 41
  const configured: Availability = process.env.DEMO_AVAILABILITY === 'paused' ? 'paused' : process.env.DEMO_AVAILABILITY === 'soldOut' ? 'soldOut' : 'available'
  const availability = () => configured !== 'available' ? configured : stock === 0 ? 'soldOut' : 'available'
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (!pathname.startsWith('/api/')) { next(); return }
    const send = (status: number, value: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)) }
    if (req.method === 'GET' && pathname === '/api/availability') { send(200, { availability: availability() }); return }
    if (req.method === 'GET' && pathname.startsWith('/api/submissions/')) {
      const previous = requests.get(pathname.slice('/api/submissions/'.length))
      send(previous ? 200 : 404, previous?.order ?? { error: 'Not found' }); return
    }
    if (req.method === 'GET' && pathname.startsWith('/api/orders/')) {
      const order = orders.get(pathname.slice('/api/orders/'.length))
      send(order ? 200 : 404, order ?? { error: 'Order not found' }); return
    }
    if (req.method !== 'POST' || pathname !== '/api/orders') { send(404, { error: 'Not found' }); return }
    try {
      let body = ''
      for await (const chunk of req) { body += chunk; if (body.length > 4096) { send(413, { error: 'Payload too large' }); return } }
      const payload = JSON.parse(body) as SubmissionPayload
      if (!payload || typeof payload.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.requestId) || payload.productId !== PRODUCT.id || !Number.isSafeInteger(payload.quantity) || payload.quantity < 1 || !['sms', 'orderNumber'].includes(payload.notificationMethod)) { send(400, { error: 'Invalid order' }); return }
      if (payload.notificationMethod === 'sms' && (typeof payload.phone !== 'string' || !validPhone(payload.phone) || payload.consent !== true)) { send(400, { error: 'Invalid SMS consent' }); return }
      if (typeof payload.phone !== 'string' || !validPhone(payload.phone)) { send(400, { error: 'Phone is required' }); return }
      if (payload.consent !== true) { send(400, { error: 'Privacy consent is required' }); return }
      // Validate the idempotency key and create synchronously before delaying the response.
      const previous = requests.get(payload.requestId)
      if (previous) { send(previous.payload === body ? 200 : 409, previous.payload === body ? previous.order : { error: 'Request conflict' }); return }
      if (payload.expectedUnitPrice !== PRODUCT.unitPrice) { send(409, { error: 'PRICE_CHANGED' }); return }
      if (availability() !== 'available' || payload.quantity > stock) { send(409, { error: 'SOLD_OUT' }); return }
      const phone = payload.phone
      const order: Order = Object.freeze({ id: randomUUID(), number: ++number, productId: PRODUCT.id, productName: PRODUCT.name, quantity: payload.quantity, unitPrice: PRODUCT.unitPrice, total: PRODUCT.unitPrice * payload.quantity, notificationMethod: payload.notificationMethod, maskedPhone: phone ? `${phone.slice(0,3)}-${phone.slice(3,5)}**-${phone.slice(7,9)}**` : null, status: 'paymentPending', createdAt: new Date().toISOString(), paymentWindowMinutes: 10 })
      stock -= payload.quantity
      orders.set(order.id, order)
      requests.set(payload.requestId, { payload: body, order })
      // Make the Figma submitting presentation observable in local development.
      await new Promise(resolve => setTimeout(resolve, 800))
      send(201, order)
    } catch { send(400, { error: 'Invalid request' }) }
  }
  return middleware
}

export function orderApi(): Plugin {
  const middleware = createOrderMiddleware()
  return { name: 'local-order-api', configureServer(server) { server.middlewares.use(middleware) }, configurePreviewServer(server) { server.middlewares.use(middleware) } }
}
