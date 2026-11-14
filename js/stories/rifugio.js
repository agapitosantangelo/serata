// Horror: Il Rifugio dei Colpi. A blizzard on the Monti Sibillini, a hidden Cosa, and a wall that knocks in code.
import { el, sleep } from '../dom.js';
import { tallyKeys, topKeys, shuffle, pickOne } from '../logic.js';
import { setFlags, bump, addCardLines } from '../host/state.js';

const DISCUSS_SECONDS = { 30: 180, 60: 300 };
const START = { 30: { legna: 4, ore: 5 }, 60: { legna: 6, ore: 7 } };
const POINTS = { catch: 500, wrongExpel: -200, survive: 1500, turnedSurvive: 1000, wrongLock: -100, cozy: 100 };
const WOOD = { shed: 2, burn: -2, ration: 1, planks: 1, table: 2, door: -1, diary: 1, flood: -2, roof: -1, gift: -1, giftBack: 2 };
const EXPEL_SECONDS = 45;
const PICK_SECONDS = 35;
const KNOCK_SECONDS = 30;
const KNOCK_GAP_MS = 380;
const PICK_PAUSE_MS = 2000;
const VALLEY_ODDS = 0.5;
const MIN_INSIDE = 3; // nobody else leaves the hut when fewer would remain inside
const VOUCH_MIN_PLAYERS = 4; // with 3 players a single certainty would unmask the Cosa

const TRADES = ['🧗 Guida alpina', '🍲 Cuoca del rifugio', '📷 Fotografo di camosci', '🩺 Medico in ferie', '🎸 Chitarrista stonato', '🧀 Pastore di Castelluccio',
  '📚 Prof di latino', '🛷 Campione di slittino (1998)', '🌦️ Meteorologo (ha sbagliato le previsioni)', '🥾 Escursionista della domenica', '🍷 Sommelier di genepì', '🔦 Speleologo'];
const PROOFS = ['sanguinare dal naso per il freddo', 'starnutire undici volte di fila', 'scottarsi la lingua col caffè', 'urlare per un ragno',
  'sudare davanti al camino', 'piangere guardando le foto del cane', 'russare come una motosega', 'tremare di freddo nel sonno'];

const F = (s) => s.flags ?? {};
const flags = (ctx) => F(ctx.state);
const isCosa = (ctx, pid) => ctx.state.g?.cosa === pid;
const isTurned = (ctx, pid) => (ctx.state.turned ?? []).includes(pid);
const isExiled = (ctx, pid) => (ctx.state.exiled ?? []).includes(pid);
const inside = (ctx) => ctx.active().filter((p) => !isExiled(ctx, p.pid));
const humansInside = (ctx) => inside(ctx).filter((p) => !isCosa(ctx, p.pid) && !isTurned(ctx, p.pid));
const nameOf = (p) => (p ? `${p.avatar} ${p.name}` : '…');
const nameById = (ctx, pid) => ctx.player(pid)?.name ?? '…';
const allTruth = (s) => (s.knocks ?? []).length > 0 && s.knocks.every((k) => k.truthful);
const rescued = (s) => Boolean(F(s).valleyReached || F(s).radio === 'both-share' || F(s).smoke);
const addLegna = (ctx, n) => ctx.setState({ legna: Math.max(0, (ctx.state.legna ?? 0) + n) });
const exile = (ctx, pid) => ctx.setState({ exiled: [...ctx.state.exiled, pid] });
const passHour = (ctx) => { ctx.setState({ ore: Math.max(0, ctx.state.ore - 1) }); addLegna(ctx, -1); };

// ---------- roles and secret objectives ----------
const OBJECTIVES = [
  { id: 'unsuspected', text: 'Nessuno deve votarti all’alba', check: (ctx, pid) => !(ctx.state.finalVotes ?? {})[pid] },
  { id: 'pact', text: 'Stringi un patto con qualcuno', check: (ctx, pid) => (ctx.state.stats?.[pid]?.pact ?? 0) > 0 },
  { id: 'helper', text: 'Aiuta in tutte le prove di gruppo', check: (ctx, pid) => { const s = ctx.state.stats?.[pid] ?? {}; return (s.pools ?? 0) > 0 && s.help === s.pools; } },
  { id: 'warm', text: 'All’alba deve restare almeno un ciocco di legna', check: (ctx) => ctx.state.legna > 0 },
  { id: 'treasure', text: 'Fai trovare quello che c’è sotto il pavimento', check: (ctx) => Boolean(flags(ctx).treasure) },
  { id: 'hunter', text: 'All’alba, vota per cacciare la Cosa', check: (ctx, pid) => ctx.state.expelVotes?.[pid] === ctx.state.g.cosa },
  { id: 'protect', text: 'Proteggi {X}: non deve finire fuori nella neve', check: (ctx, pid) => flags(ctx).expelled !== ctx.state.protectTarget?.[pid] },
];
const COSA_GOAL = { id: 'cosa', text: 'Restare nel rifugio fino all’alba', check: (ctx) => !flags(ctx).cosaOut, points: 0 };
const TURNED_GOAL = { id: 'turned', text: 'La Cosa non deve essere cacciata', check: (ctx) => !flags(ctx).cosaOut, points: 0 };
const REDEEMED_GOAL = { id: 'redeemed', text: 'Fai cacciare la Cosa che ti aveva sedotto', check: (ctx) => Boolean(flags(ctx).cosaOut) };

function setupRoles(ctx, pids) {
  const cosa = pickOne(pids, ctx.rng);
  const rientrato = pickOne(pids, ctx.rng); // can be the Cosa… or not
  const humans = pids.filter((pid) => pid !== cosa);
  const [trades, proofs, deck] = [TRADES, PROOFS, OBJECTIVES].map((list) => shuffle(list, ctx.rng));
  const canVouch = pids.length >= VOUCH_MIN_PLAYERS;
  const objectives = { [cosa]: COSA_GOAL };
  const protectTarget = {};
  const vouch = Object.fromEntries(pids.map((pid, i) => {
    const pool = humans.filter((h) => h !== pid);
    return [pid, { who: canVouch && pool.length ? pickOne(pool, ctx.rng) : null, proof: proofs[i % proofs.length] }];
  }));
  humans.forEach((pid, i) => {
    const o = deck[i % deck.length];
    if (o.id !== 'protect') { objectives[pid] = o; return; }
    protectTarget[pid] = pickOne(pids.filter((x) => x !== pid), ctx.rng);
    objectives[pid] = { ...o, text: o.text.replace('{X}', nameById(ctx, protectTarget[pid])) };
  });
  const trade = Object.fromEntries(pids.map((pid, i) => [pid, trades[i % trades.length]]));
  const fakeGoal = pickOne(OBJECTIVES.filter((o) => o.id !== 'protect'), ctx.rng).text;
  return { g: { cosa, rientrato, vouch, trade, fakeGoal }, objectives, protectTarget };
}

