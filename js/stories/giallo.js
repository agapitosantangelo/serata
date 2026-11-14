// Giallo v2: Delitto a Villa Corvara. No quiz: actions, secret roles, pacts, temptation, multiple endings.
import { el, sleep } from '../dom.js';
import { tallyKeys, topKeys, shuffle } from '../logic.js';
import { setFlags, bump, addCardLines } from '../host/state.js';
import {
  CATEGORIES, setupGiallo, rewardClue, extraClue, clueText, traitLabel,
} from './giallo-logic.js';

const DISCUSS_SECONDS = { 30: 240, 60: 420 };
const ACCUSE_SECONDS = 45;
const POINTS = { catch: 500, wrongAccuse: -200, escape: 1500, accompliceEscape: 1000, safe: 400, objective: 400 };
const WITNESSES = 2;

const ROOMS = {
  studio: { art: 'studio', title: 'Perquisizione dello studio', text: 'Cassetti forzati, una lettera bruciata a metà nel camino. Bisogna setacciare tutto in fretta, prima che qualcuno faccia sparire qualcosa.' },
  biblioteca: { art: 'biblioteca', title: 'Perquisizione della biblioteca', text: 'Su uno scaffale manca un volume e la candela è ancora calda. Qualcuno è stato qui da poco.' },
  serra: { art: 'serra', title: 'Perquisizione della serra', text: 'L’aria è dolciastra, sul bancone c’è un vasetto senza etichetta. Le piante sembrano osservarvi.' },
  cantina: { art: 'cantina', title: 'Perquisizione della cantina', text: 'Impronte fresche sul pavimento umido e una bottiglia d’annata stappata stanotte.' },
  soffitta: { art: 'soffitta', title: 'Perquisizione della soffitta', text: 'Bauli, polvere e ritratti girati verso il muro. Un baule è stato aperto da poco.' },
  giardino: { art: 'giardino', title: 'Perquisizione del giardino', text: 'La fontana trabocca di pioggia. Vicino alla siepe, nel fango, qualcosa luccica.' },
};

const isCulprit = (ctx, pid) => ctx.state.g?.culprit === pid;
const isAccomplice = (ctx, pid) => (ctx.state.turned ?? []).includes(pid);
const investigators = (ctx) => ctx.active().filter((p) => !(ctx.state.exiled ?? []).includes(p.pid));

// ---------- secret objectives for innocents ----------
const OBJECTIVES = [
  { id: 'unsuspected', text: 'Nessuno deve votarti nell’accusa finale', check: (ctx, pid) => !(ctx.state.finalVotes ?? {})[pid] },
  { id: 'pact', text: 'Stringi un patto con qualcuno', check: (ctx, pid) => (ctx.state.stats?.[pid]?.pact ?? 0) > 0 },
  { id: 'helper', text: 'Aiuta in tutte le perquisizioni', check: (ctx, pid) => { const s = ctx.state.stats?.[pid] ?? {}; return (s.pools ?? 0) > 0 && s.help === s.pools; } },
  { id: 'rich', text: 'Arricchisciti di nascosto (cassaforte o diario)', check: (ctx, pid) => (ctx.state.stats?.[pid]?.steal ?? 0) > 0 || ctx.state.flags?.safeBy === pid },
  { id: 'protect', text: 'Proteggi {X}: non deve essere arrestato', check: (ctx, pid) => ctx.state.flags?.arrested !== ctx.state.protectTarget?.[pid] },
];

function assignObjectives(ctx, pids, culprit) {
  const objectives = {};
  const protectTarget = {};
  const deck = shuffle(OBJECTIVES, ctx.rng);
  pids.filter((pid) => pid !== culprit).forEach((pid, i) => {
    const o = deck[i % deck.length];
    if (o.id === 'protect') {
      const others = pids.filter((x) => x !== pid);
      protectTarget[pid] = others[Math.floor(ctx.rng() * others.length)];
      objectives[pid] = { ...o, text: o.text.replace('{X}', ctx.player(protectTarget[pid]).name) };
    } else objectives[pid] = o;
  });
  objectives[culprit] = { id: 'escape', text: 'Non farti arrestare', check: (c) => !c.state.flags?.caught, points: 0 };
  return { objectives, protectTarget };
}

