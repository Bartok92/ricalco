// Schermata di ricalco: video della fotocamera, immagine semitrasparente sopra,
// barra strumenti, blocco, pannello "Strumenti". Il posizionamento dell'immagine
// è delegato al "motore" (per ora FixedEngine, "Telefono fisso").

import { icons } from '../ui/icons.js';
import { html, esc, listen } from '../ui/dom.js';
import { createSlider } from '../ui/slider.js';
import { Camera } from '../camera.js';
import { KeepAwake } from '../keepawake.js';
import { attachGestures } from '../gestures.js';
import { prepareImage, makeEdges } from '../image.js';
import { state, saveState, putBlob, getBlob, delBlob } from '../state.js';
import { FixedEngine } from './fixed-engine.js';
import { showDiagnostics } from '../ui/diagnostics.js';

// Bianco e nero e contrasto sono filtri CSS che Safari applica in GPU;
// i contorni invece sono un'immagine calcolata una volta sola.
const CSS_FILTERS = {
  none: 'none',
  bw: 'grayscale(1)',
  contrast: 'grayscale(1) contrast(1.9) brightness(1.06)',
  edges: 'none',
};
const FILTERS = [
  ['none', 'Originale'],
  ['bw', 'Bianco e nero'],
  ['contrast', 'Alto contrasto'],
  ['edges', 'Solo contorni'],
];
const GRIDS = [0, 3, 4, 6, 8];

const CAMERA_MESSAGES = {
  denied: {
    title: 'Serve il permesso per la fotocamera',
    text:
      'Tocca «Attiva fotocamera» e poi «Consenti».<br><br>Se la richiesta non compare apri ' +
      '<b>Impostazioni → App → Safari → Fotocamera</b> (su iOS 17: <b>Impostazioni → Safari → Fotocamera</b>), ' +
      'scegli <b>Chiedi</b> o <b>Consenti</b>, poi torna qui e tocca «Ricarica l’app».',
    retry: true,
    reload: true,
  },
  busy: {
    title: 'La fotocamera è occupata',
    text: 'La sta usando un’altra app, per esempio una chiamata o FaceTime. Riprovo da solo tra pochi secondi.',
    retry: true,
  },
  nocamera: {
    title: 'Nessuna fotocamera trovata',
    text: 'Questo dispositivo non sembra avere una fotocamera utilizzabile.',
    retry: true,
  },
  insecure: {
    title: 'Collegamento non sicuro',
    text: 'La fotocamera funziona solo se l’app è aperta da un indirizzo https.',
  },
  unsupported: {
    title: 'Fotocamera non disponibile',
    text: 'Questo browser non permette di usare la fotocamera. Apri Ricalco con Safari.',
  },
  error: {
    title: 'La fotocamera non si è avviata',
    text: 'Riprovo da solo tra qualche secondo.',
    retry: true,
  },
  paused: {
    title: 'Video della fotocamera in pausa',
    text: 'iPhone ha fermato il video. Tocca il pulsante per farlo ripartire.',
    play: true,
  },
};
// In questi stati la fotocamera non tiene acceso lo schermo: serve il ripiego.
const CAMERA_OFF = ['denied', 'busy', 'nocamera', 'insecure', 'unsupported', 'error'];

let rotationTipShown = false;

