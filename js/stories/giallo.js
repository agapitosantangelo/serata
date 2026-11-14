// Giallo: Delitto a Villa Corvara. One player is secretly the murderer.
import { el, sleep } from '../dom.js';
import { tallyKeys, topKeys } from '../logic.js';
import {
  CATEGORIES, setupGiallo, rewardClue, clueText, traitLabel,
} from './giallo-logic.js';

const DISCUSS_SECONDS = 180;
const ACCUSE_SECONDS = 45;
const CATCH_POINTS = 1000;
const ESCAPE_POINTS = 1500;
const FOOLED_POINTS = 300;

const q = (text, options, answer = 0) => ({ q: text, options, answer });
const QUESTIONS = {
  studio: [
    q('Chi ha creato il detective Hercule Poirot?', ['Agatha Christie', 'Arthur Conan Doyle', 'Georges Simenon', 'Raymond Chandler']),
    q('Come si chiama il fedele amico e aiutante di Sherlock Holmes?', ['Il dottor Watson', 'Il capitano Hastings', 'L’ispettore Lestrade', 'Il professor Moriarty']),
  ],
  biblioteca: [
    q('In quale città immaginaria lavora il commissario Montalbano?', ['Vigàta', 'Macondo', 'Castelrotto', 'Roccacannuccia']),
    q('Chi ha scritto “Il nome della rosa”?', ['Umberto Eco', 'Italo Calvino', 'Dino Buzzati', 'Leonardo Sciascia']),
  ],
  serra: [
    q('Quale veleno è famoso per il suo odore di mandorle amare?', ['Cianuro', 'Arsenico', 'Stricnina', 'Cicuta']),
    q('Quale di queste piante è velenosa?', ['Oleandro', 'Basilico', 'Lavanda', 'Rosmarino']),
  ],
  cantina: [
    q('In “Assassinio sull’Orient Express”, chi è il colpevole?', ['Tutti i passeggeri insieme', 'Il maggiordomo', 'Il controllore', 'Nessuno: è un suicidio']),
    q('Quale vino è tipico delle Langhe piemontesi?', ['Barolo', 'Chianti', 'Amarone', 'Brunello']),
  ],
};

function profileLines(traits) {
  return CATEGORIES.map((c) => `${c.icon} ${c.label}: ${traitLabel(c.key, traits[c.key])}`);
}

function cardFor(setup, pid) {
  const traits = setup.traits[pid];
  if (pid === setup.culprit) {
    return {
      tone: 'danger', title: '🗡️ SEI IL COLPEVOLE',
      lines: [
        'Hai ucciso il Barone. Non farti scoprire!',
        ...profileLines(traits),
        `Indizio FALSO da spacciare: «${clueText(setup.fakeClue)}»`,
        'Puoi sbagliare apposta i quiz: se la squadra va male, trova solo indizi deboli.',
      ],
    };
  }
  return {
    tone: 'secret', title: '🕵️ Sei innocente',
    lines: [
      'Scopri chi ha ucciso il Barone.',
      ...profileLines(traits),
      `Il tuo indizio (vero): «${clueText(setup.privateClues[pid])}»`,
      'Condividilo… ma attenzione: il colpevole mentirà sul suo.',
    ],
  };
}

function dossier(ctx) {
  const { traits } = ctx.state.g;
  const suspects = ctx.players().filter((p) => traits[p.pid]);
  return ctx.ui.playerCards(suspects, (p) => el('ul', { class: 'traits' },
    CATEGORIES.map((c) => el('li', {}, `${c.icon} `, el('b', {}, traitLabel(c.key, traits[p.pid][c.key]))))));
}

async function roles(ctx) {
  const setup = setupGiallo(ctx.active().map((p) => p.pid), ctx.rng);
  ctx.setState({ g: setup, clues: [] });
  for (const pid of Object.keys(setup.traits)) ctx.sendCard(pid, cardFor(setup, pid));
  ctx.ui.show({
    art: 'dossier', kicker: 'Carte segrete', title: 'Uno di voi è l’assassino',
    text: 'Ognuno ha ricevuto sul telefono una carta segreta: leggetela senza farla vedere! Gli innocenti hanno un indizio vero. Il colpevole ne ha uno falso…',
  });
  ctx.sfx('drum');
  await ctx.advance({ phone: 'Leggi la tua carta segreta 🔒 (pulsante in basso)' });
  return 'dossier';
}

async function showDossier(ctx) {
  ctx.ui.show({
    kicker: 'Il fascicolo degli ospiti', title: 'Cosa ricorda la servitù',
    text: 'Dove eravate alle 22, cosa indossavate, di cosa odoravate. Memorizzate: servirà per l’accusa.',
    body: dossier(ctx), layout: 'center',
  });
  ctx.sfx('whoosh');
  await ctx.advance({ phone: 'Studia il fascicolo sullo schermo 📁' });
  return 'likely1';
}

