// Pure logic for the adventure engine: pooled tests, split-or-steal, pacts, endings, titles.
import { shuffle } from './logic.js';

/** Destiny deck mixed into every pooled test, so one sabotage could just be bad luck. */
export const DESTINY_DECK = ['help', 'help', 'help', 'sabotage', 'sabotage'];
export const SABOTAGE_WEIGHT = 2;

export function drawDestiny(rng = Math.random, count = 1) {
  return shuffle(DESTINY_DECK, rng).slice(0, count);
}

/**
 * Threshold tuned so that, with one saboteur and everyone else helping, success depends on the
 * destiny card (~60%); with nobody sabotaging it always succeeds.
 */
export function poolNeed(participants) {
  return Math.max(1, participants - 3);
}

/** choices: Map pid -> 'help' | 'watch' | 'sabotage' (anything else counts as watching). */
export function resolvePool(choices, destiny, need) {
  let helps = 0;
  let sabotages = 0;
  let watches = 0;
  for (const value of [...choices.values(), ...destiny]) {
    if (value === 'help') helps += 1;
    else if (value === 'sabotage') sabotages += 1;
    else watches += 1;
  }
  const net = helps - SABOTAGE_WEIGHT * sabotages;
  return { helps, sabotages, watches, net, need, success: net >= need };
}

export function resolveSplit(a, b) {
  const aSteals = a === 'steal';
  const bSteals = b === 'steal';
  if (aSteals && bSteals) return 'both-steal';
  if (aSteals) return 'a-steals';
  if (bSteals) return 'b-steals';
  return 'both-share';
}

/** picks: Map pid -> chosen ally pid. Returns reciprocal pairs, each once. */
export function mutualPacts(picks) {
  const pacts = [];
  for (const [a, b] of picks) {
    if (a !== b && a < b && picks.get(b) === a) pacts.push([a, b]);
  }
  return pacts;
}

export function pickEnding(endings, state) {
  return endings.find((e) => e.when(state)) ?? endings[endings.length - 1];
}

/** Among those who accepted a temptation, keep at most `cap` at random. */
export function pickTempted(accepted, cap, rng = Math.random) {
  return shuffle(accepted, rng).slice(0, cap);
}

const TITLES = [
  { key: 'hero', stat: 'help', emoji: '🦸', title: 'L’Eroe', text: 'ha aiutato più di tutti' },
  { key: 'snake', stat: 'sabotage', emoji: '🐍', title: 'Il Serpente', text: 'ha sabotato più di tutti' },
  { key: 'greedy', stat: 'steal', emoji: '💰', title: 'L’Avido', text: 'ha arraffato più di tutti' },
  { key: 'suspect', stat: 'votesAgainst', emoji: '🔦', title: 'Il Sospettato', text: 'ha ricevuto più accuse' },
  { key: 'diplomat', stat: 'pact', emoji: '🤝', title: 'Il Diplomatico', text: 'ha stretto un patto', all: true },
];

/** stats: { pid: { help, sabotage, steal, pact, votesAgainst } } */
export function computeTitles(stats) {
  const entries = Object.entries(stats);
  return TITLES.flatMap((t) => {
    const values = entries.map(([pid, s]) => [pid, s[t.stat] ?? 0]).filter(([, v]) => v > 0);
    if (!values.length) return [];
    const max = Math.max(...values.map(([, v]) => v));
    const pids = values.filter(([, v]) => t.all || v === max).map(([pid]) => pid);
    return [{ key: t.key, emoji: t.emoji, title: t.title, text: t.text, pids }];
  });
}

export function rollChance(probability, rng = Math.random) {
  return rng() < probability;
}

/** The traitors' final guess of who the Seer is: majority of their votes, random among ties. */
export function gambitGuess(votes, rng = Math.random) {
  const counts = new Map();
  for (const target of votes.values()) if (target) counts.set(target, (counts.get(target) ?? 0) + 1);
  if (!counts.size) return null;
  const max = Math.max(...counts.values());
  const top = [...counts.entries()].filter(([, n]) => n === max).map(([k]) => k);
  return top[Math.floor(rng() * top.length)];
}
