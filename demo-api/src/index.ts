// demo.echolot.dev: the Alpenglow shop API that the docs' tutorials and example workspaces use.
//
//   /           this index (JSON)
//   /v1/…       the shop: products, categories, sign-in, me, orders, GraphQL, a WebSocket and SSE feed of orders
//   /mcp        an MCP server (Streamable HTTP)
//   /echo/…     see what you sent, pick a status, redirects, cookies, Basic and Bearer auth, XML, HTML, bytes
//
// Every request is rate limited per client address (RATE_LIMIT, plus the stricter HEAVY for large or slow
// responses and streams), bodies are capped at 64 KB, and streams end on their own.

import { demoClient, demoPassword, user } from './catalog'
import { handleEcho, isHeavyEcho } from './echo'
import { sdl } from './graphql'
import { commonHeaders, json, notFound, problem } from './http'
import { handleMCP } from './mcp'
import { SSE_EVENTS, WS_SESSION_MS } from './realtime'
import { handleShop } from './shop'

export const LIMITS = { requests: 120, heavy: 10, period: 60 }

function index(origin: string) {
  return {
    name: 'Alpenglow demo API',
    about: 'A pretend outdoor-gear shop for learning Echolot. Nothing here is private, and nothing you send is stored.',
    docs: 'https://docs.echolot.dev/docs/tutorials/demo-api',
    sign_in: {
      request: `POST ${origin}/v1/auth/token`,
      body: { email: user.email, password: demoPassword },
      oauth2_client_credentials: { token_url: `${origin}/v1/auth/token`, client_id: demoClient.id, client_secret: demoClient.secret },
    },
    shop: {
      'GET /v1/products': 'q, category, tag, in_stock=true, sort (name, price, -price, rating), page, per_page; Link and X-Total-Count headers',
      'GET /v1/products/{sku}': 'one product; ETag and If-None-Match',
      'GET /v1/products/export': 'a 14 MB catalog, for large responses',
      'GET /v1/categories': 'categories with product counts',
      'POST /v1/auth/token': 'JSON email and password, or an OAuth 2 client-credentials form',
      'GET /v1/me': 'the signed-in user (Bearer token)',
      'GET /v1/orders': "Heidi's orders, ?status= (Bearer token)",
      'POST /v1/orders': '{"lines": [{"sku": "TNT-MH-2P", "quantity": 1}]}; 201 with Location; honours Idempotency-Key; not stored',
      'GET /v1/orders/{id}': 'one order (Bearer token)',
      'DELETE /v1/orders/{id}': 'cancel: 204, or 409 once shipped (nothing changes)',
      'POST /v1/graphql': `GraphQL with introspection; schema at ${origin}/shop.graphql`,
      'WebSocket /v1/orders': `order events every 1.5 s; send {"op":"subscribe"}, {"op":"ping"} or JSON with an id; ${WS_SESSION_MS / 60_000} minutes per session`,
      'GET /v1/orders/events': `Server-Sent Events: ${SSE_EVENTS} order events, then end; resumes after Last-Event-ID`,
    },
    mcp: { url: `${origin}/mcp`, transport: 'Streamable HTTP', tools: ['search_catalog', 'get_product', 'order_status'] },
    echo: {
      'ANY /echo/anything': 'the method, query, headers and body you sent',
      'GET /echo/headers': 'the headers you sent',
      'ANY /echo/status/{code}': 'answers with that status',
      'ANY /echo/delay/{seconds}': 'waits up to 5 s, then echoes',
      'GET /echo/redirect/{n}': 'n redirects, then /echo/anything',
      'GET /echo/cookies': 'the cookies you sent; /echo/cookies/set?name=value and /echo/cookies/delete?name',
      'GET /echo/basic-auth/{user}/{password}': '200 with matching Basic auth, else 401',
      'GET /echo/bearer': '200 with any Bearer token, else 401',
      'GET /echo/bytes/{n}': 'n random bytes, up to 1 MB',
      'GET /echo/xml': 'an XML document',
      'GET /echo/html': 'an HTML page',
    },
    limits: {
      requests: `${LIMITS.requests} per minute per client address`,
      large_or_slow: `${LIMITS.heavy} per minute (export, bytes, delay, WebSocket and SSE)`,
      body: '64 KB',
      note: 'Over a limit you get 429 with Retry-After.',
    },
  }
}

const isHeavy = (path: string, req: Request) =>
  path === '/v1/products/export' ||
  path === '/v1/orders/events' ||
  (path === '/v1/orders' && req.headers.get('upgrade')?.toLowerCase() === 'websocket') ||
  (path.startsWith('/echo/') && isHeavyEcho(path.slice('/echo'.length)))

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  if (req.method === 'OPTIONS')
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') ?? '*',
        'Access-Control-Max-Age': '86400',
      },
    })

  // One counter per client address and Cloudflare location (the binding's model); good enough for a demo.
  const client = req.headers.get('cf-connecting-ip') ?? 'local'
  const policy = `${LIMITS.requests};w=${LIMITS.period}`
  const limited = (detail: string) =>
    problem(429, 'Too Many Requests', detail, {}, { 'Retry-After': String(LIMITS.period), 'RateLimit-Policy': policy })
  if (!(await env.RATE_LIMIT.limit({ key: client })).success)
    return limited(`The demo API takes ${LIMITS.requests} requests a minute from one address. Try again in a minute.`)
  if (isHeavy(path, req) && !(await env.HEAVY.limit({ key: client })).success)
    return limited(`Large, slow and streaming endpoints take ${LIMITS.heavy} requests a minute from one address.`)

  if (path === '/') return req.method === 'GET' ? json(index(url.origin)) : problem(405, 'Method Not Allowed', 'Use GET.')
  if (path === '/shop.graphql') return new Response(sdl.trimStart(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  if (path === '/health') return json({ ok: true })
  if (path === '/mcp') return handleMCP(req)
  if (path === '/v1' || path.startsWith('/v1/')) return handleShop(req, path.slice('/v1'.length) || '/', env, ctx)
  if (path === '/echo' || path.startsWith('/echo/')) return handleEcho(req, path.slice('/echo'.length))
  if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } })
  return notFound(`No ${path}. See GET / for the list.`)
}

export default {
  async fetch(req, env, ctx) {
    let response: Response
    try {
      response = await route(req, env, ctx)
    } catch (error) {
      console.error(error)
      response = problem(500, 'Internal Server Error', 'Something went wrong in the demo API.')
    }
    // A WebSocket upgrade's response can't be changed.
    if (response.status === 101) return response
    const headers = new Headers(response.headers)
    for (const [name, value] of Object.entries(commonHeaders())) if (!headers.has(name)) headers.set(name, value)
    headers.set('RateLimit-Policy', `${LIMITS.requests};w=${LIMITS.period}`)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
} satisfies ExportedHandler<Env>
