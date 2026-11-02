// Posizionamento in modalità "Telefono fisso".
//
// La posa dell'immagine NON è salvata in pixel dello schermo ma rispetto al
// fotogramma della fotocamera, riportato all'orientamento verticale del telefono:
//   x, y   centro dell'immagine rispetto al centro del fotogramma, in unità D
//          (D = lato lungo del fotogramma come appare a schermo, con object-fit: cover)
//   rot    rotazione in gradi
//   scale  unità D per pixel dell'immagine
//   flip   specchiata orizzontalmente
// Quando l'interfaccia ruota, anche iOS ruota il fotogramma: lo stesso punto del
// foglio resta nello stesso punto fisico del vetro e così l'immagine.

import { uiAngle } from '../ios.js';

const rad = Math.PI / 180;

function rotate(x, y, deg) {
  const c = Math.cos(deg * rad);
  const s = Math.sin(deg * rad);
  return [x * c - y * s, x * s + y * c];
}

export class FixedEngine {
  constructor(view) {
    this.view = view; // fornisce size {vw, vh}, video, image {w, h}
    this.pose = null;
    this.aspect = null; // proporzioni (lato lungo / lato corto) del fotogramma usato
  }

  mapping(aspectOverride) {
    const { vw, vh } = this.view.size;
    const v = this.view.video;
    let fw = v.videoWidth;
    let fh = v.videoHeight;
    if (aspectOverride || !(fw > 0 && fh > 0)) {
      // Senza video (fotocamera non ancora attiva) si usa l'ultimo fotogramma noto.
      const a = aspectOverride || this.aspect || Math.max(vw, vh) / Math.min(vw, vh);
      [fw, fh] = vh >= vw ? [1, a] : [a, 1];
    }
    // Su iOS il fotogramma segue l'orientamento dell'interfaccia.
    const follows = fh >= fw === vh >= vw;
    const r = follows ? uiAngle() : 0;
    const D = Math.max(fw, fh) * Math.max(vw / fw, vh / fh);
    return { cx: vw / 2, cy: vh / 2, D, r };
  }

  liveAspect() {
    const v = this.view.video;
    if (!(v.videoWidth > 0 && v.videoHeight > 0)) return null;
    return Math.max(v.videoWidth, v.videoHeight) / Math.min(v.videoWidth, v.videoHeight);
  }

  // Se cambia la forma del fotogramma (prima accensione, altro obiettivo) l'immagine
  // resta dov'è sullo schermo. Restituisce true se la posa è stata adattata.
  sync() {
    const live = this.liveAspect();
    if (!live) return false;
    if (this.aspect && Math.abs(live - this.aspect) < 0.01) return false;
    if (!this.pose) {
      this.aspect = live;
      return false;
    }
    const { vw, vh } = this.view.size;
    const before = this.aspect || Math.max(vw, vh) / Math.min(vw, vh);
    const screen = this.toScreen(this.pose, this.mapping(before));
    this.aspect = live;
    this.pose = this.fromScreen(screen, this.mapping());
    return true;
  }

  toScreen(p, m = this.mapping()) {
    const [dx, dy] = rotate(p.x * m.D, p.y * m.D, -m.r);
    return { x: m.cx + dx, y: m.cy + dy, rot: p.rot - m.r, scale: p.scale * m.D, flip: p.flip };
  }

  fromScreen(s, m = this.mapping()) {
    const [x, y] = rotate((s.x - m.cx) / m.D, (s.y - m.cy) / m.D, m.r);
    return { x, y, rot: s.rot + m.r, scale: s.scale / m.D, flip: !!s.flip };
  }

  // --- interfaccia per le gesture (spazio = pixel dello schermo) ---

  getScreenPose() {
    return this.toScreen(this.pose);
  }

  setScreenPose(s) {
    this.pose = this.fromScreen(this.clamp(s));
  }

