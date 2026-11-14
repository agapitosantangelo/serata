// Adventure engine scene handlers: pooled tests, spotlight choices, alliances,
// split or steal, temptations and data-driven endings. Each resolves to the next scene id.
import { el, sleep } from '../dom.js';
import { pickOne, shuffle, tallyKeys, topKeys } from '../logic.js';
import {
  drawDestiny, resolvePool, poolNeed, resolveSplit, mutualPacts, pickEnding, computeTitles, pickTempted,
} from '../adventure-logic.js';
import { val, nextOf } from './scenes.js';
import { setFlags, bump, addCardLines } from './state.js';

const POOL_VALUES = ['help', 'watch', 'sabotage'];
const POOL_LABELS = ['🤝 Aiuta', '👀 Resta a guardare', '🗡️ Sabota'];
const POINTS = { help: 100, sabotage: 150, share: 300, steal: 600, objective: 400 };

const nameOf = (p) => `${p.avatar} ${p.name}`;

/** Group test: everyone secretly helps, watches or sabotages; only totals are shown. */
export async function pool(scene, ctx) {
  const title = val(scene.title, ctx);
  const participants = (scene.who ? scene.who(ctx) : ctx.active()).filter((p) => p.connected);
  const need = poolNeed(participants.length);
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: 'Prova di gruppo · scelta segreta', title,
    text: `${val(scene.text, ctx) ?? ''} Servono almeno ${need} punti: ogni aiuto vale 1, ogni sabotaggio toglie 2. E c’è una carta del destino, che può aiutare… o no.`.trim(),
  });
  ctx.sfx('drum');
  const { answers, targets } = await ctx.collect({
    time: scene.time ?? 25,
    players: participants,
    screen: { kind: 'choice', style: 'vote', title, text: val(scene.phone, ctx) ?? 'Scegli in segreto: sullo schermo si vedranno solo i totali.', options: POOL_LABELS },
  });
  const choices = new Map(targets.map((pid) => [pid, POOL_VALUES[answers.get(pid)?.value] ?? 'watch']));
  const result = resolvePool(choices, drawDestiny(ctx.rng), need);

  const scene2 = ctx.ui.show({ art: val(scene.art, ctx), kicker: 'Le carte vengono girate…', title });
  const cards = shuffle([
    ...Array(result.helps).fill('help'), ...Array(result.sabotages).fill('sabotage'), ...Array(result.watches).fill('watch'),
  ], ctx.rng);
  await ctx.ui.poolReveal(scene2.querySelector('.scene__content'), cards);
  scene2.querySelector('.scene__content').append(el('p', { class: 'pool-summary' },
    `🤝 ${result.helps} ${result.helps === 1 ? 'aiuto' : 'aiuti'} · 🗡️ ${result.sabotages} ${result.sabotages === 1 ? 'sabotaggio' : 'sabotaggi'} → ${result.net} su ${need} necessar${need === 1 ? 'io' : 'i'}`));
  await sleep(700);

  for (const [pid, choice] of choices) {
    bump(ctx, pid, 'pools');
    if (choice === 'help') { bump(ctx, pid, 'help'); if (result.success) ctx.addPoints(pid, POINTS.help); }
    if (choice === 'sabotage') { bump(ctx, pid, 'sabotage'); if (!result.success) ctx.addPoints(pid, POINTS.sabotage); }
  }
  if (scene.flag) setFlags(ctx, { [scene.flag]: result.success });
  ctx.sfx(result.success ? 'fanfare' : 'sad');
  await ctx.ui.banner(result.success ? 'Riuscita!' : 'Fallita!', result.success ? 'good' : 'bad', 1500);
  await scene.after?.(ctx, result);
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: result.success ? 'Prova riuscita' : 'Prova fallita',
    title: val(result.success ? scene.successTitle : scene.failTitle, ctx) ?? title,
    text: val(result.success ? scene.success : scene.fail, ctx, result),
  });
  await ctx.advance({ phone: result.sabotages ? 'Qualcuno ha sabotato… o è stata sfortuna? 🤔' : 'Guarda lo schermo 👀' });
  return (result.success ? scene.nextSuccess : scene.nextFail) ?? nextOf(scene, ctx, result);
}

