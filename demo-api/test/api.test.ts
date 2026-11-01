// End to end against `wrangler dev` (workerd, the same runtime as production): bun test
// Or against a deployed Worker: DEMO_API_URL=https://demo.echolot.dev bun test (it uses up this address's limit of
// large responses for a minute).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Subprocess } from 'bun'

const PORT = 8790
const BASE = process.env.DEMO_API_URL?.replace(/\/+$/, '') ?? `http://127.0.0.1:${PORT}`
let worker: Subprocess | undefined

beforeAll(async () => {
  if (process.env.DEMO_API_URL) return
  worker = Bun.spawn(['bunx', 'wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--show-interactive-dev-session=false'], {
    cwd: new URL('..', import.meta.url).pathname,
    stdout: 'ignore',
    stderr: 'ignore',
  })
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return
    } catch {}
    await Bun.sleep(250)
  }
  throw new Error('wrangler dev did not start')
}, 60_000)

afterAll(() => worker?.kill())

// Under wrangler dev each run is its own client (it passes CF-Connecting-IP through), so the rate limits of an earlier
// run in the same minute don't count. Cloudflare's edge sets that header itself and refuses requests that send it.
const LOCAL = !process.env.DEMO_API_URL
const CLIENT = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
const get = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  if (LOCAL && !headers.has('cf-connecting-ip')) headers.set('CF-Connecting-IP', CLIENT)
  if (!LOCAL) headers.delete('cf-connecting-ip')
  return fetch(`${BASE}${path}`, { redirect: 'manual', ...init, headers })
}
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  get(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })

async function signIn() {
  const res = await post('/v1/auth/token', { email: 'heidi@alpenglow.ch', password: 'alpenglow' })
  expect(res.status).toBe(200)
  return ((await res.json()) as { access_token: string }).access_token
}

describe('index and errors', () => {
  test('the index lists the endpoints and the demo sign-in', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toMatch(/^req_/)
    expect(res.headers.get('ratelimit-policy')).toBe('120;w=60')
    const body = (await res.json()) as { sign_in: { body: { email: string } } }
    expect(body.sign_in.body.email).toBe('heidi@alpenglow.ch')
  })
  test('unknown paths are problem details', async () => {
    const res = await get('/v1/nope')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
  })
  test('bodies over 64 KB are refused', async () => {
    const res = await post('/echo/anything', 'x'.repeat(70 * 1024), { 'Content-Type': 'text/plain' })
    expect(res.status).toBe(413)
  })
})

