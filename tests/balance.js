// バランスしらべ：BALANCE=1 node tests/smoke.test.js（N=40 がふつう。ONLY=ふつう,ゆっくり10 で しぼれる。40ぼうけんで 5〜10ぷん）
// smoke.test.js の じゅんび（スタブ・fight・kid）を そのまま つかう。7さいの あそびかたを まねして、
// ①1かいめの ぼうけんで どの ボスまで いけるか と ステージごとの ざこ・💥の まけ率（やりなおし なし）、
// ②ハートが なくなっても「ステージの はじめから」（3かいまで）と「つれて いく なかま」（3ぼうけんまで）で さいごまで いけるか を 出す
module.exports = ({ D, fight, kid, seeded, store, SAVE, els }) => {
  // なれていない：1.5びょうごとに てきとうな ボタン、えさばこなし、コケコッコー！は はんぶん
  function novice() {
    const G = D.G; G._k = (G._k || 0) + 1 / 30; if (G._k < 1.5) return; G._k = 0;
    if (G.cannon >= G.cannonCd && Math.random() < 0.5) { D.fireCannon(); return; }
    D.deploy(Math.floor(Math.random() * G.slots.length));
  }
  // ゆっくり N：N びょうに 1かい、だせる ボタンを おす（コケコッコー！は はんぶん）
  const slow = N => function () {
    const G = D.G; G._k = (G._k || 0) + 1 / 30; if (G._k < N) return; G._k = 0;
    if (G.cannon >= G.cannonCd && Math.random() < 0.5) { D.fireCannon(); return; }
    const ok = G.slots.map((k, i) => i).filter(i => G.grain >= D.UNITS[G.slots[i]].cost * G.mods.cost && !(G.cool[G.slots[i]] > 0));
    if (ok.length) D.deploy(ok[Math.floor(Math.random() * ok.length)]);
  };
  // ちずでは いちばん 左、えらぶ がめんでは いちばん 上（いれかえは Lv の ひくい なかまを かえす）。conts＝「ステージの はじめから」の 上限
  function play(strat, carry, conts) {
    D.newRun(carry); D.openMap();
    const fights = [[0, 0], [0, 0], [0, 0]], boss = [];
    let used = 0;
    for (let guard = 0; guard < 1500; guard++) {
      if (D.mode === 'map') {
        const nx = D.nextNodes();
        const i = nx.slice().sort((a, b) => a === 'boss' ? 0 : D.run.map.nodes[a].c - D.run.map.nodes[b].c)[0];
        const act = D.run.act, kind = i === 'boss' ? 'boss' : D.run.map.nodes[i].t;
        D.goNode(i);
        if (D.mode !== 'playing') continue;
        fight(strat);
        while (D.mode === 'lose' && D.run.hearts > 0) {
          if (kind !== 'boss') fights[act][1]++;
          D.startBattle(D.G.info.node, D.G.info.kind); fight(strat);
        }
        if (kind !== 'boss') { fights[act][0]++; if (D.mode === 'lose') fights[act][1]++; }
        else if (D.mode !== 'lose') boss[act] = true;
      } else if (D.mode === 'pick' && els.pickTitle.textContent === 'だれと いれかえる？') {
        const lv = p => +p.html.match(/Lv(\d)/)[1];
        D.picks.reduce((a, p) => lv(p) < lv(a) ? p : a).go();
      } else if (D.mode === 'pick') { const p = D.picks.find(p => !p.off); if (p) p.go(); else D.picks.skip(); }
      else if (D.mode === 'lose' && store[SAVE] && used < conts) { used++; D.stageAgain(); }
      else break;
    }
    return { win: D.mode === 'win', boss, fights, used, party: D.run.party };
  }
  const STRATS = { ふつう: kid, なれていない: novice, ゆっくり3: slow(3), ゆっくり6: slow(6), ゆっくり10: slow(10) };
  const N = +(process.env.N || 40), only = process.env.ONLY;
  for (const [name, st] of Object.entries(STRATS)) {
    if (only && !only.split(',').includes(name)) continue;
    const boss = [0, 0, 0], f = [[0, 0], [0, 0], [0, 0]];
    let one = 0, oneCp = 0, used = 0, sess = 0;
    for (let s = 1; s <= N; s++) {
      Math.random = seeded(s * 7919 + 13);
      const r = play(st, null, 0);
      r.boss.forEach((b, i) => b && boss[i]++); r.fights.forEach((x, i) => { f[i][0] += x[0]; f[i][1] += x[1]; });
      if (r.win) one++;
      Math.random = seeded(s * 7919 + 13);
      let carry = null;
      for (let a = 0; a < 3; a++) {
        const q = play(st, carry, 3);
        if (a === 0) { used += q.used; if (q.win) oneCp++; }
        if (q.win) { sess++; break; }
        carry = D.UNIT_ORDER.filter(k => q.party[k] && !['piyo', 'kara'].includes(k)).sort((x, y) => D.UNITS[y].cost - D.UNITS[x].cost)[0] || null;   // いちばん つよい なかまを つれて いく
      }
    }
    const pct = x => Math.round(100 * x[1] / Math.max(1, x[0] + x[1])) + '%';
    console.log(name.padEnd(6), '｜ボス クマ ' + boss[0] + '・ライオン ' + boss[1] + '・ゴリラ ' + boss[2] + ' /' + N,
      '｜ざこ・💥の まけ ' + f.map(pct).join(' '),
      '｜ステージの はじめから こみ ' + oneCp + '（' + used + 'かい）｜つれて いく こみ 3ぼうけんまでに ' + sess);
  }
};