function cardFor(ctx, pid) {
  const { g, objectives } = ctx.state;
  const v = g.vouch[pid];
  const certainty = v.who ? `${nameById(ctx, v.who)} è umano: l’hai visto ${v.proof}` : null;
  if (pid === g.cosa) {
    return { tone: 'danger', title: '👁️ SEI LA COSA', lines: [
      'Non sei umano, e nessuno lo sa. Resisti nel rifugio fino all’alba senza farti cacciare.', `Mestiere (di copertura): ${g.trade[pid]}`,
      pid === g.rientrato ? '🌀 Sei anche il rientrato: tutti ti guarderanno storto. In tasca hai una chiave arrugginita.' : `🌀 Il rientrato è ${nameById(ctx, g.rientrato)}: fai sospettare di lui.`,
      certainty ? `Copertura: giura che ${certainty}.` : 'Copertura: inventatela tu.',
      'Nelle prove di gruppo puoi sabotare. Se il tuo telefono traduce i colpi, mentire è il tuo mestiere.',
    ] };
  }
  return { tone: 'secret', title: '🧑 Sei umano', lines: [
    `Mestiere: ${g.trade[pid]}`, certainty ? `✅ Sei certo che ${certainty}.` : null,
    pid === g.rientrato ? '🌀 Sei tu il rientrato: dell’ultima ora ricordi solo neve. In tasca hai una chiave arrugginita che non è tua.' : null,
    '🔨 Se il tuo telefono traduce i colpi, puoi dire il vero… o mentire.', `🎯 Obiettivo segreto: ${objectives[pid].text}`,
  ].filter(Boolean) };
}

function roles(next) {
  return async (ctx) => {
    const pids = ctx.active().map((p) => p.pid);
    ctx.setState(setupRoles(ctx, pids));
    for (const pid of pids) ctx.sendCard(pid, cardFor(ctx, pid));
    const r = ctx.player(ctx.state.g.rientrato);
    ctx.ui.show({ art: 'rifMuro', kicker: 'Carte segrete', title: 'Uno di voi non è umano',
      text: `Leggete la carta sul telefono, di nascosto. Una cosa è certa: un’ora fa ${r.name} ha preso l’accetta ed è uscito per la legna. Ha bussato per rientrare solo adesso: non ricorda niente, ha le mani gelide. E da allora, nei muri, qualcosa bussa.` });
    ctx.sfx('drum');
    await ctx.advance({ phone: 'Leggi la tua carta segreta 🔒 (pulsante in basso)' });
    return next;
  };
}

// ---------- the knock code: one phone translates, its owner may lie ----------
const KNOCKS = {
  floor: { pattern: 'TOC · TOC TOC · TOC', text: 'Colpi lenti, ostinati, dal muro dietro la stufa. Sembrano contare qualcosa.',
    make: () => ({ truth: 'SOTTO LA TERZA ASSE C’È UN DONO', lies: ['NEL MURO NON C’È NIENTE. DORMITE', 'BRUCIATE IL TAVOLO'], sets: [{ floorHint: true }, null, { tableHint: true }] }) },
  cosa: { pattern: 'TOC TOC TOC · TOC', text: 'Colpi rapidi, nervosi, che corrono lungo la parete. Come se il muro avesse fretta di dirvi chi c’è tra voi.',
    make: (ctx, translator) => {
      const pool = ctx.players().filter((p) => !isCosa(ctx, p.pid) && p.pid !== translator.pid);
      const x = (pool.length ? pickOne(pool, ctx.rng) : translator).name.toUpperCase();
      return { truth: `${x} È UMANO`, lies: [`${x} È LA COSA`, 'LA COSA NON È TRA VOI'] };
    } },
  dead: { pattern: 'TOC … TOC … TOC', text: 'Tre colpi lunghissimi, come da sottoterra. Il vecchio guardiano è morto qui, nella tormenta del ’56. Dicono.',
    make: () => ({ truth: 'TENETE ACCESO IL FUOCO: IL FUMO VI SALVA', lies: ['NESSUNO VERRÀ. SCENDETE A VALLE', 'SPEGNETE IL FUOCO: LEI VEDE IL FUMO'], sets: [{ smoke: true }] }) },
};

function pickTranslator(ctx) {
  const candidates = inside(ctx);
  const seer = ctx.player(flags(ctx).drank);
  if (seer?.connected && !isExiled(ctx, seer.pid) && !flags(ctx).drankUsed) { setFlags(ctx, { drankUsed: true }); return seer; }
  const fresh = candidates.filter((p) => !ctx.state.translators.includes(p.pid));
  return candidates.length ? pickOne(fresh.length ? fresh : candidates, ctx.rng) : null;
}

