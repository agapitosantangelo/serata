// Optional Quiz Show mechanics: bets before a question and steals for the fastest right answer.
import { BET_LABELS, betAmount, stealAmount } from '../logic.js';

const BET_SECONDS = 10;
const STEAL_SECONDS = 12;

/** Everyone bets a share of their score before seeing the question. Returns Map pid -> stake. */
export async function collectBets(ctx, kicker) {
  ctx.ui.show({ kicker, title: '💰 Quanto scommetti?', text: 'Prima di vedere la domanda: se rispondi giusto vinci la puntata, se sbagli o non rispondi la perdi.', layout: 'center' });
  ctx.sfx('drum');
  const { answers, targets } = await ctx.collect({
    time: BET_SECONDS,
    screenFor: (p) => ({ kind: 'choice', style: 'vote', title: 'Quanto scommetti?', text: `Hai ${p.score.toLocaleString('it-IT')} punti.`, options: BET_LABELS }),
  });
  return new Map(targets.map((pid) => [pid, betAmount(ctx.player(pid)?.score ?? 0, answers.get(pid)?.value)]));
}

/** The fastest right answer picks a victim and steals points from them. */
export async function stealPhase(ctx, thiefPid) {
  const thief = ctx.player(thiefPid);
  const victims = ctx.active().filter((p) => p.pid !== thiefPid);
  if (!thief?.connected || !victims.length) return;
  ctx.ui.show({ kicker: '🦹 Furto!', title: `${thief.avatar} ${thief.name}: risposta più veloce!`, text: 'Ora sceglie a chi rubare i punti…', layout: 'center' });
  ctx.sfx('drum');
  const { answers } = await ctx.collect({
    time: STEAL_SECONDS, players: [thief],
    screen: { kind: 'players', title: 'A chi rubi i punti?', options: victims.map(({ pid, name, avatar }) => ({ pid, name, avatar })) },
  });
  const victim = ctx.player(answers.get(thiefPid)?.value) ?? victims.reduce((a, b) => (b.score > a.score ? b : a));
  const amount = stealAmount(victim.score);
  ctx.addPoints(victim.pid, -amount);
  ctx.addPoints(thiefPid, amount);
  ctx.send(victim.pid, { kind: 'result', good: false, points: -amount, title: 'Derubato!', text: `${thief.name} ti ha rubato ${amount} punti` });
  ctx.send(thiefPid, { kind: 'result', good: true, points: amount, title: 'Colpo riuscito!', text: `Hai rubato ${amount} punti a ${victim.name}` });
  await ctx.ui.banner(`🦹 ${thief.name} ruba ${amount} punti a ${victim.name}!`, 'neutral', 2200);
}
