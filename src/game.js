// Regras do jogo: funções puras sobre o estado, sem DOM.
// Funciona no navegador (window.RoutineRPG) e no Node (module.exports).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoutineRPG = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = 1;
  const MAX_CATCHUP_DAYS = 7;
  const MAX_LOG = 150;

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

  function heroLevel(state) {
    return levelFromXp(state.hero.xp);
  }

  // ---------- Estado ----------

  let idCounter = 0;
  function uid() {
    idCounter = (idCounter + 1) % 1e6;
    return Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function createState(name, cls, today) {
    const key = today || todayKey();
    const attrs = {};
    Object.keys(ATTRIBUTES).forEach((a) => (attrs[a] = 0));
    const state = {
      version: VERSION,
      hero: { name: name || 'Aventureiro', cls: CLASSES[cls] ? cls : 'guerreiro', xp: 0, hp: maxHp(1), gold: 0, attrs },
      quests: [],
      rewards: [
        { id: uid(), title: 'Poção de Vida', cost: 25, heal: 20, builtin: true },
        { id: uid(), title: 'Um episódio de série', cost: 50 },
        { id: uid(), title: 'Sobremesa favorita', cost: 80 },
      ],
      achievements: {},
      log: [],
      stats: { completed: 0, goldEarned: 0, rewardsBought: 0, defeats: 0, bestStreak: 0 },
      lastProcessed: key,
      createdAt: key,
    };
    addLog(state, '🌅', `${state.hero.name}, o ${CLASSES[state.hero.cls].name}, inicia sua jornada!`);
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

  // ---------- Recompensas e dano ----------

  function computeReward(state, quest) {
    const diff = DIFFICULTY[quest.difficulty];
    const streak = quest.type === 'daily' ? Math.min(quest.streak, STREAK_BONUS_CAP) : 0;
    const streakMult = 1 + streak * STREAK_BONUS_PER_DAY;
    const classMult = CLASSES[state.hero.cls].attr === quest.attr ? 1 + CLASS_BONUS : 1;
    return {
      xp: Math.round(diff.xp * streakMult * classMult),
      gold: Math.round(diff.gold * streakMult),
    };
  }

  function grant(state, attr, xp, gold) {
    const hero = state.hero;
    const beforeLevel = heroLevel(state);
    const beforeAttr = levelFromXp(hero.attrs[attr], ATTR_BASE);
    hero.xp += xp;
    hero.attrs[attr] += xp;
    hero.gold += gold;
    state.stats.goldEarned += gold;
    const level = heroLevel(state);
    const attrLevel = levelFromXp(hero.attrs[attr], ATTR_BASE);
    const events = { xp, gold, levelUp: null, attrUp: null };
    if (level > beforeLevel) {
      hero.hp = maxHp(level);
      events.levelUp = level;
      addLog(state, '⭐', `Subiu para o nível ${level}! Vida restaurada.`);
    }
    if (attrLevel > beforeAttr) {
      events.attrUp = { attr, level: attrLevel };
      addLog(state, ATTRIBUTES[attr].icon, `${ATTRIBUTES[attr].name} chegou ao nível ${attrLevel}.`);
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

  // Aplica dano; ao chegar a 0 de vida o herói é derrotado:
  // perde o progresso do nível atual e metade do ouro, e volta com vida cheia.
  function damage(state, amount, reason) {
    const hero = state.hero;
    hero.hp -= amount;
    if (hero.hp > 0) return { damage: amount, defeated: false };
    const level = heroLevel(state);
    const lostGold = Math.floor(hero.gold / 2);
    hero.xp = xpForLevel(level);
    hero.gold -= lostGold;
    hero.hp = maxHp(level);
    state.stats.defeats++;
    addLog(state, '💀', `Derrotado${reason ? ` por ${reason}` : ''}! Perdeu o progresso do nível e ${lostGold} de ouro.`);
    return { damage: amount, defeated: true, lostGold };
  }

  function heal(state, amount) {
    const hero = state.hero;
    const max = maxHp(heroLevel(state));
    const before = hero.hp;
    hero.hp = Math.min(max, hero.hp + amount);
    return hero.hp - before;
  }

  // ---------- Ações ----------

  function completeQuest(state, id, today) {
    const key = today || todayKey();
    const quest = findQuest(state, id);
    if (!quest) return null;

    if (quest.type === 'habit') {
      if (quest.countDate !== key) {
        quest.count = 0;
        quest.countDate = key;
      }
      quest.count++;
      if (quest.polarity === 'bad') {
        const dmg = DIFFICULTY[quest.difficulty].damage;
        const result = damage(state, dmg, quest.title);
        if (!result.defeated) addLog(state, '🩸', `Cedeu a "${quest.title}" e perdeu ${dmg} de vida.`);
        return { type: 'damage', ...result, achievements: checkAchievements(state) };
      }
      const reward = computeReward(state, quest);
      const events = grant(state, quest.attr, reward.xp, reward.gold);
      state.stats.completed++;
      addLog(state, '✨', `"${quest.title}": +${reward.xp} XP, +${reward.gold} ouro.`);
      return { type: 'reward', ...events, achievements: checkAchievements(state) };
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
    const reward = computeReward(state, quest);
    quest.lastGrant = { key, xp: reward.xp, gold: reward.gold };
    const events = grant(state, quest.attr, reward.xp, reward.gold);
    state.stats.completed++;
    const streakText = quest.type === 'daily' && quest.streak > 1 ? ` (sequência de ${quest.streak})` : '';
    addLog(state, '✅', `Missão "${quest.title}" concluída${streakText}: +${reward.xp} XP, +${reward.gold} ouro.`);
    return { type: 'reward', ...events, achievements: checkAchievements(state) };
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
    if (g) revoke(state, quest.attr, g.xp, g.gold);
    delete quest.lastGrant;
    state.stats.completed = Math.max(0, state.stats.completed - 1);
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
    state.hero.gold -= reward.cost;
    state.stats.rewardsBought++;
    let healed = 0;
    if (reward.heal) healed = heal(state, reward.heal);
    addLog(state, '🛒', `Comprou "${reward.title}" por ${reward.cost} ouro${healed ? ` (+${healed} vida)` : ''}.`);
    return { ok: true, healed, achievements: checkAchievements(state) };
  }

  // Processa os dias que passaram desde a última abertura: diárias não feitas
  // causam dano e zeram a sequência; cada noite de descanso recupera um pouco de vida.
  function processRollover(state, today) {
    const key = today || todayKey();
    const summary = { days: 0, missed: [], damage: 0, defeated: false, healed: 0 };
    if (!state.lastProcessed || state.lastProcessed >= key) {
      if (!state.lastProcessed) state.lastProcessed = key;
      return summary;
    }
    let day = state.lastProcessed;
    const earliest = addDays(key, -MAX_CATCHUP_DAYS);
    if (day < earliest) day = earliest;
    for (; day < key; day = addDays(day, 1)) {
      summary.days++;
      state.quests.forEach((q) => {
        if (q.type !== 'daily' || q.createdAt > day || !isScheduled(q, day) || isDoneOn(q, day)) return;
        q.streak = 0;
        const dmg = DIFFICULTY[q.difficulty].damage;
        summary.missed.push({ title: q.title, day, damage: dmg });
        summary.damage += dmg;
        const result = damage(state, dmg, `"${q.title}" esquecida`);
        if (result.defeated) summary.defeated = true;
      });
      summary.healed += heal(state, Math.ceil(maxHp(heroLevel(state)) * 0.1));
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
      Array.isArray(state.quests) &&
      Array.isArray(state.rewards)
    );
  }

  return {
    VERSION,
    ATTRIBUTES,
    CLASSES,
    DIFFICULTY,
    ACHIEVEMENTS,
    ATTR_BASE,
    todayKey,
    addDays,
    dayOfWeek,
    xpForLevel,
    levelFromXp,
    levelProgress,
    maxHp,
    heroLevel,
    createState,
    addLog,
    addQuest,
    removeQuest,
    findQuest,
    isScheduled,
    isDoneOn,
    habitCount,
    computeReward,
    completeQuest,
    undoQuest,
    damage,
    heal,
    addReward,
    removeReward,
    buyReward,
    processRollover,
    checkAchievements,
    validate,
  };
});
