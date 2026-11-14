// L’Isola del Lazzaretto: a restoration crew stranded on a Venetian quarantine island.
// Hidden "marchiato", informers tempted by a health pass, cloaks that cover marks, tide and bonfire, 6 endings.
import { el, sleep } from '../dom.js';
import { tallyKeys, topKeys, shuffle } from '../logic.js';
import { setFlags, bump, addCardLines } from '../host/state.js';

const DISCUSS_SECONDS = { 30: 180, 60: 360 };
const BOARD_SECONDS = 45;
const TIDE_START = 1;
const TIDE_MAX = 3;
const COVER_RISK = 0.5;
const LONG_ONLY = ['likely1', 'pozzo', 'archive', 'write', 'redemption', 'likely2'];
const WHISPERS = { base: 2, archive: 3, crypt: 4 };
const POINTS = { catch: 500, wrongVote: -200, escape: 1500, touchedEscape: 1000, informerEscape: 800, forge: 300 };
const QUARANTINE_TEXT = 'Sei in quarantena nel Tezon Grande: niente più prove, ma voterai all’imbarco.';
const JOBS = ['🎨 affreschi', '📚 archivio', '🚤 la barca', '🧱 murature', '📷 fotografie', '🌿 l’orto dei semplici', '🔦 l’impianto elettrico',
  '🍝 la cucina da campo', '📐 i rilievi', '🪟 le vetrate', '🗿 le statue', '☕ i caffè (sei lo stagista)'];

const exiled = (ctx) => ctx.state.exiled ?? [];
const touched = (ctx) => ctx.state.touched ?? [];
const isMarked = (ctx, pid) => ctx.state.marked === pid;
const isIsland = (ctx, pid) => isMarked(ctx, pid) || touched(ctx).includes(pid);
const crew = (ctx) => ctx.active().filter((p) => !exiled(ctx).includes(p.pid));
const opt = ({ pid, name, avatar }) => ({ pid, name, avatar });
const randomOf = (ctx, list) => list[Math.floor(ctx.rng() * list.length)];
const nameOf = (ctx, pid) => { const p = ctx.player(pid); return p ? `${p.avatar} ${p.name}` : '…'; };
const namesOf = (ctx, pids) => pids.map((pid) => nameOf(ctx, pid)).join(' e ');
const hideArt = (ctx) => (ctx.state.flags?.hide === 'chiesa' ? 'lazChiesa' : 'lazOttagono');
const moveTide = (ctx, delta) => ctx.setState({ tide: Math.max(0, Math.min(TIDE_MAX, (ctx.state.tide ?? TIDE_START) + delta)) });
const addNote = (ctx, text, good = false) => ctx.setState({ notes: [...(ctx.state.notes ?? []), { text, good }] });

function show(ctx, art, kicker, title, text, sound) {
  ctx.ui.show({ art, kicker, title, text });
  if (sound) ctx.sfx(sound);
}

function exile(ctx, pids) {
  ctx.setState({ exiled: [...new Set([...exiled(ctx), ...pids])] });
  for (const pid of pids) ctx.send(pid, { kind: 'wait', icon: '🏚️', text: QUARANTINE_TEXT });
}

/** Everyone picks a player (as cover); only the secret pickers' answers matter. */
async function secretPick(ctx, people, secret, secretTitle, decoyTitle) {
  const { answers } = await ctx.collect({
    time: 25,
    screenFor: (p) => ({ kind: 'players', title: secret.includes(p.pid) ? secretTitle : decoyTitle, options: people.filter((o) => o.pid !== p.pid).map(opt) }),
  });
  return answers;
}

// ---------- secret objectives ----------
const MARKED_OBJECTIVE = { id: 'marked', text: 'Non farti smascherare all’imbarco', check: (c) => !c.state.flags?.caught, points: 0 };
const ISLAND_OBJECTIVE = { id: 'island', text: 'Il marchiato non deve essere smascherato all’imbarco', check: (c) => !c.state.flags?.caught };
const INFORMER_OBJECTIVE = { id: 'informer', text: 'Non farti votare da nessuno all’imbarco', check: (c, pid) => !(c.state.finalVotes ?? {})[pid] };
const BOARD_OBJECTIVE = { id: 'board', text: 'Sali sulla barca all’alba', check: (c, pid) => (c.state.boarded ?? []).includes(pid) };
const OBJECTIVES = [
  BOARD_OBJECTIVE,
  { id: 'pact', text: 'Stringi un patto con qualcuno', check: (c, pid) => (c.state.stats?.[pid]?.pact ?? 0) > 0 },
  { id: 'cover', text: 'Copri qualcuno col tuo mantello quando l’isola lo marchia', check: (c, pid) => (c.state.stats?.[pid]?.cover ?? 0) > 0 },
  { id: 'clean', text: 'Nessuno deve votarti all’imbarco', check: (c, pid) => !(c.state.finalVotes ?? {})[pid] },
  { id: 'fire', text: 'All’alba il falò deve essere acceso', check: (c) => Boolean(c.state.flags?.bonfire) },
  { id: 'protect', text: 'Proteggi {X}: non deve finire in quarantena né essere trattenuto', check: (c, pid) => { const x = c.state.protectTarget?.[pid]; return !exiled(c).includes(x) && c.state.flags?.accused !== x; } },
];

