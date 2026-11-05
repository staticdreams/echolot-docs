import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { localizedPath } from './i18n';
import { appName, gitConfig } from './shared';

export function baseOptions(lang?: string): BaseLayoutProps {
  return {
    i18n: true,
    nav: {
      url: localizedPath(lang, '/'),
      title: (
        <span className="inline-flex items-center gap-2 font-semibold">
          <img src="/app-icon-64.webp" alt="" width={24} height={24} className="size-6" />
          {appName}
        </span>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
