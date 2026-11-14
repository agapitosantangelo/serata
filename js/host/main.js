// Host screen: room, players, phone protocol, lobby and story runner.
/* global qrcode */
import { createHost } from '../net.js';
import { el, $, safeName, safeAvatar } from '../dom.js';
import { initFx, setFxMode, confettiBurst, flash, unlockAudio, play, toggleMute } from '../fx.js';
import { art } from '../art.js';
import { createUI } from './ui.js';
import * as scenes from './scenes.js';
import { STORIES } from '../stories/index.js';

const ROOM_KEY = 'serata.host.room';
const COLLECT_GRACE_MS = 700;
const MAX_TEXT = 100;
const LOBBY_SCREEN = { kind: 'wait', icon: '🎲', text: 'Sei dentro! Aspetta che si scelga il gioco sullo schermo.' };

let players = [];
const connByPid = new Map();
const pidByConn = new Map();
const lastScreen = new Map();
let cards = new Map();
let net = null;
let roomCode = null;
let theme = 'lobby';
let pending = null;
let advanceWaiter = null;
let sidCounter = 0;
let running = false;
const ui = createUI();

// ---------- players ----------
const active = () => players.filter((p) => p.connected);
const playerById = (pid) => players.find((p) => p.pid === pid);
const vipPid = () => active()[0]?.pid ?? null;

function updatePlayer(pid, patch) {
  players = players.map((p) => (p.pid === pid ? { ...p, ...patch } : p));
}

function sendRaw(pid, msg) {
  const conn = connByPid.get(pid);
  if (conn) net.send(conn, msg);
}

function sendScreen(pid, screen) {
  if (!screen.sid) lastScreen.set(pid, screen);
  const p = playerById(pid);
  if (!p) return;
  sendRaw(pid, { t: 'screen', s: { ...screen, theme, me: { name: p.name, avatar: p.avatar, score: p.score } } });
}

function sendAdvanceControl() {
  const sid = advanceWaiter?.sid ?? null;
  const vip = vipPid();
  for (const p of active()) sendRaw(p.pid, { t: 'adv', sid, vip: p.pid === vip });
}

function resendState(pid) {
  const p = playerById(pid);
  const card = cards.get(pid);
  if (card) sendRaw(pid, { t: 'card', card });
  if (pending?.targets.has(pid) && !pending.answers.has(pid)) {
    const remaining = Math.max(3, Math.round(pending.time - (performance.now() - pending.sentAt) / 1000));
    sendScreen(pid, { ...pending.screenFor(p), time: remaining });
  } else if (pending?.answers.has(pid)) {
    sendScreen(pid, { kind: 'wait', icon: '✅', text: 'Risposta inviata!' });
  } else {
    sendScreen(pid, lastScreen.get(pid) ?? LOBBY_SCREEN);
  }
  sendAdvanceControl();
}

// ---------- network ----------
function onMessage(conn, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'hello') { onHello(conn, msg); return; }
  const pid = pidByConn.get(conn);
  if (!pid) return;
  if (msg.t === 'answer') onAnswer(pid, msg);
  else if (msg.t === 'advance' && advanceWaiter && msg.sid === advanceWaiter.sid && pid === vipPid()) advanceWaiter.done();
}

function onHello(conn, msg) {
  const pid = String(msg.pid ?? '').slice(0, 40);
  if (!pid) return;
  const name = safeName(msg.name);
  const avatar = safeAvatar(msg.avatar);
  const previous = connByPid.get(pid);
  if (previous && previous !== conn) {
    pidByConn.delete(previous);
    try { previous.close(); } catch { /* already closed */ }
  }
  connByPid.set(pid, conn);
  pidByConn.set(conn, pid);
  if (playerById(pid)) {
    updatePlayer(pid, { name, avatar, connected: true });
  } else {
    players = [...players, { pid, name, avatar, score: 0, connected: true }];
    play('pop');
  }
  net.send(conn, { t: 'welcome', theme });
  renderRoster();
  renderLobbyPlayers();
  resendState(pid);
}

function onDisconnect(conn) {
  const pid = pidByConn.get(conn);
  pidByConn.delete(conn);
  if (!pid || connByPid.get(pid) !== conn) return;
  connByPid.delete(pid);
  updatePlayer(pid, { connected: false });
  renderRoster();
  renderLobbyPlayers();
  sendAdvanceControl();
  checkComplete();
}

function sanitizeValue(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, MAX_TEXT);
  return null;
}

