# Writing the Echolot docs

## Voice

- Write for someone who builds or tests APIs and has just opened Echolot. Say what they can do and how, in the order
  they do it. Second person, present tense, active voice: "Choose **New Request**", not "A new request can be created".
- Plain words and short sentences. One idea per sentence. No marketing ("powerful", "seamless", "blazing"), no
  filler ("simply", "just", "easily"), no exclamation marks.
- Explain *why* only when it changes what the reader does ("Secrets stay in the Keychain, so you can commit the
  workspace").
- Be exact. Every label, menu path, shortcut, default and limit must match the app. If you can't confirm something,
  leave it out.

## Formatting

- Front matter: `title` (the page's name, as in the sidebar) and `description` (one sentence, what the page helps
  with).
- UI labels in **bold**, exactly as the app shows them: **Send**, **New Request**. Menu paths with ›: **File › New
  Request**. Settings: **Settings › Agents**. Keys with `<kbd>`: <kbd>⌘</kbd><kbd>↩</kbd>.
- Code, file names, variables and values in backticks: `{{baseURL}}`, `workspace.toml`.
- Steps as a numbered list, or `<Steps>`/`<Step>` for longer procedures. Tables for options and their meaning.
- Link other pages by their path: `[environments](/docs/workspaces/environments)`. Link generously, but once per page
  for the same target is enough.
- Headings are sentence case. Start each page with one or two sentences saying what the feature is for, then how to
  use it, then details and options, then troubleshooting if useful.

## The two editions

Echolot comes as a direct download and as a Mac App Store edition. Pages never split by edition. Where they differ,
say so in place:

```mdx
<Edition only="direct">
  MCP servers that run as a local program (stdio) work in the direct download. In the App Store edition, add the
  server over HTTP, or run it with the command-line tool.
</Edition>
```

`only="direct"` marks what only the direct download does; `only="appstore"` marks how the App Store edition does
something differently. Both link to the Editions page.

## Screenshots

Screenshots are of the real app with the **Alpenglow** example workspace (`examples/alpenglow.ts`), light and dark.
Put one where it helps the reader find something, not on every heading:

```mdx
<Shot id="requests-response-json" alt="A JSON response in the tree view, with the status, time and size above it" />
```

- `id`: `<section>-<what>`, lowercase with hyphens, unique across the site.
- `alt`: what the picture shows, for someone who can't see it.
- Add every new id to `shots/<section>.json` with what the scene needs, so it can be retaken after the app changes:

```json
{
  "id": "requests-response-json",
  "page": "requests/responses",
  "scene": "Alpenglow, no environment. Open Catalog › List products and send it. Response pane on Body › Tree.",
  "frame": "window"
}
```

`frame` is `window` for the whole window, or a description of the part to crop ("the response pane",
"the auth tab and the sidebar").

## Examples

Use the Alpenglow shop and the demo API (`https://demo.echolot.dev`, see `/docs/tutorials/demo-api`) for examples,
so readers can try them. Don't use real companies' APIs or anyone's real data.

## Translations

The docs come in English and seven more languages: German `de`, Spanish `es`, French `fr`, Japanese `ja`, Korean
`ko`, Russian `ru` and Simplified Chinese `zh`. English is the source: write or change an English page first, then
bring the translations along. A page with no translation yet shows in English, so languages can lag a page behind.

### Files

A translation sits beside the English page: `content/docs/requests/auth.mdx` has `auth.de.mdx`, `auth.fr.mdx` and so
on. A folder's sidebar title is `meta.<code>.json` beside `meta.json` (translate `title`; keep `pages` as it is).
`whats-new.<code>.mdx` is made by `bun tools/sync-whats-new.ts`, from the app's own translated release notes: don't
write it.

### What a translation keeps

- Front matter: `title` and `description`, translated, in double quotes when they hold a colon.
- The page's structure: the same headings (number and level), tables, lists, steps, callouts, cards and examples, in
  the same order. Don't add, drop or merge anything. Headings get the English anchor automatically
  (`bun tools/check-l10n.ts --fix <code>` writes `[#english-anchor]` after each heading), so links to a heading keep
  working: link as the English page does, `[x](/docs/ai/assistant#the-one-time-permission)`. The site adds the
  language's prefix to `/docs/...` links itself.
- Code, inline `code`, file names, variables (`{{baseURL}}`), `<kbd>` keys, URLs, `<Shot id>`, component names and
  props, and the product and protocol names the glossary lists. Code blocks stay as they are; only comments in them
  may be translated.
- The Alpenglow workspace's own names, which are data and stay English everywhere: its folders (Auth, Catalog, Orders,
  Echo, Realtime, Inventory…), requests (List products, Sign in…), environments and flows.

### What a translation changes

- All prose, table cells, link text, `alt` texts of `<Shot>`, callout and card titles, `<Edition>` text.
- The app's labels, in **bold**, are the app's own words in that language, not a fresh translation. The labels each
  page uses are in `.work/l10n/labels.<code>.json` (made by `bun tools/labels.ts build`); look any other up with
  `bun tools/labels.ts find <code> "Allow for This Session"`, or search the English side with
  `bun tools/labels.ts find <code> --like "allow for"`. Menu paths keep ` › ` between the parts: **Datei › Neue
  Anfrage**. A bold phrase that isn't an app label (emphasis, a heading-like lead-in) is translated as prose.
- macOS's own words follow Apple's German, Spanish, French, Japanese, Korean, Russian or Chinese: the **Help** menu
  (Hilfe, Ayuda, Aide, ヘルプ, 도움말, Справка, 帮助), System Settings, Finder, Keychain (Schlüsselbund…) and so on. Each
  language's glossary in the app repository (`Echolot/docs/Localization-Glossary-<language>.md`) fixes the terms and the
  style; follow it.
- The voice of the English pages carries over: plain, second person, present tense, no marketing. It reads as if
  written in the language, not translated from English.

### Checking

`bun tools/check-l10n.ts [--fix] [<code>…] [--pages=a,b]` checks translations against the English pages (structure,
`<Shot>` ids, links, code, MDX that compiles) and warns about labels the app words differently. Fix every error. Look
at every warning: a label may be correct in the page's grammar and still differ from the catalog's form.

Japanese, Korean and Chinese run text straight into `**bold**` (`**保存…**を選びます`), which CommonMark does not close
next to punctuation and a letter. After `check-l10n.ts`, run `bun tools/check-bold.ts --fix ja ko zh`: it finds the
bold that would show as asterisks and writes `<strong>…</strong>` for it. (Run `check-l10n.ts` first: it reads `**`.)
`bun tools/sync-whats-new.ts` rewrites every language's What's new from the app's release notes.
