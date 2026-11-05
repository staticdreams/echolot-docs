import { Callout } from 'fumadocs-ui/components/callout';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import type { ReactNode } from 'react';
import { localizedPath } from '@/lib/i18n';

const labels = {
  en: { direct: 'Direct download only', appstore: 'Mac App Store edition', compare: 'Compare the editions' },
  de: { direct: 'Nur im direkten Download', appstore: 'Mac-App-Store-Edition', compare: 'Editionen vergleichen' },
  es: { direct: 'Solo en la descarga directa', appstore: 'Edición de la Mac App Store', compare: 'Comparar las ediciones' },
  fr: { direct: 'Téléchargement direct uniquement', appstore: 'Édition du Mac App Store', compare: 'Comparer les éditions' },
  ja: { direct: '直接ダウンロード版のみ', appstore: 'Mac App Store版', compare: 'エディションを比較' },
  ko: { direct: '직접 다운로드 버전 전용', appstore: 'Mac App Store 버전', compare: '버전 비교하기' },
  ru: { direct: 'Только в версии для прямой загрузки', appstore: 'Версия из Mac App Store', compare: 'Сравнить версии' },
  zh: { direct: '仅限直接下载版', appstore: 'Mac App Store 版', compare: '比较两个版本' },
} as const;

/**
 * What differs between the two editions of Echolot. `only="direct"` marks something only the direct download has
 * (say what the App Store edition does instead, if anything); `only="appstore"` marks how the App Store edition
 * does it. Both link to the Editions page.
 */
export function Edition({ only, children }: { only: 'direct' | 'appstore'; children: ReactNode }) {
  const { locale } = useI18n();
  const l = labels[(locale as keyof typeof labels) ?? 'en'] ?? labels.en;
  return (
    <Callout type={only === 'direct' ? 'info' : 'warn'} title={l[only]}>
      {children}{' '}
      <a href={localizedPath(locale, '/docs/get-started/editions')} className="whitespace-nowrap">
        {l.compare}
      </a>
    </Callout>
  );
}
