// Shared helpers for SVG illustrations (viewBox 400x300). Animated via CSS classes a-*.
import { seededRng } from './logic.js';

const VB = 'viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"';
export const svg = (inner, cls = '') => `<svg ${VB} class="art ${cls}" role="img" aria-hidden="true">${inner}</svg>`;

export function stars(count, seed, maxY = 160) {
  const rng = seededRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = Math.round(rng() * 400);
    const y = Math.round(rng() * maxY);
    const r = (0.6 + rng() * 1.3).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" class="a-twinkle" style="animation-delay:${(i % 7) * 0.4}s"/>`;
  }).join('');
}

/** Vertical gradient background. `id` must be unique per illustration. */
export const sky = (id, top, bottom) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="400" height="300" fill="url(#${id})"/>`;

export const windowRect = (x, y, w, h, delay) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#f4c25b" class="a-flicker" style="animation-delay:${delay}s"/>`;