function cardFor(ctx, pid) {
  const { clues, objectives, jobs } = ctx.state;
  const clue = clues[pid];
  if (isMarked(ctx, pid)) {
    return {
      tone: 'danger', title: '🖤 SEI IL MARCHIATO',
      lines: ['L’isola ti ha scelto: vuole tenere tutti qui, per sempre.', `🧰 In squadra ti occupi di: ${jobs[pid]}`,
        `Indizio FALSO da spacciare: «Ho visto una macchia sul polso di ${nameOf(ctx, clue.target)}»`,
        'Nelle prove puoi sabotare: ogni sabotaggio toglie 2 punti, e le carte del destino ti coprono.',
        'A mezzanotte sceglierai chi marchiare.', `🎯 ${objectives[pid].text}`],
    };
  }
  return {
    tone: 'secret', title: '🧰 Squadra di restauro',
    lines: [`In squadra ti occupi di: ${jobs[pid]}`,
      clue.target ? `Indizio (vero): nella nebbia hai visto che il polso di ${nameOf(ctx, clue.target)} è pulito.` : 'Nella nebbia non hai visto niente.',
      'Uno di voi è marchiato dall’isola e vuole tenervi qui per sempre.', `🎯 Obiettivo segreto: ${objectives[pid].text}`],
  };
}

function clueShare(ctx, pid) {
  const c = ctx.state.clues?.[pid];
  if (!c?.target) return 'nella nebbia non ha visto niente';
  return c.fake ? `giura di aver visto una macchia sul polso di ${nameOf(ctx, c.target)}` : `giura che il polso di ${nameOf(ctx, c.target)} è pulito`;
}

// ---------- custom scenes ----------
async function roles(ctx) {
  const pids = ctx.active().map((p) => p.pid);
  const marked = randomOf(ctx, pids);
  const deck = shuffle(OBJECTIVES, ctx.rng);
  const jobs = shuffle(JOBS, ctx.rng);
  const objectives = {};
  const protectTarget = {};
  const clues = {};
  pids.forEach((pid, i) => {
    const others = pids.filter((x) => x !== pid && x !== marked);
    clues[pid] = { target: randomOf(ctx, others), fake: pid === marked };
    const o = pid === marked ? MARKED_OBJECTIVE : deck[i % deck.length];
    if (o.id === 'protect') protectTarget[pid] = randomOf(ctx, pids.filter((x) => x !== pid));
    objectives[pid] = o.id === 'protect' ? { ...o, text: o.text.replace('{X}', ctx.player(protectTarget[pid]).name) } : o;
  });
  ctx.setState({ marked, objectives, protectTarget, clues, jobs: Object.fromEntries(pids.map((pid, i) => [pid, jobs[i % jobs.length]])) });
  for (const pid of pids) ctx.sendCard(pid, cardFor(ctx, pid));
  show(ctx, 'lazRegistro', 'Carte segrete', 'Uno di voi appartiene all’isola',
    'Leggete la carta sul telefono senza farla vedere. Ognuno ha un mestiere, un indizio e un obiettivo segreto. Uno di voi, però, porta sul polso il marchio dell’isola… e il suo indizio è falso.', 'drum');
  await ctx.advance({ phone: 'Leggi la tua carta segreta 🔒 (pulsante in basso)' });
  return ctx.state.long ? 'likely1' : 'shelter';
}

async function denounce(ctx) {
  const informers = ctx.state.turned ?? [];
  const people = crew(ctx);
  show(ctx, 'lazRegistro', 'Il registro dell’ufficiale', 'Un nome sussurrato',
    'L’ufficiale intinge la penna. Tutti, indicate sul telefono chi vi sembra più pallido stanotte. Per qualcuno di voi, però, quel dito puntato è una denuncia firmata…', 'tick');
  const answers = await secretPick(ctx, people, informers, 'Chi denunci come appestato?', 'Chi ti sembra più pallido stanotte?');
  const denouncedBy = {};
  for (const pid of informers) {
    const pick = answers.get(pid)?.value;
    const target = pick !== pid && people.some((p) => p.pid === pick) ? pick : randomOf(ctx, people.filter((p) => p.pid !== pid))?.pid;
    if (!target) continue;
    denouncedBy[pid] = target;
    addCardLines(ctx, pid, [`✍️ Hai denunciato ${nameOf(ctx, target)}.`]);
  }
  let denounced = [...new Set(Object.values(denouncedBy))];
  if (!denounced.length) denounced = [randomOf(ctx, people.filter((p) => !isMarked(ctx, p.pid)))?.pid].filter(Boolean);
  ctx.setState({ denounced, denouncedBy });
  show(ctx, 'lazUfficiale', 'Nel registro compare…', `${namesOf(ctx, denounced)}: «sospetto appestato»`,
    'Qualcuno di voi ha fatto quel nome. O forse l’ufficiale l’ha scelto da solo, col suo dito ossuto. Chi lo sa davvero, adesso, sta zitto.', 'reveal');
  ctx.flash();
  await ctx.advance({ phone: 'Guarda lo schermo 👀' });
  return 'contagiato';
}

function touch(ctx, pid) {
  ctx.setState({ touched: [...touched(ctx), pid], objectives: { ...ctx.state.objectives, [pid]: ISLAND_OBJECTIVE } });
  addCardLines(ctx, pid, ['🖤 Coprendo il marchio, l’isola ha toccato anche te. Ora stai dalla sua parte.',
    `Il marchiato è ${nameOf(ctx, ctx.state.marked)}. Da ora puoi sabotare le prove.`, `🎯 Nuovo obiettivo: ${ISLAND_OBJECTIVE.text}`]);
  addCardLines(ctx, ctx.state.marked, [`🖤 L’isola ha toccato anche ${nameOf(ctx, pid)}: ora è dalla tua parte.`]);
}

