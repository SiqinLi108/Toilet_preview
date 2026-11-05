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
  const POOP_STYLES = ['原味', '炫彩', '透明', 'Q弹', '闪光'];
  const COSTUMES = ['兔耳', '猫耳', '皮卡丘尾巴', '汉堡头套', '纸盒头套', '毛绒套装', '红白条纹泳圈', '薯条头套', '苹果头套', '领带', '无袖背心'];
  const POOP_IDS = [0, 3, 15, 6, 9, 16, 17, 12, 18];
  const POOP_QUALITIES = [
    { name: '普通', color: '#a9b5b1', base: 1, bonus: 2 },
    { name: '薄荷', color: '#67cbb2', base: 2, bonus: 4 },
    { name: '透明', color: '#b9e5ef', base: 3, bonus: 5 },
    { name: '银河', color: '#b39ae8', base: 4, bonus: 6 },
    { name: '黄金', color: '#efbc6f', base: 6, bonus: 9 },
    { name: '闪光', color: '#fff0a0', base: 8, bonus: 11 },
    { name: 'Q弹', color: '#e9a9c8', base: 10, bonus: 13 },
    { name: '炫彩', color: '#f3a9de', base: 12, bonus: 16 },
    { name: 'Q弹炫彩', color: '#fa8ede', base: 15, bonus: 20 }
  ];
  const ITEM_COUNT = 19;
  function item(id) {
    if (!Number.isInteger(id) || id < 0 || id >= ITEM_COUNT) throw new Error('Invalid item');
    const poopRank = POOP_IDS.indexOf(id);
    if (poopRank !== -1) {
      const quality = POOP_QUALITIES[poopRank];
      return { q: poopRank, type: 0, style: [0, 0, 2, 5, 0, 4, 3, 1, 3][poopRank],
        name: (poopRank === 0 ? '原味' : quality.name) + '狗屎', quality, poopRank,
        ...(id === 18 ? { rainbow: true } : {}) };
    }
    const q = Math.floor(id / 3), type = id % 3;
    return { q, type, style: 0, name: ITEMS[type].skins[q], quality: QUALITIES[q] };
  }
  function initial(seed = Math.floor(Math.random() * 4294967296)) {
    return { version: 4, floor: 1, unlockedFloor: 1, coins: 60, bag: Array(ITEM_COUNT).fill(0), collection: [], selected: null, pending: null,
      seed: seed >>> 0, costumes: [], equipped: null, lastSurpriseFloor: 1 };
  }
  function surprises(state, block) {
    if (!Number.isInteger(state.seed) || state.seed < 0 || state.seed > 4294967295 ||
        !Number.isInteger(block) || block < 0 || block >= MAX_FLOOR / 20) throw new Error('Invalid surprise block');
    // Per-block randomness is reproducible from the saved seed, independent of draw order.
    let n = (state.seed ^ Math.imul(block + 1, 0x9e3779b1)) >>> 0;
    const random = () => {
      n = (n + 0x6d2b79f5) >>> 0;
      let t = Math.imul(n ^ (n >>> 15), n | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const count = random() < .5 ? 1 : 2, start = block === 0 ? 2 : block * 20 + 1;
    const width = block === 0 ? 19 : 20, rewards = [];
    for (let i = 0; i < count; i++) {
      let floor = start + Math.floor(random() * width);
      if (rewards.some(r => r.floor === floor)) floor = start + (floor - start + 1) % width;
      rewards.push({ floor });
    }
    // One seed-fixed permutation plus global slots avoids repeats even at block boundaries.
    n = state.seed >>> 0;
    const order = COSTUMES.map((_, id) => id);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return rewards.sort((a, b) => a.floor - b.floor)
      .map((reward, idx) => ({ ...reward, costume: order[(block * 2 + idx) % order.length] }));
  }
  function collectSurprises(state, from, to) {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < 1 ||
        from > MAX_FLOOR || to > MAX_FLOOR) throw new Error('Invalid surprise range');
    const earned = [];
    from = Math.max(from, state.lastSurpriseFloor);
    if (to <= from) return earned;
    for (let block = Math.floor(from / 20); block <= Math.floor((to - 1) / 20); block++) {
      for (const reward of surprises(state, block)) {
        if (reward.floor <= from || reward.floor > to) continue;
        if (!state.costumes.includes(reward.costume)) state.costumes.push(reward.costume);
        state.equipped = reward.costume;
        earned.push(reward);
      }
    }
    state.lastSurpriseFloor = to;
    return earned;
  }
  function input(state) { state.coins += 1; return 1; }
  function cost(floor) { return Math.ceil(20 * (1 + (floor - 1) * 0.09)); }
  function weights(floor) {
    const growth = Math.min(1, (floor - 1) / 60);
    return [69.5 - 39.5 * growth, 23 + 5 * growth, 6 + 17 * growth, 1 + 12 * growth, 0.5 + 5.5 * growth];
  }
  function poopWeights(floor) {
    const growth = Math.max(0, Math.min(1, (floor - 1) / 60));
    const low = [55, 24, 10, 5, 3, 1.5, .8, .5, .2];
    const high = [12, 14, 14, 14, 13, 11, 9, 7, 6];
    return low.map((weight, rank) => weight + (high[rank] - weight) * growth);
  }
  function draw(state, random = Math.random) {
    const price = cost(state.floor);
    if (state.pending || state.coins < price) return null;
    const typeRoll = random(), qualityRoll = random();
    if (![typeRoll, qualityRoll].every(n => Number.isFinite(n) && n >= 0 && n < 1)) throw new Error('Invalid random');
    const type = Math.floor(typeRoll * 3);
    let roll = qualityRoll * 100;
    const chances = type === 0 ? poopWeights(state.floor) : weights(state.floor);
    let quality = 0;
    while (quality < chances.length - 1 && roll >= chances[quality]) roll -= chances[quality++];
    const id = type === 0 ? POOP_IDS[quality] : quality * 3 + type;
    state.coins -= price;
    state.bag[id]++;
    if (!state.collection.includes(id)) state.collection.push(id);
    state.selected = id;
    return id;
  }
  function climb(id, duration) {
    const q = item(id).quality;
    if (!Number.isFinite(duration)) throw new Error('Invalid charge');
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
    result.rewards = collectSurprises(state, state.unlockedFloor, result.to);
    state.floor = result.to;
    state.unlockedFloor = Math.max(state.unlockedFloor, result.to);
    state.pending = null;
    return result;
  }
  function restore(raw) {
    const s = JSON.parse(raw);
    const version = s && s.version;
    const size = version === 1 ? 12 : version === 2 ? 15 : version === 3 ? 35 : ITEM_COUNT;
    if (!s || ![1, 2, 3, 4].includes(version) || !Number.isSafeInteger(s.floor) || s.floor < 1 || s.floor > MAX_FLOOR ||
        !Number.isFinite(s.coins) || s.coins < 0 ||
        !Array.isArray(s.bag) || s.bag.length !== size || !s.bag.every(n => Number.isSafeInteger(n) && n >= 0) ||
        !Array.isArray(s.collection) || !s.collection.every(n => Number.isInteger(n) && n >= 0 && n < size)) {
      throw new Error('Invalid save');
    }
    if (version === 1) {
      if (s.unlockedFloor === undefined) s.unlockedFloor = s.floor;
      if (s.pending === undefined) s.pending = null;
    }
    if (!Number.isSafeInteger(s.unlockedFloor) || s.unlockedFloor < s.floor || s.unlockedFloor > MAX_FLOOR) throw new Error('Invalid unlock');
    // Validate the original flight before compressing old styles into weaker fixed items.
    if (s.pending !== null) {
      const p = s.pending;
      if (!p || !Number.isInteger(p.id) || p.id < 0 || p.id >= size || p.from !== s.floor ||
          !Number.isSafeInteger(p.to) || p.to <= p.from || p.to > MAX_FLOOR) throw new Error('Invalid flight');
      const q = version < 4 ? QUALITIES[p.id < 15 ? Math.floor(p.id / 3) : Math.floor((p.id - 15) / 4)] : item(p.id).quality;
      if (p.to - p.from > q.base + q.bonus) throw new Error('Invalid flight');
    }
    if (version < 3) {
      if (s.seed === undefined) s.seed = Math.floor(Math.random() * 4294967296);
      if (s.costumes === undefined) s.costumes = [];
      if (s.equipped === undefined) s.equipped = null;
    }
    if (!Number.isInteger(s.seed) || s.seed < 0 || s.seed > 4294967295 ||
        !Array.isArray(s.costumes) || !s.costumes.every(id => Number.isInteger(id) && id >= 0 && id < COSTUMES.length) ||
        (s.equipped !== null && (!Number.isInteger(s.equipped) || !s.costumes.includes(s.equipped)))) throw new Error('Invalid wardrobe');
    s.costumes = [...new Set(s.costumes)];
    if (version < 4) {
      const map = id => id < 15 ? id : [12, 15, 17, 16][(id - 15) % 4];
      const bag = Array(ITEM_COUNT).fill(0);
      s.bag.forEach((count, id) => {
        bag[map(id)] += count;
        if (!Number.isSafeInteger(bag[map(id)])) throw new Error('Invalid inventory total');
      });
      s.bag = bag;
      s.collection = s.collection.map(map);
      s.selected = Number.isInteger(s.selected) && s.selected >= 0 && s.selected < size ? map(s.selected) : null;
      if (s.pending) s.pending.id = map(s.pending.id);
      const equipped = s.equipped;
      s.lastSurpriseFloor = 1;
      collectSurprises(s, 1, s.unlockedFloor);
      if (equipped !== null) s.equipped = equipped;
      s.version = 4;
    }
    if (!Number.isSafeInteger(s.lastSurpriseFloor) || s.lastSurpriseFloor < s.unlockedFloor ||
        s.lastSurpriseFloor > MAX_FLOOR) throw new Error('Invalid surprise progress');
    if (s.pending !== null) {
      // A saved launch has already consumed its item. Finish it once on reload.
      land(s);
    }
    s.collection = [...new Set(s.collection)];
    if (!Number.isInteger(s.selected) || s.selected < 0 || s.selected >= ITEM_COUNT || !s.bag[s.selected]) {
      s.selected = s.bag.findIndex(n => n > 0);
      if (s.selected === -1) s.selected = null;
    }
    return { version: 4, floor: s.floor, unlockedFloor: s.unlockedFloor, coins: s.coins,
      bag: s.bag, collection: s.collection, selected: s.selected, pending: s.pending,
      seed: s.seed, costumes: s.costumes, equipped: s.equipped, lastSurpriseFloor: s.lastSurpriseFloor };
  }
  const api = { QUALITIES, POOP_QUALITIES, POOP_IDS, ITEMS, POOP_STYLES, COSTUMES, ITEM_COUNT, MAX_CHARGE_MS, MAX_FLOOR,
    initial, item, surprises, collectSurprises, input, cost, weights, poopWeights, draw, climb, launch, land, restore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ToiletGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
