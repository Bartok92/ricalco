// Icone SVG a tratto (24x24), colore dal testo.
const svg = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icons = {
  image: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 15.5l-4.5-4.5L7 20.5"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10.5" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>'),
  unlock: svg('<rect x="5" y="10.5" width="14" height="10.5" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.6"/><path d="M12 14.5v2.5"/>'),
  center: svg('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>'),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  tools: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  flip: svg('<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M9 7L3 17h6z"/><path d="M15 7l6 10h-6z"/>'),
  rotate: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
  grid: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>'),
  torch: svg('<path d="M7 3h10v4l-3 4v10h-4V11L7 7z"/><path d="M12 14v2"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>'),
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.9-.9 1.6v.3"/><path d="M12 17h.01"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  opacity: svg('<rect x="3" y="3" width="12" height="12" rx="2"/><rect x="9" y="9" width="12" height="12" rx="2" fill="currentColor" fill-opacity=".35"/>'),
  zoom: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M11 8v6M8 11h6"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  share: svg('<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M7.5 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5"/>'),
  addSquare: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>'),
  more: svg('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  phone: svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  marker: svg('<rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="5" y="5" width="4" height="4" fill="currentColor"/><rect x="15" y="5" width="4" height="4" fill="currentColor"/><rect x="5" y="15" width="4" height="4" fill="currentColor"/><rect x="15" y="15" width="4" height="4" fill="currentColor"/>'),
  chevron: svg('<path d="M9 5l7 7-7 7"/>'),
};
