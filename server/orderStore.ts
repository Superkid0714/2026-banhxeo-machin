import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { PRODUCT, RESERVATION_UNIT_PRICE, canDeleteOrderHistory, type AdminOrder, type OperationSettings, type SubmissionPayload } from '../src/domain.ts'
import type { Reservation } from './reservationLookup.ts'

type StoredOrder = { -readonly [K in keyof AdminOrder]: AdminOrder[K] } & { sessionId: string; stockReserved: boolean; encryptedPhone: string; smsLease?: string; smsStartedAt?: number; smsMessageId?: string; smsGroupId?: string }
type State = { orders: StoredOrder[]; requests: Record<string, { hash: string; id: string; deleted?: boolean }>; number: number; settings: OperationSettings; manualPaymentFlow?: boolean }
export class StoreError extends Error { constructor(public status: number, public code: string) { super(code) } }
export type OrderAction = 'pay' | 'cook' | 'ready' | 'complete' | 'cancel' | 'refund' | 'restore' | 'resend'
export class OrderStore {
  private db: DatabaseSync
  private key: Buffer
  constructor(path = ':memory:', private now = () => Date.now(), key = process.env.PHONE_ENCRYPTION_KEY) {
    if (path !== ':memory:') { if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error('PHONE_ENCRYPTION_KEY must be 32 bytes in hex for persistent storage'); mkdirSync(dirname(path), { recursive: true }) }
    this.key = key ? Buffer.from(key, 'hex') : randomBytes(32)
    if (this.key.length !== 32) throw new Error('Invalid PHONE_ENCRYPTION_KEY')
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS operation_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)')
    this.db.prepare('INSERT OR IGNORE INTO operation_state (id,value) VALUES (1,?)').run(JSON.stringify({ orders: [], requests: {}, number: 36, manualPaymentFlow:true, settings: { stock: 0, stockTracking: false, paused: process.env.DEMO_AVAILABILITY === 'paused', active: true, retentionMinutes: 0, sessionId: randomUUID(), version: 1 } } satisfies State))
    // The updated booth flow keeps unpaid orders until staff confirm or cancel them.
    if (!this.read().manualPaymentFlow) this.transaction(s => {
      s.manualPaymentFlow=true; s.settings.retentionMinutes=0; if(typeof s.settings.stockTracking==='boolean')s.settings.stockTracking=false; s.settings.version++
      for (const order of s.orders) if (order.status==='paymentPending') order.paymentWindowMinutes=0
    })
    // Existing orders remain intact; numeric stock limits become optional on upgrade.
    if (typeof this.read().settings.stockTracking !== 'boolean') this.transaction(s => {
      s.settings.stockTracking = false; s.settings.version++
      for (const order of s.orders) order.stockReserved = !['cancelled','expired'].includes(order.status)
    })
  }
  close() { this.db.close() }
  private read(): State { return JSON.parse(this.db.prepare('SELECT value FROM operation_state WHERE id=1').get()!.value as string) }
  private transaction<T>(fn: (state: State) => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try { const state = this.read(); const value = fn(state); this.db.prepare('UPDATE operation_state SET value=? WHERE id=1').run(JSON.stringify(state)); this.db.exec('COMMIT'); return value }
    catch (e) { this.db.exec('ROLLBACK'); throw e }
  }
  private stamp() { return new Date(this.now()).toISOString() }
  private event(order: StoredOrder, label: string, actor: string) { order.updatedAt = this.stamp(); order.version++; order.history.push({ at: order.updatedAt, label, actor }) }
  private encrypt(phone: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, iv); const bytes = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]); return [iv, cipher.getAuthTag(), bytes].map(b => b.toString('hex')).join('.') }
  decryptPhone(order: StoredOrder) { const [iv, tag, bytes] = order.encryptedPhone.split('.').map(v => Buffer.from(v, 'hex')); const cipher = createDecipheriv('aes-256-gcm', this.key, iv); cipher.setAuthTag(tag); return cipher.update(bytes, undefined, 'utf8') + cipher.final('utf8') }
  private publicOrder(order: StoredOrder): AdminOrder { const { encryptedPhone: _phone, sessionId: _session, stockReserved: _reserved, smsLease: _lease, smsStartedAt: _started, smsMessageId: _message, smsGroupId: _group, ...safe } = order; return safe }
  expire() {
    const state = this.read()
    if (!state.orders.some(o => (o.status === 'paymentPending' && o.paymentWindowMinutes>0 && Date.parse(o.deadline) <= this.now()) || (o.smsStatus === 'sending' && (o.smsStartedAt ?? 0) + 60000 < this.now()))) return
    this.transaction(s => { for (const order of s.orders) {
      if (order.status === 'paymentPending' && order.paymentWindowMinutes>0 && Date.parse(order.deadline) <= this.now()) { order.status = 'expired'; const reserved=order.stockReserved; if (reserved && order.sessionId === s.settings.sessionId) { s.settings.stock += order.quantity; s.settings.version++ }; order.stockReserved=false; this.event(order, reserved?'결제 시간 초과 · 자동취소 / 재고 복원':'결제 시간 초과 · 자동취소', 'system') }
      if (order.smsStatus === 'sending' && (order.smsStartedAt ?? 0) + 60000 < this.now()) { order.smsStatus = 'unknown'; delete order.smsLease; this.event(order, '문자 발송 여부 확인 필요', 'system') }
    } })
  }
  snapshot() { this.expire(); const s = this.read(); return { orders: s.orders.filter(o => o.sessionId === s.settings.sessionId).map(o => this.publicOrder(o)).sort((a,b) => b.number-a.number), historyOrders: s.orders.map(o => this.publicOrder(o)).sort((a,b)=>b.number-a.number), settings: s.settings } }
  get(id: string) { this.expire(); const order = this.read().orders.find(o => o.id === id); return order ? this.publicOrder(order) : null }
  submission(key: string) { this.expire(); const s = this.read(); const previous = s.requests[key]; if(previous?.deleted)throw new StoreError(410,'ORDER_DELETED'); const order = previous && s.orders.find(o => o.id === previous.id); return order ? this.publicOrder(order) : null }
  create(payload: SubmissionPayload, raw: string) {
    this.expire()
    return this.transaction(s => {
      const hash = createHash('sha256').update(raw).digest('hex')
      const previous = s.requests[payload.requestId]
      if (previous) { if (previous.deleted) throw new StoreError(410,'ORDER_DELETED'); if (previous.hash !== hash) throw new StoreError(409,'Request conflict'); return { order: this.publicOrder(s.orders.find(o => o.id === previous.id)!), created: false } }
      if (payload.expectedUnitPrice !== PRODUCT.unitPrice) throw new StoreError(409,'PRICE_CHANGED')
      if (!s.settings.active || s.settings.paused || process.env.DEMO_AVAILABILITY === 'soldOut' || (s.settings.stockTracking && payload.quantity > s.settings.stock)) throw new StoreError(409,'SOLD_OUT')
      const at = this.stamp()
      const order: StoredOrder = { id: randomUUID(), number: ++s.number, productId: PRODUCT.id, productName: PRODUCT.name, quantity: payload.quantity, unitPrice: PRODUCT.unitPrice, total: PRODUCT.unitPrice * payload.quantity, notificationMethod: payload.notificationMethod, maskedPhone: `${payload.phone.slice(0,3)}-${payload.phone.slice(3,5)}**-${payload.phone.slice(7,9)}**`, status: 'paymentPending', createdAt: at, paymentWindowMinutes: s.settings.retentionMinutes, deadline: new Date(this.now()+s.settings.retentionMinutes*60000).toISOString(), version: 1, updatedAt: at, paymentStatus: 'unpaid', smsStatus: payload.notificationMethod === 'sms' ? 'pending' : 'notUsed', history: [{at,label:'주문 생성',actor:'customer'}], encryptedPhone: this.encrypt(payload.phone), sessionId: s.settings.sessionId, stockReserved: s.settings.stockTracking }
      order.stockReserved=s.settings.stockTracking
      if (order.stockReserved) { s.settings.stock -= order.quantity; s.settings.version++ }; s.orders.push(order); s.requests[payload.requestId] = {hash,id:order.id}
      return { order: this.publicOrder(order), created: true }
    })
  }
  checkInReservation(reservation: Reservation) {
    this.expire()
    return this.transaction(s => {
      // Keep this key across operating sessions and history deletion, so retries
      // and two kiosks checking in together can never create a second order.
      const key = `reservation:${reservation.reservationId}`
      const previous = s.requests[key]
      if (previous?.deleted) throw new StoreError(410, 'ORDER_DELETED')
      if (previous) return { order: this.publicOrder(s.orders.find(o => o.id === previous.id)!), created: false }
      if (!Number.isSafeInteger(reservation.reservationId) || reservation.reservationId < 1 || !Number.isSafeInteger(reservation.quantity) || reservation.quantity < 1 || !Number.isSafeInteger(reservation.quantity * RESERVATION_UNIT_PRICE)) throw new StoreError(400, 'INVALID_RESERVATION')
      if (!reservation.paymentConfirmed) throw new StoreError(409, 'RESERVATION_UNPAID')
      const today = new Date(this.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
      if (reservation.pickupDate !== today) throw new StoreError(409, 'RESERVATION_WRONG_DATE')
      if (!s.settings.active) throw new StoreError(409, 'OPERATION_ENDED')
      if (s.settings.paused) throw new StoreError(409, 'SOLD_OUT')
      const at = this.stamp()
      const order: StoredOrder = { id: randomUUID(), number: ++s.number, reservationId: reservation.reservationId, productId: PRODUCT.id, productName: PRODUCT.name, quantity: reservation.quantity, unitPrice: RESERVATION_UNIT_PRICE, total: RESERVATION_UNIT_PRICE * reservation.quantity, notificationMethod: 'orderNumber', maskedPhone: null, status: 'accepted', createdAt: at, paymentWindowMinutes: 0, deadline: at, version: 1, updatedAt: at, paymentStatus: 'paid', smsStatus: 'notUsed', history: [{ at, label: '사전 예약 현장 접수 / 입금 확인 완료', actor: 'customer' }], encryptedPhone: this.encrypt(''), sessionId: s.settings.sessionId, stockReserved: false }
      s.orders.push(order)
      s.requests[key] = { hash: key, id: order.id }
      return { order: this.publicOrder(order), created: true }
    })
  }
  deleteHistory(id: string, version: number, confirmationNumber: number) {
    return this.transaction(s => {
      const index = s.orders.findIndex(order => order.id === id)
      if (index < 0) throw new StoreError(404, 'ORDER_NOT_FOUND')
      const order = s.orders[index]
      if (order.version !== version) throw new StoreError(409, 'ALREADY_PROCESSED')
      if (order.number !== confirmationNumber) throw new StoreError(400, 'INVALID_CONFIRMATION')
      if (!canDeleteOrderHistory(order)) throw new StoreError(409, 'ORDER_HISTORY_NOT_DELETABLE')
      s.orders.splice(index, 1)
      for (const request of Object.values(s.requests)) if (request.id === id) request.deleted = true
      return { ok: true }
    })
  }
  action(id: string, action: OrderAction, version: number, smsConfigured: boolean, actor: string) {
    this.expire()
    return this.transaction(s => {
      const o = s.orders.find(o => o.id === id && o.sessionId === s.settings.sessionId)
      if (!o) throw new StoreError(404,'ORDER_NOT_FOUND')
      if (o.version !== version) throw new StoreError(409,'ALREADY_PROCESSED')
      const requireStatus = (...values: string[]) => { if (!values.includes(o.status)) throw new StoreError(409,'INVALID_TRANSITION') }
      let label = ''
      if (action === 'pay') { requireStatus('paymentPending'); o.paymentStatus='paid'; o.status='accepted'; label='결제 확인 / 주문 접수' }
      else if (action === 'cook') { requireStatus('accepted'); o.status='cooking'; label='조리 시작' }
      else if (action === 'ready') { requireStatus('cooking'); o.status='ready'; label='준비 완료'; if (o.notificationMethod === 'sms') o.smsStatus=smsConfigured?'pending':'notConfigured' }
      else if (action === 'complete') { requireStatus('ready'); o.status='completed'; label='수령 완료' }
      else if (action === 'cancel') { requireStatus('paymentPending','accepted','cooking','ready'); const started=['cooking','ready'].includes(o.status); const restoreStock=o.stockReserved&&!started; if (restoreStock) {s.settings.stock+=o.quantity;s.settings.version++}; o.stockReserved=false; o.status='cancelled'; if(o.paymentStatus==='paid')o.paymentStatus='refundRequired'; label=restoreStock?'주문 취소 / 재고 복원':started?'주문 취소 / 조리 시작으로 재고 미복원':'주문 취소' }
      else if (action === 'refund') { requireStatus('cancelled'); if(o.paymentStatus!=='refundRequired')throw new StoreError(409,'INVALID_TRANSITION');o.paymentStatus='refunded';label='현장 환불 완료 확인' }
      else if (action === 'restore') { requireStatus('expired'); if(!s.settings.active||s.settings.paused||(s.settings.stockTracking&&s.settings.stock<o.quantity))throw new StoreError(409,'SOLD_OUT');o.stockReserved=s.settings.stockTracking;if(o.stockReserved){s.settings.stock-=o.quantity;s.settings.version++};o.status='paymentPending';o.paymentWindowMinutes=s.settings.retentionMinutes;o.deadline=new Date(this.now()+s.settings.retentionMinutes*60000).toISOString();label=o.stockReserved?'주문 복원 / 재고 재확보':'주문 복원' }
      else if (action === 'resend') { requireStatus('ready'); if(o.notificationMethod!=='sms'||!smsConfigured)throw new StoreError(503,'SMS_NOT_CONFIGURED'); if(['sending','pending','submitted'].includes(o.smsStatus))throw new StoreError(409,'SMS_IN_PROGRESS');o.smsStatus='pending';delete o.smsMessageId;delete o.smsGroupId;label='문자 재안내 요청' }
      else throw new StoreError(400,'INVALID_ACTION')
      this.event(o,label,actor);return this.publicOrder(o)
    })
  }
  settings(input: { version: number; stock?: number; stockTracking?: boolean; paused?: boolean; retentionMinutes?: number; operation?: string }, actor: string) {
    this.expire()
    return this.transaction(s=>{
      if(s.settings.version!==input.version)throw new StoreError(409,'SETTINGS_CHANGED')
      if(input.stock!==undefined){if(!Number.isSafeInteger(input.stock)||input.stock<0||input.stock>100000)throw new StoreError(400,'INVALID_STOCK');s.settings.stock=input.stock}
      if(input.stockTracking!==undefined){if(typeof input.stockTracking!=='boolean')throw new StoreError(400,'INVALID_SETTING');s.settings.stockTracking=input.stockTracking}
      if(input.paused!==undefined){if(typeof input.paused!=='boolean')throw new StoreError(400,'INVALID_SETTING');s.settings.paused=input.paused}
      if(input.retentionMinutes!==undefined){if(input.retentionMinutes!==0&&input.retentionMinutes!==10&&input.retentionMinutes!==20)throw new StoreError(400,'INVALID_SETTING');s.settings.retentionMinutes=input.retentionMinutes}
      if(input.operation==='end'){s.settings.active=false;s.settings.paused=true}
      else if(input.operation==='start'){
        if(s.settings.active||s.orders.some(o=>o.sessionId===s.settings.sessionId&&(!['completed','cancelled','expired'].includes(o.status)||o.paymentStatus==='refundRequired')))throw new StoreError(409,'OPEN_ORDERS_EXIST')
        s.settings.sessionId=randomUUID();s.settings.active=true;s.settings.paused=false
      }else if(input.operation!==undefined)throw new StoreError(400,'INVALID_SETTING')
      s.settings.version++;void actor;return s.settings
    })
  }
  claimSms() {
    this.expire()
    return this.transaction(s=>{const o=s.orders.find(o=>o.status==='ready'&&o.notificationMethod==='sms'&&o.smsStatus==='pending');if(!o)return null;o.smsStatus='sending';o.smsLease=randomUUID();o.smsStartedAt=this.now();this.event(o,'문자 발송 요청 중','system');return {...o} })
  }
  finishSms(id: string, lease: string, status: 'submitted'|'failed'|'unknown', messageId?: string, groupId?: string) {
    this.transaction(s=>{const o=s.orders.find(o=>o.id===id);if(!o||o.smsLease!==lease)return;o.smsStatus=status;o.smsMessageId=messageId;o.smsGroupId=groupId;delete o.smsLease;this.event(o,status==='submitted'?'솔라피 발송 요청 접수':status==='failed'?'문자 발송 실패':'문자 발송 여부 확인 필요','system')})
  }
  submittedSms() { return this.read().orders.filter(o=>o.smsStatus==='submitted').slice(0,10) }
  delivery(id: string, messageId: string, status: 'sent'|'failed'|'unknown') { this.transaction(s=>{const o=s.orders.find(o=>o.id===id);if(!o||o.smsStatus!=='submitted'||o.smsMessageId!==messageId)return;o.smsStatus=status;this.event(o,status==='sent'?'문자 발송 완료':status==='failed'?'문자 발송 실패':'문자 발송 여부 확인 필요','system')}) }
}