const TEMPLATE = `
<div class="screen trace">
  <div class="stage">
    <video class="cam" playsinline webkit-playsinline muted autoplay disablepictureinpicture disableremoteplayback x-webkit-airplay="deny"></video>
    <img class="overlay-img" alt="" draggable="false">
    <canvas class="grid-canvas"></canvas>
    <div class="gesture-layer"></div>
  </div>

  <div class="pill cam-pill hidden">${icons.camera}<span>Avvio fotocamera…</span></div>

  <div class="notice cam-notice scroll hidden" role="alert">
    <button class="icon-btn notice-close" data-act="notice-close" aria-label="Chiudi">${icons.close}</button>
    <div class="notice-icon">${icons.camera}</div>
    <h3 class="notice-title"></h3>
    <p class="notice-text"></p>
    <div class="notice-actions">
      <button class="big-btn primary" data-act="cam-play">${icons.camera}<span>Avvia video</span></button>
      <button class="big-btn primary" data-act="cam-retry">${icons.camera}<span>Attiva fotocamera</span></button>
      <button class="link-btn" data-act="reload">Ricarica l’app</button>
    </div>
  </div>

  <div class="empty-cta hidden">
    <button class="big-btn primary" data-act="pick">${icons.image}<span>Carica immagine</span></button>
    <p>Dalla Libreria foto, scattando una foto o da File</p>
  </div>

  <div class="busy hidden"><div class="spinner"></div><span class="busy-text"></span></div>
  <div class="toast" aria-live="polite"></div>

  <button class="corner-btn show-ui" data-act="show" aria-label="Mostra i comandi">${icons.eye}</button>

  <div class="sheet scroll" aria-hidden="true">
    <div class="sheet-head"><b>Strumenti</b><button class="icon-btn" data-act="tools" aria-label="Chiudi">${icons.close}</button></div>
    <div class="sec two">
      <button class="chip" data-act="flip">${icons.flip}<span>Specchia</span></button>
      <button class="chip" data-act="rot90">${icons.rotate}<span>Ruota 90°</span></button>
    </div>
    <div class="sec">
      <div class="sec-title">Filtro</div>
      <div class="seg grid2" data-group="filter">${FILTERS.map(([v, l]) => `<button data-val="${v}">${l}</button>`).join('')}</div>
    </div>
    <div class="sec">
      <div class="sec-title">Griglia a quadretti <span class="sec-note">quadretti sul lato corto</span></div>
      <div class="seg" data-group="grid">${GRIDS.map((n) => `<button data-val="${n}">${n || 'No'}</button>`).join('')}</div>
    </div>
    <div class="sec cam-sec hidden">
      <div class="sec-title">Fotocamera</div>
      <div class="seg col" data-group="camera"></div>
    </div>
    <div class="sec zoom-sec hidden">
      <div class="sec-title">Zoom fotocamera <span class="zoom-val"></span></div>
      <div class="zoom-slider"></div>
    </div>
    <div class="sec torch-sec hidden">
      <button class="chip wide" data-act="torch">${icons.torch}<span>Torcia</span></button>
    </div>
    <div class="sec two">
      <button class="chip" data-act="guide">${icons.help}<span>Guida</span></button>
      <button class="chip" data-act="home">${icons.home}<span>Schermata iniziale</span></button>
    </div>
    <div class="sec-foot"><button class="link-btn small" data-act="info">Info tecniche</button></div>
  </div>

  <div class="bar">
    <div class="bar-opacity">
      <span class="op-icon" aria-hidden="true">${icons.opacity}</span>
      <div class="op-slider"></div>
      <span class="op-val"></span>
    </div>
    <div class="bar-buttons">
      <button class="tb" data-act="pick">${icons.image}<span>Immagine</span></button>
      <button class="tb" data-act="center">${icons.center}<span>Centra</span></button>
      <button class="tb tools-btn" data-act="tools">${icons.tools}<span>Strumenti</span></button>
      <button class="tb" data-act="hide">${icons.eyeOff}<span>Nascondi</span></button>
      <button class="tb lock-btn" data-act="lock">${icons.lock}<span>Blocca</span></button>
    </div>
  </div>

  <div class="lock-fab" role="button" aria-label="Tieni premuto per sbloccare">
    <svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-bg" cx="40" cy="40" r="36"/><circle class="ring-fg" cx="40" cy="40" r="36"/></svg>
    <span class="lock-icon">${icons.lock}</span>
    <span class="unlock-icon">${icons.unlock}</span>
  </div>
  <div class="lock-hint">Tieni premuto il lucchetto per sbloccare</div>

  <input class="file-input" type="file" accept="image/*" tabindex="-1" aria-hidden="true">
</div>`;