function knock(key, next) {
  return async (ctx) => {
    const def = KNOCKS[key];
    passHour(ctx);
    const translator = pickTranslator(ctx);
    const mood = flags(ctx).answered ? 'Da quando gli avete risposto, il muro bussa quasi con gentilezza.' : 'Da quando l’avete ignorato, il muro bussa offeso, più forte.';
    ctx.ui.show({ art: 'rifMuro', kicker: 'Il codice nel muro', title: def.pattern, text: `${def.text} ${mood}${translator ? ` Solo il telefono di ${translator.name} traduce i colpi.` : ''}` });
    for (let i = 0; i < 3; i += 1) { ctx.sfx('hit'); await sleep(KNOCK_GAP_MS); }
    if (!translator) { await ctx.advance(); return next; }
    const msg = def.make(ctx, translator);
    const said = [msg.truth, ...msg.lies];
    const { answers } = await ctx.collect({ time: KNOCK_SECONDS, players: [translator],
      screen: { kind: 'choice', style: 'vote', title: 'Solo tu capisci i colpi', text: `Il muro dice davvero: «${msg.truth}». Cosa riferisci agli altri?`,
        options: [`🗣️ La verità: «${msg.truth}»`, ...msg.lies.map((l) => `🤥 Mento: «${l}»`)] } });
    const raw = answers.get(translator.pid)?.value;
    const idx = Number.isInteger(raw) && said[raw] ? raw : 0;
    bump(ctx, translator.pid, idx === 0 ? 'truth' : 'lie');
    ctx.setState({ knocks: [...ctx.state.knocks, { key, pid: translator.pid, truthful: idx === 0 }], translators: [...ctx.state.translators, translator.pid] });
    setFlags(ctx, msg.sets?.[idx] ?? null);
    ctx.ui.show({ art: 'rifMuro', kicker: `${nameOf(translator)} traduce i colpi`, title: `«${said[idx]}»`, text: 'Dice il vero? Solo il suo telefono lo sa. Per ora.' });
    ctx.sfx('reveal');
    await ctx.advance({ phone: `I colpi, secondo ${translator.name}: «${said[idx]}»` });
    return next;
  };
}

// ---------- group picks: locking out, sending to the valley, the final expulsion ----------
async function groupPick(ctx, { kicker, title, text, candidates, allowSelf = false, time = PICK_SECONDS }) {
  const board = ctx.ui.pickBoard(candidates);
  ctx.ui.show({ kicker, title, text, body: board, layout: 'center' });
  ctx.sfx('drum');
  const ids = candidates.map((p) => p.pid);
  const options = candidates.map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const { answers } = await ctx.collect({ time, screenFor: (p) => ({ kind: 'players', title, options: options.filter((o) => allowSelf || o.pid !== p.pid) }) });
  const valid = new Map([...answers].filter(([pid, a]) => ids.includes(a.value) && (allowSelf || a.value !== pid)));
  const counts = tallyKeys(valid, ids);
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  await sleep(PICK_PAUSE_MS);
  return { valid, counts, top };
}

async function lockPick(ctx) {
  const candidates = inside(ctx);
  if (candidates.length <= MIN_INSIDE) { await ctx.ui.banner('Siete troppo pochi: nessuno va in legnaia', 'neutral', 2000); return 'radio'; }
  const { valid, top } = await groupPick(ctx, { kicker: 'La legnaia', title: 'Chi chiudiamo in legnaia?', candidates,
    text: 'Chi finisce in legnaia salta le prove di gruppo, ma voterà all’alba. Se è umano, chi l’ha votato pagherà.' });
  if (top.length !== 1) { await ctx.ui.banner('Pareggio: la legnaia resta vuota', 'neutral', 1800); return 'radio'; }
  const locked = ctx.player(top[0]);
  exile(ctx, locked.pid);
  if (!isCosa(ctx, locked.pid) && !isTurned(ctx, locked.pid)) for (const [pid, a] of valid) if (a.value === locked.pid) ctx.addPoints(pid, POINTS.wrongLock);
  setFlags(ctx, { lockedOut: locked.pid });
  ctx.send(locked.pid, { kind: 'wait', icon: '🪓', text: 'Sei chiuso in legnaia. Niente più prove: ma all’alba voterai anche tu.' });
  ctx.ui.show({ art: 'rifPorta', kicker: 'La legnaia', title: `${nameOf(locked)} finisce in legnaia`, text: 'Il chiavistello scatta. Da dietro la porta, per un po’, si sente battere i denti. Poi, piano, tre colpi.' });
  ctx.sfx('hit');
  await ctx.advance();
  return 'radio';
}

async function valleyPick(ctx) {
  const candidates = inside(ctx);
  if (candidates.length <= MIN_INSIDE) { await ctx.ui.banner('Siete troppo pochi per separarvi', 'neutral', 2000); return 'siege'; }
  const { top } = await groupPick(ctx, { kicker: 'Verso Castelluccio', title: 'Chi scende a valle?', text: 'Potete votare anche voi stessi: ci vuole coraggio.', candidates, allowSelf: true });
  const pid = top.length ? pickOne(top, ctx.rng) : pickOne(candidates, ctx.rng).pid;
  const ciaspole = Boolean(flags(ctx).doorOpened);
  exile(ctx, pid);
  setFlags(ctx, { sentDown: pid, valleyReached: !isCosa(ctx, pid) && (ciaspole || ctx.rng() < VALLEY_ODDS) });
  ctx.send(pid, { kind: 'wait', icon: '🎿', text: 'Sei nella tormenta, verso valle. Niente più prove: ma all’alba voterai anche tu.' });
  ctx.ui.show({ art: 'rifAlba', kicker: 'Verso Castelluccio', title: `${nameOf(ctx.player(pid))} esce nella tormenta`,
    text: ciaspole ? 'Ai piedi ha le vecchie ciaspole del guardiano, quelle trovate sulla soglia quando avete aperto la porta. Affondano poco, scivolano bene. Forse ce la farà.'
      : 'Senza ciaspole, la neve arriva alle ginocchia. La porta si richiude. Il muro bussa due volte, piano, come per dire: auguri.' });
  ctx.sfx('whoosh');
  await ctx.advance();
  return 'siege';
}

// ---------- temptation, redemption, the returnee’s memory ----------
async function turn(ctx, pid) {
  const { g } = ctx.state;
  ctx.sendCard(pid, { tone: 'danger', title: '❄️ SEI PASSATO AL GELO', lines: [
    `La Cosa è ${nameOf(ctx.player(g.cosa))}.`, 'Obiettivo: all’alba la Cosa deve essere ancora nel rifugio. Se ce la fate, non sentirai mai più freddo.',
    'Da ora puoi sabotare le prove e mentire sui colpi.', `Mestiere (di copertura): ${g.trade[pid]}`,
  ] });
  ctx.setState({ objectives: { ...ctx.state.objectives, [pid]: TURNED_GOAL } });
  addCardLines(ctx, g.cosa, [`❄️ ${nameOf(ctx.player(pid))} si è unito a te. Copritevi a vicenda.`]);
}

