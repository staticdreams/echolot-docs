# Echolot documentation: plan

docs.echolot.dev: the user documentation for Echolot (the Mac app, both editions, the CLI and CI).
A sibling of `echolot-website`, its own repository, deployed the same way.

## 1. Stack (owner decision, Nov 1, 2026)

**Fumadocs on TanStack Start, prerendered to static files** (`create-fumadocs-app --template tanstack-start-spa`,
Vite). The site started on Next.js (static export) the same day and moved to TanStack Start, the owner's choice:
both give the same static output; TanStack Start builds with Vite like the website.

`bun run build` writes `.output/public`: every page as `docs/<page>/index.html` (rendered at build time, so crawlers
read it), a Markdown copy of each page (`/docs/<page>.md`), the Orama search index (`/api/search`, searched in the
browser), link-preview images (`/og/docs/<page>/image.webp`, takumi), `llms.txt` and `llms-full.txt`. The app shell
renders from `/404` and doubles as `404.html`; `/` is a page of its own.

**Hosting: Cloudflare static assets, no Worker code** (owner decision, Nov 1, 2026: static files only). Connecting the
repository in the dashboard made a Worker (`echolot-docs`) rather than a Pages project, so `wrangler.jsonc` makes it an
assets-only Worker: Cloudflare serves `out/` with no code running (free and unlimited, `_headers` as on Pages),
unknown paths get `404.html`, custom domain `docs.echolot.dev`. Workers Builds deploys every push to `main`
(`wrangler deploy` runs `bun run build` first); live since Nov 1, 2026. Generated pages are committed (section 6), so
the build never needs the private app repository. By hand: `bunx wrangler deploy`.

**Repository: public**, `staticdreams/echolot-docs` (owner decision, Nov 1, 2026): visible on GitHub, anyone can file a
fix to a page. Only documentation lives here: never code, internal plans or audit notes from the app repository.

Search: Orama static is right up to a few hundred pages (the browser downloads the index). Algolia DocSearch (free
for open docs) if it ever grows past that.

## 2. Information architecture

One tree for both editions. Pages say when something differs, never two copies of a page (section 3).

1. **Get started**: what Echolot is; download or App Store (which to pick, links to section 3); first request in two
   minutes; the window tour (sidebar modules, page header, tabs, ⌘1–⌘5, ⌘J); importing what you have (Postman,
   Insomnia, OpenAPI, HAR, cURL, Paw, Bruno).
2. **Workspaces**: a workspace is a folder of TOML files (`.echolot`); folders and inherited settings; Git and
   teams; environments, variables and secrets (Keychain, never in files); protected environments; history; storage
   encryption; exporting.
3. **Requests** (one page each, same shape: create, send, read the response, save, test): HTTP (body types, auth
   incl. OAuth 2, Digest, AWS, Hawk, EdgeGrid, NTLM; cookies, redirects, proxies, certificates, HTTP/2 and HTTP/3),
   GraphQL, gRPC, WebSocket and SSE, Socket.IO, MQTT, MCP requests; response viewers (huge bodies, trees, hex, wire
   view, timing); dynamic values and response captures; scripts and tests (`pm.*`); the runner and data-driven runs.
