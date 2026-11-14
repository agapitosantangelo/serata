// La Notte del Noce: folk-horror nel Sannio. Una janara nascosta, il volo come tentazione, finali multipli.
import { el, sleep } from '../dom.js';
import { tally, winnerIndex, tallyKeys, topKeys, shuffle, pickOne } from '../logic.js';
import { setFlags, bump, addCardLines } from '../host/state.js';

const DISCUSS_SECONDS = { 30: 180, 60: 300 };
const ACCUSE_SECONDS = 45;
const COUNT_SECONDS = 30;
const RIDE_SECONDS = 25;
const REVEAL_MS = 1500;
const COUNT_RANGE = { min: 16, span: 12 };
const DECOY_RANGE = { min: 5, span: 6 };
const START_SALT = 1;
const SALT_TEST = 2; // sale necessario perché la prova del sale rompa un pareggio all’accusa
const POINTS = { catch: 500, wrongAccuse: -200, escape: 1500, flier: 1000, count: 150, woken: 200, repent: 400 };
const TOOLS = { sale: { icon: '🧂', item: 'chicchi di sale', unit: 'chicchi' }, scopa: { icon: '🌾', item: 'pagliuzze della scopa', unit: 'pagliuzze' }, };

const flags = (ctx) => ctx.state.flags ?? {};
const isJanara = (ctx, pid) => ctx.state.janara === pid;
const isFlier = (ctx, pid) => (ctx.state.turned ?? []).includes(pid);
const awake = (ctx) => ctx.active().filter((p) => !(ctx.state.exiled ?? []).includes(p.pid));
const fit = (ctx) => awake(ctx).filter((p) => !(ctx.state.exhausted ?? []).includes(p.pid));
const humans = (ctx) => ctx.players().filter((p) => !isJanara(ctx, p.pid));
const tag = (p) => `${p.avatar} ${p.name}`;
const brief = ({ pid, name, avatar }) => ({ pid, name, avatar });
const addSalt = (ctx, n) => ctx.setState({ salt: Math.max(0, (ctx.state.salt ?? 0) + n) });
const janaraName = (ctx) => ctx.player(ctx.state.janara)?.name ?? 'La janara';

// ---------- whispers (true hints) ----------
function humanHint(ctx, pid) {
  const pool = humans(ctx).filter((p) => p.pid !== pid);
  return pool.length ? pickOne(pool, ctx.rng) : null;
}

/** A strong whisper: the janara is one of two names. */
function pairHint(ctx, pid) {
  const janara = ctx.player(ctx.state.janara);
  const decoy = humanHint(ctx, pid);
  if (!janara || !decoy) return 'il vento ha coperto i nomi';
  const [a, b] = shuffle([janara, decoy], ctx.rng);
  return `la janara è ${tag(a)} oppure ${tag(b)}`;
}

function whisper(ctx, count, source) {
  const ears = shuffle(awake(ctx).filter((p) => !isJanara(ctx, p.pid) && !isFlier(ctx, p.pid)), ctx.rng).slice(0, count);
  for (const p of ears) {
    const h = humanHint(ctx, p.pid);
    if (h) addCardLines(ctx, p.pid, [`🌿 ${source} ${tag(h)} è umano.`]);
  }
}

function rewardEscape(ctx) {
  ctx.addPoints(ctx.state.janara, POINTS.escape);
  for (const pid of ctx.state.turned ?? []) ctx.addPoints(pid, POINTS.flier);
}

// ---------- shared voting helpers ----------
async function boardVote(ctx, { labels, phone = labels, time = 25, players, ...show }) {
  const board = ctx.ui.voteBoard(labels);
  ctx.ui.show({ ...show, body: board });
  const { answers } = await ctx.collect({ time, players, screen: { kind: 'choice', style: 'vote', title: show.title, options: phone } });
  return { board, answers, counts: tally(answers, labels.length) };
}

async function revealBoard(ctx, board, counts, win) {
  ctx.ui.revealVote(board, counts, win);
  await sleep(REVEAL_MS);
}

/** Everyone secretly names a player (never themselves). */
async function pickPlayer(ctx, { candidates, title, kicker, text, time }) {
  const board = ctx.ui.pickBoard(candidates);
  ctx.ui.show({ kicker, title, text, body: board, layout: 'center' });
  const { answers } = await ctx.collect({ time, screenFor: (p) => ({ kind: 'players', title, options: candidates.filter((o) => o.pid !== p.pid).map(brief) }) });
  const valid = new Map([...answers].filter(([pid, a]) => a.value !== pid));
  const counts = tallyKeys(valid, candidates.map((c) => c.pid));
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  await sleep(REVEAL_MS);
  return { valid, counts, top };
}

// ---------- roles & secret objectives ----------
const OBJECTIVES = [
  { id: 'unsuspected', text: 'Nessuno deve accusarti alla resa dei conti', check: (ctx, pid) => !(ctx.state.finalVotes ?? {})[pid] },
  { id: 'waker', text: 'Vota sempre per svegliare chi viene cavalcato', check: (ctx, pid) => { const s = ctx.state.stats?.[pid] ?? {}; return (s.wakeVotes ?? 0) === (s.wakeChances ?? 0); } },
  { id: 'counter', text: 'Conta giusto sulla soglia almeno una volta', check: (ctx, pid) => (ctx.state.stats?.[pid]?.counted ?? 0) > 0 },
  { id: 'pact', text: 'Stringi un patto con qualcuno', check: (ctx, pid) => (ctx.state.stats?.[pid]?.pact ?? 0) > 0 },
  { id: 'protect', text: 'Proteggi {X}: non deve essere accusato per sbaglio', check: (ctx, pid) => flags(ctx).caught || flags(ctx).accused !== ctx.state.protectTarget?.[pid] },
];
const JANARA_OBJECTIVE = { id: 'hidden', text: 'Non farti smascherare', check: (ctx) => !flags(ctx).caught, points: 0 };
const FLIER_OBJECTIVE = { id: 'flier', text: 'La janara non deve essere smascherata', check: (ctx) => !flags(ctx).caught, points: 0 };
const BACK_OBJECTIVE = { id: 'back', text: 'Rinnega il volo e smaschera la janara', check: (ctx) => Boolean(flags(ctx).caught) };
const REPENT_OBJECTIVE = { id: 'repent', text: 'Pentiti prima dell’alba', check: () => true, points: POINTS.repent };

