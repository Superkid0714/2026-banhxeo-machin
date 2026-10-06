import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { randomBytes, randomUUID } from 'node:crypto'
import { test } from 'node:test'

test('admin authentication protects orders and revokes sessions', { timeout: 20000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const password = randomBytes(24).toString('hex')
  const child = spawn(process.execPath, ['dist-server/start.mjs'], { env: { ...process.env, PORT: String(port), ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: password, ADMIN_COOKIE_SECURE: 'false', DEMO_AVAILABILITY: 'available', ORDER_DB_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let errors = ''
  child.stderr.on('data', data => { errors += data })
  try {
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error(errors) }), new Promise((_, reject) => setTimeout(() => reject(new Error('Startup timeout')), 5000).unref())])
    const base = `http://127.0.0.1:${port}`
    const login = (input, origin = base) => fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(input) })
    assert.equal((await fetch(`${base}/admin`)).status, 200)
    for (const path of ['orders', 'session']) assert.equal((await fetch(`${base}/api/admin/${path}`)).status, 401)
    assert.equal((await login({ username: 'admin', password }, 'https://attacker.example')).status, 403)
    assert.equal((await login({ username: 'admin', password: 'incorrect' })).status, 401)
    assert.equal((await login({ username: 'wrong', password })).status, 401)
    const loggedIn = await login({ username: 'admin', password })
    assert.equal(loggedIn.status, 200)
    const setCookie = loggedIn.headers.get('set-cookie')
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /SameSite=Strict/)
    const cookie = setCookie.split(';')[0]
    const auth = { headers: { Cookie: cookie } }
    assert.equal((await fetch(`${base}/api/admin/session`, auth)).status, 200)
    assert.equal((await fetch(`${base}/api/admin/orders`, { headers: { Cookie: cookie + 'tampered' } })).status, 401)
    const payload = { requestId: randomUUID(), productId: 'banh-xeo', expectedUnitPrice: 6000, quantity: 2, notificationMethod: 'orderNumber', phone: '01012340007', consent: true }
    const created = await (await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json()
    const list = await fetch(`${base}/api/admin/orders`, auth)
    assert.equal(list.status, 200)
    assert.equal(list.headers.get('cache-control'), 'no-store')
    const data = await list.json()
    assert.equal(created.phoneLast4, undefined)
    assert.equal(created.phone, undefined)
    assert.deepEqual(data.orders, [{ ...created, phone: payload.phone, phoneLast4: '0007' }])
    assert.equal(data.historyOrders[0].phoneLast4, '0007')
    assert.equal(data.historyOrders[0].phone, payload.phone)
    for (const path of [`orders/${created.id}`, `submissions/${payload.requestId}`]) {
      const customer = await (await fetch(`${base}/api/${path}`)).json()
      assert.ok(!JSON.stringify(customer).includes(payload.phone))
    }
    const deletion = (order, headers = { Cookie: cookie, Origin: base }, confirmationNumber = order.number) => fetch(`${base}/api/admin/orders/${order.id}/delete-history`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ version: order.version, confirmationNumber }),
    })
    assert.equal((await deletion(created, { Origin: base })).status, 401)
    assert.equal((await deletion(created, { Cookie: cookie, Origin: 'https://attacker.example' })).status, 403)
    assert.equal((await deletion(created)).status, 409)
    const cancelled = await (await fetch(`${base}/api/admin/orders/${created.id}/actions`, {
      method: 'POST', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', version: created.version }),
    })).json()
    assert.equal(cancelled.status, 'cancelled')
    assert.equal((await deletion(created)).status, 404)
    const afterDeletion = await (await fetch(`${base}/api/admin/orders`, auth)).json()
    assert.equal(afterDeletion.historyOrders.length, 0)
    assert.equal(afterDeletion.orders.length, 0)
    assert.equal((await fetch(`${base}/api/orders/${created.id}`)).status, 404)
    assert.equal((await fetch(`${base}/api/submissions/${payload.requestId}`)).status, 410)
    assert.equal((await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).status, 410)
    assert.equal((await deletion(cancelled)).status, 404)
    assert.equal((await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: { Cookie: cookie, Origin: 'https://attacker.example' } })).status, 403)
    assert.equal((await fetch(`${base}/api/admin/session`, auth)).status, 200)
    const logout = await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: { Cookie: cookie, Origin: base } })
    assert.equal(logout.status, 200)
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
    assert.equal((await fetch(`${base}/api/admin/orders`, auth)).status, 401)
    for (let i = 0; i < 7; i++) assert.equal((await login({ username: 'admin', password: 'wrong' })).status, 401)
    const limited = await login({ username: 'admin', password })
    assert.equal(limited.status, 429)
    assert.equal(limited.headers.get('retry-after'), '60')
  } finally { child.kill(); await once(child, 'exit') }
})

test('missing admin credentials fail closed', { timeout: 10000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const child = spawn(process.execPath, ['dist-server/start.mjs'], { env: { ...process.env, PORT: String(port), ADMIN_PASSWORD: '', ORDER_DB_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    await once(child.stdout, 'data')
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/admin/orders`)).status, 503)
  } finally { child.kill(); await once(child, 'exit') }
})
