const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/game.js');

const MONDAY = '2026-10-19';
const SUNDAY = '2026-10-18'; // tarefas criadas na véspera rendem XP cheio

function fresh(cls = 'guerreiro') {
  return G.createState('Teste', cls, MONDAY);
}

test('curva de níveis', () => {
  assert.equal(G.xpForLevel(1), 0);
  assert.equal(G.xpForLevel(2), 100);
  assert.equal(G.xpForLevel(3), 300);
  assert.equal(G.levelFromXp(0), 1);
  assert.equal(G.levelFromXp(99), 1);
  assert.equal(G.levelFromXp(100), 2);
  assert.equal(G.levelFromXp(650), 4);
  assert.deepEqual(G.levelProgress(150), { level: 2, current: 50, needed: 200 });
});

test('datas locais', () => {
  assert.equal(G.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(G.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(G.dayOfWeek(MONDAY), 1);
});

test('concluir diária dá XP, ouro, bônus de classe e sequência', () => {
  const s = fresh('guerreiro');
  const q = G.addQuest(s, { official: true, title: 'Treinar', type: 'daily', attr: 'str', difficulty: 'medium' }, MONDAY);
  const r = G.completeQuest(s, q.id, MONDAY);
  // 25 base, sequência 1 => +10%, classe +20% => 25 * 1.1 * 1.2 = 33
  assert.equal(r.xp, 33);
  assert.equal(r.gold, 11);
  assert.equal(s.hero.xp, 33);
  assert.equal(s.hero.attrs.str, 33);
  assert.equal(q.streak, 1);
  assert.equal(G.completeQuest(s, q.id, MONDAY), null, 'não conclui duas vezes no mesmo dia');
  assert.ok(s.achievements['first-quest']);
});

test('desfazer devolve tudo', () => {
  const s = fresh('mago');
  const q = G.addQuest(s, { official: true, title: 'Ler', type: 'daily', attr: 'str', difficulty: 'epic' }, MONDAY);
  G.completeQuest(s, q.id, MONDAY);
  assert.equal(G.heroLevel(s), 2);
  assert.ok(G.undoQuest(s, q.id, MONDAY));
  assert.equal(s.hero.xp, 0);
  assert.equal(s.hero.gold, 0);
  assert.equal(q.streak, 0);
  assert.equal(G.heroLevel(s), 1);
  assert.ok(s.hero.hp <= G.maxHp(1));
  assert.equal(G.isDoneOn(q, MONDAY), false);
});

test('virada de dia: diária esquecida causa dano e zera sequência', () => {
  const s = fresh();
  const q = G.addQuest(s, { official: true, title: 'Meditar', type: 'daily', attr: 'wis', difficulty: 'hard' }, MONDAY);
  G.completeQuest(s, q.id, MONDAY);
  const tue = G.addDays(MONDAY, 1);
  const wed = G.addDays(MONDAY, 2);
  let sum = G.processRollover(s, tue);
  assert.equal(sum.missed.length, 0);
  assert.equal(q.streak, 1);
  sum = G.processRollover(s, wed);
  assert.equal(sum.missed.length, 1);
  assert.equal(sum.damage, 8);
  assert.equal(q.streak, 0);
  assert.equal(s.lastProcessed, wed);
});

test('diária não agendada no dia não causa dano', () => {
  const s = fresh();
  G.addQuest(s, { official: true, title: 'Academia', type: 'daily', attr: 'str', days: [3] }, MONDAY); // quarta
  const sum = G.processRollover(s, G.addDays(MONDAY, 2));
  assert.equal(sum.missed.length, 0);
});

test('ausência longa limita a punição a 7 dias', () => {
  const s = fresh();
  G.addQuest(s, { official: true, title: 'Água', type: 'daily', attr: 'vit', difficulty: 'easy' }, MONDAY);
  const sum = G.processRollover(s, G.addDays(MONDAY, 60));
  assert.equal(sum.days, 7);
  assert.equal(sum.missed.length, 7);
});

test('derrota: perde progresso do nível e metade do ouro', () => {
  const s = fresh();
  s.hero.xp = 150; // nível 2
  s.hero.gold = 41;
  s.hero.hp = 4;
  const r = G.damage(s, 10);
  assert.ok(r.defeated);
  assert.equal(s.hero.xp, 100);
  assert.equal(s.hero.gold, 21);
  assert.equal(s.hero.hp, G.maxHp(2));
});

test('hábitos bons e ruins', () => {
  const s = fresh();
  const good = G.addQuest(s, { official: true, title: 'Beber água', type: 'habit', attr: 'vit', difficulty: 'easy' }, MONDAY);
  const bad = G.addQuest(s, { official: true, title: 'Doom scroll', type: 'habit', polarity: 'bad', difficulty: 'medium' }, MONDAY);
  G.completeQuest(s, good.id, MONDAY);
  G.completeQuest(s, good.id, MONDAY);
  assert.equal(G.habitCount(good, MONDAY), 2);
  assert.equal(s.hero.xp, 20);
  const hp = s.hero.hp;
  G.completeQuest(s, bad.id, MONDAY);
  assert.equal(s.hero.hp, hp - 5);
  G.processRollover(s, G.addDays(MONDAY, 1));
  assert.equal(G.habitCount(good, G.addDays(MONDAY, 1)), 0);
});

test('loja: compra, ouro insuficiente e poção', () => {
  const s = fresh();
  const potion = s.rewards.find((r) => r.heal);
  assert.equal(G.buyReward(s, potion.id).reason, 'gold');
  s.hero.gold = 100;
  assert.equal(G.buyReward(s, potion.id).reason, 'full-hp');
  s.hero.hp = 10;
  const r = G.buyReward(s, potion.id);
  assert.ok(r.ok);
  assert.equal(s.hero.hp, 30);
  assert.equal(s.hero.gold, 75);
  G.removeReward(s, potion.id);
  assert.ok(s.rewards.includes(potion), 'poção não pode ser removida');
});

test('validate reconhece estado salvo', () => {
  const s = fresh();
  assert.ok(G.validate(JSON.parse(JSON.stringify(s))));
  assert.equal(G.validate({}), false);
});

// ---------- Chefes, equipamentos, histórico e migração ----------

test('semana começa na segunda', () => {
  assert.equal(G.weekStart(MONDAY), MONDAY);
  assert.equal(G.weekStart('2026-10-25'), MONDAY); // domingo
  assert.equal(G.weekStart('2026-10-26'), '2026-10-26');
});

test('chefe nasce com vida proporcional às diárias da semana', () => {
  const s = fresh();
  G.addQuest(s, { official: true, title: 'Ler', type: 'daily', attr: 'int', difficulty: 'medium' }, MONDAY); // 7 × 25
  G.processRollover(s, MONDAY);
  assert.equal(s.boss.week, MONDAY);
  assert.equal(s.boss.maxHp, 140); // 175 × 0,8
  // Criado no meio da semana conta só os dias restantes (mínimo 100).
  const late = fresh();
  G.addQuest(late, { official: true, title: 'Ler', type: 'daily', attr: 'int', difficulty: 'medium' }, '2026-10-24');
  G.processRollover(late, '2026-10-24');
  assert.equal(late.boss.maxHp, 100);
});

test('missões causam dano no chefe; vencer dá prêmio e conquista', () => {
  const s = fresh();
  const q = G.addQuest(s, { official: true, title: 'Épico', type: 'todo', attr: 'cha', difficulty: 'epic' }, SUNDAY);
  G.processRollover(s, MONDAY);
  s.boss.hp = 50;
  const r = G.completeQuest(s, q.id, MONDAY);
  assert.ok(r.boss.defeated);
  assert.equal(s.boss.hp, 0);
  assert.equal(s.stats.bossesDefeated, 1);
  // A missão épica leva ao nível 2, então o prêmio é 40 + 2 × 10.
  assert.deepEqual(r.boss.reward, { xp: 60, gold: 35 });
  assert.equal(s.hero.xp, 100 + 60);
  assert.ok(s.achievements['boss-1']);
});

test('desfazer devolve a vida do chefe; hábito ruim cura o chefe', () => {
  const s = fresh();
  const q = G.addQuest(s, { official: true, title: 'Ler', type: 'daily', attr: 'int', difficulty: 'medium' }, MONDAY);
  const bad = G.addQuest(s, { official: true, title: 'Doce', type: 'habit', polarity: 'bad', difficulty: 'easy' }, MONDAY);
  G.processRollover(s, MONDAY);
  const full = s.boss.hp;
  G.completeQuest(s, q.id, MONDAY);
  assert.ok(s.boss.hp < full);
  G.undoQuest(s, q.id, MONDAY);
  assert.equal(s.boss.hp, full);
  s.boss.hp = 100;
  G.completeQuest(s, bad.id, MONDAY);
  assert.equal(s.boss.hp, 106);
});

test('chefe não derrotado foge na semana seguinte e dá um golpe', () => {
  const s = fresh();
  G.processRollover(s, MONDAY);
  const first = s.boss.name;
  const hp = s.hero.hp;
  const sum = G.processRollover(s, '2026-10-26');
  assert.equal(sum.boss.escaped.name, first);
  assert.ok(sum.boss.escaped.damage > 0);
  assert.notEqual(s.boss.name, first);
  assert.equal(s.boss.week, '2026-10-26');
  assert.ok(s.hero.hp <= hp + sum.healed);
});

test('equipamentos: liberados por nível, equipados ao subir e com bônus', () => {
  const s = fresh('mago');
  assert.equal(G.equippedItem(s, 'weapon').id, 'graveto');
  assert.equal(G.equippedItem(s, 'shield'), null);
  assert.equal(G.equip(s, 'adaga'), false, 'bloqueado no nível 1');
  const q = G.addQuest(s, { official: true, title: 'Grande', type: 'todo', attr: 'str', difficulty: 'epic' }, SUNDAY);
  const r = G.completeQuest(s, q.id, MONDAY); // 100 XP => nível 2
  assert.equal(r.levelUp, 2);
  assert.deepEqual(r.newItems.map((i) => i.id).sort(), ['panela', 'rato']);
  assert.equal(G.equippedItem(s, 'shield').id, 'panela');
  assert.equal(G.bonuses(s).defense, 0.05);
  s.hero.hp = 30;
  assert.equal(G.damage(s, 20).damage, 19);
});

test('bônus de elmo e amuleto aumentam a recompensa', () => {
  const s = fresh('mago');
  s.hero.xp = G.xpForLevel(7);
  s.hero.trialsPassed = 1; // já venceu a Provação do nível 5
  G.equip(s, 'chapeu'); // +5% XP
  G.equip(s, 'anel'); // +10% ouro
  const q = G.addQuest(s, { official: true, title: 'X', type: 'todo', attr: 'str', difficulty: 'hard' }, SUNDAY);
  assert.deepEqual(G.computeReward(s, q, MONDAY), { xp: 53, gold: 22, reduced: null });
});

test('histórico guarda missões por dia e diárias cumpridas', () => {
  const s = fresh();
  const a = G.addQuest(s, { official: true, title: 'A', type: 'daily', attr: 'str', difficulty: 'easy' }, MONDAY);
  G.addQuest(s, { official: true, title: 'B', type: 'daily', attr: 'str', difficulty: 'easy' }, MONDAY);
  G.completeQuest(s, a.id, MONDAY);
  G.processRollover(s, G.addDays(MONDAY, 1));
  assert.deepEqual(
    { done: s.history[MONDAY].done, due: s.history[MONDAY].due, dailyDone: s.history[MONDAY].dailyDone },
    { done: 1, due: 2, dailyDone: 1 },
  );
  assert.equal(typeof s.history[G.addDays(MONDAY, 1)].xp, 'number');
});

test('migra progresso da versão 1 sem perder nada', () => {
  const v1 = fresh();
  delete v1.hero.equipment;
  delete v1.boss;
  delete v1.history;
  delete v1.stats.bossesDefeated;
  delete v1.stats.bossesSeen;
  ['look', 'traits', 'trialsPassed', 'trial', 'items'].forEach((k) => delete v1.hero[k]);
  ['challenge', 'visits', 'board', 'restDays'].forEach((k) => delete v1[k]);
  v1.version = 1;
  v1.hero.xp = G.xpForLevel(5) + 10;
  v1.hero.gold = 77;
  const s = G.migrate(JSON.parse(JSON.stringify(v1)));
  assert.ok(G.validate(s));
  assert.equal(s.hero.gold, 77);
  assert.equal(G.equippedItem(s, 'weapon').id, 'adaga');
  assert.equal(G.equippedItem(s, 'pet').id, 'gato');
});

// ---------- Dificuldades (características do avatar) ----------

test('escolher dificuldades: no máximo 3 ativas, sem repetir', () => {
  const s = fresh();
  assert.ok(G.addTrait(s, 'sono', MONDAY));
  assert.equal(G.addTrait(s, 'sono', MONDAY), null);
  assert.ok(G.addTrait(s, 'ansiedade', MONDAY));
  assert.ok(G.addTrait(s, 'celular', MONDAY));
  assert.equal(G.addTrait(s, 'estudos', MONDAY), null);
  assert.equal(G.addTrait(s, 'inexistente', MONDAY), null);
});

test('missões sugeridas ficam ligadas à dificuldade e não se repetem', () => {
  const s = fresh();
  G.addTrait(s, 'sono', MONDAY);
  const added = G.addSuggestedQuests(s, 'sono', MONDAY);
  assert.equal(added.length, 3);
  assert.ok(added.every((q) => q.trait === 'sono' && q.attr === 'vit'));
  assert.equal(G.addSuggestedQuests(s, 'sono', MONDAY).length, 0);
});

test('missão ligada dá +15% XP e faz a característica evoluir', () => {
  const s = fresh('guerreiro');
  G.addTrait(s, 'estudos', MONDAY);
  const q = G.addQuest(s, { official: true, title: 'Estudar', type: 'todo', attr: 'int', difficulty: 'hard', trait: 'estudos' }, SUNDAY);
  assert.equal(G.computeReward(s, q).xp, 57); // 50 × 1,15, arredondado
  const r = G.completeQuest(s, q.id, MONDAY);
  assert.equal(r.trait.gained, 57);
  assert.equal(G.findTrait(s, 'estudos').progress, 57);
  G.undoQuest(s, q.id, MONDAY);
  assert.equal(G.findTrait(s, 'estudos').progress, 0);
});

test('hábito ruim ligado faz perder progresso', () => {
  const s = fresh();
  G.addTrait(s, 'celular', MONDAY);
  const bad = G.addQuest(s, { official: true, title: 'Rolar', type: 'habit', polarity: 'bad', difficulty: 'medium', trait: 'celular' }, MONDAY);
  G.findTrait(s, 'celular').progress = 100;
  const r = G.completeQuest(s, bad.id, MONDAY);
  assert.equal(r.traitSetback, 15);
  assert.equal(G.findTrait(s, 'celular').progress, 85);
});

test('superar uma dificuldade vira virtude com bônus permanente', () => {
  const s = fresh('guerreiro');
  G.addTrait(s, 'timidez', MONDAY);
  const q = G.addQuest(s, { official: true, title: 'Conversar', type: 'todo', attr: 'cha', difficulty: 'epic', trait: 'timidez' }, SUNDAY);
  const t = G.findTrait(s, 'timidez');
  t.progress = 1150;
  const r = G.completeQuest(s, q.id, MONDAY);
  assert.ok(r.trait.overcome);
  assert.equal(t.overcome, MONDAY);
  assert.equal(G.traitStage(t), G.TRAIT_STAGES.length - 1);
  assert.ok(s.achievements['trait-1']);
  assert.equal(G.activeTraits(s).length, 0, 'abre vaga para um novo desafio');
  assert.equal(G.removeTrait(s, 'timidez'), false, 'virtudes não são removidas');
  const other = G.addQuest(s, { official: true, title: 'Festa', type: 'todo', attr: 'cha', difficulty: 'hard' }, SUNDAY);
  assert.equal(G.computeReward(s, other).xp, 55); // +10% da virtude em Carisma
});

test('remover dificuldade desliga as missões dela', () => {
  const s = fresh();
  G.addTrait(s, 'financas', MONDAY);
  const [q] = G.addSuggestedQuests(s, 'financas', MONDAY);
  assert.ok(G.removeTrait(s, 'financas'));
  assert.equal(q.trait, undefined);
  assert.equal(G.findTrait(s, 'financas'), null);
});

test('migra progresso da versão 2 para a 3', () => {
  const v2 = fresh();
  delete v2.hero.look;
  delete v2.hero.traits;
  ['trialsPassed', 'trial', 'items'].forEach((k) => delete v2.hero[k]);
  ['challenge', 'visits', 'board', 'restDays'].forEach((k) => delete v2[k]);
  v2.version = 2;
  const s = G.migrate(JSON.parse(JSON.stringify(v2)));
  assert.ok(G.validate(s));
  assert.deepEqual(s.hero.traits, []);
  assert.equal(s.hero.look, null);
});

// ---------- Contra "farmar" pontos ----------

test('hábito bom só rende XP nas 3 primeiras vezes do dia', () => {
  const s = fresh();
  const h = G.addQuest(s, { title: 'Água', type: 'habit', attr: 'vit', difficulty: 'easy' }, MONDAY);
  for (let i = 0; i < 3; i++) assert.equal(G.completeQuest(s, h.id, MONDAY).type, 'reward');
  const xp = s.hero.xp;
  const r = G.completeQuest(s, h.id, MONDAY);
  assert.equal(r.type, 'capped');
  assert.equal(s.hero.xp, xp);
  assert.equal(G.habitCount(h, MONDAY), 4, 'continua contando');
  assert.equal(G.computeReward(s, h, G.addDays(MONDAY, 1)).xp, 10, 'no dia seguinte volta a render');
});

test('tarefa criada e concluída no mesmo dia rende metade', () => {
  const s = fresh();
  const today = G.addQuest(s, { title: 'Hoje', type: 'todo', attr: 'cha', difficulty: 'medium' }, MONDAY);
  const before = G.addQuest(s, { title: 'Ontem', type: 'todo', attr: 'cha', difficulty: 'medium' }, SUNDAY);
  assert.deepEqual(G.computeReward(s, today, MONDAY), { xp: 13, gold: 5, reduced: 'sameDay' });
  assert.equal(G.computeReward(s, before, MONDAY).xp, 25);
});

test('dificuldade de missões criadas depende do nível', () => {
  const s = fresh();
  assert.equal(G.addQuest(s, { title: 'A', type: 'todo', difficulty: 'epic' }, MONDAY).difficulty, 'medium');
  s.hero.xp = G.xpForLevel(3);
  assert.equal(G.addQuest(s, { title: 'B', type: 'todo', difficulty: 'epic' }, MONDAY).difficulty, 'hard');
  s.hero.xp = G.xpForLevel(8);
  s.hero.trialsPassed = 1;
  assert.equal(G.addQuest(s, { title: 'C', type: 'todo', difficulty: 'epic' }, MONDAY).difficulty, 'epic');
});

// ---------- Mural de Missões ----------

test('Mural libera missões por nível e não deixa aceitar repetida', () => {
  const s = fresh();
  const board = G.boardQuests(s);
  assert.ok(board.filter((c) => c.unlocked).every((c) => c.level === 1));
  assert.equal(G.acceptCatalogQuest(s, 'str-treino20', MONDAY), null, 'nível 5 bloqueada');
  const q = G.acceptCatalogQuest(s, 'str-alongar', MONDAY);
  assert.equal(q.catalog, 'str-alongar');
  assert.equal(G.acceptCatalogQuest(s, 'str-alongar', MONDAY), null);
  s.hero.xp = G.xpForLevel(3);
  assert.ok(G.newBoardCount(s) > 0);
  G.markBoardSeen(s);
  assert.equal(G.newBoardCount(s), 0);
});

test('missão do Mural rende menos quando fica fácil demais', () => {
  const s = fresh();
  const q = G.acceptCatalogQuest(s, 'vit-copo', MONDAY); // nível 1, fácil
  assert.equal(G.computeReward(s, q, MONDAY).reduced, null);
  s.hero.xp = G.xpForLevel(7);
  s.hero.trialsPassed = 1;
  const r = G.computeReward(s, { ...q, streak: 0 }, MONDAY);
  assert.equal(r.reduced, 'outgrown');
  assert.equal(r.xp, 6);
});

test('missão do Mural liga ao desafio ativo', () => {
  const s = fresh();
  G.addTrait(s, 'sono', MONDAY);
  s.hero.xp = G.xpForLevel(3);
  assert.equal(G.acceptCatalogQuest(s, 'vit-meianoite', MONDAY).trait, 'sono');
  assert.equal(G.acceptCatalogQuest(s, 'vit-fruta', MONDAY).trait, undefined, 'alimentação não foi escolhida');
});

// ---------- Provação ----------

test('nível trava no 4 até vencer a Provação; o XP não se perde', () => {
  const s = fresh();
  const daily = G.addQuest(s, { title: 'Ler', type: 'daily', attr: 'int', difficulty: 'easy' }, '2026-10-01');
  s.hero.xp = G.xpForLevel(5) - 5;
  G.completeQuest(s, daily.id, MONDAY); // passa do XP do nível 5
  assert.equal(G.heroLevel(s), 4);
  assert.ok(G.heroProgress(s).capped);
  assert.equal(s.hero.trial.need, 3);
  assert.deepEqual(s.hero.trial.days, [MONDAY], 'o dia de hoje já foi perfeito');
  G.processRollover(s, G.addDays(MONDAY, 1));
  G.completeQuest(s, daily.id, G.addDays(MONDAY, 1));
  G.processRollover(s, G.addDays(MONDAY, 2));
  const r = G.completeQuest(s, daily.id, G.addDays(MONDAY, 2));
  assert.ok(r.trial.passed);
  assert.equal(r.levelUp, 5);
  assert.equal(G.heroLevel(s), 5);
  assert.equal(G.heroTitle(s), 'Aprendiz');
  assert.equal(s.hero.trial, null);
  assert.ok(s.achievements['trial-1']);
});

test('desfazer tira o dia perfeito da Provação', () => {
  const s = fresh();
  const daily = G.addQuest(s, { title: 'Ler', type: 'daily', attr: 'int', difficulty: 'easy' }, '2026-10-01');
  s.hero.xp = G.xpForLevel(5);
  s.hero.trial = { level: 5, need: 3, since: MONDAY, days: [] };
  G.completeQuest(s, daily.id, MONDAY);
  assert.equal(s.hero.trial.days.length, 1);
  G.undoQuest(s, daily.id, MONDAY);
  assert.equal(s.hero.trial.days.length, 0);
});

test('migração não tira o nível de quem já passou das Provações', () => {
  const v3 = fresh();
  ['trialsPassed', 'trial', 'items'].forEach((k) => delete v3.hero[k]);
  ['challenge', 'visits', 'board', 'restDays'].forEach((k) => delete v3[k]);
  v3.rewards = v3.rewards.filter((r) => !r.item);
  v3.version = 3;
  v3.hero.xp = G.xpForLevel(12) + 50;
  const s = G.migrate(JSON.parse(JSON.stringify(v3)));
  assert.ok(G.validate(s));
  assert.equal(G.heroLevel(s), 12);
  assert.equal(s.hero.trialsPassed, 2);
  assert.ok(s.rewards.some((r) => r.item === 'folga'));
});

// ---------- Desafio do dia ----------

test('desafio do dia: sorteado por dia, vale o dobro e troca só uma vez', () => {
  const s = fresh();
  G.processRollover(s, MONDAY);
  const c = s.challenge;
  assert.equal(c.key, MONDAY);
  const again = G.createState('Teste', 'guerreiro', MONDAY);
  G.processRollover(again, MONDAY);
  assert.equal(again.challenge.id, c.id, 'mesmo herói, mesmo dia, mesmo desafio');
  const entry = G.catalogEntry(c.id);
  assert.ok(entry.level <= 1 && entry.type !== 'habit');
  const firstId = c.id;
  assert.ok(G.rerollChallenge(s, MONDAY));
  assert.notEqual(s.challenge.id, firstId);
  assert.equal(G.rerollChallenge(s, MONDAY), false);
  const reward = G.challengeReward(s);
  const r = G.completeChallenge(s, MONDAY);
  assert.equal(r.xp, reward.xp);
  assert.equal(G.completeChallenge(s, MONDAY), null);
  G.processRollover(s, G.addDays(MONDAY, 1));
  assert.equal(s.challenge.key, G.addDays(MONDAY, 1));
  assert.equal(s.challenge.done, false);
});

// ---------- Baú diário e folga ----------

test('baú diário: um por dia e melhora com dias seguidos', () => {
  const s = fresh();
  let day = MONDAY;
  const tiers = [];
  for (let i = 0; i < 8; i++) {
    G.processRollover(s, day);
    const loot = G.openChest(s, day);
    assert.ok(loot.gold > 0);
    assert.equal(G.openChest(s, day), null, 'só um por dia');
    tiers.push(loot.tier);
    day = G.addDays(day, 1);
  }
  assert.deepEqual(tiers, [0, 0, 1, 1, 1, 1, 2, 2]);
  assert.ok(s.achievements['visits-7']);
  // Pular um dia recomeça a sequência.
  day = G.addDays(day, 1);
  G.processRollover(s, day);
  assert.equal(G.openChest(s, day).tier, 0);
});

test('Pergaminho de Folga protege um dia ruim', () => {
  const s = fresh();
  const q = G.addQuest(s, { title: 'Ler', type: 'daily', attr: 'int', difficulty: 'easy' }, '2026-10-01');
  q.streak = 5;
  s.hero.gold = 100;
  const scroll = s.rewards.find((r) => r.item === 'folga');
  assert.ok(G.buyReward(s, scroll.id).ok);
  assert.equal(s.hero.items.folga, 1);
  const hp = s.hero.hp;
  const sum = G.processRollover(s, G.addDays(MONDAY, 1));
  assert.equal(sum.rested.length, 1);
  assert.equal(sum.missed.length, 0);
  assert.equal(q.streak, 5, 'sequência preservada');
  assert.ok(s.hero.hp >= hp);
  assert.equal(s.hero.items.folga, 0);
  // Sem pergaminho, o dia seguinte esquecido volta a doer.
  const sum2 = G.processRollover(s, G.addDays(MONDAY, 2));
  assert.equal(sum2.missed.length, 1);
  assert.equal(q.streak, 0);
});

test('no máximo 3 Pergaminhos de Folga guardados', () => {
  const s = fresh();
  s.hero.gold = 1000;
  const scroll = s.rewards.find((r) => r.item === 'folga');
  for (let i = 0; i < 3; i++) assert.ok(G.buyReward(s, scroll.id).ok);
  assert.equal(G.buyReward(s, scroll.id).reason, 'max-items');
});
