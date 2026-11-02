// Guida iniziale in 3 schermate.
import { html } from './dom.js';
import { icons } from './icons.js';

const PAPER = '#fbfaf6';
const INK = '#2b2f38';
const ACCENT = '#ffc83d';

const ART = [
  // 1. Telefono su un supporto sopra il foglio
  `<svg viewBox="0 0 240 150" aria-hidden="true">
    <path d="M8 137H232" stroke="#3a3f4b" stroke-width="3" stroke-linecap="round"/>
    <rect x="40" y="131" width="116" height="5" rx="1.5" fill="${PAPER}"/>
    <path d="M78 56 L44 130 L152 130 L92 56 Z" fill="${ACCENT}" fill-opacity=".12" stroke="${ACCENT}" stroke-opacity=".55" stroke-dasharray="4 4"/>
    <path d="M168 136 L164 58 L212 58 L208 136 Z" fill="#9fd3ff" fill-opacity=".16" stroke="#9fd3ff" stroke-opacity=".75" stroke-width="2"/>
    <path d="M166 74 H210" stroke="#9fd3ff" stroke-opacity=".35" stroke-width="2"/>
    <rect x="68" y="46" width="148" height="11" rx="4" fill="#20232b" stroke="#e8eaee" stroke-width="2"/>
    <circle cx="85" cy="57" r="3" fill="${ACCENT}"/>
    <path d="M24 58V128M24 58l-4 6M24 58l4 6M24 128l-4-6M24 128l4-6" stroke="#a3a8b3" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <text x="0" y="0" transform="translate(15 93) rotate(-90)" text-anchor="middle" fill="#d5d8de" font-size="11" font-weight="600" font-family="-apple-system, sans-serif">30–40 cm</text>
  </svg>`,
  // 2. Carica l'immagine e posizionala con le dita
  `<svg viewBox="0 0 240 150" aria-hidden="true">
    <rect x="80" y="6" width="80" height="138" rx="15" fill="#20232b" stroke="#e8eaee" stroke-width="2"/>
    <rect x="86" y="13" width="68" height="124" rx="10" fill="#343a46"/>
    <g transform="rotate(-12 120 74)">
      <rect x="96" y="48" width="48" height="54" rx="3" fill="${PAPER}" fill-opacity=".8"/>
      <path d="M100 96 L113 76 L121 87 L128 79 L140 96 Z" fill="${INK}" fill-opacity=".55"/>
      <circle cx="131" cy="60" r="4.5" fill="${ACCENT}"/>
    </g>
    <circle cx="99" cy="42" r="8" fill="${ACCENT}" fill-opacity=".92"/>
    <circle cx="142" cy="108" r="8" fill="${ACCENT}" fill-opacity=".92"/>
    <path d="M86 29l-9-9m0 0h7m-7 0v7M155 121l9 9m0 0h-7m7 0v-7" stroke="${ACCENT}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M30 75h28m0 0l-6-6m6 6l-6 6" stroke="#a3a8b3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="24" cy="75" r="7" fill="#a3a8b3"/>
  </svg>`,
  // 3. Blocca e disegna
  `<svg viewBox="0 0 240 150" aria-hidden="true">
    <g transform="rotate(-5 104 80)">
      <rect x="40" y="18" width="124" height="120" rx="7" fill="${PAPER}"/>
      <path d="M102 116 C 70 92, 56 72, 66 56 C 76 41, 96 44, 102 60 C 106 47, 124 41, 136 53" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <path d="M136 53 C 148 66, 140 92, 102 116" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 8"/>
    </g>
    <g transform="translate(134 50) rotate(-48) scale(.4)">
      <polygon points="0,0 12,-5.4 12,5.4" fill="${INK}"/>
      <polygon points="12,-5.4 40,-18 40,18 12,5.4" fill="#f3cf9f"/>
      <rect x="40" y="-18" width="150" height="36" fill="${ACCENT}"/>
      <rect x="190" y="-18" width="22" height="36" fill="#c9ced6"/>
      <path d="M212,-18 h18 a8,8 0 0 1 8,8 v20 a8,8 0 0 1 -8,8 h-18 z" fill="#ff8fa3"/>
    </g>
    <circle cx="200" cy="112" r="27" fill="#20232b" stroke="#3a3f4b" stroke-width="2"/>
    <circle cx="200" cy="112" r="31" fill="none" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" stroke-dasharray="140 200" transform="rotate(-90 200 112)"/>
    <g transform="translate(188 100)" color="#f4f5f7">${icons.lock.replace('<svg ', '<svg width="24" height="24" ')}</g>
  </svg>`,
];

const SLIDES = [
  {
    title: 'Metti l’iPhone su un supporto',
    text:
      'Appoggialo su un bicchiere, una pila di libri o un treppiede, a circa <b>30–40 cm</b> sopra il foglio, ' +
      'con la fotocamera rivolta verso il basso.<br><br>Consiglio: attiva il <b>blocco rotazione</b> dal Centro di ' +
      'Controllo (scorri giù dall’angolo in alto a destra e tocca il lucchetto con la freccia).',
  },
  {
    title: 'Carica l’immagine',
    text:
      'Tocca <b>Immagine</b> e scegli una foto. Spostala con <b>un dito</b>; con <b>due dita</b> la ingrandisci e la ' +
      'ruoti. Con la barra in basso regoli la trasparenza.',
  },
  {
    title: 'Blocca e disegna',
    text:
      'Tocca <b>Blocca</b>: l’immagine non si muove più, anche se tocchi lo schermo per sbaglio. Guarda lo schermo e ' +
      'ricalca i contorni sul foglio.<br><br>Per sbloccare <b>tieni premuto il lucchetto</b> per un secondo.',
  },
];

export function showGuide(root, onDone) {
  const el = html(`
    <div class="modal guide" role="dialog" aria-modal="true" aria-label="Guida">
      <div class="modal-card guide-card scroll">
        <div class="guide-art"></div>
        <div class="guide-step"></div>
        <h2 class="guide-title"></h2>
        <p class="guide-text"></p>
        <div class="guide-dots">${SLIDES.map(() => '<i></i>').join('')}</div>
        <div class="guide-actions">
          <button class="link-btn" data-g="back"></button>
          <button class="big-btn primary" data-g="next"></button>
        </div>
      </div>
    </div>`);
  root.appendChild(el);
  let i = 0;

  function show() {
    el.querySelector('.guide-art').innerHTML = ART[i];
    el.querySelector('.guide-step').textContent = `Passo ${i + 1} di ${SLIDES.length}`;
    el.querySelector('.guide-title').textContent = SLIDES[i].title;
    el.querySelector('.guide-text').innerHTML = SLIDES[i].text;
    el.querySelectorAll('.guide-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    el.querySelector('[data-g="back"]').textContent = i === 0 ? 'Salta' : 'Indietro';
    el.querySelector('[data-g="next"]').textContent = i === SLIDES.length - 1 ? 'Inizia' : 'Avanti';
    el.querySelector('.guide-card').scrollTop = 0;
  }

  function close() {
    el.remove();
    onDone?.();
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    if (b.dataset.g === 'next') {
      if (i < SLIDES.length - 1) i++;
      else return close();
    } else if (i === 0) return close();
    else i--;
    show();
  });

  show();
}