/** One player alone faces a choice for everybody. */
export async function spotlight(scene, ctx) {
  const candidates = (scene.who ? scene.who(ctx) : ctx.active()).filter((p) => p.connected);
  if (!candidates.length) return nextOf(scene, ctx);
  const hero = pickOne(candidates, ctx.rng);
  const title = val(scene.title, ctx, hero);
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: `Riflettori su ${nameOf(hero)}`, title,
    text: val(scene.publicText, ctx, hero) ?? `${hero.name} è da solo davanti a una scelta. Tutti gli altri aspettano…`,
  });
  ctx.sfx('reveal');
  const { answers } = await ctx.collect({
    time: scene.time ?? 30, players: [hero],
    screen: { kind: 'choice', style: 'vote', title, text: val(scene.privateText, ctx, hero), options: scene.options.map((o) => val(o.label, ctx, hero)) },
  });
  const index = answers.get(hero.pid)?.value;
  const option = scene.options[Number.isInteger(index) && scene.options[index] ? index : (scene.defaultOption ?? 0)];
  setFlags(ctx, option.set);
  await option.effect?.(ctx, hero);
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: 'Conseguenze',
    title: val(option.outcomeTitle, ctx, hero) ?? title, text: val(option.outcome, ctx, hero),
  });
  ctx.sfx(option.sfx ?? 'whoosh');
  if (option.butterfly) ctx.ui.banner('🦋 Questa scelta avrà conseguenze…', 'neutral', 2000);
  await ctx.advance({ phone: 'Guarda lo schermo 👀' });
  return option.goto ?? nextOf(scene, ctx, option);
}

/** Everyone secretly names an ally; reciprocal picks become pacts that share information. */
export async function alliance(scene, ctx) {
  const players = ctx.active();
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: 'Alleanze segrete', title: val(scene.title, ctx) ?? 'Di chi vi fidate?',
    text: val(scene.text, ctx) ?? 'Indicate in segreto una persona. Se anche lei sceglie voi, nasce un patto: vi scambierete un’informazione segreta.',
  });
  ctx.sfx('whoosh');
  const options = players.map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const { answers } = await ctx.collect({
    time: scene.time ?? 30,
    screenFor: (p) => ({ kind: 'players', title: 'Con chi vuoi allearti?', options: options.filter((o) => o.pid !== p.pid) }),
  });
  const picks = new Map([...answers].filter(([pid, a]) => a.value && a.value !== pid).map(([pid, a]) => [pid, a.value]));
  const pacts = mutualPacts(picks);
  ctx.setState({ pacts: [...(ctx.state.pacts ?? []), ...pacts] });
  const inPact = new Set(pacts.flat());
  for (const [a, b] of pacts) {
    for (const [me, other] of [[a, b], [b, a]]) {
      bump(ctx, me, 'pact');
      const partner = ctx.player(other);
      addCardLines(ctx, me, [`🤝 Patto con ${partner.name}: ${val(scene.share, ctx, other) ?? 'vi coprite le spalle.'}`]);
      ctx.send(me, { kind: 'result', good: true, points: 0, title: `Patto con ${partner.avatar} ${partner.name}!`, text: 'Controlla la tua carta: c’è una novità.' });
    }
  }
  for (const pid of picks.keys()) {
    if (!inPact.has(pid)) ctx.send(pid, { kind: 'result', good: false, points: 0, title: 'Nessun patto', text: 'La tua fiducia non è stata ricambiata…' });
  }
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: 'Alleanze segrete',
    title: pacts.length ? `${pacts.length} patt${pacts.length === 1 ? 'o' : 'i'} segret${pacts.length === 1 ? 'o' : 'i'}` : 'Nessun patto',
    text: pacts.length ? 'Qualcuno ora sa qualcosa in più. Ma chi? E di chi si è fidato?' : 'Nessuno si fida di nessuno. Ottimo inizio.',
  });
  ctx.sfx('reveal');
  await ctx.advance({ phone: 'Guarda lo schermo 👀' });
  return nextOf(scene, ctx, pacts);
}

