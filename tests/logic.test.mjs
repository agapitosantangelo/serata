import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRoomCode, shuffle, tally, winnerIndex, quizPoints, tallyKeys, topKeys,
  rank, shuffleQuestion, seededRng,
} from '../js/logic.js';

test('room code has 4 unambiguous letters', () => {
  const code = makeRoomCode(seededRng(1));
  assert.match(code, /^[A-HJ-NP-Z]{4}$/);
});

test('shuffle returns a new array with the same elements', () => {
  const src = [1, 2, 3, 4, 5];
  const out = shuffle(src, seededRng(7));
  assert.notEqual(out, src);
  assert.deepEqual([...out].sort(), src);
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
});

test('tally counts valid integer answers and ignores invalid ones', () => {
  const answers = new Map([
    ['a', { value: 0 }], ['b', { value: 2 }], ['c', { value: 2 }],
    ['d', { value: 9 }], ['e', { value: 'x' }],
  ]);
  assert.deepEqual(tally(answers, 3), [1, 0, 2]);
});

test('winnerIndex picks the max and breaks ties among top options only', () => {
  assert.equal(winnerIndex([1, 4, 2]), 1);
  for (let s = 1; s < 30; s++) {
    assert.ok([0, 2].includes(winnerIndex([3, 1, 3], seededRng(s))));
  }
});

test('quizPoints rewards correct and fast answers', () => {
  assert.equal(quizPoints(false, 100, 20000), 0);
  assert.equal(quizPoints(true, 0, 20000), 1000);
  assert.equal(quizPoints(true, 20000, 20000), 500);
  assert.equal(quizPoints(true, 10000, 20000), 750);
  assert.equal(quizPoints(true, 99999, 20000), 500);
  assert.equal(quizPoints(true, 0, 20000, 2), 2000);
});

test('tallyKeys and topKeys handle player votes and ties', () => {
  const answers = new Map([['a', { value: 'x' }], ['b', { value: 'y' }], ['c', { value: 'x' }], ['d', { value: 'y' }]]);
  const counts = tallyKeys(answers, ['x', 'y', 'z']);
  assert.equal(counts.get('x'), 2);
  assert.equal(counts.get('z'), 0);
  assert.deepEqual(topKeys(counts).sort(), ['x', 'y']);
  assert.deepEqual(topKeys(new Map([['x', 0]])), []);
});

test('tallyKeys ignores votes outside allowed keys', () => {
  const answers = new Map([['a', { value: 'hack' }], ['b', { value: 'x' }]]);
  const counts = tallyKeys(answers, ['x']);
  assert.equal(counts.get('x'), 1);
  assert.equal(counts.has('hack'), false);
});

test('rank sorts by score with shared positions for ties', () => {
  const ranked = rank([
    { pid: 'a', score: 10 }, { pid: 'b', score: 30 }, { pid: 'c', score: 10 },
  ]);
  assert.deepEqual(ranked.map((p) => [p.pid, p.rank]), [['b', 1], ['a', 2], ['c', 2]]);
});

test('shuffleQuestion keeps the correct answer text', () => {
  const q = { q: 'Capitale?', options: ['Roma', 'Milano', 'Napoli', 'Torino'], answer: 0 };
  for (let s = 1; s < 20; s++) {
    const out = shuffleQuestion(q, seededRng(s));
    assert.equal(out.options[out.answer], 'Roma');
    assert.equal(out.options.length, 4);
  }
  assert.deepEqual(q.options, ['Roma', 'Milano', 'Napoli', 'Torino']);
});

test('betAmount is a share of the score with a minimum stake', async () => {
  const { betAmount, BET_LABELS } = await import('../js/logic.js');
  assert.equal(BET_LABELS.length, 4);
  assert.equal(betAmount(2000, 0), 0);
  assert.equal(betAmount(2000, 1), 500);
  assert.equal(betAmount(2000, 2), 1000);
  assert.equal(betAmount(2000, 3), 2000);
  assert.equal(betAmount(0, 3), 100);
  assert.equal(betAmount(150, 1), 100);
  assert.equal(betAmount(2000, 9), 0);
});

test('stealAmount never takes more than the victim has', async () => {
  const { stealAmount } = await import('../js/logic.js');
  assert.equal(stealAmount(1000), 300);
  assert.equal(stealAmount(120), 120);
  assert.equal(stealAmount(0), 0);
});
