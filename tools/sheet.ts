// sheet.ts <out.png> <capture…>: a contact sheet of captures (3 across, 600 px each) for a quick review.
import sharp from 'sharp'
const [out, ...files] = process.argv.slice(2)
const W = 600, cols = 3
const tiles = await Promise.all(files.map((f) => sharp(f).resize({ width: W }).png().toBuffer({ resolveWithObject: true })))
const H = Math.max(...tiles.map((t) => t.info.height))
const rows = Math.ceil(tiles.length / cols)
await sharp({ create: { width: W * cols + 10 * (cols + 1), height: (H + 10) * rows + 10, channels: 3, background: '#888' } })
  .composite(tiles.map((t, i) => ({ input: t.data, left: 10 + (i % cols) * (W + 10), top: 10 + Math.floor(i / cols) * (H + 10) })))
  .png().toFile(out)
