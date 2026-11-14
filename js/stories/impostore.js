// L'Impostore: everyone knows the secret word except one. Clue words, discussion, vote.
import { el, sleep } from '../dom.js';
import { pickOne, rank, tallyKeys, topKeys } from '../logic.js';
import { pickWord, turnOrder, isGuessCorrect, impostorScores } from './impostore-logic.js';

const ROUNDS = { 30: 5, 60: 10 };
const LAPS = 2;
const CLUE_SECONDS = 35;
const DISCUSS_SECONDS = { 30: 60, 60: 90 };
const VOTE_SECONDS = 40;
const GUESS_SECONDS = 30;
const MAX_WORD = 24;

function wordsBoard(order, ctx) {
  return el('div', { class: 'words-board' }, order.map((pid) => {
    const p = ctx.player(pid);
    return el('div', { class: 'words-row', 'data-pid': pid },
      el('span', { class: 'words-row__who' }, `${p.avatar} ${p.name}`),
      el('span', { class: 'words-row__words' }));
  }));
}

function addWord(board, pid, text) {
  const slot = board.querySelector(`[data-pid="${CSS.escape(pid)}"] .words-row__words`);
  slot?.append(el('span', { class: 'word-chip' }, text));
}

function setTurn(board, pid) {
  for (const row of board.children) row.classList.toggle('is-turn', row.dataset.pid === pid);
}

async function dealCards(ctx, players, impostor, category, word, round, total) {
  for (const p of players) {
    ctx.sendCard(p.pid, p.pid === impostor
      ? { tone: 'danger', title: '🎭 SEI L’IMPOSTORE', lines: [`Categoria: ${category}`, 'Non conosci la parola segreta.', 'Ascolta gli altri e bluffa: scrivi una parola che sembri giusta!'] }
      : { tone: 'secret', title: `🔤 ${word}`, lines: [`Categoria: ${category}`, 'Scrivi una parola collegata, ma non troppo ovvia: l’impostore ti sta ascoltando!'] });
  }
  ctx.ui.show({
    art: 'mask', kicker: `Round ${round} di ${total}`, title: `Categoria: ${category}`,
    text: 'Guardate la parola segreta sul telefono, senza farla vedere. Uno di voi non la conosce…',
  });
  ctx.sfx('drum');
  await ctx.advance({ phone: 'Leggi la tua carta 🔒 (pulsante in basso)' });
}

async function cluePhase(ctx, players, category) {
  const order = turnOrder(players.map((p) => p.pid), ctx.rng);
  const board = wordsBoard(order, ctx);
  const scene = ctx.ui.show({ kicker: `Categoria: ${category}`, title: 'Una parola a testa', body: board, layout: 'center' });
  const title = scene.querySelector('.scene__title');
  for (let lap = 1; lap <= LAPS; lap++) {
    for (const pid of order) {
      const p = ctx.player(pid);
      if (!p?.connected) continue;
      setTurn(board, pid);
      title.textContent = `Giro ${lap}/${LAPS} · tocca a ${p.avatar} ${p.name}`;
      const { answers } = await ctx.collect({
        time: CLUE_SECONDS, players: [p],
        screen: { kind: 'text', title: 'Scrivi UNA parola collegata', max: MAX_WORD, placeholder: 'una parola…' },
      });
      const text = String(answers.get(pid)?.value ?? '').trim().slice(0, MAX_WORD) || '…';
      addWord(board, pid, text);
      ctx.sfx('pop');
    }
  }
  setTurn(board, null);
  return board;
}

async function discussion(ctx, board, seconds) {
  ctx.ui.show({ kicker: `Discussione · ${seconds} secondi`, title: 'Chi sta bluffando?', body: board, layout: 'center' });
  ctx.sfx('reveal');
  const countdown = ctx.ui.timer(seconds);
  await ctx.advance({ label: 'Passiamo al voto ▶', phone: 'Discutete! Chi è l’impostore? 🕵️', until: sleep(seconds * 1000) });
  countdown.stop();
}

async function vote(ctx, players) {
  const options = players.map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const board = ctx.ui.pickBoard(players);
  ctx.ui.show({ kicker: 'Votazione', title: 'Chi è l’impostore?', body: board, layout: 'center' });
  const { answers } = await ctx.collect({
    time: VOTE_SECONDS,
    screenFor: (p) => ({ kind: 'players', title: 'Chi è l’impostore?', options: options.filter((o) => o.pid !== p.pid) }),
  });
  const valid = new Map([...answers].filter(([pid, a]) => a.value !== pid));
  const counts = tallyKeys(valid, players.map((p) => p.pid));
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  ctx.sfx('drum');
  await sleep(2000);
  return { votes: new Map([...valid].map(([pid, a]) => [pid, a.value])), top };
}

