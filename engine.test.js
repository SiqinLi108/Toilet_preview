'use strict';
const assert = require('node:assert/strict');
const G = require('./engine.js');
const s = G.initial();
assert.equal(s.version, 2);
assert.equal(s.bag.length, 15);
assert.equal(G.input(s), 1);
assert.equal(s.coins, 61);
const id = G.draw(s, () => 0);
assert.equal(id, 0);
assert.equal(s.bag[0], 1);
assert.equal(s.coins, 41);
assert.deepEqual(G.launch(s, 0), { id: 0, from: 1, to: 2 });
assert.equal(s.floor, 1);
assert.equal(s.unlockedFloor, 1);
assert.equal(s.bag[0], 0);
assert.equal(G.launch(s, 2000), null);
assert.equal(G.draw(s), null);
const resumed = G.restore(JSON.stringify(s));
assert.equal(resumed.floor, 2);
assert.equal(resumed.unlockedFloor, 2);
assert.equal(resumed.bag[0], 0);
assert.equal(resumed.pending, null);
assert.equal(G.land(s).to, 2);
assert.equal(G.land(s), null);
assert.ok(s.collection.includes(0));
for (let id = 0; id < 15; id++) {
  let prev = 0;
  for (let ms = 0; ms <= 2500; ms += 25) {
    const jump = G.climb(id, ms);
    assert.ok(jump >= 1 && jump >= prev);
    prev = jump;
  }
  assert.equal(G.climb(id, 2000), G.climb(id, 100000));
  if (id >= 3) assert.ok(G.climb(id, 2000) > G.climb(id - 3, 2000));
}
for (const f of [1, 10, 60, 100, 1000]) {
  assert.ok(Math.abs(G.weights(f).reduce((a, b) => a + b, 0) - 100) < 1e-10);
  assert.equal(G.weights(f).length, 5);
}
for (let q = 0; q < 5; q++) {
  const test = G.initial(), w = G.weights(1);
  const roll = (w.slice(0, q).reduce((a,b)=>a+b, 0) + w[q] / 2) / 100;
  const result = G.draw(test, () => roll);
  assert.equal(Math.floor(result / 3), q);
}
const rainbow = G.initial();
assert.equal(G.draw(rainbow, () => .999), 14);
assert.equal(G.launch(rainbow, 2000).to, 22);
G.land(rainbow);
assert.equal(rainbow.unlockedFloor, 22);
assert.equal(rainbow.collection[0], 14);
const poor = G.initial(); poor.coins = 0;
assert.equal(G.draw(poor), null);
assert.equal(G.income, undefined);
assert.equal(G.settle, undefined);
const legacy = { version: 1, floor: 8, coins: 123.5, bag: Array(12).fill(0), collection: [11], selected: 11, lastTime: 0 };
legacy.bag[11] = 2;
const migrated = G.restore(JSON.stringify(legacy));
assert.equal(migrated.coins, 123.5);
assert.equal(migrated.floor, 8);
assert.equal(migrated.unlockedFloor, 8);
assert.equal(migrated.bag[11], 2);
assert.equal(migrated.bag.length, 15);
assert.equal(migrated.lastTime, undefined);
assert.deepEqual(G.restore(JSON.stringify(s)), s);
assert.throws(() => G.restore('{broken'));
assert.throws(() => G.restore(JSON.stringify({ ...s, floor: -1 })));
assert.throws(() => G.restore(JSON.stringify({ ...s, bag: [] })));
assert.throws(() => G.restore(JSON.stringify({ ...s, coins: null })));
assert.throws(() => G.restore(JSON.stringify({ ...s, unlockedFloor: 1 })));
assert.throws(() => G.restore(JSON.stringify({ ...s, pending: { id: 14, from: 2, to: 100 } })));
assert.throws(() => G.climb(15, 2000));
const cap = G.initial(); cap.floor = cap.unlockedFloor = G.MAX_FLOOR; cap.bag[0] = 1; cap.selected = 0;
assert.equal(G.launch(cap, 2000), null);
assert.equal(cap.bag[0], 1);
console.log('PASS: input +1, five rarities, charge, consumption, impact unlock, saved flight recovery, legacy migration, no passive income, validation');
