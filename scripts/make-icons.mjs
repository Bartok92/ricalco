// Genera le icone dell'app (PNG) a partire da un unico disegno SVG.
// Uso: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';

const out = new URL('../public/', import.meta.url);
mkdirSync(out, { recursive: true });

// Matita in coordinate locali: punta nell'origine, corpo lungo l'asse x.
const pencil = `
  <polygon points="0,0 12,-5.4 12,5.4" fill="#2b2f38"/>
  <polygon points="12,-5.4 40,-18 40,18 12,5.4" fill="#f3cf9f"/>
  <rect x="40" y="-18" width="150" height="36" fill="#ffc83d"/>
  <rect x="40" y="-18" width="150" height="12" fill="#ffd96e"/>
  <rect x="40" y="6" width="150" height="12" fill="#f0ab22"/>
  <rect x="190" y="-18" width="22" height="36" fill="#c9ced6"/>
  <rect x="196" y="-18" width="3" height="36" fill="#9aa1ad"/>
  <rect x="204" y="-18" width="3" height="36" fill="#9aa1ad"/>
  <path d="M212,-18 h18 a8,8 0 0 1 8,8 v20 a8,8 0 0 1 -8,8 h-18 z" fill="#ff8fa3"/>`;

// Cuore: metà sinistra già ricalcata (linea piena), metà destra ancora da ricalcare (tratteggio).
const heartDone = 'M256 334 C 182 276, 150 226, 174 188 C 198 152, 244 160, 256 196 C 266 164, 306 150, 334 178';
const heartTodo = 'M334 178 C 362 210, 340 266, 256 334';

function art({ maskable = false } = {}) {
  const k = maskable ? 0.72 : 0.9;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#262b37"/>
      <stop offset="1" stop-color="#0e1016"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${k}) translate(-256 -262)">
    <g transform="rotate(-6 256 256)">
      <rect x="120" y="92" width="272" height="340" rx="22" fill="#fbfaf6" filter="url(#sh)"/>
      <path d="${heartDone}" fill="none" stroke="#2b2f38" stroke-width="15" stroke-linecap="round"/>
      <path d="${heartTodo}" fill="none" stroke="#2b2f38" stroke-opacity="0.38" stroke-width="11" stroke-linecap="round" stroke-dasharray="2 22"/>
    </g>
    <g transform="translate(327 172) rotate(-48) scale(0.86)" filter="url(#sh)">${pencil}</g>
  </g>
</svg>`;
}

function png(svg, size, file) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: '#0e1016' });
  writeFileSync(new URL(file, out), r.render().asPng());
  console.log('creata', file, `${size}x${size}`);
}

const main = art();
writeFileSync(new URL('favicon.svg', out), main);
png(main, 180, 'apple-touch-icon.png');
png(main, 192, 'icon-192.png');
png(main, 512, 'icon-512.png');
png(art({ maskable: true }), 512, 'icon-maskable-512.png');
