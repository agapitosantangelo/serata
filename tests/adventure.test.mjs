import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../js/logic.js';
import {
  drawDestiny, resolvePool, poolNeed, resolveSplit, mutualPacts, pickEnding, computeTitles, pickTempted,
} from '../js/adventure-logic.js';

test('drawDestiny draws cards from the destiny deck without mutating it', () => {
  for (let s = 1; s < 30; s++) {
    const cards = drawDestiny(seededRng(s), 2);
    assert.equal(cards.length, 2);
    assert.ok(cards.every((c) => c === 'help' || c === 'sabotage'));
  }
});

test('poolNeed is participants minus 3, at least 1', () => {
  assert.equal(poolNeed(1), 1);
  assert.equal(poolNeed(3), 1);
  assert.equal(poolNeed(6), 3);
  assert.equal(poolNeed(7), 4);
});

test('balance: one saboteur among helpers succeeds only on a lucky destiny card', () => {
  for (const n of [3, 4, 6, 8, 12]) {
    const choices = new Map(Array.from({ length: n }, (_, i) => [`p${i}`, i === 0 ? 'sabotage' : 'help']));
    assert.equal(resolvePool(choices, ['help'], poolNeed(n)).success, true, `n=${n} lucky`);
    assert.equal(resolvePool(choices, ['sabotage'], poolNeed(n)).success, false, `n=${n} unlucky`);
    const loyal = new Map([...choices].map(([pid]) => [pid, 'help']));
    assert.equal(resolvePool(loyal, ['sabotage'], poolNeed(n)).success, true, `n=${n} all loyal`);
  }
});

test('resolvePool counts sabotage twice and mixes destiny into totals', () => {
  const choices = new Map([['a', 'help'], ['b', 'help'], ['c', 'help'], ['d', 'sabotage']]);
  const r = resolvePool(choices, ['help', 'sabotage'], 2);
  assert.equal(r.helps, 4);
  assert.equal(r.sabotages, 2);
  assert.equal(r.net, 0);
  assert.equal(r.success, false);
  const ok = resolvePool(new Map([['a', 'help'], ['b', 'help'], ['c', 'watch']]), ['help', 'help'], 2);
  assert.equal(ok.success, true);
  assert.equal(ok.watches, 1);
});

test('resolvePool ignores unknown values and missing answers count as watching', () => {
  const r = resolvePool(new Map([['a', 'hack'], ['b', 'help']]), [], 1);
  assert.equal(r.helps, 1);
  assert.equal(r.sabotages, 0);
  assert.equal(r.watches, 1);
});

test('resolveSplit covers all four outcomes', () => {
  assert.equal(resolveSplit('share', 'share'), 'both-share');
  assert.equal(resolveSplit('steal', 'share'), 'a-steals');
  assert.equal(resolveSplit('share', 'steal'), 'b-steals');
  assert.equal(resolveSplit('steal', 'steal'), 'both-steal');
  assert.equal(resolveSplit(undefined, 'share'), 'both-share');
});

test('mutualPacts returns each reciprocal pair once', () => {
  const picks = new Map([['a', 'b'], ['b', 'a'], ['c', 'a'], ['d', 'e'], ['e', 'd'], ['f', 'f']]);
  const pacts = mutualPacts(picks).map((p) => [...p].sort().join('-')).sort();
  assert.deepEqual(pacts, ['a-b', 'd-e']);
});

test('pickEnding returns the first ending whose condition holds', () => {
  const endings = [
    { id: 'secret', when: (s) => s.flags.confessed },
    { id: 'win', when: (s) => s.flags.caught },
    { id: 'fallback', when: () => true },
  ];
  assert.equal(pickEnding(endings, { flags: { caught: true } }).id, 'win');
  assert.equal(pickEnding(endings, { flags: { caught: true, confessed: true } }).id, 'secret');
  assert.equal(pickEnding(endings, { flags: {} }).id, 'fallback');
});

test('pickTempted keeps at most the cap among those who accepted', () => {
  const accepted = ['a', 'b', 'c'];
  for (let s = 1; s < 20; s++) {
    const chosen = pickTempted(accepted, 1, seededRng(s));
    assert.equal(chosen.length, 1);
    assert.ok(accepted.includes(chosen[0]));
  }
  assert.deepEqual(pickTempted([], 1, seededRng(1)), []);
});

test('computeTitles awards hero, snake and greedy to the top non-zero players', () => {
  const stats = {
    a: { help: 3, sabotage: 0, steal: 0, pact: 1, votesAgainst: 0 },
    b: { help: 1, sabotage: 2, steal: 1, pact: 0, votesAgainst: 4 },
    c: { help: 1, sabotage: 0, steal: 0, pact: 1, votesAgainst: 1 },
  };
  const titles = Object.fromEntries(computeTitles(stats).map((t) => [t.key, t.pids]));
  assert.deepEqual(titles.hero, ['a']);
  assert.deepEqual(titles.snake, ['b']);
  assert.deepEqual(titles.greedy, ['b']);
  assert.deepEqual(titles.suspect, ['b']);
  assert.deepEqual(titles.diplomat.sort(), ['a', 'c']);
});

test('computeTitles skips titles nobody earned', () => {
  const titles = computeTitles({ a: { help: 0, sabotage: 0, steal: 0, pact: 0, votesAgainst: 0 } });
  assert.equal(titles.length, 0);
});

test('gambitGuess takes the traitors majority and breaks ties at random among the top', async () => {
  const { gambitGuess } = await import('../js/adventure-logic.js');
  assert.equal(gambitGuess(new Map([['t1', 'a'], ['t2', 'a'], ['t3', 'b']]), seededRng(1)), 'a');
  for (let s = 1; s < 20; s++) {
    assert.ok(['a', 'b'].includes(gambitGuess(new Map([['t1', 'a'], ['t2', 'b']]), seededRng(s))));
  }
  assert.equal(gambitGuess(new Map(), seededRng(1)), null);
});

test('rollChance is true below the probability', async () => {
  const { rollChance } = await import('../js/adventure-logic.js');
  assert.equal(rollChance(1, () => 0.99), true);
  assert.equal(rollChance(0, () => 0), false);
  assert.equal(rollChance(0.5, () => 0.2), true);
  assert.equal(rollChance(0.5, () => 0.7), false);
});
