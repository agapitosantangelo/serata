// Fantasy v2: La Torre di Brinacorvo. Shared hearts, maybe a hidden servant of the dragon,
// a mid-game pact with the dragon, the dragon's egg, and a battle fought with secret choices.
import { el, sleep } from '../dom.js';
import { shuffle, tallyKeys, topKeys } from '../logic.js';
import { setFlags, bump, addCardLines } from '../host/state.js';

const MAX_HP = 10;
const DRAGON_HP = 100;
const SERVANT_CHANCE = 0.5;
const SWORD_MULT = 1.5;
const BATTLE_ROUNDS = { 30: 3, 60: 4 };
const POINTS = { attack: 100, dragonHelp: 150, unmask: 500, hidden: 1500, objective: 400 };
const BATTLE_FACES = { help: ['⚔️', 'Attacco'], watch: ['🛡️', 'Scudo'], sabotage: ['🐉', 'Per il drago'] };

const CLASSES = [
  { icon: '⚔️', name: 'Guerriero', text: 'Colpisci forte, pensi dopo.' },
  { icon: '🔮', name: 'Maga', text: 'Conosci mille incantesimi e mille scuse.' },
  { icon: '🗡️', name: 'Ladra', text: 'Nessuna serratura ti resiste.' },
  { icon: '✨', name: 'Chierico', text: 'La tua fede cura le ferite (quasi sempre).' },
  { icon: '🎻', name: 'Bardo', text: 'Le tue canzoni sono… rumorose.' },
  { icon: '🏹', name: 'Ranger', text: 'Non sbagli un colpo. Quasi mai.' },
  { icon: '🪓', name: 'Nano', text: 'Basso, testardo, invincibile a braccio di ferro.' },
  { icon: '🌿', name: 'Druida', text: 'Parli con gli alberi. Gli alberi non rispondono.' },
];

const isDark = (ctx, pid) => ctx.state.servant === pid || (ctx.state.turned ?? []).includes(pid);
const party = (ctx) => ctx.active().filter((p) => !(ctx.state.exiled ?? []).includes(p.pid));

async function damage(ctx, amount) {
  ctx.setState({ hp: Math.max(0, ctx.state.hp - amount) });
  ctx.ui.shake();
  ctx.sfx('hit');
  await ctx.ui.banner(`-${amount} ❤️`, 'bad', 1200);
}

// ---------- secret objectives ----------
const OBJECTIVES = [
  { id: 'slayer', text: 'Il drago deve essere sconfitto', check: (ctx) => ctx.state.dragonHp <= 0 },
  { id: 'egg', text: 'L’uovo del drago non deve essere distrutto', check: (ctx) => ctx.state.flags?.egg !== 'smashed' },
  { id: 'shield', text: 'Proteggi la squadra almeno due volte in battaglia', check: (ctx, pid) => (ctx.state.stats?.[pid]?.shield ?? 0) >= 2 },
  { id: 'pact', text: 'Stringi un patto con qualcuno', check: (ctx, pid) => (ctx.state.stats?.[pid]?.pact ?? 0) > 0 },
  { id: 'gold', text: 'Torna a casa con dell’oro rubato', check: (ctx, pid) => (ctx.state.stats?.[pid]?.steal ?? 0) > 0 },
  { id: 'unsuspected', text: 'Nessuno deve accusarti alla fine', check: (ctx, pid) => !(ctx.state.finalVotes ?? {})[pid] },
];
const DARK_OBJECTIVE = { id: 'dark', text: 'Il drago non deve morire', check: (ctx) => ctx.state.dragonHp > 0, points: 0 };

