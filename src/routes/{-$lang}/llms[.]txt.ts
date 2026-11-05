import { docsLlms } from '@/lib/source';
import { langFromParam } from '@/lib/i18n';
import { createFileRoute } from '@tanstack/react-router';

// /llms.txt lists the pages of every language; /de/llms.txt only the German ones.
export const Route = createFileRoute('/{-$lang}/llms.txt')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const lang = params.lang === undefined ? undefined : langFromParam(params.lang);
        if (params.lang !== undefined && !lang) return new Response(undefined, { status: 404 });
        return new Response(await docsLlms.index(lang));
      },
    },
  },
});
