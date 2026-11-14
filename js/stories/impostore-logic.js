// Pure logic for "L'Impostore": word bank, guess matching, turn order, scoring.
import { pickOne, shuffle } from '../logic.js';

export const WORDS = {
  'Cibo': ['Pizza', 'Gelato', 'Lasagne', 'Sushi', 'Cioccolato', 'Panettone', 'Hamburger', 'Tiramisù', 'Popcorn', 'Arancino', 'Croissant', 'Polenta', 'Kebab', 'Carbonara', 'Nutella'],
  'Animali': ['Elefante', 'Pinguino', 'Giraffa', 'Squalo', 'Gatto', 'Canguro', 'Polpo', 'Leone', 'Farfalla', 'Koala', 'Coccodrillo', 'Gufo', 'Delfino', 'Zanzara', 'Lumaca'],
  'Luoghi': ['Spiaggia', 'Ospedale', 'Aeroporto', 'Cinema', 'Biblioteca', 'Discoteca', 'Supermercato', 'Palestra', 'Chiesa', 'Stadio', 'Zoo', 'Museo', 'Montagna', 'Prigione', 'Luna park'],
  'Oggetti di casa': ['Frigorifero', 'Ombrello', 'Spazzolino', 'Divano', 'Lavatrice', 'Specchio', 'Forbici', 'Candela', 'Cuscino', 'Telecomando', 'Scopa', 'Tostapane', 'Orologio', 'Lampadina', 'Phon'],
  'Mestieri': ['Pompiere', 'Dentista', 'Astronauta', 'Cuoco', 'Pilota', 'Idraulico', 'Maestro', 'Poliziotto', 'Parrucchiere', 'Giardiniere', 'Avvocato', 'Barista', 'Postino', 'Chirurgo', 'Mago'],
  'Sport e giochi': ['Calcio', 'Tennis', 'Scacchi', 'Nuoto', 'Sci', 'Boxe', 'Bowling', 'Pallavolo', 'Golf', 'Surf', 'Ciclismo', 'Biliardo', 'Karate', 'Freccette', 'Tombola'],
  'Mezzi di trasporto': ['Bicicletta', 'Elicottero', 'Sottomarino', 'Treno', 'Monopattino', 'Mongolfiera', 'Traghetto', 'Taxi', 'Razzo', 'Funivia', 'Trattore', 'Gondola', 'Ambulanza', 'Skateboard', 'Tram'],
  'Feste e vacanze': ['Natale', 'Capodanno', 'Carnevale', 'Halloween', 'Matrimonio', 'Compleanno', 'Ferragosto', 'Pasqua', 'Campeggio', 'Crociera', 'Laurea', 'Addio al celibato', 'San Valentino', 'Sagra', 'Gita scolastica'],
  'Natura e meteo': ['Vulcano', 'Arcobaleno', 'Temporale', 'Deserto', 'Cascata', 'Neve', 'Foresta', 'Ghiacciaio', 'Tramonto', 'Terremoto', 'Isola', 'Nebbia', 'Grotta', 'Fulmine', 'Marea'],
  'Corpo e salute': ['Naso', 'Starnuto', 'Cerotto', 'Sbadiglio', 'Gomito', 'Lentiggini', 'Singhiozzo', 'Termometro', 'Unghia', 'Sciroppo', 'Mal di testa', 'Occhiali', 'Barba', 'Solletico', 'Ginocchio'],
};

const ARTICLES = /^(il|lo|la|i|gli|le|un|uno|una|l)\s+/;

export function normalizeWord(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICLES, '')
    .replace(/\s+/g, '');
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

const TYPO_MIN_LENGTH = 6;

export function isGuessCorrect(guess, word) {
  const g = normalizeWord(guess);
  const w = normalizeWord(word);
  if (!g) return false;
  if (g === w) return true;
  return w.length >= TYPO_MIN_LENGTH && distance(g, w) <= 1;
}

export function pickWord(used, rng = Math.random) {
  const pool = Object.entries(WORDS).flatMap(([category, list]) => list
    .filter((word) => !used.has(word))
    .map((word) => ({ category, word })));
  return pickOne(pool, rng);
}

/** Players speak in seat order, starting from a random player. */
export function turnOrder(pids, rng = Math.random) {
  const start = Math.floor(rng() * pids.length);
  return [...pids.slice(start), ...pids.slice(0, start)];
}

export const POINTS = { catch: 500, escape: 1000, guess: 800 };

export function impostorScores({ impostor, caught, guessed, votes }) {
  const scores = new Map();
  for (const [pid, target] of votes) {
    if (pid !== impostor && target === impostor) scores.set(pid, POINTS.catch);
  }
  if (!caught) scores.set(impostor, POINTS.escape);
  else if (guessed) scores.set(impostor, POINTS.guess);
  return scores;
}

/**
 * Rotation: each giro is a shuffled queue of players; everyone is impostor once per giro.
 * Players who left are skipped; when the queue runs out a new giro starts with whoever is present.
 */
export function nextImpostor(queue, activePids, rng = Math.random) {
  const present = queue.filter((pid) => activePids.includes(pid));
  const newGiro = present.length === 0;
  const [impostor, ...rest] = newGiro ? shuffle(activePids, rng) : present;
  return { impostor, queue: rest, newGiro };
}