describe('shop', () => {
  test('products filter, sort and paginate with Link headers', async () => {
    const res = await get('/v1/products?category=tents&sort=-price&per_page=2')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-total-count')).toBe('4')
    expect(res.headers.get('link')).toContain('rel="next"')
    const body = (await res.json()) as { items: { sku: string }[]; pages: number }
    expect(body.items.map((p) => p.sku)).toEqual(['TNT-EIG-3P', 'TNT-MH-2P'])
    expect(body.pages).toBe(2)
  })
  test('search matches every word', async () => {
    const body = (await (await get('/v1/products?q=ultralight%20tent')).json()) as { items: { sku: string }[] }
    expect(body.items.map((p) => p.sku).sort()).toEqual(['TNT-MH-2P', 'TNT-PIL-1P'])
  })
  test('one product, with ETag and 304', async () => {
    const res = await get('/v1/products/TNT-MH-2P')
    expect(res.status).toBe(200)
    const etag = res.headers.get('etag')!
    expect((await get('/v1/products/TNT-MH-2P', { headers: { 'If-None-Match': etag } })).status).toBe(304)
    expect((await get('/v1/products/NOPE-1')).status).toBe(404)
  })
  test('/me needs a token, and a signed-in token works', async () => {
    const anonymous = await get('/v1/me')
    expect(anonymous.status).toBe(401)
    expect(anonymous.headers.get('www-authenticate')).toContain('Bearer')
    const token = await signIn()
    expect(token.split('.')).toHaveLength(3)
    const me = (await (await get('/v1/me', { headers: { Authorization: `Bearer ${token}` } })).json()) as { email: string }
    expect(me.email).toBe('heidi@alpenglow.ch')
    const forged = `${token.slice(0, -4)}AAAA`
    expect((await get('/v1/me', { headers: { Authorization: `Bearer ${forged}` } })).status).toBe(401)
  })
  test('a wrong password says what the demo account is', async () => {
    const res = await post('/v1/auth/token', { email: 'heidi@alpenglow.ch', password: 'nope' })
    expect(res.status).toBe(401)
    expect(((await res.json()) as { detail: string }).detail).toContain('alpenglow')
  })
  test('OAuth 2 client credentials, in the form or as Basic auth', async () => {
    const form = await get('/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials&client_id=alpenglow-demo&client_secret=demo-secret',
    })
    expect(form.status).toBe(200)
    const basic = await get('/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa('alpenglow-demo:demo-secret')}` },
      body: 'grant_type=client_credentials',
    })
    expect(basic.status).toBe(200)
    const token = ((await basic.json()) as { access_token: string }).access_token
    // A client token reads orders but cannot place them.
    expect((await get('/v1/orders', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200)
    expect((await post('/v1/orders', { lines: [{ sku: 'TNT-MH-2P', quantity: 1 }] }, { Authorization: `Bearer ${token}` })).status).toBe(403)
  })
  test('orders: list, create (validated, idempotent), get, cancel', async () => {
    const auth = { Authorization: `Bearer ${await signIn()}` }
    const list = (await (await get('/v1/orders?status=shipped', { headers: auth })).json()) as { items: { id: string }[] }
    expect(list.items.map((o) => o.id)).toEqual(['ord_7Hk2Lw'])
    const bad = await post('/v1/orders', { lines: [{ sku: 'NOPE', quantity: 0 }] }, auth)
    expect(bad.status).toBe(422)
    expect(((await bad.json()) as { errors: unknown[] }).errors).toHaveLength(2)
    const lines = { lines: [{ sku: 'TNT-MH-2P', quantity: 2 }, { sku: 'PCK-TIT-30', quantity: 1 }] }
    const first = await post('/v1/orders', lines, { ...auth, 'Idempotency-Key': 'abc' })
    expect(first.status).toBe(201)
    const created = (await first.json()) as { id: string; total: { amount: number } }
    expect(created.total.amount).toBe(549 * 2 + 149)
    expect(first.headers.get('location')).toBe(`/v1/orders/${created.id}`)
    const again = (await (await post('/v1/orders', lines, { ...auth, 'Idempotency-Key': 'abc' })).json()) as { id: string }
    expect(again.id).toBe(created.id)
    expect((await get('/v1/orders/ord_8Jm4Qx', { headers: auth })).status).toBe(200)
    expect((await get('/v1/orders/ord_8Jm4Qx', { method: 'DELETE', headers: auth })).status).toBe(204)
    expect((await get('/v1/orders/ord_7Hk2Lw', { method: 'DELETE', headers: auth })).status).toBe(409)
  })
})

describe('graphql', () => {
  test('the workspace query, with variables', async () => {
    const query = 'query SearchProducts($text: String!, $first: Int = 10) { search(text: $text, first: $first) { totalCount nodes { sku stock { warehouse available } } } }'
    const res = await post('/v1/graphql', { query, variables: { text: 'ultralight' }, operationName: 'SearchProducts' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { search: { totalCount: number; nodes: { stock: unknown[] }[] } } }
    expect(body.data.search.totalCount).toBe(6)
    expect(body.data.search.nodes[0].stock).toHaveLength(2)
  })
  test('introspection works, invalid queries are 400', async () => {
    const intro = (await (await post('/v1/graphql', { query: '{ __schema { queryType { name } } }' })).json()) as { data: { __schema: { queryType: { name: string } } } }
    expect(intro.data.__schema.queryType.name).toBe('Query')
    expect((await post('/v1/graphql', { query: '{ nope }' })).status).toBe(400)
  })
})

describe('mcp', () => {
  const rpc = (method: string, params: unknown = {}, id: number | null = 1) => post('/mcp', { jsonrpc: '2.0', ...(id === null ? {} : { id }), method, params })
  test('initialize, list and call tools', async () => {
    const init = (await (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } })).json()) as { result: { protocolVersion: string } }
    expect(init.result.protocolVersion).toBe('2025-06-18')
    expect((await rpc('notifications/initialized', {}, null)).status).toBe(202)
    const list = (await (await rpc('tools/list')).json()) as { result: { tools: { name: string }[] } }
    expect(list.result.tools.map((t) => t.name)).toEqual(['search_catalog', 'get_product', 'order_status'])
    const call = (await (await rpc('tools/call', { name: 'order_status', arguments: { order_id: 'ord_7Hk2Lw' } })).json()) as { result: { content: { text: string }[]; isError: boolean } }
    expect(call.result.isError).toBe(false)
    expect(call.result.content[0].text).toContain('shipped')
    const unknown = (await (await rpc('nope/nope')).json()) as { error: { code: number } }
    expect(unknown.error.code).toBe(-32601)
  })
})

