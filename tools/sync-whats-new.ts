// Writes the What's new page in every language from the app's release notes, which carry their own translations:
//
//   bun tools/sync-whats-new.ts [../Echolot]      the app repository (default ../Echolot)
//
// Reads <app>/Echolot/Resources/changelog.json (what Help › What's New in Echolot shows) and writes
// content/docs/whats-new.mdx (English) and whats-new.<code>.mdx for the other languages. English keeps the older
// releases the app no longer lists (from "## 0.4.0" on, as they stand in the file); the other languages list what the
// app translated and point to English for the rest. Never edit these pages by hand: change the changelog and run this.
import { readFileSync, writeFileSync } from 'node:fs'

const app = process.argv[2] ?? '../Echolot'
const root = new URL('..', import.meta.url).pathname
const releases = JSON.parse(readFileSync(`${app}/Echolot/Resources/changelog.json`, 'utf8')) as {
  version: string
  build: number
  date: string
  changes: { type: 'feature' | 'improvement' | 'fix'; text: string; translations?: Record<string, string> }[]
}[]

/** The docs' language codes, the app's catalog code for each, and the words the page needs in it. */
const languages = {
  en: {
    app: 'en', locale: 'en-US', build: 'build', new: 'New', improvement: 'Improvements', fix: 'Fixes',
    title: "What's new",
    description: 'The release notes of every Echolot release, newest first.',
    intro: "These are the notes Echolot shows in **Help › What's New in Echolot**, newest first. Every release and its downloads are also on the [releases page](https://github.com/staticdreams/echolot-public/releases).",
    older: '',
  },
  de: {
    app: 'de', locale: 'de-DE', build: 'Build', new: 'Neu', improvement: 'Verbesserungen', fix: 'Fehlerbehebungen',
    title: 'Neuigkeiten',
    description: 'Die Versionshinweise jeder Echolot-Version, die neueste zuerst.',
    intro: 'Das sind die Hinweise, die Echolot unter **Hilfe › Neu in Echolot** zeigt, die neueste Version zuerst. Jede Version und ihre Downloads stehen auch auf der [Releases-Seite](https://github.com/staticdreams/echolot-public/releases).',
    older: 'Die Hinweise früherer Versionen stehen in der [englischen Fassung](/docs/whats-new).',
  },
  es: {
    app: 'es', locale: 'es-ES', build: 'compilación', new: 'Novedades', improvement: 'Mejoras', fix: 'Correcciones',
    title: 'Novedades',
    description: 'Las notas de versión de cada versión de Echolot, la más reciente primero.',
    intro: 'Estas son las notas que Echolot muestra en **Ayuda › Novedades de Echolot**, la versión más reciente primero. Cada versión y sus descargas están también en la [página de versiones](https://github.com/staticdreams/echolot-public/releases).',
    older: 'Las notas de las versiones anteriores están en la [versión en inglés](/docs/whats-new).',
  },
  fr: {
    app: 'fr', locale: 'fr-FR', build: 'build', new: 'Nouveautés', improvement: 'Améliorations', fix: 'Corrections',
    title: 'Nouveautés',
    description: 'Les notes de version de chaque version d’Echolot, la plus récente en premier.',
    intro: 'Voici les notes qu’Echolot affiche dans **Aide › Nouveautés d’Echolot**, la version la plus récente en premier. Chaque version et ses téléchargements sont aussi sur la [page des versions](https://github.com/staticdreams/echolot-public/releases).',
    older: 'Les notes des versions précédentes sont dans la [version anglaise](/docs/whats-new).',
  },
  ja: {
    app: 'ja', locale: 'ja-JP', build: 'ビルド', new: '新機能', improvement: '改善', fix: '修正',
    title: '新着情報',
    description: 'Echolot の各バージョンのリリースノートです。新しいものから順に並んでいます。',
    intro: 'Echolot が **ヘルプ › Echolotの新機能** に表示するリリースノートです。新しいものから順に並んでいます。各バージョンとそのダウンロードは[リリースページ](https://github.com/staticdreams/echolot-public/releases)にもあります。',
    older: '以前のバージョンのリリースノートは[英語版](/docs/whats-new)にあります。',
  },
  ko: {
    app: 'ko', locale: 'ko-KR', build: '빌드', new: '새로운 기능', improvement: '개선 사항', fix: '수정 사항',
    title: '새로운 소식',
    description: 'Echolot 각 버전의 릴리스 노트입니다. 최신 버전이 먼저 나옵니다.',
    intro: 'Echolot이 **도움말 › Echolot의 새로운 기능**에 보여 주는 릴리스 노트이며, 최신 버전이 먼저 나옵니다. 각 버전과 다운로드는 [릴리스 페이지](https://github.com/staticdreams/echolot-public/releases)에도 있습니다.',
    older: '이전 버전의 릴리스 노트는 [영어판](/docs/whats-new)에 있습니다.',
  },
  ru: {
    app: 'ru', locale: 'ru-RU', build: 'сборка', new: 'Новое', improvement: 'Улучшения', fix: 'Исправления',
    title: 'Что нового',
    description: 'Примечания к выпускам Echolot, самые новые первыми.',
    intro: 'Эти примечания Echolot показывает в меню **Справка › Что нового в Echolot**, самые новые первыми. Каждый выпуск и его загрузки есть и на [странице выпусков](https://github.com/staticdreams/echolot-public/releases).',
    older: 'Примечания к более ранним выпускам есть в [английской версии](/docs/whats-new).',
  },
  zh: {
    app: 'zh-Hans', locale: 'zh-CN', build: '构建', new: '新增', improvement: '改进', fix: '修复',
    title: '更新内容',
    description: 'Echolot 每个版本的发行说明，最新的在最前。',
    intro: '这是 Echolot 在 **帮助 › Echolot 的新功能** 中显示的发行说明，最新的在最前。每个版本及其下载也可在[发布页面](https://github.com/staticdreams/echolot-public/releases)找到。',
    older: '更早版本的发行说明见[英文版](/docs/whats-new)。',
  },
} as const

