// Schermo sempre acceso mentre si ricalca.
// 1) Screen Wake Lock API, riacquisita al ritorno in primo piano.
// 2) Ripiego tipo NoSleep.js: un video minuscolo in riproduzione continua.
//    Serve dove l'API non c'è e sulle app installate con iOS precedente al 18.4,
//    dove l'API risponde ma non tiene davvero acceso lo schermo.

import media from './vendor/nosleep-media.js';
import { isIOS, isStandalone, iosVersion } from './ios.js';

export class KeepAwake {
  constructor() {
    this.on = false;
    this.lock = null;
    this.video = null;
    this.onVisibility = () => {
      if (document.visibilityState === 'visible') this.acquire();
    };
    // Alcune richieste vanno fatte dentro un tocco dell'utente: si riprova lì.
    this.onGesture = () => {
      if (!this.on) return;
      if ('wakeLock' in navigator && (!this.lock || this.lock.released)) this.acquire();
      else if (this.video?.paused) this.video.play().catch(() => {});
    };
  }

  get nativeReliable() {
    if (!('wakeLock' in navigator)) return false;
    return !(isIOS && isStandalone() && iosVersion() < 18.4);
  }

  enable() {
    if (this.on) return;
    this.on = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('touchend', this.onGesture, true);
    document.addEventListener('click', this.onGesture, true);
    this.acquire();
  }

  disable() {
    this.on = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('touchend', this.onGesture, true);
    document.removeEventListener('click', this.onGesture, true);
    this.lock?.release().catch(() => {});
    this.lock = null;
    this.stopVideo();
  }

  stopVideo() {
    if (!this.video) return;
    this.video.pause();
    this.video.remove();
    this.video = null;
  }

  async acquire() {
    if (!this.on || document.visibilityState !== 'visible') return;
    let ok = false;
    if ('wakeLock' in navigator) {
      try {
        if (!this.lock || this.lock.released) this.lock = await navigator.wakeLock.request('screen');
        ok = true;
      } catch {
        ok = false;
      }
    }
    // Il video serve solo come ripiego: con l'API funzionante si spegne.
    if (!ok || !this.nativeReliable) this.playVideo();
    else this.stopVideo();
  }

  playVideo() {
    if (!this.video) {
      const v = document.createElement('video');
      v.setAttribute('playsinline', '');
      v.setAttribute('title', 'Ricalco');
      v.setAttribute('aria-hidden', 'true');
      // Non "muted": su iOS un video muto non impedisce lo spegnimento dello schermo.
      // La traccia audio è silenziosa.
      Object.assign(v.style, {
        position: 'fixed', left: '-100px', top: '-100px', width: '2px', height: '2px',
        opacity: '0.01', pointerEvents: 'none',
      });
      for (const [type, src] of [['webm', media.webm], ['mp4', media.mp4]]) {
        const s = document.createElement('source');
        s.src = src;
        s.type = `video/${type}`;
        v.appendChild(s);
      }
      // Il "loop" nativo su iOS non conta come riproduzione attiva: si riavvolge a mano.
      v.addEventListener('loadedmetadata', () => {
        if (v.duration <= 1) v.loop = true;
        else v.addEventListener('timeupdate', () => {
          if (v.currentTime > 0.5) v.currentTime = Math.random();
        });
      });
      document.body.appendChild(v);
      this.video = v;
    }
    this.video.play().catch(() => {});
  }
}
