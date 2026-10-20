const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/avatar.js');
const W = require('../src/world.js');
const G = require('../src/game.js');

test('avatar desenha equipamento, classe e detalhes', () => {
  const svg = A.render({ skin: 3, hair: 'longo', hairColor: 'preto', extra: 'orelhas', color: 'verde' }, { weapon: 'espada', shield: 'aco', helmet: 'coroa', amulet: 'joia', pet: 'dragao' }, { cls: 'mago' });
  assert.match(svg, /^<svg class="avatar-svg"/);
  assert.match(svg, /#a86c43/, 'tom de pele');
  assert.match(svg, /✦/, 'emblema do mago');
  assert.match(svg, /🐉/, 'companheiro');
  assert.match(svg, /av-sparkle/, 'brilho de item lendário');
  assert.doesNotMatch(A.render(A.DEFAULT_LOOK, {}), /av-sparkle/);
});

test('aparência antiga (emoji) vira desenho sem quebrar', () => {
  assert.deepEqual(A.normalizeLook({ char: 'elfa', tone: '🏾', color: 'verde' }), { skin: 3, hair: 'longo', hairColor: 'castanho', extra: 'orelhas', color: 'verde' });
  assert.deepEqual(A.normalizeLook(null), A.DEFAULT_LOOK);
  assert.equal(A.normalizeLook({ skin: 99, hair: 'x' }).hair, A.DEFAULT_LOOK.hair);
});

test('céu da Vila muda com a hora', () => {
  assert.equal(W.phase(6), 'dawn');
  assert.equal(W.phase(12), 'day');
  assert.equal(W.phase(18), 'dusk');
  assert.equal(W.phase(23), 'night');
  assert.match(W.scene({ hour: 23 }), /class="star"/);
  assert.doesNotMatch(W.scene({ hour: 12 }), /class="star"/);
  assert.match(W.scene({ hour: 12, chest: true }), /data-action="chest"/);
});

test('personagens priorizam o que importa hoje', () => {
  const today = '2026-10-19';
  const s = G.createState('Lia', 'druida', today);
  G.addQuest(s, { title: 'Água', type: 'daily', attr: 'vit', difficulty: 'easy' }, today);
  G.processRollover(s, today);
  const lines = W.npcLines(s, G, today, 9);
  assert.equal(lines[0].npc, 'bia');
  assert.equal(lines[0].action, 'chest');
  assert.match(lines[0].text, /^Bom dia, Lia!/);
  assert.ok(lines.some((l) => l.npc === 'orion' && l.action === 'tab'), 'oferece o desafio do dia');
  G.openChest(s, today);
  assert.notEqual(W.npcLines(s, G, today, 21)[0].action, 'chest');
});
