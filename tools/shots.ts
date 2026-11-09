// Turns window captures (.work/captures/<id>-light.png and -dark.png, 2x Retina) into the site's screenshots:
// public/shots/<id>-light.webp and -dark.webp, cropped as shots/*.json says, and their size in points in
// src/lib/shots.json for <Shot>.
//
//   bun tools/shots.ts            every capture that has both appearances
//   bun tools/shots.ts <id> …     only these
//   bun tools/shots.ts --lang de [<id> …]   a language's captures (.work/captures/de/, from tools/drive.ts) into
//                                 public/shots/de/ and src/lib/shots.l10n.json
//
// A shot request may carry "crop": [x, y, width, height] in points of the window (the capture is 2x), and "crops":
// { "<lang>": [x, y, width, height] } for languages whose longer words move what is shown (a popover under a wider
// header button, an inspector whose text wraps further).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const root = new URL('..', import.meta.url).pathname
const argv = process.argv.slice(2)
const langAt = argv.indexOf('--lang')
const lang = langAt >= 0 ? argv[langAt + 1] : undefined
if (langAt >= 0) argv.splice(langAt, 2)
const captures = `${root}.work/captures${lang ? `/${lang}` : ''}`
const outDir = `${root}public/shots${lang ? `/${lang}` : ''}`
mkdirSync(outDir, { recursive: true })
const manifestPath = `${root}src/lib/shots${lang ? '.l10n' : ''}.json`

type Box = [number, number, number, number]
type Request = { id: string; crop?: Box; crops?: Record<string, Box>; cropPx?: Box }
const requests = new Map<string, Request>()
for (const file of readdirSync(`${root}shots`).filter((f) => f.endsWith('.json'))) {
  for (const r of JSON.parse(readFileSync(`${root}shots/${file}`, 'utf8')) as Request[]) requests.set(r.id, r)
}

type Sizes = Record<string, { width: number; height: number }>
const whole = JSON.parse(readFileSync(manifestPath, 'utf8')) as Sizes | Record<string, Sizes>
// English: id → size. Another language: language → id → size.
const manifest = (lang ? ((whole as Record<string, Sizes>)[lang] ??= {}) : whole) as Sizes
const wanted = argv
const ids = wanted.length
  ? wanted
  : [...new Set(readdirSync(captures).filter((f) => f.endsWith('-light.png')).map((f) => f.replace(/-light\.png$/, '')))]

const SCALE = 2
const MAX_WIDTH = 2400 // pixels; a full window at 2x is 3024

for (const id of ids) {
  const files = ['light', 'dark'].map((mode) => `${captures}/${id}-${mode}.png`)
  if (!files.every(existsSync)) {
    console.warn(`${id}: needs both ${id}-light.png and ${id}-dark.png`)
    continue
  }
  const crop = (lang ? requests.get(id)?.crops?.[lang] : undefined) ?? requests.get(id)?.crop
  let size = { width: 0, height: 0 }
  for (const [i, mode] of ['light', 'dark'].entries()) {
    let image = sharp(files[i])
    // The capture's scale (2 for a Retina window capture; less when Orca had to take it smaller).
    const sidecar = `${captures}/${id}-${mode}.json`
    // A region capture (a popover open): the window's offset in the region and the region's size, in points.
    const region = existsSync(sidecar)
      ? (JSON.parse(readFileSync(sidecar, 'utf8')) as { scale: number; x: number; y: number; width: number; height: number })
      : undefined
    const scale = region?.scale ?? SCALE
    // cropPx: a crop in the capture's own pixels, for captures whose layout isn't the window's (an open menu).
    const cropPx = requests.get(id)?.cropPx
    const box = cropPx
      ? cropPx.map((n) => n / scale)
      : crop ? [crop[0] + (region?.x ?? 0), crop[1] + (region?.y ?? 0), crop[2], crop[3]] : region ? [0, 0, region.width, region.height] : undefined
    if (box) {
      // Clamped to the capture, so a crop that runs past an edge keeps what is there.
      const meta = await sharp(files[i]).metadata()
      const [x, y, w, h] = box.map((n) => Math.round(n * scale))
      const left = Math.min(Math.max(0, x), (meta.width ?? 0) - 1)
      const top = Math.min(Math.max(0, y), (meta.height ?? 0) - 1)
      image = image.extract({ left, top, width: Math.min(w, (meta.width ?? 0) - left), height: Math.min(h, (meta.height ?? 0) - top) })
    }
    const buffer = await image.png().toBuffer()
    const meta = await sharp(buffer).metadata()
    const width = Math.min(meta.width ?? MAX_WIDTH, MAX_WIDTH)
    const out = sharp(buffer).resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 5 })
    const info = await out.toFile(`${outDir}/${id}-${mode}.webp`)
    // Shown at the size in points it covers (a region capture has fewer pixels per point than 2x).
    size = { width: Math.round(info.width / scale), height: Math.round(info.height / scale) }
  }
  manifest[id] = size
  console.log(`${id}: ${size.width}×${size.height} pt`)
}

const sorted = (m: Sizes) => Object.fromEntries(Object.entries(m).sort())
const result = lang ? Object.fromEntries(Object.entries(whole as Record<string, Sizes>).sort().map(([k, v]) => [k, sorted(v)])) : sorted(manifest)
writeFileSync(manifestPath, `${JSON.stringify(result, null, 2)}\n`)