function assignObjectives(ctx, pids, janara) {
  const deck = shuffle(OBJECTIVES, ctx.rng);
  const objectives = { [janara]: JANARA_OBJECTIVE };
  const protectTarget = {};
  pids.filter((pid) => pid !== janara).forEach((pid, i) => {
    const o = deck[i % deck.length];
    if (o.id !== 'protect') { objectives[pid] = o; return; }
    protectTarget[pid] = pickOne(pids.filter((x) => x !== pid), ctx.rng);
    objectives[pid] = { ...o, text: o.text.replace('{X}', ctx.player(protectTarget[pid]).name) };
  });
  return { objectives, protectTarget };
}

function cardFor(ctx, pid) {
  const line = ctx.state.whispers[pid];
  if (!isJanara(ctx, pid)) {
    return { tone: 'secret', title: '🕯️ Sei umano', lines: [`🌿 Sussurro della padrona: «${line}»`, `🎯 Obiettivo segreto: ${ctx.state.objectives[pid].text}`] };
  }
  return {
    tone: 'danger', title: '🌑 SEI LA JANARA', lines: [
      'Di notte cavalchi le cavalle e intrecci le criniere. Non farti smascherare!',
      'Sulla soglia dovrai contare sale o pagliuzze: se sbagli, resti bloccata lì fino all’alba.',
      'Nelle prove di gruppo puoi sabotare: le carte del destino ti coprono.',
      `🌑 Voce da spargere: «${line}»`,
    ],
  };
}

async function roles(ctx, scene) {
  const pids = ctx.active().map((p) => p.pid);
  const janara = pickOne(pids, ctx.rng);
  ctx.setState({ janara });
  const whispers = Object.fromEntries(pids.map((pid) => {
    const other = humanHint(ctx, pid) ?? ctx.player(pid);
    return [pid, pid === janara ? `Ho visto ${other.name} parlare col noce a mezzanotte` : `${other.name} è umano`];
  }));
  ctx.setState({ whispers, ...assignObjectives(ctx, pids, janara) });
  for (const pid of pids) ctx.sendCard(pid, cardFor(ctx, pid));
  ctx.ui.show({ art: 'noce', kicker: 'Carte segrete', title: 'Una di voi è già janara', text: 'Leggete la carta segreta sul telefono senza farla vedere. Gli umani hanno un sussurro vero e un obiettivo personale. La janara ha una voce falsa da spargere… e stanotte vuole cavalcare.', });
  ctx.sfx('drum');
  await ctx.advance({ phone: 'Leggi la tua carta segreta 🔒 (pulsante in basso)' }); return scene.next;
}

async function turnFlier(ctx, pid) {
  const janara = ctx.player(ctx.state.janara);
  const kept = (ctx.getCard(pid)?.lines ?? []).filter((l) => !l.startsWith('🎯'));
  ctx.sendCard(pid, {
    tone: 'danger', title: '🧹 HAI ACCETTATO IL VOLO',
    lines: [`La janara è ${tag(janara)}.`, 'Obiettivo: la janara NON deve essere smascherata. Se ce la fate, volerai per sempre.', 'Da ora puoi sabotare le prove di gruppo anche tu.', ...kept],
  });
  ctx.setState({ objectives: { ...ctx.state.objectives, [pid]: FLIER_OBJECTIVE } });
  addCardLines(ctx, janara.pid, [`🧹 ${tag(ctx.player(pid))} ha accettato il volo: ora vola con te.`]);
}

const SIDES = {
  traitors: (ctx) => [ctx.state.janara, ...(ctx.state.turned ?? [])].filter(Boolean),
  loyalWon: (s) => Boolean(s.flags?.caught) && !s.flags?.groupPact,
  extraTraitor: async (ctx, pid) => { ctx.setState({ turned: [...(ctx.state.turned ?? []), pid] }); await turnFlier(ctx, pid); },
};

// ---------- night watches in secret pairs (pool `after`) ----------
function watchLine(ctx, me, others, clear) {
  if (isJanara(ctx, me.pid)) return [`🌑 Turno con ${others.map(tag).join(' e ')}: sei sgattaiolata via per un’ora. Se ne sarà accorto qualcuno?`];
  return others.map((o) => {
    if (!isJanara(ctx, o.pid)) return `👁 Turno con ${tag(o)}: non si è mai mosso.`;
    if (clear || ctx.rng() < 0.5) return `👁 Turno con ${tag(o)}: è sparito per un’ora ed è tornato con le mani sporche di sale…`;
    return `😴 Turno con ${tag(o)}: ti sei addormentato. Non sai cosa abbia fatto.`;
  });
}

const watchAfter = (onSuccess) => async (ctx, result) => {
  const guards = shuffle(fit(ctx), ctx.rng);
  const n = Math.floor(guards.length / 2);
  const groups = Array.from({ length: n }, (_, i) => guards.slice(i * 2, i === n - 1 ? guards.length : i * 2 + 2));
  for (const group of groups) for (const me of group) addCardLines(ctx, me.pid, watchLine(ctx, me, group.filter((o) => o.pid !== me.pid), result.success));
  if (result.success) onSuccess?.(ctx);
  ctx.setState({ exhausted: [] });
};

