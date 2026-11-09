// The screenshot scenes: one function per shot (or a few shots that share a set-up). See tools/drive.ts.
import { ROOT, WORKSPACE, viewMode, clickAt, secondary, setValue, type, openSettings, settingsPane, clickIndex, pickMenu, rowMenu, scratchWorkspace, scroll, press, launch, open, openAll, requestTab, responseTab, send, shoot, sleep, state, grab, hotkey, tree, windows, run, type Node } from './drive'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

/** Rests the real pointer at a point of the window (in points from its top left) for a few seconds. */
export function hover(x: number, y: number, seconds = 1.5) {
  run([join(ROOT, '.work/activate'), String(state.pid)])
  run([join(ROOT, '.work/hover'), String(state.origin.x + x), String(state.origin.y + y), String(seconds)])
}

const ORDERS_OAUTH2 = `echolot = 1
name = "Orders with OAuth 2"
method = "GET"
url = "{{baseURL}}/orders"

[auth]
type = "oauth2"
grant = "client-credentials"
token-url = "{{baseURL}}/auth/token"
client-id = "alpenglow-demo"
client-secret = "demo-secret"
scope = "catalog:read orders:read"
refresh-url = "{{baseURL}}/auth/token"

[[auth.authorization-parameters]]
key = "access_type"
value = "offline"

[[auth.token-parameters]]
key = "resource"
value = "https://demo.echolot.dev"

[[assertions]]
target = "status"
check = "equals"
expected = "200"
`

const OAUTH1_VARIABLES = `
[[variables]]
name = "consumerKey"
value = "alpenglow-consumer"

[[variables]]
name = "consumerSecret"
value = "consumer-secret"

[[variables]]
name = "accessToken"
value = "alpenglow-access"

[[variables]]
name = "tokenSecret"
value = "token-secret"
`

const OAUTH1 = `echolot = 1
name = "OAuth 1.0 signed"
method = "GET"
url = "https://demo.echolot.dev/echo/anything"

[auth]
type = "oauth1"
signature-method = "HMAC-SHA1"
consumer-key = "{{consumerKey}}"
consumer-secret = "{{consumerSecret}}"
token = "{{accessToken}}"
token-secret = "{{tokenSecret}}"
`

const ORDERS_FOLDER_OAUTH = `echolot = 1
name = "Orders"
order = ["list-orders", "create-order", "get-order", "cancel-order"]
docs = "Every request here signs in with OAuth 2.0, set on this folder."

[auth]
type = "oauth2"
grant = "client-credentials"
token-url = "{{baseURL}}/auth/token"
client-id = "alpenglow-demo"
client-secret = "{{clientSecret}}"
scope = "orders:read"
`

// ── Streams, sockets and MQTT in mocks; scripts agents propose ──────────────

/** A mock whose first route takes WebSocket connections, then one that streams server-sent events. */
const MOCK_LIVE = `echolot = 1
name = "Shop live"
port = 4019

[[routes]]
id = "updates"
method = "GET"
path = "/orders/{id}/updates"
summary = "Order updates"
kind = "websocket"

[[routes.responses]]
name = "Open"
status = 101
close = { after-ms = 30000, code = 4000, reason = "Shift over" }

[[routes.responses.events]]
data = '{"op": "hello", "order": "{{request.params.id}}"}'

[[routes.responses.replies]]
rules = [{ source = "body", name = "op", value = "watch" }]

[[routes.responses.replies.send]]
after-ms = 500
data = '{"op": "shipped", "order": "{{request.params.id}}"}'

[[routes.responses]]
name = "No token"
status = 401
content-type = "application/json"
body = '{"error": "token required"}'
rules = [{ source = "query", name = "token", value = "" }]

[[routes]]
id = "events"
method = "GET"
path = "/orders/{id}/events"
summary = "Order events"

[[routes.responses]]
name = "Shipping"
status = 200
repeat = 0

[[routes.responses.events]]
event = "position"
data = '{"order": "{{request.params.id}}", "n": {{stream.index}}}'
`