async function roles(ctx) {
  const players = ctx.active();
  const classes = shuffle(CLASSES, ctx.rng);
  const deck = shuffle(OBJECTIVES, ctx.rng);
  const servant = ctx.rng() < SERVANT_CHANCE ? players[Math.floor(ctx.rng() * players.length)].pid : null;
  const objectives = {};
  const classOf = {};
  players.forEach((p, i) => {
    classOf[p.pid] = classes[i % classes.length];
    objectives[p.pid] = p.pid === servant ? DARK_OBJECTIVE : deck[i % deck.length];
  });
  ctx.setState({ servant, objectives, classOf });
  for (const p of players) {
    const c = classOf[p.pid];
    const lines = [c.text, 'La compagnia condivide 10 cuori: se finiscono, finisce l’avventura.'];
    if (p.pid === servant) {
      ctx.sendCard(p.pid, { tone: 'danger', title: `🐉 ${c.icon} ${c.name}… al servizio del drago`, lines: [...lines, 'Segretamente servi il drago: non deve morire. Puoi sabotare le prove e, in battaglia, aiutarlo.', `🎯 ${DARK_OBJECTIVE.text}`] });
    } else {
      ctx.sendCard(p.pid, { tone: 'info', title: `${c.icon} ${c.name}`, lines: [...lines, `🎯 Obiettivo segreto: ${objectives[p.pid].text}`] });
    }
  }
  ctx.ui.show({
    kicker: 'La compagnia', title: 'Ecco i vostri eroi',
    text: 'Ognuno ha una classe e un obiettivo segreto. E forse… uno di voi serve già il drago. Forse. Nessuno lo sa.',
    body: ctx.ui.playerCards(players, (p) => el('div', { class: 'hero-class' }, `${classOf[p.pid].icon} ${classOf[p.pid].name}`)),
    layout: 'center',
  });
  ctx.sfx('fanfare');
  await ctx.advance({ phone: 'Leggi la tua carta 🔒 (pulsante in basso)' });
  return 'gate';
}

// ---------- the battle: secret attack / shield / help the dragon ----------
async function battleRound(ctx, round, total) {
  const fighters = party(ctx);
  const perHit = Math.ceil((DRAGON_HP / (Math.max(2, fighters.length) * 2)) * (ctx.state.flags?.sword ? SWORD_MULT : 1));
  ctx.ui.show({
    art: 'dragon', kicker: `Battaglia · round ${round}/${total}`, title: 'Cosa fate?',
    text: 'Scegliete in segreto: attaccare, proteggere la squadra dal fuoco… o aiutare il drago. Si vedranno solo i totali.',
  });
  ctx.sfx('roar');
  const { answers, targets } = await ctx.collect({
    time: 20, players: fighters,
    screen: { kind: 'choice', style: 'vote', title: `Round ${round}: cosa fai?`, options: ['⚔️ Attacco', '🛡️ Proteggo la squadra', '🐉 Aiuto il drago'] },
  });
  const pick = (pid) => ['attack', 'shield', 'dragon'][answers.get(pid)?.value] ?? 'shield';
  const choices = targets.map((pid) => [pid, pick(pid)]);
  const attacks = choices.filter(([, c]) => c === 'attack').length;
  const shields = choices.filter(([, c]) => c === 'shield').length;
  const helps = choices.filter(([, c]) => c === 'dragon').length;
  const scene = ctx.ui.show({ art: 'dragon', kicker: `Battaglia · round ${round}/${total}`, title: 'Le carte vengono girate…' });
  const kinds = shuffle(choices.map(([, c]) => ({ attack: 'help', shield: 'watch', dragon: 'sabotage' })[c]), ctx.rng);
  await ctx.ui.poolReveal(scene.querySelector('.scene__content'), kinds, BATTLE_FACES);

  const dealt = Math.max(0, attacks * perHit - helps * perHit);
  const rage = ctx.state.flags?.egg === 'smashed' ? 1 : 0;
  const fire = Math.max(0, 3 + rage - shields);
  for (const [pid, c] of choices) {
    if (c === 'attack') { bump(ctx, pid, 'help'); if (dealt > 0) ctx.addPoints(pid, POINTS.attack); }
    if (c === 'shield') bump(ctx, pid, 'shield');
    if (c === 'dragon') { bump(ctx, pid, 'sabotage'); ctx.addPoints(pid, POINTS.dragonHelp); }
  }
  ctx.setState({ dragonHp: Math.max(0, ctx.state.dragonHp - dealt) });
  scene.querySelector('.scene__content').append(el('p', { class: 'pool-summary' },
    `⚔️ ${attacks} · 🛡️ ${shields} · 🐉 ${helps} → ${dealt} danni al drago, fuoco ${fire ? `per ${fire} ❤️` : 'respinto'}`));
  await sleep(900);
  if (dealt > 0) await ctx.ui.banner(`⚔️ -${dealt} al drago!`, 'good', 1200);
  if (fire > 0 && ctx.state.dragonHp > 0) { ctx.flash(); await damage(ctx, fire); }
  await ctx.advance({ phone: helps ? 'Qualcuno ha aiutato il drago… 🐉' : 'Guarda lo schermo 👀' });
}

