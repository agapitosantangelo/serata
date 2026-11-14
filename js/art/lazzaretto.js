// Illustrations for «L’Isola del Lazzaretto» (viewBox 400x300, dark lagoon palette).
import { svg, sky, stars } from '../art-helpers.js';

const fogBand = (y, opacity, delay) => `<path d="M0 ${y} Q100 ${y - 10} 200 ${y + 4} T400 ${y - 2} V${y + 14} Q300 ${y + 20} 200 ${y + 12} T0 ${y + 16}Z" fill="#c9d3e0" opacity="${opacity}" class="a-float" style="animation-delay:${delay}s"/>`;
const ripples = (y0, rows, color) => Array.from({ length: rows }, (_, i) => {
  const y = y0 + i * 14;
  const x = (i * 67) % 300;
  return `<path d="M${x} ${y} h${40 + (i % 3) * 20} M${(x + 180) % 360} ${y + 6} h30" stroke="${color}" stroke-width="1.5" opacity=".35"/>`;
}).join('');
/** Soft radial halo; `id` must be unique per illustration (prefixed laz-). */
const glowDef = (id, color, strength = 0.55) => `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${strength}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>`;
const halo = (id, cx, cy, r, delay = 0) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})" class="a-glow" style="animation-delay:${delay}s"/>`;
const candle = (x, y, h, delay, gid) => `<rect x="${x}" y="${y}" width="6" height="${h}" fill="#e9dfc4"/>
  ${halo(gid, x + 3, y - 6, 20, delay)}
  <path d="M${x + 3} ${y - 12} q-5 7 0 11 q5 -4 0 -11z" fill="#ffbf5a" class="a-flicker" style="animation-delay:${delay}s"/>`;

