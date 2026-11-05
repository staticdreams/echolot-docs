// Drives a Debug build of Echolot through Orca (computer use) to set up a screenshot scene and capture the window, in
// any of the app's languages, light and dark. The scenes are in tools/scenes.ts.
//
//   bun tools/drive.ts <lang> <scene…>       lang: en de es fr ja ko ru zh (zh is the app's zh-Hans)
//   bun tools/drive.ts <lang> --list         the scenes
//
// Writes .work/captures/<lang>/<id>-<mode>.png (2x window captures; a .json beside it when a popover or sheet made
// Orca capture the app's windows together), which `bun tools/shots.ts --lang <lang>` crops into public/shots/<lang>/.
// English captures go to .work/captures/ itself, as tools/cap.sh made them.
//
// Needs: Orca running (Screen Recording and Accessibility granted); a Debug build of the app (xcodebuild … -derivedDataPath
// /tmp/echolot-dd; or ECHOLOT_APP); .work/Alpenglow.echolot, the example workspace; .work/set-appearance (swiftc
// tools/src/set-appearance.swift -o .work/set-appearance). The shop's demo API (demo.echolot.dev) answers the requests; gRPC,
// Socket.IO and MQTT scenes also need the local servers (examples/servers, bun run …).
// Locale-proof: requests open through ⌘K by their (English) names, tabs and buttons are found by their place in the
// accessibility tree or by a menu item's position, never by their label.
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const ROOT = new URL('..', import.meta.url).pathname
export const APP = process.env.ECHOLOT_APP ?? '/tmp/echolot-dd/Build/Products/Debug/Echolot.app'
export const WORKSPACE = process.env.ECHOLOT_WORKSPACE ?? join(ROOT, '.work/Alpenglow.echolot')

export const LANGS = ['en', 'de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh'] as const
export type Lang = (typeof LANGS)[number]
const APP_LANG: Record<Lang, [string, string]> = {
  en: ['en', 'en_US'], de: ['de', 'de_CH'], es: ['es', 'es_ES'], fr: ['fr', 'fr_CH'], ja: ['ja', 'ja_JP'], ko: ['ko', 'ko_KR'],
  ru: ['ru', 'ru_RU'], zh: ['zh-Hans', 'zh_CN'],
}

export const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000))
export const run = (cmd: string[]) => Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe' }).stdout.toString()
export function json(cmd: string[]) {
  try { return JSON.parse(run(cmd)) } catch { return undefined }
}

export const state = { lang: 'en' as Lang, pid: 0, win: 0, origin: { x: 40, y: 60 } }

const running = () => run(['pgrep', '-f', `${APP}/Contents/MacOS/Echolot`]).trim().split('\n').filter(Boolean).map(Number)

/** Ends every instance of the Debug build and waits until none is left. */
export async function quit() {
  for (let i = 0; i < 20 && running().length; i++) {
    for (const p of running()) run(['kill', i < 4 ? '-TERM' : '-KILL', String(p)])
    await sleep(0.5)
  }
  state.pid = 0
  state.win = 0
}

export type LaunchOptions = { echo?: boolean; width?: number; height?: number; page?: string; workspace?: string | null; args?: string[]; window?: string }

/**
 * Launches the app in the language with the example workspace, a 1320 × 852 pt window at (40, 60), the greeting "Heidi"
 * and no saved window state, so nothing of the person's shows. Waits for the window named `window` (the workspace's name).
 */