function profileLines(traits) {
  return CATEGORIES.map((c) => `${c.icon} ${c.label}: ${traitLabel(c.key, traits[c.key])}`);
}

function cardFor(ctx, pid) {
  const { g, objectives } = ctx.state;
  if (pid === g.culprit) {
    return {
      tone: 'danger', title: '🗡️ SEI IL COLPEVOLE',
      lines: [
        'Hai ucciso il Barone. Non farti arrestare!',
        ...profileLines(g.traits[pid]),
        `Indizio FALSO da spacciare: «${clueText(g.fakeClue)}»`,
        'Nelle perquisizioni puoi sabotare: ogni sabotaggio toglie 2 punti, e le carte del destino ti coprono.',
      ],
    };
  }
  return {
    tone: 'secret', title: '🕵️ Sei innocente',
    lines: [
      ...profileLines(g.traits[pid]),
      `Il tuo indizio (vero): «${clueText(g.privateClues[pid])}»`,
      `🎯 Obiettivo segreto: ${objectives[pid].text}`,
    ],
  };
}

// ---------- custom scenes ----------
async function roles(ctx) {
  const pids = ctx.active().map((p) => p.pid);
  const g = setupGiallo(pids, ctx.rng);
  const { objectives, protectTarget } = assignObjectives(ctx, pids, g.culprit);
  ctx.setState({ g, objectives, protectTarget, clues: [] });
  for (const pid of pids) ctx.sendCard(pid, cardFor(ctx, pid));
  ctx.ui.show({
    art: 'dossier', kicker: 'Carte segrete', title: 'Uno di voi è l’assassino',
    text: 'Ognuno ha ricevuto sul telefono una carta segreta: leggetela senza farla vedere. Gli innocenti hanno un indizio vero e un obiettivo personale. Il colpevole ha un indizio falso…',
  });
  ctx.sfx('drum');
  await ctx.advance({ phone: 'Leggi la tua carta segreta 🔒 (pulsante in basso)' });
  return 'dossier';
}

function dossier(ctx) {
  const { traits } = ctx.state.g;
  return ctx.ui.playerCards(ctx.players().filter((p) => traits[p.pid]), (p) => el('ul', { class: 'traits' },
    CATEGORIES.map((c) => el('li', {}, `${c.icon} `, el('b', {}, traitLabel(c.key, traits[p.pid][c.key]))))));
}

async function showDossier(ctx) {
  ctx.ui.show({
    kicker: 'Il fascicolo degli ospiti', title: 'Cosa ricorda la servitù',
    text: 'Dove eravate alle 22, cosa indossavate, di cosa odoravate. Memorizzate: servirà per l’accusa.',
    body: dossier(ctx), layout: 'center',
  });
  await ctx.advance({ phone: 'Studia il fascicolo sullo schermo 📁' });
  return 'firstMove';
}

function clueStep(step, next) {
  return async (ctx) => {
    const strong = Boolean(ctx.state.flags?.[`strong${step}`]);
    const clue = rewardClue(ctx.state.g, step, strong, ctx.rng);
    ctx.setState({ clues: [...ctx.state.clues, clue] });
    ctx.ui.show({
      art: 'dossier', kicker: strong ? 'Perquisizione riuscita' : 'Perquisizione confusa…',
      title: `Indizio n. ${step + 1}`, body: ctx.ui.clueCard(clueText(clue), strong),
    });
    ctx.sfx(strong ? 'fanfare' : 'sad');
    await ctx.advance({ phone: `Nuovo indizio: ${clueText(clue)}` });
    return next;
  };
}