// ---------- the threshold: salt or broom, and the count ----------
async function chooseTool(ctx) {
  const { board, counts } = await boardVote(ctx, {
    labels: ['🧂 Sale sulla soglia', '🧹 Scopa dietro la porta'], time: 20, art: 'nocSoglia', kicker: 'Le difese della nonna', title: 'Sale o scopa?',
    text: 'La padrona giura che una janara, davanti a una soglia protetta, deve contare ogni chicco di sale o ogni pagliuzza della scopa prima di entrare. Se sbaglia, resta lì fino all’alba.',
  });
  const win = winnerIndex(counts, ctx.rng);
  await revealBoard(ctx, board, counts, win);
  setFlags(ctx, { tool1: win === 0 ? 'sale' : 'scopa' });
  return flags(ctx).tool1;
}

async function threshold(ctx, scene) {
  const { night } = scene;
  const t = TOOLS[night === 1 ? await chooseTool(ctx) : (flags(ctx).tool1 === 'sale' ? 'scopa' : 'sale')];
  const count = COUNT_RANGE.min + Math.floor(ctx.rng() * COUNT_RANGE.span);
  const decoys = DECOY_RANGE.min + Math.floor(ctx.rng() * DECOY_RANGE.span);
  const items = shuffle([...Array(count).fill(t.icon), ...Array(decoys).fill('🌰')], ctx.rng);
  const grid = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '.4em', fontSize: '2.1rem', justifyContent: 'center', maxWidth: '32em', margin: '0 auto' } },
    items.map((icon) => el('span', {}, icon)));
  ctx.ui.show({ kicker: `Notte ${night} · la conta`, title: `Contate i ${t.item}!`, body: grid, layout: 'center', text: `Contate tutti, così nessuno capisce chi è la janara. Solo ${t.icon}: le noci 🌰 non valgono!` });
  ctx.sfx('tick');
  const { answers } = await ctx.collect({ time: COUNT_SECONDS, screen: { kind: 'text', title: `Quanti ${t.item}? (solo ${t.icon})`, max: 3, placeholder: 'un numero' } });
  const right = ctx.active().filter((p) => Number.parseInt(String(answers.get(p.pid)?.value ?? ''), 10) === count);
  for (const p of right) { bump(ctx, p.pid, 'counted'); ctx.addPoints(p.pid, POINTS.count); }
  setFlags(ctx, { [`held${night}`]: !right.some((p) => isJanara(ctx, p.pid)) });
  ctx.ui.show({
    art: 'nocSoglia', kicker: `Erano ${count} ${t.unit}`, title: right.length ? `Conta giusta per ${right.length}` : 'Nessuno ha contato giusto!',
    text: right.length ? `Hanno contato giusto: ${right.map(tag).join(' · ')}. Chi ha sbagliato… speriamo fosse solo distratto.`
      : 'Troppe noci, troppo buio. Se la janara ha sbagliato come voi, stanotte resterà sulla soglia a ricontare.',
  });
  ctx.sfx('reveal');
  await ctx.advance({ phone: 'Si spengono le candele… 🕯️' }); return scene.next;
}

// ---------- ridden in sleep: the others vote to wake the victim ----------
async function pickVictim(ctx, prey) {
  ctx.ui.show({ art: 'nocCavalcata', kicker: `Notte ${ctx.state.night}`, title: 'Zoccoli nel buio', text: 'Tutti dormono. Dalla stalla arriva un nitrito, poi un fruscio sotto le coperte. Qualcuno, stanotte, verrà cavalcato… Fate tutti finta di scegliere qualcosa sul telefono.', });
  ctx.sfx('thunder'); ctx.flash();
  const decoy = { kind: 'choice', style: 'vote', title: 'Cosa senti nel sonno?', options: ['🐴 Zoccoli', '🌬️ Vento', '🤫 Niente'] };
  const { answers } = await ctx.collect({ time: 20, screenFor: (p) => (isJanara(ctx, p.pid) ? { kind: 'players', title: 'Chi cavalchi stanotte?', options: prey.map(brief) } : decoy), });
  const chosen = answers.get(ctx.state.janara)?.value;
  return prey.find((p) => p.pid === chosen) ?? pickOne(prey, ctx.rng);
}

function wakeUp(ctx, victim, wakers) {
  const marked = pickOne(wakers, ctx.rng);
  const markedHuman = !isJanara(ctx, marked.pid);
  setFlags(ctx, { woke: true, ...(markedHuman ? { marked: marked.pid } : {}) });
  ctx.addPoints(victim.pid, POINTS.woken);
  addCardLines(ctx, victim.pid, [`👁 Svegliandoti hai intravisto chi ti cavalcava: ${pairHint(ctx, victim.pid)}.`]);
  if (markedHuman) addCardLines(ctx, marked.pid, ['🪢 Ti sei svegliato con una treccia nei capelli: hai preso il suo posto. Se il noce cade, il primo a rischiare sei tu.']);
  return { title: `${victim.name} si sveglia urlando!`,
    text: `Lo avete strappato al galoppo. ${victim.name} giura di aver visto un volto: controlla la sua carta. Ma all’alba qualcuno di quelli che l’hanno svegliato si ritrova una treccia tra i capelli…` };
}

function leaveRidden(ctx, victim) {
  ctx.setState({ exhausted: [...(ctx.state.exhausted ?? []), victim.pid] });
  addCardLines(ctx, victim.pid, ['😵 Hai galoppato tutta la notte: salterai la prossima prova di gruppo.']);
  return { title: 'Nessuno lo sveglia',
    text: `${victim.name} galoppa fino all’alba e si sveglia sudato, con le gambe di legno: salterà la prossima prova. Nella stalla, le criniere sono di nuovo intrecciate.` };
}

