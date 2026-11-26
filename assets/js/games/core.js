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
  window.Games = Games;
})();
