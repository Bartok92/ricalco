// Rilevamento iOS / modalità installata e protezioni dei gesti di sistema.

const ua = navigator.userAgent;

export const isIOS =
  /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

export function isStandalone() {
  return (
    navigator.standalone === true ||
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches
  );
}

// Versione di iOS come numero (es. 17.5). Da iOS 26 la parte "OS xx_x" dell'user agent
// è congelata, quindi si prende anche "Version/xx" quando c'è.
export function iosVersion() {
  if (!isIOS) return 0;
  const os = /OS (\d+)[_.](\d+)/.exec(ua);
  const ver = /Version\/(\d+)\.(\d+)/.exec(ua);
  const n = (m) => (m ? Number(m[1]) + Number(m[2]) / 10 : 0);
  return Math.max(n(os), n(ver));
}

export const isOtherIOSBrowser = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

// Angolo dell'interfaccia rispetto al verticale naturale: 0, 90, 180, 270
// (positivo = telefono ruotato in senso antiorario, come window.orientation).
export function uiAngle() {
  let a = typeof window.orientation === 'number' ? window.orientation : screen.orientation?.angle ?? 0;
  a = Math.round(a / 90) * 90;
  return ((a % 360) + 360) % 360;
}

// Blocca zoom della pagina, rimbalzo, menu contestuale e selezione del testo.
// Safari ignora user-scalable=no: lo zoom a due dita si ferma solo sui gesture*.
export function installTouchGuards() {
  const prevent = (e) => e.preventDefault();
  const opts = { passive: false };
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(t, prevent, opts);
  }
  // Nessuno scorrimento tranne dentro i pannelli marcati .scroll (e mai con due dita).
  document.addEventListener(
    'touchmove',
    (e) => {
      const inScroll = e.target instanceof Element && e.target.closest('.scroll');
      if (!inScroll || e.touches.length > 1) e.preventDefault();
    },
    opts,
  );
  document.addEventListener('contextmenu', prevent);
  document.addEventListener('selectstart', prevent);
  document.addEventListener('dragstart', prevent);
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // non disponibile: pazienza
  }
}
