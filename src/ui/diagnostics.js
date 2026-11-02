// "Info tecniche": stato della fotocamera e del telefono, da mandare in screenshot
// quando qualcosa non funziona. Si aggiorna ogni secondo.
/* global __APP_BUILD__ */
import { html } from './dom.js';
import { icons } from './icons.js';
import { isIOS, isStandalone, iosVersion, uiAngle } from '../ios.js';

function lines(screen) {
  const c = screen.camera;
  const v = screen.video;
  const t = c.track;
  let s = {};
  try {
    s = t?.getSettings() || {};
  } catch {
    s = {};
  }
  const current = c.currentDeviceId();
  const ago = c.lastFrame ? `${((performance.now() - c.lastFrame) / 1000).toFixed(1)} s fa` : 'mai';
  return [
    `Versione: ${__APP_BUILD__}`,
    `iOS: ${isIOS ? iosVersion() : 'no'} · installata: ${isStandalone() ? 'sì' : 'no'}`,
    `Schermo: ${innerWidth}×${innerHeight} @${devicePixelRatio} · rotazione ${uiAngle()}°`,
    `Fotocamera: ${c.status}${c.needsTap ? ' (serve un tocco)' : ''}${c.suspended ? ' (sospesa)' : ''}`,
    `Traccia: ${t ? `${t.label || '?'} · ${t.readyState}${t.muted ? ' · MUTA' : ''}${t.enabled ? '' : ' · disattivata'}` : 'nessuna'}`,
    `Formato: ${s.width ?? '?'}×${s.height ?? '?'}${s.frameRate ? ` · ${Math.round(s.frameRate)} fps` : ''}${s.facingMode ? ` · ${s.facingMode}` : ''}${s.zoom ? ` · zoom ${s.zoom}` : ''}`,
    `Video: ${v.paused ? 'IN PAUSA' : 'in riproduzione'} · stato ${v.readyState} · ${v.videoWidth}×${v.videoHeight} · t ${v.currentTime.toFixed(1)}`,
    `Fotogrammi: ${c.frames ?? '?'} · ultimo ${ago}`,
    `Zoom: ${c.caps.zoom ? `${c.caps.zoom.min}–${c.caps.zoom.max}` : 'no'} · torcia: ${c.caps.torch ? 'sì' : 'no'}`,
    `Schermo acceso: ${screen.awake.describe()}`,
    'Obiettivi:',
    ...(c.devices.length
      ? c.devices.map((d) => `  ${d.deviceId === current ? '●' : '○'} ${d.name} — ${d.label || '?'}`)
      : ['  (nessuno)']),
    'Eventi:',
    ...c.log.slice(-15).map((l) => `  ${l}`),
  ];
}

export function showDiagnostics(root, screen) {
  const el = html(`
    <div class="modal" role="dialog" aria-modal="true" aria-label="Info tecniche">
      <div class="modal-card scroll">
        <div class="modal-head"><h2>Info tecniche</h2><button class="icon-btn" data-x aria-label="Chiudi">${icons.close}</button></div>
        <p class="diag-hint">Se qualcosa non funziona, fai uno screenshot di questa pagina e mandalo a chi ti ha dato l’app.</p>
        <pre class="diag"></pre>
        <a class="big-btn block diag-test" href="prova-fotocamera.html">Prova fotocamera di base</a>
        <button class="big-btn primary block" data-x>Chiudi</button>
      </div>
    </div>`);
  const pre = el.querySelector('.diag');
  const render = () => {
    pre.textContent = lines(screen).join('\n');
  };
  render();
  const timer = setInterval(render, 1000);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-x]')) {
      clearInterval(timer);
      el.remove();
    }
  });
  root.appendChild(el);
}
