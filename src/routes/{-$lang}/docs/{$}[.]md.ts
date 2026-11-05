import { createFileRoute, notFound } from '@tanstack/react-router';
import { docsLlms, source } from '@/lib/source';
import { decodeMarkdownUrl } from '@/lib/shared';
import { langFromParam } from '@/lib/i18n';

export const Route = createFileRoute('/{-$lang}/docs/{$}.md')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = decodeMarkdownUrl(params._splat?.split('/') ?? []);
        const lang = langFromParam(params.lang);
        const page = lang && source.getPage(slugs, lang);
        if (!page) throw notFound();

        return new Response(await docsLlms.page(page), {
          headers: {
            'Content-Type': 'text/markdown',
          },
        });
      },
    },
  },
});