/** The marked one secretly marks a victim; others may cover them with a cloak, at the risk of being touched. */
async function midnight(ctx) {
  const next = ctx.state.long ? 'pozzo' : 'wood';
  const people = crew(ctx);
  const victims = people.filter((p) => !isIsland(ctx, p.pid));
  show(ctx, hideArt(ctx), 'Mezzanotte', 'L’isola cerca un altro nome',
    'Le campane suonano da sole. Tutti, indicate sul telefono chi avete sentito camminare nel sonno. Per uno di voi, però, quella scelta è un marchio.', 'thunder');
  const answers = await secretPick(ctx, people, [ctx.state.marked], 'Chi marchi stanotte?', 'Chi hai sentito camminare nel sonno?');
  const pick = answers.get(ctx.state.marked)?.value;
  const target = victims.find((p) => p.pid === pick) ?? randomOf(ctx, victims);
  if (!target) { await ctx.advance(); return next; }
  show(ctx, 'lazUfficiale', 'La lanterna dell’ufficiale', `${target.avatar} ${target.name} ha una macchia sul polso`,
    'Scura, a forma di chiave. L’ufficiale si avvicina con la lanterna. Qualcuno può coprire quel polso col proprio mantello… ma chi tocca il marchio rischia di prenderselo.', 'reveal');
  const { answers: covers } = await ctx.collect({
    time: 20, players: ctx.active().filter((p) => p.pid !== target.pid),
    screen: { kind: 'choice', style: 'vote', title: `Copri ${target.name} col tuo mantello?`, text: 'Così è salvo, ma il marchio potrebbe passare a te.', options: ['🧥 Copro io', '🙈 Non mi espongo'] },
  });
  const coverers = [...covers].filter(([, a]) => a.value === 0).map(([pid]) => pid);
  if (coverers.length) {
    for (const pid of coverers) bump(ctx, pid, 'cover');
    const exposed = coverers.filter((pid) => !isIsland(ctx, pid));
    if (exposed.length && ctx.rng() < COVER_RISK) touch(ctx, randomOf(ctx, exposed));
    show(ctx, 'lazUfficiale', `${coverers.length} mantell${coverers.length === 1 ? 'o' : 'i'} sul polso di ${target.name}`, 'L’ufficiale passa oltre',
      'Vede solo stoffa nera e se ne va borbottando. Ma uno dei mantelli, forse, adesso è più freddo degli altri…', 'whoosh');
  } else {
    exile(ctx, [target.pid]);
    setFlags(ctx, { stained: target.pid });
    addNote(ctx, `${nameOf(ctx, target.pid)} aveva una macchia sul polso: nessun mantello, ed è finito in quarantena.`);
    show(ctx, 'lazUfficiale', 'Nessun mantello', `${target.name} va in quarantena`,
      'L’ufficiale fa strada verso il Tezon Grande, gentile come un usciere. Chi entra voterà ancora all’imbarco, ma non farà più le prove.', 'hit');
  }
  await ctx.advance({ phone: 'Controlla la tua carta 🔒' });
  return next;
}

async function pickVote(ctx, { kicker, title, text, candidates, time }) {
  const board = ctx.ui.pickBoard(candidates);
  ctx.ui.show({ kicker, title, text, body: board, layout: 'center' });
  ctx.sfx('drum');
  const { answers } = await ctx.collect({ time, screenFor: (p) => ({ kind: 'players', title, options: candidates.filter((o) => o.pid !== p.pid).map(opt) }) });
  const valid = new Map([...answers].filter(([pid, a]) => a.value && a.value !== pid));
  const counts = tallyKeys(valid, candidates.map((p) => p.pid));
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  await sleep(2000);
  return { valid, counts, chosen: top.length === 1 ? top[0] : null };
}

function readRegister(ctx, count) {
  const readers = shuffle(crew(ctx).filter((p) => !isIsland(ctx, p.pid)), ctx.rng).slice(0, count);
  for (const r of readers) {
    const t = randomOf(ctx, ctx.players().filter((p) => p.pid !== r.pid && !isIsland(ctx, p.pid)));
    if (t) addCardLines(ctx, r.pid, [`📜 Nel registro, accanto al nome di ${t.name}, c’è scritto «sano». È pulito.`]);
  }
  const pointed = ctx.state.flags?.pointed;
  if (pointed) addNote(ctx, `Ultima riga del registro: ${nameOf(ctx, pointed)}, a inchiostro fresco. L’ufficiale ci ha preso gusto.`);
  show(ctx, 'lazRegistro', 'Il registro dei nomi', `${readers.length} di voi trovano un nome`,
    'Le pagine girano da sole fino al 1630. Qualcuno ha letto un nome che conosce, accanto alla parola «sano». Controllate la carta… e decidete se fidarvi di chi dice di averlo letto.');
}