function clueStep(step, next) {
  return async (ctx) => {
    const success = ctx.state.lastQuiz?.success ?? false;
    const clue = rewardClue(ctx.state.g, step, success, ctx.rng);
    ctx.setState({ clues: [...ctx.state.clues, clue] });
    ctx.ui.show({
      art: 'dossier', kicker: success ? 'Ottimo lavoro, detective!' : 'Indagine confusa…',
      title: `Indizio n. ${step + 1}`, body: ctx.ui.clueCard(clueText(clue), success),
    });
    ctx.sfx(success ? 'fanfare' : 'sad');
    if (success) ctx.confetti(80);
    await ctx.advance({ phone: `Nuovo indizio: ${clueText(clue)}` });
    return next;
  };
}

async function discuss(ctx) {
  const body = el('div', { class: 'discuss' }, dossier(ctx),
    el('div', { class: 'clue-list' }, ctx.state.clues.map((c) => ctx.ui.clueCard(clueText(c), c.positive))));
  ctx.ui.show({
    kicker: `Discussione · ${DISCUSS_SECONDS / 60} minuti`, title: 'Chi è stato?',
    text: 'Condividete i vostri indizi privati, confrontateli col fascicolo. Il colpevole mentirà…', body, layout: 'center',
  });
  ctx.sfx('reveal');
  const countdown = ctx.ui.timer(DISCUSS_SECONDS);
  await ctx.advance({
    label: 'Passiamo all’accusa ▶', phone: 'Discutete! Riguarda la tua carta 🔒',
    until: sleep(DISCUSS_SECONDS * 1000),
  });
  countdown.stop();
  return 'accuse';
}

async function accuse(ctx) {
  const { g } = ctx.state;
  const suspects = ctx.players().filter((p) => g.traits[p.pid]);
  const options = suspects.map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const board = ctx.ui.pickBoard(suspects);
  ctx.ui.show({ kicker: 'Il momento della verità', title: 'Chi accusate?', body: board, layout: 'center' });
  ctx.sfx('drum');
  const { answers } = await ctx.collect({
    time: ACCUSE_SECONDS,
    screenFor: (p) => ({ kind: 'players', title: 'Chi è il colpevole?', options: options.filter((o) => o.pid !== p.pid) }),
  });
  const counts = tallyKeys(answers, suspects.map((s) => s.pid));
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  ctx.sfx('drum');
  await sleep(2200);

  const caught = top.length === 1 && top[0] === g.culprit;
  const accused = top.length === 1 ? ctx.player(top[0]) : null;
  const culprit = ctx.player(g.culprit);
  const innocentVotes = [...answers].filter(([pid]) => pid !== g.culprit);
  const fooled = innocentVotes.filter(([, a]) => a.value !== g.culprit).length;

  for (const [pid, a] of innocentVotes) {
    const right = a.value === g.culprit;
    if (right) ctx.addPoints(pid, CATCH_POINTS);
    ctx.send(pid, {
      kind: 'result', good: right, points: right ? CATCH_POINTS : 0,
      title: right ? 'Avevi capito tutto!' : 'Ti sei fatto ingannare…', text: `Il colpevole era ${culprit.name}`,
    });
  }
  const escapePoints = caught ? 0 : ESCAPE_POINTS + FOOLED_POINTS * fooled;
  ctx.addPoints(g.culprit, escapePoints);
  ctx.send(g.culprit, {
    kind: 'result', good: !caught, points: escapePoints,
    title: caught ? 'Ti hanno scoperto!' : 'L’hai fatta franca! 😈', text: `${fooled} persone ingannate`,
  });
  ctx.setState({ caught });

  let title = 'Voti divisi: nessuna accusa!';
  if (accused) title = caught ? `${accused.name} È IL COLPEVOLE!` : `${accused.name} è innocente!`;
  ctx.ui.show({
    art: 'accusa', kicker: accused ? `Accusato: ${accused.avatar} ${accused.name}` : 'Nessuna maggioranza', title,
    text: caught
      ? `Le prove erano schiaccianti. ${culprit.avatar} ${culprit.name} viene portato via dai carabinieri tra i lampi.`
      : `Il vero colpevole era ${culprit.avatar} ${culprit.name}, che ora sparisce nella tempesta con l’eredità del Barone…`,
  });
  ctx.flash();
  ctx.sfx(caught ? 'fanfare' : 'reveal');
  if (caught) ctx.confetti(200);
  await ctx.advance();
  return 'end';
}

