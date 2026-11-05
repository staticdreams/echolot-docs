// Finds `**bold**` that did not render: CommonMark closes bold only when the closing ** is not between punctuation and a
// letter, so `**Save…**を` (Japanese, Korean, Chinese) stays as literal asterisks. Lists the pages and lines.
//   bun tools/check-bold.ts [--fix] [code…]   --fix writes <strong>…</strong> for the bold spans on the lines that failed
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createProcessor } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'

const root = new URL('..', import.meta.url).pathname
const fix = process.argv.includes('--fix')
const argCodes = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const codes = argCodes.length ? argCodes : ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh']
const processor = createProcessor({ remarkPlugins: [remarkGfm] })
function files(dir: string, out: string[] = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) files(p, out)
    else out.push(p)
  }
  return out
}
function walk(node: any, found: string[]) {
  if (node.type === 'text' && node.value.includes('**')) found.push(`${node.position?.start.line}: ${node.value.replace(/\n/g, ' ').slice(0, 90)}`)
  for (const c of node.children ?? []) walk(c, found)
}
let total = 0
for (const code of codes) {
  let n = 0
  for (const f of files(join(root, 'content/docs')).filter((f) => f.endsWith(`.${code}.mdx`))) {
    let tree
    try {
      tree = processor.parse(readFileSync(f, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, (m) => '\n'.repeat(m.split('\n').length - 1)))
    } catch (error) {
      console.log(`${f.replace(root + 'content/docs/', '')}: DOES NOT PARSE: ${(error as Error).message.split('\n')[0]}`)
      continue
    }
    const found: string[] = []
    walk(tree, found)
    for (const line of found) console.log(`${f.replace(root + 'content/docs/', '')}:${line}`)
    if (fix && found.length) {
      const lines = readFileSync(f, 'utf8').split('\n')
      // A paragraph is one text node, so the failed span can be on any of its lines: every line of the file.
      for (let at = 1; at <= lines.length; at++) {
        // Outside inline code: <strong> in place of the ** pairs on that line.
        lines[at - 1] = lines[at - 1].split(/(`[^`]*`)/).map((part, i) => (i % 2 ? part : part.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))).join('')
      }
      writeFileSync(f, lines.join('\n'))
    }
    n += found.length
  }
  console.log(`${code}: ${n} unrendered bold`)
  total += n
}
process.exit(total ? 1 : 0)
