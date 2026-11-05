'use strict';
const G = ToiletGame, $ = id => document.getElementById(id), KEY = 'toilet-idle-demo-v1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = G.initial(), charge = null, flight = null, lastSave = 0, viewFloor = 1;
let inputAt = -Infinity, unlockAt = -Infinity, effects = [];
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
  const q = Math.floor(id / 3), type = id % 3;
  return { q, type, name: G.ITEMS[type].skins[q], quality: G.QUALITIES[q] };
}
function icon(canvas, id) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 16, 16);
  if (id === null) return;
  const a = itemInfo(id);
  c.fillStyle = a.quality.color;
  if (a.type === 0) {
    c.fillRect(2, 11, 12, 3); c.fillRect(4, 7, 9, 4); c.fillRect(6, 4, 6, 3); c.fillRect(7, 2, 3, 2);
  } else if (a.type === 1) { c.fillRect(4, 2, 9, 12); }
  else {
    c.beginPath(); c.moveTo(1, 6); c.lineTo(15, 2); c.lineTo(11, 14); c.lineTo(7, 9); c.closePath(); c.fill();
  }
  if (a.q === 4) {
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
}
function renderBag() {
  const container = $('bag'); container.replaceChildren();
  for (let id = 0; id < 15; id++) {
    const info = itemInfo(id), seen = state.collection.includes(id), b = document.createElement('button');
    b.className = 'card' + (id === state.selected ? ' active' : '') + (info.q === 4 && seen ? ' rainbow' : '');
    b.style.setProperty('--quality', info.quality.color); b.disabled = !state.bag[id] || !!flight;
    b.title = info.quality.name + ' · 蓄满升 ' + G.climb(id, 2000) + ' 层';
    const c = document.createElement('canvas'); c.width = c.height = 16; if (seen) icon(c, id); b.append(c);
    const name = document.createElement('span'); name.textContent = seen ? info.name : '未收集'; b.append(name);
    const count = document.createElement('span'); count.textContent = seen ? info.quality.name + ' ×' + state.bag[id] : '?'; b.append(count);
    b.onclick = () => { if (flight) return; cancelCharge(); state.selected = id; save(); renderBag(); renderHUD(); };
    container.append(b);
  }
  $('collected').textContent = state.collection.length;
  $('probabilities').textContent = G.weights(state.floor).map((w, i) => G.QUALITIES[i].name + ' ' + w.toFixed(1) + '%').join(' / ');
}
function renderHUD() {
  const id = state.selected;
  $('coins').textContent = Math.floor(state.coins).toLocaleString(); $('floor').textContent = state.floor + 'F';
  $('decor').textContent = ['基础卫生间','盆栽卫生间','精装卫生间','行政卫生间'][Math.min(3, Math.floor((state.floor - 1) / 10))];
  $('cost').textContent = G.cost(state.floor) + ' 摸鱼值';
  $('draw').disabled = !!flight || !!charge || state.coins < G.cost(state.floor);
  $('throw').disabled = !!flight || id === null || state.floor >= G.MAX_FLOOR;
  $('selectedName').textContent = id === null ? '先抽取产物' : itemInfo(id).name;
  $('itemToggle').classList.toggle('rainbow', id !== null && itemInfo(id).q === 4);
  icon($('selectedIcon'), id);
  if (!charge) $('prediction').textContent = id === null ? '至少 +1 层' : '可升 ' + G.climb(id, 0) + '–' + G.climb(id, 2000) + ' 层';
  $('scene').setAttribute('aria-label', '当前 ' + state.floor + ' 层，已解锁 1 至 ' + state.unlockedFloor + ' 层，每层三席，自己在第一席。');
}
function earnInput(e) {
  if (!e.isTrusted || e.repeat || document.hidden) return;
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
    cancelCharge(); state = next; viewFloor = state.floor; effects = []; save(); renderBag(); renderHUD(); say('存档已导入，无离线收益。');
  } catch (err) { say('导入失败：不是有效存档，当前进度未改变。'); }
  finally { e.target.value = ''; }
};
$('reset').onclick = () => { if (flight) { say('请等投掷结束后再重开。'); return; } cancelCharge(); $('resetDialog').showModal(); };
$('cancelReset').onclick = () => { $('resetDialog').close(); };
$('confirmReset').onclick = () => {
  state = G.initial(); viewFloor = 1; flight = null; effects = []; inputAt = unlockAt = -Infinity;
  save(); renderBag(); renderHUD(); say('重新开始，赠送 60 摸鱼值。'); $('resetDialog').close();
};
const ctx = $('scene').getContext('2d'), projectile = document.createElement('canvas'); projectile.width = projectile.height = 16;
function drawScene(now) {
  let progress = 0;
  if (flight) {
    progress = Math.min(1, (now - flight.start) / flight.duration);
    const travel = Math.min(1, progress / .78);
    viewFloor = flight.from + (flight.to - flight.from) * travel * travel * (3 - 2 * travel);
    if (progress >= .78 && !flight.impacted) {
      G.land(state); flight.impacted = true; unlockAt = now; save(); renderBag(); renderHUD();
      $('caption').textContent = '破窗成功 · 1–' + state.unlockedFloor + 'F 全部开放';
    }
  }
  ctx.clearRect(0, 0, 124, 130); ctx.fillStyle = '#1c282b'; ctx.fillRect(0, 0, 124, 130);
  const base = Math.floor(viewFloor) - 1;
  for (let k = -1; k < 5; k++) {
    const f = base + k; if (f < 1) continue;
    const y = Math.round(92 - (f - viewFloor) * 30), tier = Math.min(3, Math.floor((f - 1) / 10));
    const locked = f > state.unlockedFloor;
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
      ctx.fillStyle = '#283237'; ctx.fillRect(20, y + 2, 62, 24);
      ctx.fillStyle = '#39474b'; for (let row = 4; row < 26; row += 3) ctx.fillRect(21, y + row, 60, 1);
      ctx.fillStyle = '#889a95'; ctx.fillRect(49, y + 13, 5, 5); ctx.fillRect(50, y + 10, 3, 4);
      ctx.fillStyle = '#283237'; ctx.fillRect(51, y + 11, 1, 2); ctx.fillRect(51, y + 15, 1, 2);
    } else if (now - unlockAt < 500 && !reduced) {
      ctx.fillStyle = '#9cdfa5'; ctx.fillRect(19, y + 2, 1, 24);
    }
    ctx.fillStyle = '#222e35'; ctx.fillRect(85, y + 3, 11, 18);
    ctx.fillStyle = '#769fac'; ctx.fillRect(87, y + 5, 7, 13);
    ctx.fillStyle = '#425d6c'; ctx.fillRect(87, y + 14, 3, 4); ctx.fillRect(91, y + 10, 3, 8);
    if (locked) { ctx.fillStyle = '#93b0bb'; ctx.fillRect(88, y + 7, 1, 2); ctx.fillRect(89, y + 6, 1, 1); }
    if (flight && flight.impacted && f === flight.to) {
      ctx.fillStyle = '#1c282b'; ctx.fillRect(87, y + 6, 7, 11);
      ctx.fillStyle = '#a9d5e0'; ctx.fillRect(87, y + 5, 2, 2); ctx.fillRect(92, y + 16, 2, 2);
    }
    const occupied = flight && !flight.impacted ? flight.from : state.floor;
    if (f === occupied) {
      ctx.strokeStyle = '#9cdfa5'; ctx.strokeRect(18.5, y + .5, 79, 26);
      const bob = !reduced && now - inputAt < 180 ? -1 : 0;
      ctx.fillStyle = '#343332'; ctx.fillRect(24, y + 3 + bob, 8, 4);
      ctx.fillStyle = '#ddb38a'; ctx.fillRect(25, y + 7 + bob, 6, 6);
      ctx.fillStyle = '#aeca91'; ctx.fillRect(24, y + 13 + bob, 8, 8);
      ctx.fillStyle = '#1b2726'; ctx.fillRect(27, y + 20, 8, 3); ctx.fillRect(31, y + 22, 3, 4); ctx.fillRect(32, y + 12 + bob, 4, 6);
      ctx.fillStyle = '#9cdfa5'; ctx.fillRect(33, y + 13 + bob, 2, 2);
      if (now - inputAt < 300) { ctx.fillRect(37, y + 7, 1, 2); ctx.fillRect(39, y + 5, 1, 2); }
    }
  }
  effects = effects.filter(e => now - e.time < 650);
  for (const e of effects) {
    const age = now - e.time, y = Math.round(96 - (e.floor - viewFloor) * 30 - (reduced ? 0 : age / 80));
    ctx.fillStyle = '#9cdfa5'; ctx.font = '6px monospace'; ctx.fillText('+1', 28, y);
  }
  if (flight) {
    if (!flight.impacted) {
      const t = Math.min(1, progress / .78), x = Math.round(90 + Math.sin(t * Math.PI) * 23);
      icon(projectile, flight.id); ctx.drawImage(projectile, x - 4, 99, 8, 8);
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
  if (now - lastSave > 3000) { save(); lastSave = now; }
  requestAnimationFrame(frame);
}
renderBag(); renderHUD(); save(); requestAnimationFrame(frame);