async function ridden(ctx, scene) {
  const { night } = scene;
  const prey = awake(ctx).filter((p) => !isJanara(ctx, p.pid));
  if (flags(ctx)[`held${night}`] || !prey.length) {
    ctx.ui.show({ art: 'nocSoglia', kicker: `Notte ${night}`, title: 'Qualcuno ha contato fino all’alba', text: 'Al mattino, sulla soglia, tutto è diviso in mucchietti ordinati. Nessuno è stato cavalcato: la janara è rimasta lì a ricontare tutta la notte. Ha sbagliato la conta… proprio come chi?', });
    ctx.sfx('reveal');
    ctx.setState({ night: 2 });
    await ctx.advance({ phone: 'Chi aveva sbagliato la conta? 🤔' }); return scene.next;
  }
  const victim = await pickVictim(ctx, prey);
  const voters = ctx.active().filter((p) => p.pid !== victim.pid);
  const cut = flags(ctx).braids === 'cut';
  const { board, answers } = await boardVote(ctx, {
    labels: ['🔔 Svegliamolo!', '😴 Lasciamolo dormire'], time: RIDE_SECONDS, players: voters, art: 'nocCavalcata', kicker: 'Voto segreto', title: `${tag(victim)} viene cavalcato!`,
    text: `Suda, si agita, ha i capelli intrecciati. Svegliarlo lo salva, ma chi lo sveglia rischia di prenderne il posto. ${cut ? 'Avete tagliato le trecce: le janare sono offese, serve che TUTTI vogliano svegliarlo.' : 'Basta la maggioranza.'}`,
  });
  const wakers = voters.filter((p) => answers.get(p.pid)?.value === 0);
  for (const p of voters) bump(ctx, p.pid, 'wakeChances');
  for (const p of wakers) bump(ctx, p.pid, 'wakeVotes');
  const woken = wakers.length > 0 && wakers.length >= (cut ? voters.length : Math.floor(voters.length / 2) + 1);
  await revealBoard(ctx, board, [wakers.length, voters.length - wakers.length], woken ? 0 : 1);
  const outcome = woken ? wakeUp(ctx, victim, wakers) : leaveRidden(ctx, victim);
  ctx.ui.show({ art: woken ? 'nocAlba' : 'nocStalla', kicker: `Alba dopo la notte ${night}`, ...outcome });
  ctx.sfx(woken ? 'fanfare' : 'sad');
  ctx.setState({ night: 2 });
  await ctx.advance({ phone: 'Controlla la carta: forse c’è una novità 🔒' }); return scene.next;
}

// ---------- 60 min: exile to the granary, redemption in the river ----------
async function granary(ctx, scene) {
  const { board, counts: [yes, no] } = await boardVote(ctx, {
    labels: ['🔐 Sì, chiudiamo qualcuno nel granaio', '🙅 No, fidiamoci'], phone: ['🔐 Sì', '🙅 No'], art: 'nocStalla', kicker: 'Il granaio', title: 'Chiudere qualcuno nel granaio fino all’alba?',
    text: 'Chi finisce dentro salta prove e scelte della notte, ma voterà alla resa dei conti. Se è umano, chi l’ha votato pagherà. E occhio: le janare passano dal buco della serratura.',
  });
  await revealBoard(ctx, board, [yes, no], yes > no ? 0 : 1);
  if (yes <= no) { await ctx.advance(); return scene.next; }
  const { valid, top } = await pickPlayer(ctx, { candidates: awake(ctx), time: 35, kicker: 'Il granaio', title: 'Chi chiudiamo nel granaio?' });
  if (top.length !== 1) {
    await ctx.ui.banner('Pareggio: il granaio resta vuoto', 'neutral', REVEAL_MS);
    await ctx.advance(); return scene.next;
  }
  const locked = ctx.player(top[0]);
  const human = !isJanara(ctx, locked.pid);
  ctx.setState({ exiled: [...(ctx.state.exiled ?? []), locked.pid] });
  if (human) for (const [pid, a] of valid) if (a.value === locked.pid) ctx.addPoints(pid, POINTS.wrongAccuse / 2);
  setFlags(ctx, { lockedJanara: !human });
  ctx.send(locked.pid, { kind: 'wait', icon: '🔐', text: 'Sei chiuso nel granaio. Niente prove, ma voterai alla resa dei conti.' });
  ctx.ui.show({ art: 'nocStalla', kicker: 'Il granaio', title: `${tag(locked)} finisce nel granaio`, text: 'Il chiavistello scatta. Dentro, solo topi e sacchi di grano. Se era la janara, lo scoprirete all’alba… sempre che il buco della serratura non le basti.', });
  ctx.sfx('hit');
  await ctx.advance(); return scene.next;
}

function washFliers(ctx, fliers) {
  const ids = fliers.map((p) => p.pid);
  if (!ids.length) return;
  ctx.setState({ turned: (ctx.state.turned ?? []).filter((pid) => !ids.includes(pid)), objectives: { ...ctx.state.objectives, ...Object.fromEntries(ids.map((pid) => [pid, BACK_OBJECTIVE])) }, });
  for (const p of fliers) {
    bump(ctx, p.pid, 'repent');
    addCardLines(ctx, p.pid, ['🌊 Ti sei lavato nel Sabato: sei di nuovo umano. Ora aiuta a smascherare la janara!']);
    addCardLines(ctx, ctx.state.janara, [`🌊 ${tag(p)} si è lavato nel fiume: non vola più con te.`]);
  }
}

