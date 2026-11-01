import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { siteDescription, siteUrl } from '@/lib/shared';

export const Route = createFileRoute('/')({
  component: Home,
  head: () => ({
    meta: [
      { title: 'Echolot documentation' },
      { name: 'description', content: siteDescription },
      { property: 'og:title', content: 'Echolot documentation' },
      { property: 'og:description', content: siteDescription },
    ],
    links: [{ rel: 'canonical', href: `${siteUrl}/` }],
  }),
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-col justify-center items-center text-center flex-1 px-6 py-16 gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Echolot documentation</h1>
        <p className="max-w-xl text-fd-muted-foreground">
          How to use Echolot, the native Mac API client for HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT and MCP: the
          direct download and the Mac App Store edition, the command-line tool and CI.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/docs/$"
            params={{ _splat: '' }}
            className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
          >
            Read the docs
          </Link>
          <a href="https://echolot.dev" className="rounded-lg border px-4 py-2 text-sm font-medium">
            echolot.dev
          </a>
        </div>
      </main>
    </HomeLayout>
  );
}
