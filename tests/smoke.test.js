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
js = js.replace(/\}\)\(\);\s*$/, 'window.__dbg={newRun,newRelics,openMap,stageAgain,carryMate,debugBattle,offerMates,goNode,startBattle,nextNodes,makeMap,battleDef,update,draw,deploy,upgradePurse,fireCannon,spawn,newBattle,hitBase,mateCard,' +
  'FLOORS,COLS,RELICS,UNITS,SLAM,UNIT_ORDER,PURSE,LV_MUL,get run(){return run},set run(v){run=v},get G(){return G},get mode(){return mode},get picks(){return picks}};\n})();');

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

// バランスしらべ（BALANCE=1 の ときは ここから tests/balance.js だけ）
if (process.env.BALANCE) return require('./balance.js')({ D, fight, kid, seeded, store, SAVE, els });

// なにもしないと さいしょの たたかいで ハートが なくなるまで まけて、ぼうけんが おわる（セーブも きえる）
let r = playRun(null);
assert.strictEqual(r.mode, 'lose', 'なにもしないのに まけない');
assert.strictEqual(r.run.hearts, 0);
assert.strictEqual(r.log.length, 3, 'ハートの 数だけ たたかって いない: ' + r.log.join(' '));
assert.strictEqual(store[SAVE], undefined, 'まけたのに セーブが のこっている');
assert.ok(!els.stageName.innerHTML.includes('❤️'), 'まけたのに 上の ハートが へらない: ' + els.stageName.innerHTML);
console.log('ok  なにもしないと まける');

// ふつうの 7さいの あそびかたで、ボスまで いって かてる（ハートを つかっても よい）。
// いれかえで からぴよを おうちに かえして まける ことも あるので、ステージ1 の クマは 20ぼうけん中 13いじょう、3つの ステージ ぜんぶは 8いじょう
// （この たねの 40ぼうけんで クマ 33・ぜんぶ 24。2026-11-23）。6ぼうけん だと、たたかいの ながさが かわって 乱数が ずれる だけで おちたので 20 に した
let wins = 0, stage1 = 0;
for (let s = 1; s <= 20; s++) {
  Math.random = seeded(s * 101);
  r = playRun(kid);
  const party = D.UNIT_ORDER.filter(k => r.run.party[k]).map(k => k + r.run.party[k]).join(' ');
  console.log((r.mode === 'win' ? 'ok  ' : 'NG  ') + 'ぼうけん' + s + '：' + r.log.join(' → ') + '｜' + party + '｜レリック ' + r.run.relics.length + '｜❤️' + r.run.hearts);
  if (r.mode === 'win') wins++;
  if (r.mode === 'win' || r.run.act >= 1) stage1++;
  assert.ok(Object.keys(r.run.party).length <= r.run.slots, 'なかまが わくより おおい');
}
assert.ok(stage1 >= 13, 'ふつうの あそびかたで クマに かてない ぼうけんが おおい: ' + stage1 + '/20');
assert.ok(wins >= 8, 'ふつうの あそびかたで さいごまで いけない ぼうけんが おおい: ' + wins + '/20');
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

// はじけまめ：まめぴよが いる ときだけ でる。まめが あたると、ちかくの てき 1たいにも はんぶん（はなれた てきには とばない）
D.run.relics = []; D.run.party = { piyo: 1 };
assert.ok(!D.newRelics().includes('hajike'), 'まめぴよが いないのに はじけまめが でる');
D.run.party.mame = 1;
assert.ok(D.newRelics().includes('hajike'), 'まめぴよが いるのに はじけまめが でない');
for (const rel of [[], ['hajike']]) {
  D.newRun(); D.openMap(); D.run.relics = rel; D.run.party.mame = 1;
  D.startBattle(D.nextNodes()[0], 'fight');
  D.G.waves.length = 0;
  const mm = D.spawn('ally', 'mame'), fs3 = [0, 40, 300].map(dx => { const f = D.spawn('foe', 'hebi'); f.x = mm.x + 150 + dx; f.speed = 0; return f; });
  for (let n = 0; n < 30 * 1.5; n++) D.update(1 / 30);
  const lost = fs3.map(f => Math.round(f.max - f.hp)).join(' ');
  assert.strictEqual(lost, rel.length ? '24 12 0' : '24 0 0', 'はじけまめの ダメージが おかしい: ' + lost);
}
console.log('ok  はじけまめ');

