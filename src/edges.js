// Rilevamento dei contorni (tipo Canny): sfocatura, gradiente di Sobel,
// assottigliamento, doppia soglia con isteresi, pulizia dei puntini e
// ispessimento delle linee per vederle bene sullo schermo.
// Restituisce RGBA: linee quasi nere, il resto trasparente.

export function detectEdges(rgba, w, h) {
  const n = w * h;
  const a = new Float32Array(n);
  const b = new Float32Array(n);

  for (let i = 0, j = 0; i < n; i++, j += 4) {
    a[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  }

  // Sfocatura gaussiana 5x5 separabile [1 4 6 4 1] / 16
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const x0 = x > 1 ? x - 2 : 0, x1 = x > 0 ? x - 1 : 0;
      const x3 = x < w - 1 ? x + 1 : w - 1, x4 = x < w - 2 ? x + 2 : w - 1;
      b[r + x] = (a[r + x0] + 4 * a[r + x1] + 6 * a[r + x] + 4 * a[r + x3] + a[r + x4]) / 16;
    }
  }
  for (let y = 0; y < h; y++) {
    const y0 = (y > 1 ? y - 2 : 0) * w, y1 = (y > 0 ? y - 1 : 0) * w;
    const y3 = (y < h - 1 ? y + 1 : h - 1) * w, y4 = (y < h - 2 ? y + 2 : h - 1) * w;
    const r = y * w;
    for (let x = 0; x < w; x++) {
      a[r + x] = (b[y0 + x] + 4 * b[y1 + x] + 6 * b[r + x] + 4 * b[y3 + x] + b[y4 + x]) / 16;
    }
  }

  // Sobel: modulo in b, direzione quantizzata in dir
  const g = a;
  const mag = b;
  mag.fill(0);
  const dir = new Uint8Array(n);
  let max = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
      const gy = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
      const m = Math.sqrt(gx * gx + gy * gy);
      mag[i] = m;
      if (m > max) max = m;
      const ax = Math.abs(gx), ay = Math.abs(gy);
      dir[i] = ay <= ax * 0.4142 ? 0 : ay >= ax * 2.4142 ? 2 : gx * gy > 0 ? 1 : 3;
    }
  }
  if (max < 1) return new Uint8ClampedArray(n * 4);

  // Soppressione dei non massimi: restano solo le creste del gradiente
  const thin = a; // il grigio non serve più
  thin.fill(0);
  const BINS = 1024;
  const hist = new Uint32Array(BINS);
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m < max * 0.02) continue;
      let p, q;
      switch (dir[i]) {
        case 0: p = mag[i - 1]; q = mag[i + 1]; break;
        case 2: p = mag[i - w]; q = mag[i + w]; break;
        case 1: p = mag[i - w - 1]; q = mag[i + w + 1]; break;
        default: p = mag[i - w + 1]; q = mag[i + w - 1];
      }
      if (m >= p && m >= q) {
        thin[i] = m;
        hist[Math.min(BINS - 1, ((m / max) * BINS) | 0)]++;
        count++;
      }
    }
  }

  // Soglia alta con il metodo di Otsu sulle creste, soglia bassa al 45%
  let sum = 0;
  for (let t = 0; t < BINS; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, otsu = BINS * 0.2;
  for (let t = 0; t < BINS; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = count - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; otsu = t; }
  }
  const high = Math.min(0.5, Math.max(0.06, otsu / BINS)) * max;
  const low = high * 0.45;

  // Isteresi: si tengono le linee deboli solo se collegate a una forte;
  // i gruppi troppo piccoli (puntini, rumore) vengono scartati.
  const mark = dir; // 0 = niente, 1 = debole, 2 = scelta, 3 = visitata
  for (let i = 0; i < n; i++) mark[i] = thin[i] >= low ? 1 : 0;
  const keep = new Uint8Array(n);
  const stack = new Int32Array(n);
  const comp = [];
  const MIN_PIXELS = Math.max(6, Math.round(Math.max(w, h) / 200));
  for (let s = 0; s < n; s++) {
    if (mark[s] !== 1 || thin[s] < high) continue;
    let top = 0;
    comp.length = 0;
    stack[top++] = s;
    mark[s] = 3;
    while (top) {
      const i = stack[--top];
      comp.push(i);
      const x = i % w;
      for (let dy = -w; dy <= w; dy += w) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const k = i + dy + dx;
          if (k < 0 || k >= n || mark[k] !== 1) continue;
          mark[k] = 3;
          stack[top++] = k;
        }
      }
    }
    if (comp.length >= MIN_PIXELS) for (const i of comp) keep[i] = 1;
  }

  // Ispessimento: linea piena al centro, bordo più tenue intorno
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let alpha = 0;
      if (keep[i]) alpha = 255;
      else if (
        (x > 0 && keep[i - 1]) || (x < w - 1 && keep[i + 1]) ||
        (y > 0 && keep[i - w]) || (y < h - 1 && keep[i + w])
      ) alpha = 200;
      else if (
        (x > 0 && y > 0 && keep[i - w - 1]) || (x < w - 1 && y > 0 && keep[i - w + 1]) ||
        (x > 0 && y < h - 1 && keep[i + w - 1]) || (x < w - 1 && y < h - 1 && keep[i + w + 1])
      ) alpha = 120;
      if (alpha) {
        const j = i * 4;
        out[j] = 18; out[j + 1] = 18; out[j + 2] = 22; out[j + 3] = alpha;
      }
    }
  }
  return out;
}
