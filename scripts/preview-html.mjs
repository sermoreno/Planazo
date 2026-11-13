// Convierte dist/index.html en un fragmento apto para publicar como Artifact (sin <html>/<head>/<body>).
import { readFileSync, writeFileSync } from 'node:fs'
const html = readFileSync('dist/index.html', 'utf8')
const tags = [...html.matchAll(/<(script|link)[^>]*(src|href)="\.\/assets\/[^"]+"[^>]*>(<\/script>)?/g)].map((m) => m[0])
writeFileSync('dist/preview.html', `<title>Planazo</title>\n<meta name="description" content="Prototipo de Planazo">\n${tags.join('\n')}\n<div id="root"></div>\n`)
console.log(tags)
