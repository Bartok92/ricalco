// Gesture multi-touch con Pointer Events.
// 1 dito sposta; 2 dita scalano e ruotano insieme attorno al punto medio.
// Ogni volta che un dito si aggiunge o si toglie si riparte dalla posizione
// attuale ("istantanea"), così l'immagine non salta mai.
//
// opts:
//   enabled()        -> false per ignorare i tocchi (blocco attivo)
//   toSpace(x, y)    -> punto dello schermo nello spazio della posa (default: identità)
//   getPose()        -> { x, y, rot (gradi), scale, ... }
//   setPose(pose)
//   clampScale(s)    -> scala ammessa
//   onStart(), onEnd()

const rad = Math.PI / 180;

export function attachGestures(el, opts, cleanups) {
  const pointers = new Map(); // id -> { x, y } in coordinate schermo
  let base = null;
  const toSpace = opts.toSpace || ((x, y) => ({ x, y }));

  function snapshot() {
    const list = [...pointers.values()].slice(0, 2).map((p) => ({ ...p }));
    base = list.length ? { pose: { ...opts.getPose() }, pts: list, turn: 0 } : null;
  }

  function update() {
    if (!base) return;
    const now = [...pointers.values()];
    const p0 = base.pose;
    if (base.pts.length === 1) {
      const b = toSpace(base.pts[0].x, base.pts[0].y);
      const c = toSpace(now[0].x, now[0].y);
      opts.setPose({ ...p0, x: p0.x + c.x - b.x, y: p0.y + c.y - b.y });
      return;
    }
    const b0 = toSpace(base.pts[0].x, base.pts[0].y);
    const b1 = toSpace(base.pts[1].x, base.pts[1].y);
    const c0 = toSpace(now[0].x, now[0].y);
    const c1 = toSpace(now[1].x, now[1].y);
    const db = Math.hypot(b1.x - b0.x, b1.y - b0.y);
    const dc = Math.hypot(c1.x - c0.x, c1.y - c0.y);
    if (db < 1 || dc < 1) return;

    // Rotazione accumulata senza salti oltre ±180°
    let turn = (Math.atan2(c1.y - c0.y, c1.x - c0.x) - Math.atan2(b1.y - b0.y, b1.x - b0.x)) / rad;
    while (turn - base.turn > 180) turn -= 360;
    while (turn - base.turn < -180) turn += 360;
    base.turn = turn;

    const scale = opts.clampScale ? opts.clampScale(p0.scale * (dc / db)) : p0.scale * (dc / db);
    const f = scale / p0.scale;
    const mb = { x: (b0.x + b1.x) / 2, y: (b0.y + b1.y) / 2 };
    const mc = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
    // Il punto dell'immagine che stava sotto il centro delle dita resta sotto il centro delle dita.
    const vx = p0.x - mb.x;
    const vy = p0.y - mb.y;
    const cos = Math.cos(turn * rad);
    const sin = Math.sin(turn * rad);
    opts.setPose({
      ...p0,
      x: mc.x + f * (vx * cos - vy * sin),
      y: mc.y + f * (vx * sin + vy * cos),
      rot: p0.rot + turn,
      scale,
    });
  }

  function down(e) {
    if (!opts.enabled()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // non indispensabile
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size <= 2) snapshot();
    opts.onStart?.();
  }

  function move(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!opts.enabled()) return;
    update();
  }

  function up(e) {
    if (!pointers.delete(e.pointerId)) return;
    snapshot();
    if (!pointers.size) opts.onEnd?.();
  }

  // Rotella / pinch del trackpad (solo per provare dal computer)
  let wheelEnd = 0;
  function wheel(e) {
    if (!opts.enabled()) return;
    e.preventDefault();
    const pose = opts.getPose();
    const c = toSpace(e.clientX, e.clientY);
    let next;
    if (e.shiftKey) {
      const t = (e.deltaY > 0 ? 3 : -3) * rad;
      const vx = pose.x - c.x, vy = pose.y - c.y;
      next = { ...pose, rot: pose.rot + t / rad,
        x: c.x + vx * Math.cos(t) - vy * Math.sin(t), y: c.y + vx * Math.sin(t) + vy * Math.cos(t) };
    } else {
      const want = pose.scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      const scale = opts.clampScale ? opts.clampScale(want) : want;
      const f = scale / pose.scale;
      next = { ...pose, scale, x: c.x + (pose.x - c.x) * f, y: c.y + (pose.y - c.y) * f };
    }
    opts.setPose(next);
    clearTimeout(wheelEnd);
    wheelEnd = setTimeout(() => opts.onEnd?.(), 250);
  }

  const listeners = [
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', up],
    ['wheel', wheel],
  ];
  for (const [t, fn] of listeners) el.addEventListener(t, fn, { passive: false });
  cleanups?.push(() => {
    for (const [t, fn] of listeners) el.removeEventListener(t, fn);
    clearTimeout(wheelEnd);
  });
}
