// /v1: the Alpenglow shop. Products and categories are public; /me and /orders need a token from /v1/auth/token.

import { authenticate, tokenEndpoint } from './auth'
import { categories, findOrder, findProduct, orders, priceOrder, orderTotal, products, search, user } from './catalog'
import { handleGraphQL } from './graphql'
import { json, methodNotAllowed, notFound, problem, readJSON, readText, sleep } from './http'
import { handleSSE, handleWebSocket } from './realtime'

/** A believable server time, so the timing view isn't all zeros. */
const serverTime = () => sleep(20 + Math.random() * 40)

function etagged(req: Request, body: unknown, tag: string, headers: Record<string, string> = {}) {
  const etag = `W/"${tag}"`
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } })
  return json(body, 200, { ETag: etag, 'Cache-Control': 'private, max-age=60', ...headers })
}

function listProducts(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')
  const category = url.searchParams.get('category')
  const tag = url.searchParams.get('tag')
  const inStock = url.searchParams.get('in_stock')
  const sort = url.searchParams.get('sort') ?? 'name'
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page') ?? 10) || 10))
  if (category && !categories.some((c) => c.id === category))
    return problem(400, 'Bad Request', `Unknown category ${category}.`, { categories: categories.map((c) => c.id) })
  let list = q ? search(q) : [...products]
  if (category) list = list.filter((p) => p.category === category)
  if (tag) list = list.filter((p) => p.tags.includes(tag))
  if (inStock === 'true') list = list.filter((p) => p.stock.zurich + p.stock.bern > 0)
  const sorts: Record<string, (a: (typeof products)[0], b: (typeof products)[0]) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    price: (a, b) => a.price.amount - b.price.amount,
    '-price': (a, b) => b.price.amount - a.price.amount,
    rating: (a, b) => b.rating - a.rating,
  }
  if (!sorts[sort]) return problem(400, 'Bad Request', `Unknown sort ${sort}.`, { sorts: Object.keys(sorts) })
  list.sort(sorts[sort])
  const pages = Math.max(1, Math.ceil(list.length / perPage))
  const items = list.slice((page - 1) * perPage, page * perPage)
  const link = (n: number) => {
    const next = new URL(url)
    next.searchParams.set('page', String(n))
    next.searchParams.set('per_page', String(perPage))
    return `${next.pathname}${next.search}`
  }
  const links = [`<${link(1)}>; rel="first"`, `<${link(pages)}>; rel="last"`]
  if (page > 1) links.push(`<${link(page - 1)}>; rel="prev"`)
  if (page < pages) links.push(`<${link(page + 1)}>; rel="next"`)
  return json(
    { page, per_page: perPage, total: list.length, pages, next: page < pages ? link(page + 1) : null, items },
    200,
    { 'X-Total-Count': String(list.length), Link: links.join(', '), 'Cache-Control': 'private, max-age=60' },
  )
}

type NewOrder = { lines?: { sku?: unknown; quantity?: unknown }[]; note?: unknown }

async function createOrder(req: Request) {
  const body = await readJSON<NewOrder>(req)
  if (body instanceof Response) return body
  const lines = Array.isArray(body.lines) ? body.lines : undefined
  const errors: { field: string; message: string }[] = []
  if (!lines || lines.length === 0) errors.push({ field: 'lines', message: 'At least one line: {"sku": "TNT-MH-2P", "quantity": 1}.' })
  lines?.forEach((l, i) => {
    if (typeof l.sku !== 'string' || !findProduct(l.sku)) errors.push({ field: `lines[${i}].sku`, message: `Unknown SKU ${String(l.sku)}.` })
    if (!Number.isInteger(l.quantity) || (l.quantity as number) < 1 || (l.quantity as number) > 10)
      errors.push({ field: `lines[${i}].quantity`, message: 'A whole number from 1 to 10.' })
  })
  if (lines && lines.length > 20) errors.push({ field: 'lines', message: 'At most 20 lines.' })
  if (errors.length) return problem(422, 'Unprocessable Content', 'The order has problems.', { errors })
  const priced = priceOrder((lines as { sku: string; quantity: number }[]).map((l) => ({ sku: l.sku, quantity: l.quantity })))
  // The same body (or the same Idempotency-Key) always gives the same id: the demo stores nothing.
  const key = req.headers.get('idempotency-key') ?? JSON.stringify(priced.map((l) => [l.sku, l.quantity]))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))
  const id = `ord_${[...digest.slice(0, 5)].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8)}`
  const order = {
    id,
    status: 'open',
    created_at: new Date().toISOString(),
    lines: priced,
    total: orderTotal(priced),
    ...(typeof body.note === 'string' ? { note: body.note.slice(0, 500) } : {}),
    shipping: { carrier: 'Swiss Post', estimate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) },
    stored: false,
  }
  const headers: Record<string, string> = { Location: `/v1/orders/${id}` }
  const idempotency = req.headers.get('idempotency-key')
  if (idempotency) headers['Idempotency-Key'] = idempotency
  return json(order, 201, headers)
}