export async function launch(options: LaunchOptions = {}) {
  const { width = 1320, height = 852, page = 'request', workspace = WORKSPACE, args = [], window = 'Alpenglow', echo = false } = options
  await quit()
  const [code, locale] = APP_LANG[state.lang]
  // The app's own language choice (Settings › General › Language) is this key: the same as the launch language, so Settings shows it as chosen with no relaunch pending.
  run(['defaults', 'write', 'com.staticdreams.Echolot', 'AppleLanguages', '-array', code])
  run([
    'open', '-n', APP, '--args',
    ...(workspace ? ['-open', workspace, '-page', page] : []),
    '-greetingName', 'Heidi', '-ApplePersistenceIgnoreState', 'YES',
    '-windowFrame', `${state.origin.x} ${state.origin.y} ${width} ${height}`,
    '-AppleLanguages', `(${code})`, '-AppleLocale', locale, '-recentWorkspaces', `("${WORKSPACE}")`, '-appearance', 'system', '-echo.enabled', echo ? 'YES' : 'NO', '-onboarding.tour', 'declined', ...args,
  ])
  for (let i = 0; i < 60; i++) {
    await sleep(0.5)
    const found = running()
    if (found.length) state.pid = found[found.length - 1]
    if (!state.pid) continue
    const windows = json(['orca', 'computer', 'list-windows', '--app', `pid:${state.pid}`, '--json'])?.result?.windows ?? []
    const main = windows.find((w: { title: string }) => w.title === window)
    if (main) { state.win = main.id; break }
  }
  if (!state.win) throw new Error('the app did not open its window')
  await sleep(2.5)
}

/**
 * A copy of the example workspace with files added or replaced (`files`: path below the workspace → text), for scenes whose
 * set-up is a request or folder the shop doesn't have. Returns its path; launch with it as `workspace`.
 */
export function scratchWorkspace(name: string, files: Record<string, string>) {
  const dir = join(ROOT, '.work/scenes', `${name}.echolot`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(ROOT, '.work/scenes'), { recursive: true })
  cpSync(WORKSPACE, dir, { recursive: true })
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

// ── Driving it ───────────────────────────────────────────────────────────────

const orcaIn = (win: number, ...a: string[]) => run(['orca', 'computer', ...a, '--app', `pid:${state.pid}`, '--window-id', String(win), '--no-screenshot', '--json'])
const orca = (...a: string[]) => orcaIn(state.win, ...a)
export const hotkey = (key: string) => orca('hotkey', '--key', key)
export const press = (key: string) => orca('press-key', '--key', key)
export const type = (text: string) => orca('type-text', '--text', text)
export const clickAt = (x: number, y: number, count = 1) => orca('click', '--x', String(x), '--y', String(y), ...(count > 1 ? ['--click-count', String(count)] : []))
export const scroll = (x: number, y: number, direction = 'down', pages = 3) => orca('scroll', '--x', String(x), '--y', String(y), '--direction', direction, '--pages', String(pages))
export const clickIndex = (i: number, win = state.win) => orcaIn(win, 'click', '--element-index', String(i))
export const setValue = (i: number, value: string, win = state.win) => orcaIn(win, 'set-value', '--element-index', String(i), '--value', value)
export const secondary = (i: number, action: string, win = state.win) => orcaIn(win, 'perform-secondary-action', '--element-index', String(i), '--action', action)

export type Node = { index: number; depth: number; text: string }
/** The accessibility tree of the main window (or of another window of the app with `win`). */
export function tree(win = state.win): Node[] {
  const out = json(['orca', 'computer', 'get-app-state', '--app', `pid:${state.pid}`, '--window-id', String(win), '--no-screenshot', '--json'])
  const text: string = out?.result?.snapshot?.treeText ?? ''
  return text.split('\n').flatMap((line) => {
    const m = line.match(/^(\t*)(\d+) (.*)$/)
    return m ? [{ index: Number(m[2]), depth: m[1].length, text: m[3] }] : []
  })
}

/**
 * macOS words the accessibility roles in the app's language ("taste", "schalter"), so nothing here matches a role word.
 * The open menu or sheet is the last popup: the last top-level element that has children.
 */
function popup(win = state.win) {
  const nodes = tree(win)
  const tops = nodes.filter((n) => n.depth === 1)
  for (let i = tops.length - 1; i >= 0; i--) {
    const at = nodes.indexOf(tops[i])
    const kids = nodes.slice(at + 1).filter((n, j, rest) => n.depth === 2 && rest.slice(0, j).every((m) => m.depth >= 2))
    if (kids.length >= 3 && nodes[at + 1]?.depth === 2) return { node: tops[i], kids, nodes, at }
  }
  return undefined
}
/** The items of the open menu (separators count: they are items too), so a menu item can be picked by its place. */
export function menuItems(win = state.win) {
  return popup(win)?.kids ?? []
}
/** Chooses the nth item (from 1) of the open menu, whatever its label is in this language. */
export async function pickMenu(n: number, win = state.win) {
  const item = menuItems(win)[n - 1]
  if (!item) throw new Error(`no menu item ${n}`)
  secondary(item.index, 'AXPress', win)
  await sleep(1.2)
}
/** Opens the context menu of the nth folder row in the sidebar (rows have "Value:", requests also a path: ", /…"), from 0. */
export async function rowMenu(_kind: RegExp, nth: number) {
  const rows = tree().filter((n) => n.depth === 3 && /, Value:/.test(n.text) && !/, \//.test(n.text))
  if (!rows[nth]) throw new Error(`no row ${nth}`)
  secondary(rows[nth].index, 'AXShowMenu')
  await sleep(1)
}

/** The app's windows (the main one, Settings, sheets and popovers as windows of their own). */
export function windows(): { id: number; title: string; x: number; y: number; width: number; height: number }[] {
  return json(['orca', 'computer', 'list-windows', '--app', `pid:${state.pid}`, '--json'])?.result?.windows ?? []
}

export function groups(nodes = tree()) {
  const found: { parent: Node; kids: Node[] }[] = []
  nodes.forEach((n, i) => {
    const kids: Node[] = []
    for (let j = i + 1; j < nodes.length && nodes[j].depth > n.depth; j++) if (nodes[j].depth === n.depth + 1) kids.push(nodes[j])
    if (kids.length) found.push({ parent: n, kids })
  })
  return found
}

/** The tab strips of the request editor, in order: the request's tabs, then the response's. Found by shape. */
function strips() {
  const nodes = tree()
  const url = nodes.findIndex((n) => / URL(,|$)/.test(n.text) && !/settable/.test(n.text))
  const after = new Set(nodes.slice(url + 1).map((n) => n.index))
  return groups(nodes)
    .filter((g) => after.has(g.parent.index) && g.kids.length >= 3 && g.kids.every((k) => /^\S+( \(selected\))?$/.test(k.text)))
    .map((g) => g.kids)
}
async function tab(strip: number, i: number) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = strips()[strip]?.[i]
    if (found) { clickIndex(found.index); return }
    await sleep(1)
  }
  throw new Error(`no tab ${i} in strip ${strip}`)
}
export const requestTab = (i: number) => tab(0, i)
export const responseTab = (i: number) => tab(1, i)
/** The response body's view (Text, JSON, JSON Tree, XML…). */
export const viewMode = (i: number) => tab(2, i)

