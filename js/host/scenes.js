// Generic scene handlers. Each takes (scene, ctx) and resolves to the next scene id.
import {
  tally, winnerIndex, quizPoints, QUIZ_BASE_POINTS, shuffleQuestion, tallyKeys, topKeys, pickOne, shuffle, rank,
} from '../logic.js';
import { el, sleep } from '../dom.js';

const REVEAL_PAUSE_MS = 900;
const LIKELY_POINTS = 100;
const WRITE_VOTE_POINTS = 200;
const DICE_HERO_POINTS = 300;
const MAX_TEXT = 80;

export const val = (v, ctx) => (typeof v === 'function' ? v(ctx) : v);
const nextOf = (scene, ctx, result) => (typeof scene.next === 'function' ? scene.next(ctx, result) : scene.next);
const names = (players) => players.map((p) => `${p.avatar} ${p.name}`).join(' · ');

export async function narr(scene, ctx) {
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: val(scene.kicker, ctx), title: val(scene.title, ctx), text: val(scene.text, ctx),
  });
  ctx.sfx(scene.sfx ?? 'whoosh');
  await ctx.advance({ phone: val(scene.phone, ctx) ?? 'Guarda lo schermo 👀' });
  return nextOf(scene, ctx);
}

export async function vote(scene, ctx) {
  const title = val(scene.title, ctx);
  const options = scene.options.map((o) => val(o.label, ctx));
  const board = ctx.ui.voteBoard(options);
  ctx.ui.show({ art: val(scene.art, ctx), kicker: 'Votate dal telefono!', title, text: val(scene.text, ctx), body: board });
  ctx.sfx('whoosh');
  const { answers } = await ctx.collect({ time: scene.time ?? 25, screen: { kind: 'choice', style: 'vote', title, options } });
  const counts = tally(answers, options.length);
  const win = winnerIndex(counts, ctx.rng);
  ctx.ui.revealVote(board, counts, win);
  ctx.sfx('reveal');
  await sleep(REVEAL_PAUSE_MS);
  ctx.ui.banner(options[win], 'neutral');
  const chosen = scene.options[win];
  await chosen.effect?.(ctx);
  await ctx.advance();
  return chosen.goto ?? nextOf(scene, ctx, win);
}

export const DIFFICULTY = {
  1: { label: '🟢 Facile', mult: 1 },
  2: { label: '🟡 Media', mult: 1.5 },
  3: { label: '🔴 Difficile', mult: 2 },
};

/**
 * One multiple-choice question with scoring and reveal. Reused by quiz scenes and boss fights.
 * question.d (1-3) scales points; question.allCorrect makes every answer right (joke bonus questions).
 */
export async function askQuestion(ctx, question, { time = 20, multiplier = 1, risk = false, kicker, art, onReveal } = {}) {
  const q = question.allCorrect ? { ...question, options: shuffle(question.options, ctx.rng), answer: -1 } : shuffleQuestion(question, ctx.rng);
  const diff = DIFFICULTY[question.d];
  const label = question.allCorrect ? '⭐ Domanda bonus' : [kicker, diff?.label].filter(Boolean).join(' · ');
  const mult = multiplier * (diff?.mult ?? 1);
  const board = ctx.ui.quizBoard(q.options);
  ctx.ui.show({ art: art ?? null, kicker: label, title: q.q, body: board, layout: art ? 'split' : 'center' });
  ctx.sfx(question.allCorrect ? 'fanfare' : 'whoosh');
  const { answers, targets } = await ctx.collect({ time, screen: { kind: 'choice', style: 'quiz', title: q.q, options: q.options } });
  const counts = tally(answers, q.options.length);
  if (question.allCorrect) ctx.ui.revealAll(board, counts);
  else ctx.ui.revealQuiz(board, q.answer, counts);

  let correct = 0;
  for (const pid of targets) {
    const a = answers.get(pid);
    const ok = question.allCorrect ? a != null : a?.value === q.answer;
    // Risk rounds: a wrong answer costs the base points; not answering is safe.
    const pts = risk && a && !ok ? -Math.round(QUIZ_BASE_POINTS * mult) : quizPoints(ok, a?.ms ?? time * 1000, time * 1000, mult);
    if (ok) correct += 1;
    ctx.addPoints(pid, pts);
    ctx.send(pid, {
      kind: 'result', good: ok, points: pts,
      title: ok ? (question.allCorrect ? 'Tutte giuste, ovviamente! 😂' : 'Giusto!') : a ? 'Sbagliato!' : 'Tempo scaduto!',
      text: question.allCorrect ? 'Era una domanda bonus.' : `Risposta corretta: ${q.options[q.answer]}`,
    });
  }
  const total = targets.length;
  const good = total > 0 && correct * 2 >= total;
  ctx.sfx(good ? 'ding' : 'buzz');
  if (good && correct > 0) ctx.confetti(90);
  ctx.ui.banner(`${correct}/${total} giusti`, good ? 'good' : 'bad', 1300);
  await onReveal?.({ correct, total });
  await ctx.advance();
  return { correct, total };
}

