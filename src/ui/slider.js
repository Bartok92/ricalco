// Slider grande e preciso con Pointer Events (quello nativo di iOS si trascina
// solo dal pallino ed è piccolo). Si può toccare e trascinare in qualunque punto.

export function createSlider(host, { min = 0, max = 1, value = 0, label = '', onInput, onChange }) {
  host.innerHTML = `
    <div class="slider" role="slider" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}">
      <div class="slider-rail">
        <div class="slider-track"><div class="slider-fill"></div></div>
        <div class="slider-thumb"></div>
      </div>
    </div>`;
  const el = host.firstElementChild;
  const rail = el.querySelector('.slider-rail');
  const fill = el.querySelector('.slider-fill');
  const thumb = el.querySelector('.slider-thumb');
  let v = value;
  let active = null;

  function paint() {
    const f = max > min ? (v - min) / (max - min) : 0;
    const pct = `${(f * 100).toFixed(2)}%`;
    fill.style.width = pct;
    thumb.style.left = pct;
    el.setAttribute('aria-valuenow', String(v));
  }

  function fromX(x) {
    const r = rail.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (x - r.left) / r.width));
    return min + f * (max - min);
  }

  el.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    e.preventDefault();
    active = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignora
    }
    el.classList.add('dragging');
    v = fromX(e.clientX);
    paint();
    onInput?.(v);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active) return;
    v = fromX(e.clientX);
    paint();
    onInput?.(v);
  });
  const end = (e) => {
    if (e.pointerId !== active) return;
    active = null;
    el.classList.remove('dragging');
    onChange?.(v);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  paint();
  return {
    el,
    set(nv) {
      v = Math.min(max, Math.max(min, nv));
      paint();
    },
    setRange(nmin, nmax) {
      min = nmin;
      max = nmax;
      paint();
    },
  };
}