function cluesList(ctx) {
  return el('div', { class: 'clue-list' }, ctx.state.clues.map((c) => (c.planted
    ? el('div', { class: 'clue-card clue-card--fake' }, el('div', { class: 'clue-card__stamp' }, 'PROVA TROVATA'),
      el('div', { class: 'clue-card__text' }, `Un fazzoletto con le iniziali di ${ctx.player(c.planted)?.name ?? '…'} accanto al corpo.`))
    : ctx.ui.clueCard(clueText(c), c.positive))));
}

async function plant(ctx) {
  const { g } = ctx.state;
  const culprit = ctx.player(g.culprit);
  ctx.ui.show({
    art: 'accusa', kicker: 'Nel buio', title: 'Salta la luce',
    text: 'Per un minuto la villa piomba nel buio. Qualcuno si muove in silenzio verso lo studio… Tutti, guardate il telefono e fate finta di scegliere.',
  });
  ctx.flash();
  ctx.sfx('thunder');
  if (!culprit?.connected) { await ctx.advance(); return 'alibi'; }
  const options = ctx.active().filter((p) => p.pid !== g.culprit).map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const { answers } = await ctx.collect({
    time: 25, players: [culprit],
    screen: { kind: 'players', title: 'Chi vuoi incastrare con una prova falsa?', options },
  });
  const target = answers.get(g.culprit)?.value ?? options[Math.floor(ctx.rng() * options.length)]?.pid;
  if (target) ctx.setState({ clues: [...ctx.state.clues, { planted: target }] });
  ctx.ui.show({
    art: 'dossier', kicker: 'Torna la luce', title: 'Una nuova prova',
    body: cluesList({ ...ctx, state: { ...ctx.state, clues: ctx.state.clues.filter((c) => c.planted) } }),
  });
  ctx.sfx('reveal');
  await ctx.advance({ phone: 'Guarda lo schermo: qualcuno è stato incastrato? 👀' });
  return 'alibi';
}

async function alibi(ctx) {
  const { g } = ctx.state;
  ctx.ui.show({
    art: 'studio', kicker: 'L’interrogatorio', title: 'Cosa avete sentito alle 22?',
    text: 'Il commissario, al telefono, vuole sapere cosa si sentiva dal salone alle 22. Rispondete sul telefono: le risposte compariranno con i vostri nomi.',
  });
  const { answers } = await ctx.collect({
    time: 60,
    screenFor: (p) => (p.pid === g.culprit || isAccomplice(ctx, p.pid)
      ? { kind: 'text', title: 'Alle 22 cosa si sentiva dal salone? Inventa qualcosa di credibile!', max: 60, placeholder: 'una risposta credibile…' }
      : { kind: 'text', title: 'Alle 22 qualcuno suonava il pianoforte nel salone. Che brano era, secondo te?', max: 60, placeholder: 'un brano, una canzone…' }),
  });
  const rows = ctx.active().map((p) => ({ p, text: String(answers.get(p.pid)?.value ?? '…').slice(0, 60) }));
  ctx.ui.show({
    kicker: 'Gli alibi', title: 'Qualcosa non torna?',
    text: 'Tutti hanno sentito la stessa cosa… o no?',
    body: el('div', { class: 'answers-board' }, rows.map(({ p, text }, i) => el('div', { class: 'answer-card', style: { animationDelay: `${i * 0.1}s` } },
      el('div', { class: 'answer-card__text' }, `“${text}”`), el('div', { class: 'answer-card__meta' }, `${p.avatar} ${p.name}`)))),
    layout: 'center',
  });
  ctx.sfx('reveal');
  await ctx.advance({ phone: 'Leggete gli alibi sullo schermo 🕵️' });
  return 'safe';
}