export async function quiz(scene, ctx) {
  const questions = val(scene.questions, ctx);
  let correct = 0;
  let total = 0;
  for (const [i, question] of questions.entries()) {
    const r = await askQuestion(ctx, question, {
      time: scene.time ?? 20,
      multiplier: scene.multiplier ?? 1,
      risk: scene.risk ?? false,
      kicker: `${val(scene.kicker, ctx) ?? 'Quiz'} · ${i + 1}/${questions.length}`,
      art: question.art ?? val(scene.art, ctx),
    });
    correct += r.correct;
    total += r.total;
    ctx.setState({ quizCount: (ctx.state.quizCount ?? 0) + 1 });
  }
  const result = { correct, total, success: total > 0 && correct * 2 >= total };
  ctx.setState({ lastQuiz: result });
  await scene.after?.(ctx, result);
  return nextOf(scene, ctx, result);
}

export async function likely(scene, ctx) {
  const players = ctx.active();
  if (players.length < 3) return nextOf(scene, ctx);
  const title = val(scene.title, ctx);
  const board = ctx.ui.pickBoard(players);
  ctx.ui.show({ art: val(scene.art, ctx), kicker: 'Chi è più probabile che…', title, body: board });
  ctx.sfx('whoosh');
  const options = players.map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const { answers } = await ctx.collect({
    time: scene.time ?? 25,
    screenFor: (p) => ({ kind: 'players', title, options: options.filter((o) => o.pid !== p.pid) }),
  });
  const valid = new Map([...answers].filter(([pid, a]) => a.value !== pid));
  const counts = tallyKeys(valid, players.map((p) => p.pid));
  const winners = topKeys(counts);
  ctx.ui.revealPick(board, counts, winners);
  ctx.sfx('reveal');
  for (const [pid, a] of valid) {
    const withGroup = winners.includes(a.value);
    if (withGroup) ctx.addPoints(pid, LIKELY_POINTS);
    ctx.send(pid, {
      kind: 'result', good: withGroup, points: withGroup ? LIKELY_POINTS : 0,
      title: withGroup ? 'La pensi come il gruppo!' : 'Voto controcorrente',
      text: winners.length ? `Il gruppo ha scelto: ${names(winners.map(ctx.player))}` : '',
    });
  }
  if (winners.length) {
    await sleep(REVEAL_PAUSE_MS);
    ctx.ui.banner(`👑 ${names(winners.map(ctx.player))}`, 'neutral', 2200);
  }
  await ctx.advance();
  return nextOf(scene, ctx, winners);
}

export async function write(scene, ctx) {
  const title = val(scene.title, ctx);
  ctx.ui.show({ art: val(scene.art, ctx), kicker: 'Scrivete dal telefono!', title, text: val(scene.text, ctx) });
  ctx.sfx('whoosh');
  const { answers } = await ctx.collect({
    time: scene.time ?? 75,
    screen: { kind: 'text', title, max: MAX_TEXT, placeholder: val(scene.placeholder, ctx) ?? '' },
  });
  const entries = [...answers]
    .map(([pid, a]) => ({ pid, text: String(a.value ?? '').trim().slice(0, MAX_TEXT) }))
    .filter((e) => e.text);
  if (entries.length < 2) {
    await ctx.ui.banner('Troppe poche risposte! Si va avanti…', 'bad', 2000);
    return nextOf(scene, ctx, []);
  }
  const items = shuffle(entries, ctx.rng).map((e, i) => ({ id: `a${i}`, pid: e.pid, text: e.text }));
  const board = ctx.ui.answersBoard(items);
  ctx.ui.show({ kicker: 'Votate la migliore!', title, body: board, layout: 'center' });
  ctx.sfx('pop');
  const { answers: votes } = await ctx.collect({
    time: scene.voteTime ?? 30,
    screenFor: (p) => ({
      kind: 'rate', title: 'Vota la migliore (non la tua!)',
      options: items.filter((it) => it.pid !== p.pid).map(({ id, text }) => ({ id, text })),
    }),
  });
  const valid = new Map([...votes].filter(([pid, a]) => items.find((it) => it.id === a.value)?.pid !== pid));
  const counts = tallyKeys(valid, items.map((it) => it.id));
  const winners = topKeys(counts);
  ctx.ui.revealAnswers(board, counts, (id) => ctx.player(items.find((it) => it.id === id).pid), winners);
  for (const it of items) {
    const n = counts.get(it.id) ?? 0;
    ctx.addPoints(it.pid, WRITE_VOTE_POINTS * n);
    ctx.send(it.pid, {
      kind: 'result', good: winners.includes(it.id), points: WRITE_VOTE_POINTS * n,
      title: winners.includes(it.id) ? 'La tua è la migliore! 🏆' : `${n} vot${n === 1 ? 'o' : 'i'} per te`,
      text: `“${it.text}”`,
    });
  }
  if (winners.length) { ctx.sfx('fanfare'); ctx.confetti(140); }
  ctx.setState({ lastWrite: winners.map((id) => items.find((it) => it.id === id).text) });
  await ctx.advance();
  return nextOf(scene, ctx, winners);
}

