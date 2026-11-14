// Illustrations for «Il Rifugio dei Colpi» (viewBox 400x300, dark palette, ids prefixed rif-).
import { svg, sky, stars } from '../art-helpers.js';

const CENTERED = 'transform-box:fill-box;transform-origin:center';

/** Falling flakes: small circles that drift down and fade (deterministic positions). */
function flakes(count, offset = 0, box = { x: 0, y: 0, w: 400, h: 260 }) {
  return Array.from({ length: count }, (_, i) => {
    const x = box.x + ((i * 53 + offset * 29) % box.w);
    const y = box.y + ((i * 37 + offset * 17) % box.h);
    return `<circle cx="${x}" cy="${y}" r="${1.2 + (i % 3) * 0.6}" fill="#e6eef8" opacity=".8" class="a-drip" style="animation-delay:${(i % 6) * 0.4}s"/>`;
  }).join('');
}

/** Wisps of smoke rising from a point. */
function smoke(x, y, color = '#9aa3ad') {
  return [0, 1, 2].map((i) => `<circle cx="${x + i * 4}" cy="${y - i * 6}" r="${6 + i * 3}" fill="${color}" opacity=".3" class="a-smoke" style="${CENTERED};animation-delay:${i * 0.9}s"/>`).join('');
}

const mountains = (snow = '#cfd8e6', rock = '#232d44', front = '#121827') => `
  <path d="M0 190 L60 120 L95 150 L150 80 L205 140 L245 105 L300 160 L345 110 L400 150 V300 H0Z" fill="${rock}"/>
  <path d="M150 80 L132 104 L146 100 L156 110 L168 96 Z M345 110 L332 128 L344 124 L354 130 Z M60 120 L48 136 L62 132 L70 138 Z" fill="${snow}" opacity=".85"/>
  <path d="M0 220 L70 175 L130 205 L200 170 L270 210 L340 180 L400 200 V300 H0Z" fill="${front}"/>`;

function cup(x, y, delay) {
  return `<path d="M${x} ${y} h16 v12 a8 6 0 0 1 -16 0Z" fill="#e8e2d4"/>
    <path d="M${x + 16} ${y + 3} q7 1 0 8" stroke="#e8e2d4" stroke-width="2" fill="none"/>
    <path d="M${x + 5} ${y - 4} q-4 -8 2 -14 q5 -6 0 -12" stroke="#cfd6dc" stroke-width="2" fill="none" opacity=".55" class="a-smoke" style="${CENTERED};animation-delay:${delay}s"/>`;
}

