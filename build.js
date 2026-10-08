/* Builds the single-file game from src/ (Node only, no dependencies).
   dist/index.html             standalone page: open it in any browser, or serve dist/ as a static site
   dist/puzzle-triathlon.html  page content as published to Claude (no <html>/<head> wrapper) */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800'
  + '&family=Figtree:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap';
const read = name => fs.readFileSync(path.join(SRC, name), 'utf8');

const page = '<title>Puzzle Triathlon</title>\n'
  + `<link rel="stylesheet" href="${FONTS}">\n`
  + `<style>\n${read('style.css')}</style>\n`
  + `${read('body.html')}\n`
  + `<script id="engines">\n${read('engines.js')}</script>\n`
  + `<script>\n${read('app.js')}</script>\n`;
if (page.split('</script>').length - 1 !== 2) throw new Error('a source file contains a literal </script>');

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'puzzle-triathlon.html'), page);
fs.writeFileSync(path.join(DIST, 'index.html'),
  '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
  + `</head><body>${page}</body></html>\n`);
console.log(`built dist/index.html and dist/puzzle-triathlon.html (${Buffer.byteLength(page).toLocaleString('en-US')} bytes)`);