const SIDES = {
  traitors: (ctx) => [ctx.state.g?.cosa, ...(ctx.state.turned ?? [])].filter(Boolean),
  loyalWon: (s) => Boolean(s.flags?.cosaOut),
  extraTraitor: async (ctx, pid) => { ctx.setState({ turned: [...(ctx.state.turned ?? []), pid] }); await turn(ctx, pid); },
};

async function redemption(ctx) {
  const { g } = ctx.state;
  ctx.ui.show({ art: 'rifAlba', kicker: 'Uno spiraglio', title: 'La luna entra dalla finestra', text: 'Per un attimo la tormenta si apre. Chi ha il cuore gelato sente qualcosa sciogliersi. Tutti: guardate il telefono e scegliete, senza farvi vedere.' });
  ctx.sfx('reveal');
  const { answers } = await ctx.collect({ time: 25,
    screenFor: (p) => (isTurned(ctx, p.pid)
      ? { kind: 'choice', style: 'vote', title: 'Puoi tornare umano', text: 'Rompi il patto e torni col gruppo. La Cosa saprà che qualcuno l’ha tradita, ma non chi.', options: ['🌅 Torno umano', '❄️ Resto col gelo'] }
      : { kind: 'choice', style: 'vote', title: 'La luna sul rifugio', text: 'Scegli pure: serve solo a non far capire chi ha ricevuto un’offerta.', options: ['🌕 Guardo la luna', '🔥 Guardo il fuoco'] }) });
  const back = ctx.state.turned.filter((pid) => answers.get(pid)?.value === 0);
  for (const pid of back) {
    ctx.sendCard(pid, { tone: 'secret', title: '🌅 SEI TORNATO UMANO', lines: [`La Cosa è ${nameOf(ctx.player(g.cosa))}. Sa che qualcuno l’ha tradita.`, `🎯 Obiettivo: ${REDEEMED_GOAL.text}`, `Mestiere: ${g.trade[pid]}`] });
    ctx.setState({ objectives: { ...ctx.state.objectives, [pid]: REDEEMED_GOAL } });
  }
  if (back.length) {
    ctx.setState({ turned: ctx.state.turned.filter((pid) => !back.includes(pid)), redeemed: [...ctx.state.redeemed, ...back] });
    setFlags(ctx, { redeemed: true });
    addCardLines(ctx, g.cosa, ['💔 Qualcuno ha rotto il patto con te. Non sai chi.']);
  }
  ctx.ui.show({ art: 'rifMuro', kicker: 'Le nuvole si richiudono', title: 'Qualcuno è tornato?', text: 'Forse sì, forse no. La stufa scalda un po’ di più. O è solo un’impressione.' });
  await ctx.advance({ phone: 'Guarda lo schermo 👀' });
  return 'offer';
}

async function memory(ctx) {
  const { g } = ctx.state;
  const r = ctx.player(g.rientrato);
  if (r.pid === g.cosa) {
    addCardLines(ctx, r.pid, ['🌀 Ricordo da inventare: racconta un volto nella neve. Scegli tu chi incastrare.']);
  } else {
    const decoys = ctx.players().filter((p) => p.pid !== r.pid && p.pid !== g.cosa);
    const pair = shuffle([ctx.player(g.cosa), decoys.length ? pickOne(decoys, ctx.rng) : null].filter(Boolean), ctx.rng);
    addCardLines(ctx, r.pid, [`🌀 Ricordo: nella neve c’erano due figure, ${pair.map((p) => p.name).join(' e ')}. Una delle due non lasciava impronte.`]);
  }
  ctx.ui.show({ art: 'rifugio', kicker: 'Il ricordo del rientrato', title: `${r.name} si tiene la testa`,
    text: `Un lampo, poi un altro. ${r.name} ricorda qualcosa dell’ora persa nella neve: lo trova scritto sulla sua carta. Lo racconterà? E sarà un ricordo vero, o uno… prestato?` });
  ctx.flash(); ctx.sfx('thunder');
  await ctx.advance({ phone: 'Il rientrato ricorda qualcosa… 🌀' });
  return 'door';
}

// ---------- dawn: expulsion and consequences ----------
const OFFER_LINES = {
  tea: '🍵 La tazza lasciata al Mazzamurello, al mattino, è vuota e lavata.',
  wood: '🪵 Il ciocco offerto al muro è sparito: in cambio, nella cesta ce ne sono due.',
  coin: '🪙 La moneta restituita brilla in una fessura del muro: il Mazzamurello ringrazia.',
};

function valleyLine(ctx) {
  const { sentDown, valleyReached } = flags(ctx);
  if (!sentDown) return '🎿 Nessuno è sceso a valle: eravate troppo pochi per separarvi.';
  const who = nameById(ctx, sentDown);
  if (valleyReached) return `🎿 ${who} ha raggiunto la valle e ha dato l’allarme.`;
  if (isCosa(ctx, sentDown)) return `🎿 ${who} è sceso verso valle… ma a valle non è mai arrivato nessuno.`;
  return `🎿 ${who} ha girato in tondo tutta la notte: all’alba bussa alla porta, mezzo congelato ma vivo.`;
}

