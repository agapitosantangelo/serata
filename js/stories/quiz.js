// Quiz Show: themed rounds with easy/medium/hard questions, joke bonus questions, final round worth double.
import { rank, shuffle } from '../logic.js';
import cultura from './bank/cultura.js';
import scienza from './bank/scienza.js';
import cinema from './bank/cinema.js';
import sport from './bank/sport.js';
import geografia from './bank/geografia.js';
import storia from './bank/storia.js';
import cibo from './bank/cibo.js';
import arte from './bank/arte.js';

// d: 1 = facile, 2 = media, 3 = difficile. The first option is the right one (shuffled at runtime).
const q = (d, text, options) => ({ d, q: text, options, answer: 0 });

const BASE_CATEGORIES = [
  {
    key: 'cultura', title: 'Cultura generale', emoji: '🌍',
    questions: [
      q(1, 'Quante sono le regioni italiane?', ['20', '19', '21', '18']),
      q(1, 'In che anno è caduto il Muro di Berlino?', ['1989', '1991', '1985', '1979']),
      q(1, 'Qual è il fiume più lungo d’Italia?', ['Po', 'Tevere', 'Adige', 'Arno']),
      q(2, 'Qual è la capitale dell’Australia?', ['Canberra', 'Sydney', 'Melbourne', 'Perth']),
      q(2, 'Quanti anni dura il mandato del Presidente della Repubblica italiana?', ['7', '5', '6', '9']),
      q(2, 'Qual è la lingua madre più parlata al mondo?', ['Cinese mandarino', 'Inglese', 'Spagnolo', 'Hindi']),
      q(3, 'Quanti sono i paesi dell’Unione Europea?', ['27', '28', '25', '30']),
      q(3, 'In che anno è nata l’ONU?', ['1945', '1948', '1919', '1950']),
      q(3, 'Quale stato ha una bandiera che non è né rettangolare né quadrata?', ['Nepal', 'Bhutan', 'Sri Lanka', 'Bangladesh']),
      q(1, 'Di che colore era il cavallo bianco di Napoleone?', ['Bianco', 'Nero', 'Marrone', 'Grigio']),
      q(2, 'Quante stelle ci sono sulla bandiera dell’Unione Europea?', ['12', '27', '15', '10']),
      q(3, 'Qual è la capitale del Kazakistan?', ['Astana', 'Almaty', 'Tashkent', 'Bishkek']),
    ],
  },
  {
    key: 'scienza', title: 'Scienza e natura', emoji: '🔬',
    questions: [
      q(1, 'Qual è il pianeta più grande del Sistema Solare?', ['Giove', 'Saturno', 'Nettuno', 'Urano']),
      q(1, 'Qual è il pianeta più vicino al Sole?', ['Mercurio', 'Venere', 'Marte', 'Terra']),
      q(1, 'Qual è il mammifero più grande del mondo?', ['Balenottera azzurra', 'Elefante africano', 'Capodoglio', 'Orca']),
      q(2, 'Qual è il simbolo chimico dell’oro?', ['Au', 'Ag', 'Or', 'Go']),
      q(2, 'Qual è il gas più abbondante nell’atmosfera terrestre?', ['Azoto', 'Ossigeno', 'Anidride carbonica', 'Argon']),
      q(2, 'Quante ossa ha, in media, un essere umano adulto?', ['206', '186', '226', '306']),
      q(3, 'Qual è l’elemento più abbondante nell’universo?', ['Idrogeno', 'Elio', 'Ossigeno', 'Carbonio']),
      q(3, 'Quanti cromosomi ha una normale cellula umana?', ['46', '23', '44', '48']),
      q(3, 'Su quale pianeta un giorno dura più di un anno?', ['Venere', 'Mercurio', 'Marte', 'Nettuno']),
      q(1, 'Quante zampe ha un ragno?', ['8', '6', '10', '12']),
      q(2, 'Qual è l’osso più lungo del corpo umano?', ['Femore', 'Tibia', 'Omero', 'Perone']),
      q(3, 'Qual è l’unità di misura della resistenza elettrica?', ['Ohm', 'Volt', 'Ampere', 'Watt']),
    ],
  },
  {
    key: 'cinema', title: 'Cinema, musica e TV', emoji: '🎬',
    questions: [
      q(1, 'Chi interpreta Jack in “Titanic”?', ['Leonardo DiCaprio', 'Brad Pitt', 'Johnny Depp', 'Matt Damon']),
      q(1, 'Quale band ha pubblicato “Bohemian Rhapsody”?', ['Queen', 'The Beatles', 'Led Zeppelin', 'Pink Floyd']),
      q(1, 'Come si chiama il pesciolino pagliaccio che si perde nell’oceano nel film Pixar del 2003?', ['Nemo', 'Dory', 'Bruce', 'Crush']),
      q(2, 'Chi ha diretto “La vita è bella”?', ['Roberto Benigni', 'Nanni Moretti', 'Paolo Sorrentino', 'Giuseppe Tornatore']),
      q(2, 'Chi ha vinto il Festival di Sanremo 2021?', ['Måneskin', 'Mahmood', 'Diodato', 'Ermal Meta']),
      q(2, 'Chi ha composto la colonna sonora di “Il buono, il brutto, il cattivo”?', ['Ennio Morricone', 'Nino Rota', 'Hans Zimmer', 'John Williams']),
      q(3, 'Quale film ha vinto l’Oscar come miglior film nel 2020?', ['Parasite', '1917', 'Joker', 'C’era una volta a… Hollywood']),
      q(3, 'Quale film di Fellini vinse l’Oscar per il miglior film straniero nel 1964?', ['8½', 'La dolce vita', 'Amarcord', 'I vitelloni']),
      q(3, 'Quanti Oscar ha vinto “Titanic”?', ['11', '9', '12', '14']),
      q(1, 'Come si chiama il topo più famoso della Disney?', ['Topolino', 'Jerry', 'Speedy Gonzales', 'Remy']),
      q(2, 'Chi ha diretto “Pulp Fiction”?', ['Quentin Tarantino', 'Martin Scorsese', 'Steven Spielberg', 'Francis Ford Coppola']),
      q(3, 'Chi vinse il primo Festival di Sanremo, nel 1951?', ['Nilla Pizzi', 'Domenico Modugno', 'Claudio Villa', 'Mina']),
    ],
  },
  {
    key: 'sport', title: 'Sport', emoji: '🏆',
    questions: [
      q(1, 'Quanto dura una partita di calcio regolamentare, senza recupero?', ['90 minuti', '80 minuti', '100 minuti', '120 minuti']),
      q(1, 'Quanti sono gli anelli del simbolo olimpico?', ['5', '4', '6', '7']),
      q(1, 'Quanti giocatori per squadra ci sono in campo nella pallavolo?', ['6', '5', '7', '9']),
      q(2, 'Quanti Mondiali di calcio maschili ha vinto l’Italia?', ['4', '3', '5', '2']),
      q(2, 'Chi detiene il record del mondo dei 100 metri maschili?', ['Usain Bolt', 'Carl Lewis', 'Marcell Jacobs', 'Tyson Gay']),
      q(2, 'In quale città si sono svolte le Olimpiadi invernali del 2006?', ['Torino', 'Cortina d’Ampezzo', 'Vancouver', 'Salt Lake City']),
      q(3, 'In che anno l’Italia ha vinto il suo primo Mondiale di calcio?', ['1934', '1938', '1930', '1950']),
      q(3, 'Quanti set deve vincere un uomo per aggiudicarsi una partita di un torneo del Grande Slam?', ['3', '2', '4', '5']),
      q(3, 'In quale città si svolsero le prime Olimpiadi moderne, nel 1896?', ['Atene', 'Parigi', 'Londra', 'Roma']),
      q(1, 'Quanti giocatori ha in campo una squadra di calcio?', ['11', '10', '9', '12']),
      q(2, 'Ogni quanti anni si giocano i Mondiali di calcio?', ['4', '2', '3', '5']),
      q(3, 'Quanto è lunga una maratona?', ['42,195 km', '40 km', '41,5 km', '43,2 km']),
    ],
  },
  {
    key: 'geografia', title: 'Geografia', emoji: '🗺️',
    questions: [
      q(1, 'In quale città si trova la Sagrada Família?', ['Barcellona', 'Madrid', 'Siviglia', 'Valencia']),
      q(1, 'Qual è l’oceano più grande?', ['Pacifico', 'Atlantico', 'Indiano', 'Artico']),
      q(1, 'Qual è la vetta più alta delle Alpi?', ['Monte Bianco', 'Cervino', 'Monte Rosa', 'Gran Paradiso']),
      q(2, 'Qual è la capitale del Canada?', ['Ottawa', 'Toronto', 'Montréal', 'Vancouver']),
      q(2, 'In quale regione si trova Matera?', ['Basilicata', 'Puglia', 'Calabria', 'Campania']),
      q(2, 'Qual è il paese più popoloso del mondo?', ['India', 'Cina', 'Stati Uniti', 'Indonesia']),
      q(3, 'Qual è la capitale della Nuova Zelanda?', ['Wellington', 'Auckland', 'Christchurch', 'Queenstown']),
      q(3, 'Con quanti stati confina l’Italia?', ['6', '4', '5', '7']),
      q(3, 'Qual è la capitale della Turchia?', ['Ankara', 'Istanbul', 'Smirne', 'Antalya']),
      q(1, 'Qual è la capitale della Spagna?', ['Madrid', 'Barcellona', 'Siviglia', 'Valencia']),
      q(2, 'Qual è il lago più grande d’Italia?', ['Lago di Garda', 'Lago Maggiore', 'Lago di Como', 'Lago Trasimeno']),
      q(3, 'Quale fiume attraversa Budapest?', ['Danubio', 'Reno', 'Elba', 'Vistola']),
    ],
  },
  {
    key: 'storia', title: 'Storia', emoji: '📜',
    questions: [
      q(1, 'In che anno Cristoforo Colombo arrivò in America?', ['1492', '1498', '1488', '1500']),
      q(1, 'Chi fu il primo uomo a camminare sulla Luna?', ['Neil Armstrong', 'Buzz Aldrin', 'Jurij Gagarin', 'Michael Collins']),
      q(1, 'Quale città fu sepolta dall’eruzione del Vesuvio nel 79 d.C.?', ['Pompei', 'Ostia', 'Paestum', 'Cuma']),
      q(2, 'Chi fu il primo imperatore romano?', ['Augusto', 'Giulio Cesare', 'Nerone', 'Traiano']),
      q(2, 'In che anno gli italiani scelsero la Repubblica con un referendum?', ['1946', '1948', '1945', '1950']),
      q(2, 'In che anno iniziò la Prima guerra mondiale?', ['1914', '1915', '1912', '1918']),
      q(3, 'Chi era il re d’Italia quando nacque la Repubblica?', ['Umberto II', 'Vittorio Emanuele III', 'Vittorio Emanuele II', 'Umberto I']),
      q(3, 'In che anno cadde l’Impero romano d’Occidente?', ['476', '410', '1453', '395']),
      q(3, 'In quale battaglia Napoleone fu sconfitto definitivamente?', ['Waterloo', 'Austerlitz', 'Lipsia', 'Trafalgar']),
      q(1, 'Chi si incoronò imperatore dei francesi nel 1804?', ['Napoleone Bonaparte', 'Luigi XIV', 'Carlo Magno', 'Robespierre']),
      q(2, 'In che anno fu proclamato il Regno d’Italia?', ['1861', '1848', '1870', '1871']),
      q(3, 'Chi scoprì la penicillina?', ['Alexander Fleming', 'Louis Pasteur', 'Robert Koch', 'Marie Curie']),
    ],
  },
  {
    key: 'cibo', title: 'Cibo e cucina', emoji: '🍝',
    questions: [
      q(1, 'Qual è l’ingrediente principale del guacamole?', ['Avocado', 'Pomodoro', 'Peperone', 'Cetriolo']),
      q(1, 'Da quale città viene il pesto tradizionale?', ['Genova', 'Napoli', 'Bologna', 'Torino']),
      q(1, 'Quale paese è famoso per la paella?', ['Spagna', 'Portogallo', 'Messico', 'Argentina']),
      q(2, 'Quale formaggio si usa nella carbonara tradizionale?', ['Pecorino romano', 'Mozzarella', 'Gorgonzola', 'Fontina']),
      q(2, 'Con quale farina si fa la polenta tradizionale?', ['Mais', 'Grano duro', 'Riso', 'Farro']),
      q(2, 'Qual è l’ingrediente base dell’hummus?', ['Ceci', 'Lenticchie', 'Fave', 'Fagioli']),
      q(3, 'Per quanti mesi deve stagionare almeno il Parmigiano Reggiano DOP?', ['12', '6', '18', '24']),
      q(3, 'Qual è la spezia più costosa al mondo?', ['Zafferano', 'Vaniglia', 'Cardamomo', 'Pepe rosa']),
      q(3, 'Con quale vitigno si fa il Brunello di Montalcino?', ['Sangiovese', 'Nebbiolo', 'Montepulciano', 'Aglianico']),
      q(1, 'Quale ingrediente non manca mai nella pizza margherita?', ['Mozzarella', 'Prosciutto', 'Funghi', 'Salame']),
      q(2, 'Che cos’è il mascarpone?', ['Un formaggio', 'Un salume', 'Un dolce', 'Un tipo di pasta']),
      q(3, 'Da quale paese viene la feta DOP?', ['Grecia', 'Turchia', 'Bulgaria', 'Cipro']),
    ],
  },
  {
    key: 'arte', title: 'Arte e letteratura', emoji: '🎨',
    questions: [
      q(1, 'Chi ha scritto la “Divina Commedia”?', ['Dante Alighieri', 'Francesco Petrarca', 'Giovanni Boccaccio', 'Ludovico Ariosto']),
      q(1, 'Chi ha dipinto la “Gioconda”?', ['Leonardo da Vinci', 'Michelangelo', 'Raffaello', 'Tiziano']),
      q(1, 'Quale pittore si tagliò un orecchio?', ['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet', 'Salvador Dalí']),
      q(2, 'Chi ha scritto “I Promessi Sposi”?', ['Alessandro Manzoni', 'Giovanni Verga', 'Ugo Foscolo', 'Giacomo Leopardi']),
      q(2, 'Dove si trova la Cappella Sistina?', ['Città del Vaticano', 'Firenze', 'Venezia', 'Milano']),
      q(2, 'Chi ha scritto “Il piccolo principe”?', ['Antoine de Saint-Exupéry', 'Jules Verne', 'Victor Hugo', 'Albert Camus']),
      q(3, 'Chi ha dipinto “La ronda di notte”?', ['Rembrandt', 'Vermeer', 'Rubens', 'Caravaggio']),
      q(3, 'In quale museo si trova “La nascita di Venere” di Botticelli?', ['Uffizi', 'Louvre', 'Prado', 'Pinacoteca di Brera']),
      q(3, 'Chi ha scritto “Il Gattopardo”?', ['Giuseppe Tomasi di Lampedusa', 'Giovanni Verga', 'Luigi Pirandello', 'Elsa Morante']),
      q(1, 'Chi ha scritto “Romeo e Giulietta”?', ['William Shakespeare', 'Charles Dickens', 'Molière', 'Goethe']),
      q(2, 'A quale movimento artistico appartiene Claude Monet?', ['Impressionismo', 'Cubismo', 'Surrealismo', 'Futurismo']),
      q(3, 'Chi ha scritto “Se questo è un uomo”?', ['Primo Levi', 'Italo Calvino', 'Cesare Pavese', 'Natalia Ginzburg']),
    ],
  },
];