async function battle(ctx) {
  const total = ctx.state.rounds;
  if (ctx.state.flags?.egg === 'smashed') {
    ctx.ui.show({ art: 'dragon', kicker: 'Furia', title: 'Il drago sa dell’uovo', text: 'Annusa i gusci sui vostri vestiti. I suoi occhi diventano rossi: stanotte il fuoco brucerà più forte.' });
    ctx.sfx('roar');
    await ctx.advance();
  }
  for (let round = 1; round <= total && ctx.state.dragonHp > 0 && ctx.state.hp > 0; round++) await battleRound(ctx, round, total);
  return 'unmask';
}

async function eggChoice(ctx) {
  if (ctx.state.flags?.egg !== 'taken') return 'battle';
  const board = ctx.ui.voteBoard(['🥚 Restituiamo l’uovo', '⚔️ Teniamolo e combattiamo']);
  ctx.ui.show({ art: 'dragon', kicker: 'L’uovo', title: 'Il drago fiuta il suo uovo nel vostro zaino', text: 'Potreste restituirglielo… se si fiderà di voi.', body: board });
  const { answers } = await ctx.collect({ time: 25, screen: { kind: 'choice', style: 'vote', title: 'Restituire l’uovo?', options: ['🥚 Restituiamo', '⚔️ Combattiamo'] } });
  const yes = [...answers.values()].filter((a) => a.value === 0).length;
  const give = yes > answers.size - yes;
  ctx.ui.revealVote(board, [yes, answers.size - yes], give ? 0 : 1);
  await sleep(1500);
  if (!give) { await ctx.advance(); return 'battle'; }
  const stolen = ['a-steals', 'b-steals', 'both-steal'].includes(ctx.state.flags?.treasure);
  setFlags(ctx, { eggReturned: true });
  ctx.ui.show({
    art: stolen ? 'dragon' : 'victory', kicker: 'L’uovo', title: stolen ? 'Ma sente odore d’oro rubato…' : 'Il drago abbassa la testa',
    text: stolen
      ? 'Prende l’uovo con delicatezza… poi annusa le vostre tasche piene del suo oro. Il ringhio torna. Si combatte.'
      : 'Prende l’uovo tra gli artigli, con una delicatezza impossibile. Per la prima volta in cento anni, il drago non è solo.',
  });
  ctx.sfx(stolen ? 'roar' : 'fanfare');
  await ctx.advance();
  if (stolen) return 'battle';
  setFlags(ctx, { dragonAlly: true });
  return 'unmask';
}

