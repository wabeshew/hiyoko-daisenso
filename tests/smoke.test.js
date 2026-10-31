// ひよこ だいせんそう スモークテスト（ブラウザなしで動く）
// 使い方: node tests/smoke.test.js
// index.html の <script> を取り出し、canvas / DOM / localStorage をスタブして、ぼうけんを早送りで回す。
// 最後の "})();" の直前にデバッグ用フック window.__dbg を差し込んでいる点に注意。
// Math.random は たねつきに さしかえるので、結果は 毎回 同じ。
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/\}\)\(\);\s*$/, 'window.__dbg={newRun,openMap,offerMates,goNode,startBattle,nextNodes,makeMap,battleDef,update,draw,deploy,upgradePurse,fireCannon,spawn,newBattle,hitBase,mateCard,' +
  'FLOORS,COLS,RELICS,UNITS,UNIT_ORDER,PURSE,LV_MUL,get run(){return run},set run(v){run=v},get G(){return G},get mode(){return mode},get picks(){return picks}};\n})();');

function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
Math.random = seeded(7);

// 描画の命令は 何もしないが、NaN や Infinity が わたされたら すぐ 落とす
function mkCtx() {
  return new Proxy({}, {
    get(o, p) {
      if (p in o) return o[p];
      if (p === 'measureText') return () => ({ width: 100 });
      return (...a) => { for (const v of a) if (typeof v === 'number' && !isFinite(v)) throw new Error('非有限の値: ' + String(p)); return { addColorStop() {} }; };
    },
    set(o, p, v) { if (typeof v === 'number' && !isFinite(v)) throw new Error('非有限の値: ' + String(p)); o[p] = v; return true; }
  });
}
const els = {};
function mkEl() {
  return {
    style: { setProperty() {} }, dataset: {}, hidden: false, textContent: '', innerHTML: '', scrollTop: 0, clientHeight: 400,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, setAttribute() {}, setPointerCapture() {}, appendChild() {},
    querySelector: () => mkEl(), getContext: () => mkCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 330 })
  };
}
global.window = global;
window.addEventListener = () => {};
window.devicePixelRatio = 2;
global.document = {
  hidden: false, addEventListener() {},
  getElementById: id => els[id] || (els[id] = mkEl()),
  querySelectorAll: () => [mkEl(), mkEl(), mkEl(), mkEl(), mkEl()],
  createElement: () => mkEl()
};
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
new Function(js)();
const D = window.__dbg;
const SAVE = 'hiyoko-daisenso-v2';

// ちず：どの マスも 1だんめから たどりつけて、さいごの だんまで つづいている。線は ×に こうさ しない
for (let s = 1; s <= 300; s++) {
  const { nodes, edges } = D.makeMap(seeded(s));
  const out = nodes.map((n, i) => edges.filter(e => e[0] === i).map(e => e[1]));
  const inn = nodes.map((n, i) => edges.some(e => e[1] === i));
  nodes.forEach((n, i) => {
    if (n.r > 0) assert.ok(inn[i], 'たどりつけない マス seed=' + s);
    if (n.r < D.FLOORS - 1) assert.ok(out[i].length, 'いきどまりの マス seed=' + s);
    assert.strictEqual(n.t, n.r === 0 ? 'fight' : n.r === 3 ? 'chest' : n.r === D.FLOORS - 1 ? 'rest' : n.t);
  });
  for (const [a, b] of edges) for (const [c, d] of edges) {
    const A = nodes[a], B = nodes[b], C = nodes[c], E = nodes[d];
    if (A.r === C.r && A.c < C.c) assert.ok(!(B.c > E.c), '線が こうさ している seed=' + s);
  }
  assert.ok(nodes.filter(n => n.r === 0).length >= 2, '1だんめの マスが すくない seed=' + s);
  out.forEach((o, i) => assert.ok(!o.length || o.some(j => nodes[j].t !== 'elite'), '💥しか いけない マスが ある seed=' + s));
  assert.ok(nodes.some(n => n.t === 'shop'), 'おみせが ない seed=' + s);
}
console.log('ok  ちず（300とおり）');

