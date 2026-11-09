// Writes the Alpenglow example workspace: an outdoor-gear shop's API, with every kind of request Echolot has.
// It works against the public demo API (https://demo.echolot.dev) with no environment chosen; Local points at the
// demo API under `wrangler dev`, and Staging and Production are pretend (.example) environments that show how
// environments and protected environments work. gRPC, Socket.IO and MQTT need the small servers in examples/servers.
//
// Usage: bun examples/alpenglow.ts [out-dir]   (default .work/Alpenglow.echolot)
// ALPENGLOW_ID=<uuid> gives the copy its own workspace ID, so its Keychain items don't mix with another copy's.
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const out = process.argv[2] ?? '.work/Alpenglow.echolot'

// ── A tiny TOML writer for the shapes Echolot's files use ────────────────────

type Scalar = string | number | boolean | string[]
type Table = Record<string, Scalar>
type Doc = { top: Table; arrays?: [string, Table][]; tables?: [string, Table][] }

const value = (v: Scalar): string => {
  if (Array.isArray(v)) return `[${v.map(value).join(', ')}]`
  if (typeof v === 'string') return v.includes('\n') ? `"""\n${v}"""` : JSON.stringify(v)
  return String(v)
}
const lines = (t: Table) => Object.entries(t).map(([k, v]) => `${k} = ${value(v)}`)

function toml({ top, arrays = [], tables = [] }: Doc) {
  const parts = [lines({ echolot: 1, ...top }).join('\n')]
  for (const [name, t] of tables) parts.push(`[${name}]\n${lines(t).join('\n')}`)
  for (const [name, t] of arrays) parts.push(`[[${name}]]\n${lines(t).join('\n')}`)
  return `${parts.join('\n\n')}\n`
}

