// 미니게임 공통 틀. 게임을 늘릴 땐 Games.add({...}) 한 번이면 게임 목록에 들어감.
//   id, name, desc, max(최대 인원), render(view, ctx)
// 모든 게임이 같이 쓰는 것:
//   - 닉네임: 로그인한 상회원은 사이트 닉네임(반짝임), 게스트는 그 자리에서만 쓰는 이름(안 정하면 게스트123)
//   - 방: 최대 인원까지 들어와서 준비 → 방장이 시작. 실시간 연결은 Supabase Realtime(로그인 없이도 됨)
(function () {
  const C = window.SHUGO_CONFIG;
  let client = null;
  const uid = () => Math.random().toString(36).slice(2, 10);
  const ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  const Games = {
    list: [],
    add(g) { this.list.push(g); },
    get(id) { return this.list.find(g => g.id === id); },
    online: () => !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase),

    // 이 탭에서의 나
    me() {
      let id = ss.get('shugo_gid'); if (!id) { id = uid(); ss.set('shugo_gid', id); }
      const u = window.Store && Store.me();
      if (u) return { id, name: u.char_name || u.username || '상회원', member: true };
      let def = ss.get('shugo_gdef'); if (!def) { def = '게스트' + (100 + Math.floor(Math.random() * 900)); ss.set('shugo_gdef', def); }
      return { id, name: (ss.get('shugo_gname') || '').trim() || def, member: false, def };
    },
    setGuestName(n) { ss.set('shugo_gname', String(n || '').trim().slice(0, 10)); },

    net() {
      if (!client) client = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'shugo-games' }, realtime: { params: { eventsPerSecond: 20 } } });
      return client;
    },

    // 열려 있는 방 목록 보기 (방장들이 여기에 자기 방을 알림)
    lobby(gameId, onRooms) {
      const ch = this.net().channel('g-' + gameId + '-lobby', { config: { presence: { key: 'v' + uid() } } });
      const sync = () => { const seen = {}; Object.values(ch.presenceState()).forEach(a => a.forEach(p => { if (p.code) seen[p.code] = p; })); onRooms(Object.values(seen)); };
      ch.on('presence', { event: 'sync' }, sync).subscribe();
      return { ch, announce(info) { return ch.track(info); }, quiet() { return ch.untrack(); }, close() { Games.net().removeChannel(ch); } };
    },

    // 방 하나
    room(gameId, code, max, cb) {
      const me = this.me(), at = Date.now();
      const ch = this.net().channel('g-' + gameId + '-' + code, { config: { broadcast: { self: false }, presence: { key: me.id } } });
      let state = { id: me.id, name: me.name, member: me.member, ready: false, at }, players = [], joined = false;
      const sync = () => {
        players = Object.values(ch.presenceState()).map(a => a[0]).filter(p => p && p.id).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
        if (joined && players.findIndex(p => p.id === me.id) >= max) { api.leave(); cb.onFull && cb.onFull(); return; }
        cb.onPlayers && cb.onPlayers(players);
      };
      ch.on('presence', { event: 'sync' }, sync)
        .on('broadcast', { event: 'm' }, ({ payload }) => cb.onMsg && cb.onMsg(payload))
        .subscribe(async s => { if (s === 'SUBSCRIBED') { await ch.track(state); joined = true; } });
      const api = {
        code, me,
        players: () => players,
        isHost: () => players.length > 0 && players[0].id === me.id,
        update(patch) { state = { ...state, ...patch }; return ch.track(state); },
        send(payload) { ch.send({ type: 'broadcast', event: 'm', payload }); },
        leave() { joined = false; Games.net().removeChannel(ch); }
      };
      return api;
    },
    newCode: () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('')
  };

  // ── 소리: 모든 게임이 같이 쓰는 전체 소리 크기 (이 기기에 기억) ──
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const A = { ctx: null, master: null, v: .6, el: null, direct: false, want: false };
  { const s = parseFloat(ls.get('shugo_vol')); if (s >= 0 && s <= 1) A.v = s; }
  function ac() {
    if (!A.ctx) { const X = window.AudioContext || window.webkitAudioContext; if (!X) return null; A.ctx = new X(); A.master = A.ctx.createGain(); A.master.gain.value = A.v; A.master.connect(A.ctx.destination); }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }
  Games.sound = {
    vol: () => A.v,
    setVol(v) { A.v = Math.min(1, Math.max(0, +v || 0)); ls.set('shugo_vol', A.v); if (A.master) A.master.gain.value = A.v; if (A.el && A.direct) A.el.volume = A.v * .5; },
    unlock() { ac(); },
    // 짧은 삑 소리: f → f2 로 미끄러짐
    tone({ f, f2, t = .1, type = 'sine', g = .2, at = 0 }) {
      const c = ac(); if (!c || A.v <= 0) return;
      const t0 = c.currentTime + at, o = c.createOscillator(), gn = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + t);
      gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(g, t0 + .008); gn.gain.exponentialRampToValueAtTime(.0001, t0 + t);
      o.connect(gn); gn.connect(A.master); o.start(t0); o.stop(t0 + t + .02);
    },
    // 치익 소리
    noise({ t = .3, g = .1, f = 1500, at = 0 }) {
      const c = ac(); if (!c || A.v <= 0) return;
      const t0 = c.currentTime + at, len = Math.ceil(c.sampleRate * t), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), lp = c.createBiquadFilter(), gn = c.createGain(); src.buffer = buf;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(f, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + t);
      gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(.0001, t0 + t);
      src.connect(lp); lp.connect(gn); gn.connect(A.master); src.start(t0);
    },
    bgm: {
      // 첫 터치 때 미리 깨워 둠 (아이폰은 누른 순간에만 소리를 틀 수 있어서)
      prime(url) {
        if (A.el) return;
        const el = new Audio(url); el.loop = true; el.preload = 'auto'; A.el = el;
        const c = ac();
        try { const src = c.createMediaElementSource(el), gn = c.createGain(); gn.gain.value = .5; src.connect(gn); gn.connect(A.master); }
        catch (e) { A.direct = true; el.volume = A.v * .5; }
        el.muted = true; const p = el.play();
        const done = () => { if (!A.want) { el.pause(); el.currentTime = 0; } el.muted = false; };
        if (p && p.then) p.then(done).catch(() => { el.muted = false; }); else done();
      },
      play(url) { A.want = true; this.prime(url); A.el.muted = false; const p = A.el.play(); if (p && p.catch) p.catch(() => {}); },
      pause() { A.want = false; if (A.el) A.el.pause(); }
    }
  };
  window.Games = Games;
})();