export async function dice(scene, ctx) {
  const players = ctx.active();
  if (!players.length) return scene.nextFail ?? nextOf(scene, ctx);
  const hero = pickOne(players, ctx.rng);
  const target = val(scene.target, ctx);
  const title = val(scene.title, ctx);
  const bonus = val(scene.bonus, ctx) ?? 0;
  ctx.ui.show({
    art: val(scene.art, ctx), kicker: `Prova col dado · serve ${target} o più`, title,
    text: `${val(scene.text, ctx) ?? ''} ${hero.avatar} ${hero.name}, tocca a te: lancia il dado dal telefono!`.trim(),
  });
  ctx.sfx('drum');
  const { answers } = await ctx.collect({ time: 25, players: [hero], screen: { kind: 'dice', title: `${title} — serve ${target}+` } });
  const raw = answers.get(hero.pid)?.value;
  const roll = Number.isInteger(raw) && raw >= 1 && raw <= 20 ? raw : 1 + Math.floor(ctx.rng() * 20);
  await ctx.ui.dice(roll, `${hero.avatar} ${hero.name}`);
  const ok = roll + bonus >= target;
  if (ok) ctx.addPoints(hero.pid, DICE_HERO_POINTS);
  ctx.send(hero.pid, {
    kind: 'result', good: ok, points: ok ? DICE_HERO_POINTS : 0,
    title: ok ? 'Prova superata!' : 'Prova fallita…', text: `Hai fatto ${roll}${bonus ? ` + ${bonus}` : ''}`,
  });
  ctx.ui.show({
    art: val(scene.art, ctx),
    kicker: `${hero.avatar} ${hero.name} ha fatto ${roll}${bonus ? ` + ${bonus}` : ''}`,
    title: ok ? 'Successo!' : 'Fallimento!',
    text: val(ok ? scene.success : scene.fail, ctx),
  });
  if (ok) { ctx.sfx('fanfare'); ctx.confetti(80); } else await scene.onFail?.(ctx);
  await ctx.advance();
  return (ok ? scene.nextSuccess : scene.nextFail) ?? nextOf(scene, ctx, ok);
}

export async function end(scene, ctx) {
  const outcome = val(scene.outcome, ctx) ?? {};
  if (outcome.title) {
    ctx.ui.show({ art: outcome.art, kicker: 'Epilogo', title: outcome.title, text: outcome.text });
    ctx.sfx(outcome.sad ? 'sad' : 'fanfare');
    await ctx.advance({ phone: 'Guarda lo schermo: epilogo! 👀' });
  }
  const ranked = rank(ctx.players());
  const body = el('div', { class: 'final' }, ctx.ui.podium(ranked), ranked.length > 3 ? ctx.ui.leaderboard(ranked.slice(3)) : null);
  ctx.ui.show({ kicker: 'Classifica finale', title: ranked[0] ? `Vince ${ranked[0].name}!` : 'Fine!', body, layout: 'center' });
  ctx.sfx('fanfare');
  ctx.confetti(220);
  for (const p of ranked) {
    ctx.send(p.pid, { kind: 'end', rank: p.rank, of: ranked.length, score: p.score, title: val(scene.phoneTitle, ctx) ?? 'Partita finita!' });
  }
  await ctx.advance({ label: 'Torna alla lobby ↩' });
  return 'END';
}

export async function leaderboard(scene, ctx) {
  const ranked = rank(ctx.players());
  ctx.ui.show({ kicker: val(scene.kicker, ctx) ?? 'Classifica', title: val(scene.title, ctx) ?? 'Come siamo messi?', body: ctx.ui.leaderboard(ranked), layout: 'center' });
  ctx.sfx('reveal');
  for (const p of ranked) {
    ctx.send(p.pid, { kind: 'wait', icon: ['🥇', '🥈', '🥉'][p.rank - 1] ?? '📊', text: `Sei ${p.rank}° con ${p.score.toLocaleString('it-IT')} punti` });
  }
  await ctx.advance();
  return nextOf(scene, ctx);
}
