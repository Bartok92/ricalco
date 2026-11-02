// Preparazione dell'immagine scelta dall'utente.
// Safari ha limiti di memoria stretti sui canvas e le foto iPhone possono essere
// enormi (fino a 48 MP): si riduce a 4096 px sul lato lungo. L'orientamento EXIF
// è già applicato da Safari sia all'<img> sia a drawImage.

import { detectEdges } from './edges.js';

export const MAX_SIDE = 4096;
const EDGE_SIDE = 1600;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('immagine non leggibile'));
    img.src = src;
  });
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('codifica non riuscita'))), type, quality);
  });
}

function hasTransparency(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 48, 48);
  const d = ctx.getImageData(0, 0, 48, 48).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

export async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(url);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error('immagine vuota');
    const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));

    // Già abbastanza piccola e in un formato sicuro: si tiene il file com'è.
    if (k === 1 && /^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      return { blob: file, w: w0, h: h0 };
    }

    const w = Math.max(1, Math.round(w0 * k));
    const h = Math.max(1, Math.round(h0 * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const alpha = file.type !== 'image/jpeg' && hasTransparency(img);
    const blob = await toBlob(canvas, alpha ? 'image/png' : 'image/jpeg', 0.92);
    canvas.width = canvas.height = 0; // libera subito la memoria del canvas
    return { blob, w, h };
  } finally {
    URL.revokeObjectURL(url);
    if (img) img.src = '';
  }
}

let worker = null;
function edgesInWorker(data, w, h) {
  return new Promise((resolve, reject) => {
    try {
      worker ??= new Worker(new URL('./edges.worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }
    worker.onmessage = (e) => resolve(new Uint8ClampedArray(e.data.buf));
    worker.onerror = (e) => {
      worker = null;
      reject(e);
    };
    worker.postMessage({ w, h, buf: data.buffer }, [data.buffer]);
  });
}

// "Solo contorni": calcolati una sola volta su una copia ridotta dell'immagine.
// Il risultato è un PNG con linee scure su fondo trasparente.
export async function makeEdges(srcUrl, w, h) {
  const img = await loadImage(srcUrl);
  const k = Math.min(1, EDGE_SIDE / Math.max(w, h));
  const ew = Math.max(3, Math.round(w * k));
  const eh = Math.max(3, Math.round(h * k));
  const canvas = document.createElement('canvas');
  canvas.width = ew;
  canvas.height = eh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; // le parti trasparenti contano come carta bianca
  ctx.fillRect(0, 0, ew, eh);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, ew, eh);
  img.src = '';
  const input = ctx.getImageData(0, 0, ew, eh).data;
  let out;
  try {
    out = await edgesInWorker(new Uint8ClampedArray(input), ew, eh);
  } catch {
    out = detectEdges(input, ew, eh);
  }
  ctx.clearRect(0, 0, ew, eh);
  ctx.putImageData(new ImageData(out, ew, eh), 0, 0);
  const blob = await toBlob(canvas, 'image/png');
  canvas.width = canvas.height = 0;
  return blob;
}
