import { test as base, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const test = base.extend({
  context: async ({ context }, use) => {
    if (!process.env.TEST_BASE_URL) {
      const root = path.resolve('dist');
      await context.route('https://stylr.test/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        const target = path.resolve(root, `.${pathname === '/' || pathname === '/illustrated' ? '/index.html' : pathname}`);
        if (!target.startsWith(`${root}/`)) return route.fulfill({ status: 404, body: '' });
        try {
          const body = await readFile(target);
          const contentType = ({ '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' } as Record<string, string>)[path.extname(target)] || 'application/octet-stream';
          await route.fulfill({ status: 200, body, contentType });
        } catch {
          await route.fulfill({ status: 404, body: 'Missing build asset' });
        }
      });
    }
    await use(context);
  },
});
export { expect };
export type { Page };
