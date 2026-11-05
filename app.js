'use strict';
const G = ToiletGame, $ = id => document.getElementById(id), KEY = 'toilet-idle-demo-v1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = G.initial(), charge = null, flight = null, lastSave = 0, viewFloor = 1;
let inputAt = -Infinity, unlockAt = -Infinity, effects = [], lastRewards = [], rewardAt = -Infinity;
function say(text) { $('notice').textContent = text; }
try {
  const raw = localStorage.getItem(KEY);
  if (raw) { state = G.restore(raw); say('进度已恢复，无自动或离线收益。'); }
} catch (e) { say('无法读取存档；当前为新局，请用导出存档备份。'); }
viewFloor = state.floor;
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
    b.style.setProperty('--quality', info.quality.color); b.disabled = !state.bag[id] || !!flight;
    b.title = info.quality.name + ' · 蓄满升 ' + G.climb(id, 2000) + ' 层';
    const c = document.createElement('canvas'); c.width = c.height = 16; if (seen) icon(c, id); b.append(c);
    const name = document.createElement('span'); name.textContent = seen ? info.name : '未收集'; b.append(name);
    const count = document.createElement('span'); count.textContent = seen ? info.quality.name + ' ×' + state.bag[id] : '?'; b.append(count);
    b.onclick = () => { if (flight) return; cancelCharge(); state.selected = id; save(); renderBag(); renderHUD(); };
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
  $('decor').textContent = ['基础卫生间','盆栽卫生间','精装卫生间','行政卫生间'][Math.min(3, Math.floor((state.floor - 1) / 10))];
  $('cost').textContent = G.cost(state.floor) + ' 摸鱼值';
  $('draw').disabled = !!flight || !!charge || state.coins < G.cost(state.floor);
  $('throw').disabled = !!flight || id === null || state.floor >= G.MAX_FLOOR;
  $('selectedName').textContent = id === null ? '先抽取产物' : itemInfo(id).name;
  const info = id === null ? null : itemInfo(id);
  $('itemToggle').classList.toggle('rainbow', info !== null && ((info.type !== 0 && info.q === 4) || info.style === 1 || info.rainbow));
  icon($('selectedIcon'), id);
  if (!charge) $('prediction').textContent = id === null ? '至少 +1 层' : '可升 ' + G.climb(id, 0) + '–' + G.climb(id, 2000) + ' 层';
  $('scene').setAttribute('aria-label', '当前 ' + state.floor + ' 层，已解锁 1 至 ' + state.unlockedFloor + ' 层，每层三席，自己在第一席。');
}
function earnInput(e) {
  if (!e.isTrusted || e.repeat || document.hidden || $('testDialog').open) return;
  G.input(state); inputAt = performance.now();
  if (effects.length >= 6) effects.shift();
  effects.push({ time: inputAt, floor: state.floor });
  save(); renderHUD();
}
// Mouse/pen/touch presses count once at pointerdown; key auto-repeat is excluded.
document.addEventListener('pointerdown', earnInput, true);
document.addEventListener('keydown', earnInput, true);
function panel() { cancelCharge(); $('panel').hidden = !$('panel').hidden; renderBag(); }
$('bagToggle').onclick = panel; $('itemToggle').onclick = panel; $('closePanel').onclick = () => { $('panel').hidden = true; };
$('collapse').onclick = () => {
  cancelCharge(); $('panel').hidden = true;
  const compact = $('widget').classList.toggle('compact');
  $('collapse').textContent = compact ? '+' : '−'; $('collapse').setAttribute('aria-label', compact ? '展开界面' : '收起界面');
};
$('draw').onclick = () => {
  if (flight || charge) return;
  const id = G.draw(state);
  if (id !== null) { const info = itemInfo(id); say('抽到 ' + info.quality.name + ' · ' + info.name + '，已选中。'); save(); renderBag(); }
  renderHUD();
};
function beginCharge() {
  if (charge || flight || state.selected === null || state.floor >= G.MAX_FLOOR) return;
  charge = { start: performance.now(), id: state.selected };
  $('caption').textContent = '按住蓄力，松手破窗；Esc 取消。'; renderHUD();
}
function cancelCharge() {
  if (!charge) return; charge = null; $('chargeFill').style.width = '0%';
  $('chargeLabel').textContent = '长按蓄力，松手投掷'; $('caption').textContent = '取消蓄力不消耗产物。'; renderHUD();
}
function releaseCharge() {
  if (!charge) return;
  const duration = performance.now() - charge.start; charge = null;
  const result = G.launch(state, duration); $('chargeFill').style.width = '0%'; $('chargeLabel').textContent = '长按蓄力，松手投掷';
  if (!result) return;
  flight = { ...result, start: performance.now(), duration: reduced ? 120 : 1200, impacted: false };
  viewFloor = result.from; save(); $('caption').textContent = '飞往 ' + result.to + 'F · 窗口仍封闭';
  say('本次升 ' + (result.to - result.from) + ' 层，产物已消耗。'); renderBag(); renderHUD();
}
$('throw').addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); beginCharge(); if (charge) $('throw').setPointerCapture(e.pointerId); });
$('throw').addEventListener('pointerup', releaseCharge);
$('throw').addEventListener('pointercancel', cancelCharge); $('throw').addEventListener('lostpointercapture', cancelCharge);
$('throw').addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) beginCharge(); } });
$('throw').addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); releaseCharge(); } });
$('throw').addEventListener('blur', cancelCharge);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { cancelCharge(); $('panel').hidden = true; } });
window.addEventListener('blur', cancelCharge);
document.addEventListener('visibilitychange', () => { cancelCharge(); save(); });
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
    cancelCharge(); state = next; viewFloor = state.floor; effects = []; lastRewards = []; rewardAt = -Infinity; save(); renderBag(); renderHUD(); say('存档已导入，无离线收益。');
  } catch (err) { say('导入失败：不是有效存档，当前进度未改变。'); }
  finally { e.target.value = ''; }
};
$('reset').onclick = () => { if (flight) { say('请等投掷结束后再重开。'); return; } cancelCharge(); $('resetDialog').showModal(); };
$('cancelReset').onclick = () => { $('resetDialog').close(); };
$('testOptions').onclick = () => {
  cancelCharge(); $('testCoins').value = Math.floor(state.coins); $('testError').textContent = '';
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
  state = G.initial(); viewFloor = 1; flight = null; effects = []; lastRewards = []; inputAt = unlockAt = rewardAt = -Infinity;
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
function drawScene(now) {
  let progress = 0;
  if (flight) {
    progress = Math.min(1, (now - flight.start) / flight.duration);
    const travel = Math.min(1, progress / .78);
    viewFloor = flight.from + (flight.to - flight.from) * travel * travel * (3 - 2 * travel);
    if (progress >= .78 && !flight.impacted) {
      lastRewards = G.land(state).rewards; flight.impacted = true; unlockAt = now;
      if (lastRewards.length) rewardAt = now;
      save(); renderBag(); renderHUD();
      $('caption').textContent = '破窗成功 · 1–' + state.unlockedFloor + 'F 全部开放';
    }
  }
  ctx.clearRect(0, 0, 124, 130);
  const base = Math.floor(viewFloor) - 1;
  for (let k = -1; k < 5; k++) {
    const f = base + k; if (f < 1) continue;
    const y = Math.round(92 - (f - viewFloor) * 30), tier = Math.min(3, Math.floor((f - 1) / 10));
    const locked = f > state.unlockedFloor;
    ctx.save();
    ctx.globalAlpha = Math.max(.15, Math.min(1, (y + 28) / 100));
    ctx.fillStyle = ['#3e514e','#4d6558','#63586b','#726246'][tier]; ctx.fillRect(18, y, 80, 28);
    ctx.fillStyle = '#263533'; ctx.fillRect(18, y + 27, 80, 3);
    ctx.fillStyle = '#a3b7a4'; ctx.font = '5px monospace'; ctx.fillText(f + 'F', 1, y + 17);
    for (let seat = 0; seat < 3; seat++) {
      const x = 23 + seat * 20;
      ctx.fillStyle = '#788c7d'; ctx.fillRect(x - 2, y, 1, 27);
      ctx.fillStyle = tier === 3 ? '#d2b578' : '#b7c7b3';
      ctx.fillRect(x + 1, y + 13, 7, 6); ctx.fillRect(x, y + 20, 10, 3); ctx.fillRect(x + 3, y + 23, 5, 3);
      if (seat > 0 && !locked) { ctx.fillStyle = '#889a95'; ctx.fillRect(x + 4, y + 7, 1, 5); ctx.fillRect(x + 2, y + 9, 5, 1); }
    }
    if (locked) {
      // Keep all seats visible. The lock marker and shutter belong to the window only.
      ctx.fillStyle = '#efbc6f'; ctx.fillRect(78, y + 5, 3, 4); ctx.fillRect(79, y + 3, 1, 3);
    } else if (now - unlockAt < 500 && !reduced) {
      ctx.fillStyle = '#9cdfa5'; ctx.fillRect(19, y + 2, 1, 24);
    }
    ctx.fillStyle = '#222e35'; ctx.fillRect(85, y + 3, 11, 18);
    ctx.fillStyle = '#769fac'; ctx.fillRect(87, y + 5, 7, 13);
    ctx.fillStyle = '#425d6c'; ctx.fillRect(87, y + 14, 3, 4); ctx.fillRect(91, y + 10, 3, 8);
    if (locked) {
      ctx.fillStyle = '#283237'; ctx.fillRect(86, y + 4, 9, 16);
      ctx.fillStyle = '#53665b'; for (let row = 6; row < 20; row += 3) ctx.fillRect(87, y + row, 7, 1);
      ctx.fillStyle = '#efbc6f'; ctx.fillRect(88, y + 11, 5, 2);
    }
    const reward = G.surprises(state, Math.floor((f - 1) / 20)).find(r => r.floor === f);
    if (reward && locked) {
      for (let seat = 0; seat < 3; seat++) {
        const x = 24 + seat * 20;
        ctx.save(); ctx.translate(x, y + 2); ctx.scale(.65, .65);
        drawCostume(ctx, reward.costume, 2, 5); ctx.restore();
        ctx.fillStyle = '#f3a9de'; ctx.fillRect(x, y + 11, 10, 1);
      }
    }
    const occupied = flight && !flight.impacted ? flight.from : state.floor;
    if (f === occupied) {
      ctx.strokeStyle = '#9cdfa5'; ctx.strokeRect(18.5, y + .5, 79, 26);
      const celebrating = !reduced && now - rewardAt < 1000;
      const bob = celebrating ? -Math.round(3 * Math.abs(Math.sin((now - rewardAt) / 100))) : !reduced && now - inputAt < 180 ? -1 : 0;
      ctx.fillStyle = '#343332'; ctx.fillRect(24, y + 3 + bob, 8, 4);
      ctx.fillStyle = '#ddb38a'; ctx.fillRect(25, y + 7 + bob, 6, 6);
      ctx.fillStyle = '#aeca91'; ctx.fillRect(24, y + 13 + bob, 8, 8);
      ctx.fillStyle = '#1b2726'; ctx.fillRect(27, y + 20, 8, 3); ctx.fillRect(31, y + 22, 3, 4); ctx.fillRect(32, y + 12 + bob, 4, 6);
      ctx.fillStyle = '#9cdfa5'; ctx.fillRect(33, y + 13 + bob, 2, 2);
      drawCostume(ctx, state.equipped, 24, y + 3 + bob);
      if (now - inputAt < 300) { ctx.fillRect(37, y + 7, 1, 2); ctx.fillRect(39, y + 5, 1, 2); }
    }
    ctx.restore();
  }
  if (charge) {
    const strength = Math.min(1, (now - charge.start) / G.MAX_CHARGE_MS);
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
  for (const e of effects) {
    const age = now - e.time, y = Math.round(96 - (e.floor - viewFloor) * 30 - (reduced ? 0 : age / 80));
    ctx.fillStyle = '#9cdfa5'; ctx.font = '6px monospace'; ctx.fillText('+1', 28, y);
  }
  if (flight) {
    if (!flight.impacted) {
      const t = Math.min(1, progress / .78);
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
    } else if (!reduced) {
      const spread = (progress - .78) / .22;
      ctx.fillStyle = '#a9d5e0';
      for (let n = 0; n < 6; n++) ctx.fillRect(Math.round(90 + Math.cos(n) * spread * 15), Math.round(103 + Math.sin(n) * spread * 14), 2, 2);
    }
    if (progress >= 1) {
      flight = null; viewFloor = state.floor;
      $('caption').textContent = '每次点击或按键，摸鱼值 +1。';
      say('抵达 ' + state.floor + 'F 第一席，另两席预留给未来好友。'); renderBag(); renderHUD();
    }
  }
}
function frame(now) {
  if (charge) {
    const ms = Math.min(2000, now - charge.start); $('chargeFill').style.width = ms / 20 + '%';
    $('chargeLabel').textContent = ms >= 2000 ? '蓄满了，松手投掷' : '蓄力 ' + (ms / 1000).toFixed(1) + ' / 2.0 秒';
    $('prediction').textContent = '预计 +' + G.climb(charge.id, ms) + ' 层';
  }
  if (!$('widget').classList.contains('compact') || flight) drawScene(now);
  $('coinDisplay').classList.toggle('flash', now - inputAt < 300);
  if (state.selected !== null) icon($('selectedIcon'), state.selected, now);
  if (now - lastSave > 3000) { save(); lastSave = now; }
  requestAnimationFrame(frame);
}
renderBag(); renderHUD(); save(); requestAnimationFrame(frame);
