// Illustrations for «La Notte del Noce» (viewBox 400x300). Gradient ids are prefixed `noc-`.
import { svg, sky, stars } from '../art-helpers.js';

const INK = '#06070d';

/** The great walnut: trunk, roots and a wide dark crown. */
function walnut(x, y, scale, fill = INK) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}">
    <path d="M-14 0 C-8 -40 -16 -70 -6 -100 L10 -100 C18 -70 12 -40 20 0Z"/>
    <path d="M-14 0 C-30 4 -44 2 -56 8 M20 0 C34 4 48 2 60 10 M2 0 C0 8 -4 12 -10 16" stroke="${fill}" stroke-width="5" fill="none"/>
    <path d="M-4 -96 C-30 -120 -60 -120 -88 -140 M6 -98 C30 -122 64 -118 90 -138 M2 -100 C0 -130 4 -150 0 -176" stroke="${fill}" stroke-width="8" fill="none"/>
    <ellipse cx="0" cy="-160" rx="96" ry="44"/><ellipse cx="-72" cy="-140" rx="48" ry="30"/>
    <ellipse cx="76" cy="-142" rx="52" ry="30"/><ellipse cx="4" cy="-196" rx="60" ry="32"/>
  </g>`;
}

/** A mare's head in profile with a braided mane. */
function mare(x, y, coat, flip = false) {
  const braids = [0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${-6 + i * 3}" cy="${-70 + i * 14}" rx="5" ry="7" fill="#1a110a" stroke="#3a2618" stroke-width="1.5"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)">
    <path d="M-30 40 C-34 0 -24 -40 0 -66 L10 -84 L18 -70 C40 -60 60 -36 70 -14 C76 -2 70 8 58 6 L42 2 C30 14 12 24 8 40Z" fill="${coat}"/>
    ${braids}
    <circle cx="30" cy="-36" r="3.5" fill="#f2e6c8" class="a-blink"/>
    <circle cx="62" cy="-4" r="2" fill="#120c08"/>
  </g>`;
}