function lanternPeek(ctx, hero) {
  const innocents = ctx.players().filter((p) => p.pid !== hero.pid && !isIsland(ctx, p.pid)).map((p) => p.pid);
  const lying = isMarked(ctx, hero.pid);
  const pair = lying ? shuffle(innocents, ctx.rng).slice(0, 2) : shuffle([ctx.state.marked, randomOf(ctx, innocents)].filter(Boolean), ctx.rng);
  addCardLines(ctx, hero.pid, [lying ? `🔦 Puoi giurare che uno tra ${namesOf(ctx, pair)} è il marchiato (è falso).` : `🔦 Alla lanterna: uno tra ${namesOf(ctx, pair)} è il marchiato.`]);
}

function lanternShow(ctx, hero) {
  const t = randomOf(ctx, ctx.players().filter((p) => p.pid !== hero.pid && !isIsland(ctx, p.pid)));
  if (!t) return;
  setFlags(ctx, { lanternShown: t.pid });
  addNote(ctx, `Alla lanterna, il polso di ${nameOf(ctx, t.pid)} è pulito.`, true);
}

/** 60 min: informers may tear up their pass; whoever they denounced leaves quarantine. */
async function redemption(ctx) {
  const informers = ctx.state.turned ?? [];
  show(ctx, 'lazChiesa', 'La campana dell’alba', 'Un’ultima possibilità',
    'La campana suona una volta sola. Chi ha in tasca un foglio che pesa può ancora strapparlo. Tutti, scegliete qualcosa sul telefono: nessuno saprà chi ha scelto cosa.', 'reveal');
  const { answers } = await ctx.collect({
    time: 20,
    screenFor: (p) => (informers.includes(p.pid)
      ? { kind: 'choice', style: 'vote', title: 'Strappi il lasciapassare?', text: 'Se lo strappi, il nome che hai denunciato viene cancellato. Se lo tieni, la barca nera ti aspetta.', options: ['📜 Lo strappo', '🎫 Lo tengo'] }
      : { kind: 'choice', style: 'vote', title: 'Senti la campana?', text: 'Scegli pure a caso: serve a confondere le acque.', options: ['🔔 Sì', '🔕 No'] }),
  });
  const torn = informers.filter((pid) => answers.get(pid)?.value === 0);
  const freed = torn.map((pid) => ctx.state.denouncedBy?.[pid]).filter((pid) => pid && exiled(ctx).includes(pid));
  const objectives = { ...ctx.state.objectives };
  for (const pid of torn.filter((x) => !isIsland(ctx, x))) objectives[pid] = { ...BOARD_OBJECTIVE, text: 'Ti sei pentito: sali sulla barca all’alba' };
  ctx.setState({ turned: informers.filter((pid) => !torn.includes(pid)), redeemed: torn, objectives, exiled: exiled(ctx).filter((pid) => !freed.includes(pid)) });
  for (const pid of torn) addCardLines(ctx, pid, ['📜 Hai strappato il lasciapassare. Niente barca nera: torni con la squadra.']);
  let text = 'Chi aveva qualcosa da strappare, se c’era, ha deciso di tenerselo stretto.';
  if (torn.length) text = freed.length ? `${namesOf(ctx, freed)} esce dalla quarantena: quel nome è stato cancellato dal registro.` : 'Un nome viene cancellato dal registro. Chi l’aveva scritto, però, resta un mistero.';
  show(ctx, 'lazChiesa', torn.length ? 'Un foglio strappato galleggia nel canale' : 'La campana tace', torn.length ? 'Qualcuno si è pentito' : 'Nessun pentimento', text, torn.length ? 'ding' : 'sad');
  await ctx.advance({ phone: 'Guarda lo schermo 👀' });
  return 'lantern';
}

async function discuss(ctx) {
  const seconds = ctx.state.discussSeconds;
  const notes = ctx.state.notes ?? [];
  ctx.ui.show({
    art: notes.length ? null : 'lazzaretto', kicker: `Consiglio all’alba · ${Math.round(seconds / 60)} minuti`, title: 'Chi è il marchiato?',
    text: 'Confrontate indizi, sussurri e patti. L’ufficiale non farà partire nessuno finché il marchiato è tra voi. E qualcuno, forse, ha già un lasciapassare in tasca…',
    body: notes.length ? el('div', { class: 'clue-list' }, notes.map((n) => ctx.ui.clueCard(n.text, n.good))) : null, layout: 'center',
  });
  ctx.sfx('reveal');
  const countdown = ctx.ui.timer(seconds);
  await ctx.advance({ label: 'Si va all’imbarco ▶', phone: 'Discutete! Riguarda la tua carta 🔒', until: sleep(seconds * 1000) });
  countdown.stop();
  return 'boarding';
}

