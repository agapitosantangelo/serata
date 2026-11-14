// Phone controller: join a room, render whatever screen the host sends, send answers back.
import { joinRoom } from '../net.js';
import { el, $, sleep, AVATARS, safeName, safeAvatar, vibrate } from '../dom.js';
import { initFx, setFxMode } from '../fx.js';

const PID_KEY = 'serata.pid';
const JOINED_KEY = 'serata.joined';
const NAME_KEY = 'serata.name';
const AVATAR_KEY = 'serata.avatar';
const MAX_TEXT = 80;
const LETTERS = ['A', 'B', 'C', 'D'];

const screenRoot = $('#screen');
let net = null;
let code = '';
let me = { name: '', avatar: AVATARS[0] };
let card = null;
let currentTheme = '';
let countdownTimer = null;

function storage(kind) {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
}
function getItem(kind, key) { try { return storage(kind)?.getItem(key) ?? null; } catch { return null; } }
function setItem(kind, key, value) { try { storage(kind)?.setItem(key, value); } catch { /* private mode */ } }

function playerId() {
  let pid = getItem('session', PID_KEY);
  if (!pid) {
    pid = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9-]/gi, '').slice(0, 36);
    setItem('session', PID_KEY, pid);
  }
  return pid;
}

function setTheme(theme) {
  if (!theme || theme === currentTheme) return;
  currentTheme = theme;
  document.body.dataset.theme = theme;
  setFxMode(theme);
}

function show(...nodes) {
  screenRoot.replaceChildren(el('div', { class: 'view' }, ...nodes));
}

