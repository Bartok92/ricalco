// Stato dell'app salvato in IndexedDB: si ritrova tutto riaprendo l'app.
import * as db from './store.js';

const KEY = 'state';

const defaults = () => ({
  v: 1,
  onboarded: false,
  screen: 'home', // 'home' | 'fixed'
  opacity: 0.5,
  filter: 'none', // 'none' | 'bw' | 'contrast' | 'edges'
  grid: 0, // quadretti sul lato corto, 0 = niente griglia
  locked: false,
  uiHidden: false,
  image: null, // { id, w, h }
  edgesFor: null, // id dell'immagine di cui sono salvati i contorni
  fixed: null, // posizione dell'immagine in modalità "Telefono fisso"
  camera: { deviceId: null, kind: null, auto: true, zoom: null, torch: false },
});

export const state = defaults();

export async function loadState() {
  try {
    const saved = await db.get(KEY);
    if (saved && saved.v === 1) {
      Object.assign(state, saved, { camera: { ...state.camera, ...saved.camera } });
    }
  } catch {
    // primo avvio o archivio non disponibile
  }
  return state;
}

let timer = 0;
export function saveState(now = false) {
  clearTimeout(timer);
  if (!now) {
    timer = setTimeout(() => saveState(true), 400);
    return Promise.resolve();
  }
  return db.set(KEY, JSON.parse(JSON.stringify(state)));
}

// iOS può chiudere l'app in background senza preavviso: si salva appena si nasconde.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveState(true);
});
addEventListener('pagehide', () => saveState(true));

// Le immagini si salvano come ArrayBuffer: è il formato più affidabile su Safari.
export async function putBlob(key, blob) {
  const buf = await blob.arrayBuffer();
  await db.set(key, { type: blob.type, buf });
}

export async function getBlob(key) {
  const v = await db.get(key);
  return v && v.buf ? new Blob([v.buf], { type: v.type }) : null;
}

export const delBlob = (key) => db.del(key);