function consequences(ctx) {
  const f = flags(ctx);
  const s = ctx.state;
  return [
    f.answered ? '🔨 Avete risposto ai colpi: il Mazzamurello vi ha preso in simpatia.' : '🔨 Avete ignorato i colpi: il muro ha bussato offeso fino all’alba.',
    f.doorOpened ? '🚪 Avete aperto la porta: sulla soglia c’erano solo le ciaspole del vecchio guardiano.' : '🚪 La porta è rimasta chiusa: sulla neve, impronte che girano tre volte intorno al rifugio.',
    ...s.knocks.map((k) => (k.truthful ? `🗣️ ${nameById(ctx, k.pid)} ha tradotto i colpi senza mentire.` : `🤥 ${nameById(ctx, k.pid)} ha mentito sui colpi.`)),
    f.drank ? `🍵 ${nameById(ctx, f.drank)} aveva bevuto dalla tazza fumante: per questo i colpi hanno scelto il suo telefono.` : null,
    f.treasure ? `💰 Sotto la terza asse c’era una cassetta, e la chiave di ${nameById(ctx, s.g.rientrato)} la apriva.` : null,
    !f.treasure && f.floorHint ? '🪵 La terza asse è rimasta al suo posto. Chissà cosa c’era sotto.' : null,
    f.tableBurned ? '🪑 Avete bruciato il tavolo, come dicevano i colpi. Stamattina è di nuovo al suo posto.' : null,
    f.radio === 'both-share' ? '📻 Il vostro SOS via radio è arrivato fino a Visso.' : null,
    f.lockedOut ? `🪓 ${nameById(ctx, f.lockedOut)} ha passato la notte chiuso in legnaia.` : null,
    f.valley ? valleyLine(ctx) : null,
    f.redeemed ? '🌅 Qualcuno che si era unito alla Cosa è tornato indietro.' : null,
    OFFER_LINES[f.offering] ?? null,
    s.legna > 0 ? `🪵 All’alba restano ${s.legna} ciocchi: il fuoco non si è mai spento.` : '❄️ La legna è finita prima dell’alba: avete bruciato anche le sedie.',
  ].filter(Boolean);
}

function settleExpulsion(ctx, valid, counts, top) {
  const { cosa } = ctx.state.g;
  const finalVotes = Object.fromEntries([...counts].filter(([, n]) => n > 0));
  for (const [pid, n] of Object.entries(finalVotes)) bump(ctx, pid, 'votesAgainst', n);
  const expelVotes = Object.fromEntries([...valid].map(([pid, a]) => [pid, a.value]));
  const expelled = top.length === 1 ? top[0] : null;
  const cosaOut = expelled === cosa;
  const innocentOut = Boolean(expelled) && !cosaOut && !isTurned(ctx, expelled);
  ctx.setState({ finalVotes, expelVotes, ore: 0 });
  setFlags(ctx, { expelled, cosaOut, innocentOut });
  for (const [pid, target] of Object.entries(expelVotes)) {
    if (target === cosa && pid !== cosa && !isTurned(ctx, pid)) ctx.addPoints(pid, POINTS.catch);
    else if (innocentOut && target === expelled) ctx.addPoints(pid, POINTS.wrongExpel);
  }
  if (!cosaOut) for (const pid of [cosa, ...ctx.state.turned]) ctx.addPoints(pid, pid === cosa ? POINTS.survive : POINTS.turnedSurvive);
  if (flags(ctx).offering === 'wood') addLegna(ctx, WOOD.giftBack);
  return { expelled, cosaOut };
}

async function expel(ctx) {
  const seconds = ctx.state.discussSeconds;
  ctx.ui.show({ art: 'rifPorta', kicker: `Discussione · ${Math.round(seconds / 60)} minuti`, title: 'Chi non è umano?',
    text: 'Sta per albeggiare. Mettete in fila certezze, patti, ricordi e colpi tradotti. Poi qualcuno uscirà da quella porta, e non rientrerà.' });
  ctx.sfx('reveal');
  const countdown = ctx.ui.timer(seconds);
  await ctx.advance({ label: 'Al voto ▶', phone: 'Discutete! Riguarda la tua carta 🔒', until: sleep(seconds * 1000) });
  countdown.stop();
  const { valid, counts, top } = await groupPick(ctx, { kicker: 'All’alba', title: 'Chi cacciamo nella neve?', candidates: ctx.players(), time: EXPEL_SECONDS,
    text: 'Votano tutti, anche chi è fuori. Chi vota un umano che viene cacciato perde punti.' });
  const { expelled, cosaOut } = settleExpulsion(ctx, valid, counts, top);
  const who = expelled ? ctx.player(expelled) : null;
  let title = 'Voti divisi: la porta resta chiusa';
  let text = 'Nessuno esce. Nessuno dorme. Il muro bussa, paziente.';
  if (who) {
    title = cosaOut ? `${who.name} NON ERA UMANO!` : `${who.name} ${isTurned(ctx, who.pid) ? 'era passato al gelo!' : 'era umano…'}`;
    text = cosaOut ? 'Appena varca la soglia, la sua ombra si allunga, si sfilaccia, e il vento se la porta via.' : 'La porta si richiude. Dal muro, tre colpi lenti. Sembrano una risata.';
  }
  ctx.ui.show({ art: 'rifPorta', kicker: who ? `Fuori nella neve: ${nameOf(who)}` : 'Nessuna maggioranza', title, text });
  ctx.flash();
  ctx.sfx(cosaOut ? 'fanfare' : 'roar');
  await ctx.advance();
  ctx.ui.show({ kicker: 'Le sei del mattino', title: 'Cosa ha lasciato la notte', body: el('ul', { class: 'epilogue' }, consequences(ctx).map((line) => el('li', {}, line))), layout: 'center' });
  ctx.sfx('reveal');
  await ctx.advance({ phone: 'Guarda cosa ha lasciato la notte 👀' });
  return 'finale';
}

// ---------- endings ----------
function rescueReason(ctx) {
  const f = flags(ctx);
  if (f.valleyReached) return `${nameById(ctx, f.sentDown)} ha dato l’allarme a valle`;
  if (f.radio === 'both-share') return 'il vostro SOS via radio è arrivato';
  return 'il fumo del camino, tenuto acceso come diceva il morto, si vedeva fino a Norcia';
}