  clampScale(k) {
    const { vw, vh } = this.view.size;
    const side = Math.max(this.view.image.w, this.view.image.h);
    return Math.min((Math.max(vw, vh) * 12) / side, Math.max(48 / side, k));
  }

  // Almeno una striscia dell'immagine resta sempre sullo schermo.
  clamp(s) {
    const { vw, vh } = this.view.size;
    const { w, h } = this.view.image;
    const scale = this.clampScale(s.scale);
    const c = Math.abs(Math.cos(s.rot * rad));
    const n = Math.abs(Math.sin(s.rot * rad));
    const hx = ((c * w + n * h) * scale) / 2;
    const hy = ((n * w + c * h) * scale) / 2;
    const m = 56;
    return {
      ...s,
      scale,
      x: Math.min(vw - m + hx, Math.max(m - hx, s.x)),
      y: Math.min(vh - m + hy, Math.max(m - hy, s.y)),
    };
  }

  // --- comandi ---

  // Centrata e adattata allo schermo; la rotazione torna al multiplo di 90° più vicino.
  fit() {
    const { vw, vh } = this.view.size;
    const { w, h } = this.view.image;
    if (!this.aspect) this.aspect = this.liveAspect() || Math.max(vw, vh) / Math.min(vw, vh);
    const current = this.pose ? this.toScreen(this.pose) : { rot: 0, flip: false };
    const rot = Math.round(current.rot / 90) * 90;
    const odd = Math.abs(rot / 90) % 2 === 1;
    const [iw, ih] = odd ? [h, w] : [w, h];
    const scale = Math.min((vw * 0.9) / iw, (vh * 0.74) / ih);
    this.pose = this.fromScreen({ x: vw / 2, y: vh / 2, rot, scale, flip: current.flip });
  }

  rotate90() {
    const s = this.toScreen(this.pose);
    s.rot = Math.round((s.rot + 90) / 90) * 90;
    this.setScreenPose(s);
  }

  flip() {
    this.pose.flip = !this.pose.flip;
  }

  // Zoom della fotocamera: il foglio si ingrandisce attorno al centro, l'immagine lo segue.
  zoomBy(f) {
    if (!this.pose || !(f > 0) || f === 1) return;
    this.pose.x *= f;
    this.pose.y *= f;
    this.pose.scale *= f;
  }

  serialize() {
    return this.pose ? { ...this.pose, aspect: this.aspect } : null;
  }

  restore(saved) {
    if (!saved) return false;
    const { aspect, ...pose } = saved;
    if (![pose.x, pose.y, pose.rot, pose.scale].every(Number.isFinite) || pose.scale <= 0) return false;
    this.pose = { ...pose, flip: !!pose.flip };
    this.aspect = aspect || null;
    return true;
  }

  // Matrice CSS per l'elemento immagine (dimensione logica w x h, origine in alto a sinistra).
  affine() {
    const { w, h } = this.view.image;
    const p = this.toScreen(this.pose);
    const c = Math.cos(p.rot * rad);
    const s = Math.sin(p.rot * rad);
    const fx = p.flip ? -1 : 1;
    const a = p.scale * fx * c;
    const b = p.scale * fx * s;
    const cc = -p.scale * s;
    const d = p.scale * c;
    return { a, b, c: cc, d, e: p.x - (a * w + cc * h) / 2, f: p.y - (b * w + d * h) / 2 };
  }

  cssTransform(m) {
    const n = (v) => v.toFixed(6);
    return `matrix3d(${n(m.a)},${n(m.b)},0,0,${n(m.c)},${n(m.d)},0,0,0,0,1,0,${m.e.toFixed(2)},${m.f.toFixed(2)},0,1)`;
  }

  // Punto dell'immagine (in pixel immagine) -> punto dello schermo, per disegnare la griglia.
  project(m, X, Y) {
    return [m.a * X + m.c * Y + m.e, m.b * X + m.d * Y + m.f];
  }
}