async function witness(ctx) {
  const { g } = ctx.state;
  const innocents = shuffle(investigators(ctx).filter((p) => p.pid !== g.culprit && !isAccomplice(ctx, p.pid)), ctx.rng).slice(0, WITNESSES);
  for (const p of innocents) addCardLines(ctx, p.pid, [`👂 Il giardiniere ti ha sussurrato: «${clueText(extraClue(g, ctx.rng))}»`]);
  ctx.ui.show({
    art: 'giardino', kicker: 'Un testimone', title: 'Il giardiniere ha visto qualcosa',
    text: `Fradicio di pioggia, il giardiniere giura di aver visto qualcosa dalla finestra e lo sussurra a ${innocents.length} di voi. Ma chi dice di averlo sentito… dice la verità?`,
  });
  ctx.sfx('reveal');
  await ctx.advance({ phone: 'Controlla la tua carta: forse c’è un sussurro nuovo 👂' });
  return 'fermo';
}

async function fermo(ctx) {
  const players = ctx.active();
  const decide = ctx.ui.voteBoard(['🔐 Sì, chiudiamo qualcuno in cantina', '🙅 No, non ancora']);
  ctx.ui.show({ art: 'cantina', kicker: 'Il fermo', title: 'Chiudere qualcuno in cantina fino all’alba?', text: 'Chi viene chiuso dentro non potrà più partecipare alle perquisizioni, ma voterà nell’accusa finale. Se è innocente, chi lo ha votato pagherà.', body: decide });
  const { answers } = await ctx.collect({ time: 25, screen: { kind: 'choice', style: 'vote', title: 'Chiudere qualcuno in cantina?', options: ['🔐 Sì', '🙅 No'] } });
  const yes = [...answers.values()].filter((a) => a.value === 0).length;
  ctx.ui.revealVote(decide, [yes, answers.size - yes], yes > answers.size - yes ? 0 : 1);
  await sleep(1500);
  if (yes <= answers.size - yes) {
    await ctx.advance();
    return 'room3';
  }
  const board = ctx.ui.pickBoard(players);
  ctx.ui.show({ kicker: 'Il fermo', title: 'Chi chiudiamo in cantina?', body: board, layout: 'center' });
  const { answers: votes } = await ctx.collect({
    time: 35,
    screenFor: (p) => ({ kind: 'players', title: 'Chi chiudiamo in cantina?', options: players.filter((o) => o.pid !== p.pid).map(({ pid, name, avatar }) => ({ pid, name, avatar })) }),
  });
  const valid = new Map([...votes].filter(([pid, a]) => a.value !== pid));
  const counts = tallyKeys(valid, players.map((p) => p.pid));
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  await sleep(1800);
  if (top.length !== 1) {
    await ctx.ui.banner('Pareggio: nessuno finisce in cantina', 'neutral', 1800);
    await ctx.advance();
    return 'room3';
  }
  const locked = ctx.player(top[0]);
  ctx.setState({ exiled: [...(ctx.state.exiled ?? []), locked.pid] });
  const innocent = !isCulprit(ctx, locked.pid) && !isAccomplice(ctx, locked.pid);
  if (innocent) for (const [pid, a] of valid) if (a.value === locked.pid) ctx.addPoints(pid, POINTS.wrongAccuse / 2);
  setFlags(ctx, { lockedInnocent: innocent });
  ctx.send(locked.pid, { kind: 'wait', icon: '🔐', text: 'Sei chiuso in cantina. Niente più perquisizioni, ma voterai nell’accusa finale.' });
  ctx.ui.show({
    art: 'cantina', kicker: 'Il fermo', title: `${locked.avatar} ${locked.name} finisce in cantina`,
    text: 'La porta si chiude con un tonfo. Se era la persona giusta, lo scoprirete solo alla fine…',
  });
  ctx.sfx('hit');
  await ctx.advance();
  return 'room3';
}

