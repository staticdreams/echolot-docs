# Alpenglow demo API

The API behind docs.echolot.dev's tutorials and example workspaces, on **https://demo.echolot.dev**: a pretend
outdoor-gear shop. Nothing in it is private and nothing sent to it is stored. `GET /` lists every endpoint.

| | |
| --- | --- |
| `/v1/products`, `/v1/products/{sku}`, `/v1/categories` | public; filters, sorting, pagination with `Link` and `X-Total-Count`, `ETag` and 304 |
| `/v1/products/export` | a 14 MB catalog (40,000 products) for large bodies, from static assets |
| `POST /v1/auth/token` | `{"email": "heidi@alpenglow.ch", "password": "alpenglow"}`, or OAuth 2 client credentials (`alpenglow-demo` / `demo-secret`); HS256 JWTs for an hour |
| `/v1/me`, `/v1/orders`, `/v1/orders/{id}` | Bearer token; creating validates (422), answers 201 with `Location`, honours `Idempotency-Key`; cancelling a shipped order is 409 |
| `/v1/graphql` | GraphQL over HTTP with introspection; the schema is `GET /shop.graphql` (the Alpenglow workspace's `specs/shop.graphql`) |
| WebSocket `/v1/orders` | order events every 1.5 s, acks for JSON with an `id`; 3 minutes a session |
| `GET /v1/orders/events` | Server-Sent Events, 20 events, resumes after `Last-Event-ID` |
| `/mcp` | MCP over Streamable HTTP: `search_catalog`, `get_product`, `order_status`, a resource and a prompt |
| `/echo/…` | `anything`, `headers`, `status/{code}`, `delay/{s}`, `redirect/{n}`, `cookies`, `basic-auth/{u}/{p}`, `bearer`, `bytes/{n}`, `xml`, `html` |

Errors are RFC 9457 problem details. gRPC, Socket.IO and MQTT don't run on Workers; tutorials for them use the local
demo servers.

## Limits

- Per client address (`CF-Connecting-IP`, which Cloudflare sets): **120 requests a minute**, and **10 a minute** for
  the export, `/echo/bytes`, `/echo/delay`, WebSocket and SSE. Over a limit: 429 with `Retry-After: 60`. The counters
  are Workers rate-limit bindings: per Cloudflare location and approximate, which is what a demo needs.
- Bodies up to 64 KB (413), GraphQL queries up to 16 KB and depth 8, WebSocket messages up to 8 KB and 20 every
  10 seconds (then closed with 1008), sessions and streams end on their own.
- No `workers.dev` or preview addresses, so nothing reaches the Worker except through demo.echolot.dev.
- On the Workers Free plan nothing is billed: past the daily allowance requests fail instead.

## Develop and deploy

```sh
bun install
bun run dev        # wrangler dev on http://localhost:8787 (writes the export first)
bun test           # 19 end-to-end tests against wrangler dev
DEMO_API_URL=https://demo.echolot.dev bun test   # the same against production
bun run typecheck
bun run deploy
```

`.dev.vars` (copy `.dev.vars.example`) holds the local signing key. In production `TOKEN_KEY` is a Worker secret
(`bunx wrangler secret put TOKEN_KEY`, any long random string), kept in the maintainers' password manager. Rotating it
only signs out demo tokens.
