import { defineI18n } from 'fumadocs-core/i18n';

/**
 * The docs' languages, English first (the app's, as the website has them). English keeps the bare address
 * (`/docs/requests`); the others have a prefix (`/de/docs/requests`). A page with no translation yet shows in English.
 * Translations sit beside the English page: `auth.mdx`, `auth.de.mdx` (WRITING.md, "Translations").
 */
export const i18n = defineI18n({
  languages: ['en', 'de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh'],
  defaultLanguage: 'en',
  hideLocale: 'default-locale',
  parser: 'dot',
  fallbackLanguage: 'en',
});

export type Lang = (typeof i18n.languages)[number];

/** Each language in its own name, and the `lang` attribute / hreflang / Open Graph locale it goes by. */
export const languageInfo: Record<Lang, { name: string; html: string; og: string }> = {
  en: { name: 'English', html: 'en', og: 'en_US' },
  de: { name: 'Deutsch', html: 'de', og: 'de_DE' },
  es: { name: 'Español', html: 'es', og: 'es_ES' },
  fr: { name: 'Français', html: 'fr', og: 'fr_FR' },
  ja: { name: '日本語', html: 'ja', og: 'ja_JP' },
  ko: { name: '한국어', html: 'ko', og: 'ko_KR' },
  ru: { name: 'Русский', html: 'ru', og: 'ru_RU' },
  zh: { name: '简体中文', html: 'zh-Hans', og: 'zh_CN' },
};

export function isLang(value: string | undefined): value is Lang {
  return !!value && (i18n.languages as readonly string[]).includes(value);
}

/** The language a `lang` route parameter means: none is English; an unknown one is not a language (a 404). */
export function langFromParam(param: string | undefined): Lang | undefined {
  if (param === undefined) return 'en';
  // English has no prefix: /en/docs is not an address.
  if (param === 'en') return undefined;
  return isLang(param) ? param : undefined;
}

/** A site path in a language: `/docs/x` → `/de/docs/x`; English paths stay as they are. */
export function localizedPath(lang: string | undefined, path: string) {
  if (!lang || lang === 'en' || !path.startsWith('/')) return path;
  return path === '/' ? `/${lang}` : `/${lang}${path}`;
}

/**
 * The languages whose pages have an Open Graph image of their own (tools/og.ts: the image font has Latin letters only);
 * the others share the English page's image.
 */
export const ogLanguages: readonly string[] = ['en', 'de', 'es', 'fr'];