/** Split or steal between two players, both choices revealed. */
export async function split(scene, ctx) {
  const pool2 = (scene.who ? scene.who(ctx) : ctx.active()).filter((p) => p.connected);
  if (pool2.length < 2) return nextOf(scene, ctx);
  const [a, b] = shuffle(pool2, ctx.rng);
  const title = val(scene.title, ctx);
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: 'Dividi o Ruba', title,
    text: `${nameOf(a)} e ${nameOf(b)}: ${val(scene.text, ctx)} Ognuno sceglie in segreto. Se dividete, guadagnate entrambi. Se uno ruba, prende tutto. Se rubate entrambi… nessuno prende niente.`,
  });
  ctx.sfx('drum');
  const { answers } = await ctx.collect({
    time: scene.time ?? 30, players: [a, b],
    screen: { kind: 'choice', style: 'vote', title, text: val(scene.privateText, ctx), options: ['🤝 Dividi', '💰 Ruba'] },
  });
  const choiceOf = (p) => (answers.get(p.pid)?.value === 1 ? 'steal' : 'share');
  const ca = choiceOf(a);
  const cb = choiceOf(b);
  const outcome = resolveSplit(ca, cb);
  const scene2 = ctx.ui.show({ art: null, kicker: 'Dividi o Ruba', title, layout: 'center' });
  await ctx.ui.splitReveal(scene2.querySelector('.scene__content'), [{ player: a, choice: ca }, { player: b, choice: cb }]);
  if (outcome === 'both-share') { ctx.addPoints(a.pid, POINTS.share); ctx.addPoints(b.pid, POINTS.share); ctx.confetti(120); }
  if (outcome === 'a-steals') { ctx.addPoints(a.pid, POINTS.steal); bump(ctx, a.pid, 'steal'); }
  if (outcome === 'b-steals') { ctx.addPoints(b.pid, POINTS.steal); bump(ctx, b.pid, 'steal'); }
  if (outcome === 'both-steal') { bump(ctx, a.pid, 'steal'); bump(ctx, b.pid, 'steal'); }
  if (scene.flag) setFlags(ctx, { [scene.flag]: outcome });
  await sleep(1600);
  await scene.after?.(ctx, outcome, a, b);
  const thief = outcome === 'a-steals' ? a : outcome === 'b-steals' ? b : null;
  ctx.ui.show({ art: val(scene.art, ctx), kicker: 'Dividi o Ruba', title, text: val(scene.outcomes?.[outcome], ctx, { a, b, thief }) });
  ctx.sfx(outcome === 'both-share' ? 'fanfare' : 'reveal');
  await ctx.advance({ phone: 'Guarda lo schermo 👀' });
  return nextOf(scene, ctx, outcome);
}

