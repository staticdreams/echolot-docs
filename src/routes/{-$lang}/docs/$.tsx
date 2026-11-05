import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { createServerFn } from '@tanstack/react-start';
import { docs, source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { baseOptions } from '@/lib/layout.shared';
import { i18n, languageInfo, langFromParam, ogLanguages, type Lang } from '@/lib/i18n';
import { getPageImageUrl, getPageMarkdownUrl, gitConfig, siteUrl } from '@/lib/shared';
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions';
import { useFumadocsLoader } from 'fumadocs-core/source/client';
import { Suspense, use } from 'react';
import { useMDXComponents } from '@/components/mdx';

export const Route = createFileRoute('/{-$lang}/docs/$')({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/').filter(Boolean) ?? [];
    const lang = langFromParam(params.lang);
    if (!lang) throw notFound();
    const data = await loader({ data: { slugs, lang } });
    await docs.getPage(data.path)?.preload();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.isIndex ? loaderData.title : `${loaderData.title} · Echolot` },
          { name: 'description', content: loaderData.description },
          { property: 'og:title', content: loaderData.title },
          { property: 'og:description', content: loaderData.description },
          { property: 'og:image', content: `${siteUrl}${loaderData.imageUrl}` },
          { property: 'og:locale', content: languageInfo[loaderData.lang as Lang].og },
          { name: 'twitter:card', content: 'summary_large_image' },
        ]
      : [],
    links: loaderData
      ? [
          { rel: 'canonical', href: `${siteUrl}${loaderData.url}` },
          // The page in every language it has, for search engines.
          ...loaderData.alternates.map((alt) => ({ rel: 'alternate', hrefLang: alt.hreflang, href: `${siteUrl}${alt.url}` })),
        ]
      : [],
  }),
});

const loader = createServerFn({
  method: 'GET',
})
  .validator((input: { slugs: string[]; lang: Lang }) => input)
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data: { slugs, lang } }) => {
    const page = source.getPage(slugs, lang);
    if (!page) throw notFound();

    // The languages the page really exists in (a page without a translation shows the English one).
    const alternates = i18n.languages.flatMap((l) => {
      const other = source.getPage(slugs, l);
      if (!other || (l !== 'en' && other.locale !== l)) return [];
      return [{ hreflang: languageInfo[l].html, url: other.url }];
    });

    return {
      path: page.path,
      lang,
      url: page.url,
      isIndex: slugs.length === 0,
      title: page.data.title ?? '',
      description: page.data.description ?? '',
      markdownUrl: getPageMarkdownUrl({ slugs: page.slugs, locale: lang }).url,
      imageUrl: getPageImageUrl({ slugs: page.slugs, locale: ogLanguages.includes(lang) ? lang : 'en' }).url,
      alternates: alternates.length > 1 ? [...alternates, { hreflang: 'x-default', url: alternates.find((a) => a.hreflang === 'en')?.url ?? page.url }] : [],
      pageTree: await source.serializePageTree(source.getPageTree(lang)),
    };
  });

function Content({ path, markdownUrl }: { path: string; markdownUrl: string }) {
  const page = docs.getPage(path);
  if (!page) throw new Error(`unknown page: ${path}`);

  const { toc } = use(page.load());
  const MDX = page.body;

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b -mt-4 pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${path}`}
        />
      </div>
      <DocsBody>
        <MDX components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

function Page() {
  const { pageTree, path, markdownUrl, lang } = useFumadocsLoader(Route.useLoaderData());

  return (
    <DocsLayout {...baseOptions(lang)} tree={pageTree}>
      <Link to={markdownUrl} hidden />
      <Suspense>
        <Content path={path} markdownUrl={markdownUrl} />
      </Suspense>
    </DocsLayout>
  );
}
