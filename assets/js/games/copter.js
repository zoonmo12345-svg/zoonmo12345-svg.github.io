// 슈고콥터라거~ — 버튼 하나로 나는 횡스크롤 도트 레이싱 (최대 5명 실시간)
// 규칙: W 키(폰은 화면)를 꾹 누르면 올라가고 떼면 내려감. 앞으로는 저절로 날아감. 방해물에 박으면 방해물이 부서지고 체력이 깎이며 느려짐.
// 안 박고 계속 날면 속도가 점점 올라감(흐름). 아이템: 스피드업(쌓임) · 하트(체력 회복) · 별(잠깐 무적 + 급가속). 체력 0이면 잠깐 기절했다 절반 체력으로 다시 남.
// 코스 길이는 방장이 고름. 캐릭터 5종은 체력·최고 속도·가속·무게가 다름. 화면은 384x216 기준으로 계산하고 2배 크기 캔버스에 그림.
(function () {
  const VW = 384, VH = 216, SC = 2, PW = 16, PH = 16, HIT = 8, SPR = 48, MAX = 5, M = 10; // 10픽셀 = 1m
  const L_MIN = 900, L_MAX = 4500, L_STEP = 300, L_DEF = 1800, AVG = 155; // AVG = 봇 평균 속도(픽셀/초), 예상 시간 표시용
  const FLOW_T = 28, FLOW_K = .45; // 안 박고 FLOW_T 초 날면 속도 +45%
  const SND = 'assets/snd/', BGM = SND + 'copter-bgm.mp3';
  const FX = { hit: SND + 'hc-hit.mp3', pop: SND + 'hc-pop.mp3', speed: SND + 'hc-speed.mp3', heal: SND + 'hc-heal.mp3', star: SND + 'hc-star.mp3', ko: SND + 'hc-ko.mp3', wow: SND + 'hc-wow.mp3', kids: SND + 'hc-kidswow.mp3', meow: SND + 'hc-meow.mp3' };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clampL = n => clamp(Math.round((+n || L_DEF) / L_STEP) * L_STEP, L_MIN, L_MAX);
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ── 캐릭터 5종 ── up = 누를 때 올라가는 힘, dn = 뗄 때 떨어지는 힘, keep = 박았을 때 남는 속도 비율
  const CH = [
    { name: '슈고', tip: '뭐든 무난한 기본형이라거', hp: 100, vmax: 112, acc: 60, up: 430, dn: 380, keep: .4, bars: [3, 3, 3, 3] },
    { name: '근육 슈고', tip: '튼튼하고 묵직하다거. 박아도 덜 아프고 덜 느려진다거', hp: 140, vmax: 108, acc: 46, up: 350, dn: 470, keep: .62, dm: .7, bars: [5, 2, 2, 5] },
    { name: '크로메데', tip: '가볍고 금방 빨라진다거. 대신 약하다거', hp: 80, vmax: 116, acc: 95, up: 500, dn: 300, keep: .35, bars: [2, 4, 5, 1] },
    { name: '루드라', tip: '최고 속도 1등이라거. 한번 박으면 한참 걸린다거', hp: 90, vmax: 126, acc: 36, up: 400, dn: 420, keep: .3, bars: [2, 5, 1, 4] },
    { name: '데바', tip: '날개로 천천히 내려온다거. 무적이 1.5초 더 길다거', hp: 95, vmax: 110, acc: 62, up: 440, dn: 240, fall: 110, star: 1.5, keep: .4, bars: [3, 3, 3, 2] }
  ];
  const BAR_NAMES = ['체력', '속도', '가속', '무게'];
  const IMG = CH.map((c, i) => { const im = new Image(); im.src = 'assets/img/hc/c' + i + '.png'; return im; });
  const face = i => 'assets/img/hc/f' + ((i | 0) % CH.length) + '.png';

  // ── 방해물·아이템 그림 ──
  const OB_COL = [['#b9a58e', '#8a7460', '#5e4c3e', '#2a1c12'], ['#e6fbff', '#9fdcf0', '#5aa6d6', '#1f4a78'], ['#e0b070', '#b98444', '#8a5a2a', '#3b2414']];
  const obCache = {};
  function obSpr(kind, r) {
    const key = kind + '_' + r; if (obCache[key]) return obCache[key];
    const s = r * 2 + 1, cv = mk(s, s), g = cv.getContext('2d'), col = OB_COL[kind];
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (kind === 2) { const edge = x === 0 || y === 0 || x === s - 1 || y === s - 1; g.fillStyle = edge ? col[3] : (x === y || x === s - 1 - y) ? col[2] : (y % 5 === 0) ? col[2] : x + y < s ? col[0] : col[1]; g.fillRect(x, y, 1, 1); continue; }
      const d = Math.hypot(x - r, y - r); if (d > r + .3) continue;
      const sh = (x - r) + (y - r); g.fillStyle = d > r - 1.2 ? col[3] : sh < -r * .55 ? col[0] : sh < r * .5 ? col[1] : col[2]; g.fillRect(x, y, 1, 1);
    }
    if (kind !== 2) { g.fillStyle = col[3]; g.fillRect(r - 2, r, 3, 1); g.fillRect(r, r + 1, 1, 3); g.fillRect(r + 3, r - 4, 1, 3); }
    return obCache[key] = cv;
  }
  function paint(rows, pal) { const cv = mk(rows[0].length, rows.length), g = cv.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.') return; g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); })); return cv; }
  const IT = [
    paint(['.kk...kk.', '.kGk..kGk', '..kGk..kG', '...kGk..k', '....kGk..', '...kGk..k', '..kGk..kG', '.kGk..kGk', '.kk...kk.'], { k: '#14301c', G: '#6dff8f' }),
    paint(['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'], { k: '#4a0e12', r: '#ff5a6e', w: '#ffd0d6' }),
    paint(['....k....', '...kyk...', '...kyk...', 'kkkkyykkk', 'kyyyyyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', '.kkk.kkk.'], { k: '#6b4a00', y: '#ffe14a' })
  ];

  // ── 소리: 녹음된 효과음 + 코드로 만든 짧은 소리 ──
  const S = () => Games.sound;
  let meowAt = 0;
  const meow = rate => { const n = performance.now(); if (n - meowAt < 1500) return; meowAt = n; S().play(FX.meow, .8, rate); };
  const sfx = {
    flap: () => S().tone({ f: 300, f2: 420, t: .07, type: 'sine', g: .05 }),
    hit: () => { S().play(FX.hit, .7); meow(1); },
    crush: () => S().play(FX.pop, .6),
    speed: () => S().play(FX.speed, .7),
    heal: () => S().play(FX.heal, .7),
    star: () => { S().play(FX.star, .6); S().play(FX.wow, .8); },
    ko: () => { S().play(FX.ko, .7); meowAt = 0; meow(.75); },
    count: () => S().tone({ f: 660, t: .12, type: 'sine', g: .18 }),
    go: () => { S().tone({ f: 990, t: .3, type: 'sine', g: .18 }); S().tone({ f: 1320, t: .3, type: 'sine', g: .12, at: .05 }); },
    goal: () => [784, 988, 1175].forEach((f, i) => S().tone({ f, t: .14, type: 'triangle', g: .15, at: i * .1 })),
    win: () => { S().play(FX.kids, .8); [660, 880, 1100, 1320].forEach((f, i) => S().tone({ f, t: .16, type: 'triangle', g: .12, at: i * .11 })); }
  };

  // ── 게임 한 판 ──
  function makeSim(roster, hooks = {}, opt = {}) {
    const len = clampL(opt.len), L = len * M, rand = rng(opt.seed || 1);
    const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
    const ceil = x => 8 + 6 * (Math.sin(x * .011 + ph[0]) + 1) + 4 * (Math.sin(x * .031 + ph[1]) + 1);
    const floor = x => VH - 10 - 7 * (Math.sin(x * .009 + ph[2]) + 1) - 4 * (Math.sin(x * .027 + ph[3]) + 1);
    const obs = [], items = [];
    const addOb = (x, y, r, kind) => { const o = { x, y, r, kind, dmg: Math.round(8 + r * .9), dead: 0, amp: 0, w: 0, ph: 0 }; if (rand() < .18) { o.amp = 12 + rand() * 18; o.w = 1.2 + rand() * 1.4; o.ph = rand() * 6.28; } obs.push(o); return o; };
    for (let x = 520; x < L - 300;) {
      const top = ceil(x) + 12, bot = floor(x) - 12, kind = Math.floor(rand() * 3), r = 9 + Math.floor(rand() * 8);
      if (rand() < .1) { const gap = top + 36 + rand() * (bot - top - 72), a = addOb(x, (top + gap - 34) / 2, 12, kind), b = addOb(x + 1, (gap + 34 + bot) / 2, 12, kind); a.amp = b.amp = 0; }
      else addOb(x, top + r + rand() * (bot - top - 2 * r), r, kind);
      x += 190 + rand() * 190;
    }
    for (let x = 340; x < L - 150;) {
      const q = rand(), kind = q < .5 ? 0 : q < .82 ? 1 : 2; let ix = x;
      for (let t = 0; t < 3 && obs.some(o => Math.abs(o.x - ix) < 34); t++) ix += 36;
      const top = ceil(ix) + 20, bot = floor(ix) - 20;
      items.push({ x: ix, y: top + rand() * (bot - top), kind, got: {} });
      x = ix + 200 + rand() * 200;
    }
    items.sort((a, b) => a.x - b.x);
    const n = roster.length;
    const ents = roster.map((r, i) => { const c = CH[(r.ch | 0) % CH.length], y = n > 1 ? 40 + i * (120 / (n - 1)) : 100; return { ...r, ch: (r.ch | 0) % CH.length, c, x: -i * 4, y, vy: 0, spd: 0, hp: c.hp, stacks: 0, flow: 0, star: 0, inv: 0, ko: 0, hurt: 0, hold: false, fin: 0, gone: false, oi: 0, ii: 0, tx: -i * 4, ty: y, ai: { t: 0, off: 0, skill: .72 + Math.random() * .22, salt: Math.floor(Math.random() * 1000), hold: false } }; });
    const sim = { len, L, ceil, floor, obs, items, ents, fx: [], time: 0, cam: -VW * .3, go: false, over: false, first: 0, rank: null };
    const oy = o => o.amp ? o.y + Math.sin(sim.time * o.w + o.ph) * o.amp : o.y;
    sim.oy = oy;
    const spark = (x, y, col, k, sp) => { if (Math.abs(x - sim.cam - VW / 2) > VW) return; for (let i = 0; i < k; i++) sim.fx.push({ x, y, vx: rnd(-sp, sp) + 30, vy: rnd(-sp, sp * .6), t: 0, life: rnd(.3, .7), col: col[Math.floor(Math.random() * col.length)], s: Math.random() < .4 ? 3 : 2 }); };
    sim.smash = j => { const o = obs[j]; if (!o || o.dead) return false; o.dead = sim.time || .001; spark(o.x, oy(o), OB_COL[o.kind], 14, 80); return true; };
    sim.finish = e => { if (!sim.first) sim.first = sim.time; if (hooks.onFinish) hooks.onFinish(e); };
    sim.place = () => ents.slice().sort((a, b) => (a.gone - b.gone) || ((b.fin ? 1 : 0) - (a.fin ? 1 : 0)) || (a.fin && b.fin ? a.fin - b.fin : b.x - a.x));
    sim.focus = () => ents.find(e => e.kind === 'me') || ents.slice().sort((a, b) => b.x - a.x)[0];
    sim.top = e => e.c.vmax * (1 + .05 * e.stacks) * (1 + FLOW_K * e.flow);

    function fly(e, dt, hold) {
      const c = e.c, mine = e.kind === 'me';
      if (e.star > 0) e.star -= dt; if (e.inv > 0) e.inv -= dt; if (e.hurt > 0) e.hurt -= dt;
      if (e.ko > 0) {
        e.ko -= dt; e.vy += 420 * dt; e.spd *= Math.exp(-3 * dt); e.y = Math.min(floor(e.x) - PH - 1, e.y + e.vy * dt); e.x += e.spd * dt;
        if (e.ko <= 0) { e.hp = Math.round(c.hp * .5); e.inv = 1.6; e.vy = -70; }
        return;
      }
      if (mine && hold && !e.hold) sfx.flap();
      e.hold = hold;
      e.vy = clamp(e.vy + (hold ? -c.up : c.dn) * dt, -150, c.fall || 175);
      e.y += e.vy * dt;
      const cx = e.x + PW / 2, top = ceil(cx) + 1, bot = floor(cx) - PH - 1; let drag = false;
      if (e.y < top) { e.y = top; if (e.vy < 0) e.vy = 0; drag = true; }
      if (e.y > bot) { e.y = bot; if (e.vy > 0) e.vy = 0; drag = true; }
      const st = e.star > 0;
      if (drag && !st) e.flow = Math.max(0, e.flow - dt * .5); else if (!e.fin) e.flow = Math.min(1, e.flow + dt / FLOW_T);
      let target = sim.top(e);
      if (st) target *= 1.45; else if (drag) target *= .6;
      if (e.spd < target) e.spd = Math.min(target, e.spd + c.acc * (st ? 4 : 1) * dt); else e.spd += (target - e.spd) * Math.min(1, dt * 2.5);
      e.x += e.spd * dt;
      const mx = e.x + PW / 2, my = e.y + PH / 2;
      while (e.oi < obs.length && obs[e.oi].x < mx - 50) e.oi++;
      for (let j = e.oi; j < obs.length && obs[j].x < mx + 50; j++) {
        const o = obs[j]; if (o.dead) continue;
        if (Math.hypot(o.x - mx, oy(o) - my) > o.r + HIT) continue;
        sim.smash(j); if (mine && hooks.onSmash) hooks.onSmash(j);
        if (st) { if (mine) sfx.crush(); continue; }
        if (e.inv > 0) continue;
        e.hp -= o.dmg * (c.dm || 1); e.spd *= c.keep; e.stacks = Math.max(0, e.stacks - 1); e.flow = 0; e.inv = .7; e.hurt = .35;
        if (e.hp <= 0) { e.hp = 0; e.ko = 1.6; e.vy = -90; if (mine) sfx.ko(); } else if (mine) sfx.hit();
        if (mine && hooks.onHurt) hooks.onHurt();
      }
      while (e.ii < items.length && items[e.ii].x < mx - 40) e.ii++;
      for (let j = e.ii; j < items.length && items[j].x < mx + 40; j++) {
        const it = items[j]; if (it.got[e.id] || Math.hypot(it.x - mx, it.y - my) > 17) continue;
        it.got[e.id] = 1;
        if (it.kind === 0) { e.stacks = Math.min(5, e.stacks + 1); e.spd += 22; if (mine) sfx.speed(); }
        else if (it.kind === 1) { e.hp = Math.min(c.hp, e.hp + 30); if (mine) sfx.heal(); }
        else { e.star = 4 + (c.star || 0); if (mine) sfx.star(); }
        spark(it.x, it.y, it.kind === 0 ? ['#6dff8f', '#fff'] : it.kind === 1 ? ['#ff5a6e', '#fff'] : ['#ffe14a', '#fff'], 8, 60);
      }
      if (!e.fin && e.x >= L) { e.fin = sim.time; sim.finish(e); }
    }
    function botHold(e, dt) {
      const a = e.ai; a.t -= dt; if (a.t <= 0) { a.t = rnd(.4, 1.2); a.off = rnd(-22, 22); }
      const cx = e.x + PW / 2, cy = e.y + PH / 2;
      let ty = (ceil(cx + 40) + floor(cx + 40)) / 2 + a.off;
      for (let j = e.ii; j < items.length && items[j].x < cx + 130; j++) { const it = items[j]; if (!it.got[e.id] && it.x > cx + 6) { ty = it.y; break; } }
      if (!(e.star > 0)) for (let j = e.oi; j < obs.length && obs[j].x < cx + 30 + e.spd * .45; j++) {
        const o = obs[j]; if (o.dead || o.x < cx - 10 || ((j * 37 + a.salt) % 100) / 100 > a.skill) continue;
        const y = oy(o), need = o.r + HIT + 7; if (Math.abs(y - ty) > need && Math.abs(y - cy) > need) continue;
        const above = y - o.r - ceil(o.x), below = floor(o.x) - (y + o.r);
        ty = (cy < y && above > 34) || below < 34 ? y - o.r - 18 : y + o.r + 18; break;
      }
      a.hold = cy > ty + (a.hold ? -3 : 3);
      return a.hold;
    }
    sim.step = (dt, input) => {
      sim.time += dt;
      for (let i = sim.fx.length - 1; i >= 0; i--) { const p = sim.fx[i]; p.t += dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) sim.fx.splice(i, 1); }
      const fo = sim.focus(); if (fo) { const k = clamp(fo.spd / fo.c.vmax - 1, 0, 1), want = fo.x - VW * (.3 - .08 * k); sim.cam += (want - sim.cam) * (1 - Math.exp(-dt * 10)); }
      if (!sim.go || sim.over) return;
      for (const e of ents) {
        if (e.gone) continue;
        if (e.kind === 'me') fly(e, dt, !!input.h);
        else if (e.kind === 'bot') fly(e, dt, botHold(e, dt));
        else { e.tx += e.spd * dt; const k = Math.min(1, dt * 12); e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; if (e.star > 0) e.star -= dt; }
        if (e.star > 0 && Math.random() < dt * 30) spark(e.x, e.y + PH / 2, ['#ffe14a', '#fff', '#ff9ad5', '#7fe7ff'], 1, 30);
      }
      const live = ents.filter(e => !e.gone), me = ents.find(e => e.kind === 'me');
      if (live.every(e => e.fin) || (sim.first && sim.time > sim.first + 20) || (opt.solo && me && me.fin && sim.time > me.fin + 3)) { sim.over = true; sim.rank = sim.place(); if (hooks.onOver) hooks.onOver(sim.rank); }
    };
    return sim;
  }

  // ── 그리기 (계산은 384x216, 화면은 2배) ──
  const sky = mk(VW, VH);
  { const g = sky.getContext('2d'), band = ['#140f2e', '#1b1436', '#261a44', '#352050', '#4a2a5c', '#6a3a66', '#96506a', '#c8705e', '#e59a4e']; band.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, Math.round(i * VH / band.length), VW, Math.ceil(VH / band.length) + 1); }); const r = rng(7); for (let i = 0; i < 70; i++) { g.fillStyle = r() < .3 ? '#fff6e8' : '#b8a8e0'; g.fillRect(Math.floor(r() * VW), Math.floor(r() * VH * .6), 1, 1); } g.fillStyle = '#fff2b8'; g.beginPath(); g.arc(300, 150, 16, 0, 7); g.fill(); }
  const lines = [];
  function draw(g, sim, t, meId, dt) {
    const fo = sim.focus(), k = fo && sim.go ? clamp(fo.spd / fo.c.vmax - 1, 0, 1) : 0, starOn = fo && fo.star > 0;
    const shake = k > .55 ? (k - .55) * 2.2 : 0, cam = sim.cam + (shake ? rnd(-shake, shake) : 0), sy = shake ? rnd(-shake, shake) * .6 : 0;
    g.setTransform(SC, 0, 0, SC, 0, sy * SC); g.imageSmoothingEnabled = false; g.drawImage(sky, 0, -2, VW, VH + 4);
    for (let x = 0; x < VW; x += 2) { const wx = x + cam * .12, h = 62 + 20 * Math.sin(wx * .018) + 10 * Math.sin(wx * .047); g.fillStyle = '#3a2452'; g.fillRect(x, VH - h, 2, h + 4); }
    for (let x = 0; x < VW; x += 2) { const wx = x + cam * .3, h = 40 + 14 * Math.sin(wx * .026 + 2) + 7 * Math.sin(wx * .071); g.fillStyle = '#291838'; g.fillRect(x, VH - h, 2, h + 4); }
    const line = (wx, c1, c2) => { const x = wx - cam; if (x < -8 || x > VW) return; for (let y = 0; y < VH; y += 4) { g.fillStyle = (y >> 2) % 2 ? c1 : c2; g.fillRect(x, y, 4, 4); g.fillStyle = (y >> 2) % 2 ? c2 : c1; g.fillRect(x + 4, y, 4, 4); } };
    line(PW + 2, 'rgba(255,255,255,.25)', 'rgba(255,255,255,.08)'); line(sim.L + PW, '#fff6e8', '#1c1410');
    for (const o of sim.obs) {
      const x = o.x - cam; if (x < -20) continue; if (x > VW + 20) break; if (o.dead) continue;
      g.drawImage(obSpr(o.kind, o.r), x - o.r, sim.oy(o) - o.r);
    }
    for (const it of sim.items) {
      const x = it.x - cam; if (x < -12) continue; if (x > VW + 12) break; if (meId && it.got[meId]) continue;
      const y = it.y + Math.sin(t * 4 + it.x) * 2.5, s = 15 + Math.sin(t * 6 + it.x) * 1;
      g.drawImage(IT[it.kind], x - s / 2, y - s / 2, s, s);
    }
    for (let x = -(((cam % 2) + 2) % 2); x < VW; x += 2) {
      const wx = x + cam, c = sim.ceil(wx), f = sim.floor(wx);
      g.fillStyle = '#1c120c'; g.fillRect(x, -4, 2, c + 4); g.fillRect(x, f, 2, VH - f + 4);
      g.fillStyle = '#3b2414'; g.fillRect(x, c - 3, 2, 3); g.fillRect(x, f, 2, 3);
      g.fillStyle = '#7a5434'; g.fillRect(x, c - 1, 2, 1); g.fillRect(x, f, 2, 1);
    }
    // 캐릭터 (나를 맨 위에). 그림 두 장을 번갈아 그리고, 위아래 속도만큼 기울임
    const order = sim.ents.slice().sort((a, b) => (a.kind === 'me') - (b.kind === 'me'));
    for (const e of order) {
      if (e.gone) continue;
      const cx = e.x + PW / 2 - cam, cy = e.y + PH / 2 + Math.sin(t * 7 + e.x * .02) * 1.2;
      if (cx < -40 || cx > VW + 40) continue;
      if (e.inv > 0 && !(e.ko > 0) && Math.floor(t * 16) % 2) continue;
      const im = IMG[e.ch], st = e.star > 0, fr = Math.floor(t * (e.hold ? 11 : 6) + e.ch) % 2, ks = clamp(e.spd / e.c.vmax - 1, 0, 1);
      const rot = e.ko > 0 ? t * 9 : clamp(e.vy / 420, -.38, .38);
      const put = (dx, a) => { g.save(); g.globalAlpha = a; g.translate(cx + dx, cy); g.rotate(rot); if (im.complete && im.naturalWidth) g.drawImage(im, fr * 96, 0, 96, 96, -SPR / 2, -SPR / 2, SPR, SPR); else { g.fillStyle = '#e59a4e'; g.fillRect(-8, -8, 16, 16); } g.restore(); };
      if (st) { g.fillStyle = ['rgba(255,225,74,.4)', 'rgba(255,154,213,.4)', 'rgba(127,231,255,.4)'][Math.floor(t * 12) % 3]; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill(); }
      if ((ks > .25 || st) && !(e.ko > 0)) { const n = st ? 3 : ks > .6 ? 3 : 2; for (let i = n; i >= 1; i--) put(-i * (5 + ks * 7), .22 - i * .05); }
      put(e.hurt > 0 ? rnd(-1.5, 1.5) : 0, 1);
      if (e.kind !== 'me' && e.name) { const w = 20, hp = clamp(e.hp / e.c.hp, 0, 1); g.fillStyle = '#1c1410'; g.fillRect(cx - w / 2 - 1, cy + 23, w + 2, 4); g.fillStyle = hp > .35 ? '#6dff8f' : '#ff5a46'; g.fillRect(cx - w / 2, cy + 24, Math.round(w * hp), 2); }
    }
    for (const p of sim.fx) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.col; g.fillRect(p.x - cam, p.y, p.s, p.s); } g.globalAlpha = 1;
    // 속도감: 빨라질수록 바람 줄이 많아지고 길어짐, 가장자리가 밝아짐
    if (dt) {
      const want = starOn ? 1 : k; let spawn = want * dt * 110;
      while (spawn > 0 && lines.length < 90) { if (Math.random() < spawn) lines.push({ x: VW + rnd(0, 40), y: rnd(4, VH - 4), len: 14 + want * 46 + rnd(0, 20), v: 420 + want * 520 + rnd(0, 160), a: .12 + want * .3 }); spawn--; }
      for (let i = lines.length - 1; i >= 0; i--) { const l = lines[i]; l.x -= l.v * dt; if (l.x + l.len < 0) lines.splice(i, 1); }
    }
    for (const l of lines) { g.fillStyle = (starOn ? 'rgba(255,236,150,' : 'rgba(255,255,255,') + l.a + ')'; g.fillRect(l.x, l.y, l.len, 1); }
    if (k > .3 || starOn) { const a = starOn ? .22 : (k - .3) * .3, gr = g.createLinearGradient(0, 0, VW, 0); gr.addColorStop(0, (starOn ? 'rgba(255,225,74,' : 'rgba(160,220,255,') + a + ')'); gr.addColorStop(.35, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, -4, VW, VH + 8); }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── 화면 ──
  function render(view, ctx, opt = {}) {
    const esc = ctx.esc, toast = ctx.toast || (() => {});
    const here = opt.embed ? /^#?\/?$/ : /^#\/game\/copter/;
    view.innerHTML = `<div class="${opt.embed ? 'game game--embed' : 'page game'}">
      ${opt.embed ? '' : '<div class="ph"><div><h1>슈고콥터라거~</h1><p>버튼 하나로 나는 레이싱이라거. 꾹 누르면 올라가고 떼면 내려간다거~</p></div><div class="ph__act"><a class="btn" href="#/games">게임 목록</a></div></div>'}
      <div class="g-wrap">
        <div><div class="g-stage" id="stage"><canvas id="gc" width="${VW * SC}" height="${VH * SC}" class="fl-cv"></canvas><div class="g-tags" id="tags"></div>
            <div class="fl-me" id="mine" hidden><div class="fl-hp"><i id="hpb"></i></div><div class="fl-pips" id="pips">${'<i></i>'.repeat(5)}</div><b id="spd"></b></div>
            <div class="fl-track" id="trk" hidden></div>
            <div class="g-hud fl-hud" id="hud" hidden></div><div class="g-over" id="over" hidden></div></div>
          <div class="g-pad fl-pad" id="pad"><button data-k="h" class="g-jump">꾹 누르면 위로</button></div>
          <div class="g-bar"><label class="g-vol"><span>소리</span><input type="range" id="vol" min="0" max="100" step="1" aria-label="전체 소리 크기"><b id="volv"></b></label></div>
          <div class="g-how"><b>조작법</b>
            <ul><li><kbd>W</kbd> 꾹 누르면 위로, 떼면 아래로 (키는 이거 하나라거)</li><li>폰은 화면을 꾹 누르면 된다거</li></ul>
            <p>앞으로는 저절로 날아간다거. 안 박고 계속 날면 속도가 점점 붙는다거. 돌·얼음·상자에 박으면 부서지면서 체력이 깎이고, 붙은 속도가 날아간다거. 초록 화살표는 스피드업(5번까지 쌓임), 하트는 체력 회복, 별은 잠깐 무적에 급가속이라거. 체력이 다 떨어지면 잠깐 기절한다거. 빨간 화살표가 나라거.</p></div></div>
        <aside class="pn g-side" id="side"></aside>
      </div></div>`;
    const $ = s => view.querySelector(s), cv = $('#gc'), g = cv.getContext('2d'), side = $('#side'), over = $('#over'), tags = $('#tags'), hud = $('#hud'), trk = $('#trk'), mine = $('#mine'), hpb = $('#hpb'), pips = $('#pips').children, spdEl = $('#spd');
    const input = { h: false };
    let sim = null, mode = 'demo', room = null, lobby = null, rooms = [], alive = true, last = 0, sendT = 0, countdown = 0, shown = '', playing = false, me = Games.me();
    const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
    let len = clampL(ssGet('shugo_clen') || L_DEF), ch = clamp(parseInt(ssGet('shugo_cch')) || 0, 0, CH.length - 1);
    const setLen = n => { len = clampL(n); ssSet('shugo_clen', len); };
    const mins = n => { const m = Math.round(n * M / AVG / 30) / 2; return '약 ' + m + '분'; };

    const vol = $('#vol'), volv = $('#volv');
    vol.value = Math.round(S().vol() * 100); volv.textContent = +vol.value ? vol.value : '끔';
    vol.oninput = () => { S().setVol(vol.value / 100); volv.textContent = +vol.value ? vol.value : '끔'; };
    const unlock = () => { S().unlock(); S().bgm.prime(BGM); S().load(Object.values(FX)); };
    view.addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

    const showHud = on => { hud.hidden = trk.hidden = mine.hidden = !on; };
    function startDemo() { mode = 'demo'; playing = false; showHud(false); S().bgm.pause(); sim = makeSim([0, 1, 2, 3, 4].map(i => ({ id: 'd' + i, name: '', ch: i, kind: 'bot' })), { onOver: () => setTimeout(() => { if (mode === 'demo') startDemo(); }, 1200) }, { len: L_MIN, seed: Math.floor(Math.random() * 1e9) }); sim.go = true; tags.innerHTML = ''; }
    function startGame(roster, solo, n, seed) {
      me = Games.me(); mode = solo ? 'solo' : 'net'; playing = true; over.hidden = true; input.h = false; lines.length = 0;
      const list = roster.map(r => ({ ...r, kind: r.bot ? 'bot' : r.id === me.id ? 'me' : 'remote' }));
      sim = makeSim(list, {
        onSmash: j => { if (room && mode === 'net') room.send({ t: 'b', i: j }); },
        onFinish: e => { if (e.kind === 'me') { sfx.goal(); if (room && mode === 'net') room.send({ t: 'f', id: me.id, tm: Math.round(e.fin * 100) / 100 }); } },
        onOver: rank => showResult(rank)
      }, { len: n, seed, solo });
      tags.innerHTML = list.map(e => `<span data-id="${esc(e.id)}" class="${e.member ? 'vip' : ''}${e.kind === 'me' ? ' me' : ''}">${esc(e.name)}</span>`).join('');
      trk.innerHTML = '<b></b>' + list.map(e => `<img data-id="${esc(e.id)}" class="${e.kind === 'me' ? 'me' : ''}" src="${face(e.ch)}" alt="">`).join('');
      countdown = 3.7; shown = ''; showHud(true);
      S().bgm.play(BGM);
      $('#stage').scrollIntoView({ block: 'nearest' });
      drawSide();
    }
    const tm = s => Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60).toFixed(1);
    function showResult(rank) {
      playing = false; showHud(false); input.h = false;
      const my = rank.findIndex(e => e.id === me.id);
      if (my === 0) sfx.win();
      over.innerHTML = `<div class="g-res"><h2>${my === 0 ? '1등이라거!' : rank[0] ? esc(rank[0].name) + ' 1등' : '끝'}</h2><ol>${rank.map(e => `<li class="${e.id === me.id ? 'me' : ''}"><img class="fl-face" src="${face(e.ch)}" alt=""><span class="${e.member ? 'vip' : ''}">${esc(e.name)}</span><em class="fl-tm">${e.gone ? '나감' : e.fin ? tm(e.fin) : Math.max(1, Math.ceil((sim.L - e.x) / M)) + 'm 남음'}</em></li>`).join('')}</ol><div class="g-res__b"><button class="btn btn--gold" id="again">${mode === 'net' ? '방으로' : '한 판 더'}</button>${mode === 'solo' ? '<button class="btn" id="quit">그만하기</button>' : ''}</div></div>`;
      over.hidden = false;
      $('#again').onclick = () => { over.hidden = true; if (mode === 'net' && room) { room.update({ ready: false }); startDemo(); drawSide(); } else solo(); };
      const q = $('#quit'); if (q) q.onclick = () => { over.hidden = true; startDemo(); drawSide(); };
      drawSide(); announce();
    }
    function solo() { me = Games.me(); const rest = [0, 1, 2, 3, 4].filter(i => i !== ch); startGame([{ id: me.id, name: me.name, member: me.member, ch }, ...rest.map(i => ({ id: 'bot' + i, name: '봇 ' + CH[i].name, ch: i, bot: true }))], true, len, Math.floor(Math.random() * 1e9)); }

    // ── 방 ──
    function join(code) {
      if (room) room.leave();
      me = Games.me();
      room = Games.room('copter', code, MAX, {
        onPlayers: ps => {
          const my = ps.find(p => p.id === me.id);
          if (room && my && my.ch !== ch) room.update({ ch });
          if (room && room.isHost() && ps[0] && ps[0].len !== len) room.update({ len });
          announce();
          if (playing && mode === 'net' && sim) sim.ents.forEach(e => { if (e.kind === 'remote' && !room.players().some(p => p.id === e.id)) e.gone = true; });
          drawSide();
        },
        onFull: () => { room = null; toast('방이 꽉 찼다거 (최대 5명)', true); drawSide(); },
        onMsg: m => {
          if (m.t === 's' && !playing) startGame(m.r, false, m.len, m.seed);
          else if (!sim || mode !== 'net') return;
          else if (m.t === 'p') { const e = sim.ents.find(x => x.id === m.id); if (e && e.kind === 'remote') { e.tx = m.x; e.ty = m.y; e.spd = m.v; e.vy = m.w || 0; e.hp = m.h; e.star = m.s ? Math.max(e.star, .4) : 0; e.ko = m.k ? .3 : 0; e.inv = m.n ? .3 : 0; e.hold = !!m.u; e.stacks = m.c | 0; } }
          else if (m.t === 'b') sim.smash(m.i);
          else if (m.t === 'f') { const e = sim.ents.find(x => x.id === m.id); if (e && !e.fin) { e.fin = m.tm || sim.time; sim.finish(e); } }
        }
      });
      startDemo(); drawSide();
    }
    function announce() { if (!lobby || !room) return; if (room.isHost()) lobby.announce({ code: room.code, n: room.players().length, host: room.me.name, playing }); else lobby.quiet(); }
    function leave() { if (room) { room.leave(); room = null; } if (lobby) lobby.quiet(); startDemo(); drawSide(); }

    const lenBox = on => `<label class="field g-floors"><span>코스 길이 <b id="lnv">${len}m</b> <small id="lnm">(${mins(len)})</small></span><input type="range" id="ln" min="${L_MIN}" max="${L_MAX}" step="${L_STEP}" value="${len}" ${on ? '' : 'disabled'}></label>`;
    function bindLen(after) { const ln = $('#ln'); if (!ln) return; ln.oninput = () => { $('#lnv').textContent = ln.value + 'm'; $('#lnm').textContent = '(' + mins(+ln.value) + ')'; }; ln.onchange = () => { setLen(ln.value); if (after) after(); }; }
    const charBox = lock => `<div class="fl-pick"><span class="label">캐릭터 고르기</span><div class="fl-chars">${CH.map((c, i) => `<button class="fl-ch${i === ch ? ' on' : ''}" data-ch="${i}" ${lock ? 'disabled' : ''}><img src="${face(i)}" alt=""><span class="fl-ch__t"><b>${esc(c.name)}</b><small>${esc(c.tip)}</small>
        <span class="fl-bars">${BAR_NAMES.map((nm, j) => `<span>${nm}<i>${'<u class="on"></u>'.repeat(c.bars[j])}${'<u></u>'.repeat(5 - c.bars[j])}</i></span>`).join('')}</span></span></button>`).join('')}</div></div>`;
    function bindChars() { side.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { ch = +b.dataset.ch; ssSet('shugo_cch', ch); if (room) room.update({ ch }); drawSide(); }); }

    function drawSide() {
      me = Games.me();
      const nameBox = me.member ? `<div class="g-name"><span class="label">내 이름</span><b class="vip">${esc(me.name)}</b></div>`
        : `<label class="field"><span>내 이름 (이 게임 전용)</span><input class="input" id="gname" maxlength="10" placeholder="${esc(me.def)}" value="${esc(me.name === me.def ? '' : me.name)}" ${room ? 'disabled' : ''}></label>`;
      if (!room) {
        side.innerHTML = `<h3 class="pn__h">대기 중인 방<span>${rooms.length}개</span></h3><div class="pn__b g-menu">${nameBox}
          <div class="g-rooms">${rooms.length ? rooms.map(r => { const full = r.n >= MAX; return `<button class="g-room" data-code="${esc(r.code)}" ${full || r.playing ? 'disabled' : ''}><span class="g-room__t"><b>${esc(r.host)}의 방</b><small>${r.playing ? '게임 중' : full ? '꽉 참' : '기다리는 중'} · ${r.n}/${MAX}명</small></span><em>${r.playing || full ? '못 들어가' : '들어가기'}</em></button>`; }).join('') : '<p class="g-rooms__no">지금 대기 중인 방이 없다거.<br>방을 만들면 여기에 떠서 누구나 눌러서 들어온다거.</p>'}</div>
          <button class="btn btn--gold btn--lg" id="mk" ${Games.online() && !playing ? '' : 'disabled'}>방 만들기</button>
          <button class="btn btn--lg" id="so" ${playing ? 'disabled' : ''}>혼자 연습 (봇 4마리)</button>
          ${lenBox(!playing)}
          ${charBox(playing)}</div>`;
        const gn = $('#gname'); if (gn) gn.onchange = () => Games.setGuestName(gn.value);
        bindLen(); bindChars();
        $('#mk').onclick = () => { if (gn) Games.setGuestName(gn.value); join(Games.newCode()); };
        $('#so').onclick = () => { if (gn) Games.setGuestName(gn.value); solo(); };
        side.querySelectorAll('[data-code]').forEach(b => b.onclick = () => { if (gn) Games.setGuestName(gn.value); join(b.dataset.code); });
        return;
      }
      const ps = room.players(), host = room.isHost(), my = ps.find(p => p.id === me.id), others = ps.filter((p, i) => i > 0), allReady = others.every(p => p.ready);
      const hostLen = clampL(host ? len : (ps[0] && ps[0].len) || L_DEF);
      side.innerHTML = `<h3 class="pn__h">방 ${esc(room.code)}<span>${ps.length}/${MAX}</span></h3><div class="pn__b g-menu">
        <div class="g-players">${Array.from({ length: MAX }, (_, i) => { const p = ps[i]; return p ? `<div class="g-p"><img class="fl-face" src="${face(p.ch)}" alt=""><span class="${p.member ? 'vip' : ''}">${esc(p.name)}</span><em>${i === 0 ? '방장' : p.ready ? '준비 완료' : '준비 중'}</em></div>` : `<div class="g-p g-p--empty"><span>빈 자리</span></div>`; }).join('')}</div>
        ${playing ? '<p class="mut">게임 중</p>' : host
          ? `<button class="btn btn--gold btn--lg" id="st" ${allReady ? '' : 'disabled'}>${ps.length === 1 ? '봇이랑 시작' : allReady ? '시작' : '다들 준비하면 시작'}</button>`
          : `<button class="btn ${my && my.ready ? '' : 'btn--gold'} btn--lg" id="rd">${my && my.ready ? '준비 취소' : '준비'}</button>`}
        ${host && !playing ? lenBox(true) : `<div class="g-name"><span class="label">코스 길이 (방장이 정함)</span><b>${hostLen}m</b></div>`}
        ${charBox(playing || (!host && my && my.ready))}
        <p class="g-note">이 방은 '대기 중인 방'에 떠 있다거. 다른 사람은 게임 화면에서 방을 누르면 바로 들어온다거.</p><button class="btn btn--plain" id="lv">방 나가기</button></div>`;
      bindLen(() => room && room.update({ len })); bindChars();
      const st = $('#st'); if (st) st.onclick = () => {
        if (ps.length === 1) { solo(); return; }
        const r = ps.map(p => ({ id: p.id, name: p.name, member: p.member, ch: (p.ch | 0) % CH.length })), seed = Math.floor(Math.random() * 1e9);
        room.send({ t: 's', r, len, seed }); startGame(r, false, len, seed); announce();
      };
      const rd = $('#rd'); if (rd) rd.onclick = () => room.update({ ready: !(my && my.ready) });
      $('#lv').onclick = leave;
    }

    // ── 조작: PC 는 W 키 하나, 폰은 화면 터치 ──
    const kd = e => { if (e.code !== 'KeyW' || !playing || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; e.preventDefault(); input.h = true; };
    const ku = e => { if (e.code === 'KeyW') input.h = false; };
    const rel = () => { input.h = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', rel);
    const press = el => { const on = e => { if (!playing || e.pointerType === 'mouse') return; e.preventDefault(); input.h = true; };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('pointerleave', rel); el.addEventListener('contextmenu', e => e.preventDefault()); };
    press(cv); press($('#pad button'));

    // ── 돌리기 ──
    function frame(now) {
      if (!alive) return; requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      if (playing && countdown > 0) {
        countdown -= dt; const n = Math.ceil(countdown - .7), label = n > 0 ? String(n) : 'GO!';
        if (label !== shown) { shown = label; over.hidden = false; over.innerHTML = `<div class="g-count${n > 0 ? '' : ' g-count--go'}">${label}</div>`; if (n > 0) sfx.count(); else { sfx.go(); sim.go = true; } }
        if (countdown <= 0) over.hidden = true;
      }
      sim.step(dt, input);
      const m = sim.ents.find(e => e.kind === 'me');
      if (playing && mode === 'net' && sim.go && room && m) { sendT -= dt; if (sendT <= 0) { sendT = .12; room.send({ t: 'p', id: m.id, x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10, v: Math.round(m.spd), w: Math.round(m.vy), h: Math.round(m.hp), s: m.star > 0 ? 1 : 0, k: m.ko > 0 ? 1 : 0, n: m.inv > 0 ? 1 : 0, u: m.hold ? 1 : 0, c: m.stacks }); } }
      draw(g, sim, now / 1000, m && m.id, dt);
      const cam = sim.cam;
      tags.childNodes.forEach(el => { const e = sim.ents.find(x => x.id === el.dataset.id), x = e ? e.x + PW / 2 - cam : -99; if (!e || e.gone || x < 4 || x > VW - 4) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = (x / VW * 100) + '%'; el.style.top = (Math.max(30, e.y + PH / 2 - 24) / VH * 100) + '%'; });
      if (playing && m) {
        const place = sim.place(), rk = place.findIndex(e => e.id === m.id) + 1;
        hud.textContent = m.fin ? '골인! ' + rk + '등 · 다른 슈고 기다리는 중' : rk + '등 · ' + Math.max(0, Math.ceil((sim.L - m.x) / M)) + 'm 남음';
        mine.style.left = ((m.x + PW / 2 - cam) / VW * 100) + '%'; mine.style.top = (Math.min(VH - 22, m.y + PH / 2 + 25) / VH * 100) + '%';
        hpb.style.width = clamp(m.hp / m.c.hp * 100, 0, 100) + '%'; hpb.className = m.hp / m.c.hp > .35 ? '' : 'low';
        for (let i = 0; i < 5; i++) pips[i].className = i < m.stacks ? 'on' : '';
        spdEl.textContent = Math.round(m.spd) + ' km/h'; spdEl.className = m.star > 0 ? 'star' : m.spd > m.c.vmax * 1.25 ? 'hot' : '';
        trk.querySelectorAll('img').forEach(el => { const e = sim.ents.find(x => x.id === el.dataset.id); if (!e || e.gone) { el.style.display = 'none'; return; } el.style.left = clamp(e.x / sim.L * 100, 0, 100) + '%'; });
      }
    }
    startDemo(); drawSide(); requestAnimationFrame(frame);
    if (Games.online()) {
      lobby = Games.lobby('copter', list => { rooms = list; if (!room) drawSide(); });
      const want = new URLSearchParams(location.hash.split('?')[1] || '').get('room');
      if (want && !opt.embed) join(want.toUpperCase().slice(0, 4));
    }
    const stop = () => { if (!alive) return; alive = false; S().bgm.pause(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', rel); removeEventListener('keydown', unlock); removeEventListener('hashchange', off); if (room) room.leave(); if (lobby) lobby.close(); };
    const off = () => { if (!here.test(location.hash)) stop(); };
    addEventListener('hashchange', off);
    return { stop };
  }

  // 게임 목록에 쓸 그림: 게임 화면 한 장을 그대로 그림 (캐릭터 그림이 다 받아진 뒤에 만듦)
  let thumbUrl = '';
  function thumb() {
    if (thumbUrl) return thumbUrl;
    try { const s = makeSim([0, 1, 2, 3, 4].map(i => ({ id: 't' + i, name: '', ch: i, kind: 'bot' })), {}, { len: L_MIN, seed: 20261127 }); s.ents.forEach((e, i) => { e.x = 640 + [150, 40, 215, 95, -20][i]; e.y = [50, 150, 95, 30, 120][i]; e.spd = e.c.vmax; }); s.ents[2].star = 1; s.cam = 560; const c = mk(VW * SC, VH * SC); draw(c.getContext('2d'), s, 1.3); const u = c.toDataURL(); if (IMG.every(im => im.complete && im.naturalWidth)) thumbUrl = u; return u; } catch (e) { return ''; }
  }

  Games.add({ id: 'copter', name: '슈고콥터라거~', desc: '버튼 하나로 날아서 방해물을 뚫고 먼저 골인하는 레이싱', blurb: '버튼 하나로 나는 레이싱이라거. W 키(폰은 화면)를 꾹 누르면 올라간다거. 최대 5명.', max: MAX, live: true, get thumb() { return thumb(); }, render, makeSim });
})();
