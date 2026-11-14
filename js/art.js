// Original SVG illustrations (static, trusted markup). Animated via CSS classes a-*.
import { seededRng } from './logic.js';

const VB = 'viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"';
const svg = (inner, cls = '') => `<svg ${VB} class="art ${cls}" role="img" aria-hidden="true">${inner}</svg>`;

function stars(count, seed, maxY = 160) {
  const rng = seededRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = Math.round(rng() * 400);
    const y = Math.round(rng() * maxY);
    const r = (0.6 + rng() * 1.3).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" class="a-twinkle" style="animation-delay:${(i % 7) * 0.4}s"/>`;
  }).join('');
}

const sky = (id, top, bottom) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="400" height="300" fill="url(#${id})"/>`;

const windowRect = (x, y, w, h, delay) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#f4c25b" class="a-flicker" style="animation-delay:${delay}s"/>`;

function books(x0, y0, shelfW, rows, seed) {
  const rng = seededRng(seed);
  const colors = ['#7a2e2e', '#2e4a7a', '#3f6b3a', '#8a6a2a', '#5b3a7a', '#a0522d'];
  let out = '';
  for (let r = 0; r < rows; r++) {
    let x = x0;
    const base = y0 + r * 52;
    while (x < x0 + shelfW - 8) {
      const w = 6 + Math.round(rng() * 8);
      const h = 30 + Math.round(rng() * 14);
      out += `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${colors[Math.floor(rng() * colors.length)]}"/>`;
      x += w + 1;
    }
    out += `<rect x="${x0 - 6}" y="${base}" width="${shelfW + 12}" height="6" fill="#3b2614"/>`;
  }
  return out;
}

