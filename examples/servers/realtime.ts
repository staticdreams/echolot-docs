// The Alpenglow workspace's realtime side: a Socket.IO 4
// server on localhost:3001 (namespace /support) and an MQTT broker on
// localhost:1883 publishing warehouse temperatures. Both listen on loopback only.
// Usage: bun run realtime   (in examples/servers, after bun install)
import { Aedes } from 'aedes'
import { createServer as createHttp } from 'node:http'
import { createServer as createNet } from 'node:net'
import { Server } from 'socket.io'

// ── Socket.IO: the support desk ──────────────────────────────────────────────

const http = createHttp()
const io = new Server(http, { cors: { origin: '*' } })
io.of('/support').on('connection', (socket) => {
  socket.emit('welcome', { agent: 'Heidi', queue: 2, hours: '08:00–18:00 CET' })
  setTimeout(() => socket.emit('typing', { agent: 'Heidi' }), 900)
  setTimeout(() => socket.emit('message', { from: 'Heidi', text: 'Grüezi! How can I help with your order?' }), 1800)
  socket.on('message', (message, ack) => {
    ack?.({ id: 'msg_31', delivered: true })
    setTimeout(() => socket.emit('message', { from: 'Heidi', text: 'Your Matterhorn 2P ships tomorrow from Bern.' }), 1200)
  })
})
http.listen(3001, '127.0.0.1')

// ── MQTT: warehouse sensors ──────────────────────────────────────────────────

const broker = await Aedes.createBroker()
const publish = (topic: string, payload: string, retain = false) =>
  broker.publish({ cmd: 'publish', topic, payload: Buffer.from(payload), qos: 0, retain, dup: false }, () => {})
// localhost may resolve to either address, so listen on both (and nowhere else).
for (const host of ['127.0.0.1', '::1']) createNet(broker.handle).listen(1883, host)

const warehouses = { zurich: 7.4, bern: 6.1, chur: 4.8 }
setInterval(() => {
  for (const [name, base] of Object.entries(warehouses)) {
    const celsius = +(base + (Math.random() - 0.5) * 0.6).toFixed(1)
    publish(`warehouses/${name}/temperature`, JSON.stringify({ celsius, humidity: 41 + Math.round(Math.random() * 6), at: new Date().toISOString() }))
  }
}, 1500)
publish('warehouses/status', JSON.stringify({ online: 3 }), true)

console.log('Alpenglow realtime: Socket.IO on http://localhost:3001/support, MQTT on mqtt://localhost:1883')