/** A secret offer to switch sides: at most `cap` of those who accept actually switch. */
export async function tempt(scene, ctx) {
  const targets = (scene.who ? scene.who(ctx) : ctx.active()).filter((p) => p.connected);
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: 'Un’offerta nell’ombra', title: val(scene.title, ctx),
    text: val(scene.publicText, ctx) ?? 'Alcuni di voi stanno ricevendo un messaggio segreto. Leggetelo senza farvi vedere…',
  });
  ctx.sfx('reveal');
  const others = ctx.active().filter((p) => !targets.some((t) => t.pid === p.pid));
  for (const p of others) ctx.send(p.pid, { kind: 'wait', icon: '🤫', text: 'Fai finta di leggere qualcosa… nessuno deve capire chi ha ricevuto l’offerta.' });
  const { answers } = await ctx.collect({
    time: scene.time ?? 30, players: targets,
    screen: { kind: 'choice', style: 'vote', title: val(scene.offerTitle, ctx), text: val(scene.offerText, ctx), options: ['✅ Accetto', '❌ Rifiuto'] },
  });
  const accepted = [...answers].filter(([, a]) => a.value === 0).map(([pid]) => pid);
  const chosen = pickTempted(accepted, scene.cap ?? 1, ctx.rng);
  for (const pid of accepted) bump(ctx, pid, 'tempted');
  for (const pid of chosen) await scene.onAccept(ctx, pid);
  for (const pid of accepted.filter((x) => !chosen.includes(x))) {
    ctx.send(pid, { kind: 'result', good: false, points: 0, title: 'Troppo tardi', text: 'Qualcun altro ha già accettato l’offerta. Resti dalla parte del gruppo… per ora.' });
  }
  ctx.setState({ turned: [...(ctx.state.turned ?? []), ...chosen] });
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: 'Il messaggio è svanito', title: 'Qualcuno ha accettato?',
    text: 'Forse sì, forse no. Da questo momento, guardatevi le spalle.',
  });
  ctx.flash();
  await ctx.advance({ phone: 'Guarda lo schermo 👀' });
  return nextOf(scene, ctx, chosen);
}

/**
 * Optional exile: the group first decides whether to leave someone out, then picks who.
 * Exiled players are listed in state.exiled (stories skip them in pools) but still vote at the end.
 */
export async function exile(scene, ctx) {
  const players = ctx.active().filter((p) => !(ctx.state.exiled ?? []).includes(p.pid));
  const decide = ctx.ui.voteBoard([val(scene.yes, ctx) ?? 'Sì', val(scene.no, ctx) ?? 'No']);
  ctx.ui.show({ art: val(scene.art, ctx), kicker: val(scene.kicker, ctx) ?? 'Una decisione difficile', title: val(scene.title, ctx), text: val(scene.text, ctx), body: decide });
  const { answers } = await ctx.collect({ time: 25, screen: { kind: 'choice', style: 'vote', title: val(scene.title, ctx), options: [val(scene.yes, ctx) ?? 'Sì', val(scene.no, ctx) ?? 'No'] } });
  const yes = [...answers.values()].filter((a) => a.value === 0).length;
  const no = answers.size - yes;
  ctx.ui.revealVote(decide, [yes, no], yes > no ? 0 : 1);
  await sleep(1500);
  if (yes <= no) { await ctx.advance(); return nextOf(scene, ctx, null); }
  const board = ctx.ui.pickBoard(players);
  ctx.ui.show({ kicker: val(scene.kicker, ctx) ?? 'Una decisione difficile', title: val(scene.pickTitle, ctx) ?? 'Chi?', body: board, layout: 'center' });
  const options = players.map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const { answers: votes } = await ctx.collect({
    time: 35,
    screenFor: (p) => ({ kind: 'players', title: val(scene.pickTitle, ctx) ?? 'Chi?', options: options.filter((o) => o.pid !== p.pid) }),
  });
  const valid = new Map([...votes].filter(([pid, a]) => a.value !== pid));
  const counts = tallyKeys(valid, players.map((p) => p.pid));
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  await sleep(1800);
  if (top.length !== 1) {
    await ctx.ui.banner('Pareggio: nessuno viene lasciato indietro', 'neutral', 1800);
    await ctx.advance();
    return nextOf(scene, ctx, null);
  }
  const chosen = ctx.player(top[0]);
  ctx.setState({ exiled: [...(ctx.state.exiled ?? []), chosen.pid] });
  const voters = [...valid].filter(([, a]) => a.value === chosen.pid).map(([pid]) => pid);
  await scene.onExile?.(ctx, chosen.pid, voters);
  ctx.send(chosen.pid, { kind: 'wait', icon: '🚪', text: val(scene.exiledPhone, ctx) ?? 'Sei stato lasciato fuori. Niente più prove di gruppo, ma voterai alla fine.' });
  ctx.ui.show({ art: val(scene.art, ctx), kicker: val(scene.kicker, ctx) ?? 'Una decisione difficile', title: `${chosen.avatar} ${chosen.name}: ${val(scene.resultTitle, ctx) ?? 'lasciato indietro'}`, text: val(scene.resultText, ctx, chosen) });
  ctx.sfx('hit');
  await ctx.advance();
  return nextOf(scene, ctx, chosen.pid);
}