async function discuss(ctx) {
  const seconds = ctx.state.discussSeconds;
  const body = el('div', { class: 'discuss' }, dossier(ctx), cluesList(ctx));
  ctx.ui.show({
    kicker: `Discussione · ${Math.round(seconds / 60)} minuti`, title: 'Chi è stato?',
    text: 'Condividete indizi, patti e sussurri. Il colpevole mentirà… e forse non è solo.', body, layout: 'center',
  });
  ctx.sfx('reveal');
  const countdown = ctx.ui.timer(seconds);
  await ctx.advance({ label: 'Passiamo all’accusa ▶', phone: 'Discutete! Riguarda la tua carta 🔒', until: sleep(seconds * 1000) });
  countdown.stop();
  return 'preAccuse';
}

async function preAccuse(ctx) {
  const steps = ctx.state.totalClues;
  const strongAll = Array.from({ length: steps }, (_, i) => ctx.state.flags?.[`strong${i}`]).every(Boolean);
  if (!(strongAll && ctx.state.flags?.diary === 'both-share')) return 'accuse';
  const culprit = ctx.player(ctx.state.g.culprit);
  setFlags(ctx, { caught: true, confessed: true, arrested: culprit.pid });
  ctx.ui.show({
    art: 'accusa', kicker: 'Colpo di scena', title: `${culprit.avatar} ${culprit.name} crolla e confessa!`,
    text: 'Indizi schiaccianti e il diario del Barone letto ad alta voce: non c’è via d’uscita. Il colpevole confessa prima ancora dell’accusa.',
  });
  ctx.flash();
  ctx.sfx('fanfare');
  ctx.confetti(200);
  for (const p of ctx.players()) if (p.pid !== culprit.pid && !isAccomplice(ctx, p.pid)) ctx.addPoints(p.pid, POINTS.catch);
  await ctx.advance();
  return 'finale';
}

async function accuse(ctx) {
  const { g } = ctx.state;
  const suspects = ctx.players().filter((p) => g.traits[p.pid]);
  const options = suspects.map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const board = ctx.ui.pickBoard(suspects);
  ctx.ui.show({ kicker: 'Il momento della verità', title: 'Chi arrestiamo?', text: 'Attenzione: chi vota un innocente che viene arrestato perde punti.', body: board, layout: 'center' });
  ctx.sfx('drum');
  const { answers } = await ctx.collect({
    time: ACCUSE_SECONDS,
    screenFor: (p) => ({ kind: 'players', title: 'Chi è il colpevole?', options: options.filter((o) => o.pid !== p.pid) }),
  });
  const valid = new Map([...answers].filter(([pid, a]) => a.value !== pid));
  const counts = tallyKeys(valid, suspects.map((s) => s.pid));
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  const finalVotes = Object.fromEntries([...counts].filter(([, n]) => n > 0));
  for (const [pid, n] of Object.entries(finalVotes)) bump(ctx, pid, 'votesAgainst', n);
  ctx.setState({ finalVotes });
  ctx.sfx('drum');
  await sleep(2400);

  const arrested = top.length === 1 ? top[0] : null;
  const caught = arrested === g.culprit;
  setFlags(ctx, { caught, arrested });
  for (const [pid, a] of valid) {
    if (a.value === g.culprit && !isAccomplice(ctx, pid)) ctx.addPoints(pid, POINTS.catch);
    else if (arrested && a.value === arrested && !caught) ctx.addPoints(pid, POINTS.wrongAccuse);
  }
  if (!caught) {
    ctx.addPoints(g.culprit, POINTS.escape);
    for (const pid of ctx.state.turned ?? []) ctx.addPoints(pid, POINTS.accompliceEscape);
  }
  const who = arrested ? ctx.player(arrested) : null;
  let title = 'Voti divisi: nessuno viene arrestato!';
  if (who) title = caught ? `${who.name} È IL COLPEVOLE!` : `${who.name} era innocente!`;
  ctx.ui.show({ art: 'accusa', kicker: who ? `Arrestato: ${who.avatar} ${who.name}` : 'Nessuna maggioranza', title });
  ctx.flash();
  ctx.sfx(caught ? 'fanfare' : 'reveal');
  await ctx.advance();
  return 'finale';
}

