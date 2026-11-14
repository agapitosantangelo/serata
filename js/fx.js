// Visual and sound effects: themed canvas background, confetti, lightning, WebAudio sfx.

const CONFETTI_COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ffffff'];
const BOKEH_COLORS = {
  lobby: ['#7b5cff', '#ff4fb8', '#33d6ff'],
  quiz: ['#ff2fb3', '#26e3ff', '#ffd400'],
};

let canvas = null;
let g = null;
let mode = 'lobby';
let particles = [];
let confetti = [];
let width = 0;
let height = 0;
let nextLightning = 0;
let reduceMotion = false;

export function initFx(target) {
  canvas = target;
  g = canvas.getContext('2d');
  reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
}

export function setFxMode(next) {
  mode = next;
  particles = [];
  nextLightning = performance.now() + 4000;
}

const rand = (a, b) => a + Math.random() * (b - a);

function spawn() {
  const target = { giallo: 260, fantasy: 90, quiz: 26, lobby: 22 }[mode] ?? 0;
  const scaled = reduceMotion ? Math.round(target / 4) : target;
  while (particles.length < scaled) {
    if (mode === 'giallo') {
      particles.push({ x: rand(-100, width), y: rand(-height, 0), len: rand(10, 24), v: rand(9, 15) });
    } else if (mode === 'fantasy') {
      particles.push({ x: rand(0, width), y: height + rand(0, height), r: rand(1, 3.2), vy: rand(0.4, 1.4), vx: rand(-0.3, 0.3), ph: rand(0, 6.28) });
    } else {
      const colors = BOKEH_COLORS[mode] ?? BOKEH_COLORS.lobby;
      particles.push({ x: rand(0, width), y: rand(0, height), r: rand(30, 120), vx: rand(-0.25, 0.25), vy: rand(-0.2, 0.2), c: colors[particles.length % colors.length], a: rand(0.05, 0.16) });
    }
  }
}

function drawRain() {
  g.strokeStyle = 'rgba(170,190,225,0.32)';
  g.lineWidth = 1;
  g.beginPath();
  for (const p of particles) {
    g.moveTo(p.x, p.y);
    g.lineTo(p.x + p.len * 0.25, p.y + p.len);
    p.x += p.v * 0.25;
    p.y += p.v;
    if (p.y > height) { p.y = rand(-60, 0); p.x = rand(-100, width); }
  }
  g.stroke();
  const now = performance.now();
  if (now > nextLightning) {
    nextLightning = now + rand(9000, 20000);
    flash();
    setTimeout(() => play('thunder'), rand(300, 1200));
  }
}

function drawEmbers(t) {
  g.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const flicker = 0.55 + 0.45 * Math.sin(t / 180 + p.ph);
    g.fillStyle = `rgba(255,${Math.round(120 + 60 * flicker)},40,${0.55 * flicker})`;
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.fill();
    p.y -= p.vy;
    p.x += p.vx + Math.sin(t / 900 + p.ph) * 0.3;
    if (p.y < -10) { p.y = height + 10; p.x = rand(0, width); }
  }
  g.globalCompositeOperation = 'source-over';
}

function drawBokeh() {
  for (const p of particles) {
    const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    grad.addColorStop(0, hexA(p.c, p.a));
    grad.addColorStop(1, hexA(p.c, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.fill();
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -p.r) p.x = width + p.r;
    if (p.x > width + p.r) p.x = -p.r;
    if (p.y < -p.r) p.y = height + p.r;
    if (p.y > height + p.r) p.y = -p.r;
  }
}

function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function drawConfetti() {
  confetti = confetti.filter((c) => c.y < height + 40 && c.life > 0);
  for (const c of confetti) {
    c.vy += 0.18;
    c.vx *= 0.99;
    c.x += c.vx;
    c.y += c.vy;
    c.rot += c.vr;
    c.life -= 1;
    g.save();
    g.translate(c.x, c.y);
    g.rotate(c.rot);
    g.fillStyle = c.color;
    g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(c.rot * 2)));
    g.restore();
  }
}

function loop(t) {
  g.clearRect(0, 0, width, height);
  spawn();
  if (mode === 'giallo') drawRain();
  else if (mode === 'fantasy') drawEmbers(t);
  else drawBokeh();
  drawConfetti();
  requestAnimationFrame(loop);
}

export function confettiBurst(count = 160) {
  if (reduceMotion) count = Math.round(count / 4);
  for (let i = 0; i < count; i++) {
    const fromLeft = i % 2 === 0;
    confetti.push({
      x: fromLeft ? rand(0, width * 0.15) : rand(width * 0.85, width),
      y: height * rand(0.55, 0.8),
      vx: (fromLeft ? 1 : -1) * rand(3, 11),
      vy: rand(-17, -8),
      w: rand(6, 11), h: rand(8, 16),
      rot: rand(0, 6.28), vr: rand(-0.2, 0.2),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      life: 260,
    });
  }
}

export function flash() {
  document.body.classList.remove('flash');
  void document.body.offsetWidth;
  document.body.classList.add('flash');
}

// ---------- Sound (synthesised, no audio files) ----------
let audio = null;
let muted = false;

export function unlockAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone(freq, dur, { type = 'sine', vol = 0.18, slide = 0, delay = 0 } = {}) {
  const t0 = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur, { vol = 0.3, cutoff = 900, delay = 0 } = {}) {
  const t0 = audio.currentTime + delay;
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(t0);
}

const SFX = {
  pop: () => tone(660, 0.09, { type: 'triangle', vol: 0.12, slide: 300 }),
  tick: () => tone(1200, 0.04, { type: 'square', vol: 0.05 }),
  whoosh: () => noise(0.5, { vol: 0.12, cutoff: 1800 }),
  ding: () => { tone(880, 0.25, { type: 'triangle' }); tone(1320, 0.4, { type: 'triangle', delay: 0.1 }); },
  buzz: () => tone(140, 0.45, { type: 'sawtooth', vol: 0.12, slide: -60 }),
  drum: () => { for (let i = 0; i < 14; i++) noise(0.08, { vol: 0.12 + i * 0.012, cutoff: 500, delay: i * 0.09 }); },
  reveal: () => { tone(196, 0.6, { type: 'sawtooth', vol: 0.1 }); tone(233, 0.9, { type: 'sawtooth', vol: 0.1, delay: 0.25 }); },
  thunder: () => noise(2.2, { vol: 0.35, cutoff: 260 }),
  hit: () => { noise(0.25, { vol: 0.35, cutoff: 700 }); tone(90, 0.3, { type: 'square', vol: 0.12, slide: -40 }); },
  roar: () => { noise(1.4, { vol: 0.3, cutoff: 400 }); tone(70, 1.2, { type: 'sawtooth', vol: 0.15, slide: 40 }); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', delay: i * 0.13 })),
  sad: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.45, { type: 'triangle', vol: 0.12, delay: i * 0.25 })),
  dice: () => { for (let i = 0; i < 8; i++) noise(0.04, { vol: 0.2, cutoff: 3000, delay: i * 0.07 }); },
};

export function play(name) {
  if (!audio || muted) return;
  try { SFX[name]?.(); } catch { /* audio glitches must never break the game */ }
}