async function unmask(ctx) {
  const players = ctx.players();
  const board = ctx.ui.pickBoard(players);
  ctx.ui.show({
    kicker: 'L’ultima rivelazione', title: 'Chi serviva il drago?',
    text: 'Forse nessuno, forse qualcuno. Votate chi smascherare: chi accusa un fedele perde punti. Potete anche votare “nessuno” non votando.',
    body: board, layout: 'center',
  });
  ctx.sfx('drum');
  const options = players.map(({ pid, name, avatar }) => ({ pid, name, avatar }));
  const { answers } = await ctx.collect({ time: 40, screenFor: (p) => ({ kind: 'players', title: 'Chi serviva il drago?', options: options.filter((o) => o.pid !== p.pid) }) });
  const valid = new Map([...answers].filter(([pid, a]) => a.value !== pid));
  const counts = tallyKeys(valid, players.map((p) => p.pid));
  const top = topKeys(counts);
  ctx.ui.revealPick(board, counts, top);
  const finalVotes = Object.fromEntries([...counts].filter(([, n]) => n > 0));
  for (const [pid, n] of Object.entries(finalVotes)) bump(ctx, pid, 'votesAgainst', n);
  await sleep(2200);
  const accused = top.length === 1 ? top[0] : null;
  const darkOnes = players.filter((p) => isDark(ctx, p.pid)).map((p) => p.pid);
  const unmasked = Boolean(accused && isDark(ctx, accused));
  for (const [pid, a] of valid) {
    if (isDark(ctx, a.value) && !isDark(ctx, pid)) ctx.addPoints(pid, POINTS.unmask);
    else if (a.value === accused && !unmasked) ctx.addPoints(pid, -POINTS.unmask / 2);
  }
  for (const pid of darkOnes) if (pid !== accused) ctx.addPoints(pid, POINTS.hidden);
  ctx.setState({ finalVotes });
  setFlags(ctx, { unmasked, darkCount: darkOnes.length });
  const who = accused ? ctx.player(accused) : null;
  let title = darkOnes.length ? 'Nessuno smascherato…' : 'Nessuno smascherato (e forse non c’era nessuno)';
  if (who) title = unmasked ? `${who.name} serviva il drago!` : `${who.name} era leale!`;
  const reveal = darkOnes.length ? `Al servizio del drago: ${darkOnes.map((pid) => ctx.player(pid)?.name).join(', ')}.` : 'Nessuno di voi serviva il drago: la paranoia ha fatto tutto da sola.';
  ctx.ui.show({ art: 'dragon', kicker: who ? `Accusato: ${who.avatar} ${who.name}` : 'Voti divisi', title, text: reveal });
  ctx.flash();
  ctx.sfx(unmasked || !darkOnes.length ? 'fanfare' : 'reveal');
  await ctx.advance();
  return 'finale';
}

const SIDES = {
  traitors: (ctx) => [ctx.state.servant, ...(ctx.state.turned ?? [])].filter(Boolean),
  loyalWon: (s) => Boolean(s.flags?.dragonAlly) || (s.dragonHp <= 0 && s.hp > 0),
  extraTraitor: async (ctx, pid) => {
    if (ctx.state.servant) ctx.setState({ turned: [...(ctx.state.turned ?? []), pid] });
    else ctx.setState({ servant: pid });
    ctx.setState({ objectives: { ...ctx.state.objectives, [pid]: DARK_OBJECTIVE } });
    addCardLines(ctx, pid, ['🐉 Sorpresa: anche tu servi il drago, fin dall’inizio. Non deve morire: sabota le prove e aiutalo in battaglia.', `🎯 Nuovo obiettivo: ${DARK_OBJECTIVE.text}`]);
  },
};

const partyName = (ctx) => (ctx.state.lastWrite?.[0] ? `«${ctx.state.lastWrite[0]}»` : 'la vostra compagnia');

