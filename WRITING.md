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