export class TraceScreen {
  constructor(root, app) {
    this.app = app;
    this.cleanups = [];
    this.el = html(TEMPLATE);
    root.appendChild(this.el);
    this.q = (s) => this.el.querySelector(s);

    this.stage = this.q('.stage');
    this.video = this.q('.cam');
    this.video.muted = true;
    this.video.playsInline = true;
    this.img = this.q('.overlay-img');
    this.gridCanvas = this.q('.grid-canvas');

    this.size = { vw: 1, vh: 1 };
    this.dpr = 1;
    this.image = { w: 1, h: 1 }; // dimensione logica dell'immagine (px)
    this.hasImage = false;
    this.restoring = !!state.image;
    this.busy = false;
    this.urls = { main: null, edges: null };
    this.sheetOpen = false;
    this.dismissed = null;
    this.raf = 0;
    this.gridDrawn = false;

    this.engine = new FixedEngine(this);
    this.camera = new Camera(this.video);
    this.awake = new KeepAwake();
    this.awake.fallbackAllowed = false; // finché la fotocamera non dice il contrario

    this.setupLayout();
    this.setupControls();
    this.setupLock();
    this.setupGestures();
    this.setupFile();
    this.setupCamera();
    this.applyOpacity();
    this.applyUi();
    this.syncSheet();
    this.restore();
    if (import.meta.env.DEV) window.__trace = this; // solo per le prove in sviluppo
  }

  // ---------- impaginazione e disegno ----------

  setupLayout() {
    const ro = new ResizeObserver(() => this.measure());
    ro.observe(this.stage);
    const bar = this.q('.bar');
    const roBar = new ResizeObserver(() => {
      if (bar.offsetHeight) this.el.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
    });
    roBar.observe(bar);
    this.cleanups.push(() => {
      ro.disconnect();
      roBar.disconnect();
    });
    listen(this.cleanups, window, 'orientationchange', () => {
      this.measure();
      setTimeout(() => this.measure(), 400);
      if (this.hasImage && !rotationTipShown) {
        rotationTipShown = true;
        this.toast('Consiglio: blocca la rotazione dello schermo dal Centro di Controllo', 4500);
      }
    });
    listen(this.cleanups, this.video, 'resize', () => this.invalidate());
    listen(this.cleanups, this.video, 'loadedmetadata', () => this.invalidate());
    this.measure();
  }

  measure() {
    const vw = this.stage.clientWidth || innerWidth;
    const vh = this.stage.clientHeight || innerHeight;
    this.size = { vw, vh };
    this.dpr = Math.min(3, devicePixelRatio || 1);
    const W = Math.round(vw * this.dpr);
    const H = Math.round(vh * this.dpr);
    if (this.gridCanvas.width !== W || this.gridCanvas.height !== H) {
      this.gridCanvas.width = W;
      this.gridCanvas.height = H;
      this.gridDrawn = true; // ridimensionare svuota il canvas: va ridisegnato
    }
    this.invalidate();
  }

  invalidate() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  render() {
    if (!this.hasImage || !this.engine.pose) {
      this.clearGrid();
      return;
    }
    if (this.engine.sync()) {
      state.fixed = this.engine.serialize();
      saveState();
    }
    const m = this.engine.affine();
    this.img.style.transform = this.engine.cssTransform(m);
    this.drawGrid(m);
  }

  clearGrid() {
    if (!this.gridDrawn) return;
    const ctx = this.gridCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
    this.gridDrawn = false;
  }

