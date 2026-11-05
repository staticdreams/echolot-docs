# Echolot documentation

The source of [docs.echolot.dev](https://docs.echolot.dev), the documentation for [Echolot](https://echolot.dev), the
native Mac API client for HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT and MCP: both the direct download and the
Mac App Store edition, the command-line tool and CI.

Built with [Fumadocs](https://fumadocs.dev) on TanStack Start, prerendered to static files and served by
Cloudflare. Fixes are welcome: every page has an edit link, or open a pull request.

```sh
bun install
bun run dev       # http://localhost:3000
bun run build     # static site in .output/public
bun run preview   # serve it as Cloudflare does (wrangler dev)
```

- `content/docs/`: the pages, in MDX, in English and, beside each, its translations (`auth.mdx`, `auth.de.mdx`; German,
  Spanish, French, Japanese, Korean, Russian, Simplified Chinese); `src/`: the site (routes, components).
- `demo-api/`: the Alpenglow demo API on [demo.echolot.dev](https://demo.echolot.dev) that the tutorials use
  (a Cloudflare Worker; see its README).
- `PLAN.md`: what the docs cover and how they are made, including the languages (section 10); `WRITING.md`: how to
  write and translate a page.
- `tools/`: screenshots in every language (`drive.ts`, `scenes.ts`, `shots.ts`), translation checks (`check-l10n.ts`,
  `labels.ts`) and the release notes in every language (`sync-whats-new.ts`).

Report problems with Echolot itself on [staticdreams/echolot-public](https://github.com/staticdreams/echolot-public/issues).