describe('realtime', () => {
  test('the WebSocket greets, acks and streams order events', async () => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/v1/orders`, { headers: LOCAL ? { 'CF-Connecting-IP': CLIENT } : {} } as unknown as string[])
    const messages: Record<string, unknown>[] = []
    await new Promise<void>((resolve, reject) => {
      ws.onerror = () => reject(new Error('WebSocket error'))
      ws.onopen = () => ws.send(JSON.stringify({ id: 7, op: 'hi' }))
      ws.onmessage = (event) => {
        messages.push(JSON.parse(String(event.data)))
        if (messages.some((m) => m.event)) resolve()
      }
      setTimeout(() => reject(new Error('no order event')), 5000)
    })
    ws.close()
    expect(messages[0].op).toBe('hello')
    expect(messages.some((m) => m.op === 'ack' && m.id === 7)).toBe(true)
  })
  test('SSE sends ids and resumes after Last-Event-ID', async () => {
    const res = await get('/v1/orders/events', { headers: { 'Last-Event-ID': '18' } })
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const text = await res.text()
    expect(text).toContain('id: 19')
    expect(text).toContain('id: 20')
    expect(text).not.toContain('id: 18\n')
    expect(text).toContain('event: end')
  }, 10_000)
})

describe('echo', () => {
  test('anything echoes the request, without Cloudflare headers', async () => {
    const body = (await (await post('/echo/anything?x=1', { hello: 'world' }, { 'X-Demo': 'yes', 'CF-Connecting-IP': CLIENT })).json()) as {
      method: string
      query: Record<string, string>
      headers: Record<string, string>
      body: { hello: string }
    }
    expect(body.method).toBe('POST')
    expect(body.query.x).toBe('1')
    expect(body.headers['x-demo']).toBe('yes')
    expect(body.headers['cf-connecting-ip']).toBeUndefined()
    expect(body.body.hello).toBe('world')
  })
  test('status, redirects, cookies, Basic auth', async () => {
    expect((await get('/echo/status/418')).status).toBe(418)
    const redirect = await get('/echo/redirect/2')
    expect(redirect.status).toBe(302)
    expect(redirect.headers.get('location')).toBe('/echo/redirect/1')
    const set = await get('/echo/cookies/set?flavour=chocolate')
    expect(set.headers.get('set-cookie')).toContain('flavour=chocolate')
    expect((await get('/echo/basic-auth/heidi/pw')).status).toBe(401)
    expect((await get('/echo/basic-auth/heidi/pw', { headers: { Authorization: `Basic ${btoa('heidi:pw')}` } })).status).toBe(200)
    expect((await get('/echo/xml')).headers.get('content-type')).toContain('xml')
  })
})

describe('limits', () => {
  test('the export streams from static assets', async () => {
    const res = await get('/v1/products/export')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { total: number }
    expect(body.total).toBe(40_000)
  })
  // Last: it uses up this address's heavy budget for a minute.
  test('heavy endpoints answer 429 with Retry-After once over the limit', async () => {
    let limited: Response | undefined
    for (let i = 0; i < 15 && !limited; i++) {
      const res = await get('/echo/bytes/16')
      if (res.status === 429) limited = res
    }
    expect(limited).toBeDefined()
    expect(limited!.headers.get('retry-after')).toBe('60')
  })
})