/** A mock of a broker alone: no routes, so its broker card comes right after the empty Routes card. */
const MOCK_BROKER = `echolot = 1
name = "Warehouse sensors"
port = 4020

[broker]
port = 1889

[[broker.publishes]]
topic = "warehouse/zurich/temperature"
data = '{"celsius": 18.5, "n": {{stream.index}}}'
qos = 1
retain = true

[[broker.publishes]]
after-ms = 1000
topic = "warehouse/lyon/temperature"
data = '{"celsius": 21.0}'

[[broker.replies]]
filter = "warehouse/+/restock"
rules = [{ source = "body", name = "sku", value = "*" }]

[[broker.replies.send]]
after-ms = 500
topic = "warehouse/{{message.sku}}/orders"
data = '{"sku": "{{message.sku}}", "status": "ordered"}'
qos = 1
`

const ECHOLOT_CLI = process.env.ECHOLOT_CLI ?? '/Users/peter/Projects/Echolot/Echolot/Packages/EcholotKit/.build/debug/echolot'

/** An MCP client that connects through `echolot mcp serve` (relayed to the app) and proposes a script; kill it when done. */
async function proposeScript(workspace: string) {
  const client = Bun.spawn([ECHOLOT_CLI, 'mcp', 'serve', workspace], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  const send = (message: object) => { client.stdin.write(JSON.stringify(message) + '\n'); client.stdin.flush() }
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Claude Code', version: '1.0' } } })
  // The call waits for initialize's answer: the app knows the session only then.
  const reader = client.stdout.getReader()
  let text = ''
  const deadline = Date.now() + 10_000
  while (!text.includes('"id":1') && Date.now() < deadline) {
    const { value, done } = await reader.read()
    if (done) break
    text += new TextDecoder().decode(value)
  }
  reader.releaseLock()
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'propose_script', arguments: {
    scope: 'request', path: 'orders/create-order', script: 'pre-request',
    code: "// One key per order: a retried POST never places it twice.\nconst key = pm.variables.replaceIn('{{$randomUUID}}')\npm.request.headers.upsert({ key: 'Idempotency-Key', value: key })\nconsole.log('Idempotency-Key', key)",
    why: 'Adds an Idempotency-Key header to every order, so a retried POST never places the same order twice.',
  } } })
  return client
}


// ── Live gRPC calls, signed webhooks, agents' sessions, secret warnings (Nov 9, 2026) ──

/** Alpenglow's Order status on webhook flow, with the sender's signature it accepts instead of the token. */
const SIGNED_WEBHOOK_FLOW = (flow: string) => flow.replace('path = "/order-status"\n', 'path = "/order-status"\n\n[webhook.signature]\nheader = "X-Hub-Signature-256"\nsecret = "{{webhook_secret}}"\nalgorithm = "sha256"\nencoding = "hex"\nprefix = "sha256="\n')
/** workspace.toml with a secret variable for the webhook's signing secret (no value on this Mac). */
const WITH_WEBHOOK_SECRET = () => readFileSync(join(WORKSPACE, 'workspace.toml'), 'utf8').trimEnd() + '\n\n[[variables]]\nname = "webhook_secret"\nsecret = true\n'

/** An MCP client named Claude Code that connects through `echolot mcp serve` (relayed to the app) and makes one call; kill it when done. */
async function agentCall(workspace: string, name: string, args: object) {
  const client = Bun.spawn([ECHOLOT_CLI, 'mcp', 'serve', workspace], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  const send = (message: object) => { client.stdin.write(JSON.stringify(message) + '\n'); client.stdin.flush() }
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Claude Code', version: '1.0' } } })
  const reader = client.stdout.getReader()
  let text = ''
  const deadline = Date.now() + 10_000
  while (!text.includes('"id":1') && Date.now() < deadline) {
    const { value, done } = await reader.read()
    if (done) break
    text += new TextDecoder().decode(value)
  }
  reader.releaseLock()
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } })
  return client
}