4. **MCP Servers**: adding servers (HTTP, stdio, importing other clients' configs), calling tools, OAuth sign-in,
   "How a model sees this server" (quality).
5. **Specs and Mocks**: designing OpenAPI in the visual and text editors, lint, specs from traffic, `.proto` files;
   mock servers, examples, JavaScript routes, sharing on the network.
6. **Flows (EchoFlows)**: the canvas, blocks and links, inputs and outputs, Approve blocks, templates, schedules and
   webhooks, running flows from the CLI.
7. **AI**: the Assistant (providers, keys, on-device and Ollama, approvals, what it can and cannot touch, the
   one-time permission per provider); external agents (Settings › Agents, toolsets, client setup for Claude Code,
   Claude Desktop, Cursor, VS Code, Codex); Echo.
8. **Quick Send and Shortcuts**.
9. **CLI and CI**: install; every command (`send`, `run`, `validate`, `import`, `export`, `mcp …`, `spec …`,
   `graphql diff`, `grpc …`, `mqtt …`, `mock`, `flow …`, `agent`); reporters; GitHub Action and Docker image.
10. **Tutorials** (section 4).
11. **Reference**: workspace file format, dynamic values, `pm.*` script API, keyboard shortcuts, settings, CLI flags,
    exit codes. Generated where the app has one source (section 6).
12. **Privacy and security**, **Troubleshooting**, **What's new** (from `changelog.json`).

## 3. The two editions

A page **Editions** with the full table (source: `Echolot/docs/AppStore-Plan.md` §2, kept in sync), and inline marks
everywhere else:

- `<Edition only="direct">…</Edition>` and `<Edition only="appstore">…</Edition>`: a callout ("Direct download only",
  "In the App Store edition: …") with a link to the Editions page. Pages never hide content by edition: a reader
  should see what the other edition does.
- An "Available in" badge in the page header from front matter (`editions: [direct, appstore]`).

What differs, in readers' words:

| | Direct download | Mac App Store |
| --- | --- | --- |
| Every protocol, workspaces, scripts, tests, runner, mocks, specs, flows, history, encryption | ✓ | ✓ |
| MCP servers over HTTP | ✓ | ✓ |
| MCP servers over stdio (`npx`, `uvx` …) | ✓ | ✗ (use the CLI or the direct download) |
| Assistant with API keys, Ollama, on-device model | ✓ | ✓ |
| Assistant with local CLI agents (Claude Code, Codex over ACP) | ✓ | ✗ |
| Importing MCP servers from other apps' configs | Found automatically | You pick the file |
| Setting up Claude Code, Cursor, VS Code, Codex | Writes the config | Copies the snippet or saves the file you pick |
| Claude Desktop extension (`.mcpb`) | ✓ | ✗ |
| CLI | Bundled, Echolot › Install Command-Line Tool… | Installed on its own (zip or Docker) |
| Updates | Sparkle, in the app | App Store |
| Beta expiry | Beta builds expire | Never |

Also on that page: moving between editions (workspaces are plain files and open in both; Keychain items may ask once,
"Always Allow"; uninstalling one), and where each keeps its data (Application Support vs the app's container).

## 4. Examples and tutorials

**Example workspaces to download**, each a zipped `.echolot` (double-click opens it) plus the same as Postman and
OpenAPI files for people who want to see the import:

- **Alpenglow** (outdoor-gear shop): the website's demo workspace, already generated by
  `echolot-website/tools/demo-workspace.ts`: 27 requests across every protocol, three environments, captures, checks,
  specs and three flows. Reuse it, don't fork it.
- Smaller starters: *Hello HTTP* (public APIs, no setup), *GitHub API with a token* (secrets, pagination capture),
  *An MCP server, inspected*, *A spec-first API with a mock*.

**A public demo API** so tutorials work with nothing installed: built Nov 1, 2026 in `demo-api/` (its README), a
Worker on `demo.echolot.dev`: the Alpenglow shop (products, sign-in with JWTs and OAuth 2 client credentials, orders,
GraphQL with introspection, a WebSocket and an SSE feed), an MCP server and httpbin-like `/echo` endpoints. Rate
limited per address (120 a minute, 10 for large, slow and streaming responses), 64 KB bodies, streams that end on their
own, no workers.dev address. gRPC, Socket.IO and MQTT can't run on Workers and stay local (the website's
`tools/demo-grpc.ts`, `demo-realtime.ts`). The Alpenglow workspace gets a **Demo** environment pointing at it.

**Tutorials** (each: goal, 10–20 minutes, the example to start from, screenshots per step):

1. Your first workspace: requests, an environment, a secret, Git.
2. Chain requests: sign in, capture the token, use it everywhere.
3. Test an API and run it in CI (checks, the runner, JUnit, the GitHub Action).
4. Design an API spec-first and mock it before it exists.
5. Automate with a Flow: paginate and export, on a schedule.
6. Inspect and debug an MCP server.
7. Let an AI agent use your workspace safely (policies, approvals, protected environments).
8. Realtime: WebSocket, Socket.IO and MQTT side by side.
9. Coming from Postman.

## 5. Screenshots

Real app, Alpenglow workspace, never a personal one; light and dark of every shot; one window size (1320 × 852 pt,
as the website).

- Capture: `Echolot/Tools/e2e/launch-capture.swift --workspace … --capture <dir>` (every page, light and dark, from
  `-open <workspace> -page <page> -appearance <mode>`), and `screencapture -o -l <window id>` for set-up scenes. Needs
  Screen Recording permission for the terminal. The offscreen `SnapshotTour` renders are the fallback when no screen
  is available.
- A shot list in `shots/shots.json` (id, page, set-up steps, crop box) so every screenshot can be retaken after a UI
  change with one command, `bun tools/shots.ts <capture-dir>`: crop, 2x and 1x WebP, into `public/shots/`.
- `<Shot id="request-response" alt="…" />` in MDX picks the light or dark file with the theme (as the website's
  `Shot`), with fixed width and height so nothing shifts.
- App Store edition screenshots only where its screens differ (Settings › Agents, Assistant providers, MCP page).

## 6. Keeping docs true

- Generated from the app repo by `bun tools/sync.ts ../Echolot`: CLI reference (each command's `--help`), dynamic
  values (`DynamicValues.catalog`), the editions table, What's new (`Echolot/Resources/changelog.json`). Never edit
  the generated pages by hand.
- A docs checklist in Echolot's release skill: new feature → page or section; changed UI → retake its shots.
- `llms.txt` and per-page Markdown are on (Fumadocs), so assistants read the docs; the website's `llms.txt` links here.

## 7. Phases

1. **Scaffold** ✅ (Nov 1): static template builds; search, OG and llms routes verified under the Pages runtime.
   Demo API ✅ (Nov 1, 19 tests, live on demo.echolot.dev and passing there too). The app's Help menu ✅ (Nov 1).
2. **Shell**: Echolot's look (brand colours, Inter, the mark, light/dark), nav to echolot.dev, `metadataBase`, analytics
   like the website (Plausible-compatible + PostHog via a `/relay` Pages Function), `_redirects`, sitemap.
3. **Skeleton**: every page of section 2 with front matter and a one-paragraph stub; the Editions page complete.
4. **Shots pipeline** and the Alpenglow downloads.
5. **Content**: Get started, Workspaces, Requests first; then the rest.
6. **Tutorials** on the demo API.
7. **Launch**: `docs.echolot.dev` is live (Nov 1) with a home page, an introduction and the demo API page; still to
   come: Search Console, links from the website.

## 8. Pages the app links to

Help › Echolot Documentation (⌘?) opens `/docs`; Help › Help for This Page opens the page about the front window's page
(`EcholotWebsite.docs(for:)` in the app). These paths must exist, and keep a redirect in `public/_redirects` if they move:

| App page | Docs path |
| --- | --- |
| Home | `/docs` |
| Request | `/docs/requests` |
| Environments | `/docs/workspaces/environments` |
| Tests | `/docs/requests/scripts-and-tests` |
| Runs | `/docs/requests/runner` |
| History | `/docs/workspaces/history` |
| MCP Servers | `/docs/mcp-servers` |
| Specs | `/docs/specs` |
| Mocks | `/docs/mocks` |
| Flows | `/docs/flows` |

## 9. Decisions (Nov 1, 2026)

- Static hosting for the docs with no Worker code (an assets-only Worker, see section 1); the demo API is the only
  Worker that runs code.
- Public repository `staticdreams/echolot-docs`.
- A public demo API, rate limited.
- The app's Help menu leads to the docs, and to the page about the current screen.

## 10. Languages and screenshots in every language (Nov 4, 2026)

The docs are in English and seven more languages, the app's: German, Spanish, French, Japanese, Korean, Russian and
Simplified Chinese (`de es fr ja ko ru zh`; Italian follows the app's). This follows `Echolot/docs/Localization-Plan.md`,
section 3.3.

- **Structure.** Fumadocs' i18n, configured in `src/lib/i18n.ts`: `parser: 'dot'`, `hideLocale: 'default-locale'`,
  `fallbackLanguage: 'en'`. A translation sits beside the English page (`auth.mdx`, `auth.de.mdx`; `meta.de.json`);
  a page with no translation shows in English. English keeps its addresses (`/docs/requests/auth`: a contract with
  the app's Help menu); the others have a prefix (`/de/docs/requests/auth`). Routes live under `src/routes/{-$lang}/`.
- **The site's own words** (search, "On this page", the 404, the Edition callouts, the home page) are in
  `src/lib/i18n-ui.ts`, `src/lib/home-text.ts` and `src/components/edition.tsx`. The language switcher is Fumadocs'.
- **Links between pages** are written `/docs/...` in every language; the MDX `a` and `Card` components add the prefix.
  Headings of a translation carry the English anchor (`## Titel [#english-anchor]`), written by
  `bun tools/check-l10n.ts --fix`, so a link to a heading works in every language.
- **Search**: one Orama index for all languages, filtered by locale (Orama's multilingual tokenizer). **llms.txt** lists
  every language, `/<lang>/llms.txt` and `/<lang>/llms-full.txt` one. **Open Graph images** are made per language for
  `en de es fr` (the image font has Latin letters only); `ja ko ru zh` pages share the English page's image.
- **No Accept-Language redirect**: the site is static files with no Worker. The app adds the prefix itself
  (`EcholotWebsite.docs(for:)`, app repository); a visitor from a browser uses the switcher. A small Worker in front of
  the assets could redirect on a first visit.
- **Translating** is in `WRITING.md` ("Translations"). The app's own words come from its string catalogs:
  `tools/labels.ts` looks any label up and builds `.work/l10n/labels.<code>.json`; `tools/check-l10n.ts` checks a
  translation against the English page. **What's new** in every language is made by `tools/sync-whats-new.ts` from the
  app's `changelog.json`, which carries its own translations.
- **Screenshots** in a language: `tools/drive.ts <lang> [scene…]` launches the Debug build in that language
  (`-AppleLanguages`) with the Alpenglow workspace and captures each scene in `tools/scenes.ts`, light and dark, into
  `.work/captures/<lang>/`; `tools/shots.ts --lang <lang>` crops them with the same boxes as English into
  `public/shots/<lang>/` and `src/lib/shots.l10n.json`. `<Shot>` shows the reader's language when it has the shot, else
  the English one. Scenes are locale-proof: requests open through ⌘K by their English names, tabs and menu items are
  found by place. `tools/capture-all.sh <lang…>` runs every scene. Scenes that need hover, other apps (Terminal,
  Finder, Shortcuts), local servers or a model provider are not scripted: those shots stay English in every language.

## 11. Status (Nov 1, 2026)

All 82 pages of section 2 are written, checked against the app's code and the CLI. Screenshots: 78 of 92 taken from the real app
(a Debug build, the Alpenglow workspace, light and dark). How they are made:

1. Launch a Debug build: `open -n -a <Echolot.app> --args -open <Alpenglow.echolot> -page request -greetingName Heidi
   -ApplePersistenceIgnoreState YES -windowFrame "40 60 1320 852"` (the last three keep personal state out).
2. Drive the scene with Orca (`source tools/orca.zsh`: `openreq`, `sendreq`, `axmenu`, `pick`, `look`…), as each
   entry of `shots/*.json` describes.
3. `tools/cap.sh <id>` captures light and dark (it switches the Debug build's appearance with
   `.work/set-appearance`, from `tools/src/set-appearance.swift`); `bun tools/shots.ts <id>` crops and writes WebP.

Not taken yet (the pages skip them until they are): ai-assistant-approval, ai-agents-workspace-rules, mac-quick-send-panel, mac-shortcuts-action, mac-quick-look, cli-settings-command-line-tool, get-started-import-report, mcp-try-with-a-model, requests-http-token-editor, requests-scripts-tab, tutorials-agents-approval, tutorials-postman-import-report, workspaces-history-compare, workspaces-export-report.
