// Invito a installare l'app nella schermata Home (Safari su iPhone).
import { html } from './dom.js';
import { icons } from './icons.js';
import { isIOS, isStandalone, isOtherIOSBrowser } from '../ios.js';

let dismissed = false;
let androidPrompt = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  androidPrompt = e;
});

const key = (icon) => `<span class="ios-key">${icon}</span>`;

export function installBanner() {
  if (dismissed || isStandalone()) return null;
  if (!isIOS && !androidPrompt) return null;
  const el = html(`
    <div class="install">
      <div class="install-icon">${icons.addSquare}</div>
      <div class="install-text">
        <b>Installa Ricalco</b>
        <span>Funziona meglio: schermo intero e dati al sicuro.</span>
      </div>
      <button class="link-btn" data-i="how">${isIOS ? 'Come si fa' : 'Installa'}</button>
      <button class="icon-btn install-close" data-i="close" aria-label="Non ora">${icons.close}</button>
    </div>`);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    if (b.dataset.i === 'close') {
      dismissed = true;
      el.remove();
    } else if (isIOS) {
      showInstallHelp(document.body);
    } else if (androidPrompt) {
      androidPrompt.prompt();
      androidPrompt = null;
      el.remove();
    }
  });
  return el;
}

export function showInstallHelp(root) {
  const browser = isOtherIOSBrowser ? 'del browser' : 'di Safari';
  const el = html(`
    <div class="modal" role="dialog" aria-modal="true" aria-label="Installa Ricalco">
      <div class="modal-card scroll">
        <div class="modal-head"><h2>Aggiungi alla schermata Home</h2><button class="icon-btn" data-x aria-label="Chiudi">${icons.close}</button></div>
        <ol class="steps">
          <li><span class="step-n">1</span><span>Tocca il pulsante <b>Condividi</b> ${key(icons.share)} nella barra ${browser}.
            Se non lo vedi, tocca prima ${key(icons.more)} .</span></li>
          <li><span class="step-n">2</span><span>Scorri l’elenco e tocca <b>Aggiungi alla schermata Home</b> ${key(icons.addSquare)} .</span></li>
          <li><span class="step-n">3</span><span>Lascia attivo <b>Apri come app web</b>, se c’è, e tocca <b>Aggiungi</b> in alto a destra.</span></li>
          <li><span class="step-n">4</span><span>Da ora apri Ricalco dalla sua icona nella schermata Home.</span></li>
        </ol>
        <div class="benefits">
          <b>Perché conviene installarla</b>
          <ul>
            <li>Si apre a <b>schermo intero</b>, senza le barre di Safari.</li>
            <li>Immagine e impostazioni <b>restano salvate</b>: Safari cancella i dati dei siti non aperti da qualche giorno, le app installate no.</li>
            <li>Funziona anche <b>senza Internet</b>, dopo la prima apertura dall’icona.</li>
          </ul>
        </div>
        <button class="big-btn primary block" data-x>Ho capito</button>
      </div>
    </div>`);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-x]')) el.remove();
  });
  root.appendChild(el);
}
