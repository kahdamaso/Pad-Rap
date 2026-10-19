const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/game.js');

const MONDAY = '2026-10-19';

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
  const q = G.addQuest(s, { title: 'Treinar', type: 'daily', attr: 'str', difficulty: 'medium' }, MONDAY);
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
  const q = G.addQuest(s, { title: 'Ler', type: 'daily', attr: 'str', difficulty: 'epic' }, MONDAY);
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
  const q = G.addQuest(s, { title: 'Meditar', type: 'daily', attr: 'wis', difficulty: 'hard' }, MONDAY);
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
  G.addQuest(s, { title: 'Academia', type: 'daily', attr: 'str', days: [3] }, MONDAY); // quarta
  const sum = G.processRollover(s, G.addDays(MONDAY, 2));
  assert.equal(sum.missed.length, 0);
});

test('ausência longa limita a punição a 7 dias', () => {
  const s = fresh();
  G.addQuest(s, { title: 'Água', type: 'daily', attr: 'vit', difficulty: 'easy' }, MONDAY);
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
  const good = G.addQuest(s, { title: 'Beber água', type: 'habit', attr: 'vit', difficulty: 'easy' }, MONDAY);
  const bad = G.addQuest(s, { title: 'Doom scroll', type: 'habit', polarity: 'bad', difficulty: 'medium' }, MONDAY);
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
