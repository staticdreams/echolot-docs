// A small MCP server over Streamable HTTP (JSON responses, no sessions) on /mcp: tools, a resource and a prompt from
// the Alpenglow shop, for the "Inspect an MCP server" tutorial.

import { categories, findOrder, findProduct, products, search } from './catalog'
import { readText } from './http'

const SUPPORTED = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

const tools = [
  {
    name: 'search_catalog',
    title: 'Search the catalog',
    description: 'Searches the Alpenglow catalog by text and returns matching products with price and stock.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for, such as "ultralight tent".' },
        limit: { type: 'integer', minimum: 1, maximum: 20, description: 'How many products to return (default 5).' },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_product',
    title: 'Get a product',
    description: 'Returns one product by SKU, with its price, weight, rating and stock per warehouse.',
    inputSchema: { type: 'object', properties: { sku: { type: 'string', description: 'Such as TNT-MH-2P.' } }, required: ['sku'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'order_status',
    title: 'Order status',
    description: "Returns an order's status, total and shipping estimate.",
    inputSchema: { type: 'object', properties: { order_id: { type: 'string', description: 'Such as ord_7Hk2Lw.' } }, required: ['order_id'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
]

type Message = { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> }

function call(name: string, args: Record<string, unknown>) {
  const text = (value: string, structured?: unknown, isError = false) => ({
    content: [{ type: 'text', text: value }],
    ...(structured === undefined ? {} : { structuredContent: structured }),
    isError,
  })
  switch (name) {
    case 'search_catalog': {
      if (typeof args.query !== 'string') return text('query is required and must be a string.', undefined, true)
      const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 20)
      const found = search(args.query).slice(0, limit).map(({ sku, name, price, stock }) => ({ sku, name, price, stock }))
      const lines = found.map((p) => `${p.name} (${p.sku}): CHF ${p.price.amount}, ${p.stock.zurich + p.stock.bern} in stock`)
      return text(found.length ? `Found ${found.length} products:\n${lines.join('\n')}` : `Nothing matches "${args.query}".`, { results: found })
    }
    case 'get_product': {
      const p = typeof args.sku === 'string' ? findProduct(args.sku) : undefined
      return p ? text(JSON.stringify(p, null, 2), p) : text(`No product with SKU ${String(args.sku)}.`, undefined, true)
    }
    case 'order_status': {
      const o = typeof args.order_id === 'string' ? findOrder(args.order_id) : undefined
      if (!o) return text(`No order ${String(args.order_id)}. Try ord_7Hk2Lw.`, undefined, true)
      const status = { id: o.id, status: o.status, total: o.total, shipping: o.shipping }
      return text(`${o.id} is ${o.status}: CHF ${o.total.amount}, ${o.shipping.carrier}, expected ${o.shipping.estimate}.`, status)
    }
    default:
      return undefined
  }
}

function answer(message: Message): unknown | undefined {
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: message.id, result })
  const fail = (code: number, text: string) => ({ jsonrpc: '2.0', id: message.id ?? null, error: { code, message: text } })
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') return fail(-32600, 'Invalid request')
  // Notifications (no id) get no answer.
  if (message.id === undefined) return undefined
  const params = message.params ?? {}
  switch (message.method) {
    case 'initialize': {
      const asked = String(params.protocolVersion ?? '')
      return ok({
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: 'alpenglow-mcp', title: 'Alpenglow demo shop', version: '1.5.0' },
        instructions: 'The Alpenglow demo shop from docs.echolot.dev. Read-only: search the catalog, look up products and orders.',
      })
    }
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools })
    case 'tools/call': {
      const result = call(String(params.name), (params.arguments as Record<string, unknown>) ?? {})
      return result ? ok(result) : fail(-32602, `Unknown tool ${String(params.name)}`)
    }
    case 'resources/list':
      return ok({
        resources: [{ uri: 'alpenglow://catalog/categories', name: 'categories', title: 'Catalog categories', mimeType: 'application/json' }],
      })
    case 'resources/read':
      if (params.uri !== 'alpenglow://catalog/categories') return fail(-32002, `Unknown resource ${String(params.uri)}`)
      return ok({
        contents: [
          {
            uri: params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(categories.map((c) => ({ ...c, products: products.filter((p) => p.category === c.id).length }))),
          },
        ],
      })
    case 'prompts/list':
      return ok({
        prompts: [{ name: 'pack_for_a_trip', title: 'Pack for a trip', description: 'Suggests gear for a trip.', arguments: [{ name: 'trip', description: 'Such as "two nights on the Haute Route in March".', required: true }] }],
      })
    case 'prompts/get':
      if (params.name !== 'pack_for_a_trip') return fail(-32602, `Unknown prompt ${String(params.name)}`)
      return ok({
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: `Using search_catalog, suggest what to buy from Alpenglow for: ${String((params.arguments as Record<string, unknown>)?.trip ?? 'a weekend hike')}.` },
          },
        ],
      })
    default:
      return fail(-32601, `Method not found: ${message.method}`)
  }
}

export async function handleMCP(req: Request) {
  if (req.method === 'GET') return new Response('This server sends no event stream; POST JSON-RPC messages to it.', { status: 405, headers: { Allow: 'POST' } })
  if (req.method === 'DELETE') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  const text = await readText(req)
  if (text instanceof Response) return text
  let message: Message
  try {
    message = JSON.parse(text)
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 })
  }
  if (Array.isArray(message)) return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batches are not supported' } }, { status: 400 })
  const reply = answer(message)
  return reply === undefined ? new Response(null, { status: 202 }) : Response.json(reply)
}
