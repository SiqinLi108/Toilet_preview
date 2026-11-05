(function (root) {
  'use strict';
  const QUALITIES = [
    { name: '普通', color: '#a9b5b1', base: 1, bonus: 2 },
    { name: '稀有', color: '#67cbb2', base: 2, bonus: 4 },
    { name: '史诗', color: '#b39ae8', base: 4, bonus: 6 },
    { name: '传说', color: '#efbc6f', base: 6, bonus: 9 },
    { name: '炫彩', color: '#f3a9de', base: 9, bonus: 12 }
  ];
  const ITEMS = [
    { name: '狗屎', skins: ['原味狗屎', '薄荷狗屎', '银河狗屎', '黄金狗屎', '炫彩狗屎'] },
    { name: '八卦 PDF', skins: ['茶水间小报', '部门秘闻', '董事会密卷', '宇宙级八卦', '炫彩八卦 PDF'] },
    { name: '纸飞机', skins: ['便签飞机', '荧光飞机', '星际飞机', '镀金飞机', '炫彩纸飞机'] }
  ];
  const MAX_CHARGE_MS = 2000;
  const MAX_FLOOR = 1000000;
  function initial() {
    return { version: 2, floor: 1, unlockedFloor: 1, coins: 60, bag: Array(15).fill(0), collection: [], selected: null, pending: null };
  }
  function input(state) { state.coins += 1; return 1; }
  function cost(floor) { return Math.ceil(20 * (1 + (floor - 1) * 0.09)); }
  function weights(floor) {
    const growth = Math.min(1, (floor - 1) / 60);
    return [69.5 - 39.5 * growth, 23 + 5 * growth, 6 + 17 * growth, 1 + 12 * growth, 0.5 + 5.5 * growth];
  }
  function draw(state, random = Math.random) {
    const price = cost(state.floor);
    if (state.pending || state.coins < price) return null;
    let roll = random() * 100;
    const chances = weights(state.floor);
    let quality = 0;
    while (quality < QUALITIES.length - 1 && roll >= chances[quality]) roll -= chances[quality++];
    const type = Math.min(2, Math.floor(random() * 3));
    const id = quality * 3 + type;
    state.coins -= price;
    state.bag[id]++;
    if (!state.collection.includes(id)) state.collection.push(id);
    state.selected = id;
    return id;
  }
  function climb(id, duration) {
    const q = QUALITIES[Math.floor(id / 3)];
    if (!Number.isInteger(id) || id < 0 || id >= 15 || !Number.isFinite(duration)) throw new Error('Invalid item or charge');
    return q.base + Math.floor(q.bonus * Math.max(0, Math.min(1, duration / MAX_CHARGE_MS)));
  }
  function launch(state, duration) {
    const id = state.selected;
    if (state.pending || state.floor >= MAX_FLOOR || !Number.isInteger(id) || !state.bag[id]) return null;
    const from = state.floor;
    const to = Math.min(MAX_FLOOR, from + climb(id, duration));
    state.bag[id]--;
    state.pending = { id, from, to };
    if (!state.bag[id]) state.selected = state.bag.findIndex(n => n > 0);
    if (state.selected === -1) state.selected = null;
    return { ...state.pending };
  }
  function land(state) {
    if (!state.pending) return null;
    const result = { ...state.pending };
    state.floor = result.to;
    state.unlockedFloor = Math.max(state.unlockedFloor, result.to);
    state.pending = null;
    return result;
  }
  function restore(raw) {
    const s = JSON.parse(raw);
    const legacy = s && s.version === 1;
    const size = legacy ? 12 : 15;
    if (!s || ![1, 2].includes(s.version) || !Number.isSafeInteger(s.floor) || s.floor < 1 || s.floor > MAX_FLOOR ||
        !Number.isFinite(s.coins) || s.coins < 0 ||
        !Array.isArray(s.bag) || s.bag.length !== size || !s.bag.every(n => Number.isSafeInteger(n) && n >= 0) ||
        !Array.isArray(s.collection) || !s.collection.every(n => Number.isInteger(n) && n >= 0 && n < size)) {
      throw new Error('Invalid save');
    }
    if (legacy) {
      s.version = 2;
      s.bag.push(0, 0, 0);
      s.unlockedFloor = s.floor;
      s.pending = null;
    }
    if (!Number.isSafeInteger(s.unlockedFloor) || s.unlockedFloor < s.floor || s.unlockedFloor > MAX_FLOOR) throw new Error('Invalid unlock');
    if (s.pending !== null) {
      const p = s.pending;
      if (!p || !Number.isInteger(p.id) || p.id < 0 || p.id >= 15 || p.from !== s.floor ||
          !Number.isSafeInteger(p.to) || p.to <= p.from || p.to > MAX_FLOOR || p.to - p.from > climb(p.id, MAX_CHARGE_MS)) throw new Error('Invalid flight');
      // A saved launch has already consumed its item. Finish it once on reload.
      land(s);
    }
    s.collection = [...new Set(s.collection)];
    if (!Number.isInteger(s.selected) || s.selected < 0 || s.selected >= 15 || !s.bag[s.selected]) {
      s.selected = s.bag.findIndex(n => n > 0);
      if (s.selected === -1) s.selected = null;
    }
    return { version: 2, floor: s.floor, unlockedFloor: s.unlockedFloor, coins: s.coins,
      bag: s.bag, collection: s.collection, selected: s.selected, pending: s.pending };
  }
  const api = { QUALITIES, ITEMS, MAX_CHARGE_MS, MAX_FLOOR, initial, input, cost, weights, draw, climb, launch, land, restore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ToiletGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