const ENDINGS = [
  {
    id: 'ally', name: 'Il patto col drago', art: 'victory', when: (s) => s.flags?.dragonAlly,
    title: 'Il drago diventa vostro alleato',
    text: (ctx) => `Avete restituito l’uovo e non avete rubato niente. Il drago vola sopra il regno con ${partyName(ctx)} in groppa: i bardi non sanno più cosa inventarsi.`,
  },
  {
    id: 'heroic', name: 'Vittoria eroica', art: 'victory', when: (s) => s.dragonHp <= 0 && s.hp > 0 && (s.flags?.unmasked || !s.flags?.darkCount),
    title: 'Il drago è sconfitto!',
    text: (ctx) => `Il drago crolla sul suo tesoro e nessun traditore resta nell’ombra. Le gesta di ${partyName(ctx)} saranno cantate per secoli.`,
  },
  {
    id: 'tainted', name: 'Vittoria amara', art: 'treasure', when: (s) => s.dragonHp <= 0 && s.hp > 0, sad: true,
    title: 'Avete vinto… ma qualcuno ride',
    text: 'Il drago è morto, ma il suo servo è ancora tra voi, e stanotte metterà le mani su metà del tesoro.',
  },
  {
    id: 'flee', name: 'Il drago fugge', art: 'tower', when: (s) => s.dragonHp > 0 && s.hp > 0, sad: true,
    title: 'Fuga tra le nuvole',
    text: 'Ferito e furioso, il drago spalanca le ali e sparisce. Vi resta mezzo tesoro… e la certezza che tornerà.',
  },
  {
    id: 'defeat', name: 'Sconfitta', art: 'defeat', when: () => true, sad: true,
    title: 'La compagnia cade',
    text: (ctx) => `Il fuoco del drago non perdona. Di ${partyName(ctx)} resta un elmo ammaccato… e una gran bella storia.`,
  },
];

function roleOf(ctx, pid) {
  const c = ctx.state.classOf?.[pid];
  const cls = c ? `${c.icon} ${c.name}` : '';
  if (ctx.state.servant === pid) return `🐉 Servo del drago fin dall’inizio · ${cls}`;
  if ((ctx.state.turned ?? []).includes(pid)) return `🐉 Ha accettato il patto del drago · ${cls}`;
  return `🛡️ Leale · ${cls}`;
}