function room(id, art, title, text) {
  return { type: 'narr', art, kicker: 'Indagine', title, text, next: `quiz_${id}` };
}
function roomQuiz(id, label, next) {
  return { type: 'quiz', art: id, kicker: label, questions: QUESTIONS[id], time: 20, next };
}

const scenes = {
  intro: {
    type: 'narr', art: 'villa', kicker: 'Villa Corvara · 23:47', title: 'Delitto a Villa Corvara', sfx: 'thunder',
    text: 'Notte di tempesta. Il Barone Ottavio Corvara aveva invitato a cena i suoi ospiti più cari: voi. Poco prima di mezzanotte, un urlo. Il Barone giace nello studio, senza vita. La strada è allagata, nessuno può andarsene. L’assassino è in questa stanza.',
    next: 'roles',
  },
  roles: { type: 'custom', run: roles },
  dossier: { type: 'custom', run: showDossier },
  likely1: { type: 'likely', art: 'accusa', title: 'nasconda un segreto inconfessabile?', next: 'vote1' },
  vote1: {
    type: 'vote', art: 'dossier', title: 'Da dove iniziamo le indagini?',
    options: [{ label: '🖋️ Lo studio del Barone', goto: 'studio' }, { label: '📚 La biblioteca', goto: 'biblioteca' }],
  },
  studio: room('studio', 'studio', 'Lo studio del Barone', 'Cassetti forzati, una tazza rovesciata, una lettera bruciata a metà nel camino. Al telefono il commissario vi sfida: «Volete fare i detective? Dimostratelo.» Se risponderete bene, troverete un indizio decisivo.'),
  quiz_studio: roomQuiz('studio', 'Indagine nello studio', 'clue1'),
  biblioteca: room('biblioteca', 'biblioteca', 'La biblioteca', 'Migliaia di libri e una candela ancora accesa. Su uno scaffale manca un volume: qualcuno l’ha sfilato in fretta. Rispondete bene e il nascondiglio parlerà.'),
  quiz_biblioteca: roomQuiz('biblioteca', 'Indagine in biblioteca', 'clue1'),
  clue1: { type: 'custom', run: clueStep(0, 'notebook') },
  notebook: {
    type: 'write', art: 'taccuino', title: 'Il taccuino del Barone',
    text: 'Tra le pagine c’è un’ultima frase, interrotta a metà: «Se stanotte mi succede qualcosa, è perché…». Completatela voi: vince la più convincente (o la più assurda).',
    placeholder: '…ho scoperto chi mangia la mia Nutella', next: 'vote2',
  },
  vote2: {
    type: 'vote', art: 'villa', title: 'Dove cerchiamo adesso?',
    options: [{ label: '🌿 La serra', goto: 'serra' }, { label: '🍷 La cantina', goto: 'cantina' }],
  },
  serra: room('serra', 'serra', 'La serra', 'Il vetro è appannato, l’aria è dolciastra. Sul bancone, un vasetto senza etichetta e un paio di forbici sporche di terra. Rispondete e scoprite cosa nasconde.'),
  quiz_serra: roomQuiz('serra', 'Indagine nella serra', 'clue2'),
  cantina: room('cantina', 'cantina', 'La cantina', 'Botti, bottiglie impolverate e impronte fresche sul pavimento umido. Una bottiglia di annata è stata stappata stanotte. Rispondete e seguite le tracce.'),
  quiz_cantina: roomQuiz('cantina', 'Indagine in cantina', 'clue2'),
  clue2: { type: 'custom', run: clueStep(1, 'likely2') },
  likely2: { type: 'likely', art: 'accusa', title: 'sia il vero colpevole? (sondaggio a caldo)', next: 'discuss' },
  discuss: { type: 'custom', run: discuss },
  accuse: { type: 'custom', run: accuse },
  end: {
    type: 'end', phoneTitle: 'Caso chiuso!',
    outcome: (ctx) => (ctx.state.caught
      ? { art: 'villa', title: 'Giustizia è fatta', text: 'La tempesta si placa. A Villa Corvara torna il silenzio, e voi tornate a casa con una storia da raccontare.' }
      : { art: 'accusa', title: 'Il delitto perfetto', text: 'Nessuno saprà mai la verità… tranne il colpevole, che stanotte dormirà benissimo.', sad: true }),
  },
};

export default {
  id: 'giallo',
  title: 'Delitto a Villa Corvara',
  blurb: 'Un giallo con un colpevole segreto tra voi: indizi, interrogatori e accusa finale.',
  cover: 'villa',
  theme: 'giallo',
  minPlayers: 3,
  minutes: 35,
  start: 'intro',
  scenes,
  initialState: () => ({ clues: [] }),
  hud: (ctx) => `🔍 Indizi: ${ctx.state.clues?.length ?? 0}/2`,
};
