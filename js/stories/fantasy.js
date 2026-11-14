// Fantasy: La Torre di Brinacorvo. Cooperative party with shared hearts and a dragon boss.
import { el, sleep } from '../dom.js';
import { shuffle } from '../logic.js';
import { askQuestion } from '../host/scenes.js';

const MAX_HP = 10;
const BOSS_HP = 100;
const BOSS_TIME = 15;
const MAX_FIRE = 3;
const SWORD_MULT = 1.5;
const POTION_HEAL = 4;

const q = (text, options, answer = 0) => ({ q: text, options, answer });
const RIDDLES = [
  q('Più ne togli, più diventa grande. Cos’è?', ['Una buca', 'Un debito', 'Una candela', 'Un’ombra']),
  q('Ha i denti ma non morde mai. Cos’è?', ['Il pettine', 'Il serpente', 'La forchetta', 'Il drago addormentato']),
  q('Al mattino cammina a quattro zampe, a mezzogiorno con due, la sera con tre. Chi è?', ['L’uomo', 'Il cavallo', 'Il gatto', 'Il ragno']),
  q('Ha un occhio solo ma non vede. Cos’è?', ['L’ago', 'La talpa', 'Il pirata', 'La luna']),
  q('Basta dire il suo nome per romperlo. Cos’è?', ['Il silenzio', 'Il vetro', 'Lo specchio', 'Il ghiaccio']),
];
const BOSS_QUESTIONS = [
  q('Chi ha scritto “Il Signore degli Anelli”?', ['J.R.R. Tolkien', 'C.S. Lewis', 'George R.R. Martin', 'Terry Pratchett']),
  q('Come si chiama il drago de “Lo Hobbit”?', ['Smaug', 'Drogon', 'Falkor', 'Shenron']),
  q('Come si chiama il martello di Thor?', ['Mjöllnir', 'Gungnir', 'Excalibur', 'Durlindana']),
  q('Come si chiama la spada di re Artù?', ['Excalibur', 'Durlindana', 'Andúril', 'Balmung']),
  q('Quale creatura mitologica rinasce dalle proprie ceneri?', ['La fenice', 'Il grifone', 'La chimera', 'Il basilisco']),
  q('Su quale isola si trovava il labirinto del Minotauro?', ['Creta', 'Rodi', 'Sicilia', 'Cipro']),
  q('Quanti sono i nani nella fiaba di Biancaneve?', ['7', '6', '8', '12']),
  q('Quale mago guida la Compagnia dell’Anello?', ['Gandalf', 'Merlino', 'Saruman', 'Silente']),
  q('Quale pianeta prende il nome dal dio romano della guerra?', ['Marte', 'Giove', 'Saturno', 'Mercurio']),
];
const CLASSES = [
  { icon: '⚔️', name: 'Guerriero', text: 'Colpisci forte, pensi dopo.' },
  { icon: '🔮', name: 'Maga', text: 'Conosci mille incantesimi e mille indovinelli.' },
  { icon: '🗡️', name: 'Ladra', text: 'Nessuna serratura ti resiste.' },
  { icon: '✨', name: 'Chierico', text: 'La tua fede cura le ferite (quasi sempre).' },
  { icon: '🎻', name: 'Bardo', text: 'Le tue canzoni sono… rumorose.' },
  { icon: '🏹', name: 'Ranger', text: 'Non sbagli un colpo. Quasi mai.' },
  { icon: '🪓', name: 'Nano', text: 'Basso, testardo, invincibile a braccio di ferro.' },
  { icon: '🌿', name: 'Druida', text: 'Parli con gli alberi. Gli alberi non rispondono.' },
];

async function damage(ctx, amount) {
  const hp = Math.max(0, ctx.state.hp - amount);
  ctx.setState({ hp });
  ctx.ui.shake();
  ctx.sfx('hit');
  await ctx.ui.banner(`-${amount} ❤️`, 'bad', 1200);
}

async function heal(ctx, amount) {
  ctx.setState({ hp: Math.min(ctx.state.maxHp + amount, ctx.state.hp + amount), maxHp: ctx.state.maxHp + amount });
  ctx.sfx('ding');
  await ctx.ui.banner(`+${amount} ❤️`, 'good', 1200);
}

