// 와르르 슈고 — 밟은 발판이 곧 떨어지는 2D 횡스크롤 도트 게임 (최대 5명 실시간)
// 규칙: 발판을 밟으면 0.5초 뒤 떨어짐. 아래층으로 계속 내려가다 맨 밑 국물에 빠지면 탈락. 마지막까지 남으면 승리.
(function () {
  const VW = 384, VH = 216, T = 16, COLS = 22, MX = (VW - COLS * T) / 2, FLOORS = 5, TOP = 46, GAP = 34, TH = 6;
  const PW = 8, PH = 12, SPD = 80, JV = 152, G = 520, DELAY = .5, LAVA = 204, MAX = 5;
  const FLOOR_COL = ['#f2c14e', '#e59a4e', '#d4523f', '#8a5bd0', '#3f7fd6'];
  const rnd = (a, b) => a + Math.random() * (b - a);

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
  function makeSim(roster, hooks = {}) {
    const tiles = new Uint8Array(FLOORS * COLS), tAt = new Float32Array(FLOORS * COLS);
    const n = roster.length;
    const ents = roster.map((r, i) => ({ ...r, x: MX + (i + 1) * (COLS * T) / (n + 1) - PW / 2, y: TOP - PH, vx: 0, vy: 0, ground: true, alive: true, face: i < n / 2 ? 1 : -1, walk: 0, tx: 0, ty: 0, ai: { dir: Math.random() < .5 ? -1 : 1, t: rnd(.2, .6) } }));
    ents.forEach(e => { e.tx = e.x; e.ty = e.y; });
    const sim = { tiles, tAt, ents, time: 0, go: false, over: false, order: [], rank: null };
    sim.trigger = k => { if (tiles[k] === 0) { tiles[k] = 1; tAt[k] = sim.time + DELAY; return true; } return false; };
    sim.kill = id => { const e = ents.find(x => x.id === id); if (e && e.alive) { e.alive = false; sim.order.push(e); } };
    function physics(e, dt, dir, jump) {
      e.vx = dir * SPD; if (dir) e.face = dir;
      if (jump && e.ground) { e.vy = -JV; e.ground = false; }
      e.vy += G * dt;
      e.x = Math.min(MX + COLS * T - PW, Math.max(MX, e.x + e.vx * dt));
      const prev = e.y + PH; let ny = e.y + e.vy * dt; e.ground = false;
      if (e.vy >= 0) for (let f = 0; f < FLOORS; f++) {
        const top = TOP + f * GAP;
        if (prev <= top + .01 && ny + PH >= top) {
          const c0 = Math.floor((e.x - MX) / T), c1 = Math.floor((e.x + PW - 1 - MX) / T); let hit = false; const fresh = [];
          for (let c = c0; c <= c1; c++) { const k = f * COLS + c; if (c >= 0 && c < COLS && tiles[k] < 2) { hit = true; if (sim.trigger(k)) fresh.push(k); } }
          if (hit) { ny = top - PH; e.vy = 0; e.ground = true; if (fresh.length && e.kind === 'me' && hooks.onTiles) hooks.onTiles(fresh); break; }
        }
      }
      e.y = ny; if (e.ground && dir) e.walk += dt * 10;
      if (e.y + PH > LAVA) { sim.kill(e.id); if (e.kind === 'me' && hooks.onDead) hooks.onDead(); }
    }
    sim.step = (dt, input) => {
      sim.time += dt;
      for (let k = 0; k < tiles.length; k++) if (tiles[k] === 1 && sim.time >= tAt[k]) { tiles[k] = 2; tAt[k] = sim.time; }
      if (!sim.go || sim.over) return;
      for (const e of ents) {
        if (!e.alive) continue;
        if (e.kind === 'me') physics(e, dt, (input.r ? 1 : 0) - (input.l ? 1 : 0), input.j);
        else if (e.kind === 'bot') {
          const a = e.ai; a.t -= dt; let jump = false;
          if (a.t <= 0) { a.t = rnd(.25, .8); if (Math.random() < .22) a.dir *= -1; if (Math.random() < .5) jump = true; }
          if (e.ground) { const f = Math.round((e.y + PH - TOP) / GAP), c = Math.floor((e.x + (a.dir > 0 ? PW + 4 : -4) - MX) / T);
            if (c < 0 || c >= COLS) a.dir *= -1; else if (tiles[f * COLS + c] === 2) { if (Math.random() < .75) jump = true; else a.dir *= -1; } }
          physics(e, dt, a.dir, jump);
        } else { e.tx += e.vx * dt; e.ty += e.vy * dt; const k = Math.min(1, dt * 14); e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; if (Math.abs(e.vx) > 1) e.walk += dt * 10; }
      }
      const alive = ents.filter(e => e.alive);
      if (n > 1 ? alive.length <= 1 : alive.length === 0) { sim.over = true; sim.rank = alive.concat(sim.order.slice().reverse()); if (hooks.onOver) hooks.onOver(sim.rank); }
    };
    return sim;
  }

  function draw(g, sim, t) {
    g.imageSmoothingEnabled = false;
    if (bg.complete && bg.naturalWidth) g.drawImage(bg, 0, 0, VW, VH); else { g.fillStyle = '#1a120c'; g.fillRect(0, 0, VW, VH); }
    g.fillStyle = 'rgba(10,7,5,.42)'; g.fillRect(0, 0, VW, VH);
    for (let f = 0; f < FLOORS; f++) for (let c = 0; c < COLS; c++) {
      const k = f * COLS + c, st = sim.tiles[k]; let x = MX + c * T, y = TOP + f * GAP, a = 1;
      if (st === 1) { x += Math.round(Math.sin(t * 70 + c) * 1); y += Math.round(Math.cos(t * 55 + c)); }
      if (st === 2) { const d = sim.time - sim.tAt[k]; if (d > .45) continue; y += d * d * 260; a = 1 - d / .45; }
      g.globalAlpha = a; g.fillStyle = '#2a190d'; g.fillRect(x, y, T - 1, TH + 1);
      g.fillStyle = st === 1 ? '#fff6e8' : FLOOR_COL[f]; g.fillRect(x, y, T - 1, TH - 1);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, T - 1, 1);
      g.globalAlpha = 1;
    }
    for (let x = 0; x < VW; x += 8) { const h = 3 + Math.round(Math.sin(t * 3 + x * .2) * 2); g.fillStyle = '#ffb347'; g.fillRect(x, LAVA + 4 - h, 8, 2); g.fillStyle = '#e8622c'; g.fillRect(x, LAVA + 6 - h, 8, VH); }
    for (const e of sim.ents) {
      if (!e.alive) continue;
      const fr = e.ground && Math.floor(e.walk) % 2 ? 1 : 0, sp = SPR[e.skin % 5][e.ground ? fr : 1], x = Math.round(e.x - 2), y = Math.round(e.y - 2);
      g.save(); if (e.face < 0) { g.translate(x + 12, y); g.scale(-1, 1); g.drawImage(sp, 0, 0); } else g.drawImage(sp, x, y); g.restore();
    }
  }

  // ── 화면 ──
  function render(view, ctx) {
    const { esc, toast } = ctx;
    view.innerHTML = `<div class="page game">
      <div class="ph"><div><h1>와르르 슈고</h1><p>밟은 발판은 곧 떨어져. 계속 뛰어다니면서 마지막까지 살아남아.</p></div><div class="ph__act"><a class="btn" href="#/games">게임 목록</a></div></div>
      <div class="g-wrap">
        <div><div class="g-stage" id="stage"><canvas id="gc" width="${VW}" height="${VH}"></canvas><div class="g-tags" id="tags"></div><div class="g-over" id="over" hidden></div></div>
          <div class="g-pad" id="pad"><button data-k="l" aria-label="왼쪽">◀</button><button data-k="r" aria-label="오른쪽">▶</button><button data-k="j" class="g-jump">점프</button></div>
          <p class="mut g-help">PC: ← → 이동, 스페이스 점프 · 폰: 아래 버튼</p></div>
        <aside class="pn g-side" id="side"></aside>
      </div></div>`;
    const $ = s => view.querySelector(s), cv = $('#gc'), g = cv.getContext('2d'), side = $('#side'), over = $('#over'), tags = $('#tags');
    const input = { l: false, r: false, j: false };
    let sim = null, mode = 'demo', room = null, lobby = null, rooms = [], alive = true, last = 0, sendT = 0, countdown = 0, playing = false, me = Games.me();

    const demoRoster = () => [0, 1, 2, 3, 4].map(i => ({ id: 'd' + i, name: '', skin: i, kind: 'bot' }));
    function startDemo() { mode = 'demo'; playing = false; sim = makeSim(demoRoster(), { onOver: () => setTimeout(() => { if (mode === 'demo') startDemo(); }, 1500) }); sim.go = true; tagsFor([]); }
    function tagsFor(list) { tags.innerHTML = list.map(e => `<span data-id="${esc(e.id)}" class="${e.member ? 'vip' : ''}">${esc(e.name)}</span>`).join(''); }

    function startGame(roster, solo) {
      me = Games.me(); mode = solo ? 'solo' : 'net'; playing = true; over.hidden = true;
      const list = roster.map(r => ({ ...r, kind: r.bot ? 'bot' : r.id === me.id ? 'me' : 'remote' }));
      sim = makeSim(list, {
        onTiles: ks => { if (room && mode === 'net') room.send({ t: 't', k: ks }); },
        onDead: () => { if (room && mode === 'net') room.send({ t: 'd', id: me.id }); },
        onOver: rank => finish(rank)
      });
      tagsFor(list); countdown = 3.2; view.scrollIntoView && $('#stage').scrollIntoView({ block: 'nearest' });
      drawSide();
    }
    function finish(rank) {
      playing = false;
      const mine = rank.findIndex(e => e.id === me.id);
      over.innerHTML = `<div class="g-res"><h2>${mine === 0 ? '살아남았다!' : rank[0] ? esc(rank[0].name) + ' 승리' : '끝'}</h2><ol>${rank.map(e => `<li class="${e.id === me.id ? 'me' : ''}"><img src="${face(e.skin)}" alt=""><span class="${e.member ? 'vip' : ''}">${esc(e.name)}</span></li>`).join('')}</ol><div class="g-res__b"><button class="btn btn--gold" id="again">${mode === 'net' ? '방으로' : '한 판 더'}</button>${mode === 'solo' ? '<button class="btn" id="quit">그만하기</button>' : ''}</div></div>`;
      over.hidden = false;
      const back = () => { over.hidden = true; if (mode === 'net' && room) { room.update({ ready: false }); startDemo(); drawSide(); } else if (mode === 'solo') solo(); };
      $('#again').onclick = back;
      const q = $('#quit'); if (q) q.onclick = () => { over.hidden = true; startDemo(); drawSide(); };
      drawSide();
    }
    function solo() { me = Games.me(); startGame([{ id: me.id, name: me.name, member: me.member, skin: 0 }, ...[1, 2, 3].map(i => ({ id: 'bot' + i, name: '봇슈고' + i, skin: i, bot: true }))], true); }

    // ── 방 ──
    function join(code) {
      if (room) room.leave();
      me = Games.me();
      room = Games.room('waru', code, MAX, {
        onPlayers: () => { announce(); if (playing && mode === 'net' && sim) sim.ents.forEach(e => { if (e.kind === 'remote' && !room.players().some(p => p.id === e.id)) sim.kill(e.id); }); drawSide(); },
        onFull: () => { room = null; toast('방이 꽉 찼어 (최대 5명)', true); drawSide(); },
        onMsg: m => {
          if (m.t === 's' && !playing) startGame(m.r, false);
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

    function drawSide() {
      me = Games.me();
      const nameBox = me.member ? `<div class="g-name"><span class="label">내 이름</span><b class="vip">${esc(me.name)}</b></div>`
        : `<label class="field"><span>내 이름 (이 게임에서만 써)</span><input class="input" id="gname" maxlength="10" placeholder="${esc(me.def)}" value="${esc(me.name === me.def ? '' : me.name)}" ${room ? 'disabled' : ''}></label>`;
      if (!room) {
        side.innerHTML = `<h3 class="pn__h">게임 시작</h3><div class="pn__b g-menu">${nameBox}
          <button class="btn btn--gold btn--lg" id="mk" ${Games.online() ? '' : 'disabled'}>방 만들기</button>
          <button class="btn btn--lg" id="so">혼자 연습 (봇 3마리)</button>
          <div class="g-rooms"><span class="label">열린 방</span>${rooms.length ? rooms.map(r => `<button class="g-room" data-code="${esc(r.code)}" ${r.n >= MAX || r.playing ? 'disabled' : ''}><b>${esc(r.host)}의 방</b><span>${r.playing ? '게임 중' : r.n + '/' + MAX}</span></button>`).join('') : '<p class="mut">지금 열린 방이 없어. 방을 만들고 링크를 보내봐.</p>'}</div></div>`;
        const gn = $('#gname'); if (gn) gn.onchange = () => Games.setGuestName(gn.value);
        $('#mk').onclick = () => { if (gn) Games.setGuestName(gn.value); join(Games.newCode()); };
        $('#so').onclick = () => { if (gn) Games.setGuestName(gn.value); solo(); };
        side.querySelectorAll('[data-code]').forEach(b => b.onclick = () => { if (gn) Games.setGuestName(gn.value); join(b.dataset.code); });
        return;
      }
      const ps = room.players(), host = room.isHost(), mine = ps.find(p => p.id === me.id), others = ps.filter((p, i) => i > 0), allReady = others.every(p => p.ready);
      side.innerHTML = `<h3 class="pn__h">방 ${esc(room.code)}<span>${ps.length}/${MAX}</span></h3><div class="pn__b g-menu">
        <div class="g-players">${Array.from({ length: MAX }, (_, i) => { const p = ps[i]; return p ? `<div class="g-p"><img src="${face(i)}" alt=""><span class="${p.member ? 'vip' : ''}">${esc(p.name)}</span><em>${i === 0 ? '방장' : p.ready ? '준비 완료' : '준비 중'}</em></div>` : `<div class="g-p g-p--empty"><span>빈 자리</span></div>`; }).join('')}</div>
        ${playing ? '<p class="mut">게임 중이야.</p>' : host
          ? `<button class="btn btn--gold btn--lg" id="st" ${allReady ? '' : 'disabled'}>${ps.length === 1 ? '봇이랑 시작' : allReady ? '시작' : '다들 준비하면 시작'}</button>`
          : `<button class="btn ${mine && mine.ready ? '' : 'btn--gold'} btn--lg" id="rd">${mine && mine.ready ? '준비 취소' : '준비'}</button>`}
        <button class="btn" id="cp">초대 링크 복사</button><button class="btn btn--plain" id="lv">방 나가기</button></div>`;
      const st = $('#st'); if (st) st.onclick = () => {
        if (ps.length === 1) { solo(); return; }
        const r = ps.map((p, i) => ({ id: p.id, name: p.name, member: p.member, skin: i }));
        room.send({ t: 's', r }); startGame(r, false); announce();
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
      if (playing && countdown > 0) { countdown -= dt; const n = Math.ceil(countdown - .2); over.hidden = false; over.innerHTML = `<div class="g-count">${n > 0 ? n : '출발!'}</div>`; if (countdown <= 0) { over.hidden = true; sim.go = true; } }
      sim.step(dt, input);
      if (playing && mode === 'net' && sim.go && room) { sendT -= dt; const m = sim.ents.find(e => e.kind === 'me'); if (m && m.alive && sendT <= 0) { sendT = .15; room.send({ t: 'p', id: m.id, x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10, vx: Math.round(m.vx), vy: Math.round(m.vy), f: m.face, g: m.ground ? 1 : 0 }); } }
      draw(g, sim, now / 1000);
      tags.childNodes.forEach(el => { const e = sim.ents.find(x => x.id === el.dataset.id); if (!e || !e.alive) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = ((e.x + PW / 2) / VW * 100) + '%'; el.style.top = ((e.y - 4) / VH * 100) + '%'; });
    }
    startDemo(); drawSide(); requestAnimationFrame(frame);
    if (Games.online()) {
      lobby = Games.lobby('waru', list => { rooms = list; if (!room) drawSide(); });
      const want = new URLSearchParams(location.hash.split('?')[1] || '').get('room');
      if (want) join(want.toUpperCase().slice(0, 4));
    }
    const off = () => { if (location.hash.startsWith('#/game/waru')) return; alive = false; removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('hashchange', off); if (room) room.leave(); if (lobby) lobby.close(); };
    addEventListener('hashchange', off);
  }

  Games.add({ id: 'waru', name: '와르르 슈고', desc: '밟으면 떨어지는 발판 위에서 마지막까지 살아남기', max: MAX, live: true, thumb: 'assets/img/g-game-bg.webp', render });
})();