const EXTRA = { cultura, scienza, cinema, sport, geografia, storia, cibo, arte };
export const CATEGORIES = BASE_CATEGORIES.map((c) => ({
  ...c,
  questions: [...c.questions, ...(EXTRA[c.key] ?? []).map((x) => ({ ...x, answer: 0 }))],
}));

// Joke questions about the friends: every answer is right.
const bonus = (text, options) => ({ q: text, options, allCorrect: true });
export const BONUS = [
  bonus('Agerio puzza?', ['Sì', 'Solo il lunedì', 'Dipende da dove tira il vento', 'È profumo d’autore']),
  bonus('Quanto ci mette Antonella a prepararsi per uscire?', ['10 minuti (dice lei)', 'Un’ora abbondante', 'Dipende dalle scarpe', 'La stiamo ancora aspettando']),
  bonus('Cosa fa Vincenzo quando nessuno lo guarda?', ['Balla', 'Mangia di nascosto', 'Parla con le piante', 'Si fa i selfie']),
  bonus('Qual è il superpotere segreto di Agerio?', ['Addormentarsi ovunque', 'Trovare sempre il cibo', 'Arrivare in ritardo con stile', 'Tutte le precedenti']),
  bonus('Se Antonella fosse un animale, sarebbe…', ['Un gatto', 'Un panda', 'Una giraffa', 'Un unicorno']),
  bonus('Vincenzo al karaoke è…', ['Una star', 'Un pericolo pubblico', 'Stonato ma convinto', 'Già al microfono prima della base']),
  bonus('Chi vincerebbe una gara di chiacchiere tra Agerio, Antonella e Vincenzo?', ['Agerio', 'Antonella', 'Vincenzo', 'Pareggio: nessuno smette di parlare']),
  bonus('Antonella al ristorante…', ['Ordina quello che prende qualcun altro', 'Legge il menù per 20 minuti', 'Parte dal dolce', 'Assaggia dai piatti di tutti']),
  bonus('Agerio a una festa lo trovi sempre…', ['Vicino al buffet', 'Ultimo ad andarsene', 'A mettere la musica', 'Al telefono']),
  bonus('Vincenzo appena sveglio è…', ['Uno zombie', 'Pieno di energia', 'Introvabile', 'Già al terzo caffè']),
];