async function classes(ctx) {
  const list = shuffle(CLASSES, ctx.rng);
  const party = ctx.active().map((p, i) => ({ p, c: list[i % list.length] }));
  for (const { p, c } of party) {
    ctx.sendCard(p.pid, { tone: 'info', title: `${c.icon} Sei ${c.name === 'Maga' || c.name === 'Ladra' ? 'la' : 'il'} ${c.name}`, lines: [c.text, 'La compagnia condivide i cuori: se finiscono, finisce l’avventura.'] });
  }
  const byPid = Object.fromEntries(party.map(({ p, c }) => [p.pid, c]));
  ctx.setState({ classes: byPid });
  ctx.ui.show({
    kicker: 'La compagnia', title: 'Ecco i vostri eroi',
    body: ctx.ui.playerCards(party.map(({ p }) => p), (p) => el('div', { class: 'hero-class' }, `${byPid[p.pid].icon} ${byPid[p.pid].name}`)),
    layout: 'center',
  });
  ctx.sfx('fanfare');
  await ctx.advance({ phone: 'Guarda la tua classe 🔒 (pulsante in basso)' });
  return 'gate';
}

async function boss(ctx) {
  const heroes = Math.max(1, ctx.active().length);
  const perHit = Math.ceil((BOSS_HP / (heroes * 2.5)) * (ctx.state.sword ? SWORD_MULT : 1));
  ctx.setState({ boss: BOSS_HP });
  const pool = shuffle(BOSS_QUESTIONS, ctx.rng);
  for (let round = 0; round < pool.length && ctx.state.boss > 0 && ctx.state.hp > 0; round++) {
    await askQuestion(ctx, pool[round], {
      time: BOSS_TIME, art: 'dragon', kicker: `🐉 Il drago chiede · round ${round + 1}`,
      onReveal: async ({ correct, total }) => {
        await sleep(600);
        const dealt = Math.min(ctx.state.boss, correct * perHit);
        if (dealt > 0) {
          ctx.setState({ boss: ctx.state.boss - dealt });
          ctx.sfx('hit');
          await ctx.ui.banner(`⚔️ -${dealt} al drago!`, 'good', 1200);
        }
        const fire = Math.min(MAX_FIRE, total - correct);
        if (fire > 0 && ctx.state.boss > 0) {
          ctx.sfx('roar');
          ctx.flash();
          await damage(ctx, fire);
        }
      },
    });
  }
  if (ctx.state.boss <= 0) return 'win';
  if (ctx.state.hp <= 0) return 'dead';
  return 'flee';
}

function hud(ctx) {
  const { hp = 0, maxHp = MAX_HP, boss: bossHp } = ctx.state;
  return el('div', { class: 'hud-fantasy' },
    el('span', { class: 'hearts', title: `${hp} cuori` }, '❤️'.repeat(hp), el('span', { class: 'hearts--lost' }, '🖤'.repeat(Math.max(0, maxHp - hp)))),
    bossHp != null && bossHp > 0
      ? el('span', { class: 'boss-bar' }, '🐉', el('span', { class: 'boss-bar__track' }, el('span', { style: { width: `${(bossHp / BOSS_HP) * 100}%` } })))
      : null);
}

const partyName = (ctx) => (ctx.state.lastWrite?.[0] ? `«${ctx.state.lastWrite[0]}»` : 'la vostra compagnia');