type Code = keyof typeof languages

/** Text in MDX: `{{…}}` and a lone `"""` are code, as in the rest of the docs; ⌘ keys stay as written. */
function mdx(text: string) {
  const code = (m: string) => `\`${m}\``
  return text
    .replace(/\{\{[^}]*\}\}|\{[^{}]*\}/g, code)
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/\{\{/g, '`{{`').replace(/"""/g, '`"""`')))
    .join('')
}

const cjk = new Set<Code>(['ja', 'ko', 'zh'])
/** Wraps at 120 columns the way the other pages are written; Japanese, Korean and Chinese have no spaces to wrap at. */
function bullet(text: string, code: Code) {
  if (cjk.has(code)) return `- ${text}`
  const lines: string[] = []
  let line = '-'
  for (const word of text.split(' ')) {
    if (line.length + 1 + word.length > 118 && line !== '-') {
      lines.push(line)
      line = ` ${word}`
    } else {
      line += ` ${word}`
    }
  }
  lines.push(line)
  return lines.map((l, i) => (i === 0 ? l : `  ${l.trimStart()}`)).join('\n')
}

function page(code: Code, keepOlder: string) {
  const l = languages[code]
  const out: string[] = ['---', `title: ${JSON.stringify(l.title)}`, `description: ${JSON.stringify(l.description)}`, '---', '', l.intro, '']
  for (const release of releases) {
    const date = new Intl.DateTimeFormat(l.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${release.date}T12:00:00Z`))
    out.push(`## ${release.version}`, '', `*${date} · ${l.build} ${release.build}*`, '')
    for (const [type, heading] of [['feature', l.new], ['improvement', l.improvement], ['fix', l.fix]] as const) {
      const changes = release.changes.filter((c) => c.type === type)
      if (!changes.length) continue
      out.push(`**${heading}**`, '')
      for (const c of changes) {
        const text = code === 'en' ? c.text : c.translations?.[l.app]
        if (!text) throw new Error(`${release.version}: no ${l.app} text for “${c.text.slice(0, 50)}…”`)
        out.push(bullet(mdx(text), code))
      }
      out.push('')
    }
  }
  if (code === 'en') out.push(keepOlder.trimEnd(), '')
  else out.push(l.older, '')
  return out.join('\n')
}

// English keeps what is older than the app's own list.
const english = readFileSync(`${root}content/docs/whats-new.mdx`, 'utf8')
const oldest = releases[releases.length - 1].version
const older = english.slice(english.indexOf('## ', english.indexOf(`## ${oldest}`) + 1))

const only = process.env.ONLY?.split(',')
for (const code of Object.keys(languages) as Code[]) {
  if (only && !only.includes(code)) continue
  const path = `${root}content/docs/whats-new${code === 'en' ? '' : `.${code}`}.mdx`
  writeFileSync(path, page(code, older))
  console.log(path.replace(root, ''))
}
