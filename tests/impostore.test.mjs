import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../js/logic.js';
import {
  WORDS, normalizeWord, isGuessCorrect, pickWord, turnOrder, impostorScores,
} from '../js/stories/impostore-logic.js';

test('word bank has many categories with enough unique words', () => {
  assert.ok(Object.keys(WORDS).length >= 8);
  for (const [cat, list] of Object.entries(WORDS)) {
    assert.ok(list.length >= 12, cat);
    assert.equal(new Set(list.map(normalizeWord)).size, list.length, `duplicates in ${cat}`);
  }
});

test('normalizeWord ignores case, accents, articles and spaces', () => {
  assert.equal(normalizeWord('  La Città '), 'citta');
  assert.equal(normalizeWord("L'Orologio"), 'orologio');
  assert.equal(normalizeWord('Gelato!'), 'gelato');
});

test('isGuessCorrect accepts small typos only on longer words', () => {
  assert.ok(isGuessCorrect('pizza', 'Pizza'));
  assert.ok(isGuessCorrect('la pizza', 'Pizza'));
  assert.ok(isGuessCorrect('elefnte', 'Elefante'));
  assert.equal(isGuessCorrect('pozza', 'Pizza'), false);
  assert.equal(isGuessCorrect('', 'Pizza'), false);
  assert.equal(isGuessCorrect('gatto', 'Cane'), false);
});

test('pickWord never repeats a used word', () => {
  const used = new Set();
  for (let i = 0; i < 40; i++) {
    const { category, word } = pickWord(used, seededRng(i + 1));
    assert.ok(WORDS[category].includes(word));
    assert.equal(used.has(word), false);
    used.add(word);
  }
});

test('turnOrder is a rotation of all players', () => {
  const order = turnOrder(['a', 'b', 'c', 'd'], seededRng(4));
  assert.deepEqual([...order].sort(), ['a', 'b', 'c', 'd']);
  const i = ['a', 'b', 'c', 'd'].indexOf(order[0]);
  assert.deepEqual(order, ['a', 'b', 'c', 'd'].slice(i).concat(['a', 'b', 'c', 'd'].slice(0, i)));
});

test('impostorScores: caught impostor without guess rewards right voters', () => {
  const votes = new Map([['a', 'imp'], ['b', 'imp'], ['c', 'a']]);
  const s = impostorScores({ impostor: 'imp', caught: true, guessed: false, votes });
  assert.equal(s.get('a'), 500);
  assert.equal(s.get('b'), 500);
  assert.equal(s.get('c') ?? 0, 0);
  assert.equal(s.get('imp') ?? 0, 0);
});

test('impostorScores: escaped or guessing impostor scores', () => {
  const votes = new Map([['a', 'b'], ['b', 'a'], ['c', 'imp']]);
  assert.equal(impostorScores({ impostor: 'imp', caught: false, guessed: false, votes }).get('imp'), 1000);
  const guessed = impostorScores({ impostor: 'imp', caught: true, guessed: true, votes });
  assert.equal(guessed.get('imp'), 800);
  assert.equal(guessed.get('c'), 500);
});