// 1/30 びょうずつ 進める。ときどき 描いて、描画で 落ちないかも見る。結果が出たあとの 演出も 回す
function fight(strat) {
  const dt = 1 / 30;
  for (let n = 0; n < 900 * 30 && !D.G.result; n++) {
    if (strat) strat();
    D.update(dt);
    if (n % 15 === 0) D.draw();
  }
  for (let n = 0; n < 90 && D.mode === 'playing'; n++) { D.update(dt); D.draw(); }
}
// ふつうの 7さいの あそびかた：0.7びょうごとに ボタンを おす。ひかっている（だせる）ボタンを よく おし、
// えさばこと コケコッコー！も ときどき つかう（バランスは この あそびかたで きめた。CLAUDE.md の バランス を 見る）
function kid() {
  const G = D.G;
  G._k = (G._k || 0) + 1 / 30;
  if (G._k < 0.7) return;
  G._k = 0;
  const P = D.PURSE[G.purse];
  if (G.cannon >= G.cannonCd && (G._c = (G._c || 0) + 1) > 2 && Math.random() < 0.7) { G._c = 0; D.fireCannon(); return; }
  if (P.up && G.grain >= P.up + 100 && Math.random() < 0.3) { D.upgradePurse(); return; }
  const ok = G.slots.map((k, i) => i).filter(i => G.grain >= D.UNITS[G.slots[i]].cost * G.mods.cost && !(G.cool[G.slots[i]] > 0));
  const pool = ok.length && Math.random() < 0.75 ? ok : G.slots.map((k, i) => i);
  D.deploy(pool[Math.floor(Math.random() * pool.length)]);
}
// ちずでは いちばん 左の マス、えらぶ がめんでは かえる いちばん 上（おみせで かえる ものが なければ でる。いれかえでは Lv の いちばん ひくい なかまを かえす）を えらんで、さいごまで すすむ。まけても ハートが あれば やりなおす
function playRun(strat) {
  D.newRun();
  D.openMap();
  const log = [];
  for (let guard = 0; guard < 600; guard++) {
    if (D.mode === 'map') {
      const nx = D.nextNodes();
      const i = nx.slice().sort((a, b) => a === 'boss' ? 0 : D.run.map.nodes[a].c - D.run.map.nodes[b].c)[0];
      const kind = i === 'boss' ? 'boss' : D.run.map.nodes[i].t;
      D.goNode(i);
      if (D.mode === 'playing') { fight(strat); log.push(kind + (D.mode === 'lose' ? '✗' : '')); }
      else log.push(kind);
    } else if (D.mode === 'pick' && els.pickTitle.textContent === 'だれと いれかえる？') {
      const lv = p => +p.html.match(/Lv(\d)/)[1];
      D.picks.reduce((a, p) => lv(p) < lv(a) ? p : a).go();
    } else if (D.mode === 'pick') { const p = D.picks.find(p => !p.off); if (p) p.go(); else D.picks.skip(); }
    else if (D.mode === 'lose' && D.run.hearts > 0) { D.startBattle(D.G.info.node, D.G.info.kind); fight(strat); log.push('もういちど' + (D.mode === 'lose' ? '✗' : '')); }
    else break;
  }
  return { mode: D.mode, log, run: D.run };
}

// なにもしないと さいしょの たたかいで ハートが なくなるまで まけて、ぼうけんが おわる（セーブも きえる）
let r = playRun(null);
assert.strictEqual(r.mode, 'lose', 'なにもしないのに まけない');
assert.strictEqual(r.run.hearts, 0);
assert.strictEqual(r.log.length, 3, 'ハートの 数だけ たたかって いない: ' + r.log.join(' '));
assert.strictEqual(store[SAVE], undefined, 'まけたのに セーブが のこっている');
assert.ok(!els.stageName.textContent.includes('❤️'), 'まけたのに 上の ハートが へらない: ' + els.stageName.textContent);
console.log('ok  なにもしないと まける');

// ふつうの 7さいの あそびかたで、ボスまで いって かてる（ハートを つかっても よい）。
// いれかえで からぴよを おうちに かえして まける ことも あるので、ステージ1 の クマは 6ぼうけん中 4いじょう（40ぼうけんで 31）、
// 3つの ステージ ぜんぶは 3いじょう（40ぼうけんで 24）
let wins = 0, stage1 = 0;
for (let s = 1; s <= 6; s++) {
  Math.random = seeded(s * 101);
  r = playRun(kid);
  const party = D.UNIT_ORDER.filter(k => r.run.party[k]).map(k => k + r.run.party[k]).join(' ');
  console.log((r.mode === 'win' ? 'ok  ' : 'NG  ') + 'ぼうけん' + s + '：' + r.log.join(' → ') + '｜' + party + '｜レリック ' + r.run.relics.length + '｜❤️' + r.run.hearts);
  if (r.mode === 'win') wins++;
  if (r.mode === 'win' || r.run.act >= 1) stage1++;
  assert.ok(Object.keys(r.run.party).length <= r.run.slots, 'なかまが わくより おおい');
}
assert.ok(stage1 >= 4, 'ふつうの あそびかたで クマに かてない ぼうけんが おおい: ' + stage1 + '/6');
assert.ok(wins >= 3, 'ふつうの あそびかたで さいごまで いけない ぼうけんが おおい: ' + wins + '/6');
assert.strictEqual(store[SAVE], undefined, 'クリアしたのに セーブが のこっている');

