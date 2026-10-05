import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

export function createAdminAuth() {
  const username = process.env.ADMIN_USERNAME ?? 'admin'
  const password = process.env.ADMIN_PASSWORD
  const secure = process.env.ADMIN_COOKIE_SECURE !== 'false'
  const salt = randomBytes(16)
  const passwordHash = password && password.length >= 16 ? scryptSync(password, salt, 64) : null
  const sessions = new Map<string, number>()
  const cookieName = secure ? '__Host-festival_admin' : 'festival_admin'
  const ttl = 8 * 60 * 60 * 1000
  let attempts = 0
  let windowStart = Date.now()
  const token = (req: IncomingMessage) => req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? ''
  const authenticated = (req: IncomingMessage) => {
    const id = token(req)
    const expiry = sessions.get(id)
    if (!expiry || expiry <= Date.now()) { sessions.delete(id); return false }
    return true
  }
  const cookie = (value: string, maxAge: number) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(value))
  }
  async function handle(req: IncomingMessage, res: ServerResponse, pathname: string) {
    if (!pathname.startsWith('/api/admin/')) return false
    if (!passwordHash) { send(res, 503, { error: 'ADMIN_NOT_CONFIGURED' }); return true }
    if (req.method === 'POST') {
      // Require an explicit same-origin browser request for login and logout.
      let originHost = ''
      try { originHost = new URL(req.headers.origin ?? '').host } catch { /* Reject absent or malformed Origin. */ }
      if (!originHost || originHost !== req.headers.host) { send(res, 403, { error: 'INVALID_ORIGIN' }); return true }
    }
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      if (Date.now() - windowStart >= 60000) { attempts = 0; windowStart = Date.now() }
      if (++attempts > 10) { res.setHeader('Retry-After', '60'); send(res, 429, { error: 'TOO_MANY_ATTEMPTS' }); return true }
      try {
        let body = ''
        for await (const chunk of req) { body += chunk; if (body.length > 2048) { send(res, 413, { error: 'PAYLOAD_TOO_LARGE' }); return true } }
        const input = JSON.parse(body)
        if (typeof input?.password !== 'string' || input.password.length > 256 || typeof input.username !== 'string') { send(res, 400, { error: 'INVALID_REQUEST' }); return true }
        const matches = timingSafeEqual(scryptSync(input.password, salt, 64), passwordHash)
        if (!matches || input.username !== username) { send(res, 401, { error: 'INVALID_CREDENTIALS' }); return true }
        for (const [id, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(id)
        if (sessions.size >= 1000) { send(res, 503, { error: 'SESSION_LIMIT' }); return true }
        const id = randomBytes(32).toString('hex')
        sessions.set(id, Date.now() + ttl)
        res.setHeader('Set-Cookie', cookie(id, ttl / 1000))
        send(res, 200, { username })
      } catch { send(res, 400, { error: 'INVALID_REQUEST' }) }
      return true
    }
    if (!authenticated(req)) { send(res, 401, { error: 'UNAUTHORIZED' }); return true }
    if (pathname === '/api/admin/session' && req.method === 'GET') { send(res, 200, { username }); return true }
    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      sessions.delete(token(req)); res.setHeader('Set-Cookie', cookie('', 0)); send(res, 200, { ok: true }); return true
    }
    return false
  }
  return { handle, authenticated }
}
