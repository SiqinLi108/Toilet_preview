'use strict';
const G = ToiletGame, $ = id => document.getElementById(id), KEY = 'toilet-idle-demo-v1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = G.initial(), charge = null, flight = null, lastSave = 0, viewFloor = 1;
let inputAt = -Infinity, unlockAt = -Infinity, effects = [], lastRewards = [], rewardAt = -Infinity, spentAt = -Infinity, nextAuto = 0;
let heldPointer = null, heldKey = null, heldDue = 0, lastTap = null, touchStart = null;
function say(text) { $('notice').textContent = text; }
try {
  const raw = localStorage.getItem(KEY);
  if (raw) { state = G.restore(raw); say('进度已恢复，无自动或离线收益。'); }
} catch (e) { say('无法读取存档；当前为新局，请用导出存档备份。'); }
viewFloor = state.floor;
charge = state.charge;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    $('saveStatus').textContent = '本地自动保存 · 无离线收益。投完仍保留图鉴记录。';
  } catch (e) { $('saveStatus').textContent = '自动保存失败，请导出存档；浏览器存储不可用。'; }
}
function itemInfo(id) {
  return G.item(id);
}
function icon(canvas, id, now = 0) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 16, 16);
  if (id === null) return;
  const a = itemInfo(id);
  c.save();
  if (a.style === 2) c.globalAlpha = .45;
  if (a.style === 3 && !reduced) {
    const bounce = Math.sin(now / 180) * .15;
    c.translate(8, 14); c.scale(1 + bounce, 1 - bounce); c.translate(-8, -14);
  }
  c.fillStyle = a.quality.color;
  if (a.type === 0) {
    c.fillRect(2, 11, 12, 3); c.fillRect(4, 7, 9, 4); c.fillRect(6, 4, 6, 3); c.fillRect(7, 2, 3, 2);
  } else if (a.type === 1) { c.fillRect(4, 2, 9, 12); }
  else {
    c.beginPath(); c.moveTo(1, 6); c.lineTo(15, 2); c.lineTo(11, 14); c.lineTo(7, 9); c.closePath(); c.fill();
  }
  if ((a.type !== 0 && a.q === 4) || a.style === 1 || a.rainbow) {
    // Recolor only occupied pixels, retaining the original icon silhouette.
    const image = c.getImageData(0, 0, 16, 16);
    const colors = [[239,188,111],[156,223,165],[129,185,231],[179,154,232],[243,169,222]];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const p = (y * 16 + x) * 4;
      if (image.data[p + 3]) image.data.set(colors[Math.floor((x + y) / 4) % 5], p);
    }
    c.putImageData(image, 0, 0);
  }
  c.fillStyle = '#26312e';
  if (a.type === 0) { c.fillRect(5, 11, 1, 1); c.fillRect(10, 11, 1, 1); }
  else if (a.type === 1) { c.fillRect(6, 5, 5, 1); c.fillRect(6, 8, 5, 1); c.fillRect(6, 11, 3, 1); }
  else c.fillRect(7, 7, 2, 3);
  c.restore();
  if (a.style === 2) {
    c.fillStyle = '#d4f1ef'; c.fillRect(6, 5, 1, 3); c.fillRect(3, 12, 2, 1);
  }
  if (a.style === 4) {
    const x = !reduced && Math.floor(now / 250) % 2 ? 12 : 3;
    c.fillStyle = '#fffad2'; c.fillRect(x, 3, 1, 5); c.fillRect(x - 2, 5, 5, 1);
  }
  if (a.style === 5) {
    c.fillStyle = '#eee6ff'; c.fillRect(7, 5, 1, 1); c.fillRect(10, 8, 1, 1); c.fillRect(4, 12, 1, 1);
  }
}
function renderBag() {
  const container = $('bag'); container.replaceChildren();
  for (let id = 0; id < G.ITEM_COUNT; id++) {
    const info = itemInfo(id), seen = state.collection.includes(id), b = document.createElement('button');
    b.className = 'card' + (id === state.selected ? ' active' : '') + (((info.type !== 0 && info.q === 4) || info.style === 1 || info.rainbow) && seen ? ' rainbow' : '');
    b.style.setProperty('--quality', info.quality.color); b.disabled = !state.bag[id] || !!flight || !!charge;
    b.title = info.quality.name + ' · 蓄满升 ' + G.climb(id, 2000) + ' 层';
    const c = document.createElement('canvas'); c.width = c.height = 16; if (seen) icon(c, id); b.append(c);
    const name = document.createElement('span'); name.textContent = seen ? info.name : '未收集'; b.append(name);
    const count = document.createElement('span'); count.textContent = seen ? info.quality.name + ' ×' + state.bag[id] : '?'; b.append(count);
    b.onclick = () => { if (flight || charge) return; state.selected = id; save(); renderBag(); renderHUD(); };
    container.append(b);
  }
  $('collected').textContent = state.collection.length;
  $('probabilities').textContent = '三类等概率；狗屎：' + G.poopWeights(state.floor).map((w, i) => G.POOP_QUALITIES[i].name + ' ' + w.toFixed(1) + '%').join(' / ') + '。PDF/飞机：' + G.weights(state.floor).map((w, i) => G.QUALITIES[i].name + ' ' + w.toFixed(1) + '%').join(' / ');
  const wardrobe = $('wardrobe'); wardrobe.replaceChildren();
  const addOutfit = (id, name) => {
    const b = document.createElement('button');
    b.className = 'card' + (state.equipped === id ? ' active' : '');
    b.textContent = name; b.disabled = !!flight || (id !== null && !state.costumes.includes(id));
    b.onclick = () => { if (flight || (id !== null && !state.costumes.includes(id))) return; state.equipped = id; save(); renderBag(); say('已换装：' + name); };
    wardrobe.append(b);
  };
  addOutfit(null, '原始工服'); G.COSTUMES.forEach((name, id) => addOutfit(id, name));
  $('outfitStatus').textContent = '穿戴：' + (state.equipped === null ? '原始工服' : G.COSTUMES[state.equipped]) + ' · 收藏 ' + state.costumes.length + '/' + G.COSTUMES.length;
}
function renderHUD() {
  const id = state.selected;
  $('coins').textContent = Math.floor(state.coins).toLocaleString(); $('floor').textContent = state.floor + 'F';
  $('decor').textContent = G.bathroom(state.floor).name;
  $('cost').textContent = G.cost(state.floor) + ' 摸鱼值';
  $('draw').disabled = !!flight || !!charge || state.coins < G.cost(state.floor);
  $('throw').disabled = !!flight || id === null || state.floor >= G.MAX_FLOOR;
  $('autoMode').checked = state.autoMode;
  $('chargeFill').style.width = (charge ? charge.steps * 20 : 0) + '%';
  $('chargeLabel').textContent = charge ? '蓄力 ' + charge.steps + '/5 · 点击推进' : '投掷共需 5 摸鱼值';
  $('selectedName').textContent = id === null ? '先抽取产物' : itemInfo(id).name;
  const info = id === null ? null : itemInfo(id);
  $('itemToggle').classList.toggle('rainbow', info !== null && ((info.type !== 0 && info.q === 4) || info.style === 1 || info.rainbow));
  icon($('selectedIcon'), id);
  $('prediction').textContent = id === null ? '至少 +1 层' : '满条 +' + G.climb(id, 2000) + ' 层';
  $('scene').setAttribute('aria-label', '当前 ' + state.floor + ' 层，已解锁 1 至 ' + state.unlockedFloor + ' 层，每层三席，自己在第一席。');
}
function earnInput(e) {
  if (!e.isTrusted || e.repeat || document.hidden || $('testDialog').open) return;
  G.input(state); inputAt = performance.now();
  if (effects.length >= 6) effects.shift();
  effects.push({ time: inputAt, floor: state.floor });
  const control = e.target && e.target.closest && e.target.closest('button, input, label, .panel, dialog');
  if (e.type === 'pointerdown' && e.isPrimary !== false && charge && !control) advancePaidCharge();
  save(); renderHUD();
}
// Mouse/pen/touch presses count once at pointerdown; key auto-repeat is excluded.
document.addEventListener('pointerdown', earnInput, true);
document.addEventListener('keydown', earnInput, true);
// Suppress press-and-hold menus only inside the game, not editable fields.
document.addEventListener('contextmenu', e => {
  const target = e.target;
  if (target && target.closest && target.closest('.widget, dialog') && !target.closest('input, textarea')) e.preventDefault();
});
// Legacy mobile WebViews may ignore manipulation on nested game elements.
// Cancel only stationary, nearby second taps; do not interfere with scrolling or pinch gestures.
document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) { touchStart = null; lastTap = null; stopHold(); return; }
  const t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
}, { passive: true });
document.addEventListener('touchend', e => {
  const start = touchStart; touchStart = null;
  const target = e.target;
  if (!start || e.touches.length || !e.changedTouches.length || !target || !target.closest ||
      !target.closest('.widget') || target.closest('input, textarea, label')) { lastTap = null; return; }
  const t = e.changedTouches[0], now = performance.now();
  if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10 || now - start.time > 300) { lastTap = null; return; }
  if (lastTap && now - lastTap.time < 350 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 24) {
    if (e.cancelable) {
      e.preventDefault();
      // A cancelled touchend suppresses its compatibility click: preserve normal button action.
      const button = target.closest('button');
      if (button && button !== $('throw') && !button.disabled) button.click();
    }
  }
  lastTap = { x: t.clientX, y: t.clientY, time: now };
}, { passive: false });
document.addEventListener('touchcancel', () => { touchStart = lastTap = null; stopHold(); });
$('widget').addEventListener('dblclick', e => {
  if (!e.target.closest('input, textarea, label')) e.preventDefault();
});
function panel() { $('panel').hidden = !$('panel').hidden; renderBag(); }
$('bagToggle').onclick = panel; $('itemToggle').onclick = panel; $('closePanel').onclick = () => { $('panel').hidden = true; };
$('collapse').onclick = () => {
  $('panel').hidden = true;
  const compact = $('widget').classList.toggle('compact');
  $('collapse').textContent = compact ? '+' : '−'; $('collapse').setAttribute('aria-label', compact ? '展开界面' : '收起界面');
};
$('draw').onclick = () => {
  if (flight || charge) return;
  const id = G.draw(state);
  if (id !== null) { const info = itemInfo(id); say('抽到 ' + info.quality.name + ' · ' + info.name + '，已选中。'); save(); renderBag(); }
  renderHUD();
  if (state.autoMode) beginCharge();
};
function beginCharge() {
  if (flight || !G.startCharge(state)) return;
  charge = state.charge; nextAuto = performance.now() + 400;
  $('caption').textContent = '点击空白或楼层：+1 后消耗 1，蓄力 +20%。';
  save(); renderBag(); renderHUD();
}
function cancelCharge() {
  stopHold();
  if (!charge) return; G.cancelCharge(state); charge = null;
  $('caption').textContent = '已取消，产物保留；已消耗蓄力费用不退。'; save(); renderBag(); renderHUD();
}
function advancePaidCharge() {
  if (!charge) return;
  const step = G.advanceCharge(state);
  if (!step) { $('caption').textContent = '余额不足，点击屏幕赚取并投入 1 值。'; return; }
  spentAt = performance.now(); charge = state.charge; nextAuto = spentAt + 400;
  save(); renderHUD();
  const result = step.launch;
  if (!result) return;
  flight = { ...result, start: performance.now(), duration: reduced ? 600 : 1750 + Math.min(1800, (result.to - result.from) * 110), impacted: false, phase: 'throw' };
  viewFloor = result.from; save(); $('caption').textContent = '飞往 ' + result.to + 'F · 窗口仍封闭';
  say('本次升 ' + (result.to - result.from) + ' 层，产物已消耗。'); renderBag(); renderHUD();
}
function stopHold() { heldPointer = null; heldKey = null; nextAuto = performance.now() + 400; }
$('throw').addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.isPrimary === false || heldPointer !== null || flight) return;
  e.preventDefault();
  if (!charge) beginCharge();
  if (!charge) return;
  heldPointer = e.pointerId; heldDue = performance.now() + 400;
  $('throw').setPointerCapture(e.pointerId);
});
const finishHold = e => { if (heldPointer === e.pointerId) stopHold(); };
$('throw').addEventListener('pointerup', finishHold);
$('throw').addEventListener('pointercancel', finishHold);
$('throw').addEventListener('lostpointercapture', finishHold);
$('throw').addEventListener('keydown', e => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  e.preventDefault(); if (e.repeat || heldKey || flight) return;
  if (!charge) beginCharge();
  if (charge) { heldKey = e.code; heldDue = performance.now() + 400; }
});
$('throw').addEventListener('keyup', e => { if (e.code === heldKey) { e.preventDefault(); stopHold(); } });
$('throw').addEventListener('blur', stopHold);
$('throw').onclick = e => { if (!e || !e.detail) beginCharge(); };
$('autoMode').onchange = () => { state.autoMode = $('autoMode').checked; nextAuto = performance.now() + 400; save(); renderHUD(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { cancelCharge(); $('panel').hidden = true; } });
window.addEventListener('blur', () => { stopHold(); save(); });
document.addEventListener('visibilitychange', () => { stopHold(); save(); });
window.addEventListener('pagehide', save);
$('export').onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'toilet-idle-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('import').onclick = () => { if (flight) { say('请等投掷结束后再导入。'); return; } $('file').click(); };
$('file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    if (f.size > 100000) throw new Error('Too large'); const next = G.restore(await f.text());
    if (flight) { say('请等投掷结束后再导入。'); return; }
    if (!confirm('导入会替换当前进度，是否继续？')) return;
    state = next; charge = state.charge; viewFloor = state.floor; effects = []; lastRewards = []; rewardAt = -Infinity; nextAuto = performance.now() + 400; save(); renderBag(); renderHUD(); say('存档已导入，无离线收益。');
  } catch (err) { say('导入失败：不是有效存档，当前进度未改变。'); }
  finally { e.target.value = ''; }
};
$('reset').onclick = () => { if (flight) { say('请等投掷结束后再重开。'); return; } cancelCharge(); $('resetDialog').showModal(); };
$('cancelReset').onclick = () => { $('resetDialog').close(); };
$('testOptions').onclick = () => {
  $('testCoins').value = Math.floor(state.coins); $('testError').textContent = '';
  $('testDialog').showModal(); $('testCoins').focus(); $('testCoins').select();
};
$('cancelTest').onclick = () => { $('testDialog').close(); };
$('testForm').onsubmit = e => {
  e.preventDefault();
  const raw = String($('testCoins').value).trim(), value = Number(raw);
  if (!raw || !Number.isSafeInteger(value) || value < 0 || value > 1000000000) {
    $('testError').textContent = '请输入 0–1,000,000,000 之间的整数。'; return;
  }
  state.coins = value; save(); renderHUD(); $('testDialog').close();
  say('测试余额已设置为 ' + value.toLocaleString() + ' 摸鱼值。');
};
$('confirmReset').onclick = () => {
  state = G.initial(); charge = null; viewFloor = 1; flight = null; effects = []; lastRewards = []; inputAt = unlockAt = rewardAt = spentAt = -Infinity;
  save(); renderBag(); renderHUD(); say('重新开始，赠送 60 摸鱼值。'); $('resetDialog').close();
};
const ctx = $('scene').getContext('2d'), projectile = document.createElement('canvas'); projectile.width = projectile.height = 16;
ctx.imageSmoothingEnabled = false;
function drawCostume(c, id, x, y) {
  if (id === null) return;
  c.fillStyle = '#e5e5ce';
  if (id === 0) { c.fillRect(x + 1, y - 5, 2, 6); c.fillRect(x + 5, y - 5, 2, 6); c.fillStyle = '#e4adb6'; c.fillRect(x + 1, y - 4, 1, 4); }
  if (id === 1) { c.fillStyle = '#bb9776'; c.fillRect(x, y - 2, 3, 4); c.fillRect(x + 6, y - 2, 3, 4); }
  if (id === 2) { c.fillStyle = '#efce61'; c.fillRect(x - 5, y + 13, 4, 2); c.fillRect(x - 7, y + 9, 3, 5); c.fillRect(x - 9, y + 7, 5, 2); c.fillRect(x - 7, y + 3, 3, 5); }
  if (id === 3) { c.fillStyle = '#d9ac68'; c.fillRect(x - 2, y, 12, 4); c.fillRect(x - 2, y + 8, 12, 3); c.fillStyle = '#8aad62'; c.fillRect(x - 3, y + 4, 14, 2); c.fillStyle = '#6c4937'; c.fillRect(x - 2, y + 6, 12, 2); }
  if (id === 4) { c.fillStyle = '#bb9776'; c.fillRect(x - 2, y, 12, 11); c.fillStyle = '#263533'; c.fillRect(x, y + 5, 2, 2); c.fillRect(x + 5, y + 5, 2, 2); }
  if (id === 5) { c.fillStyle = '#c4b8d5'; c.fillRect(x - 2, y - 1, 12, 8); c.fillRect(x - 1, y + 10, 10, 11); c.fillStyle = '#ddb38a'; c.fillRect(x + 1, y + 4, 5, 5); c.fillStyle = '#c4b8d5'; c.fillRect(x - 1, y - 3, 3, 4); c.fillRect(x + 6, y - 3, 3, 4); }
  if (id === 6) {
    c.fillStyle = '#e5e5ce'; c.fillRect(x - 3, y + 15, 15, 3); c.fillRect(x - 2, y + 13, 3, 7); c.fillRect(x + 8, y + 13, 3, 7);
    c.fillStyle = '#db6c65'; c.fillRect(x, y + 15, 3, 3); c.fillRect(x + 6, y + 15, 3, 3); c.fillRect(x - 2, y + 13, 3, 2); c.fillRect(x + 8, y + 18, 3, 2);
  }
  if (id === 7) {
    c.fillStyle = '#efbc6f'; c.fillRect(x - 1, y - 4, 2, 9); c.fillRect(x + 2, y - 6, 2, 11); c.fillRect(x + 5, y - 3, 2, 8); c.fillRect(x + 8, y - 5, 2, 10);
    c.fillStyle = '#db6c65'; c.fillRect(x - 2, y + 3, 13, 7); c.fillStyle = '#e5e5ce'; c.fillRect(x + 3, y + 5, 3, 3);
  }
  if (id === 8) {
    c.fillStyle = '#db6c65'; c.fillRect(x - 2, y + 1, 12, 8); c.fillRect(x, y - 1, 8, 12);
    c.fillStyle = '#aeca91'; c.fillRect(x + 5, y - 4, 4, 2); c.fillStyle = '#bb9776'; c.fillRect(x + 4, y - 3, 1, 4);
    c.fillStyle = '#e5e5ce'; c.fillRect(x, y + 2, 2, 3);
  }
  if (id === 9) {
    c.fillStyle = '#e5e5ce'; c.fillRect(x + 2, y + 10, 3, 2);
    c.fillStyle = '#db6c65'; c.fillRect(x + 3, y + 11, 2, 3); c.fillRect(x + 2, y + 14, 3, 5); c.fillRect(x + 3, y + 19, 1, 1);
  }
  if (id === 10) {
    c.fillStyle = '#ddb38a'; c.fillRect(x, y + 10, 2, 9); c.fillRect(x + 7, y + 10, 2, 9);
    c.fillStyle = '#81b9e7'; c.fillRect(x + 2, y + 10, 5, 11);
    c.fillStyle = '#ddb38a'; c.fillRect(x + 3, y + 10, 3, 3);
  }
}
function drawRoomDecor(tier, y, now) {
  // Decorative blocks stay behind the seats and never replace character/reward sprites.
  if (tier === 0) {
    ctx.fillStyle = '#1c282b'; ctx.fillRect(48, y + 3, 5, 3); ctx.fillRect(69, y + 7, 4, 2);
    ctx.fillStyle = '#889a95'; ctx.fillRect(49, y + 5, 8, 1);
  }
  if (tier === 1) {
    ctx.fillStyle = '#394742'; for (let x = 20; x < 82; x += 12) ctx.fillRect(x, y + 9, 10, 1);
    ctx.fillStyle = '#a36e4b'; ctx.fillRect(76, y + 1, 2, 24); ctx.fillRect(70, y + 3, 8, 2);
    ctx.fillStyle = '#303a36'; ctx.fillRect(46, y + 8, 3, 2); ctx.fillRect(48, y + 10, 1, 3);
  }
  if (tier === 2) {
    ctx.fillStyle = '#ccd1c0'; for (let x = 20; x < 82; x += 10) ctx.fillRect(x, y + 8, 9, 1);
    ctx.fillStyle = '#374d57'; ctx.fillRect(77, y + 21, 5, 5); ctx.fillRect(76, y + 20, 7, 1);
  }
  if (tier === 3 || tier === 7) {
    ctx.fillStyle = tier === 7 ? '#65934f' : '#70926a';
    for (let x = 20; x < 82; x += 9) { ctx.fillRect(x, y + 1, 2, 7); ctx.fillRect(x + 2, y + 3, 3, 2); }
    ctx.fillStyle = '#ab8557'; ctx.fillRect(76, y + 23, 5, 3);
    ctx.fillStyle = '#9bb96d'; ctx.fillRect(77, y + 16, 2, 7); ctx.fillRect(74, y + 18, 6, 2);
  }
  if (tier === 4) {
    ctx.fillStyle = '#d07869'; ctx.fillRect(19, y + 1, 63, 2);
    ctx.fillStyle = '#e5e5ce'; ctx.fillRect(47, y + 4, 8, 5);
    ctx.fillStyle = '#d07869'; ctx.fillRect(48, y + 5, 5, 1);
    ctx.fillStyle = '#71614e'; ctx.fillRect(75, y + 21, 7, 5);
    ctx.fillStyle = '#67cbb2'; ctx.fillRect(76, y + 22, 1, 3); ctx.fillRect(79, y + 22, 1, 3);
  }
  if (tier === 5) {
    ctx.fillStyle = '#b39ae8'; ctx.fillRect(19, y + 1, 63, 1);
    ctx.fillStyle = '#81b9e7'; ctx.fillRect(20, y + 26, 62, 1);
    ctx.fillStyle = '#172321'; ctx.fillRect(48, y + 3, 9, 6);
    ctx.fillStyle = '#67cbb2'; ctx.fillRect(49, y + 4, 3, 2); ctx.fillRect(53, y + 6, 3, 1);
  }
  if (tier === 6) {
    ctx.fillStyle = '#b5b9a2'; ctx.fillRect(43, y + 2, 1, 5); ctx.fillRect(44, y + 7, 7, 1); ctx.fillRect(64, y + 10, 6, 1);
    ctx.fillStyle = '#efbc6f'; ctx.fillRect(74, y + 5, 3, 4); ctx.fillRect(24, y + 2, 3, 3);
  }
  if (tier === 7) {
    for (let n = 0; n < 4; n++) {
      const x = 29 + n * 13; ctx.fillStyle = n % 2 ? '#f3a9de' : '#efbc6f'; ctx.fillRect(x, y + 4, 3, 3);
      ctx.fillStyle = '#e5e5ce'; ctx.fillRect(x + 1, y + 5, 1, 1);
    }
    const x = reduced ? 57 : 51 + Math.round(Math.sin(now / 700) * 9);
    ctx.fillStyle = '#efbc6f'; ctx.fillRect(x, y + 9, 2, 2); ctx.fillRect(x + 3, y + 8, 2, 2);
    ctx.fillStyle = '#263533'; ctx.fillRect(x + 2, y + 9, 1, 2);
  }
  if (tier === 8) {
    ctx.fillStyle = '#a0b2ba'; ctx.fillRect(20, y + 1, 62, 1); ctx.fillRect(20, y + 25, 62, 1);
    ctx.fillStyle = '#293b47'; ctx.fillRect(48, y + 4, 14, 4);
    ctx.fillStyle = '#9cdfa5'; ctx.fillRect(50, y + 5, 2, 2);
    ctx.fillStyle = '#efbc6f'; ctx.fillRect(55, y + 5, 2, 2);
    ctx.fillStyle = '#db6c65'; ctx.fillRect(60, y + 5, 1, 2);
  }
  if (tier === 9) {
    ctx.fillStyle = '#e5e5ce'; ctx.fillRect(48, y + 4, 9, 3); ctx.fillRect(51, y + 2, 4, 2);
    ctx.fillRect(72, y + 5, 1, 3); ctx.fillRect(71, y + 6, 3, 1);
    ctx.fillStyle = '#efbc6f'; ctx.fillRect(40, y + 3, 1, 1);
  }
}
function drawRoomWindow(tier, y) {
  ctx.fillStyle = tier === 3 || tier === 7 ? '#947657' : '#222e35'; ctx.fillRect(85, y + 3, 11, 18);
  ctx.fillStyle = '#769fac'; ctx.fillRect(87, y + 5, 7, 13);
  ctx.fillStyle = '#425d6c'; ctx.fillRect(87, y + 14, 3, 4); ctx.fillRect(91, y + 10, 3, 8);
  if (tier === 0) {
    ctx.fillStyle = '#bfbca4'; ctx.fillRect(87, y + 5, 7, 13);
    ctx.fillStyle = '#6a7163'; for (let row = 7; row < 17; row += 3) ctx.fillRect(88, y + row, 5, 1);
    ctx.fillStyle = '#1c282b'; ctx.fillRect(92, y + 13, 2, 4);
  }
  if (tier === 8) {
    ctx.fillStyle = '#a0b2ba'; ctx.fillRect(85, y + 5, 11, 13);
    ctx.fillStyle = '#172d3d'; ctx.fillRect(87, y + 7, 7, 9);
    // Stepped circular porthole, kept pixel-aligned.
    ctx.fillStyle = G.BATHROOMS[tier].wall;
    ctx.fillRect(85, y + 5, 2, 2); ctx.fillRect(94, y + 5, 2, 2); ctx.fillRect(85, y + 16, 2, 2); ctx.fillRect(94, y + 16, 2, 2);
    ctx.fillStyle = '#e5e5ce'; ctx.fillRect(90, y + 9, 1, 1);
  }
  if (tier === 9) {
    ctx.fillStyle = '#a8cbd8'; ctx.fillRect(87, y + 5, 7, 13);
    ctx.fillStyle = '#e5e5ce'; ctx.fillRect(87, y + 12, 6, 3); ctx.fillRect(89, y + 10, 3, 2);
  }
}
function drawGuard(y, down, now) {
  ctx.save();
  if (down) { ctx.translate(81, y + 24); ctx.rotate(Math.PI / 2); ctx.translate(-81, -y - 24); }
  ctx.fillStyle = '#4b6385'; ctx.fillRect(77, y + 7, 7, 3); ctx.fillRect(76, y + 10, 9, 1);
  ctx.fillStyle = '#ddb38a'; ctx.fillRect(78, y + 11, 5, 5);
  ctx.fillStyle = '#4b6385'; ctx.fillRect(77, y + 16, 7, 7);
  ctx.fillStyle = '#efbc6f'; ctx.fillRect(81, y + 17, 1, 2);
  ctx.fillStyle = '#1b2726'; ctx.fillRect(78, y + 23, 2, 3); ctx.fillRect(82, y + 23, 2, 3); ctx.restore();
  if (down && !reduced) { ctx.fillStyle = '#efbc6f'; ctx.fillRect(79 + Math.round(Math.sin(now / 100) * 3), y + 8, 2, 2); }
}
function drawRider(y, now, moving) {
  const celebrating = !reduced && now - rewardAt < 1000;
  const bob = moving ? 0 : celebrating ? -Math.round(3 * Math.abs(Math.sin((now - rewardAt) / 100))) : !reduced && now - inputAt < 180 ? -1 : 0;
  if (moving) {
    ctx.fillStyle = G.bathroom(flight.from).toilet;
    ctx.fillRect(24, y + 13, 7, 6); ctx.fillRect(23, y + 20, 10, 3); ctx.fillRect(26, y + 23, 5, 3);
    ctx.fillStyle = '#9cdfa5'; ctx.fillRect(25, y + 26, 3, reduced ? 3 : 5 + Math.floor(now / 80) % 4);
  }
  ctx.fillStyle = '#343332'; ctx.fillRect(24, y + 3 + bob, 8, 4);
  ctx.fillStyle = '#ddb38a'; ctx.fillRect(25, y + 7 + bob, 6, 6);
  ctx.fillStyle = '#aeca91'; ctx.fillRect(24, y + 13 + bob, 8, 8);
  ctx.fillStyle = '#1b2726'; ctx.fillRect(27, y + 20, 8, 3); ctx.fillRect(31, y + 22, 3, 4); ctx.fillRect(32, y + 12 + bob, 4, 6);
  ctx.fillStyle = '#9cdfa5'; ctx.fillRect(33, y + 13 + bob, 2, 2);
  drawCostume(ctx, state.equipped, 24, y + 3 + bob);
  if (!moving && now - inputAt < 300) { ctx.fillRect(37, y + 7, 1, 2); ctx.fillRect(39, y + 5, 1, 2); }
}
function drawScene(now) {
  let progress = 0;
  let riderFloor = state.floor;
  if (flight) {
    const elapsed = now - flight.start, shotEnd = reduced ? 120 : 1200, riseStart = reduced ? 200 : 1550;
    progress = Math.min(1, elapsed / shotEnd);
    flight.phase = elapsed < shotEnd ? 'throw' : elapsed < riseStart ? 'impact' : 'rise';
    if (elapsed >= shotEnd && !flight.impacted) {
      flight.impacted = true;
      $('caption').textContent = '目标保安倒下 · 马桶准备起飞';
    }
    if (flight.phase === 'throw') viewFloor = flight.from + (flight.to - flight.from) * progress * progress * (3 - 2 * progress);
    else if (flight.phase === 'impact') viewFloor = flight.to;
    else {
      const t = Math.min(1, (elapsed - riseStart) / (flight.duration - riseStart - 200));
      riderFloor = flight.from + (flight.to - flight.from) * t;
      viewFloor = riderFloor;
      $('caption').textContent = '马桶升天 · 顶开楼板前往 ' + flight.to + 'F';
    }
    if (elapsed >= flight.duration) {
      lastRewards = G.land(state).rewards; unlockAt = now;
      if (lastRewards.length) rewardAt = now;
      flight = null; stopHold(); viewFloor = riderFloor = state.floor;
      save(); renderBag(); renderHUD();
      $('caption').textContent = '抵达 ' + state.floor + 'F · 马桶已停稳';
      say('目标层及以下已开放，外观到衣柜手动穿戴。');
    }
  }
  ctx.clearRect(0, 0, 124, 130);
  const base = Math.floor(viewFloor) - 1;
  for (let k = -1; k < 5; k++) {
    const f = base + k; if (f < 1 || f > G.MAX_FLOOR) continue;
    const y = Math.round(92 - (f - viewFloor) * 30), theme = G.bathroom(f), tier = theme.tier;
    const locked = f > state.unlockedFloor;
    ctx.save();
    ctx.globalAlpha = Math.max(.15, Math.min(1, (y + 28) / 100));
    ctx.fillStyle = theme.wall; ctx.fillRect(18, y, 80, 28);
    ctx.fillStyle = '#263533'; ctx.fillRect(18, y + 27, 80, 3);
    if (flight && flight.phase === 'rise' && f >= flight.from && f < riderFloor) {
      ctx.clearRect(21, y + 27, 17, 3);
      if (!reduced && riderFloor - f < 1) {
        ctx.fillStyle = '#947657'; ctx.fillRect(19, y + 30, 3, 2); ctx.fillRect(38, y + 32, 3, 2);
      }
    }
    ctx.fillStyle = '#a3b7a4'; ctx.font = '5px monospace'; ctx.fillText(f + 'F', 1, y + 17);
    drawRoomDecor(tier, y, now);
    for (let seat = 0; seat < 3; seat++) {
      const x = 23 + seat * 20;
      ctx.fillStyle = theme.partition; ctx.fillRect(x - 2, y, 1, 27);
      ctx.fillStyle = theme.toilet;
      if (!(flight && flight.phase === 'rise' && seat === 0 && f >= flight.from && f <= flight.to)) {
        ctx.fillRect(x + 1, y + 13, 7, 6); ctx.fillRect(x, y + 20, 10, 3); ctx.fillRect(x + 3, y + 23, 5, 3);
      }
      if (seat > 0 && !locked) { ctx.fillStyle = '#889a95'; ctx.fillRect(x + 4, y + 7, 1, 5); ctx.fillRect(x + 2, y + 9, 5, 1); }
    }
    if (!locked && now - unlockAt < 500 && !reduced) {
      ctx.fillStyle = '#9cdfa5'; ctx.fillRect(19, y + 2, 1, 24);
    }
    drawRoomWindow(tier, y);
    if (locked && !(flight && flight.impacted && f === flight.to)) {
      ctx.fillStyle = '#283237'; ctx.fillRect(86, y + 4, 9, 16);
      ctx.fillStyle = '#53665b'; for (let row = 6; row < 20; row += 3) ctx.fillRect(87, y + row, 7, 1);
      ctx.fillStyle = '#efbc6f'; ctx.fillRect(88, y + 11, 5, 2);
    }
    const targetDown = flight && flight.impacted && f === flight.to;
    if (f > 1 && (targetDown || !(state.defeatedGuards || []).includes(f))) drawGuard(y, targetDown, now);
    const reward = G.surprises(state, Math.floor((f - 1) / 20)).find(r => r.floor === f);
    if (reward && locked) {
      for (let seat = 0; seat < 3; seat++) {
        const x = 24 + seat * 20;
        ctx.save(); ctx.translate(x, y + 2); ctx.scale(.65, .65);
        drawCostume(ctx, reward.costume, 2, 5); ctx.restore();
        ctx.fillStyle = '#f3a9de'; ctx.fillRect(x, y + 11, 10, 1);
      }
    }
    const occupied = flight ? flight.from : state.floor;
    if (f === occupied && !(flight && flight.phase === 'rise')) {
      ctx.strokeStyle = '#9cdfa5'; ctx.strokeRect(18.5, y + .5, 79, 26);
      drawRider(y, now, false);
    }
    ctx.restore();
  }
  if (flight && flight.phase === 'rise') drawRider(92, now, true);
  if (charge) {
    const strength = charge.steps / 5;
    const size = reduced ? 12 : 8 + strength * 16;
    const y = 103;
    icon(projectile, charge.id, now);
    ctx.drawImage(projectile, 44 - size / 2, y - size / 2, size, size);
  }
  if (now - rewardAt < 1400 && lastRewards.length) {
    const t = Math.max(0, (now - rewardAt) / 1400);
    ctx.save(); ctx.strokeStyle = '#efbc6f'; ctx.lineWidth = 1;
    ctx.strokeRect(21 - t * 5, 93 - t * 5, 20 + t * 10, 26 + t * 6);
    if (!reduced) {
      ctx.fillStyle = '#efbc6f';
      for (let n = 0; n < 10; n++) {
        const angle = n * Math.PI / 5;
        ctx.fillRect(Math.round(30 + Math.cos(angle) * (9 + t * 18)), Math.round(104 + Math.sin(angle) * (8 + t * 12)), 2, 2);
      }
    }
    // Pure pixel sparkles: no acquisition banner or text overlays.
    ctx.fillStyle = '#e5e5ce';
    for (let n = 0; n < 3; n++) {
      const x = 17 + n * 13, y = 82 - (reduced ? 0 : Math.round(t * 8));
      ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 2, y, 5, 1);
    }
    ctx.restore();
  }
  effects = effects.filter(e => now - e.time < 650);
  if (now - spentAt < 450) {
    ctx.fillStyle = '#efbc6f'; ctx.font = '6px monospace'; ctx.fillText('-1', 47, 90 - (reduced ? 0 : Math.floor((now - spentAt) / 100)));
  }
  for (const e of effects) {
    const age = now - e.time, y = Math.round(96 - (e.floor - viewFloor) * 30 - (reduced ? 0 : age / 80));
    ctx.fillStyle = '#9cdfa5'; ctx.font = '6px monospace'; ctx.fillText('+1', 28, y);
  }
  if (flight) {
    if (flight.phase === 'throw') {
      const t = progress;
      // Flight begins next to the first seat, exits the window then curves back to the target window.
      const x = 44 + 46 * t + Math.sin(t * Math.PI) * 31;
      const worldFloor = flight.from + (flight.to - flight.from) * t;
      const y = 103 - (worldFloor - viewFloor) * 30;
      icon(projectile, flight.id, now);
      if (!reduced) {
        for (let n = 5; n >= 1; n--) {
          const p = Math.max(0, t - n * .025), px = 44 + 46 * p + Math.sin(p * Math.PI) * 31;
          const py = 103 - (flight.from + (flight.to - flight.from) * p - viewFloor) * 30;
          ctx.save(); ctx.globalAlpha = .1 + (6 - n) * .06; ctx.fillStyle = itemInfo(flight.id).quality.color;
          ctx.fillRect(Math.round(px), Math.round(py), 3, 3); ctx.restore();
        }
      }
      const size = reduced ? 12 : 24 - 16 * t;
      ctx.save(); ctx.translate(x, y); if (!reduced) ctx.rotate(t * Math.PI * 4);
      ctx.drawImage(projectile, -size / 2, -size / 2, size, size); ctx.restore();
    } else if (flight.phase === 'impact' && !reduced) {
      const spread = Math.min(1, (now - flight.start - 1200) / 350);
      ctx.fillStyle = '#a9d5e0';
      for (let n = 0; n < 6; n++) ctx.fillRect(Math.round(90 + Math.cos(n) * spread * 15), Math.round(103 + Math.sin(n) * spread * 14), 2, 2);
    }
  }
}
function frame(now) {
  const canOperate = !document.hidden && $('panel').hidden && !$('testDialog').open && !$('resetDialog').open && !flight;
  if (canOperate && charge && (heldPointer !== null || heldKey !== null) && now >= heldDue) {
    heldDue = now + 400; advancePaidCharge();
  }
  if (state.autoMode && heldPointer === null && heldKey === null && canOperate && now >= nextAuto && state.floor < G.MAX_FLOOR) {
    nextAuto = now + 400;
    if (charge) advancePaidCharge();
    else if (state.selected !== null && state.bag[state.selected]) beginCharge();
    else if (state.coins >= G.cost(state.floor)) {
      const id = G.draw(state);
      if (id !== null) { say('自动抽到 ' + itemInfo(id).name); save(); renderBag(); renderHUD(); beginCharge(); }
    }
  }
  if (!$('widget').classList.contains('compact') || flight) drawScene(now);
  $('coinDisplay').classList.toggle('flash', now - inputAt < 300);
  if (state.selected !== null) icon($('selectedIcon'), state.selected, now);
  if (now - lastSave > 3000) { save(); lastSave = now; }
  requestAnimationFrame(frame);
}
renderBag(); renderHUD(); save(); requestAnimationFrame(frame);