/** Final accusation: the officer keeps the most-voted player; wrong votes cost points. Decides who boards. */
async function boarding(ctx) {
  if (ctx.state.flags?.bonfire && (ctx.state.tide ?? 0) >= TIDE_MAX) {
    setFlags(ctx, { bonfire: false, drowned: true });
    show(ctx, 'lazFalo', 'Acqua alta', 'La marea spegne il falò', 'Nella notte l’acqua è salita fino alle braci. Del vostro segnale resta un filo di fumo che nessuna barca vedrà.', 'sad');
    await ctx.advance();
  }
  const { marked } = ctx.state;
  const { valid, counts, chosen } = await pickVote(ctx, {
    kicker: 'L’imbarco', title: 'Chi è il marchiato?', candidates: ctx.players().filter((p) => ctx.state.objectives?.[p.pid]), time: BOARD_SECONDS,
    text: 'L’ufficiale lo tratterrà sull’isola. Chi vota qualcuno di pulito che viene trattenuto perde punti.',
  });
  const finalVotes = Object.fromEntries([...counts].filter(([, n]) => n > 0));
  for (const [pid, n] of Object.entries(finalVotes)) bump(ctx, pid, 'votesAgainst', n);
  const caught = chosen === marked;
  setFlags(ctx, { caught, accused: chosen });
  for (const [pid, a] of valid) {
    if (a.value === marked && !isIsland(ctx, pid)) ctx.addPoints(pid, POINTS.catch);
    else if (chosen && a.value === chosen && !caught) ctx.addPoints(pid, POINTS.wrongVote);
  }
  const turned = ctx.state.turned ?? [];
  const escaped = caught ? [] : turned.filter((pid) => pid !== chosen);
  if (!caught) {
    ctx.addPoints(marked, POINTS.escape);
    for (const pid of touched(ctx)) ctx.addPoints(pid, POINTS.touchedEscape);
    for (const pid of escaped) ctx.addPoints(pid, POINTS.informerEscape);
  }
  const everyone = ctx.players().map((p) => p.pid).filter((pid) => pid !== marked && !turned.includes(pid));
  ctx.setState({ finalVotes, escaped, boarded: caught ? (ctx.state.flags?.bonfire ? everyone : []) : escaped });
  const who = chosen ? ctx.player(chosen) : null;
  let title = 'Voti divisi: l’ufficiale non trattiene nessuno';
  if (who) title = caught ? `${who.name} ERA IL MARCHIATO!` : `${who.name} era pulito!`;
  show(ctx, 'lazUfficiale', who ? `Trattenuto: ${who.avatar} ${who.name}` : 'Nessuna maggioranza', title, '', caught ? 'fanfare' : 'thunder');
  ctx.flash();
  await ctx.advance();
  return 'finale';
}

// ---------- endings ----------
function sickLine(ctx) {
  const sick = ctx.state.denounced ?? [];
  if (!sick.length) return '';
  return ctx.state.flags?.sick === 'handed'
    ? `Chi è stato consegnato all’ufficiale (${namesOf(ctx, sick)}) vi toglierà il saluto per un po’.`
    : `Non avete consegnato nessuno: ${namesOf(ctx, sick)} ve lo ricorderà a ogni cena.`;
}

function coda(ctx) {
  const f = ctx.state.flags ?? {};
  let extra = '';
  if (f.seatThief) extra = `${nameOf(ctx, f.seatThief)} ha ancora una fede in bianco nello stivale.`;
  else if (f.scaffold) extra = 'Dei ponteggi del restauro resta cenere: il preventivo è da rifare.';
  else if (f.candles) extra = 'I ceri della chiesa hanno fatto più luce di un faro.';
  return [sickLine(ctx), extra].filter(Boolean).join(' ');
}

const ENDINGS = [
  {
    id: 'fog1630', name: 'La nebbia del 1630', art: 'lazRegistro', sad: true, title: 'Venezia, 1630',
    when: (s) => s.flags?.register === 'follow' && s.flags?.hide === 'ottagono' && s.flags?.sick === 'hidden' && !s.flags?.bonfire && !s.flags?.caught,
    text: (ctx) => `Avete seguito i nomi, nascosto ${namesOf(ctx, ctx.state.denounced ?? [])} nell’ottagono e spento ogni luce: la nebbia vi posa a Venezia. Campi deserti, campane a lutto, e sulla porta un uomo in tabarro: «Finalmente. Le vostre fedi, prego.»`,
  },
  {
    id: 'dawnAll', name: 'La barca dell’alba', art: 'lazFalo', title: 'Tutti a bordo',
    when: (s) => s.flags?.caught && s.flags?.bonfire && !(s.turned ?? []).length,
    text: (ctx) => `Il falò ha fatto il suo lavoro: all’alba una barca attracca al molo. Il marchiato resta sulla riva a salutare, finalmente in pace. ${coda(ctx)}`,
  },
  {
    id: 'dawnTraitor', name: 'Un nome di troppo', art: 'lazFalo', title: 'Tutti a bordo… quasi', when: (s) => s.flags?.caught && s.flags?.bonfire,
    text: (ctx) => `La barca arriva. Ma il barcaiolo legge l’elenco: accanto a ${namesOf(ctx, ctx.state.turned)} c’è scritto «partito nel 1630». E rema via senza aspettare. ${coda(ctx)}`,
  },
  {
    id: 'informer', name: 'Il lasciapassare', art: 'lazUfficiale', sad: true, title: 'Parte solo chi ha firmato',
    when: (s) => !s.flags?.caught && (s.escaped ?? []).length > 0,
    text: (ctx) => [`${namesOf(ctx, ctx.state.escaped)} sale sulla barca nera dell’ufficiale. A Venezia, un archivista apre il registro del Lazzaretto: c’è quel nome, a inchiostro fresco, sotto il 1630.`,
      ctx.state.flags?.register === 'closed' ? 'Bastava non richiudere quel registro.' : '', sickLine(ctx)].filter(Boolean).join(' '),
  },
  {
    id: 'guardians', name: 'I nuovi guardiani', art: 'lazzaretto', sad: true, title: 'L’isola vi tiene', when: (s) => !s.flags?.caught,
    text: (ctx) => `${ctx.state.flags?.bonfire ? 'La barca arriva, ma l’ufficiale non fa salire nessuno.' : 'Nessuna barca, nessun segnale.'} Restate: rifate gli intonaci, accendete le lanterne, tenete il registro. Ai turisti direte che è un restauro a lungo termine. ${coda(ctx)}`,
  },
  {
    id: 'wade', name: 'A piedi sulle barene', art: 'lazOttagono', title: 'Il mattino senza vele', when: () => true,
    text: (ctx) => `Il marchio si scioglie con la bruma, ma ${ctx.state.flags?.drowned ? 'l’acqua alta si è presa il falò' : 'senza falò nessuno vi ha visti'}. Con la bassa marea attraversate le barene a piedi fino a Sant’Erasmo: sporchi, stanchi, vivi. ${coda(ctx)}`,
  },
];