// ---------- join flow ----------
function renderCodeEntry(error) {
  const input = el('input', { class: 'field field--code', maxlength: '4', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'ABCD', 'aria-label': 'Codice stanza' });
  const go = () => {
    const value = input.value.toUpperCase().replace(/[^A-Z]/g, '');
    if (value.length !== 4) { input.classList.add('is-error'); return; }
    code = value;
    history.replaceState(null, '', `?r=${code}`);
    renderJoinForm();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  show(el('h1', { class: 'logo' }, '🎲 Serata Giochi'),
    el('p', {}, error ?? 'Scrivi il codice che vedi sullo schermo'),
    input, el('button', { class: 'btn btn--big', onclick: go }, 'Continua'));
  input.focus();
}

function renderJoinForm() {
  let avatar = safeAvatar(getItem('local', AVATAR_KEY) ?? AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const name = el('input', { class: 'field', maxlength: '16', placeholder: 'Il tuo nome', value: getItem('local', NAME_KEY) ?? '', autocomplete: 'nickname', 'aria-label': 'Nome' });
  const grid = el('div', { class: 'avatar-grid' }, AVATARS.map((a) => el('button', {
    class: `avatar-btn ${a === avatar ? 'is-selected' : ''}`, 'aria-label': `Avatar ${a}`,
    onclick: (e) => {
      avatar = a;
      grid.querySelectorAll('.avatar-btn').forEach((b) => b.classList.remove('is-selected'));
      e.currentTarget.classList.add('is-selected');
    },
  }, a)));
  const join = () => {
    const clean = safeName(name.value);
    if (!name.value.trim()) { name.classList.add('is-error'); name.focus(); return; }
    me = { name: clean, avatar };
    setItem('local', NAME_KEY, clean);
    setItem('local', AVATAR_KEY, avatar);
    setItem('session', JOINED_KEY, JSON.stringify({ code, ...me }));
    connect();
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  show(el('h1', { class: 'logo' }, '🎲 Serata Giochi'),
    el('p', { class: 'muted' }, `Stanza ${code}`),
    name, el('p', { class: 'label' }, 'Scegli il tuo avatar'), grid,
    el('button', { class: 'btn btn--big', onclick: join }, 'Entra nel gioco'));
}

function connect() {
  show(el('div', { class: 'big-icon spin' }, '🎲'), el('p', {}, 'Mi collego allo schermo…'));
  net = joinRoom({
    code,
    onOpen: () => net.send({ t: 'hello', pid: playerId(), name: me.name, avatar: me.avatar }),
    onMessage,
    onStatus: renderStatus,
  });
}

// Phones on mobile data often can't reach the host directly (no public TURN relay is available):
// after a while, suggest switching to the home Wi-Fi.
const SLOW_CONNECT_MS = 12000;
const WIFI_HINT = 'Se sei in 4G/5G, collegati al Wi‑Fi dello schermo e ricarica la pagina.';
let slowTimer = null;
let isSlow = false;
let lastStatus = null;

function renderStatus(status) {
  lastStatus = status;
  const box = $('#status');
  const text = {
    connecting: 'Connessione…',
    lost: 'Connessione persa, riprovo…',
    noroom: `Stanza ${code} non trovata. Controlla il codice sullo schermo… riprovo`,
  }[status];
  if (status === 'open') {
    clearTimeout(slowTimer);
    slowTimer = null;
    isSlow = false;
  } else if (!slowTimer && !isSlow) {
    slowTimer = setTimeout(() => { isSlow = true; slowTimer = null; renderStatus(lastStatus); }, SLOW_CONNECT_MS);
  }
  box.hidden = !text;
  box.textContent = text ? `${text}${isSlow ? ` ${WIFI_HINT}` : ''}` : '';
}

// ---------- messages from host ----------
function onMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'welcome') { setTheme(msg.theme); renderMe(); }
  else if (msg.t === 'screen') renderScreen(msg.s);
  else if (msg.t === 'card') setCard(msg.card);
  else if (msg.t === 'adv') renderAdvance(msg);
}

function renderMe(score) {
  $('#me').hidden = false;
  $('#meAvatar').textContent = me.avatar;
  $('#meName').textContent = me.name;
  if (score != null) $('#meScore').textContent = `${score.toLocaleString('it-IT')} pt`;
}

function renderAdvance({ sid, vip }) {
  const btn = $('#advBtn');
  btn.hidden = !(sid && vip);
  btn.onclick = () => { net.send({ t: 'advance', sid }); btn.hidden = true; vibrate(20); };
}

function setCard(next) {
  const isNew = next && JSON.stringify(next) !== JSON.stringify(card);
  card = next;
  $('#cardBtn').hidden = !card;
  if (isNew) { vibrate([60, 40, 60]); openCard(); }
  if (!card) $('#cardOverlay').hidden = true;
}

function openCard() {
  if (!card) return;
  const overlay = $('#cardOverlay');
  overlay.replaceChildren(el('div', { class: `secret-card secret-card--${card.tone ?? 'info'}` },
    el('h2', {}, card.title),
    el('ul', {}, (card.lines ?? []).map((line) => el('li', {}, line))),
    el('button', { class: 'btn', onclick: () => { overlay.hidden = true; } }, 'Nascondi')));
  overlay.hidden = false;
}

function startCountdown(seconds) {
  const bar = $('#countdown');
  clearTimeout(countdownTimer);
  if (!seconds) { bar.hidden = true; return; }
  bar.hidden = false;
  const fill = bar.firstElementChild;
  fill.style.transition = 'none';
  fill.style.width = '100%';
  void fill.offsetWidth;
  fill.style.transition = `width ${seconds}s linear`;
  fill.style.width = '0%';
  countdownTimer = setTimeout(() => { bar.hidden = true; }, seconds * 1000);
}

function answer(sid, value) {
  vibrate(25);
  const sent = net.send({ t: 'answer', sid, value });
  if (!sent) renderStatus('lost');
}

function lockButtons(container, chosen) {
  container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  chosen.classList.add('is-chosen');
}

const RENDERERS = {
  wait: (s) => [el('div', { class: 'big-icon float' }, s.icon ?? '👀'), el('p', { class: 'wait-text' }, s.text ?? '')],

  choice: (s) => {
    const list = el('div', { class: `choices choices--${s.style}` }, s.options.map((text, i) => el('button', {
      class: `choice opt-${i}`,
      onclick: (e) => { lockButtons(list, e.currentTarget); answer(s.sid, i); },
    }, s.style === 'quiz' ? el('span', { class: 'letter' }, LETTERS[i]) : null, el('span', {}, text))));
    return [el('h2', { class: 'q-title' }, s.title), s.text ? el('p', { class: 'choice-text' }, s.text) : null, list];
  },

  players: (s) => {
    const grid = el('div', { class: 'player-grid' }, s.options.map((p) => el('button', {
      class: 'player-btn',
      onclick: (e) => { lockButtons(grid, e.currentTarget); answer(s.sid, p.pid); },
    }, el('span', { class: 'player-btn__avatar' }, p.avatar), el('span', {}, p.name))));
    return [el('h2', { class: 'q-title' }, s.title), grid];
  },

  text: (s) => {
    const max = Math.min(s.max ?? MAX_TEXT, MAX_TEXT);
    const single = max <= 30;
    const area = single
      ? el('input', { class: 'field', maxlength: String(max), placeholder: s.placeholder ?? '', autocomplete: 'off', enterkeyhint: 'send' })
      : el('textarea', { class: 'field field--area', maxlength: String(max), placeholder: s.placeholder ?? '', rows: '3' });
    const counter = el('span', { class: 'counter' }, `0/${max}`);
    const send = el('button', {
      class: 'btn btn--big',
      onclick: () => {
        const value = area.value.trim();
        if (!value) { area.classList.add('is-error'); return; }
        send.disabled = true;
        area.disabled = true;
        answer(s.sid, value.slice(0, max));
      },
    }, 'Invia');
    area.addEventListener('input', () => { counter.textContent = `${area.value.length}/${max}`; });
    if (single) area.addEventListener('keydown', (e) => { if (e.key === 'Enter') send.click(); });
    setTimeout(() => area.focus(), 50);
    return [el('h2', { class: 'q-title' }, s.title), area, counter, send];
  },

  rate: (s) => {
    const list = el('div', { class: 'choices choices--vote' }, s.options.map((o) => el('button', {
      class: 'choice choice--text',
      onclick: (e) => { lockButtons(list, e.currentTarget); answer(s.sid, o.id); },
    }, `“${o.text}”`)));
    return [el('h2', { class: 'q-title' }, s.title), list];
  },

  dice: (s) => {
    const face = el('span', { class: 'die-btn__face' }, '20');
    const btn = el('button', {
      class: 'die-btn',
      onclick: async () => {
        btn.disabled = true;
        btn.classList.add('rolling');
        vibrate([30, 30, 30, 30, 30]);
        const value = 1 + Math.floor(Math.random() * 20);
        for (let i = 0; i < 14; i++) { face.textContent = String(1 + Math.floor(Math.random() * 20)); await sleep(70); }
        face.textContent = String(value);
        btn.classList.remove('rolling');
        answer(s.sid, value);
      },
    }, face);
    return [el('h2', { class: 'q-title' }, s.title), btn, el('p', { class: 'muted' }, 'Tocca il dado per lanciarlo!')];
  },

  result: (s) => {
    vibrate(s.good ? 40 : [80, 50, 80]);
    return [
      el('div', { class: `result-icon ${s.good ? 'is-good' : 'is-bad'}` }, s.good ? '✔' : '✖'),
      el('h2', {}, s.title ?? ''),
      s.points ? el('div', { class: `points ${s.points < 0 ? 'is-negative' : ''}` }, `${s.points > 0 ? '+' : ''}${s.points.toLocaleString('it-IT')}`) : null,
      s.text ? el('p', { class: 'muted' }, s.text) : null,
    ];
  },

  end: (s) => {
    vibrate([50, 50, 150]);
    return [
      el('div', { class: 'big-icon float' }, ['🥇', '🥈', '🥉'][s.rank - 1] ?? '🎉'),
      el('h2', {}, s.title),
      el('p', { class: 'wait-text' }, `Sei arrivato ${s.rank}° su ${s.of}`),
      el('div', { class: 'points' }, `${s.score.toLocaleString('it-IT')} punti`),
    ];
  },
};

function renderScreen(s) {
  if (!s) return;
  setTheme(s.theme);
  if (s.me) { me = { name: s.me.name, avatar: s.me.avatar }; renderMe(s.me.score); }
  startCountdown(s.sid ? s.time : 0);
  const render = RENDERERS[s.kind] ?? RENDERERS.wait;
  show(...render(s));
}

// ---------- boot ----------
function boot() {
  initFx($('#fx'));
  setFxMode('lobby');
  $('#cardBtn').addEventListener('click', openCard);
  const params = new URLSearchParams(window.location.search);
  code = (params.get('r') ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (code.length !== 4) { renderCodeEntry(); return; }
  try {
    const saved = JSON.parse(getItem('session', JOINED_KEY) ?? 'null');
    if (saved?.code === code) {
      me = { name: safeName(saved.name), avatar: safeAvatar(saved.avatar) };
      connect();
      return;
    }
  } catch { /* corrupt session data: ask again */ }
  renderJoinForm();
}

boot();
