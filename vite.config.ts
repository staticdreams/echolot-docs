import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import { nitro } from 'nitro/vite';
import { glob } from 'node:fs/promises';
import { getSlugs } from 'fumadocs-core/source';
import { getPageImageUrl } from './src/lib/shared';

const imageRoutes: string[] = [];
for await (const entry of glob('**/*.mdx', { cwd: 'content/docs' })) {
  imageRoutes.push(getPageImageUrl({ slugs: getSlugs(entry) }).url);
}

export default defineConfig({
  server: {
    port: 3000,
  },
  // The prerender asks the preview server for every page at 127.0.0.1: make it listen there (on Linux build machines
  // "localhost" can mean IPv6 only, and the prerender then never reaches it).
  preview: {
    host: '127.0.0.1',
  },
  plugins: [
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        // The app shell renders from /404 (a Not Found page), so / gets its own prerendered page.
        maskPath: '/404',
        prerender: {
          enabled: true,
          crawlLinks: true,
        },
      },

      pages: [
        {
          path: '/',
        },
        {
          path: '/docs',
        },
        {
          path: '/api/search',
        },
        {
          path: 'llms-full.txt',
        },
        {
          path: 'llms.txt',
        },
      ],
    }),
    react(),
    // please see https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nitro for guides on hosting
    nitro({
      // Always the plain Node preset. On Cloudflare's build machines Nitro would otherwise pick its cloudflare-module
      // preset, whose preview server for prerendering runs Wrangler, which runs this build again: builds hung for
      // 30 minutes. The site is static files either way.
      preset: 'node-server',
      // TanStack Start pre-renders responses as text, which breaks images
      prerender: { routes: imageRoutes },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: 'tslib/tslib.es6.js',
    },
  },
});
