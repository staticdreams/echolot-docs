import { Callout } from 'fumadocs-ui/components/callout';
import Link from 'next/link';
import type { ReactNode } from 'react';

const labels = {
  direct: 'Direct download only',
  appstore: 'Mac App Store edition',
} as const;

/**
 * What differs between the two editions of Echolot. `only="direct"` marks something only the direct download has
 * (say what the App Store edition does instead, if anything); `only="appstore"` marks how the App Store edition
 * does it. Both link to the Editions page.
 */
export function Edition({ only, children }: { only: keyof typeof labels; children: ReactNode }) {
  return (
    <Callout type={only === 'direct' ? 'info' : 'warn'} title={labels[only]}>
      {children}{' '}
      <Link href="/docs/get-started/editions" className="whitespace-nowrap">
        Compare the editions
      </Link>
    </Callout>
  );
}
