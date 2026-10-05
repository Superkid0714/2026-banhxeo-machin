import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOrderMiddleware } from './orderApi'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
await stat(resolve(root, 'index.html'))
process.env.ORDER_DB_PATH ??= resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH ?? 'data', 'orders.sqlite')
const api = createOrderMiddleware()
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

async function serve(req: IncomingMessage, res: ServerResponse) {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return
  }
  let file = resolve(root, `.${pathname}`)
  if (file !== resolve(root) && !file.startsWith(root.endsWith(sep) ? root : root + sep)) {
    res.writeHead(403); res.end(); return
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('Not a file')
  } catch {
    // Only application routes fall back to HTML; missing assets stay 404.
    if (['/','/admin','/checkout','/usage','/reservation'].includes(pathname) || /^\/orders\/[^/]+$/.test(pathname)) {
      file = resolve(root, 'index.html')
    } else { res.writeHead(404); res.end(); return }
  }
  const body = await readFile(file)
  res.writeHead(200, {
    'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': extname(file) === '.html' ? 'no-store' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(req.method === 'HEAD' ? undefined : body)
}

const server = createServer((req, res) => {
  const fail = () => { if (!res.headersSent) res.writeHead(500); res.end() }
  void Promise.resolve(api(req, res, error => {
    if (error) { fail(); return }
    void serve(req, res).catch(fail)
  })).catch(fail)
})
server.listen(port, '0.0.0.0', () => console.log(`Order server listening on port ${port}`))
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10000).unref()
  })
}
