import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { test } from 'node:test'

test('deployment server serves SPA routes, assets and the order API', { timeout: 20000 }, async () => {
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const child = spawn(process.execPath, ['dist-server/start.mjs'], {
    env: { ...process.env, PORT: String(port), DEMO_AVAILABILITY: 'available' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let errors = ''
  child.stderr.on('data', data => { errors += data })
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      once(child, 'exit').then(() => { throw new Error(`Server exited: ${errors}`) }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Startup timed out')), 5000).unref()),
    ])
    const base = `http://127.0.0.1:${port}`
    assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: 'ok' })
    for (const route of ['/', '/checkout?step=review', '/orders/example']) {
      const response = await fetch(`${base}${route}`)
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type'), /text\/html/)
      assert.match(await response.text(), /id="root"/)
    }
    const asset = await fetch(`${base}/assets/banh-xeo.png`)
    assert.equal(asset.status, 200)
    assert.equal(asset.headers.get('content-type'), 'image/png')
    assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404)
    assert.equal((await fetch(`${base}/api/missing`)).status, 404)
    assert.deepEqual(await (await fetch(`${base}/api/availability`)).json(), { availability: 'available' })
    const apiEnvironment = { ...process.env, TEST_API_URL: base }
    delete apiEnvironment.NODE_TEST_CONTEXT
    const apiTests = spawn(process.execPath, ['--test', 'tests/api.test.mjs'], {
      env: apiEnvironment, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    apiTests.stdout.on('data', data => { output += data })
    apiTests.stderr.on('data', data => { output += data })
    const [code] = await once(apiTests, 'exit')
    assert.equal(code, 0, output)
    assert.match(output, /# pass 4\b/, output)
  } finally {
    child.kill()
    await once(child, 'exit')
  }
})