async function redemption(ctx, scene) {
  const janara = ctx.player(ctx.state.janara);
  const offered = (pid) => isJanara(ctx, pid) || isFlier(ctx, pid);
  ctx.ui.show({ art: 'nocAlba', kicker: 'L’acqua del Sabato', title: 'Un’ultima possibilità', text: 'Prima della resa dei conti il fiume canta piano: l’acqua può lavare via qualsiasi patto. Qualcuno di voi riceve un’offerta. Tutti, fate finta di leggere.', });
  ctx.sfx('reveal');
  const offer = (pid) => ({ kind: 'choice', style: 'vote', title: 'Lavarti nel Sabato?', options: ['🌊 Mi lavo', '🌑 Resto com’ero'], text: isJanara(ctx, pid) ? 'Confessa e torna umana: niente più notti al noce.' : 'Rinneghi il volo e torni con il gruppo.' });
  const { answers } = await ctx.collect({ time: 25, screenFor: (p) => (offered(p.pid) ? offer(p.pid) : { kind: 'choice', style: 'vote', title: 'Senti il fiume cantare?', options: ['🌊 Sì', '🤫 No'] }), });
  const accepted = ctx.active().filter((p) => offered(p.pid) && answers.get(p.pid)?.value === 0);
  washFliers(ctx, accepted.filter((p) => !isJanara(ctx, p.pid)));
  if (janara && accepted.some((p) => p.pid === janara.pid)) {
    setFlags(ctx, { repented: true, caught: true, accused: janara.pid });
    ctx.setState({ objectives: { ...ctx.state.objectives, [janara.pid]: REPENT_OBJECTIVE } });
    ctx.ui.show({ art: 'nocAlba', kicker: 'Colpo di scena', title: `${tag(janara)} si immerge nel fiume!`, text: 'La janara esce dall’acqua tremando e confessa davanti a tutti. Le trecce delle cavalle si sciolgono da sole. Non servirà nessuna accusa.', });
    ctx.flash(); ctx.sfx('fanfare');
    await ctx.advance(); return 'finale';
  }
  ctx.ui.show({ art: 'nocAlba', kicker: 'L’acqua del Sabato', title: accepted.length ? 'Qualcuno si è lavato nel fiume' : 'Il fiume tace', text: accepted.length ? 'Sulla riva ci sono impronte bagnate. Qualcuno ha cambiato idea… ma chi?' : 'Nessuno si è bagnato i piedi. Chi aveva un patto, se lo tiene stretto.', });
  await ctx.advance({ phone: 'Guarda lo schermo 👀' }); return scene.next;
}

// ---------- the reckoning ----------
async function discuss(ctx, scene) {
  const seconds = ctx.state.discussSeconds;
  ctx.ui.show({ art: 'noce', kicker: `Discussione · ${Math.round(seconds / 60)} minuti`, title: 'Chi è la janara?', text: 'Confrontate sussurri, turni di guardia e conte sbagliate. La janara mentirà… e forse qualcuno vola con lei.', });
  ctx.sfx('reveal');
  const countdown = ctx.ui.timer(seconds);
  await ctx.advance({ label: 'Alla resa dei conti ▶', phone: 'Discutete! Riguarda la tua carta 🔒', until: sleep(seconds * 1000) });
  countdown.stop(); return scene.next;
}

async function accuse(ctx, scene) {
  const saltTest = (ctx.state.salt ?? 0) >= SALT_TEST;
  ctx.sfx('drum');
  const { valid, counts, top } = await pickPlayer(ctx, {
    candidates: ctx.players(), time: ACCUSE_SECONDS, kicker: 'La resa dei conti', title: 'Chi è la janara?',
    text: `Chi vota un umano che viene accusato perde punti. ${saltTest ? 'Avete abbastanza sale: in caso di pareggio, la prova del sale smaschera la janara.' : 'Poco sale: in caso di pareggio, nessuno viene accusato.'}`,
  });
  const finalVotes = Object.fromEntries([...counts].filter(([, n]) => n > 0));
  for (const [pid, n] of Object.entries(finalVotes)) bump(ctx, pid, 'votesAgainst', n);
  const salted = top.length > 1 && saltTest && top.includes(ctx.state.janara);
  const accused = top.length === 1 ? top[0] : (salted ? ctx.state.janara : null);
  const caught = accused === ctx.state.janara;
  ctx.setState({ finalVotes });
  setFlags(ctx, { caught, accused, salted });
  for (const [pid, a] of valid) {
    if (a.value === ctx.state.janara && !isFlier(ctx, pid)) ctx.addPoints(pid, POINTS.catch);
    else if (accused && a.value === accused && !caught) ctx.addPoints(pid, POINTS.wrongAccuse);
  }
  if (!caught) rewardEscape(ctx);
  const who = accused ? ctx.player(accused) : null;
  const title = who ? (caught ? `${who.name} È LA JANARA!` : `${who.name} era umano!`) : 'Voti divisi: nessuno viene accusato!';
  ctx.ui.show({ art: 'nocCavalcata', kicker: salted ? 'La prova del sale sfrigola…' : (who ? `Accusato: ${tag(who)}` : 'Nessuna maggioranza'), title });
  ctx.flash(); ctx.sfx(caught ? 'fanfare' : 'reveal');
  await ctx.advance(); return scene.next;
}

// ---------- endings ----------
function trappedText(ctx) {
  const f = flags(ctx);
  const wrongly = f.accused && f.accused !== ctx.state.janara ? f.accused : null;
  const victim = ctx.player(wrongly ?? f.marked);
  const who = victim ? `${victim.name}${wrongly ? '' : ', quello con la treccia nei capelli'}` : 'la cavalla più bella';
  return `Il ramo bruciato ha ferito il noce, e nessuno ha smascherato la janara per guarirlo. All’alba il tronco si spacca con un boato e si richiude su ${who}. Da dentro il legno arriva una risatina: ne uscirà alla prossima luna piena. Forse.`;
}