/**
 * The Agents button in the page header: the top-level element with a value that the environment menu (with a value of
 * its own) follows. In some languages the breadcrumb before it has a value too.
 */
function agentsButton() {
  const top = tree().filter((n) => n.depth === 1)
  return top.find((n, i) => /, Value: /.test(n.text) && /, Value: /.test(top[i + 1]?.text ?? ''))
}

export const SCENES: Record<string, () => Promise<void>> = {
  /** Inventory › Count stock as a live call: started, two products sent one at a time, the answers in Messages. */
  async 'requests-grpc-live'() {
    const workspace = scratchWorkspace('grpc-live', {})
    await launch({ workspace })
    await open('Count stock')
    await requestTab(1) // Message
    await sleep(1)
    let nodes = tree()
    const method = nodes.findIndex((n) => /, Value: CountStock$/.test(n.text))
    // Live call: the first unticked box after the method picker.
    const live = nodes.slice(method).find((n) => /, Value: 0$/.test(n.text))
    if (!live) throw new Error('no Live call box')
    clickIndex(live.index)
    await sleep(1)
    hotkey('CmdOrCtrl+r') // Start Call
    await sleep(2.5)
    const message = (sku: string) => {
      nodes = tree()
      const editor = nodes.find((n) => /\{/.test(n.text) && /"sku"/.test(n.text))
      if (!editor) throw new Error('no message editor')
      setValue(editor.index, `{\n  "sku": "${sku}"\n}`)
    }
    message('TNT-MH-2P')
    await sleep(0.8)
    hotkey('Shift+CmdOrCtrl+Return') // Send Message
    await sleep(2)
    message('PCK-TIT-30')
    await sleep(0.8)
    hotkey('Shift+CmdOrCtrl+Return')
    await sleep(2)
    await responseTab(0) // Messages
    await sleep(1.5)
    await shoot('requests-grpc-live')
    hotkey('CmdOrCtrl+r') // End Call
    await sleep(1)
  },
  /** The Start block of Order status on webhook with Signed by the sender on: header, secret, HMAC-SHA256, hex, prefix. */
  async 'flows-webhook-signature'() {
    const flow = readFileSync(join(WORKSPACE, 'flows/order-status-webhook.flow.toml'), 'utf8')
    const workspace = scratchWorkspace('signed-webhook', { 'flows/order-status-webhook.flow.toml': SIGNED_WEBHOOK_FLOW(flow), 'workspace.toml': WITH_WEBHOOK_SECRET() })
    await launch({ workspace, page: 'flows', height: 896 })
    await open('Order status on webhook')
    await sleep(1.5)
    hotkey('Alt+CmdOrCtrl+0') // Fit
    await sleep(1.2)
    clickAt(Number(process.env.START_X ?? 132), Number(process.env.START_Y ?? 458)) // the Start block
    await sleep(1.5)
    await shoot('flows-webhook-signature')
  },
  /** The Agents popover while Claude Code keeps Realtime › Order updates open: the session with Stop, the client, its calls. */
  async 'ai-agents-sessions'() {
    // Ten minutes, so the session is still open for both captures (the request's own limit is shorter).
    const updates = readFileSync(join(WORKSPACE, 'requests/realtime/order-updates.ws.toml'), 'utf8').trimEnd() + '\n\n[settings]\nstream-limit = 600.0\n'
    const workspace = scratchWorkspace('agent-sessions', { 'requests/realtime/order-updates.ws.toml': updates })
    await launch({ workspace, args: ['-agents.enabled', 'YES', '-agentToolsets', 'flows,requests,sessions'] })
    await sleep(4)
    const client = await agentCall(workspace, 'open_session', { path: 'realtime/order-updates' })
    try {
      // Its saved messages go out when it opens, so the approval sheet asks first: Allow Once is its last button.
      let sheet: Node[] = []
      for (let i = 0; i < 20 && !sheet.length; i++) {
        await sleep(0.5)
        const nodes = tree()
        const at = nodes.findIndex((n) => n.text.includes('Claude Code'))
        if (at >= 0) sheet = nodes.slice(at).filter((n) => n.depth === 2 && /^\S+$/.test(n.text))
      }
      if (!sheet.length) throw new Error('the approval sheet did not show')
      clickIndex(sheet[sheet.length - 1].index)
      await sleep(4)
      await shoot('ai-agents-sessions', {
        prep: async () => { const button = agentsButton(); if (button) clickIndex(button.index); await sleep(1) },
        post: () => { press('Escape') },
      })
    } finally {
      client.kill()
      await sleep(1)
    }
  },
  /** Workspace variables with a new secret, webhook_secret, and an ordinary word typed as its value: the warning under it. */
  async 'workspaces-secret-advice'() {
    const workspace = scratchWorkspace('secret-advice', { 'workspace.toml': WITH_WEBHOOK_SECRET() })
    await launch({ workspace, page: 'environments' })
    await sleep(1.5)
    clickAt(Number(process.env.SECRET_X ?? 983), Number(process.env.SECRET_Y ?? 523)) // its value field
    await sleep(0.8)
    type('breadcrumbs')
    await sleep(1)
    await shoot('workspaces-secret-advice')
    // Typed, never stored: the field emptied before the app quits, so nothing reaches the Keychain.
    hotkey('CmdOrCtrl+a')
    press('Delete')
    await sleep(0.5)
  },
  /** The editor of a WebSocket route: kind, path, the Open response, what it sends once open, a reply. */
  async 'mocks-route-websocket'() {
    const workspace = scratchWorkspace('mocks-live', { 'mocks/shop-live.toml': MOCK_LIVE })
    await launch({ workspace, page: 'mocks', height: 896 })
    await sleep(1.5)
    scroll(800, 500, 'down', Number(process.env.SCROLL_WS ?? 4))
    await sleep(1.2)
    run([join(ROOT, '.work/activate'), String(state.pid)])
    await shoot('mocks-route-websocket')
  },
  /** The editor of GET /users/{id} (listed first in this copy, so it opens selected): kind, method, path, responses. */
  async 'mocks-route-editor'() {
    const users = readFileSync(join(ROOT, 'shots/scenes/mocks/users.toml'), 'utf8')
    const blocks = users.split(/\n(?=\[\[routes\]\]\n)/)
    const workspace = scratchWorkspace('mocks-users', { 'mocks/users.toml': [blocks[0], blocks[2], blocks[1], ...blocks.slice(3)].join('\n') })
    await launch({ workspace, page: 'mocks', height: 896 })
    await sleep(1.5)
    scroll(800, 500, 'down', Number(process.env.SCROLL_USERS ?? 4))
    await sleep(1.2)
    run([join(ROOT, '.work/activate'), String(state.pid)])
    await shoot('mocks-route-editor')
  },
  /** The MQTT Broker card of a mock that is a broker alone. */
  async 'mocks-broker'() {
    const workspace = scratchWorkspace('mocks-broker', { 'mocks/warehouse-sensors.toml': MOCK_BROKER })
    await launch({ workspace, page: 'mocks', height: 896 })
    await sleep(1.5)
    scroll(800, 500, 'down', Number(process.env.SCROLL_BROKER ?? 3))
    await sleep(1.2)
    run([join(ROOT, '.work/activate'), String(state.pid)])
    await shoot('mocks-broker')
  },
  /** An agent's proposal: the sheet with its reason and the script's lines. */
  async 'ai-script-proposal'() {
    await launch({ args: ['-agents.enabled', 'YES'] })
    await sleep(4)
    let client = await proposeScript(WORKSPACE)
    try {
      // The sheet names the client, which is the same in every language; a client that came too early tries again.
      let shown = false
      for (let attempt = 0; attempt < 3 && !shown; attempt++) {
        for (let i = 0; i < 16 && !shown; i++) {
          await sleep(0.5)
          shown = tree().some((n) => n.text.includes('Claude Code'))
        }
        if (!shown) { client.kill(); await sleep(2); client = await proposeScript(WORKSPACE) }
      }
      if (!shown) throw new Error('the proposal sheet did not show')
      await sleep(1)
      run([join(ROOT, '.work/activate'), String(state.pid)])
      await shoot('ai-script-proposal')
    } finally {
      client.kill()
      await sleep(1)
    }
  },
  // ── Get started and the tutorials' window shots ────────────────────────────
  /** The whole window: Auth › Sign in and Catalog › List products as tabs, the response as a JSON tree. */
  async 'get-started-window'() {
    await launch({ echo: true })
    await openAll('Sign in', 'List products')
    await send()
    await viewMode(2)
    await sleep(1)
    await shoot('get-started-window')
  },
  async 'get-started-first-response'() {
    await launch()
    await open('List products')
    await requestTab(2) // Params
    await send()
    await shoot('get-started-first-response')
  },
  async 'tutorials-alpenglow-window'() {
    await launch()
    await open('List products')
    await send()
    await viewMode(2)
    await sleep(1)
    await shoot('tutorials-alpenglow-window')
  },
  // ── Pages ──────────────────────────────────────────────────────────────────
  async 'tutorials-flows-canvas'() {
    await launch({ page: 'flows' })
    hotkey('Alt+CmdOrCtrl+0')
    await sleep(1)
    hotkey('CmdOrCtrl+r')
    await sleep(9)
    await shoot('tutorials-flows-canvas')
  },
  async 'mcp-server-detail'() {
    await launch({ page: 'mcp', args: ['-mcpServer', 'alpenglow-mcp'] })
    await sleep(2)
    await shoot('mcp-server-detail')
  },
  async 'specs-page'() {
    await launch({ page: 'specs', args: ['-spec', 'alpenglow.yaml'] })
    await sleep(2)
    await shoot('specs-page')
  },
  async 'workspaces-history-page'() {
    await launch({ page: 'history' })
    await sleep(2.5)
    await shoot('workspaces-history-page')
  },
  /** Runs the Catalog folder: its row's menu, Run Folder first. */
  async 'requests-runner-results'() {
    await launch()
    await rowMenu(/Value: Folder/, 1)
    await pickMenu(1)
    await sleep(10)
    await shoot('requests-runner-results')
    await shoot('tutorials-ci-runner')
  },
  async 'workspaces-environments-page'() {
    await launch({ page: 'environments' })
    await sleep(1.5)
    const nodes = tree()
    const first = nodes.findIndex((n) => /^text field/.test(n.text))
    // The environments list sits above the variables: its second item is Staging.
    const items = nodes.slice(0, first).filter((n) => n.depth === 1 && /^\S+( \(selected\))?$/.test(n.text)).slice(-4)
    clickIndex(items[1].index)
    await sleep(1.2)
    await shoot('workspaces-environments-page')
    await shoot('tutorials-first-workspace-environment')
  },
  // ── Menus, palettes and panels (reopened after each appearance switch) ─────
  async 'get-started-command-palette'() {
    await launch()
    await open('List products')
    await send()
    await shoot('get-started-command-palette', {
      prep: async () => { hotkey('CmdOrCtrl+k'); await sleep(0.8); type('list'); await sleep(0.8) },
      post: () => { press('Escape') },
    })
  },
  /** The workspace switcher's menu at the foot of the sidebar. */
  async 'workspaces-switcher'() {
    await launch()
    await shoot('workspaces-switcher', {
      prep: async () => {
        const button = tree().find((n) => n.depth === 1 && /Alpenglow, /.test(n.text))
        if (button) secondary(button.index, 'AXShowMenu')
        await sleep(0.8)
      },
      post: () => { press('Escape') },
    })
  },
  /** The environment menu in the page header. */
  async 'workspaces-environment-menu'() {
    await launch()
    await open('List products')
    await shoot('workspaces-environment-menu', {
      prep: async () => {
        const button = tree().find((n) => n.depth === 1 && /^\S+ [^,]+, Value: /.test(n.text))
        if (button) secondary(button.index, 'AXShowMenu')
        await sleep(0.8)
      },
      post: () => { press('Escape') },
    })
  },
  async 'workspaces-variables-panel'() {
    await launch()
    await open('Get product')
    hotkey('Alt+CmdOrCtrl+v')
    await sleep(1.5)
    await shoot('workspaces-variables-panel')
  },
  // ── Realtime and MCP calls against the demo API ────────────────────────────
  async 'requests-websocket-log'() {
    await launch()
    await open('Order updates')
    hotkey('CmdOrCtrl+r')
    await sleep(10)
    await shoot('requests-websocket-log')
    hotkey('CmdOrCtrl+r')
  },
  async 'requests-sse-events'() {
    await launch()
    await open('Order events')
    await send(7)
    await shoot('requests-sse-events')
  },
  async 'requests-mcp-call'() {
    await launch()
    await open('search_catalog')
    await send(4)
    await shoot('requests-mcp-call')
  },
  async 'ai-echo-screen'() {
    await launch({ echo: true })
    await open('List products')
    await send()
    await open('Categories')
    await send()
    await shoot('ai-echo-screen')
  },
  async 'specs-proto'() {
    await launch({ page: 'specs', args: ['-spec', 'inventory.proto'] })
    await sleep(2)
    await shoot('specs-proto')
  },
  // ── HTTP requests ──────────────────────────────────────────────────────────
  async 'requests-http-page'() {
    await launch()
    await open('List products')
    await requestTab(1)
    await send()
    await viewMode(2)
    await sleep(1)
    await shoot('requests-http-page')
  },
  async 'requests-http-body-json'() {
    await launch()
    await open('Create order')
    await requestTab(3)
    await sleep(1)
    await shoot('requests-http-body-json')
  },
  async 'requests-http-auth-oauth'() {
    await launch()
    await open('Orders with OAuth 2')
    await send(3.5)
    await requestTab(4)
    await sleep(1)
    await shoot('requests-http-auth-oauth')
  },
  async 'requests-http-settings'() {
    await launch()
    await open('List products')
    await requestTab(8)
    await sleep(1)
    await shoot('requests-http-settings')
  },
  async 'requests-http-response-tree'() {
    await launch()
    await open('List products')
    await send()
    await viewMode(2)
    await sleep(1)
    await shoot('requests-http-response-tree')
  },
  async 'requests-tests-tab'() {
    await launch()
    await open('List products')
    await send()
    await requestTab(6)
    await sleep(1)
    await shoot('requests-tests-tab')
    await shoot('tutorials-ci-tests-tab')
  },
  async 'requests-graphql-query'() {
    await launch()
    await open('Search products')
    await send(3)
    await shoot('requests-graphql-query')
  },
  async 'tutorials-chain-create-order'() {
    await launch()
    await open('Sign in')
    await send(3)
    await open('Create order')
    await requestTab(1)
    await send(3)
    await responseTab(2)
    await sleep(1)
    await shoot('tutorials-chain-create-order')
  },
  /** Settings › General: Quick Send on (its switch is the second), Echo at its default (on). */
  async 'settings-general'() {
    await launch({ echo: true })
    const S = await openSettings()
    await settingsPane(S, 1)
    const switches = tree(S).filter((n) => /^\S+, Value: [01]$/.test(n.text))
    clickIndex(switches[1].index, S)
    await sleep(1)
    await shoot('settings-general', { win: S })
  },
  async 'workspaces-settings-storage'() {
    await launch({ echo: true })
    const S = await openSettings()
    await settingsPane(S, 3)
    await shoot('workspaces-settings-storage', { win: S })
  },
  /** A request that inherits: its Auth tab says which folder's auth it uses. */
  async 'requests-http-auth-inherit'() {
    await launch()
    await openAll('Sign in', 'List orders')
    await requestTab(4)
    await sleep(1)
    await shoot('requests-http-auth-inherit')
  },
  async 'requests-http-auth-oauth-advanced'() {
    const workspace = scratchWorkspace('auth-advanced', { 'requests/auth/client-credentials.req.toml': ORDERS_OAUTH2 })
    await launch({ workspace })
    await open('Orders with OAuth 2')
    await requestTab(4)
    await sleep(1)
    scroll(560, 500, 'down', 3)
    await sleep(1)
    await shoot('requests-http-auth-oauth-advanced')
  },
  /** The folder settings sheet of Orders, on its Auth tab with OAuth 2.0 and a token. */
  async 'workspaces-folder-auth-oauth'() {
    const workspace = scratchWorkspace('auth-folder', { 'requests/orders/_folder.toml': ORDERS_FOLDER_OAUTH, 'workspace.toml': readFileSync(join(WORKSPACE, 'workspace.toml'), 'utf8').replace(/\n\[\[variables\]\]/, `\n[[variables]]\nname = "clientSecret"\nvalue = "demo-secret"\n\n[[variables]]`) })
    await launch({ workspace })
    await rowMenu(/Value: Folder/, 2) // Auth is open, then Catalog, then Orders
    await pickMenu(5) // Folder Settings…
    await sleep(1.5)
    const all = tree()
    const top = all.filter((n) => n.depth === 1)
    const sheet = all.indexOf(top[top.length - 1])
    const buttons = all.slice(sheet).filter((n) => n.depth === 2 && /^\S+$/.test(n.text))
    // The sheet's last two buttons: Get Token (the token bar) and Done.
    clickIndex(buttons[buttons.length - 2].index)
    await sleep(4)
    await shoot('workspaces-folder-auth-oauth')
  },
  async 'requests-http-auth-oauth1'() {
    const workspace = scratchWorkspace('auth-oauth1', { 'requests/auth/oauth-1-signed.req.toml': OAUTH1, 'workspace.toml': readFileSync(join(WORKSPACE, 'workspace.toml'), 'utf8').replace(/\n\[\[variables\]\]/, `${OAUTH1_VARIABLES}\n[[variables]]`) })
    await launch({ workspace })
    await open('OAuth 1.0 signed')
    await requestTab(4)
    await sleep(1)
    await shoot('requests-http-auth-oauth1')
  },
  /** The tour on its Environments step (4 of 8): -showTour offers it in the first window; Return starts it and goes on. */
  async 'get-started-tour'() {
    await launch({ page: 'request', args: ['-showTour', 'YES'] })
    await open('List products')
    await sleep(1)
    // The welcome card, then Modules, Requests, Tests, Environments.
    await sleep(1.5)
    for (let i = 0; i < 4; i++) { press('Return'); await sleep(1.3) }
    await shoot('get-started-tour')
  },
  /** Home with Sonar: some sends made so Latest responses has rows, then Home. */
  async 'get-started-home'() {
    await launch({ page: 'home' })
    for (const name of ['List products', 'Get product', 'Categories']) { await open(name); await send(2) }
    hotkey('Shift+CmdOrCtrl+h')
    await sleep(2.5)
    await shoot('get-started-home')
  },
  /** The Sonar card with the pointer on a ping, so its callout shows. The ping is the one nearest the point. */
  async 'get-started-home-sonar'() {
    await launch({ page: 'home' })
    for (const name of ['List products', 'Get product', 'Categories']) { await open(name); await send(2) }
    hotkey('Shift+CmdOrCtrl+h')
    await sleep(2.5)
    await shoot('get-started-home-sonar', { prep: () => hover(546, 470, 2), wait: 0.3 })
  },
  /** For looking at the app while building a scene. */
  async probe() {
    await launch()
    await open('List products')
    await send()
    grab('probe', 'light')
    console.log(tree().slice(0, 60).map((n) => '\t'.repeat(n.depth) + n.index + ' ' + n.text).join('\n'))
    console.log(JSON.stringify(windows()))
  },
}
