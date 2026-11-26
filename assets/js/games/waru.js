// 와르르 슈고 — 밟은 발판이 곧 떨어지는 2D 횡스크롤 도트 게임 (최대 5명 실시간)
// 규칙: 발판을 밟으면 0.5초 뒤 떨어짐. 아래층으로 계속 내려가다 맨 밑 용암에 빠지면 탈락. 마지막까지 남으면 승리.
// 발판 줄 수는 방장이 5~30줄로 고름(기본 10). 줄 사이마다 랜덤 발판. 화면은 내 캐릭터를 따라 아래로 내려감.
(function () {
  const VW = 384, VH = 216, T = 16, COLS = 22, MX = (VW - COLS * T) / 2, TOP = 62, RG = 17, TH = 6;
  const PW = 8, PH = 12, SPD = 80, JV = 152, G = 520, DELAY = .5, MAX = 5;
  const F_MIN = 5, F_MAX = 30, F_DEF = 10;
  const FLOOR_COL = ['#f2c14e', '#e59a4e', '#d4523f', '#8a5bd0', '#3f7fd6'], MID_COL = '#7fd0c0';
  const BGM = 'assets/snd/waru-bgm.mp3';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clampF = n => Math.min(F_MAX, Math.max(F_MIN, Math.round(+n) || F_DEF));
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ── 소리 (효과음은 코드로 만든 짧고 순한 소리) ──
  const S = () => Games.sound;
  const sfx = {
    step: i => S().tone({ f: i % 2 ? 700 : 600, f2: i % 2 ? 540 : 460, t: .05, type: 'triangle', g: .1 }),
    jump: () => S().tone({ f: 420, f2: 880, t: .14, type: 'sine', g: .16 }),
    dead: big => { const k = big ? 1 : .4; S().tone({ f: 640, f2: 110, t: .55, type: 'triangle', g: .2 * k }); S().noise({ t: .5, g: .1 * k, f: 1800 }); S().tone({ f: 200, f2: 60, t: .3, type: 'sine', g: .14 * k, at: .12 }); },
    count: () => S().tone({ f: 660, t: .12, type: 'sine', g: .18 }),
    go: () => { S().tone({ f: 990, t: .3, type: 'sine', g: .18 }); S().tone({ f: 1320, t: .3, type: 'sine', g: .12, at: .05 }); },
    win: () => [660, 880, 1100, 1320].forEach((f, i) => S().tone({ f, t: .16, type: 'triangle', g: .16, at: i * .11 }))
  };

  // ── 도트 슈고 5마리 (모습이 전부 다름) ──
  const BASE = ['..kk....kk..', '.kook..kook.', '.kowkkkkwok.', 'kowwwwwwwwok', 'kwwewwwwewwk', 'kowwwnnwwwok', '.kwwwwwwwwk.', '..kccggcck..', '.kcccccccck.', '.kcdccccdck.', '.kcccccccck.', '..kcckkcck..'];
  const FEET = [['..kwk..kwk..', '..kkk..kkk..'], ['.kwk....kwk.', '.kkk....kkk.']];
  const SKINS = [
    { c: '#2f9c8f', d: '#1f6f66', hat: ['...hhhhhh...', '..hhhghhhh..', '.khhhhhhhhk.'], h: '#2f9c8f' },              // 청록 터번
    { c: '#d4523f', d: '#9c3527' },                                                                                // 빨간 조끼
    { c: '#5aa646', d: '#3c7a2e', hat: ['....yyyy....', '...yyyyyy...', 'yyyyyyyyyyyy'] },                          // 밀짚모자
    { c: '#3f6fd0', d: '#2a4c98', hat: [null, null, 'kbbbbbbbbbbk'] },                                              // 파란 두건
    { c: '#8a5bd0', d: '#623d9c', eyes: 'kwgegwwgegwk' }                                                            // 안경잡이
  ];
  const PAL = { k: '#3b2414', w: '#fff6e8', o: '#e59a4e', e: '#1c1410', n: '#e88a8a', g: '#f2c14e', y: '#e8c96a', b: '#3f7fd6' };
  function sprite(skin, frame) {
    const s = SKINS[skin % SKINS.length], rows = BASE.slice().concat(FEET[frame]);
    (s.hat || []).forEach((r, i) => { if (r) rows[i] = r; });
    if (s.eyes) rows[4] = s.eyes;
    const cv = document.createElement('canvas'); cv.width = 12; cv.height = 14;
    const g = cv.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.') return; g.fillStyle = ch === 'c' ? s.c : ch === 'd' ? s.d : ch === 'h' ? s.h : PAL[ch]; g.fillRect(x, y, 1, 1); }));
    return cv;
  }
  const SPR = SKINS.map((_, i) => [sprite(i, 0), sprite(i, 1)]);
  const face = skin => { const c = document.createElement('canvas'); c.width = 48; c.height = 56; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(SPR[skin % 5][0], 0, 0, 48, 56); return c.toDataURL(); };
  const bg = new Image(); bg.src = 'assets/img/g-game-bg.webp';

  // ── 게임 한 판 ──
  // 줄(row): 짝수 줄 = 꽉 찬 발판, 홀수 줄 = 그 사이의 랜덤 발판. 타일 상태 0 멀쩡 · 1 흔들림 · 2 떨어짐 · 3 원래 없음
  function makeSim(roster, hooks = {}, opt = {}) {
    const F = clampF(opt.floors || F_DEF), R = F * 2 - 1, rand = rng(opt.seed || 1);
    const tiles = new Uint8Array(R * COLS), tAt = new Float32Array(R * COLS);
    for (let r = 1; r < R; r += 2) {
      for (let c = 0; c < COLS; c++) tiles[r * COLS + c] = 3;
      const segs = 2 + Math.floor(rand() * 3);
      for (let s = 0; s < segs; s++) { const len = 1 + Math.floor(rand() * 3), c0 = Math.floor(rand() * (COLS - len + 1)); for (let c = c0; c < c0 + len; c++) tiles[r * COLS + c] = 0; }
    }
    const LAVA = TOP + (R - 1) * RG + 40, camMax = Math.max(0, LAVA + 14 - VH);
    const n = roster.length;
    const ents = roster.map((r, i) => ({ ...r, x: MX + (i + 1) * (COLS * T) / (n + 1) - PW / 2, y: TOP - PH, vx: 0, vy: 0, ground: true, alive: true, face: i < n / 2 ? 1 : -1, walk: 0, tx: 0, ty: 0, ai: { dir: Math.random() < .5 ? -1 : 1, t: rnd(.2, .6) } }));
    ents.forEach(e => { e.tx = e.x; e.ty = e.y; });
    const sim = { tiles, tAt, ents, F, R, LAVA, camMax, cam: 0, time: 0, go: false, over: false, order: [], rank: null };
    sim.trigger = k => { if (tiles[k] === 0) { tiles[k] = 1; tAt[k] = sim.time + DELAY; return true; } return false; };
    sim.kill = id => { const e = ents.find(x => x.id === id); if (e && e.alive) { e.alive = false; sim.order.push(e); if (hooks.onKill) hooks.onKill(e); } };
    function physics(e, dt, dir, jump) {
      const mine = e.kind === 'me';
      e.vx = dir * SPD; if (dir) e.face = dir;
      if (jump && e.ground) { e.vy = -JV; e.ground = false; if (mine && hooks.onJump) hooks.onJump(); }
      e.vy += G * dt;
      e.x = Math.min(MX + COLS * T - PW, Math.max(MX, e.x + e.vx * dt));
      const prev = e.y + PH; let ny = e.y + e.vy * dt; e.ground = false;
      if (e.vy >= 0) {
        const r0 = Math.max(0, Math.floor((prev - TOP) / RG)), r1 = Math.min(R - 1, Math.ceil((ny + PH - TOP) / RG));
        for (let r = r0; r <= r1; r++) {
          const top = TOP + r * RG;
          if (prev <= top + .01 && ny + PH >= top) {
            const c0 = Math.floor((e.x - MX) / T), c1 = Math.floor((e.x + PW - 1 - MX) / T); let hit = false; const fresh = [];
            for (let c = c0; c <= c1; c++) { const k = r * COLS + c; if (c >= 0 && c < COLS && tiles[k] < 2) { hit = true; if (sim.trigger(k)) fresh.push(k); } }
            if (hit) { ny = top - PH; e.vy = 0; e.ground = true; if (fresh.length && mine && hooks.onTiles) hooks.onTiles(fresh); break; }
          }
        }
      }
      e.y = ny;
      if (e.ground && dir) { const w = Math.floor(e.walk); e.walk += dt * 10; if (mine && hooks.onStep && Math.floor(e.walk) !== w) hooks.onStep(Math.floor(e.walk)); }
      if (e.y + PH > LAVA) { sim.kill(e.id); if (mine && hooks.onDead) hooks.onDead(); }
    }
    sim.focus = () => ents.find(e => e.kind === 'me' && e.alive) || ents.filter(e => e.alive).sort((a, b) => a.y - b.y)[0] || null;
    sim.step = (dt, input) => {
      sim.time += dt;
      for (let k = 0; k < tiles.length; k++) if (tiles[k] === 1 && sim.time >= tAt[k]) { tiles[k] = 2; tAt[k] = sim.time; }
      const fo = sim.focus();
      if (fo) { const want = Math.min(camMax, Math.max(0, fo.y - VH * .42)); sim.cam += (want - sim.cam) * (1 - Math.exp(-dt * 7)); }
      if (!sim.go || sim.over) return;
      for (const e of ents) {
        if (!e.alive) continue;
        if (e.kind === 'me') physics(e, dt, (input.r ? 1 : 0) - (input.l ? 1 : 0), input.j);
        else if (e.kind === 'bot') {
          const a = e.ai; a.t -= dt; let jump = false;
          if (a.t <= 0) { a.t = rnd(.25, .8); if (Math.random() < .22) a.dir *= -1; if (Math.random() < .45) jump = true; }
          if (e.ground) { const r = Math.round((e.y + PH - TOP) / RG), c = Math.floor((e.x + (a.dir > 0 ? PW + 4 : -4) - MX) / T);
            if (c < 0 || c >= COLS) a.dir *= -1; else if (r >= 0 && r < R && tiles[r * COLS + c] >= 2) { if (Math.random() < .75) jump = true; else a.dir *= -1; } }
          physics(e, dt, a.dir, jump);
        } else { e.tx += e.vx * dt; e.ty += e.vy * dt; const k = Math.min(1, dt * 14); e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; if (Math.abs(e.vx) > 1) e.walk += dt * 10; }
      }
      const alive = ents.filter(e => e.alive);
      if (n > 1 ? alive.length <= 1 : alive.length === 0) { sim.over = true; sim.rank = alive.concat(sim.order.slice().reverse()); if (hooks.onOver) hooks.onOver(sim.rank); }
    };
    return sim;
  }

  function draw(g, sim, t) {
    const cam = Math.round(sim.cam);
    g.imageSmoothingEnabled = false;
    if (bg.complete && bg.naturalWidth) g.drawImage(bg, 0, 0, VW, VH); else { g.fillStyle = '#1a120c'; g.fillRect(0, 0, VW, VH); }
    g.fillStyle = 'rgba(10,7,5,.42)'; g.fillRect(0, 0, VW, VH);
    const r0 = Math.max(0, Math.floor((cam - 60 - TOP) / RG)), r1 = Math.min(sim.R - 1, Math.ceil((cam + VH - TOP) / RG));
    for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
      const k = r * COLS + c, st = sim.tiles[k]; if (st === 3) continue;
      let x = MX + c * T, y = TOP + r * RG - cam, a = 1;
      if (st === 1) { x += Math.round(Math.sin(t * 70 + c) * 1); y += Math.round(Math.cos(t * 55 + c)); }
      if (st === 2) { const d = sim.time - sim.tAt[k]; if (d > .45) continue; y += d * d * 260; a = 1 - d / .45; }
      g.globalAlpha = a; g.fillStyle = '#2a190d'; g.fillRect(x, y, T - 1, TH + 1);
      g.fillStyle = st === 1 ? '#fff6e8' : r % 2 ? MID_COL : FLOOR_COL[(r >> 1) % 5]; g.fillRect(x, y, T - 1, TH - 1);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, T - 1, 1);
      g.globalAlpha = 1;
    }
    const ly = sim.LAVA - cam;
    if (ly < VH + 8) for (let x = 0; x < VW; x += 8) { const h = 3 + Math.round(Math.sin(t * 3 + x * .2) * 2); g.fillStyle = '#ffb347'; g.fillRect(x, ly + 4 - h, 8, 2); g.fillStyle = '#e8622c'; g.fillRect(x, ly + 6 - h, 8, VH); }
    for (const e of sim.ents) {
      if (!e.alive) continue;
      const fr = e.ground && Math.floor(e.walk) % 2 ? 1 : 0, sp = SPR[e.skin % 5][e.ground ? fr : 1], x = Math.round(e.x - 2), y = Math.round(e.y - 2) - cam;
      if (y < -20 || y > VH) continue;
      g.save(); if (e.face < 0) { g.translate(x + 12, y); g.scale(-1, 1); g.drawImage(sp, 0, 0); } else g.drawImage(sp, x, y); g.restore();
    }
  }

  // ── 화면 ──
  // opt.embed = 소개 화면처럼 다른 화면 안에 끼워 넣을 때 (제목 줄 없이)
  function render(view, ctx, opt = {}) {
    const esc = ctx.esc, toast = ctx.toast || (() => {});
    const here = opt.embed ? /^#?\/?$/ : /^#\/game\/waru/;
    view.innerHTML = `<div class="${opt.embed ? 'game game--embed' : 'page game'}">
      ${opt.embed ? '' : '<div class="ph"><div><h1>와르르 슈고</h1><p>밟은 발판은 곧 떨어져. 계속 뛰어다니면서 마지막까지 살아남아.</p></div><div class="ph__act"><a class="btn" href="#/games">게임 목록</a></div></div>'}
      <div class="g-wrap">
        <div><div class="g-stage" id="stage"><canvas id="gc" width="${VW}" height="${VH}"></canvas><div class="g-tags" id="tags"></div><div class="g-hud" id="hud" hidden></div><div class="g-over" id="over" hidden></div></div>
          <div class="g-pad" id="pad"><button data-k="l" aria-label="왼쪽">◀</button><button data-k="r" aria-label="오른쪽">▶</button><button data-k="j" class="g-jump">점프</button></div>
          <div class="g-bar"><label class="g-vol"><span>소리</span><input type="range" id="vol" min="0" max="100" step="1" aria-label="전체 소리 크기"><b id="volv"></b></label></div>
          <div class="g-how"><b>조작법</b>
            <ul><li><kbd>←</kbd><kbd>→</kbd> 또는 <kbd>A</kbd><kbd>D</kbd> 이동</li><li><kbd>스페이스</kbd> 또는 <kbd>↑</kbd> 점프</li><li>폰은 화면 아래 <kbd>◀</kbd><kbd>▶</kbd><kbd>점프</kbd> 버튼</li></ul>
            <p>밟은 발판은 0.5초 뒤에 떨어져. 계속 움직이면서 아래로 내려가. 용암에 빠지면 탈락, 마지막까지 남으면 승리! 빨간 화살표가 나야.</p></div></div>
        <aside class="pn g-side" id="side"></aside>
      </div></div>`;
    const $ = s => view.querySelector(s), cv = $('#gc'), g = cv.getContext('2d'), side = $('#side'), over = $('#over'), tags = $('#tags'), hud = $('#hud');
    const input = { l: false, r: false, j: false };
    let sim = null, mode = 'demo', room = null, lobby = null, rooms = [], alive = true, last = 0, sendT = 0, countdown = 0, shown = '', playing = false, me = Games.me();
    let floors = clampF(sessionStorage.getItem('shugo_gfloors') || F_DEF);
    const setFloors = n => { floors = clampF(n); try { sessionStorage.setItem('shugo_gfloors', floors); } catch (e) {} };

    // 소리 크기
    const vol = $('#vol'), volv = $('#volv');
    const showVol = () => { const v = Math.round(S().vol() * 100); vol.value = v; volv.textContent = v ? v : '끔'; };
    vol.oninput = () => { S().setVol(vol.value / 100); volv.textContent = +vol.value ? vol.value : '끔'; };
    showVol();
    const unlock = () => { S().unlock(); S().bgm.prime(BGM); };
    view.addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

    const demoRoster = () => [0, 1, 2, 3, 4].map(i => ({ id: 'd' + i, name: '', skin: i, kind: 'bot' }));
    function startDemo() { mode = 'demo'; playing = false; hud.hidden = true; S().bgm.pause(); sim = makeSim(demoRoster(), { onOver: () => setTimeout(() => { if (mode === 'demo') startDemo(); }, 1500) }, { floors: 6, seed: Math.floor(Math.random() * 1e9) }); sim.go = true; tagsFor([]); }
    function tagsFor(list) { tags.innerHTML = list.map(e => `<span data-id="${esc(e.id)}" class="${e.member ? 'vip' : ''}${e.kind === 'me' ? ' me' : ''}">${esc(e.name)}</span>`).join(''); }

    function startGame(roster, solo, n, seed) {
      me = Games.me(); mode = solo ? 'solo' : 'net'; playing = true; over.hidden = true;
      const list = roster.map(r => ({ ...r, kind: r.bot ? 'bot' : r.id === me.id ? 'me' : 'remote' }));
      sim = makeSim(list, {
        onTiles: ks => { if (room && mode === 'net') room.send({ t: 't', k: ks }); },
        onDead: () => { if (room && mode === 'net') room.send({ t: 'd', id: me.id }); },
        onJump: sfx.jump, onStep: sfx.step,
        onKill: e => sfx.dead(e.kind === 'me'),
        onOver: rank => finish(rank)
      }, { floors: n, seed });
      tagsFor(list); countdown = 3.7; shown = ''; hud.hidden = false;
      S().bgm.play(BGM);
      $('#stage').scrollIntoView({ block: 'nearest' });
      drawSide();
    }
    function finish(rank) {
      playing = false; hud.hidden = true;
      const mine = rank.findIndex(e => e.id === me.id);
      if (mine === 0) sfx.win();
      over.innerHTML = `<div class="g-res"><h2>${mine === 0 ? '살아남았다!' : rank[0] ? esc(rank[0].name) + ' 승리' : '끝'}</h2><ol>${rank.map(e => `<li class="${e.id === me.id ? 'me' : ''}"><img src="${face(e.skin)}" alt=""><span class="${e.member ? 'vip' : ''}">${esc(e.name)}</span></li>`).join('')}</ol><div class="g-res__b"><button class="btn btn--gold" id="again">${mode === 'net' ? '방으로' : '한 판 더'}</button>${mode === 'solo' ? '<button class="btn" id="quit">그만하기</button>' : ''}</div></div>`;
      over.hidden = false;
      const back = () => { over.hidden = true; if (mode === 'net' && room) { room.update({ ready: false }); startDemo(); drawSide(); } else if (mode === 'solo') solo(); };
      $('#again').onclick = back;
      const q = $('#quit'); if (q) q.onclick = () => { over.hidden = true; startDemo(); drawSide(); };
      drawSide();
    }
    function solo() { me = Games.me(); startGame([{ id: me.id, name: me.name, member: me.member, skin: 0 }, ...[1, 2, 3].map(i => ({ id: 'bot' + i, name: '봇슈고' + i, skin: i, bot: true }))], true, floors, Math.floor(Math.random() * 1e9)); }

    // ── 방 ──
    function join(code) {
      if (room) room.leave();
      me = Games.me();
      room = Games.room('waru', code, MAX, {
        onPlayers: ps => {
          if (room && room.isHost() && ps[0] && ps[0].floors !== floors) room.update({ floors });
          announce();
          if (playing && mode === 'net' && sim) sim.ents.forEach(e => { if (e.kind === 'remote' && !room.players().some(p => p.id === e.id)) sim.kill(e.id); });
          drawSide();
        },
        onFull: () => { room = null; toast('방이 꽉 찼어 (최대 5명)', true); drawSide(); },
        onMsg: m => {
          if (m.t === 's' && !playing) startGame(m.r, false, m.n, m.seed);
          else if (!sim || mode !== 'net') return;
          else if (m.t === 'p') { const e = sim.ents.find(x => x.id === m.id); if (e && e.kind === 'remote') { e.tx = m.x; e.ty = m.y; e.vx = m.vx; e.vy = m.vy; e.face = m.f; e.ground = !!m.g; } }
          else if (m.t === 't') m.k.forEach(k => sim.trigger(k));
          else if (m.t === 'd') sim.kill(m.id);
        }
      });
      startDemo(); drawSide();
    }
    function announce() { if (!lobby || !room) return; if (room.isHost()) lobby.announce({ code: room.code, n: room.players().length, host: room.me.name, playing }); else lobby.quiet(); }
    function leave() { if (room) { room.leave(); room = null; } if (lobby) lobby.quiet(); startDemo(); drawSide(); }

    const floorBox = on => `<label class="field g-floors"><span>발판 줄 수 <b id="flv">${floors}</b>줄</span><input type="range" id="fl" min="${F_MIN}" max="${F_MAX}" step="1" value="${floors}" ${on ? '' : 'disabled'}></label>`;
    function bindFloors(after) { const fl = $('#fl'); if (!fl) return; fl.oninput = () => { $('#flv').textContent = fl.value; }; fl.onchange = () => { setFloors(fl.value); if (after) after(); }; }

    function drawSide() {
      me = Games.me();
      const nameBox = me.member ? `<div class="g-name"><span class="label">내 이름</span><b class="vip">${esc(me.name)}</b></div>`
        : `<label class="field"><span>내 이름 (이 게임에서만 써)</span><input class="input" id="gname" maxlength="10" placeholder="${esc(me.def)}" value="${esc(me.name === me.def ? '' : me.name)}" ${room ? 'disabled' : ''}></label>`;
      if (!room) {
        side.innerHTML = `<h3 class="pn__h">게임 시작</h3><div class="pn__b g-menu">${nameBox}${floorBox(true)}
          <button class="btn btn--gold btn--lg" id="mk" ${Games.online() ? '' : 'disabled'}>방 만들기</button>
          <button class="btn btn--lg" id="so">혼자 연습 (봇 3마리)</button>
          <div class="g-rooms"><span class="label">열린 방</span>${rooms.length ? rooms.map(r => `<button class="g-room" data-code="${esc(r.code)}" ${r.n >= MAX || r.playing ? 'disabled' : ''}><b>${esc(r.host)}의 방</b><span>${r.playing ? '게임 중' : r.n + '/' + MAX}</span></button>`).join('') : '<p class="mut">지금 열린 방이 없어. 방을 만들고 링크를 보내봐.</p>'}</div></div>`;
        const gn = $('#gname'); if (gn) gn.onchange = () => Games.setGuestName(gn.value);
        bindFloors();
        $('#mk').onclick = () => { if (gn) Games.setGuestName(gn.value); join(Games.newCode()); };
        $('#so').onclick = () => { if (gn) Games.setGuestName(gn.value); solo(); };
        side.querySelectorAll('[data-code]').forEach(b => b.onclick = () => { if (gn) Games.setGuestName(gn.value); join(b.dataset.code); });
        return;
      }
      const ps = room.players(), host = room.isHost(), mine = ps.find(p => p.id === me.id), others = ps.filter((p, i) => i > 0), allReady = others.every(p => p.ready);
      const hostFloors = clampF(host ? floors : (ps[0] && ps[0].floors) || F_DEF);
      side.innerHTML = `<h3 class="pn__h">방 ${esc(room.code)}<span>${ps.length}/${MAX}</span></h3><div class="pn__b g-menu">
        <div class="g-players">${Array.from({ length: MAX }, (_, i) => { const p = ps[i]; return p ? `<div class="g-p"><img src="${face(i)}" alt=""><span class="${p.member ? 'vip' : ''}">${esc(p.name)}</span><em>${i === 0 ? '방장' : p.ready ? '준비 완료' : '준비 중'}</em></div>` : `<div class="g-p g-p--empty"><span>빈 자리</span></div>`; }).join('')}</div>
        ${host && !playing ? floorBox(true) : `<div class="g-name"><span class="label">발판 줄 수 (방장이 정해)</span><b>${hostFloors}줄</b></div>`}
        ${playing ? '<p class="mut">게임 중이야.</p>' : host
          ? `<button class="btn btn--gold btn--lg" id="st" ${allReady ? '' : 'disabled'}>${ps.length === 1 ? '봇이랑 시작' : allReady ? '시작' : '다들 준비하면 시작'}</button>`
          : `<button class="btn ${mine && mine.ready ? '' : 'btn--gold'} btn--lg" id="rd">${mine && mine.ready ? '준비 취소' : '준비'}</button>`}
        <button class="btn" id="cp">초대 링크 복사</button><button class="btn btn--plain" id="lv">방 나가기</button></div>`;
      bindFloors(() => room && room.update({ floors }));
      const st = $('#st'); if (st) st.onclick = () => {
        if (ps.length === 1) { solo(); return; }
        const r = ps.map((p, i) => ({ id: p.id, name: p.name, member: p.member, skin: i })), seed = Math.floor(Math.random() * 1e9);
        room.send({ t: 's', r, n: floors, seed }); startGame(r, false, floors, seed); announce();
      };
      const rd = $('#rd'); if (rd) rd.onclick = () => room.update({ ready: !(mine && mine.ready) });
      $('#cp').onclick = async () => { const url = location.origin + location.pathname + '#/game/waru?room=' + room.code; try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했어'); } catch (e) { toast(url); } };
      $('#lv').onclick = leave;
    }

    // ── 조작 ──
    const keyMap = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ' ': 'j', ArrowUp: 'j', w: 'j', W: 'j' };
    const kd = e => { const k = keyMap[e.key]; if (!k || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; if (playing) e.preventDefault(); input[k] = true; };
    const ku = e => { const k = keyMap[e.key]; if (k) input[k] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    view.querySelectorAll('#pad button').forEach(b => { const k = b.dataset.k, on = e => { e.preventDefault(); input[k] = true; }, off = () => { input[k] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); b.addEventListener('contextmenu', e => e.preventDefault()); });

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
      if (playing && mode === 'net' && sim.go && room) { sendT -= dt; const m = sim.ents.find(e => e.kind === 'me'); if (m && m.alive && sendT <= 0) { sendT = .15; room.send({ t: 'p', id: m.id, x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10, vx: Math.round(m.vx), vy: Math.round(m.vy), f: m.face, g: m.ground ? 1 : 0 }); } }
      draw(g, sim, now / 1000);
      const cam = Math.round(sim.cam);
      tags.childNodes.forEach(el => { const e = sim.ents.find(x => x.id === el.dataset.id), y = e ? e.y - 4 - cam : -99; if (!e || !e.alive || y < 6 || y > VH) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = ((e.x + PW / 2) / VW * 100) + '%'; el.style.top = (y / VH * 100) + '%'; });
      if (playing) { const fo = sim.focus(); if (fo) hud.textContent = Math.min(sim.F, Math.max(1, Math.floor((fo.y + PH - TOP) / (RG * 2) + 1.01))) + ' / ' + sim.F + '줄'; }
    }
    startDemo(); drawSide(); requestAnimationFrame(frame);
    if (Games.online()) {
      lobby = Games.lobby('waru', list => { rooms = list; if (!room) drawSide(); });
      const want = new URLSearchParams(location.hash.split('?')[1] || '').get('room');
      if (want && !opt.embed) join(want.toUpperCase().slice(0, 4));
    }
    const off = () => { if (here.test(location.hash)) return; alive = false; S().bgm.pause(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('keydown', unlock); removeEventListener('hashchange', off); if (room) room.leave(); if (lobby) lobby.close(); };
    addEventListener('hashchange', off);
  }

  Games.add({ id: 'waru', name: '와르르 슈고', desc: '밟으면 떨어지는 발판 위에서 마지막까지 살아남기', max: MAX, live: true, thumb: 'assets/img/g-game-bg.webp', render });
})();
