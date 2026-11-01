// GraphQL over HTTP on /v1/graphql: the Alpenglow workspace's specs/shop.graphql, with introspection, so Echolot's
// completion and schema views work against it.

import { buildSchema, graphql, parse, validate, type DocumentNode } from 'graphql'
import { findProduct, products, search, type Product } from './catalog'
import { problem, readText } from './http'

export const sdl = /* GraphQL */ `
"""The Alpenglow shop."""
type Query {
  """Products whose name, category or tags contain every word of text."""
  search(text: String!, first: Int = 10): ProductConnection!
  """One product by SKU, such as TNT-MH-2P."""
  product(sku: ID!): Product
  """Every category with its product count."""
  categories: [Category!]!
}

type ProductConnection {
  totalCount: Int!
  nodes: [Product!]!
}

type Product {
  sku: ID!
  name: String!
  category: String!
  price: Money!
  weightGrams: Int!
  rating: Float
  reviews: Int!
  tags: [String!]!
  stock: [Stock!]!
}

type Money {
  amount: Float!
  currency: String!
}

type Stock {
  warehouse: String!
  available: Int!
}

type Category {
  id: ID!
  productCount: Int!
}
`

const schema = buildSchema(sdl)

const view = (p: Product) => ({
  ...p,
  weightGrams: p.weight_g,
  stock: Object.entries(p.stock).map(([warehouse, available]) => ({ warehouse, available })),
})

const root = {
  search: ({ text, first }: { text: string; first?: number }) => {
    const found = search(text)
    return { totalCount: found.length, nodes: found.slice(0, Math.max(0, Math.min(first ?? 10, 50))).map(view) }
  },
  product: ({ sku }: { sku: string }) => {
    const p = findProduct(sku)
    return p ? view(p) : null
  },
  categories: () =>
    [...new Set(products.map((p) => p.category))].map((id) => ({ id, productCount: products.filter((p) => p.category === id).length })),
}

const MAX_QUERY = 16 * 1024
const MAX_DEPTH = 8

function depth(document: DocumentNode) {
  let deepest = 0
  const walk = (node: { selectionSet?: { selections: readonly unknown[] } }, level: number) => {
    deepest = Math.max(deepest, level)
    for (const child of node.selectionSet?.selections ?? []) walk(child as typeof node, level + 1)
  }
  for (const definition of document.definitions) walk(definition as Parameters<typeof walk>[0], 0)
  return deepest
}

export async function handleGraphQL(req: Request) {
  let query: string | undefined
  let variables: Record<string, unknown> | undefined
  let operationName: string | undefined
  if (req.method === 'GET') {
    const url = new URL(req.url)
    query = url.searchParams.get('query') ?? undefined
    operationName = url.searchParams.get('operationName') ?? undefined
    const raw = url.searchParams.get('variables')
    if (raw) {
      try {
        variables = JSON.parse(raw)
      } catch {
        return problem(400, 'Bad Request', 'variables is not valid JSON.')
      }
    }
  } else if (req.method === 'POST') {
    const text = await readText(req)
    if (text instanceof Response) return text
    try {
      ;({ query, variables, operationName } = JSON.parse(text))
    } catch {
      return problem(400, 'Bad Request', 'Send JSON {"query": …, "variables": …}.')
    }
  } else {
    return problem(405, 'Method Not Allowed', 'Use GET or POST.', {}, { Allow: 'GET, POST' })
  }
  if (typeof query !== 'string' || !query.trim()) return Response.json({ errors: [{ message: 'Missing query.' }] }, { status: 400 })
  if (query.length > MAX_QUERY) return Response.json({ errors: [{ message: `Queries are limited to ${MAX_QUERY} characters.` }] }, { status: 400 })
  let document: DocumentNode
  try {
    document = parse(query)
  } catch (error) {
    return Response.json({ errors: [{ message: (error as Error).message }] }, { status: 400 })
  }
  if (depth(document) > MAX_DEPTH) return Response.json({ errors: [{ message: `Queries are limited to a depth of ${MAX_DEPTH}.` }] }, { status: 400 })
  const errors = validate(schema, document)
  if (errors.length) return Response.json({ errors: errors.map((e) => ({ message: e.message, locations: e.locations })) }, { status: 400 })
  const result = await graphql({ schema, source: query, rootValue: root, variableValues: variables, operationName })
  return Response.json(result)
}
