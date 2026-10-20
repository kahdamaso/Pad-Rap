// Regras do jogo: funções puras sobre o estado, sem DOM.
// Funciona no navegador (window.RoutineRPG) e no Node (module.exports).
// O conteúdo (Mural de Missões, títulos, baús) vem de content.js.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./content.js') : root.RoutineRPGContent);
  if (isNode) module.exports = api;
  else root.RoutineRPG = api;
})(typeof self !== 'undefined' ? self : this, function (CONTENT) {
  'use strict';

  const VERSION = 4;
  const MAX_CATCHUP_DAYS = 7;
  const MAX_LOG = 150;
  const MAX_HISTORY_DAYS = 400;
  const REST_HEAL = 0.1;

  const ATTRIBUTES = {
    str: { name: 'Força', icon: '💪', hint: 'Exercício, esforço físico' },
    int: { name: 'Inteligência', icon: '📚', hint: 'Estudo, leitura, trabalho' },
    wis: { name: 'Sabedoria', icon: '🧘', hint: 'Meditação, organização, reflexão' },
    cha: { name: 'Carisma', icon: '🎭', hint: 'Amigos, família, criatividade' },
    vit: { name: 'Vitalidade', icon: '🍎', hint: 'Sono, alimentação, saúde' },
  };

  const CLASSES = {
    guerreiro: { name: 'Guerreiro', icon: '⚔️', attr: 'str' },
    mago: { name: 'Mago', icon: '🔮', attr: 'int' },
    monge: { name: 'Monge', icon: '☯️', attr: 'wis' },
    bardo: { name: 'Bardo', icon: '🎻', attr: 'cha' },
    druida: { name: 'Druida', icon: '🌿', attr: 'vit' },
  };

  const DIFFICULTY = {
    easy: { name: 'Fácil', xp: 10, gold: 5, damage: 3 },
    medium: { name: 'Média', xp: 25, gold: 10, damage: 5 },
    hard: { name: 'Difícil', xp: 50, gold: 20, damage: 8 },
    epic: { name: 'Épica', xp: 100, gold: 40, damage: 12 },
  };

  const CLASS_BONUS = 0.2;
  const STREAK_BONUS_PER_DAY = 0.1;
  const STREAK_BONUS_CAP = 10;

  // Regras contra "farmar" pontos, pensadas para não atrapalhar quem joga honestamente.
  const HABIT_XP_PER_DAY = 3; // só os 3 primeiros toques do dia num hábito bom rendem XP
  const SAME_DAY_TODO = 0.5; // tarefa criada e concluída no mesmo dia rende metade
  const DIFFICULTY_MIN_LEVEL = { easy: 1, medium: 1, hard: 3, epic: 8 }; // missões criadas pela pessoa
  const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'epic'];
  const OUTGROWN_LEVELS = 6; // missão do Mural muito abaixo do seu nível rende menos…
  const OUTGROWN_MULT = 0.6; // …para incentivar a próxima da escada
  const CHALLENGE_MULT = 2; // o desafio do dia vale o dobro
  const TRIAL_EVERY = 5; // a cada 5 níveis é preciso vencer uma Provação
  const TRIAL_GOLD = 100;
  const MAX_ITEMS = 3; // limite de Pergaminhos de Folga guardados

  // ---------- Dificuldades (características do avatar) ----------
  // Cada dificuldade real vira uma característica que evolui com as missões
  // ligadas a ela, até ser superada e virar uma virtude.

  const TRAITS = {
    procrastinacao: {
      name: 'Procrastinação', icon: '⏳', attr: 'wis', virtue: { name: 'Iniciativa', icon: '⚡' },
      desc: 'Deixar tudo para depois.',
      quests: [
        { title: 'Fazer primeiro a tarefa mais difícil do dia', type: 'daily', difficulty: 'medium' },
        { title: 'Ciclo de 25 minutos de foco', type: 'habit', polarity: 'good', difficulty: 'easy' },
        { title: 'Adiar algo importante', type: 'habit', polarity: 'bad', difficulty: 'medium' },
      ],
    },
    sedentarismo: {
      name: 'Sedentarismo', icon: '🛋️', attr: 'str', virtue: { name: 'Vigor', icon: '🏃' },
      desc: 'Passar o dia parado.',
      quests: [
        { title: 'Caminhar 20 minutos', type: 'daily', difficulty: 'medium' },
        { title: 'Treinar', type: 'daily', difficulty: 'hard', days: [1, 3, 5] },
        { title: 'Usar a escada em vez do elevador', type: 'habit', polarity: 'good', difficulty: 'easy' },
      ],
    },
    sono: {
      name: 'Sono desregulado', icon: '😴', attr: 'vit', virtue: { name: 'Descanso Pleno', icon: '🌙' },
      desc: 'Dormir tarde ou mal.',
      quests: [
        { title: 'Deitar antes das 23h', type: 'daily', difficulty: 'medium' },
        { title: 'Sem telas 30 minutos antes de dormir', type: 'daily', difficulty: 'medium' },
        { title: 'Ficar no celular na cama', type: 'habit', polarity: 'bad', difficulty: 'easy' },
      ],
    },
    alimentacao: {
      name: 'Alimentação ruim', icon: '🍔', attr: 'vit', virtue: { name: 'Nutrição', icon: '🥗' },
      desc: 'Comer mal ou pular refeições.',
      quests: [
        { title: 'Comer uma fruta', type: 'daily', difficulty: 'easy' },
        { title: 'Beber 2 litros de água', type: 'daily', difficulty: 'easy' },
        { title: 'Fast food ou besteira', type: 'habit', polarity: 'bad', difficulty: 'medium' },
      ],
    },
    ansiedade: {
      name: 'Ansiedade', icon: '🌪️', attr: 'wis', virtue: { name: 'Serenidade', icon: '🕊️' },
      desc: 'Mente acelerada e preocupação.',
      quests: [
        { title: 'Respirar fundo por 5 minutos', type: 'daily', difficulty: 'easy' },
        { title: 'Escrever o que estou sentindo', type: 'daily', difficulty: 'easy' },
        { title: 'Pausa consciente', type: 'habit', polarity: 'good', difficulty: 'easy' },
      ],
    },
    celular: {
      name: 'Vício no celular', icon: '📱', attr: 'wis', virtue: { name: 'Presença', icon: '🎯' },
      desc: 'Perder horas nas telas.',
      quests: [
        { title: 'Uma hora sem celular', type: 'daily', difficulty: 'medium' },
        { title: 'Rolar redes sociais sem parar', type: 'habit', polarity: 'bad', difficulty: 'medium' },
      ],
    },
    desorganizacao: {
      name: 'Desorganização', icon: '🌀', attr: 'wis', virtue: { name: 'Ordem', icon: '📐' },
      desc: 'Bagunça, atrasos e esquecimentos.',
      quests: [
        { title: 'Planejar o dia pela manhã', type: 'daily', difficulty: 'easy' },
        { title: 'Arrumar o quarto por 10 minutos', type: 'daily', difficulty: 'easy' },
      ],
    },
    estudos: {
      name: 'Falta de foco nos estudos', icon: '📉', attr: 'int', virtue: { name: 'Erudição', icon: '🎓' },
      desc: 'Dificuldade de estudar ou aprender.',
      quests: [
        { title: 'Estudar 30 minutos', type: 'daily', difficulty: 'medium' },
        { title: 'Ler 10 páginas', type: 'daily', difficulty: 'easy' },
      ],
    },
    timidez: {
      name: 'Timidez e isolamento', icon: '🐚', attr: 'cha', virtue: { name: 'Coragem Social', icon: '🤝' },
      desc: 'Evitar pessoas e conversas.',
      quests: [
        { title: 'Mandar mensagem para um amigo', type: 'daily', difficulty: 'easy' },
        { title: 'Puxar conversa com alguém', type: 'habit', polarity: 'good', difficulty: 'medium' },
      ],
    },
    financas: {
      name: 'Gastos descontrolados', icon: '💸', attr: 'int', virtue: { name: 'Prudência', icon: '💰' },
      desc: 'Dinheiro que some sem perceber.',
      quests: [
        { title: 'Anotar os gastos do dia', type: 'daily', difficulty: 'easy' },
        { title: 'Compra por impulso', type: 'habit', polarity: 'bad', difficulty: 'medium' },
      ],
    },
  };

  // XP de missões ligadas necessário para cada estágio; o último é a superação.
  const TRAIT_STAGES = [
    { min: 0, name: 'Fraqueza' },
    { min: 150, name: 'Enfrentando' },
    { min: 500, name: 'Dominando' },
    { min: 1200, name: 'Superada' },
  ];
  const MAX_ACTIVE_TRAITS = 3;
  const TRAIT_BONUS = 0.15; // XP extra em missões ligadas a uma dificuldade
  const VIRTUE_BONUS = 0.1; // XP extra no atributo de cada virtude conquistada
  const BAD_HABIT_SETBACK = 3; // um deslize ligado tira (dano × 3) de progresso

  // ---------- Equipamentos ----------
  // Cada espaço tem um tipo de bônus; os itens são liberados por nível.

  const SLOTS = {
    weapon: { name: 'Arma', effect: 'bossDmg', desc: (v) => `+${v}% de dano no chefe` },
    shield: { name: 'Escudo', effect: 'defense', desc: (v) => `−${v}% de dano recebido` },
    helmet: { name: 'Elmo', effect: 'xp', desc: (v) => `+${v}% de XP` },
    amulet: { name: 'Amuleto', effect: 'gold', desc: (v) => `+${v}% de ouro` },
    pet: { name: 'Companheiro', effect: 'rest', desc: (v) => `+${v}% de vida ao descansar` },
  };

  const TIERS = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'];

  const EQUIPMENT = [
    { id: 'graveto', slot: 'weapon', icon: '🪵', name: 'Graveto Robusto', level: 1, value: 0 },
    { id: 'adaga', slot: 'weapon', icon: '🗡️', name: 'Adaga de Bronze', level: 3, value: 10 },
    { id: 'arco', slot: 'weapon', icon: '🏹', name: 'Arco Élfico', level: 6, value: 20 },
    { id: 'espada', slot: 'weapon', icon: '⚔️', name: 'Espada Rúnica', level: 10, value: 30 },
    { id: 'tridente', slot: 'weapon', icon: '🔱', name: 'Tridente dos Mares', level: 15, value: 50 },

    { id: 'panela', slot: 'shield', icon: '🍳', name: 'Tampa de Panela', level: 2, value: 5 },
    { id: 'carvalho', slot: 'shield', icon: '🛡️', name: 'Escudo de Carvalho', level: 5, value: 10 },
    { id: 'aco', slot: 'shield', icon: '🔰', name: 'Escudo de Aço', level: 9, value: 15 },
    { id: 'casco', slot: 'shield', icon: '🐢', name: 'Casco Ancestral', level: 14, value: 25 },

    { id: 'bone', slot: 'helmet', icon: '🧢', name: 'Boné de Viagem', level: 1, value: 0 },
    { id: 'chapeu', slot: 'helmet', icon: '🎩', name: 'Chapéu de Aventureiro', level: 4, value: 5 },
    { id: 'elmo', slot: 'helmet', icon: '⛑️', name: 'Elmo de Ferro', level: 8, value: 10 },
    { id: 'coroa', slot: 'helmet', icon: '👑', name: 'Coroa do Reino', level: 12, value: 20 },

    { id: 'contas', slot: 'amulet', icon: '📿', name: 'Colar de Contas', level: 3, value: 5 },
    { id: 'anel', slot: 'amulet', icon: '💍', name: 'Anel de Prata', level: 7, value: 10 },
    { id: 'olho', slot: 'amulet', icon: '🧿', name: 'Olho Místico', level: 11, value: 15 },
    { id: 'joia', slot: 'amulet', icon: '💎', name: 'Joia do Dragão', level: 16, value: 25 },

    { id: 'rato', slot: 'pet', icon: '🐀', name: 'Ratinho Corajoso', level: 2, value: 5 },
    { id: 'gato', slot: 'pet', icon: '🐈', name: 'Gato Malhado', level: 5, value: 10 },
    { id: 'coruja', slot: 'pet', icon: '🦉', name: 'Coruja Sábia', level: 9, value: 15 },
    { id: 'lobo', slot: 'pet', icon: '🐺', name: 'Lobo Fiel', level: 13, value: 20 },
    { id: 'dragao', slot: 'pet', icon: '🐉', name: 'Dragãozinho', level: 20, value: 30 },
  ];

  // Raridade = posição do item dentro do seu espaço; o último é sempre lendário.
  EQUIPMENT.forEach((item) => {
    const same = EQUIPMENT.filter((i) => i.slot === item.slot);
    const pos = same.indexOf(item);
    item.tier = pos === same.length - 1 ? TIERS.length - 1 : Math.min(pos, TIERS.length - 2);
  });

  function findItem(id) {
    return EQUIPMENT.find((i) => i.id === id) || null;
  }

  function isUnlocked(state, item) {
    return heroLevel(state) >= item.level;
  }

  function bestUnlocked(state, slot) {
    const items = EQUIPMENT.filter((i) => i.slot === slot && isUnlocked(state, i));
    return items.length ? items[items.length - 1] : null;
  }

  function equippedItem(state, slot) {
    const item = findItem(state.hero.equipment[slot]);
    return item && item.slot === slot && isUnlocked(state, item) ? item : null;
  }

  function bonuses(state) {
    const b = { bossDmg: 0, defense: 0, xp: 0, gold: 0, rest: 0 };
    Object.keys(SLOTS).forEach((slot) => {
      const item = equippedItem(state, slot);
      if (item) b[SLOTS[slot].effect] += item.value / 100;
    });
    return b;
  }

  function equip(state, itemId) {
    const item = findItem(itemId);
    if (!item || !isUnlocked(state, item)) return false;
    state.hero.equipment[item.slot] = item.id;
    return true;
  }

  // Equipa automaticamente o que acabou de ser liberado (é sempre melhor).
  function equipNewUnlocks(state, fromLevel, toLevel) {
    const items = EQUIPMENT.filter((i) => i.level > fromLevel && i.level <= toLevel);
    items.forEach((i) => (state.hero.equipment[i.slot] = i.id));
    return items;
  }

  // ---------- Chefes semanais ----------

  const BOSSES = [
    { icon: '👺', name: 'Goblin da Procrastinação' },
    { icon: '🐙', name: 'Kraken das Notificações' },
    { icon: '🧌', name: 'Troll da Bagunça' },
    { icon: '🧛', name: 'Vampiro da Madrugada' },
    { icon: '🗿', name: 'Golem do Sedentarismo' },
    { icon: '🐍', name: 'Hidra das Distrações' },
    { icon: '🧟', name: 'Zumbi do Cansaço' },
    { icon: '🐂', name: 'Minotauro do Estresse' },
    { icon: '👻', name: 'Espectro da Desculpa' },
    { icon: '🐲', name: 'Dragão da Preguiça' },
  ];

  const BOSS_MIN_HP = 100;
  const BOSS_HP_SHARE = 0.8; // fração do XP-base da semana necessária para vencer
  const BOSS_ESCAPE_DAMAGE = 15;

  // ---------- Datas (chaves locais AAAA-MM-DD) ----------

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function todayKey(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return todayKey(d);
  }

  function dayOfWeek(key) {
    return parseKey(key).getDay();
  }

  // Semanas começam na segunda-feira.
  function weekStart(key) {
    return addDays(key, -((dayOfWeek(key) + 6) % 7));
  }

  // ---------- Níveis ----------

  // XP total para chegar ao nível n: 0, 100, 300, 600, 1000...
  function xpForLevel(n, base) {
    const b = base || 50;
    return b * (n - 1) * n;
  }

  function levelFromXp(xp, base) {
    let n = 1;
    while (xpForLevel(n + 1, base) <= xp) n++;
    return n;
  }

  function levelProgress(xp, base) {
    const level = levelFromXp(xp, base);
    const start = xpForLevel(level, base);
    const end = xpForLevel(level + 1, base);
    return { level, current: xp - start, needed: end - start };
  }

  const ATTR_BASE = 25;

  function maxHp(level) {
    return 50 + (level - 1) * 5;
  }

  // Até vencer a Provação o nível fica travado; o XP continua acumulando e
  // conta inteiro quando ela for vencida.
  function levelCap(state) {
    const passed = state.hero.trialsPassed;
    return passed == null ? Infinity : TRIAL_EVERY * (passed + 1) - 1;
  }

  function heroLevel(state) {
    return Math.min(levelFromXp(state.hero.xp), levelCap(state));
  }

  function heroProgress(state) {
    const level = heroLevel(state);
    if (levelFromXp(state.hero.xp) > level) {
      const needed = xpForLevel(level + 1) - xpForLevel(level);
      return { level, current: needed, needed, capped: true };
    }
    return { ...levelProgress(state.hero.xp), capped: false };
  }

  function heroTitle(state) {
    const passed = state.hero.trialsPassed || 0;
    return CONTENT.TITLES[Math.min(passed, CONTENT.TITLES.length - 1)];
  }

  // ---------- Estado ----------

  let idCounter = 0;
  function uid() {
    idCounter = (idCounter + 1) % 1e6;
    return Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function defaultEquipment() {
    const eq = {};
    Object.keys(SLOTS).forEach((slot) => {
      const first = EQUIPMENT.find((i) => i.slot === slot && i.level <= 1);
      eq[slot] = first ? first.id : null;
    });
    return eq;
  }

  function folgaReward() {
    return { id: uid(), title: 'Pergaminho de Folga', cost: 60, item: 'folga', builtin: true };
  }

  function createState(name, cls, today) {
    const key = today || todayKey();
    const attrs = {};
    Object.keys(ATTRIBUTES).forEach((a) => (attrs[a] = 0));
    const state = {
      version: VERSION,
      hero: {
        name: name || 'Aventureiro',
        cls: CLASSES[cls] ? cls : 'guerreiro',
        xp: 0,
        hp: maxHp(1),
        gold: 0,
        attrs,
        equipment: defaultEquipment(),
        look: null,
        traits: [],
        trialsPassed: 0,
        trial: null,
        items: { folga: 0 },
      },
      quests: [],
      rewards: [
        { id: uid(), title: 'Poção de Vida', cost: 25, heal: 20, builtin: true },
        folgaReward(),
        { id: uid(), title: 'Um episódio de série', cost: 50 },
        { id: uid(), title: 'Sobremesa favorita', cost: 80 },
      ],
      boss: null,
      challenge: null,
      visits: { last: null, streak: 0, best: 0, chestOpened: null },
      board: { seenLevel: 1 },
      restDays: [],
      history: {},
      achievements: {},
      log: [],
      stats: { completed: 0, goldEarned: 0, rewardsBought: 0, defeats: 0, bestStreak: 0, bossesDefeated: 0, bossesSeen: 0, challenges: 0, chests: 0, trials: 0 },
      lastProcessed: key,
      createdAt: key,
    };
    addLog(state, '🌅', `${state.hero.name}, o ${CLASSES[state.hero.cls].name}, inicia sua jornada!`);
    return state;
  }

  // Atualiza progresso salvo em versões anteriores sem perder nada.
  function migrate(state) {
    if (!state || typeof state !== 'object') return state;
    if (state.version === 1) {
      state.hero.equipment = defaultEquipment();
      equipNewUnlocks(state, 1, heroLevel(state));
      state.boss = null;
      state.history = {};
      state.stats.bossesDefeated = 0;
      state.stats.bossesSeen = 0;
      state.version = 2;
    }
    if (state.version === 2) {
      state.hero.look = null;
      state.hero.traits = [];
      state.version = 3;
    }
    if (state.version === 3) {
      // Quem já passou dos níveis de Provação não perde nada: elas contam como vencidas.
      state.hero.trialsPassed = Math.floor(levelFromXp(state.hero.xp) / TRIAL_EVERY);
      state.hero.trial = null;
      state.hero.items = { folga: 0 };
      state.challenge = null;
      state.visits = { last: null, streak: 0, best: 0, chestOpened: null };
      state.board = { seenLevel: heroLevel(state) };
      state.restDays = [];
      Object.assign(state.stats, { challenges: 0, chests: 0, trials: 0 });
      if (!state.rewards.some((r) => r.item === 'folga')) state.rewards.splice(1, 0, folgaReward());
      state.version = 4;
    }
    return state;
  }

  function addLog(state, icon, text, ts) {
    state.log.unshift({ ts: ts || Date.now(), icon, text });
    if (state.log.length > MAX_LOG) state.log.length = MAX_LOG;
  }

  function findQuest(state, id) {
    return state.quests.find((q) => q.id === id);
  }

  function addQuest(state, data, today) {
    const key = today || todayKey();
    const quest = {
      id: uid(),
      title: String(data.title || '').trim() || 'Missão sem nome',
      type: ['daily', 'habit', 'todo'].includes(data.type) ? data.type : 'daily',
      attr: ATTRIBUTES[data.attr] ? data.attr : 'str',
      difficulty: DIFFICULTY[data.difficulty] ? data.difficulty : 'medium',
      createdAt: key,
    };
    const entry = catalogEntry(data.catalog);
    if (entry) {
      quest.catalog = entry.id;
      quest.level = entry.level;
    } else if (!data.official) {
      quest.difficulty = allowedDifficulty(state, quest.difficulty);
    }
    const trait = activeTrait(state, data.trait);
    if (trait) {
      quest.trait = trait.id;
      if (!ATTRIBUTES[data.attr]) quest.attr = TRAITS[trait.id].attr;
    }
    if (quest.type === 'daily') {
      const days = Array.isArray(data.days) ? data.days.filter((d) => d >= 0 && d <= 6) : [];
      quest.days = days.length ? [...new Set(days)].sort() : [0, 1, 2, 3, 4, 5, 6];
      quest.streak = 0;
      quest.bestStreak = 0;
      quest.completions = [];
    } else if (quest.type === 'habit') {
      quest.polarity = data.polarity === 'bad' ? 'bad' : 'good';
      quest.count = 0;
      quest.countDate = key;
    } else {
      quest.done = false;
    }
    state.quests.push(quest);
    return quest;
  }

  // Missões criadas pela pessoa não podem ser mais difíceis do que o nível permite.
  function allowedDifficulty(state, difficulty) {
    const level = heroLevel(state);
    let i = DIFFICULTY_ORDER.indexOf(difficulty);
    while (i > 0 && level < DIFFICULTY_MIN_LEVEL[DIFFICULTY_ORDER[i]]) i--;
    return DIFFICULTY_ORDER[Math.max(0, i)];
  }

  // ---------- Mural de Missões ----------

  function catalogEntry(id) {
    return (id && CONTENT.CATALOG.find((c) => c.id === id)) || null;
  }

  function hasCatalogQuest(state, id) {
    return state.quests.some((q) => q.catalog === id);
  }

  function boardQuests(state) {
    const level = heroLevel(state);
    const seen = state.board.seenLevel || 1;
    return CONTENT.CATALOG.map((c) => ({
      ...c,
      unlocked: level >= c.level,
      accepted: hasCatalogQuest(state, c.id),
      isNew: level >= c.level && c.level > seen,
    }));
  }

  function newBoardCount(state) {
    return boardQuests(state).filter((c) => c.isNew && !c.accepted).length;
  }

  function markBoardSeen(state) {
    state.board.seenLevel = heroLevel(state);
  }

  function acceptCatalogQuest(state, id, today) {
    const entry = catalogEntry(id);
    if (!entry || heroLevel(state) < entry.level || hasCatalogQuest(state, id)) return null;
    return addQuest(state, { ...entry, catalog: id }, today);
  }

  function removeQuest(state, id) {
    state.quests = state.quests.filter((q) => q.id !== id);
  }

  function isScheduled(quest, key) {
    return quest.type === 'daily' && quest.days.includes(dayOfWeek(key));
  }

  function isDoneOn(quest, key) {
    if (quest.type === 'daily') return quest.completions.includes(key);
    if (quest.type === 'todo') return quest.done;
    return false;
  }

  function habitCount(quest, key) {
    return quest.countDate === key ? quest.count : 0;
  }

  // ---------- Características ----------

  function traitStage(trait) {
    let stage = 0;
    TRAIT_STAGES.forEach((s, i) => {
      if (trait.progress >= s.min) stage = i;
    });
    return trait.overcome ? TRAIT_STAGES.length - 1 : stage;
  }

  function traitProgress(trait) {
    const stage = traitStage(trait);
    const next = TRAIT_STAGES[stage + 1];
    if (!next) return { stage, current: 1, needed: 1 };
    const start = TRAIT_STAGES[stage].min;
    return { stage, current: trait.progress - start, needed: next.min - start };
  }

  function findTrait(state, id) {
    return state.hero.traits.find((t) => t.id === id) || null;
  }

  function activeTrait(state, id) {
    const t = findTrait(state, id);
    return t && !t.overcome ? t : null;
  }

  function activeTraits(state) {
    return state.hero.traits.filter((t) => !t.overcome);
  }

  function addTrait(state, id, today) {
    if (!TRAITS[id] || findTrait(state, id) || activeTraits(state).length >= MAX_ACTIVE_TRAITS) return null;
    const trait = { id, progress: 0, since: today || todayKey(), overcome: null };
    state.hero.traits.push(trait);
    addLog(state, TRAITS[id].icon, `Novo desafio: enfrentar ${TRAITS[id].name}.`);
    return trait;
  }

  // Desiste de uma dificuldade ativa; virtudes conquistadas ficam para sempre.
  function removeTrait(state, id) {
    if (!activeTrait(state, id)) return false;
    state.hero.traits = state.hero.traits.filter((t) => t.id !== id);
    state.quests.forEach((q) => {
      if (q.trait === id) delete q.trait;
    });
    return true;
  }

  // Cria as missões sugeridas que ainda não existem (compara pelo título).
  function addSuggestedQuests(state, id, today) {
    const def = TRAITS[id];
    if (!def || !activeTrait(state, id)) return [];
    const titles = new Set(state.quests.map((q) => q.title.toLowerCase()));
    return def.quests
      .filter((q) => !titles.has(q.title.toLowerCase()))
      .map((q) => addQuest(state, { ...q, attr: def.attr, trait: id, official: true }, today));
  }

  function virtueBonus(state, attr) {
    return state.hero.traits.filter((t) => t.overcome && TRAITS[t.id].attr === attr).length * VIRTUE_BONUS;
  }

  function advanceTrait(state, quest, xp, key) {
    const trait = activeTrait(state, quest.trait);
    if (!trait) return null;
    const before = traitStage(trait);
    trait.progress += xp;
    const stage = traitStage(trait);
    if (stage === before) return { id: trait.id, gained: xp };
    const def = TRAITS[trait.id];
    if (stage === TRAIT_STAGES.length - 1) {
      trait.overcome = key;
      addLog(state, def.virtue.icon, `Superou ${def.name}! Ganhou a virtude ${def.virtue.name}.`);
    } else {
      addLog(state, def.icon, `${def.name}: agora você está ${TRAIT_STAGES[stage].name.toLowerCase()}.`);
    }
    return { id: trait.id, gained: xp, stage, overcome: !!trait.overcome };
  }

  // ---------- Histórico (para os gráficos) ----------

  function historyDay(state, key) {
    if (!state.history[key]) state.history[key] = { done: 0 };
    return state.history[key];
  }

  function recordDay(state, key) {
    const day = historyDay(state, key || todayKey());
    day.xp = state.hero.xp;
    day.gold = state.hero.gold;
    const keys = Object.keys(state.history);
    if (keys.length > MAX_HISTORY_DAYS) {
      keys.sort().slice(0, keys.length - MAX_HISTORY_DAYS).forEach((k) => delete state.history[k]);
    }
  }

  function dailyTotals(state, key) {
    let due = 0;
    let done = 0;
    state.quests.forEach((q) => {
      if (q.type !== 'daily' || q.createdAt > key || !isScheduled(q, key)) return;
      due++;
      if (isDoneOn(q, key)) done++;
    });
    return { due, done };
  }

  // ---------- Recompensas e dano ----------

  function computeReward(state, quest, today) {
    const key = today || todayKey();
    const diff = DIFFICULTY[quest.difficulty];
    if (quest.type === 'habit' && habitCount(quest, key) >= HABIT_XP_PER_DAY) return { xp: 0, gold: 0, reduced: 'capped' };
    let mult = 1;
    let reduced = null;
    if (quest.catalog && heroLevel(state) >= quest.level + OUTGROWN_LEVELS) {
      mult = OUTGROWN_MULT;
      reduced = 'outgrown';
    }
    if (quest.type === 'todo' && quest.createdAt === key) {
      mult *= SAME_DAY_TODO;
      reduced = 'sameDay';
    }
    const b = bonuses(state);
    const streak = quest.type === 'daily' ? Math.min(quest.streak, STREAK_BONUS_CAP) : 0;
    const streakMult = 1 + streak * STREAK_BONUS_PER_DAY;
    const classMult = CLASSES[state.hero.cls].attr === quest.attr ? 1 + CLASS_BONUS : 1;
    const traitMult = 1 + (activeTrait(state, quest.trait) ? TRAIT_BONUS : 0) + virtueBonus(state, quest.attr);
    return {
      xp: Math.round(diff.xp * streakMult * classMult * traitMult * (1 + b.xp) * mult),
      gold: Math.round(diff.gold * streakMult * (1 + b.gold) * mult),
      reduced,
    };
  }

  function grant(state, attr, xp, gold) {
    const hero = state.hero;
    const beforeLevel = heroLevel(state);
    const beforeAttr = attr ? levelFromXp(hero.attrs[attr], ATTR_BASE) : 0;
    hero.xp += xp;
    if (attr) hero.attrs[attr] += xp;
    hero.gold += gold;
    state.stats.goldEarned += gold;
    const level = heroLevel(state);
    const events = { xp, gold, levelUp: null, attrUp: null, newItems: [] };
    if (level > beforeLevel) {
      hero.hp = maxHp(level);
      events.levelUp = level;
      addLog(state, '⭐', `Subiu para o nível ${level}! Vida restaurada.`);
      events.newItems = equipNewUnlocks(state, beforeLevel, level);
      events.newItems.forEach((i) => addLog(state, i.icon, `Novo equipamento: ${i.name}!`));
    }
    if (!hero.trial && levelFromXp(hero.xp) > levelCap(state)) events.trialStarted = startTrial(state);
    if (attr) {
      const attrLevel = levelFromXp(hero.attrs[attr], ATTR_BASE);
      if (attrLevel > beforeAttr) {
        events.attrUp = { attr, level: attrLevel };
        addLog(state, ATTRIBUTES[attr].icon, `${ATTRIBUTES[attr].name} chegou ao nível ${attrLevel}.`);
      }
    }
    return events;
  }

  function revoke(state, attr, xp, gold) {
    const hero = state.hero;
    hero.xp = Math.max(0, hero.xp - xp);
    hero.attrs[attr] = Math.max(0, hero.attrs[attr] - xp);
    hero.gold = Math.max(0, hero.gold - gold);
    state.stats.goldEarned = Math.max(0, state.stats.goldEarned - gold);
    hero.hp = Math.min(hero.hp, maxHp(heroLevel(state)));
  }

  // Aplica dano (reduzido pelo escudo); ao chegar a 0 de vida o herói é derrotado:
  // perde o progresso do nível atual e metade do ouro, e volta com vida cheia.
  function damage(state, amount, reason) {
    const hero = state.hero;
    const taken = Math.max(1, Math.round(amount * (1 - bonuses(state).defense)));
    hero.hp -= taken;
    if (hero.hp > 0) return { damage: taken, defeated: false };
    const level = heroLevel(state);
    const lostGold = Math.floor(hero.gold / 2);
    hero.xp = xpForLevel(level);
    hero.gold -= lostGold;
    hero.hp = maxHp(level);
    state.stats.defeats++;
    addLog(state, '💀', `Derrotado${reason ? ` por ${reason}` : ''}! Perdeu o progresso do nível e ${lostGold} de ouro.`);
    return { damage: taken, defeated: true, lostGold };
  }

  function heal(state, amount) {
    const hero = state.hero;
    const max = maxHp(heroLevel(state));
    const before = hero.hp;
    hero.hp = Math.min(max, hero.hp + amount);
    return hero.hp - before;
  }

  // ---------- Provação ----------
  // Para passar do nível 4, 9, 14… é preciso ter alguns "dias perfeitos":
  // todas as diárias do dia cumpridas (ou 3 missões, para quem não tem diárias).

  function startTrial(state, today) {
    const hero = state.hero;
    hero.trial = {
      level: levelCap(state) + 1,
      need: Math.min(3 + hero.trialsPassed, 7),
      since: today || state.lastProcessed || todayKey(),
      days: [],
    };
    addLog(state, '🏛️', `Provação do nível ${hero.trial.level}: tenha ${hero.trial.need} dias perfeitos para subir.`);
    return hero.trial;
  }

  function perfectDay(state, key) {
    if (state.restDays.includes(key)) return false;
    const t = dailyTotals(state, key);
    if (t.due > 0) return t.done === t.due;
    return ((state.history[key] && state.history[key].done) || 0) >= 3;
  }

  function updateTrial(state, key) {
    const trial = state.hero.trial;
    if (!trial || key < trial.since) return null;
    const perfect = perfectDay(state, key);
    const idx = trial.days.indexOf(key);
    if (perfect && idx < 0) trial.days.push(key);
    if (!perfect && idx >= 0) trial.days.splice(idx, 1);
    if (trial.days.length >= trial.need) return passTrial(state, key);
    return { progress: trial.days.length, need: trial.need, gained: perfect && idx < 0 };
  }

  function passTrial(state, key) {
    const hero = state.hero;
    const before = heroLevel(state);
    hero.trialsPassed++;
    hero.trial = null;
    hero.gold += TRIAL_GOLD;
    state.stats.goldEarned += TRIAL_GOLD;
    state.stats.trials++;
    const level = heroLevel(state);
    hero.hp = maxHp(level);
    const newItems = equipNewUnlocks(state, before, level);
    addLog(state, '🏛️', `Provação vencida! Agora você é ${heroTitle(state)}, nível ${level}. +${TRIAL_GOLD} ouro.`);
    newItems.forEach((i) => addLog(state, i.icon, `Novo equipamento: ${i.name}!`));
    if (levelFromXp(hero.xp) > levelCap(state)) startTrial(state, addDays(key, 1));
    return { passed: true, level, levelUp: level > before ? level : null, title: heroTitle(state), gold: TRIAL_GOLD, newItems };
  }

  // ---------- Desafio do dia ----------

  // Sorteio reproduzível: o mesmo dia sorteia o mesmo desafio para o mesmo herói.
  function seededRandom(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return function () {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickChallenge(state, key, salt, exclude) {
    const level = heroLevel(state);
    const titles = new Set(state.quests.map((q) => q.title.toLowerCase()));
    const unlocked = CONTENT.CATALOG.filter((c) => c.level <= level && c.type !== 'habit' && c.id !== exclude);
    let pool = unlocked.filter((c) => !hasCatalogQuest(state, c.id) && !titles.has(c.title.toLowerCase()));
    if (!pool.length) pool = unlocked;
    const rng = seededRandom(`${key}|${state.hero.name}|${salt || ''}`);
    // Metade das vezes, prefere algo ligado aos desafios da pessoa.
    const active = activeTraits(state).map((t) => t.id);
    const linked = pool.filter((c) => active.includes(c.trait));
    if (linked.length && rng() < 0.5) pool = linked;
    return pool[Math.floor(rng() * pool.length)].id;
  }

  function ensureChallenge(state, key) {
    if (state.challenge && state.challenge.key === key) return state.challenge;
    state.challenge = { key, id: pickChallenge(state, key), done: false, rerolled: false };
    return state.challenge;
  }

  function rerollChallenge(state, key) {
    const c = state.challenge;
    if (!c || c.key !== key || c.done || c.rerolled) return false;
    c.id = pickChallenge(state, key, 'troca', c.id);
    c.rerolled = true;
    return true;
  }

  function challengeReward(state) {
    const entry = catalogEntry(state.challenge && state.challenge.id);
    if (!entry) return null;
    const diff = DIFFICULTY[entry.difficulty];
    const b = bonuses(state);
    const classMult = CLASSES[state.hero.cls].attr === entry.attr ? 1 + CLASS_BONUS : 1;
    return {
      xp: Math.round(diff.xp * CHALLENGE_MULT * classMult * (1 + b.xp)),
      gold: Math.round(diff.gold * CHALLENGE_MULT * (1 + b.gold)),
    };
  }

  function completeChallenge(state, today) {
    const key = today || todayKey();
    const c = state.challenge;
    if (!c || c.key !== key || c.done) return null;
    const entry = catalogEntry(c.id);
    const reward = challengeReward(state);
    c.done = true;
    const events = grant(state, entry.attr, reward.xp, reward.gold);
    state.stats.completed++;
    state.stats.challenges++;
    historyDay(state, key).done++;
    addLog(state, '🎲', `Desafio do dia "${entry.title}" concluído: +${reward.xp} XP, +${reward.gold} ouro.`);
    events.trait = advanceTrait(state, { trait: entry.trait }, reward.xp, key);
    events.trial = updateTrial(state, key);
    return rewardResult(state, events, hitBoss(state, reward.xp));
  }

  // ---------- Baú diário ----------

  function chestTier(streak) {
    let tier = 0;
    CONTENT.CHESTS.forEach((c, i) => {
      if (streak >= c.minStreak) tier = i;
    });
    return tier;
  }

  function registerVisit(state, key) {
    const v = state.visits;
    if (v.last === key) return;
    v.streak = v.last === addDays(key, -1) ? v.streak + 1 : 1;
    v.best = Math.max(v.best || 0, v.streak);
    v.last = key;
  }

  function chestAvailable(state, key) {
    return state.visits.chestOpened !== (key || todayKey());
  }

  // Recompensa por voltar: sempre ouro, às vezes XP, cura ou um Pergaminho de Folga.
  // Quanto mais dias seguidos você abre o app, melhor o baú.
  function openChest(state, today) {
    const key = today || todayKey();
    if (!chestAvailable(state, key)) return null;
    registerVisit(state, key);
    state.visits.chestOpened = key;
    const tier = chestTier(state.visits.streak);
    const rng = seededRandom(`${key}|${state.hero.name}|bau`);
    const loot = { tier, chest: CONTENT.CHESTS[tier], gold: [12, 25, 40][tier] + Math.floor(rng() * [8, 15, 25][tier]), xp: 0, healed: 0, folga: 0 };
    if (rng() < [0.3, 0.5, 0.8][tier]) loot.xp = [10, 20, 35][tier];
    if (rng() < [0.06, 0.12, 0.25][tier] && state.hero.items.folga < MAX_ITEMS) {
      loot.folga = 1;
      state.hero.items.folga++;
    }
    loot.healed = heal(state, [5, 10, 20][tier]);
    loot.events = grant(state, null, loot.xp, loot.gold);
    state.stats.chests++;
    addLog(state, loot.chest.icon, `Abriu o ${loot.chest.name}: +${loot.gold} ouro${loot.xp ? `, +${loot.xp} XP` : ''}${loot.folga ? ', um Pergaminho de Folga' : ''}.`);
    loot.achievements = checkAchievements(state);
    return loot;
  }

  // ---------- Chefe ----------

  function bossHpFor(state, today) {
    const start = weekStart(today);
    let expected = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      if (day < today) continue;
      state.quests.forEach((q) => {
        if (q.type === 'daily' && isScheduled(q, day)) expected += DIFFICULTY[q.difficulty].xp;
      });
    }
    return Math.max(BOSS_MIN_HP, Math.round((expected * BOSS_HP_SHARE) / 10) * 10);
  }

  function bossReward(state) {
    const level = heroLevel(state);
    return { xp: 40 + level * 10, gold: 25 + level * 5 };
  }

  // Garante que existe um chefe para a semana atual; o da semana passada,
  // se não foi derrotado, foge e dá um último golpe.
  function ensureBoss(state, today) {
    const key = today || todayKey();
    const week = weekStart(key);
    const result = { escaped: null, spawned: null };
    const old = state.boss;
    if (old && old.week === week) return result;
    if (old && !old.defeated) {
      const dmg = Math.ceil((BOSS_ESCAPE_DAMAGE * old.hp) / old.maxHp);
      const hit = damage(state, dmg, old.name);
      result.escaped = { name: old.name, icon: old.icon, damage: hit.damage, defeated: hit.defeated };
      addLog(state, old.icon, `${old.name} escapou e acertou um último golpe (−${hit.damage} vida).`);
    }
    const base = BOSSES[state.stats.bossesSeen % BOSSES.length];
    const hp = bossHpFor(state, key);
    state.stats.bossesSeen++;
    state.boss = { week, icon: base.icon, name: base.name, maxHp: hp, hp, defeated: false };
    result.spawned = state.boss;
    addLog(state, base.icon, `${base.name} apareceu! Cumpra suas missões da semana para derrotá-lo.`);
    return result;
  }

  function hitBoss(state, xp) {
    const boss = state.boss;
    if (!boss || boss.defeated) return null;
    const dmg = Math.max(1, Math.round(xp * (1 + bonuses(state).bossDmg)));
    boss.hp = Math.max(0, boss.hp - dmg);
    const hit = { damage: dmg, week: boss.week, defeated: false };
    if (boss.hp === 0) {
      boss.defeated = true;
      state.stats.bossesDefeated++;
      const reward = bossReward(state);
      addLog(state, '🏅', `${boss.name} foi derrotado! +${reward.xp} XP, +${reward.gold} ouro.`);
      hit.defeated = true;
      hit.reward = reward;
      hit.events = grant(state, null, reward.xp, reward.gold);
    }
    return hit;
  }

  function healBoss(state, amount) {
    const boss = state.boss;
    if (!boss || boss.defeated) return 0;
    const before = boss.hp;
    boss.hp = Math.min(boss.maxHp, boss.hp + amount);
    return boss.hp - before;
  }

  // ---------- Ações ----------

  function rewardResult(state, events, boss) {
    const result = { type: 'reward', ...events, boss };
    if (boss && boss.events) {
      // Subidas de nível causadas pelo prêmio do chefe também contam.
      result.levelUp = boss.events.levelUp || result.levelUp;
      result.newItems = (result.newItems || []).concat(boss.events.newItems);
    }
    if (events.trial && events.trial.passed) {
      result.levelUp = events.trial.levelUp || result.levelUp;
      result.newItems = (result.newItems || []).concat(events.trial.newItems);
    }
    result.achievements = checkAchievements(state);
    return result;
  }

  function completeQuest(state, id, today) {
    const key = today || todayKey();
    const quest = findQuest(state, id);
    if (!quest) return null;

    if (quest.type === 'habit') {
      if (quest.countDate !== key) {
        quest.count = 0;
        quest.countDate = key;
      }
      const habitReward = quest.polarity === 'good' ? computeReward(state, quest, key) : null;
      quest.count++;
      if (habitReward && habitReward.reduced === 'capped') {
        return { type: 'capped', count: quest.count };
      }
      if (quest.polarity === 'bad') {
        const dmg = DIFFICULTY[quest.difficulty].damage;
        const result = damage(state, dmg, quest.title);
        const bossHealed = healBoss(state, dmg * 2);
        const trait = activeTrait(state, quest.trait);
        if (trait) trait.progress = Math.max(0, trait.progress - dmg * BAD_HABIT_SETBACK);
        if (!result.defeated) addLog(state, '🩸', `Cedeu a "${quest.title}" e perdeu ${result.damage} de vida.`);
        return { type: 'damage', ...result, bossHealed, traitSetback: trait ? dmg * BAD_HABIT_SETBACK : 0, achievements: checkAchievements(state) };
      }
      const reward = habitReward;
      const events = grant(state, quest.attr, reward.xp, reward.gold);
      state.stats.completed++;
      historyDay(state, key).done++;
      addLog(state, '✨', `"${quest.title}": +${reward.xp} XP, +${reward.gold} ouro.`);
      events.trait = advanceTrait(state, quest, reward.xp, key);
      events.trial = updateTrial(state, key);
      return rewardResult(state, events, hitBoss(state, reward.xp));
    }

    if (isDoneOn(quest, key)) return null;
    if (quest.type === 'daily') {
      quest.streak++;
      quest.bestStreak = Math.max(quest.bestStreak, quest.streak);
      state.stats.bestStreak = Math.max(state.stats.bestStreak, quest.streak);
      quest.completions.push(key);
      if (quest.completions.length > 60) quest.completions.shift();
    } else {
      quest.done = true;
      quest.doneAt = key;
    }
    const reward = computeReward(state, quest, key);
    const events = grant(state, quest.attr, reward.xp, reward.gold);
    events.reduced = reward.reduced;
    state.stats.completed++;
    historyDay(state, key).done++;
    const streakText = quest.type === 'daily' && quest.streak > 1 ? ` (sequência de ${quest.streak})` : '';
    addLog(state, '✅', `Missão "${quest.title}" concluída${streakText}: +${reward.xp} XP, +${reward.gold} ouro.`);
    events.trait = advanceTrait(state, quest, reward.xp, key);
    events.trial = updateTrial(state, key);
    const boss = hitBoss(state, reward.xp);
    quest.lastGrant = {
      key,
      xp: reward.xp,
      gold: reward.gold,
      boss: boss && !boss.defeated ? { week: boss.week, damage: boss.damage } : null,
      trait: events.trait && !events.trait.overcome ? events.trait.gained : 0,
    };
    return rewardResult(state, events, boss);
  }

  function undoQuest(state, id, today) {
    const key = today || todayKey();
    const quest = findQuest(state, id);
    if (!quest || quest.type === 'habit' || !isDoneOn(quest, key)) return false;
    const g = quest.lastGrant;
    if (quest.type === 'daily') {
      if (!g || g.key !== key) return false;
      quest.completions = quest.completions.filter((c) => c !== key);
      quest.streak = Math.max(0, quest.streak - 1);
    } else {
      quest.done = false;
      delete quest.doneAt;
    }
    if (g) {
      revoke(state, quest.attr, g.xp, g.gold);
      if (g.boss && state.boss && state.boss.week === g.boss.week) healBoss(state, g.boss.damage);
      const trait = activeTrait(state, quest.trait);
      if (trait && g.trait) trait.progress = Math.max(0, trait.progress - g.trait);
      if (state.history[g.key]) state.history[g.key].done = Math.max(0, state.history[g.key].done - 1);
    }
    delete quest.lastGrant;
    state.stats.completed = Math.max(0, state.stats.completed - 1);
    updateTrial(state, key);
    addLog(state, '↩️', `Desfez "${quest.title}".`);
    return true;
  }

  function addReward(state, title, cost) {
    const reward = { id: uid(), title: String(title || '').trim() || 'Recompensa', cost: Math.max(1, Math.round(Number(cost) || 1)) };
    state.rewards.push(reward);
    return reward;
  }

  function removeReward(state, id) {
    state.rewards = state.rewards.filter((r) => r.id !== id || r.builtin);
  }

  function buyReward(state, id) {
    const reward = state.rewards.find((r) => r.id === id);
    if (!reward) return { ok: false, reason: 'not-found' };
    if (state.hero.gold < reward.cost) return { ok: false, reason: 'gold' };
    if (reward.heal && state.hero.hp >= maxHp(heroLevel(state))) return { ok: false, reason: 'full-hp' };
    if (reward.item && state.hero.items[reward.item] >= MAX_ITEMS) return { ok: false, reason: 'max-items' };
    state.hero.gold -= reward.cost;
    state.stats.rewardsBought++;
    let healed = 0;
    if (reward.heal) healed = heal(state, reward.heal);
    if (reward.item) state.hero.items[reward.item]++;
    addLog(state, '🛒', `Comprou "${reward.title}" por ${reward.cost} ouro${healed ? ` (+${healed} vida)` : ''}.`);
    return { ok: true, healed, achievements: checkAchievements(state) };
  }

  // Processa os dias que passaram desde a última abertura: diárias não feitas
  // causam dano e zeram a sequência; cada noite de descanso recupera um pouco de vida.
  // Também troca o chefe quando começa uma semana nova.
  function processRollover(state, today) {
    const key = today || todayKey();
    const summary = { days: 0, missed: [], damage: 0, defeated: false, healed: 0, boss: null, rested: [] };
    if (!state.lastProcessed) state.lastProcessed = key;
    if (state.lastProcessed < key) {
      let day = state.lastProcessed;
      const earliest = addDays(key, -MAX_CATCHUP_DAYS);
      if (day < earliest) day = earliest;
      for (; day < key; day = addDays(day, 1)) {
        summary.days++;
        const totals = dailyTotals(state, day);
        const entry = historyDay(state, day);
        entry.due = totals.due;
        entry.dailyDone = totals.done;
        const missed = state.quests.filter((q) => q.type === 'daily' && q.createdAt <= day && isScheduled(q, day) && !isDoneOn(q, day));
        // Um Pergaminho de Folga protege o dia ruim: sem dano e sem perder sequências.
        if (missed.length && state.hero.items.folga > 0) {
          state.hero.items.folga--;
          state.restDays.push(day);
          if (state.restDays.length > 60) state.restDays.shift();
          summary.rested.push({ day, count: missed.length });
          addLog(state, '📜', `Um Pergaminho de Folga protegeu o dia ${day.split('-').reverse().slice(0, 2).join('/')}.`);
        } else {
          missed.forEach((q) => {
            q.streak = 0;
            const result = damage(state, DIFFICULTY[q.difficulty].damage, `"${q.title}" esquecida`);
            summary.missed.push({ title: q.title, day, damage: result.damage });
            summary.damage += result.damage;
            if (result.defeated) summary.defeated = true;
          });
        }
        const restRate = REST_HEAL + bonuses(state).rest;
        summary.healed += heal(state, Math.ceil(maxHp(heroLevel(state)) * restRate));
      }
      state.quests.forEach((q) => {
        if (q.type === 'habit' && q.countDate !== key) {
          q.count = 0;
          q.countDate = key;
        }
      });
      if (summary.missed.length) {
        addLog(state, '⚔️', `Missões perdidas enquanto esteve fora: ${summary.missed.length} (−${summary.damage} vida).`);
      }
      state.lastProcessed = key;
    }
    summary.boss = ensureBoss(state, key);
    if (summary.boss.escaped && summary.boss.escaped.defeated) summary.defeated = true;
    registerVisit(state, key);
    ensureChallenge(state, key);
    recordDay(state, key);
    return summary;
  }

  // ---------- Conquistas ----------

  const ACHIEVEMENTS = [
    { id: 'first-quest', icon: '🗡️', name: 'Primeiro Passo', desc: 'Conclua sua primeira missão.', check: (s) => s.stats.completed >= 1 },
    { id: 'quests-10', icon: '🛡️', name: 'Aprendiz', desc: 'Conclua 10 missões.', check: (s) => s.stats.completed >= 10 },
    { id: 'quests-100', icon: '🏰', name: 'Veterano', desc: 'Conclua 100 missões.', check: (s) => s.stats.completed >= 100 },
    { id: 'quests-500', icon: '🐉', name: 'Lenda Viva', desc: 'Conclua 500 missões.', check: (s) => s.stats.completed >= 500 },
    { id: 'streak-7', icon: '🔥', name: 'Semana Implacável', desc: 'Sequência de 7 numa diária.', check: (s) => s.stats.bestStreak >= 7 },
    { id: 'streak-30', icon: '☄️', name: 'Disciplina de Ferro', desc: 'Sequência de 30 numa diária.', check: (s) => s.stats.bestStreak >= 30 },
    { id: 'level-5', icon: '⭐', name: 'Ascensão', desc: 'Alcance o nível 5.', check: (s) => heroLevel(s) >= 5 },
    { id: 'level-10', icon: '🌟', name: 'Herói do Reino', desc: 'Alcance o nível 10.', check: (s) => heroLevel(s) >= 10 },
    { id: 'gold-1000', icon: '💰', name: 'Tesouro do Dragão', desc: 'Ganhe 1000 de ouro no total.', check: (s) => s.stats.goldEarned >= 1000 },
    { id: 'first-reward', icon: '🎁', name: 'Merecido', desc: 'Compre uma recompensa na loja.', check: (s) => s.stats.rewardsBought >= 1 },
    { id: 'balanced', icon: '⚖️', name: 'Equilíbrio', desc: 'Todos os atributos no nível 3.', check: (s) => Object.values(s.hero.attrs).every((x) => levelFromXp(x, ATTR_BASE) >= 3) },
    { id: 'defeat', icon: '🪦', name: 'Renascido', desc: 'Seja derrotado e continue lutando.', check: (s) => s.stats.defeats >= 1 },
    { id: 'boss-1', icon: '🏅', name: 'Caçador de Chefes', desc: 'Derrote seu primeiro chefe semanal.', check: (s) => s.stats.bossesDefeated >= 1 },
    { id: 'boss-10', icon: '🎖️', name: 'Flagelo dos Monstros', desc: 'Derrote 10 chefes semanais.', check: (s) => s.stats.bossesDefeated >= 10 },
    { id: 'trait-1', icon: '🌱', name: 'Superação', desc: 'Supere uma das suas dificuldades.', check: (s) => s.hero.traits.some((t) => t.overcome) },
    { id: 'trait-3', icon: '🦋', name: 'Metamorfose', desc: 'Supere três dificuldades.', check: (s) => s.hero.traits.filter((t) => t.overcome).length >= 3 },
    { id: 'visits-7', icon: '📅', name: 'Fiel ao Reino', desc: 'Abra o app 7 dias seguidos.', check: (s) => (s.visits.best || 0) >= 7 },
    { id: 'visits-30', icon: '🗓️', name: 'Morador do Reino', desc: 'Abra o app 30 dias seguidos.', check: (s) => (s.visits.best || 0) >= 30 },
    { id: 'challenge-10', icon: '🎲', name: 'Caçador de Surpresas', desc: 'Conclua 10 desafios do dia.', check: (s) => s.stats.challenges >= 10 },
    { id: 'trial-1', icon: '🏛️', name: 'Provação Vencida', desc: 'Vença sua primeira Provação.', check: (s) => s.stats.trials >= 1 },
    { id: 'legendary', icon: '✴️', name: 'Equipamento Lendário', desc: 'Equipe um item lendário.', check: (s) => Object.keys(SLOTS).some((slot) => { const i = equippedItem(s, slot); return i && i.tier === TIERS.length - 1; }) },
  ];

  function checkAchievements(state) {
    const unlocked = [];
    ACHIEVEMENTS.forEach((a) => {
      if (!state.achievements[a.id] && a.check(state)) {
        state.achievements[a.id] = Date.now();
        unlocked.push(a);
        addLog(state, '🏆', `Conquista desbloqueada: ${a.name}!`);
      }
    });
    return unlocked;
  }

  // ---------- Persistência ----------

  function validate(state) {
    return !!(
      state &&
      state.version === VERSION &&
      state.hero &&
      typeof state.hero.xp === 'number' &&
      state.hero.equipment &&
      Array.isArray(state.hero.traits) &&
      state.hero.items &&
      state.visits &&
      state.board &&
      Array.isArray(state.restDays) &&
      Array.isArray(state.quests) &&
      Array.isArray(state.rewards) &&
      state.history
    );
  }

  return {
    VERSION,
    ATTRIBUTES,
    CLASSES,
    DIFFICULTY,
    ACHIEVEMENTS,
    ATTR_BASE,
    SLOTS,
    TIERS,
    TRAITS,
    TRAIT_STAGES,
    CATALOG: CONTENT.CATALOG,
    CHESTS: CONTENT.CHESTS,
    TITLES: CONTENT.TITLES,
    DIFFICULTY_MIN_LEVEL,
    HABIT_XP_PER_DAY,
    MAX_ITEMS,
    MAX_ACTIVE_TRAITS,
    TRAIT_BONUS,
    EQUIPMENT,
    BOSSES,
    todayKey,
    addDays,
    dayOfWeek,
    weekStart,
    xpForLevel,
    levelFromXp,
    levelProgress,
    maxHp,
    heroLevel,
    heroProgress,
    heroTitle,
    levelCap,
    allowedDifficulty,
    boardQuests,
    newBoardCount,
    markBoardSeen,
    acceptCatalogQuest,
    catalogEntry,
    perfectDay,
    updateTrial,
    ensureChallenge,
    rerollChallenge,
    challengeReward,
    completeChallenge,
    chestTier,
    chestAvailable,
    openChest,
    createState,
    migrate,
    addLog,
    addQuest,
    removeQuest,
    findQuest,
    isScheduled,
    isDoneOn,
    habitCount,
    dailyTotals,
    recordDay,
    computeReward,
    completeQuest,
    undoQuest,
    damage,
    heal,
    traitStage,
    traitProgress,
    findTrait,
    activeTrait,
    activeTraits,
    addTrait,
    removeTrait,
    addSuggestedQuests,
    findItem,
    isUnlocked,
    bestUnlocked,
    equippedItem,
    bonuses,
    equip,
    ensureBoss,
    bossReward,
    addReward,
    removeReward,
    buyReward,
    processRollover,
    checkAchievements,
    validate,
  };
});