const scenes = {
  intro: {
    type: 'narr', art: 'tower', kicker: 'Le Terre di Brinacorvo', title: 'La Torre di Brinacorvo',
    text: 'Da cento anni un drago dorme in cima alla Torre di Brinacorvo, sopra un tesoro rubato a mezzo regno. Stanotte si è svegliato. Il re cercava eroi… e ha trovato voi. Avete 10 cuori in comune: se finiscono, finisce l’avventura.',
    next: 'classes',
  },
  classes: { type: 'custom', run: classes },
  gate: {
    type: 'vote', art: 'tower', title: 'Ai piedi della torre, due strade. Quale prendete?',
    options: [{ label: '💀 La cripta sotterranea', goto: 'crypt' }, { label: '🌉 Il ponte sul burrone', goto: 'bridge' }],
  },
  crypt: {
    type: 'narr', art: 'crypt', kicker: 'La cripta', title: 'La porta delle rune', sfx: 'reveal',
    text: 'Scheletri, ragnatele e una porta di pietra coperta di rune. Una voce antica sussurra: «Solo chi risolve i miei indovinelli può passare. Chi sbaglia… paga col sangue.»',
    next: 'cryptRiddles',
  },
  cryptRiddles: {
    type: 'quiz', art: 'crypt', kicker: 'Indovinelli della cripta', questions: RIDDLES.slice(0, 3), time: 25,
    after: async (ctx, r) => { if (!r.success) await damage(ctx, 2); },
    next: 'camp',
  },
  bridge: {
    type: 'narr', art: 'bridge', kicker: 'Il burrone', title: 'Il ponte di corda',
    text: 'Un ponte di corda marcia oscilla sopra un abisso senza fondo. Qualcuno deve attraversarlo per primo e fissare la corda dall’altra parte.',
    next: 'bridgeDice',
  },
  bridgeDice: {
    type: 'dice', art: 'bridge', title: 'Attraversare il ponte', target: 9,
    success: 'Passo dopo passo, ce l’ha fatta! La corda è fissata: tutta la compagnia passa.',
    fail: 'Un’asse si spezza! Si salva aggrappandosi alla corda, ma la caduta costa cara: -2 cuori.',
    onFail: (ctx) => damage(ctx, 2),
    next: 'bridgeRiddles',
  },
  bridgeRiddles: {
    type: 'quiz', art: 'bridge', kicker: 'Il guardiano del ponte', questions: RIDDLES.slice(3), time: 25,
    after: async (ctx, r) => { if (!r.success) await damage(ctx, 1); },
    next: 'camp',
  },
  camp: {
    type: 'write', art: 'campfire', title: 'Attorno al fuoco',
    text: 'Vi accampate a metà della torre. Il bardo insiste: ogni compagnia leggendaria ha un nome. Scrivete il nome più epico (o più ridicolo) per il vostro gruppo!',
    placeholder: 'I Cavalieri della Pizza Fredda', next: 'likely',
  },
  likely: { type: 'likely', art: 'campfire', title: 'scappi per primo davanti al drago?', next: 'treasure' },
  treasure: {
    type: 'vote', art: 'treasure', title: 'Una stanza piena d’oro e due oggetti magici. Potete prenderne solo uno!',
    options: [
      { label: '⚔️ Spada Ammazzadraghi (+50% danni al drago)', effect: (ctx) => ctx.setState({ sword: true }) },
      { label: '🧪 Pozione della Fenice (+4 cuori)', effect: (ctx) => heal(ctx, POTION_HEAL) },
    ],
    next: 'climb',
  },
  climb: {
    type: 'dice', art: 'climb', title: 'La scalata finale', target: 12,
    text: 'L’ultima rampa di scale è crollata: bisogna arrampicarsi sulla parete esterna, nel vento.',
    success: 'Con un ultimo slancio, raggiunge la cima e cala la corda agli altri. Siete arrivati!',
    fail: 'Una pietra si stacca e travolge la compagnia. Arrivate in cima… acciaccati: -2 cuori.',
    onFail: (ctx) => damage(ctx, 2),
    next: 'dragon',
  },
  dragon: {
    type: 'narr', art: 'dragon', kicker: 'La cima della torre', title: 'Il drago si sveglia', sfx: 'roar',
    text: 'Tra montagne d’oro, due occhi gialli si aprono. «Piccoli eroi», ruggisce il drago, «rispondete alle mie domande. Ogni risposta giusta è un colpo di spada. Ogni errore… è fuoco.»',
    phone: 'Preparati: domande rapide da 15 secondi! 🐉', next: 'boss',
  },
  boss: { type: 'custom', run: boss },
  win: {
    type: 'narr', art: 'victory', kicker: 'Vittoria!', title: 'Il drago è sconfitto!', sfx: 'fanfare',
    text: (ctx) => `Con un ultimo ruggito il drago crolla sul suo tesoro. I bardi canteranno per secoli le gesta di ${partyName(ctx)}.`,
    next: 'end',
  },
  flee: {
    type: 'narr', art: 'tower', kicker: 'Quasi…', title: 'Il drago fugge!',
    text: 'Ferito e furioso, il drago spalanca le ali e sparisce tra le nuvole. Il tesoro è vostro… ma tornerà. Oh, se tornerà.',
    next: 'end',
  },
  dead: {
    type: 'narr', art: 'defeat', kicker: 'Sconfitta', title: 'La compagnia cade', sfx: 'sad',
    text: (ctx) => `Il fuoco del drago non perdona. Delle gesta di ${partyName(ctx)} resta solo un elmo ammaccato… e una gran bella storia.`,
    next: 'end',
  },
  end: {
    type: 'end', phoneTitle: 'Avventura conclusa!',
    outcome: (ctx) => ({ art: ctx.state.boss <= 0 ? 'treasure' : 'campfire', title: 'Chi è l’eroe della serata?', text: 'Punti per risposte giuste, prove superate e voti dei compagni. Ecco la classifica…' }),
  },
};

export default {
  id: 'fantasy',
  title: 'La Torre di Brinacorvo',
  blurb: 'Avventura cooperativa: bivi, indovinelli, dadi e un drago da battere insieme.',
  cover: 'tower',
  theme: 'fantasy',
  minPlayers: 2,
  minutes: 30,
  start: 'intro',
  scenes,
  initialState: () => ({ hp: MAX_HP, maxHp: MAX_HP, sword: false }),
  hud,
  guard: (ctx, next) => (ctx.state.hp <= 0 && !['dead', 'end', 'END'].includes(next) ? 'dead' : next),
};
