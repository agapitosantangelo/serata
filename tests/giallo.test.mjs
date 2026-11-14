import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../js/logic.js';
import {
  CATEGORIES, setupGiallo, rewardClue, extraClue, matches, suspects, clueText,
} from '../js/stories/giallo-logic.js';

const pidsOf = (n) => Array.from({ length: n }, (_, i) => `p${i}`);

test('every player gets a unique trait combination', () => {
  const setup = setupGiallo(pidsOf(12), seededRng(3));
  const keys = Object.values(setup.traits).map((t) => CATEGORIES.map((c) => t[c.key]).join('-'));
  assert.equal(new Set(keys).size, 12);
});

test('culprit gets no true clue, innocents each get a true clue', () => {
  const setup = setupGiallo(pidsOf(6), seededRng(5));
  const culpritTraits = setup.traits[setup.culprit];
  assert.equal(setup.privateClues[setup.culprit], undefined);
  for (const [pid, clue] of Object.entries(setup.privateClues)) {
    assert.notEqual(pid, setup.culprit);
    assert.ok(matches(culpritTraits, clue), `clue for ${pid} must be true`);
  }
  assert.equal(matches(culpritTraits, setup.fakeClue), false, 'fake clue must be false');
});

test('reward clues are true about the culprit', () => {
  for (let s = 1; s < 50; s++) {
    const setup = setupGiallo(pidsOf(7), seededRng(s));
    const t = setup.traits[setup.culprit];
    for (const step of [0, 1, 2]) {
      for (const ok of [true, false]) {
        assert.ok(matches(t, rewardClue(setup, step, ok, seededRng(s + 100))));
      }
    }
  }
});

test('with two strong clues and honest innocents the culprit is unique', () => {
  for (let n = 3; n <= 12; n++) {
    for (let s = 1; s <= 60; s++) {
      const setup = setupGiallo(pidsOf(n), seededRng(s * 31 + n));
      const clues = [
        rewardClue(setup, 0, true, seededRng(s)),
        rewardClue(setup, 1, true, seededRng(s + 1)),
        ...Object.values(setup.privateClues),
      ];
      assert.deepEqual(suspects(setup.traits, clues), [setup.culprit], `n=${n} seed=${s}`);
    }
  }
});

test('clueText produces readable italian sentences', () => {
  const st = { cat: 'stanza', value: 1, positive: false };
  assert.equal(clueText(st), 'Il colpevole alle 22 NON era in serra.');
  assert.equal(clueText({ cat: 'accessorio', value: 2, positive: true }), 'Il colpevole portava gli occhiali.');
});

test('extra witness clue is true and eliminates at least one other player', () => {
  for (let s = 1; s < 80; s++) {
    const setup = setupGiallo(pidsOf(3 + (s % 10)), seededRng(s));
    const clue = extraClue(setup, seededRng(s + 7));
    assert.ok(matches(setup.traits[setup.culprit], clue));
    assert.equal(clue.positive, false);
    const cleared = Object.entries(setup.traits).filter(([pid, t]) => pid !== setup.culprit && !matches(t, clue));
    assert.ok(cleared.length >= 1, `seed ${s}`);
  }
});