/** Opens a request by its (English) name through ⌘K. */
export async function open(name: string) {
  hotkey('CmdOrCtrl+k')
  await sleep(0.9)
  type(name)
  await sleep(0.9)
  press('Return')
  await sleep(1.4)
}

/** Sends the open request (⌘R) and waits. */
export async function send(seconds = 2.5) {
  hotkey('CmdOrCtrl+r')
  await sleep(seconds)
}

/** Opens one request after the others, so the sidebar and tabs look as in the English shots (the last is the open one). */
export async function openAll(...names: string[]) {
  for (const name of names) await open(name)
}

/** Opens Settings (⌘,) and returns its window's id: the app's one other window with a title. */
export async function openSettings() {
  hotkey('CmdOrCtrl+,')
  for (let i = 0; i < 10; i++) {
    await sleep(0.8)
    const found = windows().find((w) => w.id !== state.win && w.title !== '')
    if (found) return found.id
  }
  throw new Error('Settings did not open')
}
/** Chooses the nth pane (from 1: General, Network, Storage, Assistant, Agents, Privacy, About) in the sidebar of Settings. */
export async function settingsPane(window: number, n: number) {
  const nodes = tree(window)
  const strip = groups(nodes).find((g) => g.kids.length >= 5 && g.kids.every((k) => /^\S+( \(selected\))?$/.test(k.text)))
  const target = strip?.kids[n - 1]
  if (!target) throw new Error(`no Settings pane ${n}`)
  clickIndex(target.index, window)
  await sleep(1.2)
}

// ── Capturing ────────────────────────────────────────────────────────────────

