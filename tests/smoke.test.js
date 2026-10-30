// ひよこ だいせんそう スモークテスト（ブラウザなしで動く）
// 使い方: node tests/smoke.test.js
// index.html の <script> を取り出し、canvas / DOM / localStorage をスタブして、たたかいを早送りで回す。
// 最後の "})();" の直前にデバッグ用フック window.__dbg を差し込んでいる点に注意。
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/\}\)\(\);\s*$/, 'window.__dbg={startStage,update,draw,deploy,upgradePurse,fireCannon,STAGES,UNIT_ORDER,PURSE,unlocked,get G(){return G},get mode(){return mode},setCleared(n){cleared=n}};\n})();');

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
    style: { setProperty() {} }, dataset: {}, hidden: false, textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, setAttribute() {}, setPointerCapture() {},
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
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
new Function(js)();
const D = window.__dbg;

// 1/30 びょうずつ 進める。ときどき 描いて、描画で 落ちないかも見る。結果が出たあとの 演出も 回す
function play(i, strat, maxT) {
  D.startStage(i);
  const dt = 1 / 30;
  for (let n = 0; n < maxT * 30 && !D.G.result; n++) {
    if (strat) strat();
    D.update(dt);
    if (n % 10 === 0) D.draw();
  }
  const r = { result: D.G.result, t: Math.round(D.G.t), home: Math.round(D.G.home.hp) };
  for (let n = 0; n < 90; n++) { D.update(dt); D.draw(); }
  return r;
}
// 7さいの 子が やりそうな あそびかた：だせる なかまを かたっぱしから 出す。えさばこは つぶが あまったら 大きくする
function spam() {
  const G = D.G, P = D.PURSE[G.purse];
  if (P.up && G.grain >= P.up + 60) D.upgradePurse();
  for (let i = D.UNIT_ORDER.length - 1; i >= 0; i--) D.deploy(i);
  D.fireCannon();
}

// なにもしないと まける
let r = play(0, null, 400);
assert.strictEqual(r.result, 'lose', 'なにもしないのに まけない: ' + JSON.stringify(r));
assert.strictEqual(D.mode, 'lose');
console.log('ok  なにもしないと まける（' + r.t + 'びょう）');

// ステージを じゅんばんに クリアできて、なかまが ふえる
D.setCleared(0);
for (let i = 0; i < D.STAGES.length; i++) {
  r = play(i, spam, 900);
  assert.strictEqual(r.result, 'win', 'ステージ' + (i + 1) + ' で かてない: ' + JSON.stringify(r));
  assert.strictEqual(D.mode, 'win');
  const u = D.STAGES[i].unlock;
  if (u) assert.ok(D.unlocked(u), 'ステージ' + (i + 1) + ' の クリアで ' + u + ' が ふえない');
  console.log('ok  ステージ' + (i + 1) + '「' + D.STAGES[i].name + '」 ' + r.t + 'びょうで かち（とりごや のこり ' + r.home + '）');
}
assert.strictEqual(JSON.parse(store['hiyoko-daisenso-v1']).cleared, D.STAGES.length, 'セーブに クリアの 数が 入っていない');
console.log('ok  セーブ');

// コケコッコー！で てきが ふっとぶ
D.startStage(0);
D.G.cannon = 999;
for (let n = 0; n < 30 * 8; n++) D.update(1 / 30);
const foe = D.G.ents.find(e => e.side === 'foe' && e.st !== 'gone');
assert.ok(foe, 'てきが でていない');
D.G.cannon = 999;
D.fireCannon();
assert.strictEqual(D.G.cannon, 0);
let flew = false;
for (let n = 0; n < 30 * 1.2; n++) { D.update(1 / 30); flew = flew || foe.st === 'kb' || foe.st === 'gone'; }
assert.ok(flew, 'コケコッコー！の 波が とどいても ふっとばない: ' + foe.st);
console.log('ok  コケコッコー！');
console.log('ぜんぶ OK');
