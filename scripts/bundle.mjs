/** Inlines the Vite build into one self-contained bundle.html. */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
let html = readFileSync(join(dist, 'index.html'), 'utf8')

html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (_m, src) =>
  `<script type="module">\n${readFileSync(join(dist, src.replace(/^\//, '')), 'utf8')}\n</script>`)

html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href) =>
  `<style>\n${readFileSync(join(dist, href.replace(/^\//, '')), 'utf8')}\n</style>`)

html = html
  .replace('<title>inventory</title>', '<title>Aesthetic Instocks — Inventory</title>')
  .replace(/<link rel="icon"[^>]*>/, '')

if (html.includes('assets/')) throw new Error('an asset was left un-inlined')

writeFileSync('bundle.html', html)
console.log(`bundle.html written — ${(html.length / 1024).toFixed(0)} KB`)
