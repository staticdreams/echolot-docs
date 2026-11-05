import { useI18n } from 'fumadocs-ui/contexts/i18n';
import shots from '@/lib/shots.json';
import localized from '@/lib/shots.l10n.json';

type Entry = { width: number; height: number };
const manifest = shots as Record<string, Entry>;
const byLanguage = localized as Record<string, Record<string, Entry>>;

/**
 * A screenshot of Echolot in the reader's appearance and language: public/shots/<id>-light.webp and -dark.webp for
 * English, public/shots/<lang>/<id>-light.webp and -dark.webp for the others, made by tools/shots.ts, which also
 * records their size in lib/shots.json and lib/shots.l10n.json. A shot not taken in the reader's language shows the
 * English one; one not taken yet shows nothing.
 */
export function Shot({ id, alt, caption }: { id: string; alt: string; caption?: string }) {
  const { locale } = useI18n();
  const own = locale && locale !== 'en' ? byLanguage[locale]?.[id] : undefined;
  const entry = own ?? manifest[id];
  // Not taken yet (tools/shots.ts lists what is missing): nothing shows, so the page reads as it is.
  if (!entry) return null;
  const folder = own ? `/shots/${locale}` : '/shots';
  const common = {
    alt,
    width: entry.width,
    height: entry.height,
    loading: 'lazy' as const,
    decoding: 'async' as const,
    className: 'rounded-xl border shadow-sm w-full h-auto',
  };
  return (
    <figure className="not-prose my-6">
      {/* biome-ignore lint/performance/noImgElement: static export, the images are already sized */}
      <img src={`${folder}/${id}-light.webp`} {...common} className={`${common.className} dark:hidden`} />
      {/* biome-ignore lint/performance/noImgElement: static export, the images are already sized */}
      <img src={`${folder}/${id}-dark.webp`} {...common} className={`${common.className} hidden dark:block`} />
      {caption ? <figcaption className="mt-2 text-center text-sm text-fd-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