// ---------- endings ----------
const ENDINGS = [
  {
    id: 'confession', name: 'La confessione', art: 'villa', when: (s) => s.flags?.confessed,
    title: 'Giustizia perfetta',
    text: 'Una confessione piena, davanti a tutti. I carabinieri all’alba trovano il caso già chiuso e vi stringono la mano uno per uno.',
  },
  {
    id: 'justice', name: 'Giustizia', art: 'villa', when: (s) => s.flags?.caught && !(s.turned ?? []).length,
    title: 'Giustizia è fatta',
    text: 'Il colpevole viene portato via tra i lampi. La tempesta si placa e Villa Corvara torna in silenzio.',
  },
  {
    id: 'half', name: 'Giustizia a metà', art: 'accusa', when: (s) => s.flags?.caught && (s.turned ?? []).length, sad: true,
    title: 'Il complice resta libero',
    text: 'Il colpevole è in manette… ma qualcuno tra voi aveva accettato l’offerta dell’avvocato. Il testamento, per cavilli, finirà nelle sue mani.',
  },
  {
    id: 'late', name: 'Giustizia tardiva', art: 'villa', when: (s) => !s.flags?.caught && s.flags?.called,
    title: 'All’alba arrivano i carabinieri',
    text: 'Avevate chiamato i carabinieri: all’alba arrivano, interrogano tutti e trovano il vero colpevole. Peccato per chi ha passato la notte in manette da innocente.',
  },
  {
    id: 'escape', name: 'Fuga nella tempesta', art: 'villa', when: (s) => !s.flags?.caught && !s.flags?.locked, sad: true,
    title: 'Il colpevole è fuggito',
    text: 'Nessuno aveva bloccato le porte. Mentre voi discutevate, il colpevole è sparito nella tempesta. Di lui resta solo un’impronta di fango sulla soglia.',
  },
  {
    id: 'wrong', name: 'Innocente in manette', art: 'accusa', when: () => true, sad: true,
    title: 'Il delitto perfetto',
    text: 'Le porte erano sbarrate: il colpevole è ancora qui, tra voi, e sorride. Ad essere arrestato è stato qualcun altro.',
  },
];

function roleOf(ctx, pid) {
  if (isCulprit(ctx, pid)) return '🗡️ Il colpevole';
  if (isAccomplice(ctx, pid)) return '🤝 Il complice (ha accettato l’offerta)';
  return '🕵️ Innocente';
}

// ---------- scenes ----------
function roomVote(id, a, b, next) {
  return {
    type: 'vote', art: 'dossier', title: 'Dove perquisiamo?',
    options: [
      { label: `🔎 ${ROOMS[a].title.replace('Perquisizione d', 'D')}`, set: { [id]: a } },
      { label: `🔎 ${ROOMS[b].title.replace('Perquisizione d', 'D')}`, set: { [id]: b } },
    ],
    next,
  };
}

function search(roomFlag, step, next) {
  return {
    type: 'pool', flag: `strong${step}`,
    art: (ctx) => ROOMS[ctx.state.flags[roomFlag]].art,
    title: (ctx) => ROOMS[ctx.state.flags[roomFlag]].title,
    text: (ctx) => ROOMS[ctx.state.flags[roomFlag]].text,
    who: investigators,
    success: 'Avete setacciato ogni angolo: c’è un indizio decisivo!',
    fail: (ctx, r) => `${r.sabotages ? 'Qualcosa (o qualcuno) ha rovinato la perquisizione.' : 'Troppa confusione.'} Troverete solo un indizio debole.`,
    next,
  };
}