export default {
  noce: () => svg(`${sky('noc-sky', '#0a0c1e', '#262040')}
    ${stars(40, 21, 140)}
    <circle cx="300" cy="70" r="34" fill="#efe7c4" class="a-glow"/>
    <circle cx="290" cy="62" r="6" fill="#d6cba0" opacity=".6"/><circle cx="310" cy="82" r="4" fill="#d6cba0" opacity=".5"/>
    <g class="a-float"><path d="M258 72 L322 56" stroke="${INK}" stroke-width="3"/>
      <path d="M322 56 l16 -8 l-2 10 l14 2 l-16 6z" fill="${INK}"/>
      <path d="M282 66 q4 -18 12 -16 q8 2 6 12z" fill="${INK}"/><circle cx="293" cy="46" r="5" fill="${INK}"/>
      <path d="M287 44 l6 -14 l6 14z" fill="${INK}"/></g>
    <path d="M0 222 Q100 192 200 212 T400 202 V300 H0Z" fill="#0d1022"/>
    <path d="M0 262 Q120 248 220 262 T400 256 V300 H0Z" fill="#1b2a4a"/>
    <path d="M270 270 h44 M282 278 h26 M292 286 h14" stroke="#efe7c4" stroke-width="2" opacity=".5" class="a-twinkle"/>
    ${walnut(150, 252, 1)}
    ${[[70, 236, 0], [112, 244, 0.7], [210, 242, 1.4], [246, 232, 2.1]].map(([x, y, d]) => `<g class="a-sway" style="animation-delay:${d}s">
      <path d="M${x - 8} ${y} L${x} ${y - 20} L${x + 8} ${y}Z" fill="#140f1c"/><circle cx="${x}" cy="${y - 24}" r="4.5" fill="#140f1c"/></g>`).join('')}
    ${[[90, 210], [150, 196], [196, 214], [232, 204]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" fill="#a6f07a" class="a-flicker" style="animation-delay:${i * 0.6}s"/>
      <circle cx="${x}" cy="${y}" r="12" fill="#a6f07a" opacity=".15" class="a-glow"/>`).join('')}`),

  nocStalla: () => svg(`${sky('noc-stalla', '#1a120c', '#2a1c12')}
    <rect x="0" y="0" width="400" height="26" fill="#120c07"/>
    ${[60, 200, 340].map((x) => `<rect x="${x - 6}" y="0" width="12" height="300" fill="#140d08"/>`).join('')}
    <rect x="260" y="40" width="60" height="44" fill="#141a33"/><circle cx="296" cy="58" r="10" fill="#efe7c4" class="a-glow"/>
    <path d="M260 62 h60 M290 40 v44" stroke="#140d08" stroke-width="4"/>
    <path d="M120 36 v26" stroke="#3a2a1a" stroke-width="2"/><rect x="110" y="62" width="20" height="26" rx="3" fill="#2a1f14" stroke="#8a6a3a" stroke-width="2"/>
    <path d="M120 66 q-5 8 0 14 q5 -6 0 -14z" fill="#ffb347" class="a-flicker"/>
    <circle cx="120" cy="76" r="44" fill="#ffb347" opacity=".08" class="a-glow"/>
    ${mare(120, 220, '#5a3a26')}
    ${mare(300, 230, '#2e2a2a', true)}
    <path d="M0 252 H400 V300 H0Z" fill="#3a2a14"/>
    ${[20, 70, 150, 230, 290, 360].map((x, i) => `<path d="M${x} 262 l8 -14 l4 14 l6 -10 l2 10" stroke="#c9a54a" stroke-width="2" fill="none" opacity=".7" style="animation-delay:${i * 0.3}s" class="a-sway"/>`).join('')}
    ${[[180, 160], [206, 182], [230, 150]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#cfe7ff" class="a-drip" style="animation-delay:${i * 0.8}s"/>`).join('')}`),

  nocSoglia: () => svg(`${sky('noc-soglia', '#0d0b10', '#1c1720')}
    <rect x="120" y="30" width="160" height="230" fill="#2a1c12"/>
    <rect x="134" y="44" width="132" height="216" fill="#101a33"/>
    ${stars(10, 7, 120).replace(/cx="(\d+)"/g, (m, x) => `cx="${140 + (Number(x) % 120)}"`)}
    <circle cx="232" cy="92" r="18" fill="#efe7c4" class="a-glow"/>
    <path d="M200 260 C196 200 186 170 192 140 C196 120 212 120 214 140 C220 170 210 200 214 260Z" fill="${INK}" opacity=".85"/>
    <circle cx="203" cy="124" r="11" fill="${INK}" opacity=".85"/>
    <path d="M214 160 l18 -6 M218 168 l16 2" stroke="${INK}" stroke-width="3" opacity=".85"/>
    <path d="M266 44 L330 70 V280 L266 260Z" fill="#3a2716"/><circle cx="276" cy="160" r="3" fill="#c8a24a"/>
    <rect x="0" y="260" width="400" height="40" fill="#1a1210"/>
    ${Array.from({ length: 34 }, (_, i) => `<circle cx="${128 + i * 4.4}" cy="${264 + (i % 3)}" r="1.6" fill="#f3f1ea" class="${i % 5 ? '' : 'a-twinkle'}"/>`).join('')}
    <g transform="rotate(-28 90 200)"><rect x="86" y="110" width="7" height="120" fill="#7a5a32"/>
      <path d="M78 226 L102 226 L112 280 L68 280Z" fill="#c9a54a"/>
      ${[72, 80, 88, 96, 104].map((x) => `<path d="M${x + 6} 232 L${x} 280" stroke="#8a6a2a" stroke-width="1.5"/>`).join('')}</g>
    <rect x="330" y="210" width="10" height="30" fill="#efe6cf"/>
    <path d="M335 196 q-6 8 0 14 q6 -6 0 -14z" fill="#ffb347" class="a-flicker"/>
    <circle cx="335" cy="210" r="34" fill="#ffb347" opacity=".08" class="a-glow"/>`),

  nocCavalcata: () => svg(`${sky('noc-cavalcata', '#0b0a1c', '#3a1f3a')}
    ${stars(34, 44, 150)}
    <circle cx="200" cy="120" r="78" fill="#efe2bd" class="a-glow"/>
    <g class="a-float" fill="${INK}">
      <path d="M120 150 C140 128 220 126 250 140 L272 116 L284 104 L296 110 L290 126 L300 140 L286 144 L270 150 C266 166 250 172 238 170 L250 200 L240 202 L224 172 L170 170 L150 204 L140 200 L152 168 C134 166 122 160 120 150Z"/>
      <path d="M120 150 C96 146 84 160 70 176 C90 168 104 166 120 158Z"/>
      <path d="M272 116 l-6 -8 l-6 10 l-6 -8 l-6 10 l-6 -6" stroke="${INK}" stroke-width="3" fill="none"/>
      <path d="M206 132 C204 112 210 98 218 92 C226 98 228 112 222 130Z"/><circle cx="218" cy="86" r="8"/>
      <path d="M214 82 C190 74 168 84 150 76 C170 92 194 90 212 90Z" class="a-sway"/>
    </g>
    <path d="M0 238 Q100 214 200 230 T400 222 V300 H0Z" fill="#120d1c"/>
    <path d="M0 270 Q140 254 260 268 T400 262 V300 H0Z" fill="#0a0812"/>
    ${[[60, 250], [330, 246]].map(([x, y]) => `<rect x="${x}" y="${y - 22}" width="26" height="22" fill="#1c1428"/><rect x="${x + 9}" y="${y - 14}" width="8" height="8" fill="#f4c25b" class="a-flicker"/>`).join('')}
    <path d="M150 210 q10 -6 20 0 q10 6 20 0" stroke="#a6f07a" stroke-width="2" fill="none" opacity=".5" class="a-smoke"/>`),

  nocBosco: () => svg(`${sky('noc-bosco', '#050a0a', '#10201c')}
    ${[[30, 18], [90, 26], [160, 14], [250, 22], [320, 30], [380, 16]].map(([x, w]) => `<rect x="${x - w / 2}" y="0" width="${w}" height="300" fill="#081210"/>`).join('')}
    ${[[60, 10], [130, 16], [210, 12], [290, 18], [350, 12]].map(([x, w]) => `<rect x="${x - w / 2}" y="40" width="${w}" height="260" fill="#0c1a16"/>`).join('')}
    <path d="M150 300 C180 250 220 230 200 190 C190 170 210 160 220 150" stroke="#1d2e22" stroke-width="40" fill="none" opacity=".7"/>
    <g class="a-float"><circle cx="232" cy="140" r="9" fill="#d8ff9a" class="a-flicker"/>
      <circle cx="232" cy="140" r="28" fill="#a6f07a" opacity=".18" class="a-glow"/>
      <circle cx="232" cy="140" r="56" fill="#a6f07a" opacity=".06" class="a-glow"/></g>
    ${[[70, 120, 0], [300, 90, 1.2], [110, 200, 2.4], [356, 180, 0.6]].map(([x, y, d]) => `<g class="a-blink" style="animation-delay:${d}s">
      <circle cx="${x}" cy="${y}" r="3" fill="#ffd34d"/><circle cx="${x + 10}" cy="${y}" r="3" fill="#ffd34d"/></g>`).join('')}
    <path d="M0 270 Q60 250 120 266 T240 260 T400 268 V300 H0Z" fill="#050c0a"/>
    ${[40, 180, 330].map((x, i) => `<path d="M${x} 276 c-10 -20 -2 -30 0 -40 c2 10 10 20 0 40" fill="#0f2a1c" class="a-sway" style="animation-delay:${i}s"/>`).join('')}`),

  nocAlba: () => svg(`${sky('noc-alba', '#2a2350', '#e89a6a')}
    <circle cx="300" cy="214" r="40" fill="#ffd38a" class="a-glow"/>
    <path d="M0 210 Q90 186 190 204 T400 196 V300 H0Z" fill="#3a2c3e"/>
    <path d="M0 244 Q120 230 220 244 T400 238 V300 H0Z" fill="#6a8aa8"/>
    <path d="M250 250 h90 M268 260 h56 M282 270 h28" stroke="#ffe2b0" stroke-width="3" opacity=".6" class="a-twinkle"/>
    ${walnut(110, 236, 0.8, '#1e1626')}
    <path d="M0 280 Q200 266 400 282 V300 H0Z" fill="#2a3a2a"/>
    ${[[230, 272], [180, 280]].map(([x, y], i) => `<g fill="#2a1d14" class="a-sway" style="animation-delay:${i * 1.5}s">
      <ellipse cx="${x}" cy="${y - 14}" rx="18" ry="8"/><path d="M${x + 14} ${y - 18} l12 -10 l4 4 l-8 10z"/>
      <path d="M${x - 12} ${y - 8} v12 M${x - 4} ${y - 8} v12 M${x + 6} ${y - 8} v12 M${x + 12} ${y - 8} v12" stroke="#2a1d14" stroke-width="2.5"/></g>`).join('')}
    ${[[60, 200], [160, 190], [320, 180]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="60" ry="6" fill="#ffffff" opacity=".12" class="a-smoke" style="animation-delay:${i}s"/>`).join('')}`),
};
