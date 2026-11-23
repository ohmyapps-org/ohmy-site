/**
 * Renders App into dist/index.html so crawlers that run no JavaScript (GPTBot,
 * ClaudeBot, PerplexityBot) read the page, and writes sitemap.xml. The client
 * still mounts with createRoot, which replaces this markup.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '..')
const today = new Date().toISOString().slice(0, 10)
const vite = await createServer({
  root,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const { render } = (await vite.ssrLoadModule('/src/entry-server.tsx')) as { render: () => string }
  const html = render()
  if (html.length < 500) throw new Error(`prerender produced only ${html.length} chars`)

  const file = resolve(root, 'dist', 'index.html')
  const page = await readFile(file, 'utf8')
  if (!page.includes('<div id="root"></div>')) throw new Error('empty #root not found in index.html')
  const out = page.replace('<div id="root"></div>', `<div id="root">${html}</div>`).replaceAll('%BUILD_DATE%', today)
  await writeFile(file, out, 'utf8')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://ohmy.lat/</loc><lastmod>${today}</lastmod></url>
</urlset>
`
  await writeFile(resolve(root, 'dist', 'sitemap.xml'), sitemap, 'utf8')
  console.log(`prerendered: ${Math.round(html.length / 1024)} KB + sitemap.xml into dist/`)
} finally {
  await vite.close()
}