export const capturesDir = () => join(ROOT, '.work/captures', state.lang === 'en' ? '' : state.lang)

function appearance(mode: 'light' | 'dark') {
  run([join(ROOT, '.work/set-appearance'), mode])
}

/** The main window (or `win`) as a 2x PNG, with the region sidecar tools/shots.ts reads when a popover widened the capture. */
export function grab(id: string, mode: 'light' | 'dark', win = state.win) {
  const dir = capturesDir()
  mkdirSync(dir, { recursive: true })
  const out = json(['orca', 'computer', 'get-app-state', '--app', `pid:${state.pid}`, '--window-id', String(win), '--json'])
  const shot = out?.result?.screenshot
  if (!shot?.path) throw new Error('no screenshot')
  copyFileSync(shot.path, join(dir, `${id}-${mode}.png`))
  const all = windows()
  const target = all.find((w) => w.id === win)
  const sidecar = join(dir, `${id}-${mode}.json`)
  if (target && shot.width === target.width * 2) {
    rmSync(sidecar, { force: true })
  } else if (target) {
    // A popover or panel over the window: Orca captured the region of all the app's windows, scaled down.
    const x0 = Math.min(...all.map((w) => w.x)), y0 = Math.min(...all.map((w) => w.y))
    const x1 = Math.max(...all.map((w) => w.x + w.width)), y1 = Math.max(...all.map((w) => w.y + w.height))
    Bun.write(sidecar, JSON.stringify({ scale: shot.width / (x1 - x0), x: target.x - x0, y: target.y - y0, width: x1 - x0, height: y1 - y0 }))
  }
}

/**
 * Captures the scene in light and dark. `prep` runs after each appearance switch, to reopen what the switch closed (a
 * popover, a hover); `post` runs after each capture (close a menu so the next switch can run).
 */
export async function shoot(id: string, options: { prep?: () => Promise<void> | void; post?: () => Promise<void> | void; win?: number; wait?: number } = {}) {
  for (const mode of ['light', 'dark'] as const) {
    // The real pointer rests out of the way (a hover card over the page spoils a shot), unless the scene puts it somewhere.
    if (!options.prep) run([join(ROOT, '.work/mouse'), '1480', '960'])
    appearance(mode)
    await sleep(1)
    if (options.prep) { await options.prep(); await sleep(options.wait ?? 1.2) }
    grab(id, mode, options.win)
    if (options.post) { await options.post(); await sleep(0.6) }
    console.log(`${state.lang} ${id} ${mode}`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const [lang, ...wanted] = process.argv.slice(2)
  if (!LANGS.includes(lang as Lang)) throw new Error(`usage: bun tools/drive.ts <${LANGS.join('|')}> <scene…|--list>`)
  state.lang = lang as Lang
  const { SCENES } = await import('./scenes')
  if (wanted[0] === '--list') {
    console.log(Object.keys(SCENES).join('\n'))
    process.exit(0)
  }
  if (!existsSync(join(ROOT, '.work/set-appearance'))) throw new Error('.work/set-appearance is missing (swiftc tools/src/set-appearance.swift -o .work/set-appearance)')
  // Scenes that are for building others, or whose app behaviour is not right yet, don't run unless named.
  // settings-general: its Language row reads "English, after the next start" in the Debug build whatever the launch language, so other languages keep the English shot.
  const notYet = new Set(['probe', 'requests-websocket-log', ...(lang === 'en' ? [] : ['settings-general'])])
  const names = wanted.length ? wanted : Object.keys(SCENES).filter((n) => !notYet.has(n))
  const failed: string[] = []
  try {
    for (const name of names) {
      if (!SCENES[name]) throw new Error(`no scene ${name}`)
      // A scene that fails (the app took a moment longer) gets one more go on a fresh launch.
      try {
        await SCENES[name]()
      } catch (error) {
        console.error(`${lang} ${name}: ${(error as Error).message}; again`)
        try { await SCENES[name]() } catch (again) { console.error(`${lang} ${name}: FAILED ${(again as Error).message}`); failed.push(name) }
      }
    }
  } finally {
    await quit()
  }
  if (failed.length) { console.error(`failed: ${failed.join(' ')}`); process.exit(1) }
}
