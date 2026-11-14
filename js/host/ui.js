// Host screen rendering: stage transitions, timer, boards, reveals, dice, podium.
import { el, $, sleep } from '../dom.js';
import { art } from '../art.js';
import { play } from '../fx.js';

const TYPE_MS = 24;
const LETTERS = ['A', 'B', 'C', 'D'];
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createUI() {
  const stage = $('#stage');
  const overlay = $('#overlay');
  const timerSlot = $('#timer');
  let typing = null;

  function typewriter(node, text) {
    clearInterval(typing);
    if (reduceMotion()) { node.textContent = text; return; }
    let i = 0;
    node.textContent = '';
    node.classList.add('typing');
    typing = setInterval(() => {
      i += 1;
      node.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typing); node.classList.remove('typing'); }
    }, TYPE_MS);
  }

  function show({ art: artName, kicker, title, text, body, layout = artName ? 'split' : 'center' }) {
    const textNode = text ? el('p', { class: 'scene__text' }) : null;
    const scene = el('section', { class: `scene scene--${layout}` },
      artName ? el('div', { class: 'scene__art', svg: art(artName) }) : null,
      el('div', { class: 'scene__content' },
        kicker ? el('div', { class: 'kicker' }, kicker) : null,
        title ? el('h1', { class: 'scene__title' }, title) : null,
        textNode,
        body ?? null));
    for (const old of stage.children) {
      old.classList.add('leaving');
      setTimeout(() => old.remove(), 450);
    }
    stage.append(scene);
    if (textNode) typewriter(textNode, text);
    return scene;
  }

  function timer(seconds) {
    const total = seconds;
    let left = seconds;
    const num = el('span', { class: 'timer__num' }, String(left));
    const ring = el('div', { class: 'timer', style: { '--p': '1' } }, num);
    timerSlot.replaceChildren(ring);
    const start = performance.now();
    const id = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const next = Math.max(0, Math.ceil(total - elapsed));
      ring.style.setProperty('--p', String(Math.max(0, 1 - elapsed / total)));
      if (next !== left) {
        left = next;
        num.textContent = String(left);
        if (left <= 5 && left > 0) { ring.classList.add('timer--hurry'); play('tick'); }
      }
      if (elapsed >= total) clearInterval(id);
    }, 100);
    return { stop() { clearInterval(id); timerSlot.replaceChildren(); } };
  }

  function quizBoard(options) {
    return el('div', { class: 'quiz-board' }, options.map((text, i) => el('div', { class: `quiz-opt opt-${i}`, style: { animationDelay: `${i * 0.08}s` } },
      el('span', { class: 'letter' }, LETTERS[i]), el('span', { class: 'quiz-opt__text' }, text), el('span', { class: 'quiz-opt__count' }))));
  }

  function revealQuiz(board, answer, counts) {
    [...board.children].forEach((node, i) => {
      node.classList.add(i === answer ? 'is-right' : 'is-wrong');
      node.querySelector('.quiz-opt__count').textContent = counts[i] ? `${counts[i]} 👤` : '';
    });
  }

  function voteBoard(options) {
    return el('div', { class: 'vote-board' }, options.map((text, i) => el('div', { class: 'vote-opt', style: { animationDelay: `${i * 0.1}s` } },
      el('div', { class: 'vote-opt__bar' }), el('span', { class: 'vote-opt__label' }, text), el('span', { class: 'vote-opt__count' }))));
  }

  function revealVote(board, counts, winner) {
    const total = Math.max(1, counts.reduce((a, b) => a + b, 0));
    [...board.children].forEach((node, i) => {
      node.querySelector('.vote-opt__bar').style.width = `${(counts[i] / total) * 100}%`;
      node.querySelector('.vote-opt__count').textContent = String(counts[i]);
      if (i === winner) setTimeout(() => node.classList.add('is-winner'), 900);
    });
  }

  function pickBoard(players) {
    return el('div', { class: 'pick-board' }, players.map((p, i) => el('div', { class: 'pick', 'data-pid': p.pid, style: { animationDelay: `${i * 0.05}s` } },
      el('div', { class: 'pick__avatar' }, p.avatar), el('div', { class: 'pick__name' }, p.name), el('div', { class: 'pick__votes' }))));
  }

  function revealPick(board, counts, winners) {
    for (const node of board.children) {
      const pid = node.dataset.pid;
      const n = counts.get(pid) ?? 0;
      node.querySelector('.pick__votes').textContent = n ? '🗳️'.repeat(Math.min(n, 6)) + (n > 6 ? ` ×${n}` : '') : '';
      node.classList.toggle('is-winner', winners.includes(pid));
      node.classList.toggle('is-dim', !winners.includes(pid));
    }
  }

  function answersBoard(items) {
    return el('div', { class: 'answers-board' }, items.map((it, i) => el('div', { class: 'answer-card', 'data-id': it.id, style: { animationDelay: `${i * 0.08}s` } },
      el('div', { class: 'answer-card__text' }, `“${it.text}”`), el('div', { class: 'answer-card__meta' }))));
  }

  function revealAnswers(board, counts, authorOf, winners) {
    for (const node of board.children) {
      const id = node.dataset.id;
      const author = authorOf(id);
      const n = counts.get(id) ?? 0;
      node.querySelector('.answer-card__meta').textContent = `${author ? `${author.avatar} ${author.name}` : ''} · ${n} vot${n === 1 ? 'o' : 'i'}`;
      node.classList.toggle('is-winner', winners.includes(id));
    }
  }

  async function banner(text, tone = 'good', ms = 1600) {
    const node = el('div', { class: `banner banner--${tone}` }, text);
    overlay.append(node);
    await sleep(ms);
    node.classList.add('leaving');
    await sleep(350);
    node.remove();
  }

  function shake() {
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
  }

  async function dice(value, label) {
    const face = el('div', { class: 'die__face' }, '?');
    const node = el('div', { class: 'dice-overlay' },
      el('div', { class: 'dice-label' }, label),
      el('div', { class: 'die rolling' }, el('div', { class: 'die__shape', svg: D20_SVG }), face));
    overlay.append(node);
    play('dice');
    const until = performance.now() + 1500;
    while (performance.now() < until) {
      face.textContent = String(1 + Math.floor(Math.random() * 20));
      await sleep(70);
    }
    face.textContent = String(value);
    node.querySelector('.die').classList.remove('rolling');
    node.querySelector('.die').classList.add(value >= 15 ? 'die--great' : value <= 5 ? 'die--bad' : 'die--ok');
    play(value >= 10 ? 'ding' : 'buzz');
    await sleep(1600);
    node.classList.add('leaving');
    await sleep(350);
    node.remove();
  }

  function leaderboard(ranked, max = 10) {
    const top = Math.max(1, ranked[0]?.score ?? 1);
    return el('ol', { class: 'leaderboard' }, ranked.slice(0, max).map((p, i) => el('li', { class: 'lb-row', style: { animationDelay: `${(Math.min(ranked.length, max) - i) * 0.12}s` } },
      el('span', { class: 'lb-rank' }, ['🥇', '🥈', '🥉'][p.rank - 1] ?? String(p.rank)),
      el('span', { class: 'lb-avatar' }, p.avatar),
      el('span', { class: 'lb-name' }, p.name),
      el('span', { class: 'lb-bar' }, el('span', { style: { width: `${Math.max(4, (p.score / top) * 100)}%` } })),
      el('span', { class: 'lb-score' }, p.score.toLocaleString('it-IT')))));
  }

  function podium(ranked) {
    const slots = [ranked[1], ranked[0], ranked[2]];
    return el('div', { class: 'podium' }, slots.map((p, i) => p ? el('div', { class: `podium__col podium__col--${[2, 1, 3][i]}` },
      el('div', { class: 'podium__avatar' }, p.avatar),
      el('div', { class: 'podium__name' }, p.name),
      el('div', { class: 'podium__score' }, p.score.toLocaleString('it-IT')),
      el('div', { class: 'podium__block' }, ['🥈', '🥇', '🥉'][i])) : el('div')));
  }

  function playerCards(players, extra) {
    return el('div', { class: 'player-cards' }, players.map((p, i) => el('div', { class: 'player-card', style: { animationDelay: `${i * 0.07}s` } },
      el('div', { class: 'player-card__head' }, el('span', { class: 'player-card__avatar' }, p.avatar), el('b', {}, p.name)),
      extra(p))));
  }

  function clueCard(text, strong) {
    return el('div', { class: `clue-card ${strong ? 'clue-card--strong' : ''}` },
      el('div', { class: 'clue-card__stamp' }, strong ? 'INDIZIO DECISIVO' : 'INDIZIO DEBOLE'),
      el('div', { class: 'clue-card__text' }, text));
  }

  return {
    show, timer, quizBoard, revealQuiz, voteBoard, revealVote, pickBoard, revealPick,
    answersBoard, revealAnswers, banner, shake, dice, leaderboard, podium, playerCards, clueCard,
  };
}

const D20_SVG = `<svg viewBox="0 0 100 100"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="var(--accent)" stroke="rgba(0,0,0,.35)" stroke-width="3"/>
<polygon points="50,22 75,64 25,64" fill="rgba(255,255,255,.22)"/><path d="M50 3 L50 22 M93 27 L75 64 M7 27 L25 64 M93 73 L75 64 M7 73 L25 64 M50 97 L50 64 M50 22 L93 27 M50 22 L7 27" stroke="rgba(0,0,0,.3)" stroke-width="2"/></svg>`;