const ENDINGS = [
  { id: 'mazzamurello', name: 'L’amico nel muro', art: 'rifTesoro', title: 'Il dono del Mazzamurello',
    when: (s) => F(s).cosaOut && F(s).treasure && (F(s).answered || F(s).offering === 'coin') && allTruth(s) && s.legna > 0,
    text: 'Avete risposto ai colpi, detto sempre il vero, cacciato la Cosa. All’alba il muro bussa un’ultima volta e dalla fessura rotola una chiave nuova: il rifugio è vostro. Ogni inverno, la sera della tormenta, apparecchiate per uno in più. Per un amico.' },
  { id: 'alba', name: 'Soccorso all’alba', art: 'rifAlba', title: 'Le pale dell’elicottero', when: (s) => F(s).cosaOut && rescued(s) && s.legna > 0,
    text: (ctx) => `All’alba il cielo si apre e un rumore di pale riempie la valle: ${rescueReason(ctx)}. Il soccorso alpino vi trova spettinati, affamati e vivi. Dall’elicottero vedete il rifugio rimpicciolire. E sentite, giurate, tre colpi.` },
  { id: 'tesoro', name: 'Il tesoro sotto l’asse', art: 'rifTesoro', title: 'Oro contro neve', when: (s) => F(s).cosaOut && F(s).treasure,
    text: 'Nessuno sa che siete lassù. Ma all’alba passa il gattista di Castelluccio, vede brillare una moneta d’oro… e per un marengo a testa vi porterebbe giù anche dalla vetta del Vettore. Salvi, e pure un po’ più ricchi.' },
  { id: 'superstiti', name: 'Superstiti', art: 'rifAlba', title: 'Giù a piedi, al primo sole', when: (s) => F(s).cosaOut,
    text: (ctx) => (ctx.state.legna > 0
      ? 'La Cosa è fuori e non bussa più. Nessuno verrà a prendervi, ma la tormenta si placa e scendete a piedi verso Castelluccio, in fila indiana, senza voltarvi. Per anni nessuno parlerà di quella notte.'
      : 'La Cosa è fuori, ma la legna è finita da ore: avete bruciato sedie, quaderni e perfino un paio di ciabatte. All’alba scendete a valle mezzi congelati, ridendo come matti. Salvi per un pelo… di stambecco.') },
  { id: 'innocente', name: 'La porta sbagliata', art: 'rifPorta', sad: true, title: 'Avete cacciato un umano', when: (s) => F(s).innocentOut,
    text: (ctx) => `${nameById(ctx, flags(ctx).expelled)} bussa alla porta per un’ora, chiamandovi per nome. Poi smette. La Cosa, seduta tra voi, si scalda le mani al fuoco e sorride. Quando arrivano i soccorsi contano le persone due volte, e i conti non tornano mai.` },
  { id: 'tavola', name: 'La tavola apparecchiata', art: 'rifTavola', sad: true, title: 'Il rifugio vuoto', when: () => true,
    text: (ctx) => `Quando i soccorritori sfondano la porta, il rifugio è vuoto. ${flags(ctx).tableBurned ? 'Il tavolo che avevate bruciato è al suo posto, apparecchiato' : 'La tavola è apparecchiata'} per ${ctx.players().length + 1}, le tazze ancora calde${flags(ctx).tableSeen ? ', proprio come qualcuno l’aveva vista quella notte' : ''}. Nessuna impronta. Nel muro, toc toc: c’è posto per uno in più.` },
];

function roleOf(ctx, pid) {
  const extra = pid === ctx.state.g.rientrato ? ' · il rientrato' : '';
  if (isCosa(ctx, pid)) return `👁️ La Cosa${extra}`;
  if (isTurned(ctx, pid)) return `❄️ Passato al gelo${extra}`;
  if (ctx.state.redeemed.includes(pid)) return `🌅 Tentato, poi tornato umano${extra}`;
  return `🧑 Umano${extra}`;
}

function allianceShare(ctx, other) {
  const { g, objectives } = ctx.state;
  const v = g.vouch[other];
  if (v?.who) return `giura che ${nameById(ctx, v.who)} è umano (l’ha visto ${v.proof})`;
  return `ti confida il suo obiettivo: «${isCosa(ctx, other) || isTurned(ctx, other) ? g.fakeGoal : objectives[other].text}»`;
}

function keepDiary(ctx, p) {
  const pool = ctx.players().filter((o) => o.pid !== p.pid && !isCosa(ctx, o.pid));
  if (pool.length) addCardLines(ctx, p.pid, [`📓 Nel quaderno, con la tua calligrafia: «${pickOne(pool, ctx.rng).name} è umano. Fidati.»`]);
}

const stolenRadio = (ctx, { thief }) => `${thief.name} intasca le batterie: ora ha l’unica torcia funzionante del rifugio. La radio tace.`;