function fledText(ctx) {
  const f = flags(ctx);
  const why = f.guard === 'walnut' ? 'Eravate tutti sotto il noce: la stalla era vuota.' : 'La guardia alla stalla non è bastata.';
  const lock = f.washed === false ? ' Il lucchetto? Le janare passano dal buco della serratura.' : '';
  return `${janaraName(ctx)} salta in groppa alla cavalla più bella e sparisce al galoppo verso il Sabato, ridendo. ${why}${lock} ${f.braids === 'cut' ? 'Le trecce tagliate le hanno dato un motivo in più per vendicarsi.' : 'Lascia solo una treccia appesa alla porta.'}`;
}

function dawnText(ctx) {
  const f = flags(ctx);
  const how = f.repented ? 'si è lavata nel Sabato' : `è stata smascherata${f.salted ? ' dalla prova del sale' : ''}`;
  return `${janaraName(ctx)} ${how} e se ne va a piedi, senza più incantesimi. ${f.braids === 'cut' ? 'Le criniere tagliate ricresceranno lisce.' : 'Le trecce delle cavalle si sciolgono da sole.'} La padrona offre caffè e taralli a tutti.`;
}

const ENDINGS = [
  { id: 'blessing', name: 'La Benedizione del Noce (segreto)', art: 'nocAlba', title: 'Il Noce vi benedice',
    when: (s) => s.flags?.caught && s.flags?.braids === 'keep' && s.flags?.branch === 'spare' && s.flags?.woke,
    text: 'Avete rispettato le trecce, risparmiato il ramo e svegliato chi galoppava nel sonno. All’alba il noce lascia cadere una noce d’oro ai vostri piedi: finché resterà sul davanzale, nessuna janara entrerà più in questa casa.' },
  { id: 'coven', name: 'La nuova congrega', art: 'noce', title: 'Sopra l’acqua e sopra il vento', when: (s) => s.flags?.groupPact, effect: rewardEscape,
    text: 'Avete seguito la luce e accettato il patto. A mezzanotte volate tutti insieme sopra il Sabato, ridendo come matti. Al mattino la padrona trova le cavalle sudate… e le vostre scarpe piene di foglie di noce.' },
  { id: 'trapped', name: 'Il noce caduto', art: 'noce', sad: true, title: 'Il noce crolla', when: (s) => s.flags?.branch === 'burn' && !s.flags?.caught, text: trappedText },
  { id: 'dawn', name: 'L’alba umana', art: 'nocAlba', title: 'L’alba vi trova tutti umani', when: (s) => s.flags?.caught && !(s.turned ?? []).length, text: dawnText },
  { id: 'half', name: 'Qualcuno vola ancora', art: 'nocCavalcata', sad: true, title: 'La janara è presa… ma non era sola', when: (s) => s.flags?.caught,
    text: 'La janara viene smascherata e cacciata. Ma la notte dopo, sopra il Sabato, qualcuno vola ancora: chi aveva accettato il volo ha imparato bene la formula.' },
  { id: 'fled', name: 'La fuga a cavallo', art: 'nocCavalcata', sad: true, title: 'La janara fugge al galoppo', when: (s) => !s.flags?.stableSafe && !s.flags?.washed, text: fledText },
  { id: 'among', name: 'Tra voi', art: 'noce', sad: true, title: 'La janara resta tra voi', when: () => true,
    text: 'Le cavalle erano al sicuro, così la janara non ha potuto fuggire. Semplicemente, è rimasta. Domani farà colazione con voi, sorridendo. E alla prossima luna piena…' },
];

function roleOf(ctx, pid) {
  if (isJanara(ctx, pid)) return flags(ctx).repented ? '🌊 La janara (pentita nel Sabato)' : '🌑 La janara';
  if (isFlier(ctx, pid)) return '🧹 Ha accettato il volo';
  if (ctx.state.stats?.[pid]?.repent) return '🌊 Ha volato, poi si è lavato nel fiume';
  return '🕯️ Umano';
}

// ---------- scene graph ----------
const watchFail = (ctx, r) => `${r.sabotages ? 'Una lanterna si è spenta… da sola?' : 'Vi siete addormentati sulla paglia.'} Controllate la carta: ognuno sa con chi era di turno.`;
const STEAL_TEXT = (ctx, { thief }) => `${thief.name} intasca le monete. All’alba, nella sua tasca, ci sono solo foglie di noce.`;

