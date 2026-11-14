// Quiz Show: 4 themed rounds of 5 questions, final round worth double.
import { rank } from '../logic.js';

const q = (text, options, answer = 0) => ({ q: text, options, answer });

const ROUNDS = [
  {
    title: 'Cultura generale', emoji: '🌍',
    questions: [
      q('Qual è il fiume più lungo d’Italia?', ['Po', 'Tevere', 'Adige', 'Arno']),
      q('In che anno è caduto il Muro di Berlino?', ['1989', '1991', '1985', '1979']),
      q('Chi ha dipinto “La nascita di Venere”?', ['Sandro Botticelli', 'Leonardo da Vinci', 'Raffaello', 'Caravaggio']),
      q('Qual è la capitale dell’Australia?', ['Canberra', 'Sydney', 'Melbourne', 'Perth']),
      q('Quante sono le regioni italiane?', ['20', '19', '21', '18']),
    ],
  },
  {
    title: 'Scienza e natura', emoji: '🔬',
    questions: [
      q('Qual è il simbolo chimico dell’oro?', ['Au', 'Ag', 'Or', 'Go']),
      q('Qual è il pianeta più grande del Sistema Solare?', ['Giove', 'Saturno', 'Nettuno', 'Urano']),
      q('Quante ossa ha, in media, un essere umano adulto?', ['206', '186', '226', '306']),
      q('Qual è il gas più abbondante nell’atmosfera terrestre?', ['Azoto', 'Ossigeno', 'Anidride carbonica', 'Argon']),
      q('Qual è il mammifero più grande del mondo?', ['Balenottera azzurra', 'Elefante africano', 'Capodoglio', 'Orca']),
    ],
  },
  {
    title: 'Cinema, musica e TV', emoji: '🎬',
    questions: [
      q('Chi ha diretto “La vita è bella”?', ['Roberto Benigni', 'Nanni Moretti', 'Paolo Sorrentino', 'Giuseppe Tornatore']),
      q('Quale band ha pubblicato “Bohemian Rhapsody”?', ['Queen', 'The Beatles', 'Led Zeppelin', 'Pink Floyd']),
      q('Chi ha vinto il Festival di Sanremo 2021?', ['Måneskin', 'Mahmood', 'Diodato', 'Ermal Meta']),
      q('Quale film ha vinto l’Oscar come miglior film nel 2020?', ['Parasite', '1917', 'Joker', 'C’era una volta a… Hollywood']),
      q('Chi ha composto la colonna sonora di “Il buono, il brutto, il cattivo”?', ['Ennio Morricone', 'Nino Rota', 'Hans Zimmer', 'John Williams']),
    ],
  },
  {
    title: 'Sport e geografia', emoji: '⚡',
    questions: [
      q('Quanti Mondiali di calcio maschili ha vinto l’Italia?', ['4', '3', '5', '2']),
      q('Qual è la vetta più alta delle Alpi?', ['Monte Bianco', 'Cervino', 'Monte Rosa', 'Gran Paradiso']),
      q('In quale città si trova la Sagrada Família?', ['Barcellona', 'Madrid', 'Siviglia', 'Valencia']),
      q('Quanti giocatori per squadra ci sono in campo nella pallavolo?', ['6', '5', '7', '9']),
      q('Qual è il paese più popoloso del mondo?', ['India', 'Cina', 'Stati Uniti', 'Indonesia']),
    ],
  },
];

const TOTAL = ROUNDS.reduce((n, r) => n + r.questions.length, 0);
const LAST = ROUNDS.length - 1;

const scenes = {
  intro: {
    type: 'narr', art: 'stage', kicker: 'Signore e signori…', title: 'Benvenuti al Quiz Show!',
    text: `${TOTAL} domande in ${ROUNDS.length} round. Rispondete dal telefono: più siete veloci, più punti fate. L’ultimo round vale doppio!`,
    sfx: 'fanfare', next: 'r0',
  },
};

ROUNDS.forEach((round, i) => {
  const isLast = i === LAST;
  scenes[`r${i}`] = {
    type: 'narr', art: 'stage',
    kicker: isLast ? 'Round finale' : `Round ${i + 1} di ${ROUNDS.length}`,
    title: `${round.emoji} ${round.title}`,
    text: isLast ? 'Punti DOPPI! Tutto può ancora succedere…' : `${round.questions.length} domande. Pronti?`,
    sfx: isLast ? 'drum' : 'whoosh',
    next: `r${i}q`,
  };
  scenes[`r${i}q`] = {
    type: 'quiz', kicker: `${round.emoji} ${round.title}`, questions: round.questions,
    time: 20, multiplier: isLast ? 2 : 1, next: isLast ? 'end' : `r${i}lb`,
  };
  scenes[`r${i}lb`] = { type: 'leaderboard', kicker: `Fine round ${i + 1}`, title: 'Classifica provvisoria', next: `r${i + 1}` };
});

scenes.end = {
  type: 'end',
  phoneTitle: 'Quiz Show finito!',
  outcome: (ctx) => {
    const top = rank(ctx.players())[0];
    return top ? { art: 'trophy', title: `${top.avatar} ${top.name} è il genio della serata!`, text: `Con ${top.score.toLocaleString('it-IT')} punti si porta a casa il trofeo (immaginario). Applausi!` } : {};
  },
};

export default {
  id: 'quiz',
  title: 'Quiz Show',
  blurb: '20 domande a tempo in 4 round, con classifica e finale a punti doppi.',
  cover: 'stage',
  theme: 'quiz',
  minPlayers: 1,
  minutes: 20,
  start: 'intro',
  scenes,
  hud: (ctx) => `❓ ${Math.min(ctx.state.quizCount ?? 0, TOTAL)}/${TOTAL}`,
};