export default {
  lazzaretto: () => svg(`${sky('laz-cover-sky', '#0a1020', '#26324a')}
    ${stars(36, 41, 130)}
    <circle cx="322" cy="58" r="22" fill="#e8e2c4" class="a-glow"/>
    <path d="M0 184 h18 v-10 h8 v10 h14 v-20 h4 v-14 h4 v14 h4 v20 h22 v-8 h12 v8 h26 v-6 h10 v6 H140 V190 H0Z" fill="#151d2e"/>
    <rect y="188" width="400" height="112" fill="#0c1524"/>
    ${ripples(204, 6, '#8fa4c0')}
    <path d="M304 204 h36 M310 216 h24 M316 228 h12" stroke="#e8e2c4" stroke-width="2" opacity=".4" class="a-twinkle"/>
    <path d="M70 214 Q200 198 344 210 L354 224 H58Z" fill="#17110d"/>
    <path d="M100 178 L132 162 H262 L294 178Z" fill="#2a1a12"/>
    <rect x="100" y="178" width="194" height="36" fill="#43291b"/>
    ${[116, 146, 176, 206, 236].map((x, i) => `<path d="M${x} 206 v-14 a6 6 0 0 1 12 0 v14z" fill="${i % 2 ? '#f0b45a' : '#1d120c'}"${i % 2 ? ` class="a-flicker" style="animation-delay:${i * 0.7}s"` : ''}/>`).join('')}
    <rect x="252" y="110" width="22" height="68" fill="#4c2d1f"/>
    <path d="M250 110 L263 84 L276 110Z" fill="#26170f"/>
    <path d="M257 118 h12 v12 h-12z" fill="#f0b45a" class="a-flicker" style="animation-delay:1.1s"/>
    <path d="M82 214 C77 190 79 168 86 146 C93 168 95 190 90 214Z" fill="#0a130f" class="a-sway"/>
    <path d="M318 212 C314 194 316 176 322 160 C328 176 330 194 326 212Z" fill="#0a130f" class="a-sway" style="animation-delay:1.4s"/>
    <g class="a-float" style="animation-delay:.6s"><path d="M28 246 h38 l-7 7 h-25z" fill="#05080e"/><path d="M46 246 v-18" stroke="#05080e" stroke-width="2"/><path d="M46 230 l12 8 h-12z" fill="#05080e"/></g>
    ${fogBand(196, 0.13, 0)}${fogBand(236, 0.09, 1.5)}`),

  lazChiesa: () => svg(`${sky('laz-church-sky', '#120d12', '#21161a')}
    <path d="M60 300 V110 Q200 10 340 110 V300Z" fill="#2b1d1c"/>
    <path d="M120 300 V140 Q200 70 280 140 V300Z" fill="#1a1112"/>
    <circle cx="200" cy="150" r="34" fill="#8a6a3a" opacity=".22"/>
    <circle cx="200" cy="150" r="34" fill="none" stroke="#c9a45a" stroke-width="2" opacity=".35"/>
    <path d="M186 196 Q200 150 214 196Z" fill="#5a3b46" opacity=".5"/><circle cx="200" cy="146" r="10" fill="#b39a7a" opacity=".45"/>
    <path d="M150 120 l12 18 M246 116 l-10 22" stroke="#4a3330" stroke-width="2" opacity=".6"/>
    <rect x="150" y="222" width="100" height="40" fill="#3a2620"/><rect x="144" y="216" width="112" height="8" fill="#51362a"/>
    <path d="M196 196 h8 v20 h-8z M190 202 h20 v6 h-20z" fill="#c9a45a" opacity=".7"/>
    ${glowDef('laz-church-glow', '#ffbf5a')}
    ${candle(158, 190, 26, 0, 'laz-church-glow')}${candle(236, 190, 26, 0.9, 'laz-church-glow')}${candle(128, 236, 30, 1.6, 'laz-church-glow')}${candle(266, 236, 30, 0.4, 'laz-church-glow')}
    ${[262, 282].map((y) => `<rect x="40" y="${y}" width="96" height="10" fill="#1c120d"/><rect x="264" y="${y}" width="96" height="10" fill="#1c120d"/>`).join('')}
    <path d="M232 228 v12" stroke="#e9dfc4" stroke-width="2" class="a-drip"/>
    ${fogBand(276, 0.08, 0.8)}`),

  lazOttagono: () => svg(`${sky('laz-oct-sky', '#081019', '#1b2a3a')}
    ${stars(28, 77, 120)}
    <circle cx="80" cy="60" r="16" fill="#dfe6d8" class="a-glow"/>
    <rect y="196" width="400" height="104" fill="#0a1420"/>
    ${ripples(214, 6, '#7f97b3')}
    <path d="M104 206 L134 194 H266 L296 206 L286 218 H114Z" fill="#17120e"/>
    <path d="M118 202 V150 L150 138 V206Z" fill="#2c1f16"/>
    <path d="M150 138 H250 V206 H150Z" fill="#45301f"/>
    <path d="M250 138 L282 150 V202 L250 206Z" fill="#2c1f16"/>
    <path d="M118 150 L150 138 H250 L282 150 L250 158 H150Z" fill="#5a3f29"/>
    <path d="M118 150 L150 144 H250 L282 150" stroke="#6e4e33" stroke-width="2" fill="none"/>
    ${[154, 172, 190, 208, 226, 242].map((x) => `<rect x="${x}" y="130" width="8" height="9" fill="#45301f"/>`).join('')}
    <rect x="124" y="140" width="7" height="9" fill="#2c1f16"/><rect x="270" y="140" width="7" height="9" fill="#2c1f16"/>
    <circle cx="176" cy="174" r="6" fill="#0c0806"/><circle cx="224" cy="174" r="6" fill="#0c0806"/><circle cx="134" cy="176" r="4" fill="#0c0806"/><circle cx="266" cy="176" r="4" fill="#0c0806"/>
    ${glowDef('laz-oct-glow', '#f0b45a')}${halo('laz-oct-glow', 200, 196, 34)}
    <path d="M193 206 v-18 a7 7 0 0 1 14 0 v18z" fill="#f0b45a" class="a-flicker"/>
    <path d="M200 222 v30 M193 236 h14" stroke="#f0b45a" stroke-width="3" opacity=".25" class="a-glow"/>
    ${fogBand(190, 0.14, 0.3)}${fogBand(250, 0.1, 2)}`),

  lazUfficiale: () => svg(`${sky('laz-off-sky', '#0b0f17', '#1f2430')}
    <path d="M40 300 V120 Q120 40 200 40 Q280 40 360 120 V300 H320 V140 Q280 84 200 84 Q120 84 80 140 V300Z" fill="#3a2418"/>
    ${[110, 150, 190, 230, 270].map((y) => `<path d="M40 ${y} h40 M320 ${y} h40" stroke="#2a190f" stroke-width="2"/>`).join('')}
    <path d="M200 120 C160 124 140 170 128 290 H272 C260 170 240 124 200 120Z" fill="#07080c"/>
    <path d="M200 124 C186 160 180 220 176 290 M200 124 C214 160 222 220 226 290" stroke="#151821" stroke-width="2" fill="none"/>
    <ellipse cx="200" cy="104" rx="16" ry="20" fill="#d9d4c4"/>
    <circle cx="194" cy="102" r="2.4" fill="#1a1a1a" class="a-blink"/><circle cx="206" cy="102" r="2.4" fill="#1a1a1a" class="a-blink"/>
    <path d="M166 86 Q200 64 234 86 Q214 80 200 82 Q186 80 166 86Z" fill="#05060a"/>
    <path d="M176 84 L200 60 L224 84Z" fill="#05060a"/>
    <path d="M150 196 q-10 20 -6 40" stroke="#07080c" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M140 236 v10" stroke="#8a6a3a" stroke-width="2"/>
    <rect x="130" y="246" width="20" height="26" rx="3" fill="#2a1d12" stroke="#8a6a3a" stroke-width="2"/>
    <path d="M140 266 q-5 -7 0 -12 q5 5 0 12z" fill="#ffbf5a" class="a-flicker"/>
    ${glowDef('laz-off-glow', '#ffbf5a')}${halo('laz-off-glow', 140, 259, 46)}
    <rect x="228" y="200" width="34" height="44" fill="#d9cfae" transform="rotate(8 245 222)"/>
    ${[210, 218, 226, 234].map((y) => `<path d="M234 ${y} h22" stroke="#6a5a40" stroke-width="1.5" transform="rotate(8 245 222)"/>`).join('')}
    <circle cx="252" cy="236" r="5" fill="#8a1f1f" transform="rotate(8 245 222)"/>
    ${fogBand(262, 0.16, 0)}${fogBand(282, 0.12, 1.2)}`),

  lazFalo: () => svg(`${sky('laz-fire-sky', '#1a1530', '#6b3a3a')}
    ${stars(14, 19, 70)}
    <path d="M0 150 Q200 136 400 150 V160 H0Z" fill="#e39a5a" opacity=".35" class="a-glow"/>
    <rect y="158" width="400" height="142" fill="#141a2a"/>
    ${ripples(172, 7, '#e3a06a')}
    <g class="a-float"><path d="M266 176 h56 l-9 9 h-38z" fill="#06080e"/><path d="M292 176 v-28" stroke="#06080e" stroke-width="2"/><path d="M293 150 l18 18 h-18z" fill="#2a2230"/><circle cx="316" cy="172" r="3" fill="#ffd27a" class="a-flicker"/></g>
    <path d="M0 250 Q120 226 220 240 T400 236 V300 H0Z" fill="#1c140e"/>
    <path d="M70 252 l70 -14 M80 240 l62 18 M92 236 l40 22" stroke="#4a2c16" stroke-width="8" stroke-linecap="round"/>
    ${glowDef('laz-fire-glow', '#ff8a3a')}${halo('laz-fire-glow', 110, 220, 80)}
    <path d="M110 244 C84 228 92 200 104 186 C106 204 116 206 114 190 C128 202 138 226 110 244Z" fill="#ff7a2a" class="a-flicker"/>
    <path d="M110 244 C96 232 100 214 108 204 C112 216 118 218 116 208 C124 220 124 236 110 244Z" fill="#ffd27a" class="a-flicker" style="animation-delay:.4s"/>
    ${[[96, 176, 0], [124, 168, 0.8], [110, 156, 1.6], [132, 186, 2.2]].map(([x, y, d]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#ffb35a" class="a-twinkle" style="animation-delay:${d}s"/>`).join('')}
    ${[0, 1, 2].map((i) => `<circle cx="${112 + i * 6}" cy="${170 - i * 10}" r="${10 + i * 4}" fill="#6a6470" opacity=".25" class="a-smoke" style="animation-delay:${i}s"/>`).join('')}
    <path d="M300 248 h60 M310 262 h40" stroke="#e3a06a" stroke-width="1.5" opacity=".3"/>`),

  lazRegistro: () => svg(`${sky('laz-reg-sky', '#140f0c', '#22180f')}
    <rect y="210" width="400" height="90" fill="#2a1b10"/>
    <path d="M60 236 Q130 214 200 232 Q270 214 340 236 L332 112 Q270 94 200 112 Q130 94 68 112Z" fill="#d8cba8"/>
    <path d="M200 112 V232" stroke="#9c8a62" stroke-width="2"/>
    <path d="M60 236 Q130 222 200 240 Q270 222 340 236 V242 Q270 230 200 248 Q130 230 60 242Z" fill="#7a3a26"/>
    <text x="134" y="132" font-family="Georgia, serif" font-size="13" fill="#5a3a20" text-anchor="middle">MDCXXX</text>
    ${[146, 160, 174, 188, 202].map((y, i) => `<path d="M${88 + (i % 2) * 6} ${y} h${70 - (i % 3) * 12}" stroke="#5a4a30" stroke-width="2" opacity=".7"/><path d="M${218 + (i % 2) * 4} ${y} h${58 + (i % 3) * 10}" stroke="#5a4a30" stroke-width="2" opacity="${i < 3 ? 0.7 : 0.25}"/>`).join('')}
    <path d="M222 216 h46" stroke="#7a1f1f" stroke-width="2.5" class="a-glow"/>
    <ellipse cx="350" cy="222" rx="16" ry="6" fill="#0a0806"/><rect x="336" y="200" width="28" height="22" rx="4" fill="#0e0b08"/>
    <path d="M352 202 C330 160 310 130 286 96 C306 120 326 150 356 200Z" fill="#e9e2d0" class="a-sway"/>
    ${glowDef('laz-reg-glow', '#ffbf5a')}${glowDef('laz-reg-soft', '#ffbf5a', 0.18)}${halo('laz-reg-soft', 200, 170, 150)}
    ${candle(40, 168, 46, 0.3, 'laz-reg-glow')}
    <path d="M43 178 v12" stroke="#e9dfc4" stroke-width="2" class="a-drip"/>
`),
};
