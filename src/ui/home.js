// Schermata iniziale: scelta della modalità.
import { html } from './dom.js';
import { icons } from './icons.js';
import { installBanner } from './install.js';

export function renderHome(root, app) {
  const el = html(`
    <div class="screen home scroll">
      <div class="home-inner">
        <header class="brand">
          <img src="icon-192.png" alt="" width="64" height="64">
          <div>
            <h1>Ricalco</h1>
            <p>Ricalca qualsiasi immagine su un foglio guardando lo schermo.</p>
          </div>
        </header>
        <div class="install-slot"></div>
        <button class="mode-card featured" data-mode="fixed">
          <span class="mode-art">${icons.phone}</span>
          <span class="mode-body">
            <span class="mode-title">Telefono fisso <span class="badge">Consigliata</span></span>
            <span class="mode-text">Il telefono resta fermo su un supporto sopra il foglio. Semplice e preciso.</span>
          </span>
          <span class="chev">${icons.chevron}</span>
        </button>
        <button class="mode-card disabled" data-mode="marker" aria-disabled="true">
          <span class="mode-art">${icons.marker}</span>
          <span class="mode-body">
            <span class="mode-title">Foglio con marker <span class="badge muted">In arrivo</span></span>
            <span class="mode-text">Stampi un foglio con 4 simboli negli angoli: l’immagine resta agganciata al foglio anche se muovi il telefono.</span>
          </span>
        </button>
        <div class="home-links">
          <button class="link-btn" data-act="guide">${icons.help}<span>Come funziona</span></button>
        </div>
        <p class="home-foot">Le immagini restano sul telefono: niente viene inviato su Internet.</p>
      </div>
    </div>`);
  const banner = installBanner();
  if (banner) el.querySelector('.install-slot').appendChild(banner);

  el.addEventListener('click', (e) => {
    const mode = e.target.closest('[data-mode]');
    if (mode && mode.dataset.mode === 'fixed') return app.go('fixed');
    const act = e.target.closest('[data-act]');
    if (act?.dataset.act === 'guide') app.showGuide();
  });
  root.appendChild(el);
  return { destroy: () => el.remove() };
}
