// Writes public/data/catalog-export.json: 40,000 products (about 14 MB), served by GET /v1/products/export from
// static assets so a large body costs the Worker no CPU. Static assets are limited to 25 MiB a file.
import { mkdirSync, writeFileSync } from 'node:fs'
import { bigCatalog } from '../src/catalog'

const out = new URL('../public/data/catalog-export.json', import.meta.url)
mkdirSync(new URL('.', out), { recursive: true })
const text = `${JSON.stringify(bigCatalog(40_000), null, 2)}\n`
writeFileSync(out, text)
console.log(`catalog-export.json: ${(text.length / 1_048_576).toFixed(1)} MB`)