function build(length) {
  const long = length === 60;
  const scenes = {
    intro: {
      type: 'narr', art: 'villa', kicker: 'Villa Corvara · 23:47', title: 'Delitto a Villa Corvara', sfx: 'thunder',
      text: 'Notte di tempesta. Il Barone Ottavio Corvara aveva invitato a cena i suoi ospiti più cari: voi. Poco prima di mezzanotte, un urlo. Il Barone giace nello studio, senza vita. La strada è allagata e nessuno può andarsene. L’assassino è in questa stanza.',
      next: 'roles',
    },
    roles: { type: 'custom', run: roles },
    dossier: { type: 'custom', run: showDossier },
    firstMove: {
      type: 'vote', art: 'villa', title: 'La prima mossa: cosa fate?', butterfly: true,
      options: [
        { label: '📞 Chiamare i carabinieri (la linea è disturbata)', set: { called: true } },
        { label: '🔒 Sbarrare porte e finestre', set: { locked: true } },
      ],
      next: long ? 'likely1' : 'room1',
    },
    likely1: { type: 'likely', art: 'accusa', title: 'nasconda un segreto inconfessabile?', next: 'room1' },
    room1: roomVote('room1', 'studio', 'biblioteca', 'search1'),
    search1: search('room1', 0, 'clue1'),
    clue1: { type: 'custom', run: clueStep(0, 'plant') },
    plant: { type: 'custom', run: plant },
    alibi: { type: 'custom', run: alibi },
    safe: {
      type: 'spotlight', art: 'studio', title: 'La cassaforte del Barone',
      publicText: (ctx, p) => `${p.name} trova la combinazione della cassaforte su un foglietto. Cosa farà?`,
      privateText: 'Dentro ci sono i gioielli del Barone… e forse delle carte importanti.',
      options: [
        {
          label: '💰 La apro da solo e prendo i gioielli',
          effect: (ctx, p) => { ctx.addPoints(p.pid, POINTS.safe); bump(ctx, p.pid, 'steal'); setFlags(ctx, { safeBy: p.pid }); },
          outcomeTitle: 'Clic. Silenzio.',
          outcome: 'Qualcuno ha sentito scattare la serratura… ma quando arrivate la cassaforte è aperta e vuota.',
        },
        {
          label: '📜 Chiamo gli altri e la apriamo insieme',
          effect: (ctx) => { ctx.setState({ clues: [...ctx.state.clues, { ...extraClue(ctx.state.g, ctx.rng), bonus: true }] }); setFlags(ctx, { safeShared: true }); },
          outcomeTitle: 'Carte compromettenti',
          outcome: (ctx) => `Tra le carte del Barone c’è un appunto: «${clueText(ctx.state.clues.at(-1))}»`,
          sfx: 'fanfare',
        },
        {
          label: '🤐 Faccio finta di niente',
          outcomeTitle: 'Il foglietto sparisce',
          outcome: 'Il foglietto torna nella tasca da cui era uscito. Nessuno saprà mai cosa c’era in quella cassaforte.',
        },
      ],
      next: 'alliance',
    },
    alliance: {
      type: 'alliance', art: 'dossier',
      share: (ctx, otherPid) => (isCulprit(ctx, otherPid)
        ? `il suo indizio è «${clueText(ctx.state.g.fakeClue)}»`
        : `il suo indizio è «${clueText(ctx.state.g.privateClues[otherPid])}»`),
      next: 'tempt',
    },
    tempt: {
      type: 'tempt', art: 'accusa', title: 'Una telefonata nella notte',
      who: (ctx) => investigators(ctx).filter((p) => !isCulprit(ctx, p.pid)),
      publicText: 'Il telefono fisso squilla una volta sola. Poi alcuni di voi ricevono un messaggio…',
      offerTitle: 'L’avvocato del Barone',
      offerText: 'Il testamento lascia tutto agli ospiti… solo se il colpevole NON viene arrestato. Diventa complice: saprai chi è stato e avrai la tua parte.',
      cap: 1,
      onAccept: async (ctx, pid) => {
        const culprit = ctx.player(ctx.state.g.culprit);
        const me = ctx.player(pid);
        ctx.sendCard(pid, {
          tone: 'danger', title: '🤝 SEI IL COMPLICE',
          lines: [
            `Il colpevole è ${culprit.avatar} ${culprit.name}.`,
            'Obiettivo: il colpevole NON deve essere arrestato. Se ce la fate, il testamento è tuo.',
            'Da ora puoi sabotare le perquisizioni anche tu.',
            ...profileLines(ctx.state.g.traits[pid]),
          ],
        });
        ctx.setState({ objectives: { ...ctx.state.objectives, [pid]: { id: 'accomplice', text: 'Il colpevole non deve essere arrestato', check: (c) => !c.state.flags?.caught, points: 0 } } });
        addCardLines(ctx, culprit.pid, [`🤝 Hai un complice: ${me.avatar} ${me.name}. Coprite l’uno le tracce dell’altro.`]);
      },
      next: long ? 'witness' : 'room2',
    },
    witness: { type: 'custom', run: witness },
    fermo: { type: 'custom', run: fermo },
    room3: roomVote('room3', 'soffitta', 'giardino', 'search3'),
    search3: search('room3', 1, 'clue3'),
    clue3: { type: 'custom', run: clueStep(1, 'room2') },
    room2: roomVote('room2', 'serra', 'cantina', 'search2'),
    search2: search('room2', long ? 2 : 1, 'clue2'),
    clue2: { type: 'custom', run: clueStep(long ? 2 : 1, 'diary') },
    diary: {
      type: 'split', art: 'taccuino', flag: 'diary', title: 'Il diario del Barone',
      who: investigators,
      text: 'avete trovato insieme il diario segreto del Barone.',
      privateText: 'Dividi: lo leggete a tutti (forse fa crollare il colpevole). Ruba: lo tieni tu per ricattare qualcuno dopo.',
      outcomes: {
        'both-share': 'Il diario viene letto ad alta voce. Il colpevole impallidisce: le prove si stanno stringendo intorno a lui.',
        'a-steals': (ctx, { thief }) => `${thief.name} infila il diario in tasca. Chissà chi ricatterà domani.`,
        'b-steals': (ctx, { thief }) => `${thief.name} infila il diario in tasca. Chissà chi ricatterà domani.`,
        'both-steal': 'Ve lo strappate di mano e il diario finisce a pezzi nel camino. Nessuno saprà cosa c’era scritto.',
      },
      next: long ? 'likely2' : 'discuss',
    },
    likely2: { type: 'likely', art: 'accusa', title: 'sia il vero colpevole? (sondaggio a caldo)', next: 'discuss' },
    discuss: { type: 'custom', run: discuss },
    preAccuse: { type: 'custom', run: preAccuse },
    accuse: { type: 'custom', run: accuse },
    finale: { type: 'ending', endings: ENDINGS, roleOf, next: 'end' },
    end: { type: 'end', phoneTitle: 'Caso chiuso!' },
  };
  // 60-minute route: after the temptation, witness → fermo → soffitta/giardino → serra/cantina.
  return {
    start: 'intro',
    scenes,
    hideScores: true,
    initialState: () => ({ clues: [], flags: {}, stats: {}, discussSeconds: DISCUSS_SECONDS[length] ?? DISCUSS_SECONDS[30], totalClues: long ? 3 : 2 }),
    hud: (ctx) => `🔍 Indizi: ${ctx.state.clues?.filter((c) => !c.planted && !c.bonus).length ?? 0}/${ctx.state.totalClues}${ctx.state.clues?.some((c) => c.bonus) ? ' +1' : ''}${ctx.state.flags?.called ? ' · 📞' : ''}${ctx.state.flags?.locked ? ' · 🔒' : ''}`,
  };
}

export default {
  id: 'giallo',
  title: 'Delitto a Villa Corvara',
  blurb: 'Un colpevole segreto, complici tentati, patti, prove false e 6 finali possibili.',
  cover: 'villa',
  theme: 'giallo',
  minPlayers: 3,
  build,
};