// Pool of round types: each round (except the first) draws one; every game gets at least one bonus and one malus.
const MODIFIERS = {
  normal: { weight: 3 },
  double: {
    weight: 1, kind: 'bonus', multiplier: 2, emoji: '⚡',
    kicker: 'PUNTI DOPPI', text: 'Sorpresa! In questo round ogni risposta giusta vale il doppio.', phone: '⚡ Round a punti doppi!',
  },
  lightning: {
    weight: 1, kind: 'bonus', multiplier: 1.5, time: 10, emoji: '⏱️',
    kicker: 'ROUND LAMPO', text: 'Solo 10 secondi a domanda, ma punti ×1,5. Dita veloci!', phone: '⏱️ Round lampo: 10 secondi a domanda!',
  },
  risk: {
    weight: 1, kind: 'malus', risk: true, emoji: '💣',
    kicker: 'A RISCHIO', text: 'Sorpresa! In questo round chi sbaglia PERDE punti. Se non sei sicuro, puoi anche non rispondere…', phone: '💣 Round a rischio: gli errori tolgono punti!',
  },
};

function drawModifiers(count) {
  const bag = Object.entries(MODIFIERS).flatMap(([key, m]) => Array(m.weight).fill(key));
  const drawn = Array.from({ length: count }, (_, i) => (i === 0 ? 'normal' : bag[Math.floor(Math.random() * bag.length)]));
  const slots = shuffle(drawn.map((_, i) => i).slice(1));
  if (!drawn.some((k) => MODIFIERS[k].kind === 'bonus')) drawn[slots[0]] = 'double';
  if (!drawn.some((k) => MODIFIERS[k].kind === 'malus')) drawn[slots.find((i) => MODIFIERS[drawn[i]].kind !== 'bonus')] = 'risk';
  return drawn;
}

