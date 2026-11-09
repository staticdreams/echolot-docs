// The Alpenglow workspace's gRPC side: the Inventory service
// from examples/specs/inventory.proto on localhost:50051 (plaintext, loopback only).
// WatchStock streams a dozen stock levels and then ends; CountStock answers each product the client sends.
// Usage: bun run grpc   (in examples/servers, after bun install)
import * as grpc from '@grpc/grpc-js'
import * as loader from '@grpc/proto-loader'

const proto_file = new URL('../specs/inventory.proto', import.meta.url).pathname
const definition = loader.loadSync(proto_file, { keepCase: true })
const proto = grpc.loadPackageDefinition(definition) as any

const warehouses = [
  { id: 'zrh', name: 'Zürich', canton: 'ZH' },
  { id: 'brn', name: 'Bern', canton: 'BE' },
  { id: 'chr', name: 'Chur', canton: 'GR' },
]

const server = new grpc.Server()
server.addService(proto.alpenglow.inventory.v1.Inventory.service, {
  ListWarehouses: (_call: unknown, done: grpc.sendUnaryData<unknown>) => done(null, { warehouses }),
  WatchStock: (call: grpc.ServerWritableStream<{ skus: string[] }, unknown>) => {
    const skus = call.request.skus?.length ? call.request.skus : ['TNT-MH-2P']
    const levels = { 'TNT-MH-2P': 42, 'PCK-TIT-30': 18 } as Record<string, number>
    let sent = 0
    const timer = setInterval(() => {
      const sku = skus[sent % skus.length]
      const warehouse = warehouses[Math.floor(sent / skus.length) % warehouses.length].id
      levels[sku] = Math.max(0, (levels[sku] ?? 20) - Math.floor(Math.random() * 3))
      call.write({ sku, warehouse, available: levels[sku] })
      if (++sent === 12) {
        clearInterval(timer)
        call.end()
      }
    }, 250)
    call.on('cancelled', () => clearInterval(timer))
  },
  // Two-way: every product the client sends gets its level in each warehouse back; the call ends when the client ends.
  CountStock: (call: grpc.ServerDuplexStream<{ sku: string }, unknown>) => {
    const levels = { 'TNT-MH-2P': [42, 17, 6], 'PCK-TIT-30': [18, 9, 0] } as Record<string, number[]>
    call.on('data', ({ sku }) => {
      const counts = levels[sku] ?? [3, 0, 1]
      warehouses.forEach((w, i) => call.write({ sku, warehouse: w.id, available: counts[i] }))
    })
    call.on('end', () => call.end())
  },
  Reserve: (_call: unknown, done: grpc.sendUnaryData<unknown>) =>
    done(null, { id: 'res_5Tq8Vw', expires_at: new Date(Date.now() + 15 * 60_000).toISOString() }),
})

// localhost may resolve to either address, so listen on both (and nowhere else).
for (const host of ['127.0.0.1:50051', '[::1]:50051'])
  server.bindAsync(host, grpc.ServerCredentials.createInsecure(), (error) => error && console.error(host, error.message))
console.log('Alpenglow gRPC on localhost:50051')
