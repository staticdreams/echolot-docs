// The app's own words for the docs' translators: every label in **bold** in the English pages, in each language,
// as the app shows it (the app's string catalogs, ../Echolot).
//
//   bun tools/labels.ts build [../Echolot]      writes .work/l10n/labels.<code>.json for every language and
//                                               .work/l10n/unmatched.json (labels no catalog has)
//   bun tools/labels.ts find <code> <English…>  looks labels up: bun tools/labels.ts find de "Send" "Allow for This Session"
//   bun tools/labels.ts find <code> --like <text>   catalog entries that contain the text (English side), for a label
//                                               that is spelled differently in the docs than in the app
//
// <code> is the docs' code (de es fr ja ko ru zh); the catalogs call Simplified Chinese zh-Hans.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
export const CODES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh'] as const
const catalogCode = (code: string) => (code === 'zh' ? 'zh-Hans' : code)

type Catalog = Record<string, { localizations?: Record<string, { stringUnit?: { value: string }; variations?: unknown }> }>

/** The catalogs of the app and its packages. */
function catalogs(app: string): Catalog[] {
  const files = [
    'Echolot/Localizable.xcstrings',
    'Packages/EcholotUI/Sources/DesignSystem/Localizable.xcstrings',
    'Packages/EcholotUI/Sources/Editors/Localizable.xcstrings',
    'Packages/EcholotUI/Sources/Viewers/Localizable.xcstrings',
    'EcholotQuickLook/Localizable.xcstrings',
  ]
  return files.map((f) => JSON.parse(readFileSync(join(app, f), 'utf8')).strings as Catalog)
}

/** Straight and curly apostrophes and the ellipsis written as three dots are the same label. */
const normalize = (s: string) =>
  s
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\.\.\./g, '…')
    .replace(/\s+/g, ' ')
    .trim()

function index(app: string, code: string) {
  const exact = new Map<string, string>()
  const lower = new Map<string, string>()
  const all: [string, string][] = []
  for (const catalog of catalogs(app)) {
    for (const [key, entry] of Object.entries(catalog)) {
      const value = entry.localizations?.[catalogCode(code)]?.stringUnit?.value
      if (!value || value === key) continue
      const k = normalize(key)
      if (!exact.has(k)) exact.set(k, value)
      if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), value)
      all.push([k, value])
    }
  }
  return { exact, lower, all }
}

/** Every **bold** span of the English pages, and each part of a menu path like **File › New Request**. */
function boldLabels() {
  const labels = new Set<string>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/^[^.]+\.mdx$/.test(name)) {
        const text = readFileSync(path, 'utf8')
        for (const m of text.matchAll(/\*\*([^*\n]+?)\*\*/g)) {
          for (const part of m[1].split(' › ')) labels.add(part.trim())
        }
      }
    }
  }
  walk(join(root, 'content/docs'))
  return [...labels].sort()
}

const [command, ...rest] = process.argv.slice(2)

if (command === 'build') {
  const app = rest[0] ?? '../Echolot'
  mkdirSync(join(root, '.work/l10n'), { recursive: true })
  const labels = boldLabels()
  const unmatched = new Set(labels)
  for (const code of CODES) {
    const { exact, lower } = index(app, code)
    const found: Record<string, string> = {}
    for (const label of labels) {
      const k = normalize(label)
      const value = exact.get(k) ?? lower.get(k.toLowerCase())
      if (value) {
        found[label] = value
        unmatched.delete(label)
      }
    }
    writeFileSync(join(root, `.work/l10n/labels.${code}.json`), `${JSON.stringify(found, null, 2)}\n`)
    console.log(`${code}: ${Object.keys(found).length} of ${labels.length} labels`)
  }
  // Labels in no language: the docs' own words (headings, emphasis), not the app's.
  const missing = labels.filter((l) => {
    for (const code of CODES) if (existsSync(join(root, `.work/l10n/labels.${code}.json`)) && JSON.parse(readFileSync(join(root, `.work/l10n/labels.${code}.json`), 'utf8'))[l]) return false
    return true
  })
  writeFileSync(join(root, '.work/l10n/unmatched.json'), `${JSON.stringify(missing, null, 2)}\n`)
  console.log(`${missing.length} labels in no catalog`)
} else if (command === 'find') {
  const [code, ...queries] = rest
  const app = process.env.ECHOLOT_APP_REPO ?? '../Echolot'
  const { exact, lower, all } = index(app, code)
  const like = queries[0] === '--like'
  for (const q of like ? queries.slice(1) : queries) {
    const k = normalize(q)
    if (like) {
      const hits = all.filter(([key]) => key.toLowerCase().includes(k.toLowerCase())).slice(0, 12)
      console.log(`${q}:`)
      for (const [key, value] of hits) console.log(`  ${key}  →  ${value}`)
    } else {
      console.log(`${q}  →  ${exact.get(k) ?? lower.get(k.toLowerCase()) ?? '(not in the catalogs)'}`)
    }
  }
} else {
  console.log('usage: bun tools/labels.ts build [app] | find <code> <English…> | find <code> --like <text>')
}
