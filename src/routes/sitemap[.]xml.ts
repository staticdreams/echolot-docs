import { i18n, languageInfo, localizedPath } from '@/lib/i18n';
import { siteUrl } from '@/lib/shared';
import { source } from '@/lib/source';
import { createFileRoute } from '@tanstack/react-router';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

type Entry = { url: string; alternates: { hreflang: string; url: string }[] };

/** One <url> per page and language, each listing the page in every language it exists in (hreflang), as the page's own <head> does. */
function sitemap() {
  const entries: Entry[] = [];

  // The landing page of each language.
  const landing = i18n.languages.map((l) => ({ hreflang: languageInfo[l].html, url: localizedPath(l, '/') }));
  for (const a of landing) entries.push({ url: a.url, alternates: [...landing, { hreflang: 'x-default', url: '/' }] });

  // The docs: every page of each language (a page without a translation is only listed under its own language).
  for (const english of source.getPages('en')) {
    const alternates = i18n.languages.flatMap((l) => {
      const page = source.getPage(english.slugs, l);
      if (!page || (l !== 'en' && page.locale !== l)) return [];
      return [{ hreflang: languageInfo[l].html, url: page.url }];
    });
    const all = alternates.length > 1 ? [...alternates, { hreflang: 'x-default', url: english.url }] : [];
    for (const a of alternates) entries.push({ url: a.url, alternates: all });
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = entries.map((e) =>
    [
      '  <url>',
      `    <loc>${escape(siteUrl + e.url)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      ...e.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escape(siteUrl + a.url)}" />`),
      '  </url>',
    ].join('\n'),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => new Response(sitemap(), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }),
    },
  },
});