// かったら マスが すすんで、なかまを えらべて、セーブされる
Math.random = seeded(3);
D.newRun(); D.openMap();
D.goNode(D.nextNodes()[0]);
fight(kid);
assert.strictEqual(D.mode, 'pick', 'かったのに なかまを えらぶ がめんに ならない');
assert.ok(D.picks.length >= 1 && D.picks.length <= 3 && D.picks.skip, 'なかまの こうほが おかしい');
const before = JSON.stringify(D.run.party);
D.picks[0].go();
assert.notStrictEqual(JSON.stringify(D.run.party), before, 'えらんだ なかまが ふえない');
const saved = JSON.parse(store[SAVE]);
assert.strictEqual(saved.path.length, 1);
assert.strictEqual(saved.coins, 30, 'かっても コインが もらえない');
assert.deepStrictEqual(saved.party, D.run.party);
assert.strictEqual(D.mode, 'map');
console.log('ok  かったら なかまを えらべて セーブされる');

// おみせ：コインで かえる。かった ものは うりきれ。コインが たりないと かえない。でると ちずに もどる
Math.random = seeded(5);
D.newRun(); D.openMap();
D.run.coins = 120;
D.goNode(D.run.map.nodes.findIndex(n => n.t === 'shop'));
assert.strictEqual(D.mode, 'pick', 'おみせが ひらかない');
const n0 = D.picks.length;
assert.ok(n0 >= 3, 'おみせの しなものが すくない: ' + n0);
D.picks.find(p => !p.off).go();
assert.ok(D.run.coins < 120, 'かっても コインが へらない');
assert.strictEqual(D.picks.length, n0 - 1, 'かった ものが うりきれに ならない');
assert.strictEqual(JSON.parse(store[SAVE]).coins, D.run.coins, 'コインが セーブされない');
D.run.coins = 0;
const shopBefore = JSON.stringify(D.run);
D.picks[0].go();
assert.strictEqual(JSON.stringify(D.run), shopBefore, 'コインが ないのに かえた');
D.picks.skip();
assert.strictEqual(D.mode, 'map', 'おみせを でても ちずに もどらない');
console.log('ok  おみせ');

// わくが いっぱいの ときに あたらしい なかまを かうと、だれかと いれかえる（やめると なにも かわらない）。わくを かうと ふえる
Math.random = seeded(9);
D.newRun(); D.openMap();
D.run.party = { piyo: 3, kara: 3, haya: 3, mame: 3, kokko: 3 };
D.run.coins = 999;
D.goNode(D.run.map.nodes.findIndex(n => n.t === 'shop'));
const swapIn = () => D.picks.find(p => p.html.includes('いれかえ'));
assert.ok(swapIn(), 'わくが いっぱいだと あたらしい なかまが でない');
swapIn().go();
assert.strictEqual(D.picks.length, 5, 'いれかえる なかまを えらべない');
D.picks.skip();
assert.strictEqual(D.run.coins, 999, 'いれかえを やめたのに コインが へった');
assert.strictEqual(Object.keys(D.run.party).length, 5);
swapIn().go();
D.picks[0].go();
assert.ok(!D.run.party.piyo && Object.keys(D.run.party).length === 5, 'いれかえ られない: ' + JSON.stringify(D.run.party));
assert.ok(D.run.coins < 999, 'いれかえても コインが へらない');
assert.ok(!swapIn(), 'いっぱいの ときに あたらしい なかまが 2人 でた');
D.picks.find(p => p.html.includes('なかまの わく')).go();
assert.strictEqual(D.run.slots, 6, 'わくを かっても ふえない');
D.picks.skip();
assert.strictEqual(D.mode, 'map');
D.offerMates(D.openMap);
const mate2 = D.picks.find(p => p.html.includes('あたらしい なかま'));
assert.ok(mate2 && !mate2.html.includes('いれかえ'), 'わくが あいたのに いれかえに なる');
mate2.go();
assert.strictEqual(Object.keys(D.run.party).length, 6, 'あいた わくに はいらない');
assert.strictEqual(JSON.parse(store[SAVE]).slots, 6, 'わくが セーブされない');
D.newBattle(D.battleDef(0, 'fight'), { node: 0, kind: 'fight', r: 0 });
assert.strictEqual(D.G.slots.length, 6, 'たたかいで 6人 だせない');
console.log('ok  いれかえと なかまの わく');