function build(length) {
  const long = length === 60;
  const scenes = {
    intro: {
      type: 'narr', art: 'tower', kicker: 'Le Terre di Brinacorvo', title: 'La Torre di Brinacorvo',
      text: 'Da cento anni un drago dorme in cima alla torre, sopra un tesoro rubato a mezzo regno. Stanotte si è svegliato. Il re cercava eroi… e ha trovato voi. Avete 10 cuori in comune. E forse, tra voi, qualcuno che tifa per il drago.',
      next: 'roles',
    },
    roles: { type: 'custom', run: roles },
    gate: {
      type: 'vote', art: 'tower', title: 'Ai piedi della torre, due strade. Quale prendete?',
      options: [{ label: '💀 La cripta sotterranea', goto: 'crypt' }, { label: '🌉 Il ponte sul burrone', goto: 'bridge' }],
    },
    crypt: {
      type: 'pool', art: 'crypt', title: 'La porta delle rune', who: party,
      text: 'Una porta di pietra si apre solo se tutti spingono insieme le rune giuste.',
      success: 'Le rune si illuminano e la porta si apre con un sospiro di polvere.',
      fail: 'La porta resiste e le rune esplodono in scintille: -2 cuori.',
      after: async (ctx, r) => { if (!r.success) await damage(ctx, 2); },
      next: 'nest',
    },
    bridge: {
      type: 'spotlight', art: 'bridge', title: 'Il ponte di corda',
      publicText: (ctx, p) => `Qualcuno deve attraversare per primo e fissare la corda. Tocca a ${p.name}.`,
      privateText: 'Il ponte oscilla nel vuoto. Come lo affronti?',
      options: [
        { label: '🏃 Corro più veloce che posso', effect: async (ctx) => { if (ctx.rng() < 0.5) await damage(ctx, 2); }, outcome: 'Una corsa folle: le assi saltano una dopo l’altra. Ce la fa… più o meno.' },
        { label: '🪢 Lego una corda di sicurezza', effect: async (ctx, p) => bump(ctx, p.pid, 'help'), outcome: 'Lento ma sicuro: la corda è fissata e tutti passano senza un graffio.', sfx: 'fanfare' },
        { label: '🙈 Torno indietro: andate voi', effect: async (ctx) => damage(ctx, 1), outcome: 'Un passo indietro… e un altro deve andare al suo posto. Il gruppo perde tempo e un cuore.' },
      ],
      next: 'nest',
    },
    nest: {
      type: 'vote', art: 'treasure', title: 'Un nido tiepido: dentro c’è un uovo di drago. Che fate?', butterfly: true,
      options: [
        { label: '🎒 Lo portiamo con noi', set: { egg: 'taken' } },
        { label: '🔨 Lo distruggiamo', set: { egg: 'smashed' } },
        { label: '🤫 Lo lasciamo dov’è', set: { egg: 'left' } },
      ],
      next: long ? 'goblin' : 'camp',
    },
    goblin: {
      type: 'write', art: 'goblin', title: 'Il mercante goblin',
      text: 'Un goblin con un cappello enorme blocca le scale: «Pedaggio! Dieci monete a testa!» Non avete un soldo. Scrivete la scusa più convincente (o assurda) per passare gratis.',
      placeholder: 'Siamo ispettori delle tasse goblin', next: 'fork2',
    },
    fork2: {
      type: 'vote', art: 'tower', title: 'La torre si divide di nuovo. Da che parte?',
      options: [{ label: '🌊 Il lago sotterraneo', goto: 'lake' }, { label: '🌲 Il bosco stregato', goto: 'forest' }],
    },
    lake: {
      type: 'pool', art: 'lake', title: 'Remare nel lago nero', who: party,
      text: 'Una barca bucata, qualcosa sotto la superficie. Tutti ai remi… o qualcuno farà finta?',
      success: 'La barca tocca la riva un attimo prima che i tentacoli la afferrino!',
      fail: 'Un tentacolo rovescia la barca: tutti a nuoto, -2 cuori.',
      after: async (ctx, r) => { if (!r.success) await damage(ctx, 2); },
      next: 'camp',
    },
    forest: {
      type: 'spotlight', art: 'forest', title: 'L’albero che parla',
      publicText: (ctx, p) => `Un albero antico apre gli occhi e sceglie ${p.name}: «Uno di voi mente. Vuoi sapere chi?»`,
      privateText: 'L’albero può rivelarti un segreto… ma vuole un prezzo.',
      options: [
        {
          label: '🌳 Sì: pago con un cuore della squadra',
          effect: async (ctx, p) => {
            await damage(ctx, 1);
            const dark = ctx.state.servant ?? (ctx.state.turned ?? [])[0];
            const others = ctx.active().filter((x) => x.pid !== p.pid);
            const hint = dark && dark !== p.pid ? `${ctx.player(dark).name} nasconde qualcosa.` : `${others[Math.floor(ctx.rng() * others.length)]?.name ?? 'Nessuno'} è leale.`;
            addCardLines(ctx, p.pid, [`🌳 L’albero ti ha sussurrato: «${hint}»`]);
          },
          outcome: (ctx, p) => `L’albero sussurra qualcosa all’orecchio di ${p.name}. Sarà vero? E ve lo dirà?`,
        },
        { label: '🙅 No, grazie', outcome: 'L’albero richiude gli occhi, offeso. Il bosco vi lascia passare… per stavolta.' },
      ],
      next: 'camp',
    },
    camp: {
      type: 'alliance', art: 'campfire',
      title: 'Attorno al fuoco: di chi vi fidate?',
      share: (ctx, other) => `la sua classe è ${ctx.state.classOf?.[other]?.name ?? '?'} e il suo obiettivo è «${ctx.state.objectives?.[other]?.text ?? '?'}»`,
      next: 'treasure',
    },
    treasure: {
      type: 'split', art: 'treasure', flag: 'treasure', title: 'Il forziere del re', who: party,
      text: 'avete trovato il forziere col tesoro rubato. Dentro c’è anche una spada incantata.',
      privateText: 'Dividi: il tesoro va alla compagnia e la spada al gruppo (+50% danni al drago). Ruba: ti tieni l’oro di nascosto.',
      after: (ctx, outcome) => { if (outcome === 'both-share') setFlags(ctx, { sword: true }); },
      outcomes: {
        'both-share': 'Il tesoro va alla compagnia e la spada incantata brilla nelle vostre mani: contro il drago farà la differenza.',
        'a-steals': (ctx, { thief }) => `${thief.name} riempie le tasche di monete. La spada? Rimasta sul fondo del forziere, sotto l’oro.`,
        'b-steals': (ctx, { thief }) => `${thief.name} riempie le tasche di monete. La spada? Rimasta sul fondo del forziere, sotto l’oro.`,
        'both-steal': 'Vi azzuffate per l’oro e il forziere rotola giù dalle scale. Addio tesoro, addio spada.',
      },
      next: 'pact',
    },
    pact: {
      type: 'tempt', art: 'dragon', title: 'Una voce dentro la testa',
      who: (ctx) => party(ctx).filter((p) => !isDark(ctx, p.pid)),
      publicText: 'Una voce profonda rimbomba nella testa di alcuni di voi…',
      offerTitle: 'La voce del drago',
      offerText: 'Aiutami a sopravvivere e metà del mio tesoro sarà tua. Nessuno lo saprà mai.',
      cap: long ? 2 : 1,
      onAccept: async (ctx, pid) => {
        ctx.setState({ objectives: { ...ctx.state.objectives, [pid]: DARK_OBJECTIVE } });
        addCardLines(ctx, pid, ['🐉 Hai accettato il patto del drago: non deve morire. In battaglia puoi aiutarlo di nascosto.', `🎯 Nuovo obiettivo: ${DARK_OBJECTIVE.text}`]);
        if (ctx.state.servant) addCardLines(ctx, ctx.state.servant, [`🐉 ${ctx.player(pid).name} ha accettato il patto: ora siete in due.`]);
      },
      next: long ? 'knight' : 'climb',
    },
    knight: {
      type: 'pool', art: 'knight', title: 'Il Cavaliere Maledetto', who: party,
      text: 'Un’armatura vuota si alza da sola. Per farla a pezzi dovete colpire tutti insieme.',
      success: 'L’armatura crolla in un mucchio di ferraglia. Avanti!',
      fail: 'La lama maledetta vi respinge: -2 cuori.',
      after: async (ctx, r) => { if (!r.success) await damage(ctx, 2); },
      next: 'leaveBehind',
    },
    leaveBehind: {
      type: 'exile', art: 'campfire', kicker: 'Sospetti', title: 'Lasciare qualcuno di guardia all’accampamento?',
      text: 'Qualcuno sabota le prove? Potete lasciarlo indietro: niente più prove con voi, ma voterà alla fine.',
      yes: '🏕️ Sì, lasciamo qualcuno', no: '🤝 No, restiamo uniti', pickTitle: 'Chi resta all’accampamento?',
      resultTitle: 'resta all’accampamento',
      resultText: 'Se era leale, la compagnia ha perso un eroe. Se no… avete appena salvato la pelle.',
      next: 'redemption',
    },
    redemption: {
      type: 'tempt', art: 'campfire', title: 'Una seconda possibilità',
      who: (ctx) => ctx.active().filter((p) => isDark(ctx, p.pid)),
      publicText: 'Il fuoco crepita. Chi ha un peso sulla coscienza potrebbe ricevere un messaggio…',
      offerTitle: 'La redenzione',
      offerText: 'Puoi abbandonare il drago: tornerai leale, con un nuovo obiettivo. Ma il drago lo saprà.',
      cap: 2,
      onAccept: async (ctx, pid) => {
        ctx.setState({
          servant: ctx.state.servant === pid ? null : ctx.state.servant,
          turned: (ctx.state.turned ?? []).filter((x) => x !== pid),
          objectives: { ...ctx.state.objectives, [pid]: OBJECTIVES[0] },
        });
        addCardLines(ctx, pid, ['🕊️ Hai rinnegato il drago: ora sei leale.', `🎯 Nuovo obiettivo: ${OBJECTIVES[0].text}`]);
      },
      next: 'likely2',
    },
    likely2: { type: 'likely', art: 'campfire', title: 'tradirebbe la compagnia per un sacchetto d’oro?', next: 'climb' },
    climb: {
      type: 'pool', art: 'climb', title: 'La scalata finale', who: party,
      text: 'Le scale sono crollate: bisogna arrampicarsi sulla parete esterna, legati tutti alla stessa corda.',
      success: 'Un ultimo slancio e siete in cima, tutti interi.',
      fail: 'Una pietra si stacca e travolge la cordata: -2 cuori.',
      after: async (ctx, r) => { if (!r.success) await damage(ctx, 2); },
      next: 'dragon',
    },
    dragon: {
      type: 'narr', art: 'dragon', kicker: 'La cima della torre', title: 'Il drago si sveglia', sfx: 'roar',
      text: (ctx) => {
        const egg = { taken: 'Annusa l’aria: sa che avete il suo uovo.', smashed: 'I suoi occhi sono rossi di rabbia: sa cosa avete fatto al nido.', left: 'Non sa niente del nido. Per ora.' }[ctx.state.flags?.egg] ?? '';
        return `Tra montagne d’oro, due occhi gialli si aprono. ${egg} ${ctx.state.flags?.sword ? 'La spada incantata vibra nelle vostre mani.' : ''}`.trim();
      },
      phone: 'Preparati alla battaglia 🐉', next: 'eggChoice',
    },
    eggChoice: { type: 'custom', run: eggChoice },
    battle: { type: 'custom', run: battle },
    unmask: { type: 'custom', run: unmask },
    dead: {
      type: 'narr', art: 'defeat', kicker: 'Sconfitta', title: 'I cuori sono finiti', sfx: 'sad',
      text: 'La compagnia crolla prima della cima. Ma resta un’ultima domanda: c’era un traditore?', next: 'unmask',
    },
    finale: { type: 'ending', endings: ENDINGS, roleOf, next: 'end' },
    end: { type: 'end', phoneTitle: 'Avventura conclusa!' },
  };
  return {
    start: 'intro',
    scenes,
    hideScores: true,
    sides: SIDES,
    initialState: () => ({ hp: MAX_HP, dragonHp: DRAGON_HP, flags: {}, stats: {}, rounds: BATTLE_ROUNDS[length] ?? BATTLE_ROUNDS[30] }),
    hud: (ctx) => {
      const { hp = 0, dragonHp } = ctx.state;
      return el('div', { class: 'hud-fantasy' },
        el('span', { class: 'hearts', title: `${hp} cuori` }, '❤️'.repeat(hp), el('span', { class: 'hearts--lost' }, '🖤'.repeat(Math.max(0, MAX_HP - hp)))),
        dragonHp < DRAGON_HP
          ? el('span', { class: 'boss-bar' }, '🐉', el('span', { class: 'boss-bar__track' }, el('span', { style: { width: `${(dragonHp / DRAGON_HP) * 100}%` } })))
          : null);
    },
    guard: (ctx, next) => (ctx.state.hp <= 0 && !['dead', 'unmask', 'finale', 'end', 'END'].includes(next) ? 'dead' : next),
  };
}

export default {
  id: 'fantasy',
  title: 'La Torre di Brinacorvo',
  blurb: 'Avventura con cuori in comune, forse un servo del drago tra voi, patti oscuri e 5 finali.',
  cover: 'tower',
  theme: 'fantasy',
  minPlayers: 3,
  build,
};
