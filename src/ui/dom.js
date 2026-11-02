// Piccoli aiuti per costruire l'interfaccia senza librerie.

export function html(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

// Registra un listener e ne ricorda la rimozione in `cleanups`.
export function listen(cleanups, target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  cleanups.push(() => target.removeEventListener(type, fn, opts));
}