// ---------- collecting answers ----------
function collect({ time = 20, screen, screenFor, players: subset }) {
  const targets = (subset ?? active()).map((p) => p.pid);
  const sid = ++sidCounter;
  return new Promise((resolve) => {
    const answers = new Map();
    const countdown = ui.timer(time);
    let timeout = null;
    const finish = () => {
      if (pending?.sid !== sid) return;
      clearTimeout(timeout);
      countdown.stop();
      pending = null;
      hideAdvance();
      markRoster(null);
      resolve({ answers, targets });
    };
    timeout = setTimeout(finish, time * 1000 + 400);
    pending = {
      sid, time, answers, finish, sentAt: performance.now(), targets: new Set(targets),
      screenFor: (p) => ({ ...(screenFor ? screenFor(p) : screen), sid, time }),
    };
    for (const p of active()) {
      if (pending.targets.has(p.pid)) sendScreen(p.pid, pending.screenFor(p));
      else sendScreen(p.pid, { kind: 'wait', icon: '⏳', text: 'Tocca agli altri… guarda lo schermo!' });
    }
    markRoster(pending);
    showAdvance('Chiudi il tempo ⏭', finish);
    checkComplete();
  });
}

function onAnswer(pid, msg) {
  if (!pending || msg.sid !== pending.sid || !pending.targets.has(pid) || pending.answers.has(pid)) return;
  pending.answers.set(pid, { value: sanitizeValue(msg.value), ms: performance.now() - pending.sentAt });
  sendScreen(pid, { kind: 'wait', icon: '✅', text: 'Risposta inviata! Aspetta gli altri…' });
  play('pop');
  markRoster(pending);
  checkComplete();
}

function checkComplete() {
  if (!pending) return;
  const waiting = [...pending.targets].filter((pid) => playerById(pid)?.connected && !pending.answers.has(pid));
  if (waiting.length === 0) setTimeout(pending.finish, COLLECT_GRACE_MS);
}

// ---------- advancing ----------
function advance({ label = 'Avanti ▶', phone, until } = {}) {
  const sid = ++sidCounter;
  return new Promise((resolve) => {
    const done = () => {
      if (advanceWaiter?.sid !== sid) return;
      advanceWaiter = null;
      hideAdvance();
      sendAdvanceControl();
      resolve();
    };
    advanceWaiter = { sid, done };
    if (phone) for (const p of active()) sendScreen(p.pid, { kind: 'wait', icon: '👀', text: phone });
    showAdvance(label, done);
    sendAdvanceControl();
    until?.then(done);
  });
}

let advanceHandler = null;
function showAdvance(label, handler) {
  const btn = $('#advance');
  btn.textContent = label;
  btn.hidden = false;
  advanceHandler = handler;
}
function hideAdvance() {
  $('#advance').hidden = true;
  advanceHandler = null;
}

// ---------- rendering ----------
function renderRoster() {
  const vip = vipPid();
  $('#roster').replaceChildren(...players.map((p) => el('div', {
    class: `chip ${p.connected ? '' : 'is-offline'}`, 'data-pid': p.pid, title: p.connected ? '' : 'disconnesso',
  }, el('span', { class: 'chip__avatar' }, p.avatar), el('span', { class: 'chip__name' }, p.pid === vip ? `👑 ${p.name}` : p.name),
  el('span', { class: 'chip__score' }, p.score.toLocaleString('it-IT')))));
  markRoster(pending);
}

function markRoster(state) {
  for (const chip of $('#roster').children) {
    const pid = chip.dataset.pid;
    chip.classList.toggle('is-waiting', Boolean(state?.targets.has(pid) && !state.answers.has(pid)));
    chip.classList.toggle('is-answered', Boolean(state?.answers.has(pid)));
  }
}

function renderHud(content) {
  $('#hud').replaceChildren(...(content == null ? [] : [content]));
}

function joinUrl() {
  return new URL(`play.html?r=${roomCode}`, window.location.href).href;
}

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