const PLAN = {
  30: { rounds: 6, mix: [1, 1, 2, 2, 3], bonus: 2 },
  60: { rounds: 8, mix: [1, 1, 2, 2, 2, 3, 3], bonus: 4 },
};

function pickRound(category, mix) {
  const byLevel = { 1: [], 2: [], 3: [] };
  for (const question of shuffle(category.questions)) byLevel[question.d].push(question);
  return mix.map((d) => byLevel[d].shift());
}

function insertBonuses(rounds, count) {
  const jokes = shuffle(BONUS).slice(0, count);
  const slots = shuffle(rounds.flatMap((r, i) => r.questions.map((_, j) => [i, j]))).slice(0, count);
  const withBonus = rounds.map((r) => ({ ...r, questions: [...r.questions] }));
  slots.sort((a, b) => b[1] - a[1]).forEach(([i, j], k) => withBonus[i].questions.splice(j, 0, jokes[k]));
  return withBonus;
}

function build(length, options = {}) {
  const plan = PLAN[length] ?? PLAN[30];
  const chosen = shuffle(CATEGORIES).slice(0, plan.rounds);
  const rounds = insertBonuses(chosen.map((c) => ({ ...c, questions: pickRound(c, plan.mix) })), plan.bonus);
  const total = rounds.reduce((n, r) => n + r.questions.length, 0);
  const last = rounds.length - 1;
  const modifiers = drawModifiers(rounds.length);

  const scenes = {
    intro: {
      type: 'narr', art: 'stage', kicker: 'Signore e signori…', title: 'Benvenuti al Quiz Show!',
      text: `${total} domande in ${rounds.length} round: facili 🟢, medie 🟡 (punti ×1,5) e difficili 🔴 (punti ×2). Più siete veloci, più punti fate. Attenzione: ogni round può nascondere una sorpresa (punti doppi ⚡, round lampo ⏱️, round a rischio 💣)… e qualche domanda bonus.`,
      sfx: 'fanfare', next: 'r0',
    },
  };
  rounds.forEach((round, i) => {
    const mod = MODIFIERS[modifiers[i]];
    const special = Boolean(mod.kind);
    scenes[`r${i}`] = {
      type: 'narr', art: 'stage',
      kicker: special ? `${mod.emoji} Round ${i + 1}: ${mod.kicker} ${mod.emoji}` : `Round ${i + 1} di ${rounds.length}`,
      title: `${round.emoji} ${round.title}`,
      text: special ? mod.text : `${round.questions.length} domande, dalla più facile alla più difficile. Pronti?`,
      sfx: special ? 'drum' : 'whoosh',
      phone: mod.phone,
      next: `r${i}q`,
    };
    scenes[`r${i}q`] = {
      type: 'quiz', kicker: `${special ? `${mod.emoji} ` : ''}${round.emoji} ${round.title}`, questions: round.questions,
      time: mod.time ?? 20, multiplier: mod.multiplier ?? 1, risk: mod.risk ?? false,
      bets: Boolean(options.bets), steals: Boolean(options.steals),
      next: i === last ? 'end' : `r${i}lb`,
    };
    if (i < last) scenes[`r${i}lb`] = { type: 'leaderboard', kicker: `Fine round ${i + 1}`, title: 'Classifica provvisoria', next: `r${i + 1}` };
  });
  scenes.end = {
    type: 'end',
    phoneTitle: 'Quiz Show finito!',
    outcome: (ctx) => {
      const top = rank(ctx.players())[0];
      return top ? { art: 'trophy', title: `${top.avatar} ${top.name} è il genio della serata!`, text: `Con ${top.score.toLocaleString('it-IT')} punti si porta a casa il trofeo (immaginario). Applausi!` } : {};
    },
  };
  return {
    start: 'intro',
    scenes,
    hud: (ctx) => `❓ ${Math.min(ctx.state.quizCount ?? 0, total)}/${total}`,
  };
}

export default {
  id: 'quiz',
  title: 'Quiz Show',
  blurb: 'Domande facili, medie e difficili pescate a caso, round a sorpresa (doppi, lampo, a rischio) e domande bonus.',
  cover: 'stage',
  theme: 'quiz',
  minPlayers: 1,
  options: [
    { id: 'bets', label: '💰 Scommesse', hint: 'Prima di ogni domanda si punta una parte dei propri punti' },
    { id: 'steals', label: '🦹 Furti', hint: 'Il più veloce a rispondere giusto ruba punti a un avversario' },
  ],
  build,
};
