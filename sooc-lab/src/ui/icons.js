// Hairline icons on a 24-unit grid (stroke-based, currentColor).
const P = {
  open: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  download: '<path d="M12 4.5v10M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  compare: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="M12 3v18"/>',
  chevron: '<path d="m7.5 10 4.5 4.5 4.5-4.5"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2.05-4.95M5 5v3.5h3.5"/>',
  close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  grip: '<path d="m9.5 8.5-3.5 3.5 3.5 3.5M14.5 8.5l3.5 3.5-3.5 3.5"/>',
};

export function icon(name, size = 20) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
}