export const ART = {
  // ---------- Giallo ----------
  villa: () => svg(`${sky('gv', '#121726', '#323a52')}
    ${stars(30, 3, 120)}
    <circle cx="318" cy="62" r="26" fill="#e9e4c9" class="a-glow"/>
    <path d="M0 252 Q110 228 210 246 T400 238 V300 H0Z" fill="#0c0f16"/>
    <path d="M80 252 V150 L140 104 L200 150 L260 98 L330 150 V252Z" fill="#07090e"/>
    <rect x="146" y="78" width="14" height="44" fill="#07090e"/><rect x="276" y="70" width="14" height="40" fill="#07090e"/>
    ${windowRect(104, 168, 18, 26, 0)}${windowRect(150, 168, 18, 26, 1.3)}${windowRect(230, 160, 18, 26, 0.6)}
    ${windowRect(278, 160, 18, 26, 2.1)}${windowRect(250, 118, 14, 20, 1.7)}
    <rect x="190" y="206" width="22" height="46" fill="#2b1c10"/><circle cx="207" cy="230" r="1.6" fill="#f4c25b"/>
    <path d="M18 252 C24 210 10 190 30 160 C40 190 52 210 46 252Z" fill="#05070b" class="a-sway"/>
    <path d="M352 252 C358 200 346 186 366 150 C380 186 392 214 384 252Z" fill="#05070b" class="a-sway" style="animation-delay:1s"/>
    <path d="M300 20 L284 60 L298 60 L280 104" stroke="#fff8d0" stroke-width="3" fill="none" class="a-bolt"/>`),

  studio: () => svg(`${sky('gs', '#1a140f', '#2c2118')}
    <rect x="40" y="40" width="70" height="90" fill="#3a2a1b" stroke="#8a6a3a" stroke-width="5"/>
    <circle cx="75" cy="78" r="18" fill="#5a4630"/><rect x="58" y="96" width="34" height="26" fill="#5a4630"/>
    <path d="M250 70 L300 70 L330 210 L220 210Z" fill="#f4d58d" opacity=".12" class="a-glow"/>
    <rect x="268" y="56" width="16" height="16" fill="#c8a24a"/><rect x="274" y="72" width="4" height="70" fill="#8a6a3a"/>
    <path d="M254 56 L298 56 L290 40 L262 40Z" fill="#2f5d3a"/>
    <rect x="60" y="200" width="300" height="16" fill="#4a3220"/><rect x="74" y="216" width="14" height="70" fill="#3a2716"/><rect x="332" y="216" width="14" height="70" fill="#3a2716"/>
    <rect x="120" y="188" width="56" height="12" fill="#efe6cf" transform="rotate(-6 148 194)"/>
    <rect x="180" y="190" width="46" height="10" fill="#e0d5b8" transform="rotate(8 203 195)"/>
    <path d="M300 186 h18 v14 h-18z" fill="#7b1f1f"/><path d="M309 180 v6" stroke="#ddd" stroke-width="2"/>
    <path d="M150 250 l40 -10 l8 30 l-40 10z" fill="#2a1d12"/>
    <circle cx="240" cy="262" r="10" fill="#7b1f1f" opacity=".8"/>`),

  biblioteca: () => svg(`${sky('gb', '#1a1410', '#24180f')}
    <rect x="20" y="20" width="360" height="270" fill="#20150c"/>
    ${books(36, 74, 150, 4, 11)}${books(216, 74, 150, 4, 12)}
    <path d="M300 30 L330 290 M340 30 L370 290" stroke="#6a4a2a" stroke-width="5"/>
    ${[60, 100, 140, 180, 220, 260].map((y) => `<path d="M${300 + (y - 30) * 0.115} ${y} L${340 + (y - 30) * 0.115} ${y}" stroke="#6a4a2a" stroke-width="4"/>`).join('')}
    <rect x="186" y="244" width="10" height="26" fill="#efe6cf"/>
    <path d="M191 230 q-6 8 0 14 q6 -6 0 -14z" fill="#ffb347" class="a-flicker"/>
    <circle cx="191" cy="240" r="40" fill="#ffb347" opacity=".08" class="a-glow"/>`),

  serra: () => svg(`${sky('gg', '#0e1a1a', '#1d3330')}
    ${stars(20, 9, 90)}
    <path d="M40 270 V140 Q200 20 360 140 V270Z" fill="#9fd8cf" opacity=".08" stroke="#6fa9a0" stroke-width="3"/>
    ${[80, 120, 160, 200, 240, 280, 320].map((x) => `<path d="M${x} 270 V${140 - Math.round(60 * Math.sin(((x - 40) / 320) * Math.PI))}" stroke="#6fa9a0" stroke-width="2" opacity=".6"/>`).join('')}
    ${[[80, 1], [150, 0.6], [230, 1.2], [300, 0.3]].map(([x, d]) => `<g class="a-sway" style="animation-delay:${d}s">
      <path d="M${x} 270 C${x - 20} 230 ${x - 30} 210 ${x - 40} 180 M${x} 270 C${x + 10} 220 ${x + 30} 200 ${x + 40} 176 M${x} 270 C${x} 230 ${x - 4} 200 ${x + 2} 160" stroke="#3f8a4a" stroke-width="6" fill="none" stroke-linecap="round"/>
      <circle cx="${x + 2}" cy="160" r="8" fill="#d9467a"/></g>`).join('')}
    <rect x="30" y="268" width="340" height="22" fill="#1a120b"/>`),

  cantina: () => svg(`${sky('gc', '#110d0a', '#1e1712')}
    <path d="M0 0 H400 V40 Q200 90 0 40Z" fill="#0a0806"/>
    ${[[70, 200], [170, 200], [120, 140]].map(([x, y]) => `<g><ellipse cx="${x}" cy="${y}" rx="44" ry="40" fill="#5a3a1e"/><ellipse cx="${x}" cy="${y}" rx="44" ry="40" fill="none" stroke="#2a1a0c" stroke-width="5"/>
      <path d="M${x - 30} ${y - 30} V${y + 30} M${x + 30} ${y - 30} V${y + 30}" stroke="#2a1a0c" stroke-width="4"/><circle cx="${x}" cy="${y}" r="6" fill="#2a1a0c"/></g>`).join('')}
    <rect x="250" y="80" width="120" height="180" fill="#2a1d12"/>
    ${[100, 140, 180, 220].map((y) => [262, 290, 318, 346].map((x) => `<circle cx="${x}" cy="${y}" r="9" fill="#3d1a2a" stroke="#120808"/>`).join('')).join('')}
    <rect x="214" y="216" width="10" height="34" fill="#efe6cf"/>
    <path d="M219 202 q-6 8 0 14 q6 -6 0 -14z" fill="#ffb347" class="a-flicker"/>
    <path d="M222 226 v14" stroke="#efe6cf" stroke-width="3" class="a-drip"/>`),

  dossier: () => svg(`${sky('gd', '#1b1612', '#2a221b')}
    <path d="M70 70 H170 L186 90 H330 V250 H70Z" fill="#c9a96b"/>
    <rect x="70" y="96" width="260" height="154" fill="#dcc08a"/>
    ${[[92, 112, -6], [180, 108, 4], [262, 116, -3]].map(([x, y, r]) => `<g transform="rotate(${r} ${x + 30} ${y + 40})"><rect x="${x}" y="${y}" width="62" height="78" fill="#f3ead6"/><rect x="${x + 6}" y="${y + 6}" width="50" height="50" fill="#5a4a3a"/>
      <circle cx="${x + 31}" cy="${y + 26}" r="10" fill="#2e251d"/><rect x="${x + 18}" y="${y + 38}" width="26" height="18" fill="#2e251d"/><text x="${x + 31}" y="${y + 72}" font-size="10" text-anchor="middle" fill="#7b1f1f" font-family="monospace">?</text></g>`).join('')}
    <rect x="96" y="210" width="90" height="6" fill="#7b1f1f" opacity=".6"/><rect x="96" y="224" width="150" height="5" fill="#5a4a3a" opacity=".5"/>
    <g class="a-float"><circle cx="300" cy="200" r="34" fill="#cfe8ff" opacity=".18" stroke="#c8a24a" stroke-width="8"/><path d="M324 224 L360 262" stroke="#4a3220" stroke-width="12" stroke-linecap="round"/></g>`),

  taccuino: () => svg(`${sky('gt', '#1b1612', '#2a221b')}
    <g transform="rotate(-4 200 150)"><rect x="90" y="40" width="220" height="230" rx="6" fill="#efe6cf"/>
    ${[80, 104, 128, 152, 176, 200, 224, 248].map((y) => `<path d="M104 ${y} H296" stroke="#9bb3c9" stroke-width="1.2"/>`).join('')}
    <path d="M110 92 q20 -14 40 0 t40 0 t40 -6" stroke="#2a2a3a" stroke-width="2" fill="none"/>
    <path d="M110 116 q30 -10 60 2 t50 -2" stroke="#2a2a3a" stroke-width="2" fill="none"/>
    <path d="M110 140 q24 -12 48 0" stroke="#2a2a3a" stroke-width="2" fill="none"/>
    <text x="210" y="200" font-size="64" fill="#7b1f1f" font-family="serif" class="a-glow">?</text>
    ${[60, 100, 140, 180, 220].map((y) => `<circle cx="96" cy="${y}" r="5" fill="#2a221b"/>`).join('')}</g>
    <path d="M300 260 L360 150 L372 156 L314 266Z" fill="#1d1d2b"/><path d="M300 260 l6 -2 l2 6z" fill="#c8a24a"/>`),

  accusa: () => svg(`<rect width="400" height="300" fill="#07080b"/>
    <path d="M200 0 L120 300 H280Z" fill="#fff6d6" opacity=".14" class="a-glow"/>
    <ellipse cx="200" cy="276" rx="80" ry="14" fill="#fff6d6" opacity=".2"/>
    <circle cx="200" cy="150" r="30" fill="#151820"/><path d="M146 276 C150 200 250 200 254 276Z" fill="#151820"/>
    <text x="200" y="164" font-size="40" text-anchor="middle" fill="#c8a24a" font-family="serif" class="a-flicker">?</text>`),

  // ---------- Fantasy ----------
  tower: () => svg(`${sky('ft', '#0b0820', '#2b1840')}
    ${stars(46, 21, 200)}
    <circle cx="80" cy="70" r="30" fill="#f6efd0" class="a-glow"/><circle cx="92" cy="62" r="28" fill="#140f2e"/>
    <path d="M0 300 L60 240 L120 262 L170 210 L230 214 L290 250 L340 226 L400 260 V300Z" fill="#120c22"/>
    <path d="M170 230 L180 70 L240 70 L250 230Z" fill="#1d1533"/>
    <path d="M168 74 L210 14 L252 74Z" fill="#2a1d4a"/>
    ${[176, 192, 208, 224, 240].map((x) => `<rect x="${x - 4}" y="66" width="8" height="10" fill="#1d1533"/>`).join('')}
    <rect x="200" y="90" width="20" height="30" rx="10" fill="#ffcf6b" class="a-flicker"/>
    <circle cx="210" cy="105" r="36" fill="#ffcf6b" opacity=".12" class="a-glow"/>
    <rect x="196" y="160" width="12" height="18" rx="6" fill="#ffcf6b" opacity=".7" class="a-flicker" style="animation-delay:1s"/>
    <path d="M140 160 q14 -10 28 0 q-14 4 -28 0z M260 120 q12 -8 24 0 q-12 4 -24 0z" fill="#000" class="a-float"/>`),

  crypt: () => svg(`${sky('fc', '#0a1210', '#132420')}
    ${[40, 160, 280].map((x) => `<path d="M${x} 300 V120 Q${x + 40} 60 ${x + 80} 120 V300" fill="none" stroke="#2f4a40" stroke-width="10"/>`).join('')}
    <rect x="0" y="250" width="400" height="50" fill="#0b1512"/>
    ${[[80, 220], [200, 230], [320, 222]].map(([x, y]) => `<path d="M${x - 40} ${y} L${x - 30} ${y - 30} H${x + 30} L${x + 40} ${y}Z" fill="#3a4a44"/><path d="M${x - 6} ${y - 26} v-14 M${x - 12} ${y - 34} h12" stroke="#7fa898" stroke-width="3"/>`).join('')}
    <circle cx="200" cy="150" r="70" fill="#5dffb0" opacity=".08" class="a-glow"/>
    ${[120, 200, 280].map((x, i) => `<circle cx="${x}" cy="${110 + i * 8}" r="4" fill="#7dffc4" class="a-float" style="animation-delay:${i * 0.7}s"/>`).join('')}`),

  bridge: () => svg(`${sky('fb', '#0d0b1c', '#2a2140')}
    ${stars(30, 33, 110)}
    <path d="M0 140 L110 150 L120 300 H0Z" fill="#1a1430"/><path d="M400 140 L290 150 L280 300 H400Z" fill="#1a1430"/>
    <rect x="0" y="230" width="400" height="70" fill="#d6d0ff" opacity=".06" class="a-float"/>
    <path d="M110 150 Q200 210 290 150" stroke="#a07a4a" stroke-width="3" fill="none"/>
    <path d="M110 130 Q200 186 290 130" stroke="#a07a4a" stroke-width="2" fill="none"/>
    ${Array.from({ length: 13 }, (_, i) => {
      const x = 118 + i * 13.5;
      const t = (x - 110) / 180;
      const y = 150 + 60 * 4 * t * (1 - t) * 0.98;
      return `<rect x="${x}" y="${y - 2}" width="10" height="5" fill="#7a5a34" transform="rotate(${(t - 0.5) * 30} ${x + 5} ${y})"/>`;
    }).join('')}
    <g class="a-sway"><path d="M200 182 v-34" stroke="#000" stroke-width="0"/></g>`),

  campfire: () => svg(`${sky('ff', '#0b0a18', '#1d1530')}
    ${stars(40, 44, 150)}
    <path d="M0 300 V230 Q200 200 400 230 V300Z" fill="#100c1e"/>
    <circle cx="200" cy="232" r="90" fill="#ff9a3c" opacity=".1" class="a-glow"/>
    <path d="M160 252 L240 236 M160 236 L240 252" stroke="#5a3a1e" stroke-width="10" stroke-linecap="round"/>
    <path d="M200 160 C220 190 236 210 222 240 H178 C164 210 180 190 200 160Z" fill="#ff7b29" class="a-flicker"/>
    <path d="M200 190 C210 206 218 220 210 240 H190 C182 220 190 206 200 190Z" fill="#ffd36b" class="a-flicker" style="animation-delay:.4s"/>
    ${[[110, 0], [290, 1]].map(([x, d]) => `<g class="a-sway" style="animation-delay:${d}s"><circle cx="${x}" cy="210" r="12" fill="#1a1428"/><path d="M${x - 18} 252 Q${x} 200 ${x + 18} 252Z" fill="#1a1428"/></g>`).join('')}`),

  treasure: () => svg(`${sky('fx', '#120b06', '#2a1a0c')}
    <g class="a-spin" style="transform-origin:200px 170px">${Array.from({ length: 12 }, (_, i) => `<path d="M200 170 L${200 + 260 * Math.cos((i * Math.PI) / 6)} ${170 + 260 * Math.sin((i * Math.PI) / 6)} L${200 + 260 * Math.cos((i * Math.PI) / 6 + 0.12)} ${170 + 260 * Math.sin((i * Math.PI) / 6 + 0.12)}Z" fill="#ffd36b" opacity=".08"/>`).join('')}</g>
    <path d="M120 170 Q200 110 280 170Z" fill="#8a5a2a"/>
    <rect x="120" y="170" width="160" height="80" fill="#a0692f"/>
    <rect x="120" y="190" width="160" height="10" fill="#c8a24a"/><rect x="192" y="182" width="16" height="26" fill="#c8a24a"/>
    ${[[150, 162], [178, 156], [214, 158], [244, 164], [200, 150]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="9" fill="#ffd36b" stroke="#b8860b" class="a-twinkle" style="animation-delay:${i * 0.3}s"/>`).join('')}
    <path d="M168 144 L180 120 L192 144Z" fill="#5ad1ff" class="a-glow"/>`),

  climb: () => svg(`${sky('fl', '#0b0820', '#24163a')}
    ${stars(24, 55, 100)}
    <rect x="120" y="0" width="160" height="300" fill="#2a2140"/>
    ${Array.from({ length: 9 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<rect x="${124 + c * 40 + (r % 2) * 20}" y="${r * 34 + 4}" width="36" height="30" fill="#352a50"/>`).join('')).join('')}
    <path d="M200 0 C190 60 214 120 196 180 C186 230 208 270 200 300" stroke="#c8a24a" stroke-width="4" fill="none" class="a-sway"/>
    <path d="M150 300 C160 240 140 200 170 160 C180 120 150 90 176 40" stroke="#3f8a4a" stroke-width="5" fill="none"/>
    ${[60, 110, 160, 210].map((y, i) => `<ellipse cx="${166 + (i % 2) * 10}" cy="${y}" rx="9" ry="5" fill="#4aa85a"/>`).join('')}`),

  dragon: () => svg(`${sky('fd', '#1a0606', '#3a0d0d')}
    <path d="M20 120 Q90 40 160 110 Q120 90 110 140Z M380 120 Q310 40 240 110 Q280 90 290 140Z" fill="#1f0a0a" class="a-float"/>
    <path d="M140 300 C130 220 150 160 200 130 C250 160 270 220 260 300Z" fill="#2a0e0e"/>
    <path d="M150 140 L132 80 L172 122Z M250 140 L268 80 L228 122Z" fill="#3a1414"/>
    <path d="M160 130 Q200 100 240 130 L230 200 Q200 230 170 200Z" fill="#3a1212"/>
    <ellipse cx="180" cy="152" rx="10" ry="6" fill="#ffb800" class="a-blink"/><ellipse cx="220" cy="152" rx="10" ry="6" fill="#ffb800" class="a-blink"/>
    <ellipse cx="180" cy="152" rx="2.5" ry="6" fill="#200"/><ellipse cx="220" cy="152" rx="2.5" ry="6" fill="#200"/>
    <path d="M182 200 l6 10 l6 -10 l6 10 l6 -10 l6 10 l6 -10" stroke="#e8dcc0" stroke-width="3" fill="none"/>
    <circle cx="186" cy="186" r="3" fill="#000"/><circle cx="214" cy="186" r="3" fill="#000"/>
    ${[0, 1, 2].map((i) => `<circle cx="${190 + i * 10}" cy="180" r="${8 + i * 3}" fill="#888" opacity=".25" class="a-smoke" style="animation-delay:${i * 0.8}s"/>`).join('')}`),

  victory: () => svg(`${sky('fv', '#1a1206', '#3a2a0a')}
    <g class="a-spin" style="transform-origin:200px 140px">${Array.from({ length: 16 }, (_, i) => `<path d="M200 140 L${200 + 300 * Math.cos((i * Math.PI) / 8)} ${140 + 300 * Math.sin((i * Math.PI) / 8)} L${200 + 300 * Math.cos((i * Math.PI) / 8 + 0.1)} ${140 + 300 * Math.sin((i * Math.PI) / 8 + 0.1)}Z" fill="#ffe08a" opacity=".1"/>`).join('')}</g>
    <path d="M140 150 L150 90 L175 120 L200 70 L225 120 L250 90 L260 150Z" fill="#ffd36b" stroke="#b8860b" stroke-width="3" class="a-float"/>
    <circle cx="200" cy="112" r="7" fill="#e0457b"/><circle cx="165" cy="128" r="5" fill="#5ad1ff"/><circle cx="235" cy="128" r="5" fill="#5ad1ff"/>
    <rect x="196" y="170" width="8" height="100" fill="#cfd6e0"/><rect x="176" y="168" width="48" height="8" fill="#c8a24a"/>`),

  defeat: () => svg(`${sky('fz', '#0b0b10', '#1b1b26')}
    <path d="M0 300 V250 Q200 230 400 250 V300Z" fill="#101018"/>
    <rect x="160" y="150" width="8" height="100" fill="#8a8f99" transform="rotate(-20 164 250)"/>
    <rect x="230" y="190" width="8" height="60" fill="#8a8f99" transform="rotate(25 234 250)"/>
    <circle cx="200" cy="120" r="34" fill="#d8d2c4"/><rect x="182" y="146" width="36" height="20" rx="4" fill="#d8d2c4"/>
    <circle cx="188" cy="118" r="8" fill="#101018"/><circle cx="212" cy="118" r="8" fill="#101018"/>
    ${[0, 1, 2].map((i) => `<circle cx="${170 + i * 30}" cy="90" r="10" fill="#666" opacity=".2" class="a-smoke" style="animation-delay:${i}s"/>`).join('')}`),

  // ---------- Quiz ----------
  stage: () => svg(`${sky('qs', '#0b0630', '#1a0a4a')}
    <path d="M60 0 L20 300 H140Z" fill="#26e3ff" opacity=".12" class="a-sway"/>
    <path d="M340 0 L260 300 H380Z" fill="#ff2fb3" opacity=".12" class="a-sway" style="animation-delay:1.2s"/>
    <ellipse cx="200" cy="270" rx="170" ry="24" fill="#2b1a6a"/>
    <path d="M140 270 L160 170 H240 L260 270Z" fill="#3a1f8a" stroke="#ffd400" stroke-width="3"/>
    <text x="200" y="240" font-size="70" text-anchor="middle" fill="#ffd400" font-family="Bungee, sans-serif" class="a-glow">?</text>
    ${Array.from({ length: 12 }, (_, i) => `<circle cx="${30 + i * 31}" cy="16" r="5" fill="${['#ffd400', '#ff2fb3', '#26e3ff'][i % 3]}" class="a-twinkle" style="animation-delay:${i * 0.15}s"/>`).join('')}`),

  trophy: () => svg(`${sky('qt', '#0b0630', '#1a0a4a')}
    <g class="a-spin" style="transform-origin:200px 130px">${Array.from({ length: 12 }, (_, i) => `<path d="M200 130 L${200 + 280 * Math.cos((i * Math.PI) / 6)} ${130 + 280 * Math.sin((i * Math.PI) / 6)} L${200 + 280 * Math.cos((i * Math.PI) / 6 + 0.14)} ${130 + 280 * Math.sin((i * Math.PI) / 6 + 0.14)}Z" fill="#ffd400" opacity=".08"/>`).join('')}</g>
    <path d="M150 70 H250 V110 C250 150 225 170 200 170 C175 170 150 150 150 110Z" fill="#ffd400" class="a-float"/>
    <path d="M150 84 C120 84 120 130 156 130 M250 84 C280 84 280 130 244 130" stroke="#ffd400" stroke-width="8" fill="none"/>
    <rect x="190" y="170" width="20" height="40" fill="#e6b800"/><rect x="160" y="210" width="80" height="18" fill="#3a1f8a"/>`),
};

export function art(name) {
  return (ART[name] ?? ART.stage)();
}
