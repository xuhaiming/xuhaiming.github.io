import { defineConfig, type Plugin } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
const orderFile = resolve(root, 'src/chapters/order.json');
const sectionFile = (id: string) => resolve(root, `src/chapters/${id}/section.html`);

/** Replaces `<!-- @chapters -->` in index.html with every chapter's section.html, in order.json order. */
function chapters(): Plugin {
  return {
    name: 'chapters',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const order: string[] = JSON.parse(readFileSync(orderFile, 'utf8'));
        const parts = order.filter((id) => existsSync(sectionFile(id))).map((id) => readFileSync(sectionFile(id), 'utf8').trim());
        return html.replace('<!-- @chapters -->', parts.join('\n\n'));
      },
    },
    configureServer(server) {
      server.watcher.add([orderFile, resolve(root, 'src/chapters')]);
      server.watcher.on('change', (file) => {
        if (file.endsWith('section.html') || file.endsWith('order.json')) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [chapters()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { port: 5173, strictPort: true },
});
