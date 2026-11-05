// Checks the translated pages against the English ones, and gives their headings the English anchors.
//
//   bun tools/check-l10n.ts [code…]            check every translated page of these languages (default: all)
//   bun tools/check-l10n.ts --fix [code…]      first add `[#english-anchor]` to each translated heading that has none
//   bun tools/check-l10n.ts --pages=a,b [code]  only these pages (paths below content/docs, no extension)
//
// A translated page is content/docs/<page>.<code>.mdx beside <page>.mdx; the sidebar's titles are
// <folder>/meta.<code>.json beside meta.json. What a translation must keep: the front matter's keys, the headings (same
// number and level; anchors stay the English ones so links between pages work), every <Shot> id, <Edition> kind, link
// target, code block, inline code span and <kbd>; and it must compile as MDX. It should show the app's own words for
// the labels in bold (tools/labels.ts). Errors fail the check; warnings are for a person to look at.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse as parseYaml } from 'yaml'

const root = new URL('..', import.meta.url).pathname
const docs = join(root, 'content/docs')
const CODES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh']

const args = process.argv.slice(2)
const fix = args.includes('--fix')
const pagesOnly = args.find((a) => a.startsWith('--pages='))?.slice('--pages='.length).split(',')
const codes = args.filter((a) => CODES.includes(a))
const languages = codes.length ? codes : CODES

/** The English pages: path below content/docs without extension. */
function englishPages(dir = docs, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) englishPages(path, out)
    else if (/^[^.]+\.mdx$/.test(name)) out.push(relative(docs, path).replace(/\.mdx$/, ''))
  }
  return out.sort()
}

/** GitHub-style anchor of a heading, as Fumadocs makes it (github-slugger). */
function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\- _]/gu, '')
    .trim()
    .replace(/ /g, '-')
}

function split(text: string) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  return { front: m?.[1] ?? '', body: m?.[2] ?? text }
}
const frontKeys = (front: string) => [...front.matchAll(/^(\w+):/gm)].map((m) => m[1])