async function lastChance(ctx, impostor, category) {
  const p = ctx.player(impostor);
  ctx.ui.show({
    art: 'mask', kicker: 'Ultima chance', title: `${p.avatar} ${p.name}, indovina la parola!`,
    text: `Sei stato scoperto… ma se indovini la parola segreta (categoria: ${category}) ti salvi lo stesso!`,
  });
  ctx.sfx('reveal');
  const { answers } = await ctx.collect({
    time: GUESS_SECONDS, players: [p],
    screen: { kind: 'text', title: 'Qual è la parola segreta?', max: MAX_WORD, placeholder: 'la parola…' },
  });
  return String(answers.get(impostor)?.value ?? '').trim();
}

async function playRound(ctx, round, total) {
  const players = ctx.active();
  if (players.length < 3) {
    await ctx.ui.banner('Servono almeno 3 giocatori connessi', 'bad', 2400);
    return false;
  }
  const { category, word } = pickWord(ctx.state.used, ctx.rng);
  ctx.setState({ used: new Set([...ctx.state.used, word]), round });
  const impostor = pickOne(players, ctx.rng).pid;

  await dealCards(ctx, players, impostor, category, word, round, total);
  const board = await cluePhase(ctx, players, category);
  await discussion(ctx, board, ctx.state.discussSeconds);
  const { votes, top } = await vote(ctx, players);

  const caught = top.length === 1 && top[0] === impostor;
  const guess = caught ? await lastChance(ctx, impostor, category) : '';
  const guessed = caught && isGuessCorrect(guess, word);
  const scores = impostorScores({ impostor, caught, guessed, votes });
  for (const p of players) {
    const pts = scores.get(p.pid) ?? 0;
    ctx.addPoints(p.pid, pts);
    const isImp = p.pid === impostor;
    ctx.send(p.pid, {
      kind: 'result', good: pts > 0, points: pts,
      title: isImp ? (caught ? (guessed ? 'Scoperto, ma hai indovinato! 😎' : 'Ti hanno scoperto!') : 'Nessuno ti ha scoperto! 😈') : (pts ? 'Hai smascherato l’impostore!' : 'Non l’hai beccato…'),
      text: `La parola era: ${word}`,
    });
  }

  const imp = ctx.player(impostor);
  let title = `L’impostore era ${imp.avatar} ${imp.name}!`;
  if (caught) title = guessed ? `${imp.name} scoperto… ma ha indovinato!` : `Preso! ${imp.name} era l’impostore`;
  ctx.ui.show({
    art: 'mask', kicker: `La parola era: ${word}`, title,
    text: caught
      ? (guessed ? `Ha scritto «${guess}»: si salva per un pelo!` : `Ha provato con «${guess || '…'}». Niente da fare!`)
      : 'Il gruppo ha votato la persona sbagliata: l’impostore la fa franca.',
  });
  ctx.flash();
  ctx.sfx(caught && !guessed ? 'fanfare' : 'reveal');
  if (caught && !guessed) ctx.confetti(150);
  await ctx.advance();
  return true;
}

async function rounds(ctx) {
  const total = ctx.state.rounds;
  for (let round = 1; round <= total; round++) {
    const played = await playRound(ctx, round, total);
    if (!played) break;
    if (round < total) {
      ctx.ui.show({ kicker: `Dopo ${round} round`, title: 'Classifica provvisoria', body: ctx.ui.leaderboard(rank(ctx.players())), layout: 'center' });
      ctx.sfx('reveal');
      await ctx.advance({ label: 'Prossimo round ▶', phone: 'Guarda la classifica 📊' });
    }
  }
  for (const p of ctx.players()) ctx.sendCard(p.pid, null);
  return 'end';
}

function build(length) {
  return {
    start: 'intro',
    scenes: {
      intro: {
        type: 'narr', art: 'mask', kicker: 'Come si gioca', title: 'L’Impostore',
        text: 'Tutti ricevono la stessa parola segreta… tranne uno: l’impostore, che conosce solo la categoria. A turno scrivete una parola collegata (né troppo ovvia, né troppo vaga). Poi discutete e votate. Se l’impostore viene scoperto, può ancora salvarsi indovinando la parola!',
        next: 'rounds',
      },
      rounds: { type: 'custom', run: rounds },
      end: {
        type: 'end', phoneTitle: 'Fine dei giochi!',
        outcome: () => ({ art: 'mask', title: 'Smascherati tutti?', text: 'Chi è stato il bugiardo migliore della serata? Ecco la classifica…' }),
      },
    },
    initialState: () => ({ used: new Set(), rounds: ROUNDS[length] ?? ROUNDS[30], discussSeconds: DISCUSS_SECONDS[length] ?? DISCUSS_SECONDS[30], round: 0 }),
    hud: (ctx) => `🎭 Round ${ctx.state.round}/${ctx.state.rounds}`,
  };
}

export default {
  id: 'impostore',
  title: 'L’Impostore',
  blurb: 'Tutti conoscono la parola segreta tranne uno. Indizi a turno, discussione e voto.',
  cover: 'mask',
  theme: 'impostore',
  minPlayers: 3,
  build,
};
