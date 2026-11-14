import { test } from 'node:test';
import assert from 'node:assert/strict';
import quiz, { CATEGORIES, BONUS } from '../js/stories/quiz.js';

test('question bank is around 300 well-formed questions', () => {
  const all = CATEGORIES.flatMap((c) => c.questions);
  assert.ok(all.length >= 290, `only ${all.length}`);
  for (const q of all) {
    assert.ok([1, 2, 3].includes(q.d), q.q);
    assert.equal(q.options.length, 4, q.q);
    assert.equal(new Set(q.options).size, 4, q.q);
    assert.equal(q.answer, 0, q.q);
    assert.ok(q.q.trim().length > 5, q.q);
  }
  const texts = all.map((q) => q.q.toLowerCase());
  assert.equal(new Set(texts).size, texts.length, 'duplicate question text');
});

test('every category has enough questions per difficulty for the long game', () => {
  for (const c of CATEGORIES) {
    for (const d of [1, 2, 3]) assert.ok(c.questions.filter((q) => q.d === d).length >= 3, `${c.title} d${d}`);
  }
});

test('bonus questions are all-correct jokes', () => {
  for (const b of BONUS) { assert.equal(b.allCorrect, true); assert.equal(b.options.length, 4); }
});

test('builds produce complete rounds for 30 and 60 minutes', () => {
  for (const length of [30, 60]) {
    const game = quiz.build(length);
    const rounds = Object.values(game.scenes).filter((s) => s.type === 'quiz');
    assert.equal(rounds.length, length === 30 ? 6 : 8);
    assert.ok(rounds.every((r) => r.questions.every(Boolean)));
    assert.ok(rounds.some((r) => r.multiplier > 1), 'needs a bonus round');
    assert.ok(rounds.some((r) => r.risk), 'needs a malus round');
  }
});
