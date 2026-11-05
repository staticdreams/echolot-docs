import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Shot } from '@/components/shot';
import { homeText } from '@/lib/home-text';
import { baseOptions } from '@/lib/layout.shared';
import { i18n, languageInfo, langFromParam, localizedPath, type Lang } from '@/lib/i18n';
import { siteUrl } from '@/lib/shared';

export const Route = createFileRoute('/{-$lang}/')({
  component: Home,
  beforeLoad: ({ params }) => {
    if (!langFromParam(params.lang)) throw notFound();
  },
  head: ({ params }) => {
    const lang = langFromParam(params.lang) ?? 'en';
    const t = homeText[lang];
    return {
      meta: [
        { title: t.title },
        { name: 'description', content: t.description },
        { property: 'og:title', content: t.title },
        { property: 'og:description', content: t.description },
        { property: 'og:locale', content: languageInfo[lang].og },
      ],
      links: [
        { rel: 'canonical', href: `${siteUrl}${localizedPath(lang, '/')}` },
        ...i18n.languages.map((l) => ({ rel: 'alternate', hrefLang: languageInfo[l].html, href: `${siteUrl}${localizedPath(l, '/')}` })),
        { rel: 'alternate', hrefLang: 'x-default', href: `${siteUrl}/` },
      ],
    };
  },
});

function Home() {
  const { lang: param } = Route.useParams();
  const lang: Lang = langFromParam(param) ?? 'en';
  const t = homeText[lang];
  return (
    <HomeLayout {...baseOptions(lang)}>
      <main className="flex flex-col items-center flex-1 px-6 pt-16 pb-20">
        <div className="flex flex-col items-center text-center gap-6">
          <img src="/app-icon-256.webp" alt="Echolot" width={128} height={128} className="size-28 drop-shadow-xl" />
          <h1 className="text-4xl font-semibold tracking-tight">{t.title}</h1>
          <p className="max-w-xl text-fd-muted-foreground">{t.lead}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/{-$lang}/docs/$"
              params={{ lang: param, _splat: '' }}
              className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
            >
              {t.read}
            </Link>
            <Link
              to="/{-$lang}/docs/$"
              params={{ lang: param, _splat: 'tutorials/demo-api' }}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
            >
              {t.demo}
            </Link>
            <a href="https://echolot.dev" className="rounded-lg border px-4 py-2 text-sm font-medium">
              echolot.dev
            </a>
          </div>
        </div>
        <div className="w-full max-w-5xl mt-14">
          <Shot id="get-started-window" alt={t.shotAlt} />
        </div>
      </main>
    </HomeLayout>
  );
}