function roleOf(ctx, pid) {
  if (isMarked(ctx, pid)) return '🖤 Il marchiato';
  if (touched(ctx).includes(pid)) return '🖤 Toccato dall’isola (ha coperto il marchio)';
  if ((ctx.state.turned ?? []).includes(pid)) return '🎫 Il delatore (ha firmato)';
  if ((ctx.state.redeemed ?? []).includes(pid)) return '📜 Il pentito (ha strappato il foglio)';
  return `🧰 Restauro: ${ctx.state.jobs?.[pid] ?? 'squadra'}`;
}

function hud(ctx) {
  const tide = ctx.state.tide ?? TIDE_START;
  const q = exiled(ctx).length;
  return `🌊 Marea ${'▮'.repeat(tide)}${'▯'.repeat(TIDE_MAX - tide)}${ctx.state.flags?.bonfire ? ' · 🔥 Falò acceso' : ''}${q ? ` · 🏚️ ${q} in quarantena` : ''}`;
}

// ---------- scenes ----------
function pooled(flag, art, title, text, success, fail, next, tideOnFail = 0) {
  const after = (ctx, r) => { if (!r.success && tideOnFail) moveTide(ctx, tideOnFail); };
  return { type: 'pool', flag, art, title, text, success, fail, next, who: crew, after };
}

function pointAt(ctx, hero) {
  const t = randomOf(ctx, crew(ctx).filter((o) => o.pid !== hero.pid));
  if (!t) return;
  setFlags(ctx, { pointed: t.pid });
  addNote(ctx, `${hero.name} ha indicato ${t.name} all’ufficiale, che ne ha scritto il nome nel registro.`);
}

function splitAfter(ctx, outcome, a, b) {
  if (outcome === 'both-share') moveTide(ctx, -1);
  if (outcome === 'a-steals' || outcome === 'b-steals') setFlags(ctx, { seatThief: (outcome === 'a-steals' ? a : b).pid });
}

