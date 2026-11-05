import { createFileRoute } from '@tanstack/react-router';
import { docsLlms } from '@/lib/source';
import { langFromParam } from '@/lib/i18n';

// The whole documentation in one file, in the language of the address (English without a prefix).
export const Route = createFileRoute('/{-$lang}/llms-full.txt')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const lang = langFromParam(params.lang);
        if (!lang) return new Response(undefined, { status: 404 });
        return new Response(await docsLlms.full(lang));
      },
    },
  },
});
