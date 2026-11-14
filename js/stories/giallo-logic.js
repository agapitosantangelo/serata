// Pure logic for the murder-mystery: traits, culprit, clues. No DOM.
import { shuffle, pickOne } from '../logic.js';

export const CATEGORIES = [
  {
    key: 'stanza', label: 'Alle 22 era', icon: '🚪', pre: 'alle 22 ', verb: 'era',
    names: ['Biblioteca', 'Serra', 'Cucina', 'Salone'],
    phrases: ['in biblioteca', 'in serra', 'in cucina', 'nel salone'],
  },
  {
    key: 'accessorio', label: 'Portava', icon: '🎩', pre: '', verb: 'portava',
    names: ['Guanti', 'Cappello', 'Occhiali', 'Bastone'],
    phrases: ['i guanti', 'il cappello', 'gli occhiali', 'il bastone'],
  },
  {
    key: 'odore', label: 'Odorava di', icon: '👃', pre: '', verb: 'odorava',
    names: ['Sigaro', 'Whisky', 'Caffè', 'Menta'],
    phrases: ['di sigaro', 'di whisky', 'di caffè', 'di menta'],
  },
];

const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

function allCombos() {
  const [a, b, c] = CATEGORIES;
  return a.names.flatMap((_, i) => b.names.flatMap((_, j) => c.names.map((_, k) => [i, j, k])));
}

export function matches(traits, statement) {
  const same = traits[statement.cat] === statement.value;
  return statement.positive ? same : !same;
}

export function suspects(traitsByPid, clues) {
  return Object.keys(traitsByPid).filter((pid) => clues.every((c) => matches(traitsByPid[pid], c)));
}

export function clueText({ cat, value, positive }) {
  const c = CAT[cat];
  return `Il colpevole ${c.pre}${positive ? '' : 'NON '}${c.verb} ${c.phrases[value]}.`;
}

export function traitLabel(cat, value) {
  return CAT[cat].names[value];
}

/**
 * Assign unique trait combos, pick the culprit and hand out private clues.
 * Guarantee: with both reward clues positive, the innocents' clues single out the culprit.
 */
export function setupGiallo(pids, rng = Math.random) {
  const combos = shuffle(allCombos(), rng);
  const traits = Object.fromEntries(pids.map((pid, i) => [
    pid, Object.fromEntries(CATEGORIES.map((c, k) => [c.key, combos[i][k]])),
  ]));
  const culprit = pickOne(pids, rng);
  const order = shuffle(CATEGORIES.map((c) => c.key), rng);
  const [first, second, hidden] = order;
  const ct = traits[culprit];

  const lookalikes = pids.filter((p) => p !== culprit
    && traits[p][first] === ct[first] && traits[p][second] === ct[second]);
  const needed = [...new Set(lookalikes.map((p) => traits[p][hidden]))];

  const pool = shuffle(CATEGORIES.flatMap((c) => c.names
    .map((_, v) => ({ cat: c.key, value: v, positive: false }))
    .filter((st) => st.value !== ct[st.cat])), rng);

  const innocents = shuffle(pids.filter((p) => p !== culprit), rng);
  const privateClues = Object.fromEntries(innocents.map((pid, i) => [
    pid,
    i < needed.length
      ? { cat: hidden, value: needed[i], positive: false }
      : pool[(i - needed.length) % pool.length],
  ]));

  const fakeClue = { cat: hidden, value: ct[hidden], positive: false };
  return { traits, culprit, order, privateClues, fakeClue };
}

/** A true negative clue that clears at least one other player (whispered by a witness). */
export function extraClue(setup, rng = Math.random) {
  const ct = setup.traits[setup.culprit];
  const others = Object.entries(setup.traits).filter(([pid]) => pid !== setup.culprit).map(([, t]) => t);
  const candidates = CATEGORIES.flatMap((c) => c.names
    .map((_, v) => ({ cat: c.key, value: v, positive: false }))
    .filter((st) => st.value !== ct[st.cat] && others.some((t) => t[st.cat] === st.value)));
  return pickOne(candidates, rng);
}

/** Clue earned at the end of investigation step 0, 1 or 2: strong if the team did well. */
export function rewardClue(setup, step, success, rng = Math.random) {
  const cat = setup.order[step];
  const own = setup.traits[setup.culprit][cat];
  if (success) return { cat, value: own, positive: true };
  const others = Object.entries(setup.traits)
    .filter(([pid]) => pid !== setup.culprit)
    .map(([, t]) => t[cat])
    .filter((v) => v !== own);
  const candidates = others.length
    ? [...new Set(others)]
    : CAT[cat].names.map((_, v) => v).filter((v) => v !== own);
  return { cat, value: pickOne(candidates, rng), positive: false };
}