function build(length) {
  const long = length === 60;
  const hidden = (ctx) => moveTide(ctx, 1);
  const thiefText = (ctx, { thief }) => `${thief.name} piega una fede e la infila nello stivale. Con nonchalance. Quasi.`;
  const scenes = {
    intro: {
      type: 'narr', art: 'lazzaretto', kicker: 'Laguna di Venezia · ore 17:40', title: 'L’Isola del Lazzaretto', sfx: 'thunder', next: 'roles',
      text: 'Siete la squadra di restauro del vecchio lazzaretto: tre mesi di intonaci, affreschi e zanzare. Stasera la marea si è ritirata più del solito e la barca che doveva riportarvi a Venezia non è tornata. Il telefono non prende. In compenso, le campane hanno ricominciato a suonare. Da sole.',
    },
    roles: { type: 'custom', run: roles },
    likely1: { type: 'likely', art: 'lazzaretto', title: 'si perderebbe nella laguna con la bassa marea?', next: 'shelter' },
    shelter: {
      type: 'vote', art: 'lazzaretto', title: 'Dove passate la notte?', butterfly: true, next: 'barricade',
      text: 'Il sole cala dietro Venezia e la nebbia sale dalle barene. Due ripari: la chiesa del lazzaretto, con i suoi ceri, o l’ottagono, il vecchio forte sull’acqua dove si sente respirare la marea.',
      options: [{ label: '⛪ Nella chiesa, tra ceri e affreschi', set: { hide: 'chiesa' } }, { label: '🏛️ Nell’ottagono, in mezzo all’acqua', set: { hide: 'ottagono' } }],
    },
    barricade: pooled('barricadeOk', hideArt, 'Sbarrare le porte prima della nebbia',
      'Assi, sacchi di calce, un confessionale intero: bisogna chiudere ogni varco prima che la nebbia entri.',
      'Porte sbarrate. Fuori la nebbia gratta il legno, poi si stanca e se ne va.',
      (ctx, r) => `${r.sabotages ? 'Una trave è caduta al momento sbagliato. Caduta… o spinta?' : 'Troppa confusione.'} La nebbia entra, e con lei la marea sale.`, 'fede', 1),
    fede: {
      type: 'spotlight', art: 'lazUfficiale', title: 'Le fedi di sanità', who: crew, next: 'tempt',
      publicText: (ctx, p) => `Dalla nebbia esce un uomo in tabarro, con una lanterna: «Ufficiale di Sanità. Le fedi, prego.» Punta la lanterna su ${p.name}. Tutti gli altri trattengono il fiato.`,
      privateText: 'Vuole la tua fede di sanità. Tu hai solo il badge del cantiere…',
      options: [
        { label: '🪪 Mostro il badge del cantiere', effect: (ctx) => moveTide(ctx, 1), outcomeTitle: 'Lo legge. A lungo.', outcome: 'L’ufficiale gira il badge, lo annusa, lo morde. «Stampa veneziana? No.» Annota qualcosa, e la marea sale di un dito.' },
        { label: '🖋️ Ne scrivo una al volo, in latino maccheronico', effect: (ctx, p) => ctx.addPoints(p.pid, POINTS.forge), sfx: 'fanfare', outcomeTitle: '«Sanus sum, ergo parto»', outcome: 'L’ufficiale legge, annuisce gravemente e timbra. Nessuno ha capito come sia possibile, nemmeno lui.' },
        {
          label: '🫵 «Chieda a lui, l’ho visto starnutire!»', outcomeTitle: 'Un nome nel registro', effect: pointAt,
          outcome: (ctx, p) => `L’ufficiale annota con cura il nome di ${nameOf(ctx, ctx.state.flags?.pointed)}. Poi fissa a lungo ${p.name}, che fischietta.`,
        },
      ],
    },
    tempt: {
      type: 'tempt', art: 'lazUfficiale', title: 'Un foglio sotto la porta', cap: long ? 2 : 1, next: 'denounce',
      who: (ctx) => crew(ctx).filter((p) => !isMarked(ctx, p.pid)),
      publicText: 'Sotto la porta scivolano fogli piegati, sigillati con la ceralacca della Sanità. Non tutti ne ricevono uno…',
      offerTitle: 'Una fede di sanità, già firmata',
      offerText: `Un posto sulla barca nera dell’ufficiale, all’alba. In cambio, un nome: denuncia un compagno come appestato. ${long ? 'Valgono solo le prime due firme.' : 'Vale solo la prima firma.'}`,
      onAccept: (ctx, pid) => {
        ctx.setState({ objectives: { ...ctx.state.objectives, [pid]: INFORMER_OBJECTIVE } });
        addCardLines(ctx, pid, ['🎫 HAI FIRMATO: se il marchiato non viene smascherato, all’alba la barca nera ti porta via.',
          'Tra poco sceglierai chi denunciare: fallo sembrare una scelta qualunque.', `🎯 Nuovo obiettivo: ${INFORMER_OBJECTIVE.text}`]);
      },
    },
    denounce: { type: 'custom', run: denounce },
    contagiato: {
      type: 'vote', art: 'lazUfficiale', butterfly: true, next: 'midnight',
      title: (ctx) => `Consegnare ${namesOf(ctx, ctx.state.denounced ?? [])}?`,
      text: 'L’ufficiale aspetta, paziente come la laguna. Chi viene consegnato va in quarantena nel Tezon: niente più prove, ma voterà all’imbarco. Nascondere qualcuno, però, fa salire la marea.',
      options: [
        { label: '🚪 Consegnare all’ufficiale', set: { sick: 'handed' }, effect: (ctx) => exile(ctx, ctx.state.denounced ?? []) },
        { label: '⛪ Nascondere in chiesa, dietro l’altare', when: (ctx) => ctx.state.flags?.hide === 'chiesa', set: { sick: 'hidden' }, effect: hidden },
        { label: '🏛️ Nascondere nell’ottagono, tra i cannoni', when: (ctx) => ctx.state.flags?.hide === 'ottagono', set: { sick: 'hidden' }, effect: hidden },
      ],
    },
    midnight: { type: 'custom', run: midnight },
    pozzo: {
      type: 'vote', art: 'lazChiesa', title: 'Una voce dal pozzo', next: 'wood',
      text: 'Dal pozzo del chiostro sale una voce che canticchia una barcarola. Stonata, ma con molto sentimento.',
      options: [
        { label: '🪣 Calare il secchio', set: { key: true }, effect: (ctx) => ctx.ui.banner('Nel secchio: una chiave arrugginita 🗝️', 'good', 2000) },
        { label: '🪨 Coprire il pozzo con una lastra', set: { wellSealed: true }, effect: (ctx) => moveTide(ctx, -1) },
      ],
    },
    wood: pooled('woodOk', 'lazFalo', 'Legna asciutta per il falò',
      'Per farsi vedere da Venezia serve un falò. Ma sull’isola è tutto umido, perfino i fiammiferi.',
      'Una catasta di legna asciutta, in un magazzino del Seicento. Profuma di resina e di storia.',
      (ctx, r) => `${r.sabotages ? 'Qualcuno ha bagnato la legna (di proposito?).' : 'Solo rametti fradici.'} Per il falò servirà un altro modo.`, 'bonfire'),
    bonfire: {
      type: 'vote', art: 'lazFalo', title: 'Accendere il falò di segnalazione?', butterfly: true, next: long ? 'archive' : 'register',
      text: 'Un fuoco sulla riva lo vedranno da Venezia. Lo vedrà anche l’ufficiale.',
      options: [
        { label: '🔥 Accenderlo con la legna raccolta', when: (ctx) => ctx.state.flags?.woodOk, set: { bonfire: true } },
        { label: '🕯️ Accenderlo con i ceri della chiesa', when: (ctx) => ctx.state.flags?.hide === 'chiesa', set: { bonfire: true, candles: true } },
        { label: '🪵 Bruciare i ponteggi del restauro', when: (ctx) => !ctx.state.flags?.woodOk, set: { bonfire: true, scaffold: true } },
        { label: '🌑 Restare al buio: il fuoco attira l’ufficiale', set: { bonfire: false } },
      ],
    },
    archive: pooled('archiveOk', 'lazRegistro', 'L’archivio allagato',
      'L’acqua è entrata nella cancelleria. Bisogna salvare gli scatoloni prima che le carte diventino zuppa.',
      'Scatoloni in salvo. In uno c’è l’indice del registro dei nomi: leggerlo sarà più facile.',
      'Le carte si sciolgono come zucchero nel caffè, e la marea ne approfitta.', 'register', 1),
    register: {
      type: 'vote', art: 'lazRegistro', title: 'Il registro dei nomi', butterfly: true, next: 'alliance',
      text: 'Nella cancelleria c’è un registro aperto: i nomi di chi è passato dall’isola, dal 1468 in poi. Le ultime pagine sono bianche… o quasi.',
      options: [
        { label: '📜 Seguire i nomi fino all’ultima pagina', set: { register: 'follow' }, effect: (ctx) => readRegister(ctx, ctx.state.flags?.archiveOk ? WHISPERS.archive : WHISPERS.base) },
        { label: '🗝️ Aprire la cripta con la chiave del pozzo', when: (ctx) => ctx.state.flags?.key, set: { register: 'follow', crypt: true }, effect: (ctx) => readRegister(ctx, WHISPERS.crypt) },
        { label: '📕 Richiuderlo: certi nomi è meglio non leggerli', set: { register: 'closed' } },
      ],
    },
    alliance: { type: 'alliance', art: 'lazChiesa', share: clueShare, next: 'seats' },
    seats: {
      type: 'split', art: 'lazRegistro', flag: 'seats', title: 'Due fedi in bianco', who: crew, next: long ? 'write' : 'lantern',
      text: 'in un cassetto avete trovato due fedi di sanità in bianco, già timbrate.',
      privateText: 'Dividi: le consegnate al gruppo e la marea si calma. Ruba: ne tieni una per te, per ogni evenienza.',
      after: splitAfter,
      outcomes: {
        'both-share': 'Le fedi finiscono sul tavolo, per tutti. L’ufficiale le timbra una terza volta, soddisfatto, e la marea si ritira di un palmo.',
        'a-steals': thiefText, 'b-steals': thiefText, 'both-steal': 'Ve le contendete finché si strappano a metà. La marea ride, a modo suo.',
      },
    },
    write: {
      type: 'write', art: 'lazUfficiale', title: 'Cosa c’è scritto sulla vostra fede di sanità?', placeholder: 'Il latore è sanissimo, lo giuro su…', next: 'redemption',
      text: 'L’ufficiale accetta solo fedi convincenti. Scrivete la frase che vi farà salire sulla barca: la più votata vince.',
    },
    redemption: { type: 'custom', run: redemption },
    lantern: {
      type: 'spotlight', art: 'lazUfficiale', title: 'La lanterna dell’ufficiale', who: crew, next: long ? 'likely2' : 'discuss',
      publicText: (ctx, p) => `L’ufficiale ha dimenticato la lanterna sul molo. La raccoglie ${p.name}: dicono che alla sua luce i marchi si vedano. Cosa ne farà?`,
      privateText: 'Alla sua luce i polsi dicono la verità. Più o meno.',
      options: [
        { label: '🔦 Guardo i polsi di nascosto', effect: lanternPeek, outcomeTitle: 'Un’occhiata veloce', outcome: (ctx, p) => `${p.name} ha visto qualcosa. Cosa? Chiedeteglielo… se vi fidate.` },
        { label: '📢 La alzo davanti a tutti', effect: lanternShow, outcomeTitle: 'Un polso alla luce', sfx: 'ding', outcome: (ctx) => (ctx.state.flags?.lanternShown ? `Il polso di ${nameOf(ctx, ctx.state.flags.lanternShown)} è pulito: fuori dai sospetti.` : 'La luce non mostra niente di utile.') },
        { label: '🌊 La getto in laguna', effect: (ctx) => moveTide(ctx, -1), outcomeTitle: 'Plof.', outcome: 'La lanterna affonda lentamente, ancora accesa. La marea si ritira, come se avesse ricevuto un regalo.' },
      ],
    },
    likely2: { type: 'likely', art: 'lazRegistro', title: 'ha già il suo nome scritto nel registro?', next: 'discuss' },
    discuss: { type: 'custom', run: discuss },
    boarding: { type: 'custom', run: boarding },
    finale: { type: 'ending', endings: ENDINGS, roleOf, next: 'end' },
    end: { type: 'end', phoneTitle: 'La marea è tornata' },
  };
  const initialState = () => ({ long, flags: {}, stats: {}, notes: [], exiled: [], touched: [], tide: TIDE_START, discussSeconds: DISCUSS_SECONDS[length] ?? DISCUSS_SECONDS[30] });
  const kept = Object.entries(scenes).filter(([id]) => long || !LONG_ONLY.includes(id));
  return { start: 'intro', scenes: Object.fromEntries(kept), hideScores: true, initialState, hud };
}

export default {
  id: 'lazzaretto',
  title: 'L’Isola del Lazzaretto',
  blurb: 'Un’isola di quarantena, un marchiato segreto, un ufficiale che compra denunce e 6 finali (uno nascosto nella nebbia).',
  cover: 'lazzaretto',
  theme: 'horror',
  minPlayers: 3,
  build,
};
