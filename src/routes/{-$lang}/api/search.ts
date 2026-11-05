import { createFileRoute } from '@tanstack/react-router';
import { createFromSource } from 'fumadocs-core/search/server';
import { i18n, langFromParam, type Lang } from '@/lib/i18n';
import { source } from '@/lib/source';

// One search index per language (/api/search, /de/api/search …): one index for all of them was 54 MB, over Cloudflare's
// 25 MiB limit for a static file, and every reader would have downloaded all languages. Orama's multilingual tokenizer
// handles every language, Japanese, Korean and Chinese included.
const servers = new Map<Lang, ReturnType<typeof createFromSource>>();
function serverFor(lang: Lang) {
  let server = servers.get(lang);
  if (!server) {
    // The loader as one language sees it: its pages and its page tree (for the breadcrumbs), no locale filter.
    const view = { ...source, _i18n: undefined, getPages: () => source.getPages(lang), getPageTree: () => source.getPageTree(lang) };
    server = createFromSource(view as unknown as typeof source);
    servers.set(lang, server);
  }
  return server;
}
void i18n;

export const Route = createFileRoute('/{-$lang}/api/search')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const lang = langFromParam(params.lang);
        if (!lang) return new Response(undefined, { status: 404 });
        return serverFor(lang).staticGET();
      },
    },
  },
});