// ボスを おいかえすと つぎの ステージ（あたらしい ちずの 1だんめから、ハートは 3つに もどる、コイン・レリック・なかまの ごほうび）。
// 3つめの ゴリラで ぜんぶ クリア
Math.random = seeded(11);
D.newRun(); D.openMap();
['クマ', 'ライオン', 'ゴリラ'].forEach((name, act) => {
  assert.strictEqual(D.run.act, act);
  D.run.hearts = 1;
  D.run.path = [D.run.map.nodes.findIndex(n => n.r === D.FLOORS - 1)];
  assert.deepStrictEqual(D.nextNodes(), ['boss']);
  D.goNode('boss');
  assert.strictEqual(D.G.st.name, name + 'の とりで');
  const coins = D.run.coins;
  D.hitBase('ally', 1e9);
  fight(null);
  if (act === 2) return;
  assert.strictEqual(D.mode, 'pick', name + 'に かっても つぎに すすまない');
  assert.strictEqual(D.run.act, act + 1);
  assert.strictEqual(D.run.path.length, 0);
  assert.strictEqual(D.run.hearts, 3, 'ハートが もどらない');
  assert.strictEqual(D.run.coins, coins + 100, 'ボスの コインが もらえない');
  assert.strictEqual(JSON.parse(store[SAVE]).act, act + 1, 'つぎの ステージが セーブされない');
  for (let n = 0; n < 5 && D.mode === 'pick'; n++) D.picks[0].go();
  assert.strictEqual(D.mode, 'map');
  assert.ok(D.nextNodes().every(i => D.run.map.nodes[i].r === 0), 'つぎの ステージが 1だんめから はじまらない');
});
assert.strictEqual(D.mode, 'win', 'ゴリラに かっても クリアに ならない');
assert.strictEqual(store[SAVE], undefined, 'クリアしたのに セーブが のこっている');
console.log('ok  3つの ステージと ボス');

// レリックと レベルが なかまに きく
D.run.relics = ['pepper', 'shell', 'coupon'];
D.run.party.piyo = 3;
D.newBattle(D.battleDef(0, 'fight'), { node: 0, kind: 'fight', r: 0 });
const e = D.spawn('ally', 'piyo'), u = D.UNITS.piyo;
assert.ok(Math.abs(e.atk - u.atk * D.LV_MUL[3] * 1.3) < 1e-9, 'こうげきが つよく ならない');
assert.ok(Math.abs(e.max - u.hp * D.LV_MUL[3] * 1.3) < 1e-9, 'HPが ふえない');
console.log('ok  レリックと レベル');

// コケコッコー！で てきが ふっとぶ
D.newRun(); D.openMap();
D.goNode(D.nextNodes()[0]);
for (let n = 0; n < 30 * 8; n++) D.update(1 / 30);
const foe = D.G.ents.find(x => x.side === 'foe' && x.st !== 'gone');
assert.ok(foe, 'てきが でていない');
D.G.cannon = 999;
D.fireCannon();
assert.strictEqual(D.G.cannon, 0);
let flew = false;
for (let n = 0; n < 30 * 1.2; n++) { D.update(1 / 30); flew = flew || foe.st === 'kb' || foe.st === 'gone'; }
assert.ok(flew, 'コケコッコー！の 波が とどいても ふっとばない: ' + foe.st);
console.log('ok  コケコッコー！');

// おしろが はんぶんを きると、おしろが じぶんで コケコッコー！（1回だけ。4ぶんの1で もう1回）
D.newRun(); D.openMap();
D.goNode(D.nextNodes()[0]);
const waves = () => D.G.fx.filter(f => f.k === 'wave').length;
D.hitBase('foe', D.G.home.max * 0.4);
assert.strictEqual(waves(), 0, 'まだ はんぶん あるのに コケコッコー！した');
D.hitBase('foe', D.G.home.max * 0.2);
D.hitBase('foe', 1);
assert.strictEqual(waves(), 1, 'おしろが はんぶんを きっても コケコッコー！しない');
D.hitBase('foe', D.G.home.max * 0.3);
assert.strictEqual(waves(), 2, 'おしろが 4ぶんの1を きっても コケコッコー！しない');
assert.ok(D.mateCard('king').includes('🌾600') && D.mateCard('king').includes('えさばこを'), 'なかまの カードに つぶが 出ない');
console.log('ok  おしろの コケコッコー！');
console.log('ぜんぶ OK');