export async function handleShop(req: Request, path: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  const secret = env.TOKEN_KEY || 'alpenglow-demo-local-key'
  const method = req.method

  // Realtime first: no server-time delay.
  if (path === '/orders' && req.headers.get('upgrade')?.toLowerCase() === 'websocket') return handleWebSocket()
  if (path === '/orders/events') return method === 'GET' ? handleSSE(req, ctx) : methodNotAllowed(['GET'])
  if (path === '/graphql') return handleGraphQL(req)

  await serverTime()

  if (path === '/auth/token') {
    if (method !== 'POST') return methodNotAllowed(['POST'])
    const body = await readText(req)
    return body instanceof Response ? body : tokenEndpoint(req, body, secret)
  }
  if (path === '/categories') return method === 'GET' ? etagged(req, { items: categories.map((c) => ({ ...c, products: products.filter((p) => p.category === c.id).length })) }, 'cat-1') : methodNotAllowed(['GET'])
  if (path === '/products') return method === 'GET' ? listProducts(req) : methodNotAllowed(['GET'])
  if (path === '/products/export') {
    if (method !== 'GET') return methodNotAllowed(['GET'])
    // 40,000 products, about 14 MB, served from static assets (generated at deploy by scripts/make-export.ts).
    const asset = await env.ASSETS.fetch(new URL('/data/catalog-export.json', req.url))
    if (!asset.ok) return problem(503, 'Service Unavailable', 'The export is not built; run scripts/make-export.ts.')
    return new Response(asset.body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
  }
  const product = /^\/products\/([\w-]+)$/.exec(path)
  if (product) {
    if (method !== 'GET') return methodNotAllowed(['GET'])
    const p = findProduct(product[1])
    return p ? etagged(req, p, `${p.sku}-1`) : problem(404, 'Not Found', `No product with SKU ${product[1]}.`)
  }

  // Everything below needs a token.
  if (path === '/me' || path === '/orders' || path.startsWith('/orders/')) {
    const claims = await authenticate(req, secret)
    if (claims instanceof Response) return claims
    if (path === '/me') return method === 'GET' ? json(user) : methodNotAllowed(['GET'])
    if (path === '/orders') {
      if (method === 'GET') {
        const status = new URL(req.url).searchParams.get('status')
        const items = status ? orders.filter((o) => o.status === status) : orders
        return json({ total: items.length, items }, 200, { 'X-Total-Count': String(items.length) })
      }
      if (method === 'POST') {
        if (!claims.scope.split(' ').includes('orders:write'))
          return problem(403, 'Forbidden', 'This token cannot place orders (scope orders:write). Sign in with the demo account.')
        return createOrder(req)
      }
      return methodNotAllowed(['GET', 'POST'])
    }
    const id = path.slice('/orders/'.length)
    const order = findOrder(id)
    if (!order) return problem(404, 'Not Found', `No order ${id}. The demo keeps no orders you create; try ord_7Hk2Lw.`)
    if (method === 'GET') return json(order)
    if (method === 'DELETE') {
      if (order.status !== 'open' && order.status !== 'paid') return problem(409, 'Conflict', `Order ${id} is ${order.status} and can no longer be cancelled.`)
      return new Response(null, { status: 204 })
    }
    return methodNotAllowed(['GET', 'DELETE'])
  }

  return notFound(`No /v1${path}. See GET / for the list.`)
}