function epilogueBoard(ctx, scene) {
  return ctx.ui.playerCards(ctx.players(), (p) => {
    const objective = ctx.state.objectives?.[p.pid];
    const done = ctx.state.objectiveResults?.[p.pid];
    return el('ul', { class: 'epilogue' },
      el('li', {}, val(scene.roleOf, ctx, p.pid) ?? ''),
      objective ? el('li', {}, `${done ? '✔' : '✘'} ${objective.text}${done && (objective.points ?? POINTS.objective) > 0 ? ` (+${objective.points ?? POINTS.objective})` : ''}`) : null,
      scene.epilogue ? el('li', {}, val(scene.epilogue, ctx, p.pid)) : null);
  });
}

function titlesBoard(ctx) {
  const titles = computeTitles(ctx.state.stats ?? {});
  if (!titles.length) return el('p', {}, 'Nessun titolo assegnato: siete stati tutti fin troppo tranquilli.');
  return el('div', { class: 'titles-board' }, titles.map((t, i) => el('div', { class: 'title-card', style: { animationDelay: `${i * 0.25}s` } },
    el('div', { class: 'title-card__emoji' }, t.emoji),
    el('div', { class: 'title-card__name' }, t.title),
    el('div', { class: 'title-card__who' }, t.pids.map((pid) => ctx.player(pid)).filter(Boolean).map(nameOf).join(' · ')),
    el('div', { class: 'title-card__text' }, t.text))));
}

/** Pick the ending from accumulated flags, then objectives, per-player epilogues and titles. */
export async function ending(scene, ctx) {
  const chosen = pickEnding(scene.endings, ctx.state);
  setFlags(ctx, { ending: chosen.id });
  await chosen.effect?.(ctx);
  ctx.ui.show({ art: val(chosen.art, ctx), kicker: `Finale: ${val(chosen.name, ctx)}`, title: val(chosen.title, ctx), text: val(chosen.text, ctx) });
  ctx.flash();
  ctx.sfx(chosen.sad ? 'sad' : 'fanfare');
  if (!chosen.sad) ctx.confetti(180);
  await ctx.advance({ phone: 'Guarda lo schermo: il finale! 👀' });

  const results = {};
  for (const p of ctx.players()) {
    const objective = ctx.state.objectives?.[p.pid];
    if (!objective) continue;
    results[p.pid] = Boolean(objective.check(ctx, p.pid));
    if (results[p.pid]) ctx.addPoints(p.pid, objective.points ?? POINTS.objective);
  }
  ctx.setState({ objectiveResults: results });
  ctx.ui.show({ kicker: 'Ruoli e obiettivi segreti', title: 'Chi era chi', body: epilogueBoard(ctx, scene), layout: 'center' });
  ctx.sfx('reveal');
  await ctx.advance({ phone: 'Guarda chi era chi 👀' });

  ctx.ui.show({ kicker: 'I titoli della serata', title: 'E il premio va a…', body: titlesBoard(ctx), layout: 'center' });
  ctx.sfx('fanfare');
  await ctx.advance();
  return nextOf(scene, ctx, chosen);
}
