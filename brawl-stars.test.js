'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanTag, normalizeBattleLog } = require('./brawl-stars');

test('normaliza tags con y sin almohadilla y rechaza tags inválidos', () => {
  assert.equal(cleanTag('#2R20PL0UR'), '2R20PL0UR');
  assert.equal(cleanTag('2R20PL0UR'), '2R20PL0UR');
  assert.throws(() => cleanTag('tag inválido'));
});

test('normaliza participantes en equipos y asocia el estelar por tag', () => {
  const result = normalizeBattleLog({ items: [{
    battleTime: '20261027T120000.000Z', event: { mode: 'gemGrab', map: 'Mapa' },
    battle: { result: 'victory', starPlayer: { tag: '#2R20PL0UR', name: 'Sergio' }, teams: [[
      { tag: '#2R20PL0UR', name: 'Sergio', brawler: { name: 'Shelly' } },
      { tag: '#8U2Q9Y0', name: 'Otra persona' }
    ], [{ name: 'Sin tag', brawler: {} }]] }
  }] });
  assert.equal(result[0].participants.length, 3);
  assert.equal(result[0].participants[0].isStarPlayer, true);
  assert.equal(result[0].participants[1].isStarPlayer, false);
  assert.equal(result[0].participants[0].brawler, 'Shelly');
  assert.equal(result[0].participants[1].brawler, null);
  assert.equal(result[0].starPlayer.tag, '#2R20PL0UR');
  assert.equal(result[0].mode, 'gemGrab');
  assert.equal(result[0].dataAvailable.map, true);
});

test('maneja historial alternativo, campos incompletos y ausencia del estelar', () => {
  const result = normalizeBattleLog({ items: [{ battle: { players: [{ name: 'Jugador', brawler: { name: 'Nita' } }] } }] });
  assert.equal(result[0].participants[0].name, 'Jugador');
  assert.equal(result[0].participants[0].isStarPlayer, false);
  assert.equal(result[0].starPlayer.available, false);
  assert.equal(result[0].map, null);
  assert.equal(result[0].dataAvailable.battleTime, false);
});