  // Griglia disegnata in pixel dello schermo: linee sempre sottili e nitide
  // qualunque sia lo zoom, e segue l'immagine (posizione, rotazione, specchio).
  drawGrid(m) {
    this.clearGrid();
    const n = state.grid;
    if (!n) return;
    const { w, h } = this.image;
    const cell = Math.min(w, h) / n;
    const ctx = this.gridCanvas.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.beginPath();
    const line = (x0, y0, x1, y1) => {
      const [a, b] = this.engine.project(m, x0, y0);
      const [c, d] = this.engine.project(m, x1, y1);
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
    };
    for (let x = 0; x < w - 0.5; x += cell) line(x, 0, x, h);
    line(w, 0, w, h);
    for (let y = 0; y < h - 0.5; y += cell) line(0, y, w, y);
    line(0, h, w, h);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,64,110,0.95)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    this.gridDrawn = true;
  }

  // ---------- comandi ----------

  setupControls() {
    this.opacity = createSlider(this.q('.op-slider'), {
      min: 0,
      max: 1,
      value: state.opacity,
      label: 'Trasparenza',
      onInput: (v) => {
        state.opacity = v;
        this.applyOpacity();
      },
      onChange: () => saveState(),
    });
    this.zoom = createSlider(this.q('.zoom-slider'), {
      min: 1,
      max: 2,
      value: 1,
      label: 'Zoom fotocamera',
      onInput: (z) => this.setZoom(z),
    });
    listen(this.cleanups, this.el, 'click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !this.el.contains(btn)) return;
      const group = btn.parentElement?.dataset.group;
      if (group) this.choose(group, btn.dataset.val);
      else if (btn.dataset.act) this.act(btn.dataset.act);
    });
  }

  act(name) {
    switch (name) {
      case 'pick':
        return this.pickImage();
      case 'center':
        if (this.hasImage) {
          this.engine.fit();
          this.commit();
        }
        return;
      case 'tools':
        return this.toggleSheet();
      case 'hide':
        state.uiHidden = true;
        this.toggleSheet(false);
        saveState();
        return this.toast('Per rivedere i comandi tocca l’occhio in alto a destra');
      case 'show':
        state.uiHidden = false;
        saveState();
        return this.applyUi();
      case 'lock':
        state.locked = true;
        this.toggleSheet(false);
        saveState();
        return this.toast('Immagine bloccata. Per sbloccare tieni premuto il lucchetto.', 3500);
      case 'flip':
        if (this.hasImage) {
          this.engine.flip();
          this.commit();
        }
        return;
      case 'rot90':
        if (this.hasImage) {
          this.engine.rotate90();
          this.commit();
        }
        return;
      case 'torch':
        this.camera.setTorch(!this.camera.prefs.torch);
        return this.syncSheet();
      case 'guide':
        return this.app.showGuide();
      case 'home':
        return this.app.go('home');
      case 'cam-retry':
        this.dismissed = null;
        return this.camera.open('pulsante Attiva fotocamera', true).then(() => {
          if (this.camera.status === 'denied') {
            this.toast('Ancora nessun permesso: segui le istruzioni qui sotto', 4000);
          }
        });
      case 'cam-play':
        return this.camera.play();
      case 'info':
        return showDiagnostics(document.body, this);
      case 'reload':
        return location.reload();
      case 'notice-close':
        this.dismissed = this.camera.status === 'running' && this.camera.needsTap ? 'paused' : this.camera.status;
        return this.onCameraStatus();
    }
  }

  choose(group, val) {
    if (group === 'filter') this.setFilter(val);
    else if (group === 'grid') {
      state.grid = Number(val);
      saveState();
      this.syncSheet();
      this.invalidate();
    } else if (group === 'camera') {
      this.camera.selectDevice(val);
      this.syncSheet();
    }
  }

  toggleSheet(force) {
    this.sheetOpen = force ?? !this.sheetOpen;
    this.syncSheet();
    this.applyUi();
  }

  applyUi() {
    const cl = this.el.classList;
    cl.toggle('locked', state.locked);
    cl.toggle('ui-hidden', state.uiHidden);
    const sheet = this.sheetOpen && !state.locked && !state.uiHidden;
    cl.toggle('sheet-open', sheet);
    this.q('.sheet').setAttribute('aria-hidden', String(!sheet));
    this.q('.tools-btn').classList.toggle('on', sheet);
    cl.toggle('has-image', this.hasImage);
    const showCta = !this.hasImage && !this.restoring && !this.busy && !state.locked && !state.uiHidden;
    this.q('.empty-cta').classList.toggle('hidden', !showCta);
  }

  syncSheet() {
    const mark = (group, val) => {
      for (const b of this.el.querySelectorAll(`[data-group="${group}"] button`)) {
        b.classList.toggle('on', b.dataset.val === String(val));
      }
    };
    mark('filter', state.filter);
    mark('grid', state.grid);
    mark('camera', this.camera.currentDeviceId() || this.camera.prefs.deviceId);
    this.q('[data-act="torch"]').classList.toggle('on', !!this.camera.prefs.torch);
  }

  applyOpacity() {
    this.img.style.opacity = String(state.opacity);
    this.q('.op-val').textContent = `${Math.round(state.opacity * 100)}%`;
  }

  commit() {
    this.invalidate();
    state.fixed = this.engine.serialize();
    saveState();
  }

  toast(text, ms = 2600) {
    const t = this.q('.toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  setBusy(text) {
    this.busy = !!text;
    this.q('.busy').classList.toggle('hidden', !text);
    if (text) this.q('.busy-text').textContent = text;
    this.applyUi();
  }

  // ---------- blocco: per sbloccare si tiene premuto il lucchetto ~1 secondo ----------

  setupLock() {
    const fab = this.q('.lock-fab');
    const ring = fab.querySelector('.ring-fg');
    const C = 2 * Math.PI * 36;
    const HOLD = 1000;
    let pid = null;
    let t0 = 0;
    let raf = 0;
    ring.style.strokeDasharray = `${C}`;
    ring.style.strokeDashoffset = `${C}`;

    const reset = (animated) => {
      ring.style.transition = animated ? 'stroke-dashoffset .3s ease-out' : 'none';
      ring.style.strokeDashoffset = `${C}`;
      fab.classList.remove('holding');
    };
    const step = () => {
      const f = Math.min(1, (performance.now() - t0) / HOLD);
      ring.style.strokeDashoffset = `${C * (1 - f)}`;
      if (f < 1) {
        raf = requestAnimationFrame(step);
        return;
      }
      pid = null;
      fab.classList.add('done');
      setTimeout(() => {
        fab.classList.remove('done');
        reset(false);
        state.locked = false;
        saveState();
        this.applyUi();
      }, 260);
    };

    listen(this.cleanups, fab, 'pointerdown', (e) => {
      e.preventDefault();
      if (pid !== null || !state.locked) return;
      pid = e.pointerId;
      try {
        fab.setPointerCapture(pid);
      } catch {
        // ignora
      }
      t0 = performance.now();
      ring.style.transition = 'none';
      fab.classList.add('holding');
      raf = requestAnimationFrame(step);
    });
    const cancel = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      cancelAnimationFrame(raf);
      reset(true);
      const hint = this.q('.lock-hint');
      hint.classList.add('show');
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => hint.classList.remove('show'), 1800);
    };
    listen(this.cleanups, fab, 'pointerup', cancel);
    listen(this.cleanups, fab, 'pointercancel', cancel);
    this.cleanups.push(() => cancelAnimationFrame(raf));
  }

  // ---------- gesture ----------

  setupGestures() {
    const layer = this.q('.gesture-layer');
    attachGestures(
      layer,
      {
        enabled: () => !state.locked && this.hasImage && !!this.engine.pose,
        getPose: () => this.engine.getScreenPose(),
        setPose: (p) => {
          this.engine.setScreenPose(p);
          this.invalidate();
        },
        clampScale: (k) => this.engine.clampScale(k),
        onEnd: () => this.commit(),
      },
      this.cleanups,
    );
    listen(this.cleanups, layer, 'pointerdown', () => {
      if (this.sheetOpen) this.toggleSheet(false);
    });
    // Qualsiasi tocco: il selettore foto è chiuso e il video può ripartire.
    listen(
      this.cleanups,
      this.el,
      'pointerdown',
      () => {
        this.camera.resume();
        if (this.video.paused && this.video.srcObject) this.video.play().catch(() => {});
      },
      true,
    );
  }

  // ---------- immagine ----------

  setupFile() {
    const input = this.q('.file-input');
    listen(this.cleanups, input, 'change', () => {
      this.camera.resume();
      const file = input.files && input.files[0];
      if (file) this.loadFile(file).finally(() => (input.value = ''));
    });
    listen(this.cleanups, input, 'cancel', () => this.camera.resume());
  }

  pickImage() {
    if (this.busy) return;
    this.camera.suspend();
    this.q('.file-input').click();
  }

  async loadFile(file) {
    this.setBusy('Preparo l’immagine…');
    try {
      const { blob, w, h } = await prepareImage(file);
      await this.showImage(blob, w, h, null);
      await putBlob('img', blob);
      await delBlob('edges');
      state.image = { id: Date.now(), w, h };
      state.edgesFor = null;
      state.fixed = this.engine.serialize();
      saveState();
      await this.applyFilter();
    } catch (e) {
      console.warn(e);
      this.toast('Non riesco ad aprire questa immagine. Prova con un’altra foto o con uno screenshot.', 4500);
    } finally {
      this.setBusy(null);
    }
  }

  async showImage(blob, w, h, savedPose) {
    const url = URL.createObjectURL(blob);
    const img = this.img;
    img.style.visibility = 'hidden';
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('immagine non leggibile'));
        img.src = url;
      });
      // decode() evita uno scatto al primo disegno, ma in certi casi (pagina in
      // background) non si risolve mai: si aspetta al massimo un secondo.
      if (img.decode) {
        await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 1000))]);
      }
    } catch (e) {
      URL.revokeObjectURL(url);
      if (this.urls.main) img.src = this.urls.main;
      img.style.visibility = '';
      throw e;
    }
    for (const k of ['main', 'edges']) if (this.urls[k]) URL.revokeObjectURL(this.urls[k]);
    this.urls = { main: url, edges: null };
    this.image = { w, h };
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.filter = 'none';
    this.hasImage = true;
    if (!this.engine.restore(savedPose)) {
      this.engine.pose = null; // immagine nuova: dritta, non specchiata, centrata
      this.engine.fit();
    }
    this.applyUi();
    this.render();
    img.style.visibility = '';
  }

  async restore() {
    try {
      if (state.image) {
        const blob = await getBlob('img');
        if (blob) {
          await this.showImage(blob, state.image.w, state.image.h, state.fixed);
          await this.applyFilter();
        } else {
          state.image = null;
        }
      }
    } catch (e) {
      console.warn(e);
      state.image = null;
    }
    this.restoring = false;
    this.applyUi();
  }

  async setFilter(f) {
    state.filter = f;
    saveState();
    this.syncSheet();
    await this.applyFilter();
  }

  async applyFilter() {
    if (!this.hasImage) return;
    if (state.filter === 'edges' && !this.urls.edges) {
      const ok = await this.ensureEdges();
      if (!ok && state.filter === 'edges') {
        state.filter = 'none';
        saveState();
        this.syncSheet();
      }
    }
    // Lo stato può essere cambiato mentre si calcolavano i contorni: vale l'ultimo.
    const edges = state.filter === 'edges' && this.urls.edges;
    const url = edges ? this.urls.edges : this.urls.main;
    if (this.img.getAttribute('src') !== url) this.img.src = url;
    this.img.style.filter = CSS_FILTERS[state.filter] || 'none';
  }

  ensureEdges() {
    if (this.urls.edges) return Promise.resolve(true);
    if (this.edgesJob) return this.edgesJob;
    const id = state.image?.id;
    const source = this.urls.main;
    this.edgesJob = (async () => {
      try {
        let blob = id && state.edgesFor === id ? await getBlob('edges') : null;
        if (!blob) {
          this.setBusy('Calcolo i contorni…');
          blob = await makeEdges(source, this.image.w, this.image.h);
          if (state.image?.id !== id) return false;
          await putBlob('edges', blob);
          state.edgesFor = id;
          saveState();
        }
        if (state.image?.id !== id || this.urls.main !== source) return false;
        this.urls.edges = URL.createObjectURL(blob);
        return true;
      } catch (e) {
        console.warn(e);
        this.toast('Non sono riuscito a calcolare i contorni');
        return false;
      } finally {
        this.setBusy(null);
        this.edgesJob = null;
      }
    })();
    return this.edgesJob;
  }

  // ---------- fotocamera ----------

  setupCamera() {
    this.camera.setPrefs(state.camera);
    const on = (type, fn) => listen(this.cleanups, this.camera, type, fn);
    on('status', () => this.onCameraStatus());
    on('devices', () => this.renderCameraList());
    on('caps', () => this.renderCaps());
    on('prefs', () => {
      state.camera = { ...this.camera.prefs };
      saveState();
    });
    this.camera.start();
    this.awake.enable();
  }

  onCameraStatus() {
    const s = this.camera.status;
    this.awake.setFallbackAllowed(CAMERA_OFF.includes(s));
    const pill = this.q('.cam-pill');
    clearTimeout(this.pillTimer);
    if (s === 'starting') this.pillTimer = setTimeout(() => pill.classList.remove('hidden'), 700);
    else pill.classList.add('hidden');
    if (s === 'running') {
      this.dismissed = null;
      this.syncSheet();
    }

    const notice = this.q('.cam-notice');
    const key = s === 'running' && this.camera.needsTap ? 'paused' : s;
    const msg = CAMERA_MESSAGES[key];
    if (this.dismissed && this.dismissed !== key) this.dismissed = null;
    if (!msg || this.dismissed === key) {
      notice.classList.add('hidden');
      return;
    }
    this.q('.notice-title').textContent = msg.title;
    this.q('.notice-text').innerHTML = msg.text;
    this.q('[data-act="cam-play"]').classList.toggle('hidden', !msg.play);
    this.q('[data-act="cam-retry"]').classList.toggle('hidden', !msg.retry);
    this.q('[data-act="reload"]').classList.toggle('hidden', !msg.reload);
    notice.classList.remove('hidden');
  }

  renderCameraList() {
    const list = this.camera.devices;
    this.q('.cam-sec').classList.toggle('hidden', list.length < 2);
    this.q('[data-group="camera"]').innerHTML = list
      .map((d) => `<button data-val="${esc(d.deviceId)}">${esc(d.name)}</button>`)
      .join('');
    this.syncSheet();
  }

  renderCaps() {
    const z = this.camera.caps.zoom;
    this.q('.zoom-sec').classList.toggle('hidden', !z);
    if (z) {
      const current = Math.min(z.max, Math.max(z.min, this.camera.prefs.zoom ?? this.camera.getZoom()));
      this.zoomValue = current;
      this.zoom.setRange(z.min, z.max);
      this.zoom.set(current);
      this.showZoom(current);
    }
    this.q('.torch-sec').classList.toggle('hidden', !this.camera.caps.torch);
    this.syncSheet();
  }

  setZoom(value) {
    const z = Math.round(value * 10) / 10;
    const prev = this.zoomValue || 1;
    if (z === prev) return;
    this.zoomValue = z;
    this.engine.zoomBy(z / prev);
    this.camera.setZoom(z);
    this.showZoom(z);
    this.commit();
  }

  showZoom(z) {
    this.q('.zoom-val').textContent = `${z.toFixed(1).replace('.', ',')}×`;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.toastTimer);
    clearTimeout(this.pillTimer);
    clearTimeout(this.hintTimer);
    if (this.hasImage) state.fixed = this.engine.serialize();
    saveState();
    this.camera.stop();
    this.awake.disable();
    for (const fn of this.cleanups) fn();
    for (const k of ['main', 'edges']) if (this.urls[k]) URL.revokeObjectURL(this.urls[k]);
    this.el.remove();
  }
}