function build(length) {
  const long = length === 60;
  const scenes = {
    intro: { type: 'narr', art: 'nocStalla', kicker: 'Agriturismo sul Sabato · mattina', title: 'La Notte del Noce', sfx: 'thunder', next: 'roles',
      text: 'Un weekend in agriturismo tra le colline del Sannio. Ma stamattina le cavalle sono fradicie di sudore, con le criniere intrecciate in nodi minuscoli. La padrona si fa il segno della croce e sussurra: «Sono tornate. Sotto il noce grande, vicino al fiume». E guarda proprio voi.' },
    roles: { type: 'custom', run: roles, next: long ? 'likely1' : 'braids' },
    likely1: { type: 'likely', art: 'nocCavalcata', title: 'sia già stato cavalcato stanotte senza accorgersene?', next: 'braids' },
    braids: { type: 'vote', art: 'nocStalla', title: 'Le criniere intrecciate: che fate?', butterfly: true, next: 'guard',
      text: 'La padrona vi supplica: «Non toccatele, le offendete!». Lo stalliere ha già le forbici in mano.',
      options: [{ label: '✂️ Tagliamo le trecce', set: { braids: 'cut' } }, { label: '🎀 Lasciamole stare', set: { braids: 'keep' } }] },
    guard: { type: 'vote', art: 'noce', title: 'Stanotte, dove fate la guardia?', butterfly: true,
      text: 'Si fa buio. Bisogna scegliere: proteggere le cavalle o spiare il grande noce, dove si radunano loro.',
      options: [
        { label: '🐴 Alla stalla, con le cavalle', set: { guard: 'stable' }, goto: 'guardStable' },
        { label: '🌳 Sotto il grande noce', set: { guard: 'walnut' }, goto: 'guardWalnut' },
      ] },
    guardStable: { type: 'pool', flag: 'stableSafe', art: 'nocStalla', title: 'Guardia alla stalla, a coppie', who: fit, after: watchAfter(), fail: watchFail, next: 'threshold1',
      text: 'Turni a coppie fino all’alba, lanterne accese e forche in mano. Le cavalle scalpitano.',
      success: 'Le cavalle dormono tranquille: nessuno le porterà al fiume. Controllate la carta: ognuno sa con chi era di turno.' },
    guardWalnut: { type: 'pool', flag: 'walnutWatched', art: 'noce', title: 'Appostati sotto il noce, a coppie', who: fit, fail: watchFail, next: 'threshold1',
      after: watchAfter((ctx) => whisper(ctx, 2, 'Dal noce, all’alba, hai visto che')),
      text: 'Nascosti tra le radici, a coppie, guardate la radura. Verso mezzanotte si accendono lucine verdi.',
      success: 'Avete visto ombre danzare… e qualche volto. Due di voi hanno un sussurro nuovo. Controllate la carta: ognuno sa con chi era di turno.' },
    threshold1: { type: 'custom', run: threshold, night: 1, next: 'ridden1' },
    ridden1: { type: 'custom', run: ridden, night: 1, next: long ? 'river' : 'light' },
    river: { type: 'vote', art: 'nocAlba', title: 'All’alba, le cavalle', butterfly: true, next: 'light',
      text: 'Lo stalliere dice che l’acqua del Sabato scioglie ogni incantesimo. Ma il fiume è gonfio e gelato.',
      options: [{ label: '🌊 Portiamole a lavarsi nel Sabato', set: { washed: true } }, { label: '🔒 Lucchetto alla stalla e via', set: { washed: false } }] },
    light: { type: 'vote', art: 'nocBosco', title: 'Una luce nel bosco', butterfly: true,
      text: 'Al tramonto del secondo giorno una lucina verde danza tra gli alberi, verso il fiume. Sembra chiamarvi per nome.',
      options: [{ label: '🕯️ Seguiamola', set: { light: 'follow' }, goto: 'woods' }, { label: '🚪 Restiamo chiusi in casa', set: { light: 'stay' }, goto: 'door' }] },
    woods: { type: 'spotlight', art: 'nocBosco', who: awake, title: 'Da solo nella radura', next: 'alliance',
      publicText: (ctx, p) => `Il gruppo si è perso tra i rovi. Solo ${p.name} arriva alla radura dove danza la luce. Cosa farà?`,
      privateText: 'La luce si ferma davanti a te. Sembra aspettare.',
      options: [
        { label: '👣 La seguo fino in fondo', effect: (ctx, p) => addCardLines(ctx, p.pid, [`🕯️ Nella radura hai visto chi danzava: ${pairHint(ctx, p.pid)}.`]),
          outcomeTitle: 'Torna pallido', outcome: (ctx, p) => `${p.name} riappare con una foglia di noce tra i capelli. Dice di aver visto qualcosa. Ma lo dirà a tutti?` },
        { label: '🧂 Le getto addosso il sale', effect: (ctx) => addSalt(ctx, 1), sfx: 'hit', outcomeTitle: 'Uno strillo nel buio', outcome: 'La luce strilla come una gatta e si spegne. Per terra resta un sacchetto di sale benedetto: +1 🧂.' },
        { label: '🏃 Scappo a gambe levate', outcomeTitle: 'Corsa nei rovi', outcome: (ctx, p) => `${p.name} torna di corsa, graffiato e senza fiato. Alle sue spalle, una risata.` },
      ] },
    door: { type: 'spotlight', art: 'nocSoglia', who: awake, title: 'Bussano alla porta', next: 'alliance',
      publicText: (ctx, p) => `A mezzanotte bussano tre volte. ${p.name} è il più vicino alla porta. Fuori, una vecchina chiede in prestito un pugno di sale…`,
      privateText: 'Nelle storie della nonna, chi presta il sale a una janara le apre la casa.',
      options: [
        { label: '🧂 Le presto il sale', set: { lentSalt: true }, effect: (ctx) => addSalt(ctx, -1), sfx: 'sad', outcomeTitle: '«Ci vediamo al noce»', outcome: 'La vecchina sorride con troppi denti e sparisce. Il sacchetto del sale è più leggero: −1 🧂.' },
        { label: '🧹 Metto la scopa di traverso', effect: (ctx, p) => addCardLines(ctx, p.pid, [`🧹 Mentre contava le pagliuzze, la vecchina ha borbottato: ${pairHint(ctx, p.pid)}.`]),
          outcomeTitle: 'Si mette a contare', outcome: (ctx, p) => `La vecchina si siede e conta le pagliuzze una per una, borbottando nomi. All’alba è sparita. ${p.name} avrà sentito qualcosa?` },
        { label: '🚪 Non apro', outcomeTitle: 'Tre colpi, poi niente', outcome: 'Passi leggeri si allontanano verso il fiume. Al mattino, sulla porta, c’è un graffio a forma di treccia.' },
      ] },
    alliance: { type: 'alliance', art: 'noce', share: (ctx, other) => `ti confida: «${ctx.state.whispers?.[other] ?? 'non so niente'}»`, next: long ? 'granary' : 'tempt' },
    granary: { type: 'custom', run: granary, next: 'tempt' },
    tempt: { type: 'tempt', art: 'nocCavalcata', title: 'Il Noce sussurra', cap: long ? 2 : 1, onAccept: turnFlier, next: 'branch',
      who: (ctx) => awake(ctx).filter((p) => !isJanara(ctx, p.pid) && !isFlier(ctx, p.pid)),
      publicText: 'Seconda notte. Il vento piega i rami del noce verso la casa, e alcuni di voi sentono una voce uscire dal telefono…',
      offerTitle: 'Il volo',
      offerText: '«Unguento, unguento…» Accetta il volo: andrai sopra l’acqua e sopra il vento. In cambio, la janara non dovrà essere smascherata.' },
    branch: { type: 'spotlight', art: 'noce', who: awake, title: 'Un ramo del noce', next: long ? 'threshold2' : 'mares',
      publicText: (ctx, p) => `${p.name} è sotto il noce con una torcia. Un ramo basso, carico di noci nere, pende verso di lui. Il gruppo trattiene il fiato.`,
      privateText: 'Bruciarlo indebolisce le janare… ma il Noce non dimentica.',
      options: [
        { label: '🔥 Brucio il ramo', set: { branch: 'burn' }, butterfly: true, sfx: 'thunder', outcomeTitle: 'Il noce urla',
          effect: (ctx) => addCardLines(ctx, ctx.state.janara, ['🔥 Hanno bruciato un ramo del noce: ti brucia la pelle.']),
          outcome: 'Il ramo scoppietta e il fumo sa di zolfo. Qualcuno di voi si gratta il braccio. Il tronco scricchiola, come se trattenesse il fiato.' },
        { label: '🎀 Lo risparmio e ci lego un nastro rosso', set: { branch: 'spare' }, butterfly: true, outcomeTitle: 'Il noce ringrazia', outcome: 'Il ramo si solleva piano, come una mano che saluta. Il vento cambia direzione.' },
      ] },
    threshold2: { type: 'custom', run: threshold, night: 2, next: 'ridden2' },
    ridden2: { type: 'custom', run: ridden, night: 2, next: 'formula' },
    formula: { type: 'write', art: 'nocBosco', title: 'Una controformula contro le janare', placeholder: 'Sale e scopa, janara…', next: 'mares', text: 'La nonna ricorda solo l’inizio: «Unguento, unguento…». Serve una rima nuova per tenerle lontane. La migliore la scriverete col gesso sulla porta.', },
    mares: { type: 'pool', flag: 'watch2', art: 'nocStalla', title: 'Le cavalle impazziscono', who: fit, fail: watchFail, next: 'treasure',
      after: watchAfter((ctx) => whisper(ctx, 2, 'Nella stalla hai notato che')),
      text: 'Seconda notte: le cavalle scalciano e nitriscono. Bisogna tenerle ferme, a coppie, fino al canto del gallo.',
      success: 'Le cavalle si calmano e nessuno le monta. Due di voi hanno notato qualcosa. Controllate la carta: ognuno sa con chi era di turno.' },
    treasure: { type: 'split', art: 'noce', flag: 'treasure', who: awake, title: 'Il tesoro sotto il noce', next: long ? 'redemption' : 'pact',
      text: 'scavando tra le radici del noce avete trovato una pignatta piena di monete antiche.',
      privateText: 'Dividi: il tesoro va a tutti e due (e sotto c’è sale benedetto). Ruba: lo tieni tu.',
      after: (ctx, outcome) => { if (outcome === 'both-share') addSalt(ctx, 1); },
      outcomes: { 'both-share': 'Dividete. Sotto le monete c’è un sacchetto di sale benedetto: +1 🧂 per la resa dei conti.', 'a-steals': STEAL_TEXT, 'b-steals': STEAL_TEXT, 'both-steal': 'Vi azzuffate e la pignatta si rompe: le monete diventano carbone.', } },
    redemption: { type: 'custom', run: redemption, next: 'likely2' },
    likely2: { type: 'likely', art: 'noce', title: 'venderebbe l’anima per volare sopra il Sabato?', next: 'pact' },
    pact: { type: 'vote', art: 'noce', title: 'Il Noce vi chiama tutti',
      text: 'Prima dell’alba il noce si illumina di verde. Una voce: «Volate con me. Niente più paura, niente più notti insonni».',
      options: [
        { label: '🌑 Accettiamo: saremo la nuova congrega', when: (ctx) => flags(ctx).light === 'follow', set: { groupPact: true }, goto: 'finale' },
        { label: '🔥 Mai! Smascheriamo la janara', goto: 'discuss' },
        { label: '🧂 Altro sale sulla soglia, e aspettiamo l’alba', effect: (ctx) => addSalt(ctx, 1), goto: 'discuss' },
      ] },
    discuss: { type: 'custom', run: discuss, next: 'accuse' },
    accuse: { type: 'custom', run: accuse, next: 'finale' },
    finale: { type: 'ending', endings: ENDINGS, roleOf, next: 'end' },
    end: { type: 'end', phoneTitle: 'È spuntata l’alba!' },
  };
  return {
    start: 'intro', scenes, hideScores: true, sides: SIDES,
    initialState: () => ({ flags: {}, stats: {}, salt: START_SALT, night: 1, exiled: [], exhausted: [], turned: [], whispers: {}, discussSeconds: DISCUSS_SECONDS[length] ?? DISCUSS_SECONDS[30] }),
    hud: (ctx) => {
      const f = flags(ctx);
      return `🌙 Notte ${ctx.state.night ?? 1}/2 · 🧂 ${ctx.state.salt ?? 0}${f.braids === 'cut' ? ' · ✂️' : ''}${f.branch === 'burn' ? ' · 🔥' : ''}${(ctx.state.exiled ?? []).length ? ' · 🔐' : ''}`;
    },
  };
}

export default {
  id: 'noce',
  title: 'La Notte del Noce',
  blurb: 'Agriturismo nel Sannio: una janara tra voi, cavalle stregate, sale sulla soglia e 7 finali.',
  cover: 'noce',
  theme: 'horror',
  minPlayers: 3,
  build,
};