// クマの 大わざ：かならず SLAM.warn びょう てを あげてから たたく。てを あげて いる あいだに コケコッコー！で ふっとばすと とまる
for (const stopIt of [false, true]) {
  D.newRun(); D.openMap(); D.startBattle(D.nextNodes()[0], 'fight');
  D.G.waves.length = 0;
  const kuma = D.spawn('foe', 'kuma', 1.3), kara = D.spawn('ally', 'kara');
  kara.x = kuma.x - 40; kara.speed = 0;
  let upT = 0, slams = 0, stops = 0;
  for (let n = 0; n < 30 * 14; n++) {
    const was = kuma.up;
    if (stopIt && kuma.up && upT > 0.5) { D.G.cannon = 999; D.fireCannon(); }
    D.update(1 / 30);
    if (kuma.up) { upT += 1 / 30; continue; }
    if (was && kuma.st === 'atk') { slams++; assert.ok(upT >= D.SLAM.warn - 0.08, 'てを あげずに 大わざ: ' + upT.toFixed(2)); }
    if (was && kuma.st === 'kb') stops++;
    upT = 0;
  }
  if (stopIt) assert.ok(slams === 0 && stops >= 1, 'コケコッコー！で 大わざが とまらない: ' + slams + ' ' + stops);
  else assert.ok(slams >= 1 && kara.hp < kara.max - 4 * kuma.atk, '大わざが こない: ' + slams);
}
console.log('ok  クマの 大わざ');

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
assert.ok(D.mateCard('king').includes('class="gic"></i>600') && D.mateCard('king').includes('えさばこを'), 'なかまの カードに つぶが 出ない');
console.log('ok  おしろの コケコッコー！');
// ステージ2・3 の あたらしい てき：サイは むれ（3びき）で でる。ゾウは おしかえす（kb が 1 の からぴよ・きしぴよは おされない）
Math.random = seeded(13);
D.newRun(); D.openMap();
assert.ok(!D.battleDef(5, 'fight', 0).waves.some(w => w[0] === 'sai' || w[0] === 'zou'), 'ステージ1 に あたらしい てきが いる');
D.run.act = 1;
D.startBattle(D.nextNodes()[0], 'fight');
const herd = D.G.waves.find(w => w.type === 'sai');
assert.ok(herd, 'ステージ2 に サイが いない');
herd.next = 0; D.update(1 / 30);
assert.strictEqual(D.G.ents.filter(x => x.type === 'sai').length, 3, 'サイが むれで でない');
D.run.act = 2;
D.startBattle(D.nextNodes()[0], 'fight');
assert.ok(D.G.waves.some(w => w.type === 'zou'), 'ステージ3 に ゾウが いない');
D.G.waves.length = 0;   // ほかの てきは ださない
const zou = D.spawn('foe', 'zou'), piyo = D.spawn('ally', 'piyo'), kara = D.spawn('ally', 'kara');
piyo.x = kara.x = zou.x - 30;
let pushed = false, karaPushed = false;
for (let n = 0; n < 30 * 1.5; n++) { D.update(1 / 30); pushed = pushed || piyo.st === 'kb'; karaPushed = karaPushed || kara.st === 'kb'; }
assert.ok(pushed, 'ゾウが ぴよを おしかえさない');
assert.ok(!karaPushed, 'ゾウが からぴよを おしかえした');
console.log('ok  サイの むれと ゾウ');

