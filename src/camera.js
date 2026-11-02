// Fotocamera posteriore con scelta dell'obiettivo, zoom, torcia e riavvio automatico.
//
// iOS interrompe la fotocamera quando l'app va in background, quando si apre il
// selettore foto o arriva una chiamata: la traccia diventa "muted" o "ended", oppure
// il video si blocca. Un controllo periodico se ne accorge e riapre lo stream.

const NAMES = {
  main: 'Principale',
  multi: 'Automatica (più obiettivi)',
  ultra: 'Ultra grandangolo 0,5×',
  tele: 'Teleobiettivo',
  front: 'Frontale',
};
const ORDER = { main: 0, multi: 1, ultra: 2, tele: 3, other: 4, front: 5 };

// Le etichette di iOS sono tradotte nella lingua del telefono:
// "Back Camera" / "Fotocamera posteriore", "Back Ultra Wide Camera", "Back Dual Wide Camera"...
export function classifyCamera(label = '') {
  const l = label.toLowerCase();
  if (/front|anterior|frontal|facetime|truedepth|selfie/.test(l)) return 'front';
  if (/ultra/.test(l)) return 'ultra';
  if (/tele/.test(l)) return 'tele';
  if (/dual|doppia|duale|tripl|triple/.test(l)) return 'multi';
  if (/back|rear|posterior|environment|retro|arri[eè]re|trasera|r[uü]ck/.test(l)) return 'main';
  return 'other';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Camera extends EventTarget {
  constructor(video) {
    super();
    this.video = video;
    this.stream = null;
    this.track = null;
    this.status = 'idle'; // idle | starting | running | denied | busy | nocamera | insecure | unsupported | error
    this.devices = [];
    this.caps = { zoom: null, torch: false };
    this.prefs = { deviceId: null, kind: null, auto: true, zoom: null, torch: false };
    this.active = false;
    this.suspended = false;
    this.pending = null;
    this.again = false;
    this.autoTried = false;
    this.lastFrame = 0;
    this.mutedSince = 0;
    this.timers = {};

    this.onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      // Se la pagina era stata nascosta, il selettore foto si è chiuso.
      if (this.suspended) {
        this.resume();
        return;
      }
      this.lastFrame = performance.now();
      // Si lascia a iOS qualche istante per riattivare da sola la traccia.
      if (this.track?.muted) this.mutedSince = performance.now();
      // Magari l'utente ha appena dato il permesso dalle Impostazioni.
      if (this.status === 'denied') this.open('ritorno dopo permesso negato');
      else this.check(700, 'ritorno in primo piano');
    };
    this.onWake = () => this.check(700, 'pagina riattivata');
    this.onDeviceChange = () => this.listDevices();
  }

  setPrefs(p) {
    Object.assign(this.prefs, p);
  }

  start() {
    if (this.active) return this.pending || Promise.resolve();
    this.active = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    addEventListener('pageshow', this.onWake);
    navigator.mediaDevices?.addEventListener?.('devicechange', this.onDeviceChange);
    this.timers.watch = setInterval(() => this.health(''), 1500);
    this.watchFrames();
    return this.open('avvio');
  }

  stop() {
    this.active = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    removeEventListener('pageshow', this.onWake);
    navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange);
    clearInterval(this.timers.watch);
    clearInterval(this.timers.frames);
    clearTimeout(this.timers.retry);
    clearTimeout(this.timers.check);
    clearTimeout(this.timers.resume);
    this.release();
    this.setStatus('idle');
  }

  // Mentre è aperto il selettore foto non si tocca la fotocamera:
  // con "Scatta foto" iOS la sta usando per sé.
  suspend() {
    this.suspended = true;
    clearTimeout(this.timers.resume);
    this.timers.resume = setTimeout(() => this.resume(), 120000);
  }

  resume() {
    if (!this.suspended) return;
    this.suspended = false;
    clearTimeout(this.timers.resume);
    this.lastFrame = performance.now();
    if (this.track?.muted) this.mutedSince = performance.now();
    this.check(500, 'ritorno dal selettore foto');
  }

  release() {
    if (this.track) this.track.onended = this.track.onmute = this.track.onunmute = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.track = null;
    this.mutedSince = 0;
    this.video.srcObject = null;
  }

  // Le aperture sono in fila: mai due getUserMedia contemporanee.
  open(reason, force = false) {
    if (!this.active) return Promise.resolve();
    if (this.pending) {
      if (force) this.again = true;
      return this.pending;
    }
    clearTimeout(this.timers.retry);
    this.pending = this.doOpen(reason)
      .catch((e) => console.warn('[fotocamera]', e))
      .finally(() => {
        this.pending = null;
        if (this.again && this.active) {
          this.again = false;
          this.open('richiesta in coda');
        }
      });
    return this.pending;
  }

  async doOpen(reason) {
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) {
      this.setStatus(window.isSecureContext === false ? 'insecure' : 'unsupported');
      return;
    }
    console.info('[fotocamera] apertura:', reason);
    this.release();
    // iOS a volte rifiuta se si riapre subito dopo aver chiuso.
    if (reason !== 'avvio') await sleep(150);
    this.setStatus('starting');

    const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const attempts = [];
    if (this.prefs.deviceId) attempts.push({ ...size, deviceId: { exact: this.prefs.deviceId } });
    attempts.push({ ...size, facingMode: { ideal: 'environment' } });
    attempts.push({ facingMode: 'environment' });
    attempts.push(true);

    let stream = null;
    let error = null;
    for (const video of attempts) {
      try {
        stream = await md.getUserMedia({ video, audio: false });
        break;
      } catch (e) {
        error = e;
        // Permesso negato o fotocamera occupata: inutile insistere con altri vincoli.
        if (['NotAllowedError', 'SecurityError', 'NotReadableError', 'AbortError'].includes(e.name)) break;
      }
    }
    if (!this.active) {
      stream?.getTracks().forEach((t) => t.stop());
      return;
    }
    if (!stream) {
      this.fail(error);
      return;
    }

    this.stream = stream;
    const track = (this.track = stream.getVideoTracks()[0]);
    track.onended = () => {
      if (this.track === track) this.check(300, 'traccia terminata');
    };
    track.onmute = () => {
      if (this.track === track) this.mutedSince = performance.now();
    };
    track.onunmute = () => {
      if (this.track !== track) return;
      this.mutedSince = 0;
      this.video.play().catch(() => {});
    };

    this.video.srcObject = stream;
    this.lastFrame = performance.now();
    try {
      await this.video.play();
    } catch {
      // verrà ritentato al prossimo tocco
    }

    await this.listDevices();
    if (this.autoPickMain()) {
      await this.doOpen('obiettivo principale');
      return;
    }
    this.readCaps();
    await this.applyPrefs();
    this.setStatus('running');
  }

  fail(error) {
    const name = error?.name || '';
    console.warn('[fotocamera] errore:', name, error?.message);
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      this.setStatus('denied');
    } else if (name === 'NotReadableError' || name === 'AbortError') {
      this.setStatus('busy');
      this.timers.retry = setTimeout(() => this.open('riprovo: era occupata'), 3000);
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      this.setStatus('nocamera');
    } else {
      this.setStatus('error');
      this.timers.retry = setTimeout(() => this.open('riprovo dopo errore'), 5000);
    }
  }

  // Al primo avvio iOS può aprire la fotocamera "virtuale" a più obiettivi, che a
  // distanza ravvicinata salta da un obiettivo all'altro: si passa alla principale.
  autoPickMain() {
    if (!this.prefs.auto || this.autoTried) return false;
    this.autoTried = true;
    const mains = this.devices.filter((d) => d.kind === 'main');
    const iosLike = this.devices.some((d) => ['ultra', 'tele', 'multi'].includes(d.kind));
    if (mains.length !== 1 || !iosLike) return false;
    const main = mains[0];
    const current = this.currentDeviceId();
    if (this.prefs.deviceId !== main.deviceId) {
      this.prefs.deviceId = main.deviceId;
      this.prefs.kind = 'main';
      this.emit('prefs');
    }
    return !!current && current !== main.deviceId;
  }

  currentDeviceId() {
    try {
      return this.track?.getSettings().deviceId || null;
    } catch {
      return null;
    }
  }

  async listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      let list = all
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label, kind: classifyCamera(d.label) }));
      const back = list.filter((d) => d.kind !== 'front');
      if (back.length) list = back;
      list.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
      const total = {};
      for (const d of list) total[d.kind] = (total[d.kind] || 0) + 1;
      const seen = {};
      list.forEach((d, i) => {
        seen[d.kind] = (seen[d.kind] || 0) + 1;
        if (d.kind === 'other') d.name = d.label || `Fotocamera ${i + 1}`;
        else d.name = NAMES[d.kind] + (total[d.kind] > 1 ? ` ${seen[d.kind]}` : '');
      });
      this.devices = list.filter((d) => d.deviceId);
    } catch {
      this.devices = [];
    }
    this.emit('devices');
  }

  readCaps() {
    let caps = {};
    try {
      caps = this.track?.getCapabilities?.() || {};
    } catch {
      caps = {};
    }
    const z = caps.zoom;
    this.caps.zoom =
      z && typeof z.max === 'number' && z.max > (z.min ?? 1) + 0.05
        ? { min: z.min ?? 1, max: Math.min(z.max, 10), step: z.step || 0.1 }
        : null;
    this.caps.torch = caps.torch === true || (Array.isArray(caps.torch) && caps.torch.includes(true));
    this.emit('caps');
  }

  async applyPrefs() {
    const adv = {};
    if (this.caps.zoom && this.prefs.zoom != null) {
      adv.zoom = Math.min(this.caps.zoom.max, Math.max(this.caps.zoom.min, this.prefs.zoom));
    }
    if (this.caps.torch && this.prefs.torch) adv.torch = true;
    if (!Object.keys(adv).length) return;
    try {
      await this.track.applyConstraints({ advanced: [adv] });
    } catch {
      // vincolo non accettato: si resta con i valori predefiniti
    }
  }

  getZoom() {
    try {
      return this.track?.getSettings().zoom ?? this.prefs.zoom ?? 1;
    } catch {
      return this.prefs.zoom ?? 1;
    }
  }

  // Lo slider può chiamare molte volte al secondo: si applica solo l'ultimo valore.
  setZoom(z) {
    this.prefs.zoom = z;
    this.emit('prefs');
    if (this.zoomBusy) return;
    this.zoomBusy = true;
    const loop = async () => {
      let applied = null;
      while (this.track && applied !== this.prefs.zoom) {
        applied = this.prefs.zoom;
        try {
          await this.track.applyConstraints({ advanced: [{ zoom: applied }] });
        } catch {
          break;
        }
      }
      this.zoomBusy = false;
    };
    loop();
  }

  async setTorch(on) {
    this.prefs.torch = on;
    this.emit('prefs');
    try {
      await this.track?.applyConstraints({ advanced: [{ torch: on }] });
    } catch {
      // ignora
    }
  }

  selectDevice(deviceId) {
    const d = this.devices.find((x) => x.deviceId === deviceId);
    Object.assign(this.prefs, { deviceId, kind: d?.kind ?? null, auto: false, zoom: null, torch: false });
    this.emit('prefs');
    return this.open('cambio obiettivo', true);
  }

  // Tiene traccia dell'ultimo fotogramma ricevuto per scoprire un video bloccato.
  watchFrames() {
    const v = this.video;
    if (typeof v.requestVideoFrameCallback === 'function') {
      const tick = () => {
        this.lastFrame = performance.now();
        if (this.active) v.requestVideoFrameCallback(tick);
      };
      v.requestVideoFrameCallback(tick);
    } else {
      let last = -1;
      this.timers.frames = setInterval(() => {
        if (v.currentTime !== last) {
          last = v.currentTime;
          this.lastFrame = performance.now();
        }
      }, 500);
    }
  }

  check(delay, reason) {
    clearTimeout(this.timers.check);
    this.timers.check = setTimeout(() => this.health(reason), delay);
  }

  health(reason) {
    if (!this.active || this.suspended || this.pending) return;
    if (document.visibilityState !== 'visible') return;
    // Questi stati aspettano un'azione dell'utente o hanno già un nuovo tentativo programmato.
    if (['denied', 'insecure', 'unsupported', 'nocamera', 'busy', 'error'].includes(this.status)) return;
    const t = this.track;
    const now = performance.now();
    if (!t || t.readyState === 'ended') {
      this.open(reason || 'traccia assente');
      return;
    }
    if (t.muted && this.mutedSince && now - this.mutedSince > 2500) {
      this.open('traccia interrotta');
      return;
    }
    if (this.video.paused) this.video.play().catch(() => {});
    if (this.status === 'running' && !t.muted && now - this.lastFrame > 3500) {
      this.open('immagine ferma');
    }
  }

  setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.emit('status');
  }

  emit(type) {
    this.dispatchEvent(new Event(type));
  }
}
