import shots from '@/lib/shots.json';

type Entry = { width: number; height: number };
const manifest = shots as Record<string, Entry>;

/**
 * A screenshot of Echolot in the reader's appearance: public/shots/<id>-light.webp and <id>-dark.webp, made by
 * tools/shots.ts, which also records their size in lib/shots.json. A shot not taken yet shows nothing.
 */
export function Shot({ id, alt, caption }: { id: string; alt: string; caption?: string }) {
  const entry = manifest[id];
  // Not taken yet (tools/shots.ts lists what is missing): nothing shows, so the page reads as it is.
  if (!entry) return null;
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
      <img src={`/shots/${id}-light.webp`} {...common} className={`${common.className} dark:hidden`} />
      {/* biome-ignore lint/performance/noImgElement: static export, the images are already sized */}
      <img src={`/shots/${id}-dark.webp`} {...common} className={`${common.className} hidden dark:block`} />
      {caption ? <figcaption className="mt-2 text-center text-sm text-fd-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