function renderJoinMini() {
  const box = $('#joinMini');
  if (!roomCode || theme === 'lobby') { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren(el('div', { class: 'join-mini__qr', svg: qrSvg(joinUrl()) }), el('div', {}, el('small', {}, 'Entra col codice'), el('b', {}, roomCode)));
}

function renderLobbyPlayers() {
  // The previous lobby may still be fading out: update every copy.
  const list = active();
  for (const box of document.querySelectorAll('#stage .lobby__players')) {
    box.replaceChildren(...(list.length
      ? list.map((p) => el('div', { class: 'lobby-player' }, el('span', { class: 'lobby-player__avatar' }, p.avatar), el('span', {}, p.name)))
      : [el('p', { class: 'muted' }, 'Ancora nessuno… scansionate il QR!')]));
  }
}

function storyCard(story) {
  return el('button', { class: 'story-card', onclick: () => startStory(story) },
    el('div', { class: 'story-card__art', svg: art(story.cover) }),
    el('div', { class: 'story-card__body' },
      el('h3', {}, story.title),
      el('p', {}, story.blurb),
      el('small', {}, `${story.minPlayers}+ giocatori · circa ${story.minutes} min`)));
}

function renderLobby() {
  setTheme('lobby');
  renderHud(null);
  const joinBox = roomCode
    ? el('div', { class: 'lobby__join panel' },
      el('div', { class: 'lobby__qr', svg: qrSvg(joinUrl()) }),
      el('div', { class: 'lobby__code' }, 'Codice stanza ', el('b', {}, roomCode)),
      el('div', { class: 'lobby__url' }, joinUrl().replace(/^https?:\/\//, '')))
    : el('div', { class: 'lobby__join panel' }, el('div', { class: 'lobby__connecting' }, 'Apro la stanza…'));
  const body = el('div', { class: 'lobby' }, joinBox,
    el('div', { class: 'lobby__right' },
      el('h2', {}, 'Giocatori'), el('div', { class: 'lobby__players' }),
      el('h2', {}, 'Scegli il gioco'), el('div', { class: 'story-cards' }, STORIES.map(storyCard))));
  ui.show({ kicker: 'Inquadrate il QR con la fotocamera del telefono', title: 'Serata 🎲', body, layout: 'center' });
  renderLobbyPlayers();
  for (const p of active()) sendScreen(p.pid, LOBBY_SCREEN);
}

function setTheme(next) {
  theme = next;
  document.body.dataset.theme = next;
  setFxMode(next);
  renderJoinMini();
}

// ---------- story runner ----------
function makeCtx(story) {
  const ctx = {
    story, ui, rng: Math.random, state: {},
    sfx: play, confetti: confettiBurst, flash,
    players: () => players.slice(),
    active,
    player: (pid) => playerById(pid),
    setState(patch) {
      ctx.state = { ...ctx.state, ...patch };
      renderHud(story.hud?.(ctx) ?? null);
    },
    addPoints(pid, n) {
      if (!n) return;
      const p = playerById(pid);
      if (p) { updatePlayer(pid, { score: p.score + n }); renderRoster(); }
    },
    send: sendScreen,
    sendCard(pid, card) {
      cards = new Map(cards).set(pid, card);
      sendRaw(pid, { t: 'card', card });
    },
    collect,
    advance,
  };
  return ctx;
}

async function startStory(story) {
  unlockAudio();
  if (running) return;
  if (active().length < story.minPlayers) {
    ui.banner(`Servono almeno ${story.minPlayers} giocatori connessi`, 'bad', 2200);
    return;
  }
  running = true;
  players = players.map((p) => ({ ...p, score: 0 }));
  cards = new Map();
  for (const p of players) sendRaw(p.pid, { t: 'card', card: null });
  setTheme(story.theme);
  renderRoster();
  const ctx = makeCtx(story);
  ctx.setState(story.initialState?.() ?? {});
  let id = story.start;
  try {
    while (id && id !== 'END') {
      const scene = story.scenes[id];
      if (!scene) throw new Error(`Scena mancante: ${id}`);
      const next = scene.type === 'custom' ? await scene.run(ctx, scene) : await scenes[scene.type](scene, ctx);
      id = story.guard?.(ctx, next) ?? next;
    }
  } catch (err) {
    console.error('Errore nella storia', err);
    await ui.banner('Ops, qualcosa è andato storto 😵 Torniamo alla lobby', 'bad', 2600);
  }
  running = false;
  pending = null;
  advanceWaiter = null;
  hideAdvance();
  $('#timer').replaceChildren();
  renderLobby();
}

// ---------- boot ----------
function boot() {
  initFx($('#fx'));
  $('#advance').addEventListener('click', () => advanceHandler?.());
  document.addEventListener('keydown', (e) => {
    if (['Space', 'Enter', 'ArrowRight'].includes(e.code) && advanceHandler && !e.target.closest('input,textarea')) {
      e.preventDefault();
      advanceHandler();
    }
  });
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  $('#mute').addEventListener('click', () => { $('#mute').textContent = toggleMute() ? '🔇' : '🔊'; });
  $('#fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });
  renderLobby();
  net = createHost({
    preferredCode: sessionStorage.getItem(ROOM_KEY),
    onOpen(code) {
      roomCode = code;
      sessionStorage.setItem(ROOM_KEY, code);
      if (!running) renderLobby();
      renderJoinMini();
    },
    onMessage,
    onDisconnect,
    onStatus(status, err) {
      $('#netStatus').textContent = { online: '🟢', reconnecting: '🟠', error: '🔴' }[status] ?? '';
      $('#netStatus').title = err ? `Errore di rete: ${err.type}` : status;
      if (status === 'error') console.error('PeerJS', err);
    },
  });
}

boot();