/** Headings outside code fences: [level, text, existing custom id]. */
function headings(body: string) {
  const out: { level: number; text: string; id?: string; line: number }[] = []
  let fenced = false
  body.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    if (fenced) return
    const m = line.match(/^(#{1,6}) +(.*?)\s*$/)
    if (!m) return
    const id = m[2].match(/\s*\[#([^\]]+)\]$/)
    out.push({ level: m[1].length, text: id ? m[2].slice(0, id.index) : m[2], id: id?.[1], line: i })
  })
  return out
}

/** Code blocks by line: a fence opens with ``` or ~~~ (indented or not) and closes with the same marker. */
function scanFences(body: string) {
  const blocks: { lang: string; code: string }[] = []
  const rest: string[] = []
  let open: { marker: string; lang: string; lines: string[] } | undefined
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(```+|~~~+)(.*)$/)
    if (!open) {
      if (m) open = { marker: m[1][0], lang: m[2].trim().split(/\s/)[0], lines: [] }
      else rest.push(line)
    } else if (m && m[1][0] === open.marker && m[2].trim() === '') {
      blocks.push({ lang: open.lang, code: open.lines.join('\n') })
      open = undefined
    } else {
      open.lines.push(line)
    }
  }
  return { blocks, rest: rest.join('\n') }
}
const fences = (body: string) => scanFences(body).blocks
const withoutFences = (body: string) => scanFences(body).rest
const inlineCode = (body: string) => [...withoutFences(body).matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).sort()
const shotIds = (body: string) => [...body.matchAll(/<Shot\s+id="([^"]+)"/g)].map((m) => m[1])
const editions = (body: string) => [...body.matchAll(/<Edition\s+only="([^"]+)"/g)].map((m) => m[1])
const kbds = (body: string) => (body.match(/<kbd>/g) ?? []).length
const links = (body: string) =>
  [...withoutFences(body).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)|href="([^"]+)"/g)].map((m) => (m[1] ?? m[2]).replace(/^https?:\/\/docs\.echolot\.dev/, ''))
const bolds = (body: string) => [...withoutFences(body).matchAll(/\*\*([^*\n]+?)\*\*/g)].map((m) => m[1])
const tags = (body: string) => [...body.matchAll(/<(\/?)(Steps|Step|Tabs|Tab|Cards|Card|Callout|Accordion|Accordions)\b/g)].map((m) => m[1] + m[2]).join(',')

async function compiles(source: string) {
  const { compile } = await import('@mdx-js/mdx')
  const gfm = await import('remark-gfm').then((m) => m.default).catch(() => undefined)
  await compile(source, { remarkPlugins: gfm ? [gfm] : [] })
}

let errors = 0
let warnings = 0
const report = (level: 'error' | 'warn', where: string, message: string) => {
  if (level === 'error') errors++
  else warnings++
  console.log(`${level === 'error' ? 'ERROR' : 'warn '} ${where}: ${message}`)
}

const multiset = (a: string[]) => {
  const m = new Map<string, number>()
  for (const x of a) m.set(x, (m.get(x) ?? 0) + 1)
  return m
}
function diff(a: string[], b: string[]) {
  const ma = multiset(a)
  const mb = multiset(b)
  const missing: string[] = []
  const extra: string[] = []
  for (const [k, n] of ma) if ((mb.get(k) ?? 0) < n) missing.push(k)
  for (const [k, n] of mb) if ((ma.get(k) ?? 0) < n) extra.push(k)
  return { missing, extra }
}

for (const code of languages) {
  const labelFile = join(root, `.work/l10n/labels.${code}.json`)
  const labels: Record<string, string> = existsSync(labelFile) ? JSON.parse(readFileSync(labelFile, 'utf8')) : {}
  let pages = 0
  for (const page of englishPages()) {
    if (pagesOnly && !pagesOnly.includes(page)) continue
    // whats-new is made by tools/sync-whats-new.ts.
    if (page === 'whats-new') continue
    const path = join(docs, `${page}.${code}.mdx`)
    if (!existsSync(path)) continue
    pages++
    const where = `${code}/${page}`
    const en = readFileSync(join(docs, `${page}.mdx`), 'utf8')
    let tr = readFileSync(path, 'utf8')
    const e = split(en)
    let t = split(tr)

    if (fix) {
      const eh = headings(e.body)
      const th = headings(t.body)
      if (eh.length === th.length) {
        const lines = t.body.split('\n')
        th.forEach((h, i) => {
          if (h.id) return
          const id = eh[i].id ?? slug(eh[i].text)
          lines[h.line] = `${'#'.repeat(h.level)} ${h.text} [#${id}]`
        })
        tr = `---\n${t.front}\n---\n${lines.join('\n')}`
        writeFileSync(path, tr)
        t = split(tr)
      }
    }

    const ek = frontKeys(e.front)
    const tk = frontKeys(t.front)
    if (ek.join() !== tk.join()) report('error', where, `front matter keys ${tk.join(',')} (English: ${ek.join(',')})`)
    // The front matter must be YAML a build can read: one line each, double-quoted when it holds a colon.
    try {
      const data = parseYaml(t.front) as Record<string, unknown>
      for (const key of ['title', 'description']) if (typeof data?.[key] !== 'string' || !(data[key] as string).trim()) report('error', where, `front matter ${key} is not a text`)
    } catch (error) {
      report('error', where, `front matter is not YAML (put title and description on one line, in double quotes): ${(error as Error).message.split('\n')[0]}`)
    }
    for (const key of ['title', 'description']) {
      const value = t.front.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'))?.[1]?.trim()
      if (!value) report('error', where, `no ${key}`)
      // YAML: a plain value cannot hold ": " or " #" or start with a quote-like or special character.
      else if (!/^(".*"|'.*')$/.test(value) && (/: | #/.test(value) || /^[\[\]{}>|*&!%@`'"#,-]/.test(value))) report('error', where, `${key} must be in double quotes (it has a colon or special character): ${value.slice(0, 50)}`)
    }

    const eh = headings(e.body)
    const th = headings(t.body)
    if (eh.length !== th.length) report('error', where, `${th.length} headings (English: ${eh.length})`)
    else
      eh.forEach((h, i) => {
        if (h.level !== th[i].level) report('error', where, `heading ${i + 1} is level ${th[i].level}, English ${h.level}`)
        const want = h.id ?? slug(h.text)
        if (th[i].id !== want) report('error', where, `heading “${th[i].text}” has anchor ${th[i].id ?? '(none)'}, want [#${want}] (run --fix)`)
      })

    const ids = diff(shotIds(e.body), shotIds(t.body))
    if (ids.missing.length || ids.extra.length || shotIds(e.body).join() !== shotIds(t.body).join()) report('error', where, `<Shot> ids differ: missing ${ids.missing}, extra ${ids.extra}`)
    if (editions(e.body).join() !== editions(t.body).join()) report('error', where, `<Edition> kinds differ`)
    if (tags(e.body) !== tags(t.body)) report('error', where, `component tags differ (Steps/Step/Tabs/Cards/Callout)`)

    const ef = fences(e.body)
    const tf = fences(t.body)
    if (ef.length !== tf.length) report('error', where, `${tf.length} code blocks (English: ${ef.length})`)
    else
      ef.forEach((f, i) => {
        if (f.lang !== tf[i].lang) report('error', where, `code block ${i + 1} is ${tf[i].lang}, English ${f.lang}`)
        // Code stays as it is; its comments may be translated, so only compare the lines that are not comments.
        const strip = (s: string) => s.split('\n').filter((l) => !/^\s*(#|\/\/)/.test(l)).join('\n')
        if (strip(f.code) !== strip(tf[i].code)) report('warn', where, `code block ${i + 1} differs from the English (outside comments)`)
      })

    const ic = diff(inlineCode(e.body), inlineCode(t.body))
    if (ic.missing.length || ic.extra.length) report('warn', where, `inline code differs: missing ${JSON.stringify(ic.missing.slice(0, 6))}, extra ${JSON.stringify(ic.extra.slice(0, 6))}`)
    if (kbds(e.body) !== kbds(t.body)) report('warn', where, `${kbds(t.body)} <kbd> (English: ${kbds(e.body)})`)

    const lk = diff(links(e.body).filter((l) => !l.startsWith('#')), links(t.body).filter((l) => !l.startsWith('#')))
    // A translation may link to the same page with the anchor's English id; compare the target, anchors aside, as a set.
    const targets = (a: string[]) => [...new Set(a.map((l) => l.replace(/^\/(de|es|fr|ja|ko|ru|zh)\//, '/')))].sort()
    const lm = diff(targets(links(e.body)), targets(links(t.body)))
    if (lm.missing.length || lm.extra.length) report('error', where, `links differ: missing ${JSON.stringify(lm.missing)}, extra ${JSON.stringify(lm.extra)}`)
    void lk

    // The app's words: each bold label the app has a translation for should appear in the page.
    const missing: string[] = []
    for (const b of new Set(bolds(e.body).flatMap((x) => x.split(' › ')))) {
      const word = labels[b.trim()]
      if (word && !tr.includes(word)) missing.push(`${b} → ${word}`)
    }
    if (missing.length) report('warn', where, `labels not shown as the app has them (${missing.length}): ${missing.slice(0, 8).join('; ')}`)
    const eb = bolds(e.body).length
    const tb = bolds(t.body).length
    if (Math.abs(eb - tb) > Math.max(3, eb * 0.15)) report('warn', where, `${tb} bold spans (English: ${eb})`)

    try {
      await compiles(tr)
    } catch (error) {
      report('error', where, `does not compile as MDX: ${(error as Error).message.split('\n')[0]}`)
    }
  }
  // Sidebar titles.
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name === 'meta.json') {
        const tpath = join(dir, `meta.${code}.json`)
        if (!existsSync(tpath)) continue
        try {
          const en = JSON.parse(readFileSync(path, 'utf8'))
          const tr = JSON.parse(readFileSync(tpath, 'utf8'))
          if (JSON.stringify(en.pages) !== JSON.stringify(tr.pages)) report('error', `${code}/${relative(docs, tpath)}`, 'pages differ from meta.json')
          if (!tr.title) report('error', `${code}/${relative(docs, tpath)}`, 'no title')
        } catch (error) {
          report('error', `${code}/${relative(docs, tpath)}`, (error as Error).message)
        }
      }
    }
  }
  walk(docs)
  console.log(`${code}: ${pages} pages`)
}
console.log(`${errors} errors, ${warnings} warnings`)
process.exit(errors ? 1 : 0)
