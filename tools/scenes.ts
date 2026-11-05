// The screenshot scenes: one function per shot (or a few shots that share a set-up). See tools/drive.ts.
import { ROOT, WORKSPACE, viewMode, clickAt, secondary, setValue, type, openSettings, settingsPane, clickIndex, pickMenu, rowMenu, scratchWorkspace, scroll, press, launch, open, openAll, requestTab, responseTab, send, shoot, sleep, state, grab, hotkey, tree, windows, run } from './drive'
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

export const SCENES: Record<string, () => Promise<void>> = {
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
