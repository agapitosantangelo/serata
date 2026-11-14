// Pure game logic: no DOM, no network. Tested with `node --test tests/`.

export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const QUIZ_BASE_POINTS = 500;
export const QUIZ_SPEED_POINTS = 500;

/** Deterministic PRNG (mulberry32) for tests and reproducible shuffles. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRoomCode(rng = Math.random, length = 4) {
  return Array.from({ length }, () => ROOM_ALPHABET[Math.floor(rng() * ROOM_ALPHABET.length)]).join('');
}

export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickOne(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

/** Count answers whose value is a valid option index. */
export function tally(answers, optionCount) {
  const counts = new Array(optionCount).fill(0);
  for (const { value } of answers.values()) {
    if (Number.isInteger(value) && value >= 0 && value < optionCount) counts[value] += 1;
  }
  return counts;
}

export function winnerIndex(counts, rng = Math.random) {
  const max = Math.max(...counts);
  const top = counts.flatMap((c, i) => (c === max ? [i] : []));
  return pickOne(top, rng);
}

export function quizPoints(isCorrect, elapsedMs, limitMs, multiplier = 1) {
  if (!isCorrect) return 0;
  const ratio = Math.min(Math.max(elapsedMs / limitMs, 0), 1);
  return Math.round((QUIZ_BASE_POINTS + QUIZ_SPEED_POINTS * (1 - ratio)) * multiplier);
}

/** Count votes for string keys (player ids, answer ids); unknown keys are ignored. */
export function tallyKeys(answers, allowedKeys) {
  const counts = new Map(allowedKeys.map((k) => [k, 0]));
  for (const { value } of answers.values()) {
    if (counts.has(value)) counts.set(value, counts.get(value) + 1);
  }
  return counts;
}

export function topKeys(counts) {
  const max = Math.max(0, ...counts.values());
  if (max === 0) return [];
  return [...counts.entries()].filter(([, c]) => c === max).map(([k]) => k);
}

/** Sorted copy by score, with shared rank on ties. */
export function rank(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((p, i) => {
    const firstEqual = sorted.findIndex((q) => q.score === p.score);
    return { ...p, rank: firstEqual === -1 ? i + 1 : firstEqual + 1 };
  });
}

export function shuffleQuestion(question, rng = Math.random) {
  const order = shuffle(question.options.map((_, i) => i), rng);
  return {
    ...question,
    options: order.map((i) => question.options[i]),
    answer: order.indexOf(question.answer),
  };
}
