// 데이터 저장소: Supabase(실제 운영) 또는 데모(이 브라우저에만 저장). 화면 코드는 window.Store 만 씀.
// 회원 정보: username(로그인 계정) · main_char(본캐 닉네임, 인증용) · char_name(사이트 닉네임, 자유 변경)
//            · contact(비상연락처, 본인과 관리자만 봄) · job · avatar_url
(function () {
  const C = window.SHUGO_CONFIG;
  const LIVE = !!(C.supabaseUrl && C.supabaseAnonKey);

  function idToEmail(username) {       // 아이디(한글 가능) → 로그인용 내부 이메일. 사용자에겐 안 보임
    const hex = Array.from(new TextEncoder().encode(username.trim().toLowerCase())).map(b => b.toString(16).padStart(2, '0')).join('');
    return 'u' + hex + '@member.xn--299a009a7ibxz4b.com';
  }
  async function shrinkImage(file, max = 1600, q = 0.82) {
    const bmp = await createImageBitmap(file);
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * r); cv.height = Math.round(bmp.height * r);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise(res => cv.toBlob(res, 'image/webp', q));
  }
  const subs = { change: new Set(), online: new Set(), msg: new Set() };
  const emit = k => subs[k].forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  const hooks = { onChange: fn => subs.change.add(fn), onOnline: fn => subs.online.add(fn), onMessage: fn => subs.msg.add(fn) };
  function threadsOf(rows, myId, who) {
    const t = new Map();
    rows.forEach(m => { const peer = m.from_id === myId ? m.to_id : m.from_id; let x = t.get(peer);
      if (!x) t.set(peer, x = { peer_id: peer, peer: who(peer), last: m, unread: 0 });
      if (new Date(m.created_at) > new Date(x.last.created_at)) x.last = m;
      if (m.to_id === myId && !m.read_at) x.unread++; });
    return [...t.values()].sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  }

  // ───────────── 실제 운영 (Supabase) ─────────────
  function liveStore() {
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
    const P = 'char_name,job,avatar_url';                 // 누구에게나 보이는 정보
    const RP = P + ',main_char';                           // 로그인한 사람에게만 (레이드 명단용)
    const err = e => { if (e) throw new Error(e.message || String(e)); };
    let me = null, online = [], chOnline = null, chMsg = null;

    async function loadMe() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { me = null; } else { const { data } = await sb.rpc('my_profile'); me = (data && data[0]) || null; }
      realtime();
      return me;
    }
    function realtime() {
      const ok = me && me.status === 'approved';
      if (chOnline) { sb.removeChannel(chOnline); chOnline = null; online = []; emit('online'); }
      if (chMsg) { sb.removeChannel(chMsg); chMsg = null; }
      if (!ok) return;
      chOnline = sb.channel('online', { config: { presence: { key: me.id } } });
      chOnline.on('presence', { event: 'sync' }, () => { online = Object.values(chOnline.presenceState()).map(a => a[0]); emit('online'); })
        .subscribe(s => { if (s === 'SUBSCRIBED') chOnline.track({ id: me.id, char_name: me.char_name, job: me.job, avatar_url: me.avatar_url }); });
      chMsg = sb.channel('msg-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'to_id=eq.' + me.id }, () => emit('msg')).subscribe();
    }

    return {
      live: true, ...hooks,
      async init() { await loadMe(); },
      me: () => me,
      online: () => online,

      async signUp({ username, password, mainChar, nick, contact }) {
        const { error } = await sb.auth.signUp({ email: idToEmail(username), password,
          options: { data: { username: username.trim(), char_name: nick.trim(), main_char: mainChar.trim(), contact: (contact || '').trim() } } });
        if (error && /registered|exists/i.test(error.message)) throw new Error('이미 있는 계정이라거');
        err(error); await loadMe(); emit('change');
      },
      async signIn({ username, password }) {
        const { error } = await sb.auth.signInWithPassword({ email: idToEmail(username), password });
        if (error) throw new Error('계정이나 비밀번호가 틀렸다거');
        await loadMe(); emit('change');
      },
      async signOut() { await sb.auth.signOut(); me = null; realtime(); emit('change'); },
      async myContact() { const { data } = await sb.from('profile_private').select('contact').eq('id', me.id).maybeSingle(); return data?.contact || ''; },
      async updateMe({ charName, job, contact, avatarFile, removeAvatar }) {
        const patch = { char_name: charName, job };
        if (avatarFile) {
          const blob = await shrinkImage(avatarFile, 320, 0.85), path = me.id + '/avatar-' + Date.now() + '.webp';
          const { error } = await sb.storage.from('images').upload(path, blob, { contentType: 'image/webp' }); err(error);
          patch.avatar_url = sb.storage.from('images').getPublicUrl(path).data.publicUrl;
        } else if (removeAvatar) patch.avatar_url = null;
        const { error } = await sb.from('profiles').update(patch).eq('id', me.id); err(error);
        if (contact !== undefined) { const r = await sb.from('profile_private').upsert({ id: me.id, contact }); err(r.error); }
        await loadMe(); emit('change');
      },
      async changePassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); err(error); },

      // 관리자: 비밀번호만 빼고 전부 볼 수 있음. 비밀번호는 새로 정해주기만 가능
      async listProfiles() { const { data, error } = await sb.rpc('admin_list_profiles'); err(error); return data; },
      async listPending() { const { data, error } = await sb.rpc('pending_signups'); err(error); return data || []; },
      async decidePending(id, approve) { const { error } = await sb.rpc('pending_decide', { target: id, approve }); err(error); },
      async listMembers() { const { data, error } = await sb.from('profiles').select('id,' + RP).eq('status', 'approved').order('char_name'); err(error); return data; },
      async setStatus(id, status) { const { error } = await sb.rpc('admin_set_status', { target: id, new_status: status }); err(error); },
      async deleteRejected(id) { const { data, error } = await sb.rpc('admin_delete_rejected', id ? { target: id } : {}); err(error); return data || 0; },
      async setRole(id, role) { const { error } = await sb.rpc('admin_set_role', { target: id, new_role: role }); err(error); },
      async resetPassword(id, pw) { const { error } = await sb.rpc('admin_reset_password', { target: id, new_password: pw }); err(error); },

      // 게시판
      async listPosts({ cat, limit = 30 } = {}) {
        let q = sb.from('posts').select(`*, author:profiles!posts_author_id_fkey(${P}), comments(count)`).order('created_at', { ascending: false }).limit(limit);
        if (cat) q = q.eq('cat', cat);
        const { data, error } = await q; err(error);
        return data.map(p => ({ ...p, comment_count: p.comments?.[0]?.count || 0 }));
      },
      async getPost(id) { const { data, error } = await sb.from('posts').select(`*, author:profiles!posts_author_id_fkey(${P})`).eq('id', id).maybeSingle(); err(error); return data; },
      async createPost({ cat, title, body, files }) {
        const images = [];
        for (const f of files || []) {
          const blob = await shrinkImage(f), path = me.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.webp';
          const { error } = await sb.storage.from('images').upload(path, blob, { contentType: 'image/webp' }); err(error);
          images.push(sb.storage.from('images').getPublicUrl(path).data.publicUrl);
        }
        const { data, error } = await sb.from('posts').insert({ cat, title, body, images }).select('id').single(); err(error); return data.id;
      },
      async deletePost(id) { const { error } = await sb.from('posts').delete().eq('id', id); err(error); },
      async listComments(postId) { const { data, error } = await sb.from('comments').select(`*, author:profiles!comments_author_id_fkey(${P})`).eq('post_id', postId).order('created_at'); err(error); return data; },
      async addComment(postId, body) { const { error } = await sb.from('comments').insert({ post_id: postId, body }); err(error); },
      async deleteComment(id) { const { error } = await sb.from('comments').delete().eq('id', id); err(error); },

      async getNotice() { const { data } = await sb.from('site_notice').select('text').eq('id', 1).maybeSingle(); return data?.text || ''; },
      async setNotice(text) { const { error } = await sb.rpc('admin_set_notice', { new_text: text }); err(error); },

      // 레이드
      async listRaids() {
        const { data, error } = await sb.from('raids').select(`*, author:profiles!raids_author_id_fkey(${P}), members:raid_members(user_id, role, profile:profiles!raid_members_user_id_fkey(${RP}))`)
          .gte('starts_at', new Date(Date.now() - 6 * 3600e3).toISOString()).order('starts_at');
        err(error); return data;
      },
      async createRaid(r) { const { data, error } = await sb.from('raids').insert(r).select('id').single(); err(error); return data.id; },
      async deleteRaid(id) { const { error } = await sb.from('raids').delete().eq('id', id); err(error); },
      async joinRaid(id, role) { const { error } = await sb.from('raid_members').upsert({ raid_id: id, user_id: me.id, role }); err(error); },
      async leaveRaid(id) { const { error } = await sb.from('raid_members').delete().eq('raid_id', id).eq('user_id', me.id); err(error); },

      // 폰 알림
      async getPushOffsets() { const { data } = await sb.from('push_prefs').select('offsets').eq('user_id', me.id).maybeSingle(); return data ? data.offsets : [60, 10]; },
      async setPushOffsets(offsets) { const { error } = await sb.from('push_prefs').upsert({ user_id: me.id, offsets }); err(error); },
      async savePushSub(j) { const { error } = await sb.from('push_subs').upsert({ endpoint: j.endpoint, user_id: me.id, p256dh: j.keys.p256dh, auth: j.keys.auth }); err(error); },
      async removePushSub(endpoint) { await sb.from('push_subs').delete().eq('endpoint', endpoint); },

      // 쪽지
      async listThreads() {
        const { data, error } = await sb.from('messages').select('*').or(`from_id.eq.${me.id},to_id.eq.${me.id}`).order('created_at', { ascending: false }).limit(400); err(error);
        const ids = [...new Set(data.map(m => m.from_id === me.id ? m.to_id : m.from_id))];
        const pr = ids.length ? (await sb.from('profiles').select('id,' + P).in('id', ids)).data || [] : [];
        return threadsOf(data, me.id, id => pr.find(p => p.id === id) || { char_name: '(탈퇴)' });
      },
      async listMessages(peer) {
        const { data, error } = await sb.from('messages').select('*').or(`and(from_id.eq.${me.id},to_id.eq.${peer}),and(from_id.eq.${peer},to_id.eq.${me.id})`).order('created_at').limit(200); err(error); return data;
      },
      async sendMessage(peer, body) { const { error } = await sb.from('messages').insert({ to_id: peer, body }); err(error); },
      async markRead(peer) { await sb.from('messages').update({ read_at: new Date().toISOString() }).eq('to_id', me.id).eq('from_id', peer).is('read_at', null); emit('msg'); },
      async unreadCount() { const { count } = await sb.from('messages').select('id', { count: 'exact', head: true }).eq('to_id', me.id).is('read_at', null); return count || 0; }
    };
  }

  // ───────────── 데모 (이 브라우저에만 저장) ─────────────
  function demoStore() {
    const KEY = 'shugo_demo_v4';
    const load = () => {
      try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.users) return d; } catch (e) {}
      return { seq: 10, session: null, notice: '', posts: [], comments: [], raids: [], raid_members: [], messages: [],
        users: [{ id: 'u1', username: 'admin', pw: 'admin', char_name: '상회장', main_char: '상회장', contact: '', job: '수호성', status: 'approved', role: 'owner', created_at: new Date().toISOString() }] };
    };
    let db = load();
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw new Error('브라우저 저장공간이 꽉 찼다거. 사진을 줄여서 다시 해보라거'); } };
    const nid = () => String(++db.seq);
    const pub = u => u && ({ id: u.id, username: u.username, char_name: u.char_name, main_char: u.main_char || '', job: u.job || '', avatar_url: u.avatar_url || null, status: u.status, role: u.role, created_at: u.created_at });
    const who = id => { const u = db.users.find(x => x.id === id); return u ? pub(u) : { username: '?', char_name: '(탈퇴)' }; };
    const meRaw = () => db.users.find(u => u.id === db.session);
    const need = (c, m) => { if (!c) throw new Error(m); };
    const approved = () => { const m = meRaw(); need(m && m.status === 'approved', '승인된 상회원 전용'); return m; };
    const admin = () => { const m = approved(); need(m.role === 'owner' || m.role === 'manager', '관리자 전용'); return m; };
    const owner = () => { const m = approved(); need(m.role === 'owner', '상회장 전용'); return m; };
    const guard = id => { const m = admin(), t = db.users.find(u => u.id === id); need(m.role === 'owner' || t.role !== 'owner', '상회장 계정은 상회장만 변경 가능'); return t; };
    const toDataUrl = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });

    return {
      live: false, ...hooks,
      async init() {},
      me: () => pub(meRaw()),
      online: () => { const m = meRaw(); return m && m.status === 'approved' ? [pub(m)] : []; },

      async signUp({ username, password, mainChar, nick, contact }) {
        need(!db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase()), '이미 있는 계정이라거');
        const u = { id: 'u' + nid(), username: username.trim(), pw: password, char_name: nick.trim(), main_char: mainChar.trim(), contact: (contact || '').trim(), job: '', status: 'pending', role: 'member', created_at: new Date().toISOString() };
        db.users.push(u); db.session = u.id; save(); emit('change');
      },
      async signIn({ username, password }) {
        const u = db.users.find(x => x.username.toLowerCase() === username.trim().toLowerCase() && x.pw === password);
        need(u, '계정이나 비밀번호가 틀렸다거'); db.session = u.id; save(); emit('change'); emit('online');
      },
      async signOut() { db.session = null; save(); emit('change'); emit('online'); },
      async myContact() { return meRaw()?.contact || ''; },
      async updateMe({ charName, job, contact, avatarFile, removeAvatar }) {
        const m = meRaw(); m.char_name = charName; m.job = job; if (contact !== undefined) m.contact = contact;
        if (avatarFile) m.avatar_url = await toDataUrl(await shrinkImage(avatarFile, 240, 0.8)); else if (removeAvatar) m.avatar_url = null;
        save(); emit('change'); emit('online');
      },
      async changePassword(pw) { meRaw().pw = pw; save(); },

      async listProfiles() { admin(); return db.users.map(u => ({ ...pub(u), contact: u.contact || '' })).reverse(); },
      async listPending() { const m = approved(); need(['ai', 'manager', 'owner'].includes(m.role), '볼 수 없다거'); return db.users.filter(u => u.status === 'pending').map(u => ({ id: u.id, char_name: u.char_name, main_char: u.main_char, created_at: u.created_at })).reverse(); },
      async decidePending(id, approve) { const m = approved(); need(['ai', 'manager', 'owner'].includes(m.role), '할 수 없다거'); const t = db.users.find(u => u.id === id); need(t && t.status === 'pending', '승인 대기 중인 사람이 아니라거'); t.status = approve ? 'approved' : 'rejected'; save(); emit('change'); },
      async listMembers() { approved(); return db.users.filter(u => u.status === 'approved').map(pub); },
      async setStatus(id, status) { guard(id).status = status; save(); emit('change'); },
      async deleteRejected(id) { admin(); const gone = db.users.filter(u => u.status === 'rejected' && (u.role || 'member') === 'member' && (!id || u.id === id)); db.users = db.users.filter(u => !gone.includes(u)); save(); emit('change'); return gone.length; },
      async setRole(id, role) { const m = owner(), t = db.users.find(u => u.id === id); need(t.id !== m.id && t.role !== 'owner' && ['member', 'manager'].includes(role), '바꿀 수 없는 등급이라거'); t.role = role; save(); emit('change'); },
      async resetPassword(id, pw) { guard(id).pw = pw; save(); },

      async listPosts({ cat, limit = 30 } = {}) {
        return db.posts.filter(p => !cat || p.cat === cat).slice().reverse().slice(0, limit).map(p => ({ ...p, author: who(p.author_id), comment_count: db.comments.filter(c => c.post_id === p.id).length }));
      },
      async getPost(id) { const p = db.posts.find(x => x.id === id); return p && { ...p, author: who(p.author_id) }; },
      async createPost({ cat, title, body, files }) {
        const m = approved(), images = [];
        for (const f of files || []) images.push(await toDataUrl(await shrinkImage(f, 1000, 0.7)));
        const p = { id: nid(), author_id: m.id, cat, title, body, images, created_at: new Date().toISOString() };
        db.posts.push(p); save(); return p.id;
      },
      async deletePost(id) { const m = approved(), p = db.posts.find(x => x.id === id); need(p.author_id === m.id || m.role !== 'member', '내 글만 삭제 가능');
        db.posts = db.posts.filter(x => x.id !== id); db.comments = db.comments.filter(c => c.post_id !== id); save(); },
      async listComments(postId) { return db.comments.filter(c => c.post_id === postId).map(c => ({ ...c, author: who(c.author_id) })); },
      async addComment(postId, body) { const m = approved(); db.comments.push({ id: nid(), post_id: postId, author_id: m.id, body, created_at: new Date().toISOString() }); save(); },
      async deleteComment(id) { const m = approved(), c = db.comments.find(x => x.id === id); need(c.author_id === m.id || m.role !== 'member', '내 댓글만 삭제 가능'); db.comments = db.comments.filter(x => x.id !== id); save(); },

      async getNotice() { return db.notice || ''; },
      async setNotice(text) { admin(); db.notice = text; save(); },

      async listRaids() {
        approved(); const since = Date.now() - 6 * 3600e3;
        return db.raids.filter(r => new Date(r.starts_at).getTime() >= since).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
          .map(r => ({ ...r, author: who(r.author_id), members: db.raid_members.filter(x => x.raid_id === r.id).map(x => ({ user_id: x.user_id, role: x.role, profile: who(x.user_id) })) }));
      },
      async createRaid(r) { const m = approved(), id = nid(); db.raids.push({ ...r, id, author_id: m.id, created_at: new Date().toISOString() }); save(); return id; },
      async deleteRaid(id) { const m = approved(), r = db.raids.find(x => x.id === id); need(r.author_id === m.id || m.role !== 'member', '모집한 사람만 삭제 가능');
        db.raids = db.raids.filter(x => x.id !== id); db.raid_members = db.raid_members.filter(x => x.raid_id !== id); save(); },
      async joinRaid(id, role) { const m = approved(), ex = db.raid_members.find(x => x.raid_id === id && x.user_id === m.id); if (ex) ex.role = role; else db.raid_members.push({ raid_id: id, user_id: m.id, role }); save(); },
      async leaveRaid(id) { const m = approved(); db.raid_members = db.raid_members.filter(x => !(x.raid_id === id && x.user_id === m.id)); save(); },

      async getPushOffsets() { const m = meRaw(); return m && m.offsets ? m.offsets : [60, 10]; },
      async setPushOffsets(offsets) { meRaw().offsets = offsets; save(); },
      async savePushSub() {}, async removePushSub() {},

      async listThreads() { const m = approved(); return threadsOf(db.messages.filter(x => x.from_id === m.id || x.to_id === m.id), m.id, who); },
      async listMessages(peer) { const m = approved(); return db.messages.filter(x => (x.from_id === m.id && x.to_id === peer) || (x.from_id === peer && x.to_id === m.id)); },
      async sendMessage(peer, body) { const m = approved(); db.messages.push({ id: nid(), from_id: m.id, to_id: peer, body, created_at: new Date().toISOString(), read_at: null }); save(); },
      async markRead(peer) { const m = approved(); db.messages.forEach(x => { if (x.to_id === m.id && x.from_id === peer && !x.read_at) x.read_at = new Date().toISOString(); }); save(); emit('msg'); },
      async unreadCount() { const m = meRaw(); return m ? db.messages.filter(x => x.to_id === m.id && !x.read_at).length : 0; }
    };
  }

  window.Store = LIVE ? liveStore() : demoStore();
})();
