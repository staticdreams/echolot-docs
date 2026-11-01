import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Provider } from '@/components/provider';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.echolot.dev'),
  title: { default: 'Echolot documentation', template: '%s · Echolot' },
  description: 'How to use Echolot, the native Mac API client for HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT and MCP.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
