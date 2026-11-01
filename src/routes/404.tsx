import { createFileRoute } from '@tanstack/react-router';
import { NotFound } from '@/components/not-found';

// The page Cloudflare answers unknown addresses with (404.html): the app shell is rendered from here.
export const Route = createFileRoute('/404')({
  component: NotFound,
  head: () => ({ meta: [{ title: 'Not found · Echolot' }, { name: 'robots', content: 'noindex' }] }),
});
