// Live order events: a WebSocket on /v1/orders (the Alpenglow workspace's "Order updates") and Server-Sent Events on
// /v1/orders/events. Both end on their own, so a forgotten tab costs nothing.

const events = [
  { event: 'order.created', order: 'ord_9Tq3Vb', total: { amount: 1157, currency: 'CHF' } },
  { event: 'payment.captured', order: 'ord_9Tq3Vb', method: 'twint' },
  { event: 'order.packed', order: 'ord_9Tq3Vb', warehouse: 'bern' },
  { event: 'order.shipped', order: 'ord_9Tq3Vb', carrier: 'Swiss Post', tracking: '99.60.123456.78901234' },
  { event: 'order.created', order: 'ord_2Kc8Pz', total: { amount: 329, currency: 'CHF' } },
  { event: 'stock.low', sku: 'PCK-BER-65', warehouse: 'zurich', available: 2 },
]

export const WS_SESSION_MS = 3 * 60_000
export const WS_INTERVAL_MS = 1500
const WS_MESSAGES_PER_10S = 20

export function handleWebSocket() {
  const [client, server] = Object.values(new WebSocketPair())
  server.accept()
  let i = 0
  let received: number[] = []
  const send = (value: unknown) => {
    try {
      server.send(JSON.stringify(value))
    } catch {
      stop()
    }
  }
  const ticker = setInterval(() => send({ ...events[i++ % events.length], seq: i, at: new Date().toISOString() }), WS_INTERVAL_MS)
  const limit = setTimeout(() => {
    stop()
    server.close(1000, 'Demo sessions last 3 minutes')
  }, WS_SESSION_MS)
  function stop() {
    clearInterval(ticker)
    clearTimeout(limit)
  }
  send({ op: 'hello', channel: 'orders', note: 'Send {"op":"subscribe","channel":"orders"} or any JSON with an "id" to get an ack.' })
  server.addEventListener('message', (event) => {
    const now = Date.now()
    received = received.filter((t) => now - t < 10_000)
    received.push(now)
    if (received.length > WS_MESSAGES_PER_10S) {
      stop()
      server.close(1008, 'Too many messages')
      return
    }
    if (typeof event.data !== 'string' || event.data.length > 8192) {
      send({ op: 'error', message: 'Send JSON text messages up to 8 KB.' })
      return
    }
    let message: Record<string, unknown>
    try {
      message = JSON.parse(event.data)
    } catch {
      send({ op: 'echo', text: event.data })
      return
    }
    if (message.op === 'subscribe') send({ op: 'subscribed', channel: message.channel ?? 'orders' })
    else if (message.op === 'ping') send({ op: 'pong', at: new Date().toISOString() })
    else if (message.id !== undefined) send({ op: 'ack', id: message.id })
    else send({ op: 'echo', message })
  })
  server.addEventListener('close', stop)
  server.addEventListener('error', stop)
  return new Response(null, { status: 101, webSocket: client })
}

export const SSE_EVENTS = 20

/** text/event-stream: SSE_EVENTS events a second apart, then `end`. Resumes after Last-Event-ID. */
export function handleSSE(req: Request, ctx: ExecutionContext) {
  const last = Number(req.headers.get('last-event-id') ?? new URL(req.url).searchParams.get('lastEventId') ?? 0) || 0
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const run = async () => {
    try {
      await writer.write(encoder.encode(': Alpenglow order events\nretry: 3000\n\n'))
      for (let n = last + 1; n <= SSE_EVENTS; n++) {
        const e = events[(n - 1) % events.length]
        await writer.write(encoder.encode(`id: ${n}\nevent: ${e.event}\ndata: ${JSON.stringify({ ...e, seq: n, at: new Date().toISOString() })}\n\n`))
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      await writer.write(encoder.encode(`event: end\ndata: {"events":${SSE_EVENTS}}\n\n`))
    } catch {
      // The client went away.
    } finally {
      await writer.close().catch(() => {})
    }
  }
  ctx.waitUntil(run())
  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
  })
}