function write(path: string, text: string) {
  const file = join(out, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

// ── Requests ─────────────────────────────────────────────────────────────────

type Header = [string, string]
type Check = { target: string; path?: string; name?: string; check: string; expected?: string }
type Request = {
  slug: string
  kind?: 'req' | 'gql' | 'grpc' | 'ws' | 'sio' | 'mqtt' | 'mcp'
  top: Table
  headers?: Header[]
  checks?: Check[]
  body?: { syntax: string; text: string; ext?: string }
  auth?: Table
  extra?: [string, Table][]
}
type Folder = { slug: string; name: string; docs?: string; auth?: Table; requests: Request[] }

const json = (o: unknown) => `${JSON.stringify(o, null, 2)}\n`
const http = (slug: string, name: string, method: string, url: string, more: Partial<Request> = {}): Request => ({
  slug,
  top: { name, method, url },
  ...more,
})
const status = (code: number): Check => ({ target: 'status', check: 'equals', expected: String(code) })
const ok = status(200)
const bearer = { type: 'bearer', token: '{{token}}' }

const folders: Folder[] = [
  {
    slug: 'auth',
    name: 'Auth',
    docs: 'Send "Sign in" first: it captures the access token into {{token}} (a secret, kept in the Keychain), which the Orders folder and "Who am I" use.',
    requests: [
      http('sign-in', 'Sign in', 'POST', '{{baseURL}}/auth/token', {
        headers: [['Content-Type', 'application/json']],
        body: { syntax: 'json', text: json({ email: '{{email}}', password: '{{password}}' }) },
        checks: [ok, { target: 'json', path: '$.access_token', check: 'exists' }],
        extra: [['captures', { variable: 'token', from: 'json', path: '$.access_token', scope: 'workspace', secret: true }]],
      }),
      http('who-am-i', 'Who am I', 'GET', '{{baseURL}}/me', { auth: bearer, checks: [ok] }),
      http('client-credentials', 'Orders with OAuth 2', 'GET', '{{baseURL}}/orders', {
        auth: {
          type: 'oauth2',
          grant: 'client-credentials',
          'token-url': '{{baseURL}}/auth/token',
          'client-id': 'alpenglow-demo',
          'client-secret': 'demo-secret',
          scope: 'catalog:read orders:read',
        },
        checks: [ok],
      }),
    ],
  },
  {
    slug: 'catalog',
    name: 'Catalog',
    requests: [
      http('list-products', 'List products', 'GET', '{{baseURL}}/products?category=tents&in_stock=true&sort=-price&per_page=10', {
        headers: [
          ['Accept', 'application/json'],
          ['Accept-Language', 'de-CH'],
        ],
        checks: [
          ok,
          { target: 'json', path: '$.items.length', check: 'greater-than', expected: '0' },
          { target: 'header', name: 'Content-Type', check: 'contains', expected: 'json' },
          { target: 'time', check: 'less-than', expected: '1000' },
        ],
      }),
      http('search', 'Search', 'GET', '{{baseURL}}/products?q=ultralight&sort=rating', { checks: [ok] }),
      http('get-product', 'Get product', 'GET', '{{baseURL}}/products/{{productId}}', {
        checks: [ok, { target: 'json', path: '$.sku', check: 'equals', expected: '{{productId}}' }],
      }),
      http('categories', 'Categories', 'GET', '{{baseURL}}/categories', { checks: [ok] }),
      {
        slug: 'search-products',
        kind: 'gql',
        top: {
          name: 'Search products',
          url: '{{baseURL}}/graphql',
          operation: 'SearchProducts',
          schema: 'specs/shop.graphql',
          'query-file': 'search-products.graphql',
          variables: '{\n  "text": "ultralight"\n}',
        },
      },
      http('export', 'Export the catalog', 'GET', '{{baseURL}}/products/export', { checks: [ok] }),
    ],
  },
  {
    slug: 'orders',
    name: 'Orders',
    docs: 'Every request here sends the token from "Sign in" (Bearer auth, set on this folder).',
    auth: bearer,
    requests: [
      http('list-orders', 'List orders', 'GET', '{{baseURL}}/orders', { checks: [ok] }),
      http('create-order', 'Create order', 'POST', '{{baseURL}}/orders', {
        headers: [
          ['Content-Type', 'application/json'],
          ['Idempotency-Key', '{{$uuid}}'],
        ],
        body: {
          syntax: 'json',
          text: json({
            lines: [
              { sku: '{{productId}}', quantity: 1 },
              { sku: 'PCK-TIT-30', quantity: 2 },
            ],
            note: 'Placed from Echolot at {{$isoTimestamp}}',
          }),
        },
        checks: [status(201), { target: 'header', name: 'Location', check: 'exists' }],
      }),
      http('get-order', 'Get order', 'GET', '{{baseURL}}/orders/{{orderId}}', { checks: [ok] }),
      http('cancel-order', 'Cancel order', 'DELETE', '{{baseURL}}/orders/ord_8Jm4Qx', { checks: [status(204)] }),
    ],
  },
  {
    slug: 'realtime',
    name: 'Realtime',
    docs: 'Order updates and Order events work against the demo API. Support chat and Warehouse sensors need the local servers in examples/servers (bun run realtime).',
    requests: [
      {
        slug: 'order-updates',
        kind: 'ws',
        top: { name: 'Order updates', url: '{{wsURL}}/orders' },
        extra: [
          ['messages', { name: 'Subscribe', text: '{"op":"subscribe","channel":"orders"}' }],
          ['messages', { name: 'Ping', text: '{"op":"ping"}' }],
        ],
      },
      http('order-events', 'Order events', 'GET', '{{baseURL}}/orders/events', { headers: [['Accept', 'text/event-stream']] }),
      {
        slug: 'support-chat',
        kind: 'sio',
        top: { name: 'Support chat', url: '{{realtimeURL}}', namespace: '/support' },
        extra: [['emits', { name: 'Say hello', event: 'message', arguments: '{"text":"Grüezi!"}' }]],
      },
      {
        slug: 'warehouse-sensors',
        kind: 'mqtt',
        top: { name: 'Warehouse sensors', url: 'mqtt://{{mqttHost}}', version: '3.1.1' },
        extra: [['subscriptions', { filter: 'warehouses/+/temperature', qos: 1 }]],
      },
    ],
  },
  {
    slug: 'inventory',
    name: 'Inventory',
    docs: 'gRPC: needs the local server in examples/servers (bun run grpc).',
    requests: [
      {
        slug: 'list-warehouses',
        kind: 'grpc',
        top: { name: 'List warehouses', url: '{{grpcURL}}', proto: 'specs/inventory.proto', service: 'alpenglow.inventory.v1.Inventory', rpc: 'ListWarehouses' },
      },
      {
        slug: 'watch-stock',
        kind: 'grpc',
        top: {
          name: 'Watch stock',
          url: '{{grpcURL}}',
          proto: 'specs/inventory.proto',
          service: 'alpenglow.inventory.v1.Inventory',
          rpc: 'WatchStock',
          message: '{\n  "skus": ["TNT-MH-2P", "PCK-TIT-30"]\n}',
        },
      },
      {
        slug: 'count-stock',
        kind: 'grpc',
        top: {
          name: 'Count stock',
          url: '{{grpcURL}}',
          proto: 'specs/inventory.proto',
          service: 'alpenglow.inventory.v1.Inventory',
          rpc: 'CountStock',
          message: '{\n  "sku": "TNT-MH-2P"\n}',
        },
      },
      {
        slug: 'reserve-stock',
        kind: 'grpc',
        top: {
          name: 'Reserve stock',
          url: '{{grpcURL}}',
          proto: 'specs/inventory.proto',
          service: 'alpenglow.inventory.v1.Inventory',
          rpc: 'Reserve',
          message: '{\n  "sku": "TNT-MH-2P",\n  "quantity": 1,\n  "order_id": "ord_7Hk2Lw"\n}',
        },
      },
    ],
  },
  {
    slug: 'agent-tools',
    name: 'Agent tools',
    docs: 'Tool calls on the demo MCP server (MCP Servers page: Alpenglow MCP).',
    requests: [
      {
        slug: 'search-catalog',
        kind: 'mcp',
        top: { name: 'search_catalog', server: 'alpenglow-mcp', tool: 'search_catalog', arguments: '{\n  "query": "ultralight tent",\n  "limit": 3\n}' },
      },
      { slug: 'order-status', kind: 'mcp', top: { name: 'order_status', server: 'alpenglow-mcp', tool: 'order_status', arguments: '{\n  "order_id": "ord_7Hk2Lw"\n}' } },
    ],
  },
  {
    slug: 'echo',
    name: 'Echo',
    docs: 'Small endpoints for trying the request editor: see what was sent, statuses, redirects, cookies, Basic auth, XML and HTML.',
    requests: [
      http('echo-anything', 'Echo anything', 'POST', 'https://demo.echolot.dev/echo/anything?source=echolot', {
        headers: [
          ['Content-Type', 'application/json'],
          ['X-Request-Id', '{{$uuid}}'],
        ],
        body: { syntax: 'json', text: json({ hello: 'Grüezi', sent_at: '{{$isoTimestamp}}', lucky: '{{$randomInt(1, 100)}}' }) },
        checks: [ok],
      }),
      http('teapot', "I'm a teapot", 'GET', 'https://demo.echolot.dev/echo/status/418', { checks: [status(418)] }),
      http('redirects', 'Follow redirects', 'GET', 'https://demo.echolot.dev/echo/redirect/3', { checks: [ok] }),
      http('basic-auth', 'Basic auth', 'GET', 'https://demo.echolot.dev/echo/basic-auth/heidi/{{password}}', {
        auth: { type: 'basic', username: 'heidi', password: '{{password}}' },
        checks: [ok],
      }),
      http('set-cookie', 'Set a cookie', 'GET', 'https://demo.echolot.dev/echo/cookies/set?flavour=chocolate', { checks: [ok] }),
      http('xml', 'XML', 'GET', 'https://demo.echolot.dev/echo/xml', { checks: [ok] }),
      http('html', 'HTML', 'GET', 'https://demo.echolot.dev/echo/html', { checks: [ok] }),
    ],
  },
]

// ── Write it all ─────────────────────────────────────────────────────────────

rmSync(out, { recursive: true, force: true })

// The workspace's own variables are the demo API's, so it works with no environment chosen.
write(
  'workspace.toml',
  `# Echolot workspace. Requests live in requests/, one file each.\n${toml({
    top: { id: process.env.ALPENGLOW_ID ?? '0b7d4c1e-2f6a-4e38-9c51-7a1e3d9b5f20', name: 'Alpenglow' },
    arrays: [
      ['variables', { name: 'baseURL', value: 'https://demo.echolot.dev/v1' }],
      ['variables', { name: 'wsURL', value: 'wss://demo.echolot.dev/v1' }],
      ['variables', { name: 'grpcURL', value: 'http://localhost:50051' }],
      ['variables', { name: 'realtimeURL', value: 'http://localhost:3001' }],
      ['variables', { name: 'mqttHost', value: 'localhost' }],
      ['variables', { name: 'email', value: 'heidi@alpenglow.ch' }],
      // The demo account's password is public (docs.echolot.dev); a real one would be a secret.
      ['variables', { name: 'password', value: 'alpenglow' }],
      ['variables', { name: 'productId', value: 'TNT-MH-2P' }],
      ['variables', { name: 'orderId', value: 'ord_7Hk2Lw' }],
    ],
  })}`,
)

const env = (name: string, base: string, protect = false) =>
  toml({
    top: { name, ...(protect ? { protected: true } : {}) },
    arrays: [
      ['variables', { name: 'baseURL', value: base }],
      ['variables', { name: 'wsURL', value: base.replace(/^http/, 'ws') }],
      ...(name === 'Local' ? [] : ([['variables', { name: 'password', secret: true }]] as [string, Table][])),
    ],
  })
write('environments/local.toml', env('Local', 'http://localhost:8787/v1'))
write('environments/staging.toml', env('Staging', 'https://staging.alpenglow.example/v1'))
write('environments/production.toml', env('Production', 'https://api.alpenglow.example/v1', true))

write('requests/_folder.toml', toml({ top: { order: folders.map((f) => f.slug) } }))
for (const folder of folders) {
  write(
    `requests/${folder.slug}/_folder.toml`,
    toml({
      top: { name: folder.name, order: folder.requests.map((r) => r.slug), ...(folder.docs ? { docs: folder.docs } : {}) },
      tables: folder.auth ? [['auth', folder.auth]] : [],
    }),
  )
  for (const r of folder.requests) {
    const arrays: [string, Table][] = [
      ...(r.headers ?? []).map(([name, v]): [string, Table] => ['headers', { name, value: v }]),
      ...(r.checks ?? []).map((c): [string, Table] => ['assertions', c as Table]),
      ...(r.extra ?? []),
    ]
    const tables: [string, Table][] = []
    if (r.auth) tables.push(['auth', r.auth])
    if (r.body) {
      write(`requests/${folder.slug}/${r.slug}.body.json`, r.body.text)
      tables.push(['body', { syntax: r.body.syntax, file: `${r.slug}.body.json` }])
    }
    write(`requests/${folder.slug}/${r.slug}.${r.kind ?? 'req'}.toml`, toml({ top: r.top, arrays, tables }))
  }
}

write(
  'requests/catalog/search-products.graphql',
  `query SearchProducts($text: String!, $first: Int = 10) {
  search(text: $text, first: $first) {
    totalCount
    nodes {
      sku
      name
      price { amount currency }
      rating
      stock { warehouse available }
    }
  }
}
`,
)

// ── Flows ────────────────────────────────────────────────────────────────────

type Block = { id: string; kind: string; title?: string; at: [number, number]; settings?: Table }
type Note = { text: string; frame: [number, number, number, number] }
type Flow = { slug: string; name: string; description: string; triggers?: string; blocks: Block[]; wires: [string, string][]; notes?: Note[] }

function flowToml(flow: Flow) {
  const parts = [lines({ echolot: 1, name: flow.name, description: flow.description }).join('\n')]
  if (flow.triggers) parts.push(flow.triggers.trim())
  for (const b of flow.blocks) {
    const head = lines({ id: b.id, kind: b.kind, ...(b.title ? { title: b.title } : {}) })
    parts.push(['[[blocks]]', ...head, `position = [${b.at.join(', ')}]`].join('\n'))
    if (b.settings) parts.push(['[blocks.settings]', ...lines(b.settings)].join('\n'))
  }
  for (const [from, to] of flow.wires) parts.push(['[[wires]]', ...lines({ from, to })].join('\n'))
  for (const note of flow.notes ?? []) parts.push(['[[notes]]', ...lines({ text: note.text }), `frame = [${note.frame.join(', ')}]`].join('\n'))
  return `${parts.join('\n\n')}\n`
}

const flows: Flow[] = [
  // Laid out so every wire meets its port head-on: a port sits at y + 38 (title) + 26 (summary, if any) + 24 × row + 12.
  {
    slug: 'place-test-order',
    name: 'Place a test order',
    description: 'Places an order, then asks a person whether to keep it; cancels it if they decline. Agents can run it as a tool.',
    triggers: `[mcp]\ntool = "place_test_order"\ndescription = "Places a test order on the demo shop, asking a person before keeping it."`,
    blocks: [
      { id: 'start', kind: 'start', at: [40, 276] },
      { id: 'signin', kind: 'request', title: 'Sign in', at: [330, 250], settings: { request: 'auth/sign-in' } },
      { id: 'order', kind: 'request', title: 'Create order', at: [620, 250], settings: { request: 'orders/create-order' } },
      { id: 'approve', kind: 'approve', title: 'Keep the order?', at: [910, 90], settings: { message: 'Keep order {{body.id}} for CHF {{body.total.amount}}?' } },
      { id: 'failed', kind: 'log', title: 'Order failed', at: [910, 420], settings: { message: 'Create order answered {{status}}' } },
      { id: 'cancel', kind: 'request', title: 'Cancel order', at: [1200, 250], settings: { request: 'orders/cancel-order' } },
    ],
    wires: [
      ['start.run', 'signin.send'],
      ['signin.success', 'order.send'],
      ['order.success', 'approve.run'],
      ['order.fail', 'failed.value'],
      ['approve.declined', 'cancel.send'],
    ],
    notes: [{ text: 'Agents can run this as place_test_order. It still asks a person before keeping anything.', frame: [1200, 420, 248, 96] }],
  },
  {
    slug: 'morning-stock-check',
    name: 'Morning stock check',
    description: 'Every morning at six: warns when a product runs low in Bern.',
    triggers: `[schedule]\ncron = "0 6 * * *"`,
    blocks: [
      { id: 'start', kind: 'start', at: [40, 80] },
      { id: 'list', kind: 'request', title: 'List products', at: [360, 80], settings: { request: 'catalog/list-products' } },
      { id: 'low', kind: 'if', title: 'Running low?', at: [680, 80], settings: { condition: 'value.body.items.some(p => p.stock.bern < 5)' } },
      { id: 'notify', kind: 'notify', title: 'Restock', at: [1000, 80], settings: { title: 'Restock Bern', message: 'A tent is under five in Bern.' } },
    ],
    wires: [
      ['start.run', 'list.send'],
      ['list.success', 'low.value'],
      ['low.true', 'notify.value'],
    ],
  },
  {
    slug: 'order-status-webhook',
    name: 'Order status on webhook',
    description: 'Answers the support desk with an order when it posts to the webhook.',
    triggers: `[webhook]\nmethod = "POST"\npath = "/order-status"`,
    blocks: [
      { id: 'start', kind: 'start', at: [40, 80] },
      { id: 'signin', kind: 'request', title: 'Sign in', at: [360, 80], settings: { request: 'auth/sign-in' } },
      { id: 'order', kind: 'request', title: 'Get order', at: [680, 80], settings: { request: 'orders/get-order' } },
      { id: 'output', kind: 'output', at: [1000, 80] },
    ],
    wires: [
      ['start.run', 'signin.send'],
      ['signin.success', 'order.send'],
      ['order.success', 'output.value'],
    ],
  },
]
for (const flow of flows) write(`flows/${flow.slug}.flow.toml`, flowToml(flow))

// ── MCP server and specs ─────────────────────────────────────────────────────

write('mcp-servers/alpenglow-mcp.toml', toml({ top: { name: 'Alpenglow MCP', transport: 'http', url: 'https://demo.echolot.dev/mcp' } }))

const here = (path: string) => new URL(path, import.meta.url)
write('specs/shop.graphql', readFileSync(here('./specs/shop.graphql'), 'utf8'))
write('specs/inventory.proto', readFileSync(here('./specs/inventory.proto'), 'utf8'))
write('specs/alpenglow.yaml', readFileSync(here('../demo-api/public/openapi.yaml'), 'utf8'))

console.log(`wrote ${out}`)
