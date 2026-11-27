// 훨훨 슈고 — 버튼 하나로 나는 횡스크롤 도트 레이싱 (최대 5명 실시간)
// 규칙: 꾹 누르면 올라가고 떼면 내려감. 앞으로는 저절로 날아감. 방해물에 박으면 방해물이 부서지고 체력이 깎이며 잠깐 느려졌다 다시 가속.
// 아이템: 스피드업(기본 속도 쌓임) · 열매(체력 회복) · 별(잠깐 무적 + 급가속). 체력이 0이면 잠깐 기절했다 절반 체력으로 다시 남.
// 코스 길이는 방장이 고름(기본 1200m ≈ 2분). 캐릭터 5종은 체력·최고 속도·가속·무게가 다름.
(function () {
  const VW = 384, VH = 216, PW = 9, PH = 10, MAX = 5, M = 10; // 10픽셀 = 1m
  const L_MIN = 600, L_MAX = 3000, L_STEP = 300, L_DEF = 1200;
  const BGM = 'assets/snd/waru-bgm.mp3';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clampL = n => clamp(Math.round((+n || L_DEF) / L_STEP) * L_STEP, L_MIN, L_MAX);
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ── 캐릭터 5종 ── up = 누를 때 올라가는 힘, dn = 뗄 때 떨어지는 힘, keep = 박았을 때 남는 속도 비율
  const CH = [
    { name: '슈고', tip: '뭐든 무난한 기본형이라거', hp: 100, vmax: 112, acc: 60, up: 430, dn: 380, keep: .4, bars: [3, 3, 3, 3], wing: '#7fd0c0' },
    { name: '근육 슈고', tip: '튼튼하고 묵직하다거. 박아도 덜 느려진다거', hp: 140, vmax: 108, acc: 46, up: 350, dn: 470, keep: .62, dm: .7, bars: [5, 2, 2, 5], wing: '#f2c14e' },
    { name: '크로메데', tip: '가볍고 금방 빨라진다거. 대신 약하다거', hp: 80, vmax: 116, acc: 95, up: 500, dn: 300, keep: .35, bars: [2, 4, 5, 1], wing: '#bfe8ff' },
    { name: '루드라', tip: '최고 속도 1등이라거. 한번 박으면 한참 걸린다거', hp: 90, vmax: 126, acc: 36, up: 400, dn: 420, keep: .3, bars: [2, 5, 1, 4], wing: '#c0392b' },
    { name: '데바', tip: '날개로 천천히 내려온다거. 무적이 더 길다거', hp: 95, vmax: 110, acc: 62, up: 440, dn: 240, fall: 110, star: 1.5, keep: .4, bars: [3, 3, 3, 2], wing: '#ffffff' }
  ];
  const BAR_NAMES = ['체력', '속도', '가속', '무게'];
  const PAL = { k: '#3b2414', w: '#fff6e8', o: '#e59a4e', e: '#1c1410', n: '#e88a8a', g: '#f2c14e', c: '#2f9c8f', m: '#d9a066', r: '#d4523f', h: '#cdb8f0', s: '#ffe3cf', b: '#3fd0ff', p: '#5a2f8a', d: '#4a2a6a', y: '#ffe14a', R: '#ff3b30', H: '#6b4226', a: '#3f6fd0', A: '#dfe9ff' };
  const ART = [
    ['...cccccc...', '..cccgcccc..', '.kcccccccck.', 'kowwwwwwwwok', 'kwwewwwwewwk', 'kowwwnnwwwok', '.kwwwwwwwwk.', '..kccggcck..', '.kcccccccck.', '.kcdccccdck.', '.kcccccccck.', '..kcckkcck..', '..kwk..kwk..', '..kkk..kkk..'],
    ['...kk....kk...', '..kook..kook..', '..kowkkkkwok..', '.kowwwwwwwwok.', '.kwkewwwwekwk.', '.kowwwnnwwwok.', 'kkkwwwwwwwwkkk', 'kmmkkrrrrkkmmk', 'kmmmkmmmmkmmmk', 'kmmkmmkkmmkmmk', '.kkkmmmmmmkkk.', '...kmmkkmmk...', '...kcckkcck...', '...kkk..kkk...'],
    ['...g.gg.g...', '..khhhhhhk..', '.khhhhhhhhk.', '.khsssssshk.', '.khsbssbshk.', '.khsssssshk.', '.khhsnnshhk.', 'khhkppppkhhk', 'khkppggppkhk', '.kkpppppppk.', '..kppppppk..', '..kpdppdpk..', '.kppppppppk.', '.kkkkkkkkkk.'],
    ['k..........k', 'kk........kk', 'kdk.kkkk.kdk', '.kdkddddkdk.', '.kddddddddk.', '.kdRRddRRdk.', '.kddddddddk.', '..kdwwwwdk..', '.kkddddddkk.', 'kdkdyddydkdk', 'kdkddddddkdk', '.kkddyyddkk.', '..kddkkddk..', '..kkk..kkk..'],
    ['....kkkk....', '...kHHHHk...', '..kHHHHHHk..', '..kHsssshk..'.replace('h', 'H'), '..ksessesk..', '..kssssssk..', '...kssssk...', '..kaggggak..', '.kakaaaaakak', '.kskaaaaksk.', '..kkaaggkk..', '...kaakaak..', '...kAAkAAk..', '...kkk.kkk..']
  ];
  const WING = ['.kk...', 'kwwk..', 'kwwwk.', '.kwwwk', '..kwwk', '...kk.'];
  function paint(rows, pal) { const cv = mk(rows[0].length, rows.length), g = cv.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.') return; g.fillStyle = pal[ch] || '#f0f'; g.fillRect(x, y, 1, 1); })); return cv; }
  const SPR = ART.map(a => paint(a, PAL));
  const WSPR = CH.map(c => { const p = { k: '#3b2414', w: c.wing }; return [paint(WING, p), paint(WING.slice().reverse(), p)]; });
  const faces = {};
  const face = i => { i = (i | 0) % CH.length; if (!faces[i]) { const c = mk(48, 56), g = c.getContext('2d'), s = SPR[i]; g.imageSmoothingEnabled = false; g.drawImage(s, Math.round((48 - s.width * 4) / 2), 0, s.width * 4, 56); faces[i] = c.toDataURL(); } return faces[i]; };

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
  const IT = [
    paint(['.kk...kk.', '.kgk..kgk', '..kgk..kg', '...kgk..k', '....kgk..', '...kgk..k', '..kgk..kg', '.kgk..kgk', '.kk...kk.'].map(r => r.replace(/g/g, 'G')), { k: '#14301c', G: '#6dff8f' }),
    paint(['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'], { k: '#4a0e12', r: '#ff5a6e', w: '#ffd0d6' }),
    paint(['....k....', '...kyk...', '...kyk...', 'kkkkyykkk', 'kyyyyyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', '.kkk.kkk.'], { k: '#6b4a00', y: '#ffe14a' })
  ];

  // ── 소리 (코드로 만든 짧고 순한 소리) ──
  const S = () => Games.sound;
  const sfx = {
    flap: () => S().tone({ f: 300, f2: 420, t: .07, type: 'sine', g: .06 }),
    hit: () => { S().noise({ t: .22, g: .12, f: 1400 }); S().tone({ f: 220, f2: 80, t: .2, type: 'triangle', g: .16 }); },
    crush: () => { S().noise({ t: .12, g: .07, f: 2600 }); S().tone({ f: 700, f2: 1100, t: .08, type: 'triangle', g: .08 }); },
    speed: () => { S().tone({ f: 520, f2: 1040, t: .16, type: 'triangle', g: .14 }); },
    heal: () => { S().tone({ f: 660, t: .1, type: 'sine', g: .14 }); S().tone({ f: 880, t: .14, type: 'sine', g: .14, at: .09 }); },
    star: () => [660, 830, 990, 1320].forEach((f, i) => S().tone({ f, t: .12, type: 'triangle', g: .14, at: i * .07 })),
    ko: () => { S().tone({ f: 500, f2: 90, t: .5, type: 'triangle', g: .18 }); },
    count: () => S().tone({ f: 660, t: .12, type: 'sine', g: .18 }),
    go: () => { S().tone({ f: 990, t: .3, type: 'sine', g: .18 }); S().tone({ f: 1320, t: .3, type: 'sine', g: .12, at: .05 }); },
    goal: () => [784, 988, 1175].forEach((f, i) => S().tone({ f, t: .14, type: 'triangle', g: .15, at: i * .1 })),
    win: () => [660, 880, 1100, 1320].forEach((f, i) => S().tone({ f, t: .16, type: 'triangle', g: .16, at: i * .11 }))
  };

  // ── 게임 한 판 ──
  function makeSim(roster, hooks = {}, opt = {}) {
    const len = clampL(opt.len), L = len * M, rand = rng(opt.seed || 1);
    const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
    const ceil = x => 10 + 8 * (Math.sin(x * .011 + ph[0]) + 1) + 5 * (Math.sin(x * .031 + ph[1]) + 1);
    const floor = x => VH - 12 - 9 * (Math.sin(x * .009 + ph[2]) + 1) - 5 * (Math.sin(x * .027 + ph[3]) + 1);
    const obs = [], items = [];
    const addOb = (x, y, r, kind) => { const o = { x, y, r, kind, dmg: Math.round(8 + r * .9), dead: 0, amp: 0, w: 0, ph: 0 }; if (rand() < .2) { o.amp = 12 + rand() * 18; o.w = 1.4 + rand() * 1.6; o.ph = rand() * 6.28; } obs.push(o); return o; };
    for (let x = 420; x < L - 240;) {
      const top = ceil(x) + 12, bot = floor(x) - 12, kind = Math.floor(rand() * 3), r = 8 + Math.floor(rand() * 8);
      if (rand() < .22) { const gap = top + 26 + rand() * (bot - top - 52), a = addOb(x, (top + gap - 22) / 2, 11, kind), b = addOb(x + 1, (gap + 22 + bot) / 2, 11, kind); a.amp = b.amp = 0; }
      else addOb(x, top + r + rand() * (bot - top - 2 * r), r, kind);
      x += (72 + rand() * 92) * (1 - .25 * x / L);
    }
    for (let x = 300; x < L - 120;) {
      const q = rand(), kind = q < .5 ? 0 : q < .82 ? 1 : 2; let ix = x;
      for (let t = 0; t < 3 && obs.some(o => Math.abs(o.x - ix) < 26); t++) ix += 30;
      const top = ceil(ix) + 16, bot = floor(ix) - 16;
      items.push({ x: ix, y: top + rand() * (bot - top), kind, got: {} });
      x = ix + 170 + rand() * 170;
    }
    items.sort((a, b) => a.x - b.x);
    const n = roster.length;
    const ents = roster.map((r, i) => { const c = CH[(r.ch | 0) % CH.length], y = n > 1 ? 58 + i * (92 / (n - 1)) : 100; return { ...r, ch: (r.ch | 0) % CH.length, c, x: -i * 3, y, vy: 0, spd: 0, hp: c.hp, stacks: 0, star: 0, inv: 0, ko: 0, hurt: 0, hold: false, fin: 0, gone: false, oi: 0, ii: 0, tx: -i * 3, ty: y, ai: { t: 0, off: 0, skill: .72 + Math.random() * .22, salt: Math.floor(Math.random() * 1000), hold: false } }; });
    const sim = { len, L, ceil, floor, obs, items, ents, fx: [], time: 0, cam: -VW * .3, go: false, over: false, first: 0, rank: null };
    const oy = o => o.amp ? o.y + Math.sin(sim.time * o.w + o.ph) * o.amp : o.y;
    sim.oy = oy;
    const spark = (x, y, col, k, sp) => { if (Math.abs(x - sim.cam - VW / 2) > VW) return; for (let i = 0; i < k; i++) sim.fx.push({ x, y, vx: rnd(-sp, sp) + 30, vy: rnd(-sp, sp * .6), t: 0, life: rnd(.3, .7), col: col[Math.floor(Math.random() * col.length)], s: Math.random() < .4 ? 2 : 1 }); };
    sim.smash = j => { const o = obs[j]; if (!o || o.dead) return false; o.dead = sim.time || .001; spark(o.x, oy(o), OB_COL[o.kind], 10, 70); return true; };
    sim.finish = e => { if (!sim.first) sim.first = sim.time; if (hooks.onFinish) hooks.onFinish(e); };
    sim.place = () => ents.slice().sort((a, b) => (a.gone - b.gone) || ((b.fin ? 1 : 0) - (a.fin ? 1 : 0)) || (a.fin && b.fin ? a.fin - b.fin : b.x - a.x));
    sim.focus = () => ents.find(e => e.kind === 'me') || ents.slice().sort((a, b) => b.x - a.x)[0];

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
      let target = c.vmax * (1 + .05 * e.stacks); const st = e.star > 0;
      if (st) target *= 1.5; else if (drag) target *= .6;
      if (e.spd < target) e.spd = Math.min(target, e.spd + c.acc * (st ? 4 : 1) * dt); else e.spd += (target - e.spd) * Math.min(1, dt * 2.5);
      e.x += e.spd * dt;
      const mx = e.x + PW / 2, my = e.y + PH / 2;
      while (e.oi < obs.length && obs[e.oi].x < mx - 40) e.oi++;
      for (let j = e.oi; j < obs.length && obs[j].x < mx + 40; j++) {
        const o = obs[j]; if (o.dead) continue;
        if (Math.hypot(o.x - mx, oy(o) - my) > o.r + 5) continue;
        sim.smash(j); if (mine && hooks.onSmash) hooks.onSmash(j);
        if (st) { if (mine) sfx.crush(); continue; }
        if (e.inv > 0) continue;
        e.hp -= o.dmg * (c.dm || 1); e.spd *= c.keep; e.stacks = Math.max(0, e.stacks - 1); e.inv = .6; e.hurt = .35;
        if (e.hp <= 0) { e.hp = 0; e.ko = 1.6; e.vy = -90; if (mine) sfx.ko(); } else if (mine) sfx.hit();
        if (mine && hooks.onHurt) hooks.onHurt();
      }
      while (e.ii < items.length && items[e.ii].x < mx - 30) e.ii++;
      for (let j = e.ii; j < items.length && items[j].x < mx + 30; j++) {
        const it = items[j]; if (it.got[e.id] || Math.hypot(it.x - mx, it.y - my) > 11) continue;
        it.got[e.id] = 1;
        if (it.kind === 0) { e.stacks = Math.min(5, e.stacks + 1); e.spd += 22; if (mine) sfx.speed(); }
        else if (it.kind === 1) { e.hp = Math.min(c.hp, e.hp + 30); if (mine) sfx.heal(); }
        else { e.star = 4 + (c.star || 0); if (mine) sfx.star(); }
        spark(it.x, it.y, it.kind === 0 ? ['#6dff8f', '#fff'] : it.kind === 1 ? ['#ff5a6e', '#fff'] : ['#ffe14a', '#fff'], 6, 50);
      }
      if (!e.fin && e.x >= L) { e.fin = sim.time; sim.finish(e); }
    }
    function botHold(e, dt) {
      const a = e.ai; a.t -= dt; if (a.t <= 0) { a.t = rnd(.4, 1.2); a.off = rnd(-20, 20); }
      const cx = e.x + PW / 2, cy = e.y + PH / 2;
      let ty = (ceil(cx + 40) + floor(cx + 40)) / 2 + a.off;
      for (let j = e.ii; j < items.length && items[j].x < cx + 110; j++) { const it = items[j]; if (!it.got[e.id] && it.x > cx + 6) { ty = it.y; break; } }
      if (!(e.star > 0)) for (let j = e.oi; j < obs.length && obs[j].x < cx + 26 + e.spd * .42; j++) {
        const o = obs[j]; if (o.dead || o.x < cx - 8 || ((j * 37 + a.salt) % 100) / 100 > a.skill) continue;
        const y = oy(o); if (Math.abs(y - ty) > o.r + 11 && Math.abs(y - cy) > o.r + 11) continue;
        const above = y - o.r - ceil(o.x), below = floor(o.x) - (y + o.r);
        ty = (cy < y && above > 26) || below < 26 ? y - o.r - 14 : y + o.r + 14; break;
      }
      a.hold = cy > ty + (a.hold ? -3 : 3);
      return a.hold;
    }
    sim.step = (dt, input) => {
      sim.time += dt;
      for (let i = sim.fx.length - 1; i >= 0; i--) { const p = sim.fx[i]; p.t += dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) sim.fx.splice(i, 1); }
      const fo = sim.focus(); if (fo) { const want = fo.x - VW * .3; sim.cam += (want - sim.cam) * (1 - Math.exp(-dt * 10)); }
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

  // ── 그리기 ──
  const sky = mk(VW, VH);
  { const g = sky.getContext('2d'), band = ['#140f2e', '#1b1436', '#261a44', '#352050', '#4a2a5c', '#6a3a66', '#96506a', '#c8705e', '#e59a4e']; band.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, Math.round(i * VH / band.length), VW, Math.ceil(VH / band.length) + 1); }); const r = rng(7); for (let i = 0; i < 70; i++) { g.fillStyle = r() < .3 ? '#fff6e8' : '#b8a8e0'; g.fillRect(Math.floor(r() * VW), Math.floor(r() * VH * .6), 1, 1); } g.fillStyle = '#fff2b8'; g.beginPath(); g.arc(300, 150, 16, 0, 7); g.fill(); }
  function draw(g, sim, t, meId) {
    const cam = Math.round(sim.cam);
    g.imageSmoothingEnabled = false; g.drawImage(sky, 0, 0);
    for (let x = 0; x < VW; x += 2) { const wx = x + cam * .12, h = 62 + 20 * Math.sin(wx * .018) + 10 * Math.sin(wx * .047); g.fillStyle = '#3a2452'; g.fillRect(x, VH - h, 2, h); }
    for (let x = 0; x < VW; x += 2) { const wx = x + cam * .3, h = 40 + 14 * Math.sin(wx * .026 + 2) + 7 * Math.sin(wx * .071); g.fillStyle = '#291838'; g.fillRect(x, VH - h, 2, h); }
    // 출발선·결승선
    const line = (wx, c1, c2) => { const x = wx - cam; if (x < -8 || x > VW) return; for (let y = 0; y < VH; y += 4) { g.fillStyle = (y >> 2) % 2 ? c1 : c2; g.fillRect(x, y, 4, 4); g.fillStyle = (y >> 2) % 2 ? c2 : c1; g.fillRect(x + 4, y, 4, 4); } };
    line(PW + 2, 'rgba(255,255,255,.25)', 'rgba(255,255,255,.08)'); line(sim.L + PW, '#fff6e8', '#1c1410');
    // 방해물
    for (const o of sim.obs) {
      const x = o.x - cam; if (x < -20) continue; if (x > VW + 20) break; if (o.dead) continue;
      const sp = obSpr(o.kind, o.r); g.drawImage(sp, Math.round(x - o.r), Math.round(sim.oy(o) - o.r));
    }
    // 아이템
    for (const it of sim.items) {
      const x = it.x - cam; if (x < -12) continue; if (x > VW + 12) break; if (meId && it.got[meId]) continue;
      const y = it.y + Math.sin(t * 4 + it.x) * 2;
      g.fillStyle = it.kind === 0 ? 'rgba(109,255,143,.22)' : it.kind === 1 ? 'rgba(255,90,110,.22)' : 'rgba(255,225,74,.3)'; g.fillRect(Math.round(x - 7), Math.round(y - 7), 14, 14);
      g.drawImage(IT[it.kind], Math.round(x - 4), Math.round(y - 4));
    }
    // 동굴 천장·바닥
    for (let x = -(((cam % 2) + 2) % 2); x < VW; x += 2) {
      const wx = x + cam, c = Math.round(sim.ceil(wx)), f = Math.round(sim.floor(wx));
      g.fillStyle = '#1c120c'; g.fillRect(x, 0, 2, c); g.fillRect(x, f, 2, VH - f);
      g.fillStyle = '#3b2414'; g.fillRect(x, c - 3, 2, 3); g.fillRect(x, f, 2, 3);
      g.fillStyle = '#7a5434'; g.fillRect(x, c - 1, 2, 1); g.fillRect(x, f, 2, 1);
    }
    // 슈고들 (나를 맨 위에)
    const order = sim.ents.slice().sort((a, b) => (a.kind === 'me') - (b.kind === 'me'));
    for (const e of order) {
      if (e.gone) continue;
      const sp = SPR[e.ch], x = Math.round(e.x - cam - (sp.width - PW) / 2), y = Math.round(e.y - 3);
      if (x < -30 || x > VW + 10) continue;
      if (e.inv > 0 && !(e.ko > 0) && Math.floor(t * 16) % 2) continue;
      const st = e.star > 0;
      if (st) { g.fillStyle = ['rgba(255,225,74,.45)', 'rgba(255,154,213,.45)', 'rgba(127,231,255,.45)'][Math.floor(t * 12) % 3]; g.fillRect(x - 3, y - 3, sp.width + 6, 20); for (let i = 1; i < 4; i++) { g.fillStyle = 'rgba(255,246,232,' + (.3 - i * .07) + ')'; g.fillRect(x - 6 - i * 9, y + 3 + (i % 2) * 5, 8, 1); } }
      else if (e.stacks >= 3 && e.spd > e.c.vmax) { g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x - 12, y + 5, 8, 1); g.fillRect(x - 18, y + 9, 10, 1); }
      g.save();
      if (e.ko > 0) { g.translate(x + sp.width / 2, y + 7); g.rotate(t * 9); g.translate(-(x + sp.width / 2), -(y + 7)); }
      g.drawImage(WSPR[e.ch][e.hold ? 1 : Math.floor(t * 6 + e.x * .01) % 2 ? 0 : 1], x - 5, y + (e.hold ? 4 : 1));
      g.drawImage(sp, x, y);
      if (e.hurt > 0) { g.globalAlpha = .55; g.fillStyle = '#ff3b30'; g.fillRect(x, y, sp.width, 14); g.globalAlpha = 1; }
      g.restore();
      if (e.kind !== 'me' && e.name) { const w = 12, hp = clamp(e.hp / e.c.hp, 0, 1); g.fillStyle = '#1c1410'; g.fillRect(x + sp.width / 2 - w / 2 - 1, y + 15, w + 2, 3); g.fillStyle = hp > .35 ? '#6dff8f' : '#ff5a46'; g.fillRect(x + sp.width / 2 - w / 2, y + 16, Math.round(w * hp), 1); }
    }
    for (const p of sim.fx) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.col; g.fillRect(Math.round(p.x - cam), Math.round(p.y), p.s, p.s); } g.globalAlpha = 1;
  }

  // ── 화면 ──
  function render(view, ctx, opt = {}) {
    const esc = ctx.esc, toast = ctx.toast || (() => {});
    const here = opt.embed ? /^#?\/?$/ : /^#\/game\/hwol/;
    view.innerHTML = `<div class="${opt.embed ? 'game game--embed' : 'page game'}">
      ${opt.embed ? '' : '<div class="ph"><div><h1>훨훨 슈고</h1><p>버튼 하나로 나는 레이싱이라거. 꾹 누르면 올라가고 떼면 내려간다거~</p></div><div class="ph__act"><a class="btn" href="#/games">게임 목록</a></div></div>'}
      <div class="g-wrap">
        <div><div class="g-stage" id="stage"><canvas id="gc" width="${VW}" height="${VH}"></canvas><div class="g-tags" id="tags"></div>
            <div class="fl-track" id="trk" hidden></div><div class="fl-stat" id="stat" hidden><div class="fl-hp"><i id="hpb"></i></div><div class="fl-pips" id="pips">${'<i></i>'.repeat(5)}</div></div>
            <div class="g-hud fl-hud" id="hud" hidden></div><div class="g-over" id="over" hidden></div></div>
          <div class="g-pad fl-pad" id="pad"><button data-k="h" class="g-jump">꾹 누르면 위로</button></div>
          <div class="g-bar"><label class="g-vol"><span>소리</span><input type="range" id="vol" min="0" max="100" step="1" aria-label="전체 소리 크기"><b id="volv"></b></label></div>
          <div class="g-how"><b>조작법</b>
            <ul><li><kbd>스페이스</kbd> 또는 <kbd>마우스 클릭</kbd> 꾹 누르면 위로</li><li>떼면 아래로</li><li>폰은 화면을 꾹 누르면 된다거</li></ul>
            <p>앞으로는 저절로 날아간다거. 돌·얼음·상자에 박으면 부서지면서 체력이 깎이고 잠깐 느려진다거. 초록 화살표는 스피드업(5번까지 쌓임), 하트는 체력 회복, 별은 잠깐 무적에 급가속이라거. 체력이 다 떨어지면 잠깐 기절한다거. 빨간 화살표가 나라거.</p></div></div>
        <aside class="pn g-side" id="side"></aside>
      </div></div>`;
    const $ = s => view.querySelector(s), cv = $('#gc'), g = cv.getContext('2d'), side = $('#side'), over = $('#over'), tags = $('#tags'), hud = $('#hud'), trk = $('#trk'), stat = $('#stat'), hpb = $('#hpb'), pips = $('#pips').children;
    const input = { h: false };
    let sim = null, mode = 'demo', room = null, lobby = null, rooms = [], alive = true, last = 0, sendT = 0, countdown = 0, shown = '', playing = false, me = Games.me(), goalShown = false;
    const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
    let len = clampL(ssGet('shugo_hlen') || L_DEF), ch = clamp(parseInt(ssGet('shugo_hch')) || 0, 0, CH.length - 1);
    const setLen = n => { len = clampL(n); ssSet('shugo_hlen', len); };
    const mins = n => { const m = n / 600; return '약 ' + (m % 1 ? m.toFixed(1) : m) + '분'; };

    const vol = $('#vol'), volv = $('#volv');
    vol.value = Math.round(S().vol() * 100); volv.textContent = +vol.value ? vol.value : '끔';
    vol.oninput = () => { S().setVol(vol.value / 100); volv.textContent = +vol.value ? vol.value : '끔'; };
    const unlock = () => { S().unlock(); S().bgm.prime(BGM); };
    view.addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

    const showHud = on => { hud.hidden = trk.hidden = stat.hidden = !on; };
    function startDemo() { mode = 'demo'; playing = false; showHud(false); S().bgm.pause(); sim = makeSim([0, 1, 2, 3, 4].map(i => ({ id: 'd' + i, name: '', ch: i, kind: 'bot' })), { onOver: () => setTimeout(() => { if (mode === 'demo') startDemo(); }, 1200) }, { len: L_MIN, seed: Math.floor(Math.random() * 1e9) }); sim.go = true; tags.innerHTML = ''; }
    function startGame(roster, solo, n, seed) {
      me = Games.me(); mode = solo ? 'solo' : 'net'; playing = true; over.hidden = true; goalShown = false; input.h = false;
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
      const mine = rank.findIndex(e => e.id === me.id);
      if (mine === 0) sfx.win();
      over.innerHTML = `<div class="g-res"><h2>${mine === 0 ? '1등이라거!' : rank[0] ? esc(rank[0].name) + ' 1등' : '끝'}</h2><ol>${rank.map(e => `<li class="${e.id === me.id ? 'me' : ''}"><img src="${face(e.ch)}" alt=""><span class="${e.member ? 'vip' : ''}">${esc(e.name)}</span><em class="fl-tm">${e.gone ? '나감' : e.fin ? tm(e.fin) : Math.max(1, Math.ceil((sim.L - e.x) / M)) + 'm 남음'}</em></li>`).join('')}</ol><div class="g-res__b"><button class="btn btn--gold" id="again">${mode === 'net' ? '방으로' : '한 판 더'}</button>${mode === 'solo' ? '<button class="btn" id="quit">그만하기</button>' : ''}</div></div>`;
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
      room = Games.room('hwol', code, MAX, {
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
          else if (m.t === 'p') { const e = sim.ents.find(x => x.id === m.id); if (e && e.kind === 'remote') { e.tx = m.x; e.ty = m.y; e.spd = m.v; e.hp = m.h; e.star = m.s ? Math.max(e.star, .4) : 0; e.ko = m.k ? .3 : 0; e.inv = m.n ? .3 : 0; e.hold = !!m.u; e.stacks = m.c | 0; } }
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
    const charBox = lock => `<div class="fl-pick"><span class="label">캐릭터 고르기</span><div class="fl-chars">${CH.map((c, i) => `<button class="fl-ch${i === ch ? ' on' : ''}" data-ch="${i}" ${lock ? 'disabled' : ''} title="${esc(c.name)}"><img src="${face(i)}" alt=""><b>${esc(c.name)}</b></button>`).join('')}</div>
      <div class="fl-info"><p>${esc(CH[ch].tip)}</p><div class="fl-bars">${BAR_NAMES.map((nm, i) => `<span>${nm}<i>${'<u class="on"></u>'.repeat(CH[ch].bars[i])}${'<u></u>'.repeat(5 - CH[ch].bars[i])}</i></span>`).join('')}</div></div></div>`;
    function bindChars() { side.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { ch = +b.dataset.ch; ssSet('shugo_hch', ch); if (room) room.update({ ch }); drawSide(); }); }

    function drawSide() {
      me = Games.me();
      const nameBox = me.member ? `<div class="g-name"><span class="label">내 이름</span><b class="vip">${esc(me.name)}</b></div>`
        : `<label class="field"><span>내 이름 (이 게임 전용)</span><input class="input" id="gname" maxlength="10" placeholder="${esc(me.def)}" value="${esc(me.name === me.def ? '' : me.name)}" ${room ? 'disabled' : ''}></label>`;
      if (!room) {
        side.innerHTML = `<h3 class="pn__h">대기 중인 방<span>${rooms.length}개</span></h3><div class="pn__b g-menu">${nameBox}
          <div class="g-rooms">${rooms.length ? rooms.map(r => { const full = r.n >= MAX; return `<button class="g-room" data-code="${esc(r.code)}" ${full || r.playing ? 'disabled' : ''}><span class="g-room__t"><b>${esc(r.host)}의 방</b><small>${r.playing ? '게임 중' : full ? '꽉 참' : '기다리는 중'} · ${r.n}/${MAX}명</small></span><em>${r.playing || full ? '못 들어가' : '들어가기'}</em></button>`; }).join('') : '<p class="g-rooms__no">지금 대기 중인 방이 없다거.<br>방을 만들면 여기에 떠서 누구나 눌러서 들어온다거.</p>'}</div>
          ${charBox(playing)}
          <button class="btn btn--gold btn--lg" id="mk" ${Games.online() && !playing ? '' : 'disabled'}>방 만들기</button>
          ${lenBox(!playing)}
          <button class="btn btn--lg" id="so" ${playing ? 'disabled' : ''}>혼자 연습 (봇 4마리)</button></div>`;
        const gn = $('#gname'); if (gn) gn.onchange = () => Games.setGuestName(gn.value);
        bindLen(); bindChars();
        $('#mk').onclick = () => { if (gn) Games.setGuestName(gn.value); join(Games.newCode()); };
        $('#so').onclick = () => { if (gn) Games.setGuestName(gn.value); solo(); };
        side.querySelectorAll('[data-code]').forEach(b => b.onclick = () => { if (gn) Games.setGuestName(gn.value); join(b.dataset.code); });
        return;
      }
      const ps = room.players(), host = room.isHost(), mine = ps.find(p => p.id === me.id), others = ps.filter((p, i) => i > 0), allReady = others.every(p => p.ready);
      const hostLen = clampL(host ? len : (ps[0] && ps[0].len) || L_DEF);
      side.innerHTML = `<h3 class="pn__h">방 ${esc(room.code)}<span>${ps.length}/${MAX}</span></h3><div class="pn__b g-menu">
        <div class="g-players">${Array.from({ length: MAX }, (_, i) => { const p = ps[i]; return p ? `<div class="g-p"><img src="${face(p.ch)}" alt=""><span class="${p.member ? 'vip' : ''}">${esc(p.name)}</span><em>${i === 0 ? '방장' : p.ready ? '준비 완료' : '준비 중'}</em></div>` : `<div class="g-p g-p--empty"><span>빈 자리</span></div>`; }).join('')}</div>
        ${charBox(playing || (!host && mine && mine.ready))}
        ${host && !playing ? lenBox(true) : `<div class="g-name"><span class="label">코스 길이 (방장이 정함)</span><b>${hostLen}m</b></div>`}
        ${playing ? '<p class="mut">게임 중</p>' : host
          ? `<button class="btn btn--gold btn--lg" id="st" ${allReady ? '' : 'disabled'}>${ps.length === 1 ? '봇이랑 시작' : allReady ? '시작' : '다들 준비하면 시작'}</button>`
          : `<button class="btn ${mine && mine.ready ? '' : 'btn--gold'} btn--lg" id="rd">${mine && mine.ready ? '준비 취소' : '준비'}</button>`}
        <p class="g-note">이 방은 '대기 중인 방'에 떠 있다거. 다른 사람은 게임 화면에서 방을 누르면 바로 들어온다거.</p><button class="btn btn--plain" id="lv">방 나가기</button></div>`;
      bindLen(() => room && room.update({ len })); bindChars();
      const st = $('#st'); if (st) st.onclick = () => {
        if (ps.length === 1) { solo(); return; }
        const r = ps.map(p => ({ id: p.id, name: p.name, member: p.member, ch: (p.ch | 0) % CH.length })), seed = Math.floor(Math.random() * 1e9);
        room.send({ t: 's', r, len, seed }); startGame(r, false, len, seed); announce();
      };
      const rd = $('#rd'); if (rd) rd.onclick = () => room.update({ ready: !(mine && mine.ready) });
      $('#lv').onclick = leave;
    }

    // ── 조작 (버튼 하나) ──
    const keys = { ' ': 1, ArrowUp: 1, w: 1, W: 1 };
    const kd = e => { if (!keys[e.key] || !playing || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; e.preventDefault(); input.h = true; };
    const ku = e => { if (keys[e.key]) input.h = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    const press = el => { const on = e => { if (!playing) return; e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); input.h = true; }, off = () => { input.h = false; };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off); el.addEventListener('contextmenu', e => e.preventDefault()); };
    press(cv); press($('#pad button'));
    addEventListener('blur', ku2); function ku2() { input.h = false; }

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
      if (playing && mode === 'net' && sim.go && room && m) { sendT -= dt; if (sendT <= 0) { sendT = .12; room.send({ t: 'p', id: m.id, x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10, v: Math.round(m.spd), h: Math.round(m.hp), s: m.star > 0 ? 1 : 0, k: m.ko > 0 ? 1 : 0, n: m.inv > 0 ? 1 : 0, u: m.hold ? 1 : 0, c: m.stacks }); } }
      draw(g, sim, now / 1000, m && m.id);
      const cam = Math.round(sim.cam);
      tags.childNodes.forEach(el => { const e = sim.ents.find(x => x.id === el.dataset.id), x = e ? e.x + PW / 2 - cam : -99; if (!e || e.gone || x < 4 || x > VW - 4 || e.y < 26) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = (x / VW * 100) + '%'; el.style.top = ((e.y - 5) / VH * 100) + '%'; });
      if (playing && m) {
        const place = sim.place(), rk = place.findIndex(e => e.id === m.id) + 1;
        hud.textContent = m.fin ? '골인! ' + rk + '등 · 다른 슈고 기다리는 중' : rk + '등 · ' + Math.max(0, Math.ceil((sim.L - m.x) / M)) + 'm 남음';
        hpb.style.width = clamp(m.hp / m.c.hp * 100, 0, 100) + '%'; hpb.className = m.hp / m.c.hp > .35 ? '' : 'low';
        for (let i = 0; i < 5; i++) pips[i].className = i < m.stacks ? 'on' : '';
        stat.classList.toggle('star', m.star > 0);
        trk.querySelectorAll('img').forEach(el => { const e = sim.ents.find(x => x.id === el.dataset.id); if (!e || e.gone) { el.style.display = 'none'; return; } el.style.left = clamp(e.x / sim.L * 100, 0, 100) + '%'; });
      }
    }
    startDemo(); drawSide(); requestAnimationFrame(frame);
    if (Games.online()) {
      lobby = Games.lobby('hwol', list => { rooms = list; if (!room) drawSide(); });
      const want = new URLSearchParams(location.hash.split('?')[1] || '').get('room');
      if (want && !opt.embed) join(want.toUpperCase().slice(0, 4));
    }
    const off = () => { if (here.test(location.hash)) return; alive = false; S().bgm.pause(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', ku2); removeEventListener('keydown', unlock); removeEventListener('hashchange', off); if (room) room.leave(); if (lobby) lobby.close(); };
    addEventListener('hashchange', off);
    return { sim: () => sim, input };
  }

  // 게임 목록에 쓸 그림 (게임 화면 한 장을 그대로 그림)
  let thumb = '';
  try { const s = makeSim([0, 1, 2, 3, 4].map(i => ({ id: 't' + i, name: '', ch: i, kind: 'bot' })), {}, { len: L_MIN, seed: 20261127 }); s.ents.forEach((e, i) => { e.x = 560 + [70, 20, 110, 45, 0][i]; e.y = [60, 150, 100, 40, 125][i]; }); s.ents[2].star = 1; s.cam = 500; const c = mk(VW, VH); draw(c.getContext('2d'), s, 1.3); thumb = c.toDataURL(); } catch (e) {}

  Games.add({ id: 'hwol', name: '훨훨 슈고', desc: '버튼 하나로 날아서 방해물을 뚫고 먼저 골인하는 레이싱', max: MAX, live: true, thumb, render });
})();