// ハートが なくなっても、ステージ2 から あとは その ステージの はじめから（なかま・レリック・コイン・ハートは はいった ときの まま、ちずは あたらしく）。
// ステージ1 で なくなると セーブは きえて、つぎの ぼうけんに なかまを ひとり つれて いける
Math.random = seeded(17);
D.newRun();
Object.assign(D.run, { act: 1, party: { piyo: 2, kara: 1, kokko: 2 }, relics: ['bento'], coins: 77, hearts: 4 });
D.openMap();
Object.assign(D.run, { coins: 5, hearts: 1 }); D.run.party.kokko = 3;
D.goNode(D.nextNodes()[0]); D.hitBase('foe', 1e9); fight(null);
assert.strictEqual(D.mode, 'lose'); assert.strictEqual(D.run.hearts, 0);
const back = JSON.parse(store[SAVE] || 'null');
assert.ok(back && back.act === 1 && back.path.length === 0 && back.hearts === 4 && back.coins === 77 && back.party.kokko === 2 && back.relics[0] === 'bento', 'ステージの はじめに もどらない: ' + store[SAVE]);
D.stageAgain();
assert.strictEqual(D.mode, 'map'); assert.strictEqual(D.run.act, 1);
assert.ok(D.nextNodes().every(i => D.run.map.nodes[i].r === 0), 'ステージの 1だんめから はじまらない');
D.newRun(); D.openMap();
D.run.party.kokko = 2; D.run.hearts = 1;
D.goNode(D.nextNodes()[0]); D.hitBase('foe', 1e9); fight(null);
assert.strictEqual(store[SAVE], undefined, 'ステージ1 で おわったのに セーブが のこっている');
D.carryMate();
assert.strictEqual(D.mode, 'pick'); assert.strictEqual(D.picks.length, 1, 'つれて いける なかまが おかしい');
D.picks[0].go();
assert.deepStrictEqual(D.run.party, { piyo: 1, kara: 1, kokko: 1 }, 'つれて いった なかまが いない');
assert.strictEqual(D.run.act, 0); assert.strictEqual(D.mode, 'map');
console.log('ok  やりなおしと つれて いく なかま');
// ステージ3 の とりでの たいほう：うつ まえに しらせて、てきを まんなかに 3びき おとす（ステージ1・2 には ない）
Math.random = seeded(19);
D.newRun(); D.openMap();
assert.ok(!D.battleDef(3, 'fight', 1).gun && !D.battleDef(3, 'fight', 0).gun, 'ステージ1・2 に たいほうが ある');
assert.ok(D.battleDef(3, 'fight', 2).gun && D.battleDef(8, 'boss', 2).gun, 'ステージ3 に たいほうが ない');
D.run.act = 2;
D.startBattle(D.nextNodes()[0], 'fight');
D.G.waves.length = 0;
D.G.gun.next = D.G.t + 2.5;
for (let n = 0; n < 30 * 4; n++) D.update(1 / 30);
const dropped = D.G.ents.filter(x => x.type === 'hebi' && x.side === 'foe');
assert.strictEqual(dropped.length, 3, 'たいほうで てきが 3びき おちない');
assert.ok(dropped.every(x => Math.abs(x.x - D.G.len / 2) < D.G.len * 0.2), 'まんなかに おちない: ' + dropped.map(x => Math.round(x.x)));
console.log('ok  とりでの たいほう');
// デバッグ：えらんだ ステージ・だん・なかまで たたかい、おわると デバッグに もどる。セーブには さわらない
Math.random = seeded(23);
D.newRun(); D.openMap();
const realSave = store[SAVE];
D.debugBattle({ act: 2, r: D.FLOORS, kind: 'fight', party: { king: 3, knight: 2 }, free: true });
assert.strictEqual(D.G.info.kind, 'boss'); assert.strictEqual(D.G.st.name, 'ゴリラの とりで');
assert.deepStrictEqual(D.G.slots, ['knight', 'king']);
D.update(1 / 30);
assert.ok(D.G.grain >= 1000, 'えさ むげんに ならない: ' + D.G.grain);
D.hitBase('ally', 1e9); fight(null);
assert.strictEqual(D.mode, 'debug', 'おわっても デバッグに もどらない: ' + D.mode);
assert.strictEqual(store[SAVE], realSave, 'デバッグで セーブが かわった');
console.log('ok  デバッグ');
console.log('ぜんぶ OK');
