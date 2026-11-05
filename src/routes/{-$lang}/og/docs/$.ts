import { createFileRoute } from '@tanstack/react-router';
import { generateOGImage } from 'fumadocs-ui/og/takumi';
import { source } from '@/lib/source';
import { appName } from '@/lib/shared';
import { langFromParam, ogLanguages } from '@/lib/i18n';

export const Route = createFileRoute('/{-$lang}/og/docs/$')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const slugs = (params._splat?.split('/') ?? []).filter((v) => v.length > 0).slice(0, -1);
        const lang = langFromParam(params.lang);
        const page = lang && ogLanguages.includes(lang) && source.getPage(slugs, lang);
        if (!page) return new Response(undefined, { status: 404 });

        return generateOGImage({
          title: page.data.title,
          description: page.data.description,
          site: appName,
          format: 'webp',
        });
      },
    },
  },
});