export default {
  rifugio: () => svg(`${sky('rif-cover', '#060a16', '#1e2a40')}
    ${stars(18, 41, 90)}
    ${mountains()}
    <path d="M0 250 Q120 230 220 246 T400 240 V300 H0Z" fill="#c4cedb"/>
    <path d="M0 268 Q140 256 260 266 T400 262 V300 H0Z" fill="#9fabbd"/>
    <rect x="132" y="178" width="136" height="74" fill="#3a2a1c"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="132" y="${180 + i * 12}" width="136" height="2" fill="#24190f"/>`).join('')}
    <rect x="132" y="236" width="136" height="16" fill="#3d3833"/>
    <path d="M118 182 L200 126 L282 182Z" fill="#1a120c"/>
    <path d="M114 184 L200 122 L286 184 L276 186 L200 134 L124 186Z" fill="#e6eef8"/>
    <rect x="236" y="132" width="16" height="34" fill="#2b2622"/><rect x="233" y="128" width="22" height="6" fill="#e6eef8"/>
    ${smoke(244, 118)}
    <rect x="150" y="196" width="34" height="28" fill="#f4c25b" class="a-flicker"/>
    <path d="M167 196 V224 M150 210 H184" stroke="#3a2a1c" stroke-width="3"/>
    <rect x="212" y="200" width="28" height="50" fill="#1f150d"/><circle cx="234" cy="226" r="2" fill="#c9a14a"/>
    <path d="M60 236 C64 206 52 194 70 166 C80 194 92 210 86 236Z" fill="#0a0f18" class="a-sway"/>
    <path d="M330 240 C336 204 322 190 342 156 C356 190 368 214 360 240Z" fill="#0a0f18" class="a-sway" style="animation-delay:1.2s"/>
    <ellipse cx="318" cy="226" rx="3" ry="2" fill="#9fe8c0" class="a-blink"/><ellipse cx="328" cy="226" rx="3" ry="2" fill="#9fe8c0" class="a-blink"/>
    ${flakes(34)}`),

  rifMuro: () => svg(`${sky('rif-wall', '#120c07', '#2e2015')}
    <defs><radialGradient id="rif-crack" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#7dffc4" stop-opacity=".55"/><stop offset="1" stop-color="#7dffc4" stop-opacity="0"/></radialGradient></defs>
    ${Array.from({ length: 10 }, (_, i) => `<rect x="${i * 40}" y="0" width="38" height="300" fill="${i % 2 ? '#3b2918' : '#33231a'}"/><circle cx="${i * 40 + 12}" cy="${60 + (i * 47) % 180}" r="3" fill="#1d130b"/>`).join('')}
    <ellipse cx="205" cy="150" rx="90" ry="110" fill="url(#rif-crack)" class="a-glow"/>
    <path d="M205 40 L198 80 L212 110 L196 150 L214 190 L202 240 L208 270" stroke="#0a0604" stroke-width="7" fill="none"/>
    <path d="M205 40 L198 80 L212 110 L196 150 L214 190 L202 240 L208 270" stroke="#7dffc4" stroke-width="1.6" fill="none" class="a-glow"/>
    <ellipse cx="201" cy="146" rx="2.4" ry="3" fill="#d6ff6b" class="a-blink"/><ellipse cx="211" cy="146" rx="2.4" ry="3" fill="#d6ff6b" class="a-blink"/>
    <path d="M196 132 L206 112 L216 132Z" fill="#8a1c1c"/>
    ${[0, 1, 2].map((i) => `<circle cx="205" cy="150" r="${30 + i * 26}" stroke="#e8e2d4" stroke-width="2" fill="none" opacity=".35" class="a-twinkle" style="animation-delay:${i * 0.45}s"/>`).join('')}
    <text x="60" y="90" fill="#e8e2d4" opacity=".55" font-family="Georgia, serif" font-size="26" font-weight="bold" class="a-twinkle">TOC</text>
    <text x="290" y="130" fill="#e8e2d4" opacity=".5" font-family="Georgia, serif" font-size="22" font-weight="bold" class="a-twinkle" style="animation-delay:.9s">TOC TOC</text>
    <text x="80" y="230" fill="#e8e2d4" opacity=".45" font-family="Georgia, serif" font-size="20" font-weight="bold" class="a-twinkle" style="animation-delay:1.7s">TOC</text>
    <rect x="300" y="210" width="70" height="6" fill="#1d130b"/>
    <rect x="326" y="186" width="10" height="24" fill="#efe6cf"/>
    <path d="M331 172 q-6 8 0 14 q6 -6 0 -14Z" fill="#ffb347" class="a-flicker"/>`),

  rifPorta: () => svg(`${sky('rif-door', '#0d0a08', '#1f1712')}
    <defs><linearGradient id="rif-gap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0ff" stop-opacity=".9"/><stop offset="1" stop-color="#9fd0ff" stop-opacity="0"/></linearGradient></defs>
    <rect x="110" y="30" width="180" height="236" fill="#140e0a"/>
    <rect x="122" y="40" width="156" height="222" fill="#4a3220"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${122 + i * 39}" y="40" width="2" height="222" fill="#2a1c10"/>`).join('')}
    <rect x="122" y="80" width="156" height="10" fill="#2b2b2e"/><rect x="122" y="200" width="156" height="10" fill="#2b2b2e"/>
    ${[136, 264].map((x) => `<circle cx="${x}" cy="85" r="3" fill="#6d6d72"/><circle cx="${x}" cy="205" r="3" fill="#6d6d72"/>`).join('')}
    <rect x="240" y="140" width="40" height="8" fill="#6d6d72"/><rect x="250" y="134" width="8" height="20" fill="#55555a"/>
    <rect x="122" y="262" width="156" height="5" fill="#9fd0ff" class="a-flicker"/>
    <rect x="160" y="262" width="18" height="5" fill="#05070b" class="a-flicker"/><rect x="214" y="262" width="18" height="5" fill="#05070b" class="a-flicker" style="animation-delay:.3s"/>
    <path d="M110 267 L290 267 L330 300 L70 300Z" fill="url(#rif-gap)" opacity=".35"/>
    <path d="M100 300 Q150 280 200 290 T300 300Z" fill="#dfe8f2" opacity=".85"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${130 + i * 22}" cy="${270 + (i % 3) * 4}" r="1.6" fill="#e6eef8" class="a-drip" style="animation-delay:${i * 0.35}s"/>`).join('')}
    <path d="M110 30 l14 10 l-6 12 l10 6 M290 30 l-12 12 l6 10 l-10 8" stroke="#cfe6ff" stroke-width="1.5" fill="none" opacity=".5"/>
    <rect x="44" y="120" width="34" height="46" rx="4" fill="#1f1712" stroke="#6d6d72" stroke-width="3"/>
    <rect x="52" y="130" width="18" height="28" fill="#f4c25b" class="a-flicker"/>
    <path d="M61 112 v8" stroke="#6d6d72" stroke-width="3"/>`),

  rifTavola: () => svg(`${sky('rif-table', '#0b0a10', '#221a14')}
    <defs><radialGradient id="rif-candle" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f4c25b" stop-opacity=".45"/><stop offset="1" stop-color="#f4c25b" stop-opacity="0"/></radialGradient></defs>
    <rect x="150" y="40" width="100" height="80" fill="#121a2b" stroke="#3a2a1c" stroke-width="6"/>
    <path d="M200 40 V120 M150 80 H250" stroke="#3a2a1c" stroke-width="4"/>
    ${flakes(10, 3, { x: 152, y: 44, w: 96, h: 66 })}
    <ellipse cx="200" cy="190" rx="170" ry="90" fill="url(#rif-candle)" class="a-glow"/>
    <path d="M60 190 L340 190 L370 230 L30 230Z" fill="#5a3d24"/>
    <rect x="30" y="230" width="340" height="10" fill="#3a2716"/>
    <rect x="50" y="240" width="10" height="50" fill="#2e1f12"/><rect x="340" y="240" width="10" height="50" fill="#2e1f12"/>
    <path d="M70 150 v60 M100 150 v60 M70 150 h30" stroke="#2e1f12" stroke-width="6" fill="none"/>
    <path d="M300 160 v56 M330 160 v56 M300 160 h30" stroke="#2e1f12" stroke-width="6" fill="none" transform="rotate(8 315 190)"/>
    ${cup(90, 196, 0)}${cup(150, 200, 0.6)}${cup(232, 200, 1.2)}${cup(292, 196, 1.8)}
    <ellipse cx="200" cy="214" rx="18" ry="4" fill="#d9d2c0"/>
    <rect x="196" y="176" width="8" height="34" fill="#efe6cf"/>
    <path d="M200 162 q-6 8 0 14 q6 -6 0 -14Z" fill="#ffb347" class="a-flicker"/>
    <ellipse cx="200" cy="120" rx="26" ry="34" fill="#cfe8ff" opacity=".07" class="a-float"/>`),

  rifAlba: () => svg(`${sky('rif-dawn', '#1b2140', '#f2a65a')}
    <circle cx="250" cy="150" r="40" fill="#ffd8a0" class="a-glow"/>
    ${mountains('#fff3e6', '#4a4560', '#2c2a40')}
    <path d="M0 240 Q120 224 220 236 T400 230 V300 H0Z" fill="#f1e6e0"/>
    <path d="M0 262 Q150 250 260 260 T400 256 V300 H0Z" fill="#d9c9cf"/>
    <rect x="72" y="214" width="52" height="30" fill="#3a2a1c"/><path d="M66 216 L98 194 L130 216Z" fill="#f6f1ec"/>
    <rect x="84" y="222" width="12" height="10" fill="#f4c25b" class="a-flicker"/>
    ${smoke(112, 196, '#cfc7d6')}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${140 + i * 26}" cy="${262 - i * 3}" rx="4" ry="2" fill="#b9a9b6"/>`).join('')}
    <g class="a-float">
      <path d="M280 60 h46 a14 12 0 0 1 0 24 h-46 a12 12 0 0 1 0 -24Z" fill="#8a1c1c"/>
      <path d="M326 72 h34 l6 -8" stroke="#8a1c1c" stroke-width="5" fill="none"/>
      <rect x="292" y="66" width="18" height="10" rx="3" fill="#cfe8ff"/>
      <path d="M262 52 H348" stroke="#1b1b22" stroke-width="3"/><path d="M304 52 v8" stroke="#1b1b22" stroke-width="3"/>
      <path d="M288 92 H330 M296 84 v8 M322 84 v8" stroke="#1b1b22" stroke-width="3"/>
      <circle cx="282" cy="74" r="3" fill="#ffffff" class="a-blink"/>
    </g>
    <path d="M300 236 h50 l10 -16 h-44 l-8 -12 h-14Z" fill="#c43b2a"/>
    <rect x="298" y="236" width="66" height="8" fill="#1b1b22"/>
    <circle cx="362" cy="226" r="3" fill="#fff6c8" class="a-flicker"/>`),

  rifTesoro: () => svg(`${sky('rif-gold', '#0d0906', '#22170f')}
    <defs><radialGradient id="rif-coins" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd166" stop-opacity=".7"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient></defs>
    ${Array.from({ length: 7 }, (_, i) => `<rect x="0" y="${150 + i * 22}" width="400" height="20" fill="${i % 2 ? '#3a2716' : '#432d1a'}"/>`).join('')}
    <rect x="120" y="194" width="170" height="40" fill="#050302"/>
    <ellipse cx="205" cy="200" rx="140" ry="90" fill="url(#rif-coins)" class="a-glow"/>
    <path d="M170 140 L188 70 M205 140 L205 60 M240 140 L222 70" stroke="#ffd166" stroke-width="5" opacity=".25" class="a-glow"/>
    <path d="M150 230 L160 200 H250 L260 230Z" fill="#5a3a1c"/><rect x="150" y="226" width="110" height="8" fill="#3a2410"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<ellipse cx="${170 + i * 12}" cy="${206 - (i % 2) * 4}" rx="6" ry="3" fill="#ffd166" stroke="#b8862b" stroke-width="1" class="a-twinkle" style="animation-delay:${i * 0.3}s"/>`).join('')}
    <path d="M290 194 L340 150 L350 160 L300 204Z" fill="#4b321d"/>
    <path d="M92 258 h44 m-12 0 v8 m-8 -8 v6" stroke="#8a5a2a" stroke-width="4" fill="none"/>
    <circle cx="86" cy="258" r="8" stroke="#8a5a2a" stroke-width="4" fill="none"/>
    <path d="M60 110 Q66 96 74 110Z" fill="#8a1c1c" class="a-float"/>
    <ellipse cx="64" cy="118" rx="1.8" ry="2.4" fill="#d6ff6b" class="a-blink"/><ellipse cx="71" cy="118" rx="1.8" ry="2.4" fill="#d6ff6b" class="a-blink"/>`),
};
