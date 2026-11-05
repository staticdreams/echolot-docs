import { createRootRoute, HeadContent, Outlet, Scripts, useMatches } from '@tanstack/react-router';
import * as React from 'react';
import appCss from '@/styles/app.css?url';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import SearchDialog from '@/components/search';
import { siteDescription } from '@/lib/shared';
import { isLang, languageInfo } from '@/lib/i18n';
import { provider } from '@/lib/i18n-ui';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Echolot documentation',
      },
      {
        name: 'description',
        content: siteDescription,
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  // The language is in the address (/de/docs/…); none means English.
  const param = useMatches({ select: (matches) => matches.map((m) => (m.params as { lang?: string }).lang).find(Boolean) });
  const lang = isLang(param) ? param : 'en';
  return (
    <html lang={languageInfo[lang].html} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ SearchDialog }} i18n={provider(lang)}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