// ---------- scenes ----------
// 30 min: intro → roles → answer → knockFloor → shed → diary → door → alliance → tempt → ration (→ treasure) → table → knockCosa → radio → valley (→ valleyPick) → siege → expel → finale.
// 60 min adds likely1, memory, an early knockCosa, lockVote/lockPick, roof, knockDead, redemption, offer and likely2.
function build(length) {
  const long = length === 60;
  const longScenes = {
    likely1: { type: 'likely', art: 'rifugio', title: 'sia già stato sostituito da qualcos’altro?', next: 'answer' },
    memory: { type: 'custom', run: memory },
    lockVote: { type: 'vote', art: 'rifPorta', title: 'Chiudiamo qualcuno in legnaia fino all’alba?', next: 'radio',
      text: 'Qualcuno propone di chiudere fuori il più sospetto: la legnaia è fredda ma riparata. Chi ci finisce salta le prove, ma all’alba voterà.',
      options: [{ label: '🔐 Sì, qualcuno va in legnaia', goto: 'lockPick' }, { label: '🙅 No, restiamo tutti dentro' }] },
    lockPick: { type: 'custom', run: lockPick },
    roof: { type: 'pool', art: 'rifugio', title: 'Il tetto geme', who: inside, next: 'knockDead',
      text: 'Un metro di neve sul tetto, e la trave centrale scricchiola come un vecchio. Qualcuno sale in soffitta a puntellarla, gli altri reggono la scala.',
      success: 'La trave tiene. In soffitta solo polvere e una foto del vecchio guardiano. Sorride. Prima non sorrideva.',
      fail: 'Una trave crolla sul tavolo e la neve finisce dritta nel camino. Le tazze, chissà come, restano intatte.',
      after: (ctx, r) => { passHour(ctx); if (!r.success) addLegna(ctx, WOOD.roof); } },
    knockDead: { type: 'custom', run: knock('dead', 'redemption') },
    redemption: { type: 'custom', run: redemption },
    offer: { type: 'vote', art: 'rifTavola', butterfly: true, title: 'Cosa lasciate sul tavolo per il muro?', next: 'valley',
      text: 'Il muro bussa piano, quasi educato. In paese si dice che al Mazzamurello, nelle notti di tormenta, si lascia sempre qualcosa sul tavolo.',
      options: [
        { label: '🍵 Una tazza di tè bollente', set: { offering: 'tea' } },
        { label: '🪵 Un ciocco di legna (l’ultimo buono)', set: { offering: 'wood' }, effect: (ctx) => addLegna(ctx, WOOD.gift) },
        { label: '🪙 Una moneta del tesoro', when: (ctx) => Boolean(flags(ctx).treasure), set: { offering: 'coin' } } ] },
    likely2: { type: 'likely', art: 'rifMuro', title: 'abbia mentito sui colpi stanotte?', next: 'expel' } };
  const afterRation = long ? 'lockVote' : 'table';
  const scenes = {
    intro: { type: 'narr', art: 'rifugio', kicker: 'Monti Sibillini · 1.900 metri · 21:40', title: 'Il Rifugio dei Colpi', sfx: 'thunder', next: 'roles',
      text: 'Doveva essere una ciaspolata con polenta finale. Poi la tormenta: il sentiero sparito, i telefoni senza campo, un rifugio di pietra sotto il Vettore. Siete al caldo, al sicuro. Quasi tutti. Perché uno di voi, stanotte, non è più uno di voi.' },
    roles: { type: 'custom', run: roles(long ? 'likely1' : 'answer') },
    answer: { type: 'vote', art: 'rifMuro', butterfly: true, title: 'Il muro bussa. Rispondete?', next: 'knockFloor',
      text: 'Tre colpi secchi, da dentro la parete. Silenzio. Altri tre. In paese dicono che il Mazzamurello bussa per annunciare un tesoro, un pericolo… o un morto che ha qualcosa da dire.',
      options: [{ label: '✊ Rispondiamo: toc, toc, toc', set: { answered: true } }, { label: '🧣 Tappiamo il muro con le coperte', set: { answered: false } }] },
    knockFloor: { type: 'custom', run: knock('floor', 'shed') },
    shed: { type: 'pool', art: 'rifugio', title: 'La legnaia sepolta', who: inside, next: 'diary',
      text: 'La legnaia è a dieci metri dalla porta, sotto un metro di neve. Bisogna scavare, spaccare, portare dentro. Tutti insieme, e in fretta.',
      success: 'Una catasta intera! Il fuoco ruggisce e per un po’ nessuno pensa ai colpi.',
      fail: (ctx, r) => `${r.sabotages ? 'Qualcuno ha fatto cadere l’accetta nella neve. Per sbaglio, dice.' : 'Troppo freddo, troppe mani gelate.'} Rientrate a mani vuote.`,
      after: (ctx, r) => { passHour(ctx); if (r.success) addLegna(ctx, WOOD.shed); } },
    diary: { type: 'spotlight', art: 'rifMuro', who: inside, title: 'Il quaderno del guardiano', next: long ? 'memory' : 'door',
      publicText: (ctx, p) => `Frugando nella credenza, ${p.name} trova un quaderno gonfio di umidità. Sulla prima pagina: «Registro del rifugio, inverno 1956».`,
      privateText: 'Le ultime pagine parlano dei colpi nel muro… e di chi c’era quella notte.',
      options: [
        { label: '📖 Lo leggo ad alta voce', outcomeTitle: '«Chi risponde, se lo fa amico»', outcome: '«Il Mazzamurello bussa per tre ragioni: un tesoro, un pericolo, un morto che vuole parlare. Non è cattivo. Ma la notte della tormenta, nel rifugio, eravamo uno di troppo.» Fine del quaderno.' },
        { label: '🔥 Lo brucio: fa un freddo cane', effect: (ctx) => addLegna(ctx, WOOD.diary), outcomeTitle: 'Brucia benissimo', outcome: 'La carta del ’56 fa una fiamma verde e allegra. Un ciocco guadagnato, un mistero perso. Il muro bussa una volta sola, seccato.' },
        { label: '🤫 Lo tengo per me', effect: keepDiary, outcomeTitle: 'Il quaderno sparisce in una tasca', outcome: (ctx, p) => `${p.name} giura che dentro c’erano solo ricette di polenta. Nessuno ci crede.` } ] },
    door: { type: 'vote', art: 'rifPorta', butterfly: true, title: 'Bussano alla porta. Aprite?', next: long ? 'knockCosa' : 'alliance',
      text: 'Stavolta i colpi non vengono dal muro, ma dalla porta. Una voce, fuori, chiama per nome ognuno di voi. Anche chi è seduto qui dentro.',
      options: [
        { label: '🚪 Apriamo: là fuori si muore', set: { doorOpened: true }, effect: (ctx) => addLegna(ctx, WOOD.door) },
        { label: '🔒 Non apriamo a nessuno', set: { doorOpened: false } } ] },
    knockCosa: { type: 'custom', run: knock('cosa', long ? 'alliance' : 'radio') },
    alliance: { type: 'alliance', art: 'rifugio', title: 'Di chi vi fidate?', share: allianceShare, next: 'tempt',
      text: 'Indicate in segreto una persona. Se anche lei sceglie voi, nasce un patto: vi scambierete una certezza, o un segreto.' },
    tempt: { type: 'tempt', art: 'rifMuro', title: 'Una voce gelida', cap: 1, onAccept: turn, who: humansInside, next: 'ration',
      publicText: 'La stufa si abbassa da sola. Fa freddo, un freddo che viene da dentro. Alcuni di voi sentono una voce, vicinissima all’orecchio…',
      offerTitle: '❄️ «Vieni con me»',
      offerText: 'Unisciti a me. Niente più freddo, né fame, né paura. Devi solo fare in modo che all’alba io sia ancora qui dentro.' },
    ration: { type: 'vote', art: 'rifugio', title: 'La legna non basta fino all’alba. Che si fa?', next: afterRation,
      text: (ctx) => `Nella cesta restano ${ctx.state.legna} ciocchi e mancano ${ctx.state.ore} ore all’alba. Fuori, la tormenta non accenna a calare.`,
      options: [
        { label: '🔥 Bruciamo senza pensarci: stanotte si gela', effect: (ctx) => { addLegna(ctx, WOOD.burn); for (const p of inside(ctx)) ctx.addPoints(p.pid, POINTS.cozy); } },
        { label: '🧮 Razioniamo: un ciocco all’ora, non di più', effect: (ctx) => addLegna(ctx, WOOD.ration) },
        { label: '🪓 Solleviamo la terza asse del pavimento', when: (ctx) => flags(ctx).floorHint && !flags(ctx).treasure, set: { treasure: true }, effect: (ctx) => addLegna(ctx, WOOD.planks), butterfly: true, goto: 'treasure' },
        { label: '🪑 Bruciamo il tavolo, come dicevano i colpi', when: (ctx) => Boolean(flags(ctx).tableHint), set: { tableBurned: true }, effect: (ctx) => addLegna(ctx, WOOD.table), butterfly: true } ] },
    treasure: { type: 'narr', art: 'rifTesoro', kicker: 'La terza asse', title: 'Un dono sotto il pavimento', sfx: 'fanfare', next: afterRation,
      text: (ctx) => `L’asse si solleva con un gemito. Sotto c’è una cassetta di latta, chiusa a chiave. ${nameById(ctx, ctx.state.g.rientrato)} fruga in tasca: la chiave arrugginita entra, gira. Monete d’oro, vecchie di secoli. ${flags(ctx).answered ? 'Dal muro, un colpo solo, soddisfatto.' : 'Dal muro, silenzio. Offeso.'}` },
    radio: { type: 'split', art: 'rifPorta', flag: 'radio', title: 'La vecchia radio', who: inside, next: long ? 'table' : 'valley',
      text: 'avete trovato la radio del guardiano e due sole batterie cariche.',
      privateText: 'Dividi: la accendete insieme e lanciate l’SOS. Ruba: tieni le batterie per la tua torcia (e per te).',
      outcomes: {
        'both-share': 'La radio gracchia, fischia… e una voce risponde: «Soccorso alpino, vi sentiamo. Tenete duro fino all’alba.»',
        'a-steals': stolenRadio, 'b-steals': stolenRadio,
        'both-steal': 'Vi strappate le batterie di mano, una vola nel camino e scoppia. La radio resta muta per sempre.' } },
    table: { type: 'spotlight', art: 'rifTavola', who: inside, title: 'La tavola apparecchiata', next: long ? 'roof' : 'knockCosa',
      publicText: (ctx, p) => `${p.name} va in cucina a scaldare l’acqua. Torna dopo un minuto, pallido. Non dice niente. Tutti aspettano…`,
      privateText: (ctx) => `La tavola è apparecchiata per ${ctx.players().length + 1}. Le tazze fumano. Nessuno di voi l’ha preparata.`,
      options: [
        { label: '📣 Chiamo tutti a vedere', set: { tableSeen: true }, outcomeTitle: 'Niente di niente', outcome: 'Quando arrivate, la tavola è vuota e pulita, le sedie in ordine, la teiera fredda da ore. Chi vi ha chiamato giura, spergiura e si offende.' },
        { label: '🍵 Mi siedo e bevo', butterfly: true, effect: (ctx, p) => setFlags(ctx, { drank: p.pid }), outcomeTitle: (ctx, p) => `${p.name} beve`, outcome: 'Il tè sa di neve e di ferro. Ma da questo momento, i colpi nel muro non sono più rumore: sono quasi parole.' },
        { label: '🧹 Sparecchio in silenzio', outcomeTitle: 'Le tazze sono calde', outcome: 'Lavate, asciugate, rimesse nella credenza. Dieci minuti dopo sono di nuovo sul tavolo. Ancora calde.' } ] },
    valley: { type: 'vote', art: 'rifAlba', butterfly: true, title: 'Mandiamo qualcuno giù a valle?', next: 'siege',
      text: 'Castelluccio è a tre ore di cammino, tormenta permettendo. Uno di voi potrebbe scendere a chiamare aiuto. Ma chi esce resta fuori: niente più prove col gruppo, solo il voto all’alba.',
      options: [{ label: '🎿 Sì: uno di noi scende a valle', set: { valley: true }, goto: 'valleyPick' }, { label: '🔥 No: restiamo tutti insieme', set: { valley: false } }] },
    valleyPick: { type: 'custom', run: valleyPick },
    siege: { type: 'pool', art: 'rifPorta', title: 'Qualcosa spinge la porta', who: inside, next: long ? 'likely2' : 'expel',
      text: 'Nell’ora più fredda, qualcosa si appoggia alla porta da fuori. Spinge. Il chiavistello geme. Tutti contro la porta!',
      success: 'La porta tiene. Fuori, un lamento si allontana nella tormenta… o era il vento?',
      fail: (ctx, r) => `${r.sabotages ? 'Qualcuno ha mollato la presa al momento giusto. O sbagliato.' : 'Le gambe tremano, il chiavistello cede.'} La neve entra a ondate e spegne mezzo camino.`,
      after: (ctx, r) => { passHour(ctx); if (!r.success) addLegna(ctx, WOOD.flood); } },
    expel: { type: 'custom', run: expel },
    finale: { type: 'ending', endings: ENDINGS, roleOf, next: 'end' },
    end: { type: 'end', phoneTitle: 'È l’alba!' },
    ...(long ? longScenes : {}),
  };
  const size = long ? 60 : 30;
  return {
    start: 'intro',
    sides: SIDES,
    scenes,
    hideScores: true,
    initialState: () => ({ flags: {}, stats: {}, knocks: [], translators: [], exiled: [], turned: [], redeemed: [], ...START[size], discussSeconds: DISCUSS_SECONDS[size] }),
    hud: (ctx) => {
      const s = ctx.state;
      const out = s.exiled?.length ? ` · 🌨️ Fuori: ${s.exiled.length}` : '';
      return `🪵 Legna: ${s.legna} · ${s.ore > 0 ? `❄️ ${s.ore} ore all’alba` : '🌅 Alba'} · 🔨 Colpi: ${s.knocks?.length ?? 0}${out}`;
    },
  };
}

export default {
  id: 'rifugio',
  title: 'Il Rifugio dei Colpi',
  blurb: 'Tormenta sui Sibillini: una Cosa tra voi, un muro che bussa in codice e chi lo traduce può mentire. 6 finali.',
  cover: 'rifugio',
  theme: 'horror',
  minPlayers: 3,
  build,
};
