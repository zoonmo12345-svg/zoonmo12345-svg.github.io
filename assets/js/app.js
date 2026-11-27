// 슈고상회 앱 화면
(function () {
  const C = window.SHUGO_CONFIG, S = window.Store;
  const view = document.getElementById('view');
  const JOBS = ['검성', '수호성', '살성', '궁성', '마도성', '정령성', '치유성', '호법성', '권성', '기타'];
  const ROLES = ['탱커', '힐러', '딜러', '서포터'];

  // ───── 도우미 ─────
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el = view) => el.querySelector(sel);
  const $$ = (sel, el = view) => [...el.querySelectorAll(sel)];
  const KST = { timeZone: 'Asia/Seoul' };
  const fmtDate = d => new Date(d).toLocaleDateString('ko-KR', { ...KST, month: 'long', day: 'numeric', weekday: 'short' });
  const fmtTime = d => new Date(d).toLocaleTimeString('ko-KR', { ...KST, hour: '2-digit', minute: '2-digit', hour12: false });
  const dayKey = d => new Date(d).toLocaleDateString('sv-SE', KST);
  function ago(d) {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전'; if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
    return new Date(d).toLocaleDateString('ko-KR', { ...KST, year: '2-digit', month: 'numeric', day: 'numeric' });
  }
  function until(d) {
    const m = Math.round((new Date(d) - Date.now()) / 60000);
    if (m <= 0) return '출발함'; if (m < 60) return m + '분 뒤';
    if (m < 60 * 24) return Math.floor(m / 60) + '시간 ' + (m % 60 ? (m % 60) + '분 ' : '') + '뒤';
    return Math.floor(m / 1440) + '일 뒤';
  }
  const boardName = id => (C.boards.find(b => b.id === id) || {}).name || id;
  const nick = p => p?.char_name || p?.username || '?';
  const avatar = (p, cls = '') => p?.avatar_url ? `<img class="avatar ${cls}" src="${esc(p.avatar_url)}" alt="">` : `<span class="avatar ${cls}">${esc(nick(p).slice(0, 1))}</span>`;
  const me = () => S.me();
  const isOk = () => me()?.status === 'approved' && me().role !== 'ai';
  const isAdmin = () => isOk() && (me().role === 'owner' || me().role === 'manager');     // 상회장 + 관리슈고
  const isOwner = () => isOk() && me().role === 'owner';
  const isAi = () => me()?.status === 'approved' && me().role === 'ai';                                          // 보조AI: 승인 대기 명단 보기 + 승인·거절만
  const roleTag = u => u.role === 'owner' ? '<span class="tag tag--gold">상회장</span>' : u.role === 'manager' ? '<span class="tag tag--teal">관리슈고</span>' : u.role === 'ai' ? '<span class="tag">보조AI</span>' : '';
  const rid = v => S.live ? Number(v) : v;
  const go = h => { location.hash = h; };

  let toastT;
  function toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  async function run(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } catch (e) { toast(e.message || '실패했어', true); } finally { if (btn) btn.disabled = false; }
  }
  const sheetEl = document.getElementById('sheet');
  function sheet(html) { sheetEl.innerHTML = html; sheetEl.showModal(); $$('[data-close]', sheetEl).forEach(b => b.onclick = () => sheetEl.close()); return sheetEl; }
  sheetEl.onclick = e => { if (e.target === sheetEl) sheetEl.close(); };

  // ───── 아이콘 (전부 같은 굵기의 선 아이콘) ─────
  const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    home: I('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    flame: I('<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 1.5-4.5C10 10 11.5 8 12 3z"/><path d="M12 21a2.2 2.2 0 0 1-2.2-2.2c0-1.4 2.2-3.3 2.2-3.3s2.2 1.9 2.2 3.3A2.2 2.2 0 0 1 12 21z"/>'),
    snow: I('<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"/><path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2M3.6 10.6l3-.8-.8-3M20.4 13.4l-3 .8.8 3M3.6 13.4l3 .8-.8 3M20.4 10.6l-3-.8.8-3"/>'),
    raid: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15h3"/>'),
    board: I('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/>'),
    admin: I('<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
    tools: I('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    down: I('<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>'),
    go: I('<path d="M5 12h14m-6-6 6 6-6 6"/>'),
    game: I('<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 12.5h4M9 10.5v4M15.5 11.5v.01M18 13.5v.01"/>'),
    pic: I('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>'),
    bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
    mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>')
  };

  // ───── 메뉴 ─────
  let pendingCount = 0;
  function navItems() {
    const a = [{ href: '#/home', key: 'home', name: '홈', tip: '홈', icon: IC.home }, { sep: 1 }];
    Tools.list.forEach(t => a.push({ href: '#/tool/' + t.id, key: 'tool/' + t.id, name: t.name, tip: t.full || t.name, icon: IC[t.icon] || IC.tools, find: t.full }));
    a.push({ sep: 1 }, { href: '#/raid', key: 'raid', name: '레이드 모집', tip: '레이드 모집', icon: IC.raid }, { href: '#/board', key: 'board', name: '게시판', tip: '게시판', icon: IC.board });
    a.push({ href: '#/games', key: 'games', name: '미니게임', tip: '미니게임', icon: IC.game });
    if (C.showDownloads) a.push({ href: '#/downloads', key: 'downloads', name: '다운로드', tip: '다운로드', icon: IC.down });
    if (isAdmin()) a.push({ sep: 1 }, { href: '#/admin', key: 'admin', name: '사이트관리', tip: '사이트관리', icon: IC.admin, n: pendingCount });
    if (isAi()) a.push({ sep: 1 }, { href: '#/pending', key: 'pending', name: '승인 대기', tip: '승인 대기', icon: IC.admin, n: pendingCount });
    return a;
  }
  function renderNav(cur) {
    document.getElementById('railNav').innerHTML = navItems().map(it => it.sep ? '<div class="rail__sep"></div>'
      : `<a class="rail__btn ${cur === it.key ? 'on' : ''}" href="${it.href}" data-tip="${esc(it.tip)}" aria-label="${esc(it.tip)}">${it.icon}<span class="tx">${esc(it.name)}</span>${it.n ? `<span class="n">${it.n}</span>` : ''}</a>`).join('');
    const top = cur.split('/')[0];
    const dock = [['#/home', 'home', '홈', IC.home], ['#/tools', 'tool', '도구', IC.tools], ['#/games', 'games', '게임', IC.game], ['#/raid', 'raid', '레이드', IC.raid], ['#/board', 'board', '게시판', IC.board], ['#/me', 'me', '내 정보', IC.user]];
    document.getElementById('dock').innerHTML = dock.map(([h, k, n, ic]) => `<a href="${h}" class="${top === k || (k === 'tool' && top === 'tools') || (k === 'games' && top === 'game') ? 'on' : ''}">${ic}<span>${n}</span></a>`).join('');
  }
  // 접힌 메뉴에서 마우스 올리면 이름 보여주기
  const rail = document.getElementById('rail'), tip = document.getElementById('tip');
  rail.addEventListener('mouseover', e => {
    const b = e.target.closest('[data-tip]');
    if (!b || document.body.classList.contains('rail-open')) { tip.hidden = true; return; }
    const r = b.getBoundingClientRect();
    tip.textContent = b.dataset.tip; tip.style.left = (r.right + 10) + 'px'; tip.style.top = (r.top + r.height / 2) + 'px'; tip.hidden = false;
  });
  rail.addEventListener('mouseleave', () => { tip.hidden = true; });
  const railKey = 'shugo_rail_open', railToggle = document.getElementById('railToggle');
  function setRail(open) {
    document.body.classList.toggle('rail-open', open); railToggle.setAttribute('aria-expanded', open);
    railToggle.dataset.tip = open ? '메뉴 접기' : '메뉴 펼치기'; tip.hidden = true;
    try { localStorage.setItem(railKey, open ? '1' : '0'); } catch (e) {}
  }
  railToggle.onclick = () => setRail(!document.body.classList.contains('rail-open'));
  try { setRail(localStorage.getItem(railKey) === '1'); } catch (e) {}

  // 메뉴 찾기 (Ctrl+K)
  const pal = document.getElementById('palette'), palIn = document.getElementById('paletteInput'), palList = document.getElementById('paletteList');
  let palSel = 0;
  function palItems() {
    const a = navItems().filter(x => !x.sep).map(x => ({ href: x.href, name: x.find || x.name, icon: x.icon }));
    if (C.boards.length > 1) C.boards.forEach(b => a.push({ href: '#/board/' + b.id, name: '게시판 › ' + b.name, icon: IC.board }));
    a.push({ href: '#/me', name: '내 정보', icon: IC.user }, { href: '#/intro', name: '소개 페이지', icon: IC.go });
    return a;
  }
  function palRender() {
    const q = palIn.value.trim().toLowerCase();
    const items = palItems().filter(it => !q || it.name.toLowerCase().includes(q));
    palSel = Math.min(palSel, Math.max(0, items.length - 1));
    palList.innerHTML = items.map((it, i) => `<a href="${it.href}" class="${i === palSel ? 'sel' : ''}" role="option">${it.icon}${esc(it.name)}</a>`).join('') || '<div class="empty">없는 메뉴야</div>';
    $$('a', palList).forEach(a => a.onclick = () => pal.close());
  }
  function openPal() { palIn.value = ''; palSel = 0; palRender(); pal.showModal(); palIn.focus(); }
  document.querySelectorAll('[data-palette]').forEach(b => b.onclick = openPal);
  palIn.oninput = () => { palSel = 0; palRender(); };
  palIn.onkeydown = e => {
    const n = $$('a', palList).length; if (!n) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); palSel = (palSel + 1) % n; palRender(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); palSel = (palSel - 1 + n) % n; palRender(); }
    if (e.key === 'Enter') { const a = $$('a', palList)[palSel]; if (a) { location.hash = a.getAttribute('href'); pal.close(); } }
  };
  pal.onclick = e => { if (e.target === pal) pal.close(); };
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.open ? pal.close() : openPal(); } });

  function renderBar(title) {
    const u = me();
    document.getElementById('barUser').innerHTML = !u ? `<a class="btn btn--plain btn--sm" href="#/login">로그인</a><a class="btn btn--gold btn--sm" href="#/signup">가입</a>`
      : `<a class="me" href="#/me" aria-label="내 정보">${avatar(u)}<span class="nm">${esc(nick(u))}</span>${u.status === 'pending' ? '<span class="tag">승인 대기</span>' : ''}</a>`;
    if (title != null) document.getElementById('barTitle').textContent = title;
  }

  // ───── 공용 조각 ─────
  function gate(kind) {
    const m = {
      login: ['상회원만 쓸 수 있어', '로그인하고 상회장 승인을 받으면 열려.', `<a class="btn btn--gold" href="#/login">로그인</a><a class="btn" href="#/signup">가입하기</a>`],
      pending: ['승인 기다리는 중', '상회장이 승인하면 바로 열려. 디스코드에 닉네임 남기면 더 빨라.', `<a class="btn" href="${esc(C.discord)}" target="_blank" rel="noopener">디스코드 열기</a>`],
      rejected: ['승인이 안 됐어', '상회장에게 디스코드로 물어봐.', `<a class="btn" href="${esc(C.discord)}" target="_blank" rel="noopener">디스코드 열기</a>`]
    }[kind];
    return `<div class="gate"><h2>${m[0]}</h2><p>${m[1]}</p><div class="acts">${m[2]}</div></div>`;
  }
  const needMember = () => !me() ? gate('login') : me().status !== 'approved' ? gate(me().status) : '';
  const postCard = p => `<a class="pc" href="#/post/${p.id}"><div class="pc__pic">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : `<div class="pc__txt">${esc(p.body || p.title)}</div>`}</div>
    <h3>${esc(p.title)}</h3><div class="meta"><span>${esc(boardName(p.cat))}</span><span>${esc(nick(p.author))}</span><span>${ago(p.created_at)}</span>${p.comment_count ? `<span>댓글 ${p.comment_count}</span>` : ''}</div></a>`;

  // ───── 홈 ─────
  const pips = (n, slots, mine, sm) => `<span class="pips ${sm ? 'pips--sm' : ''}" aria-hidden="true">${Array.from({ length: slots }, (_, i) => `<i class="${i < n ? (mine && i === n - 1 ? 'me' : 'on') : ''}"></i>`).join('')}</span>`;
  const shortDate = d => dayKey(d) === dayKey(Date.now()) ? fmtTime(d) : new Date(d).toLocaleDateString('ko-KR', { ...KST, month: '2-digit', day: '2-digit' }).replace(/\. ?/g, '.').replace(/\.$/, '');
  const setK = (id, n) => { const el = $('#' + id); if (el) { el.dataset.count = n; Fx.refresh(view); } };
  async function home() {
    const u = me(), ok = isOk();
    view.innerHTML = `<div class="page"><div class="dash">
      <div class="kpis">
        <a class="kpi kpi--teal" href="${ok ? '#/msg' : '#/login'}"><b class="num" id="kOn">${S.online().length}</b><span>접속 중</span></a>
        <a class="kpi kpi--gold" href="#/raid"><b class="num" id="kRaid">-</b><span>잡힌 레이드</span></a>
        <a class="kpi" href="#/board"><b class="num" id="kPost">-</b><span>오늘 새 글</span></a>
        <a class="kpi kpi--red" href="${ok ? '#/msg' : '#/login'}"><b class="num" id="kMsg">-</b><span>안 읽은 쪽지</span></a>
      </div>
      <a class="gbanner c12" href="#/games" data-spot>
        <div><span class="eyebrow">미니게임 · 가입 없이 바로</span><h2>와르르 슈고</h2><p>밟으면 떨어지는 발판 위에서 끝까지 살아남기. 최대 5명이 같이 해.</p></div>
        <span class="btn btn--gold btn--lg">게임 하러 가기 ${IC.go}</span></a>
      <section class="pn c8" id="hero" data-spot><div class="hr"><div><span class="eyebrow">다음 레이드</span><h2 class="mut">불러오는 중</h2></div></div></section>
      <section class="pn c4"><h3 class="pn__h">상회 공지</h3><div class="notice none" id="notice">불러오는 중</div></section>
      <section class="pn c5"><h3 class="pn__h">레이드 일정<a href="#/raid">전체 보기</a></h3><div class="pn__b list" id="sched"></div></section>
      <section class="pn c4"><h3 class="pn__h">최근 글<a href="#/board">게시판</a></h3><div class="pn__b list" id="latest"></div></section>
      <section class="pn c3"><h3 class="pn__h">공대장 도구</h3><div class="pn__b" style="padding-top:12px">
        ${Tools.list.map(t => `<a class="tbtn" href="#/tool/${t.id}" data-tilt>${IC[t.icon] || IC.tools}<span>${esc(t.name)}<small>${esc(t.desc || '')}</small></span>${IC.go}</a>`).join('')}
        <div class="links"><a class="btn btn--sm" href="${esc(C.discord)}" target="_blank" rel="noopener">디스코드</a><a class="btn btn--sm" href="${esc(C.kakao)}" target="_blank" rel="noopener">카카오톡</a><a class="btn btn--sm btn--plain" href="#/me">알림 설정</a></div>
      </div></section>
    </div></div>`;

    S.getNotice().then(t => { const el = $('#notice'); if (!el) return; el.textContent = t || '지금은 공지가 없어'; el.classList.toggle('none', !t); }).catch(() => {});
    S.listPosts({ limit: 40 }).then(ps => {
      setK('kPost', ps.filter(p => dayKey(p.created_at) === dayKey(Date.now())).length);
      $('#latest').innerHTML = ps.length ? ps.slice(0, 7).map(p => `<a href="#/post/${p.id}">${C.boards.length > 1 ? `<span class="tag">${esc(boardName(p.cat))}</span>` : ''}<span class="t">${esc(p.title)}${p.comment_count ? ` <em style="font-style:normal;color:var(--gold);font-size:12px">[${p.comment_count}]</em>` : ''}</span><span class="m num">${shortDate(p.created_at)}</span></a>`).join('') : `<div class="mut">아직 글이 없어</div>`;
    }).catch(() => {});
    setK('kMsg', unread);
    const hero = $('#hero'), sched = $('#sched');
    if (!ok) {
      setK('kRaid', 0);
      hero.innerHTML = `<div class="hr"><div><span class="eyebrow">다음 레이드</span><h2>${u ? '승인을 기다리는 중이야' : '상회원이 되면 일정이 보여'}</h2>
        <p class="hr__meta">${u ? '상회장이 승인하면 모집·참여·알림이 열려.' : '가입하고 상회장 승인을 받으면 모집에 참여하고 폰 알림도 받을 수 있어.'}</p>
        <div class="hr__act">${u ? `<a class="btn btn--lg" href="#/me">내 정보</a>` : `<a class="btn btn--gold btn--lg" href="#/signup">가입하기</a><a class="btn btn--lg" href="#/login">로그인</a>`}</div></div></div>`;
      sched.innerHTML = `<div class="mut">상회원만 볼 수 있어</div>`;
      return;
    }
    S.listRaids().then(rs => {
      rs = rs.filter(r => new Date(r.starts_at) > Date.now() - 3600e3);
      setK('kRaid', rs.length);
      if (!rs.length) {
        hero.innerHTML = `<div class="hr"><div><span class="eyebrow">다음 레이드</span><h2>잡힌 레이드가 없어</h2><p class="hr__meta">먼저 모집을 올려서 사람을 모아봐.</p><div class="hr__act"><a class="btn btn--gold btn--lg" href="#/raid">모집 올리기</a></div></div></div>`;
        sched.innerHTML = `<div class="mut">일정이 비어 있어</div>`; return;
      }
      const f = rs[0], mem = f.members || [], mine = mem.some(m => m.user_id === u.id), tool = Tools.list.find(t => t.dungeon && t.dungeon === f.dungeon);
      hero.innerHTML = `<div class="hr"><div>
          <span class="eyebrow">다음 레이드</span><h2>${esc(f.title)}</h2>
          <p class="hr__meta">${f.dungeon ? esc(f.dungeon) + ' · ' : ''}${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)} 출발 · ${esc(nick(f.author))} 모집</p>
          <div class="hr__seats">${pips(mem.length, f.slots, mine)}<b class="num">${mem.length}/${f.slots}</b>${mine ? '<span class="tag tag--teal">참여 중</span>' : ''}</div>
          <div class="hr__act"><a class="btn btn--gold btn--lg" href="#/raid">${mine ? '명단 보기' : '참여하기'}</a>${tool ? `<a class="btn btn--lg" href="#/tool/${tool.id}?raid=${f.id}">자리 넣기</a>` : ''}</div></div>
        <div class="cd--big" data-cd="${esc(f.starts_at)}" data-cdf="big"><span data-lb>출발까지</span>
          <div class="cd__row"><span data-day hidden><b data-u="d">0</b><i>일</i></span><span><b data-u="h">00</b><i>시간</i></span><span><b data-u="m">00</b><i>분</i></span><span><b data-u="s">00</b><i>초</i></span></div></div></div>`;
      sched.innerHTML = rs.slice(0, 6).map(r => { const m2 = r.members || []; return `<a href="#/raid"><span class="when num">${fmtTime(r.starts_at)}</span><span class="t">${esc(r.title)}</span>${pips(m2.length, r.slots, m2.some(x => x.user_id === u.id), true)}<span class="cdr" data-cd="${esc(r.starts_at)}"></span></a>`; }).join('');
      Fx.refresh(view);
    }).catch(() => { hero.innerHTML = ''; });
  }

  // ───── 미니게임 ─────
  function gamesPage() {
    view.innerHTML = `<div class="page page--mid"><div class="ph"><div><h1>미니게임</h1><p>가입 안 해도 바로 할 수 있어. 상회원은 닉네임이 반짝여.</p></div></div>
      <div class="glist">${Games.list.map(g => `<a class="gcard" href="#/game/${g.id}" data-tilt><div class="gcard__pic" style="background-image:url('${g.thumb}')"></div><div class="gcard__b"><h2>${esc(g.name)}</h2><p>${esc(g.desc)}</p><div class="meta"><span class="tag tag--gold">최대 ${g.max}명</span>${g.live ? '<span class="tag tag--teal">실시간</span>' : ''}</div></div></a>`).join('')}
      <div class="gcard gcard--soon"><div class="gcard__b"><h2>다음 게임</h2><p>준비 중이야.</p></div></div></div></div>`;
  }
  function gamePage(id) { const g = Games.get(id); if (!g) return go('#/games'); g.render(view, { esc, toast, me, isOk }); }

  // ───── 도구 ─────
  function toolsPage() {
    view.innerHTML = `<div class="page page--narrow"><div class="ph"><h1>도구</h1></div><div class="list">${Tools.list.map(t => `<a href="#/tool/${t.id}">${IC[t.icon] || IC.tools}<span class="t">${esc(t.full || t.name)}</span><span class="m">${esc(t.desc || '')}</span></a>`).join('')}</div></div>`;
  }
  function toolPage(id) {
    const t = Tools.get(id); if (!t) return go('#/tools');
    t.render(view, { esc, toast, me, isOk, S, sheet, JOBS, fmtDate, fmtTime });
  }

  // ───── 가입·로그인 ─────
  function login() {
    if (me()) return go('#/home');
    view.innerHTML = `<div class="page"><div class="auth"><h1>로그인</h1><p>아이디와 비밀번호를 넣어줘.</p>
      <form class="form" id="f"><label class="field"><span>아이디</span><input class="input" name="username" autocomplete="username" required autofocus></label>
      <label class="field"><span>비밀번호</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
      <p class="err" id="err"></p><button class="btn btn--gold btn--lg">로그인</button></form>
      <p class="auth__alt">처음이야? <a href="#/signup">가입하기</a> · 비밀번호를 잊었으면 상회장에게 초기화를 부탁해.</p></div></div>`;
    $('#f').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
      run(e.submitter, async () => { try { await S.signIn({ username: f.get('username'), password: f.get('password') }); } catch (x) { $('#err').textContent = x.message; return; } go('#/home'); }); };
  }
  function signup() {
    if (me()) return go('#/me');
    view.innerHTML = `<div class="page"><div class="auth"><h1>상회원 가입</h1><p>가입하면 상회장이 확인하고 승인해줘. 닉네임과 프로필 사진은 가입 뒤에 언제든 바꿀 수 있어.</p>
      <form class="form" id="f">
        <label class="field"><span>로그인 계정</span><input class="input" name="username" autocomplete="username" required minlength="2" maxlength="20" pattern="[0-9A-Za-z가-힣_]+" autofocus><small>한글·영문·숫자 2~20자</small></label>
        <div class="row2"><label class="field"><span>비밀번호</span><input class="input" type="password" name="password" autocomplete="new-password" required minlength="6"><small>6자 이상</small></label>
        <label class="field"><span>비밀번호 다시</span><input class="input" type="password" name="password2" autocomplete="new-password" required></label></div>
        <label class="field"><span>본캐 닉네임 (필수)</span><input class="input" name="mainChar" required maxlength="20"><small>게임 안 본캐 이름. 상회장이 이걸 보고 상회원인지 확인해</small></label>
        <label class="field"><span>사이트 닉네임</span><input class="input" name="nick" maxlength="20" placeholder="비우면 본캐 닉네임 그대로"><small>사이트에서 보이는 이름. 언제든 자유롭게 바꿀 수 있어</small></label>
        <label class="field"><span>비상연락처 (선택)</span><input class="input" name="contact" maxlength="100" placeholder="전화, 카톡 아이디, 디스코드 등 아무거나"><small>상회장만 볼 수 있어</small></label>
        <p class="err" id="err"></p><button class="btn btn--gold btn--lg">가입 신청</button></form>
      <p class="auth__alt">이미 가입했어? <a href="#/login">로그인</a></p></div></div>`;
    $('#f').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
      if (f.get('password') !== f.get('password2')) { $('#err').textContent = '비밀번호 두 칸이 서로 달라'; return; }
      run(e.submitter, async () => { try { await S.signUp({ username: f.get('username'), password: f.get('password'), mainChar: f.get('mainChar'), nick: f.get('nick').trim() || f.get('mainChar'), contact: f.get('contact') }); } catch (x) { $('#err').textContent = x.message; return; } toast('가입 신청 완료. 승인을 기다려줘'); go('#/me'); }); };
  }

  // ───── 내 정보 (닉네임·프로필 사진) ─────
  function mePage() {
    const u = me(); if (!u) return go('#/login');
    const st = { approved: ['tag--teal', '상회원'], pending: ['', '승인 대기'], rejected: ['tag--red', '승인 거절'] }[u.status];
    let file = null, remove = false;
    view.innerHTML = `<div class="page page--narrow">
      <div class="ph"><div><h1>내 정보</h1><p>아이디 ${esc(u.username)} · <span class="tag ${st[0]}">${st[1]}</span>${roleTag(u) ? ' · ' + roleTag(u) : ''}</p></div>
        <div class="ph__act">${isAdmin() ? '<a class="btn" href="#/admin">사이트관리</a>' : ''}<button class="btn btn--plain" id="out">로그아웃</button></div></div>
      ${u.status !== 'approved' ? `<div class="box" style="margin-bottom:12px">${gate(u.status)}</div>` : ''}
      <form class="box form" id="pf">
        <div class="pf"><span id="av">${avatar(u, 'avatar--lg')}</span><div><b>프로필 사진</b><div class="mut" style="font-size:12.5px">글·댓글·모집 명단에 보여</div>
          <div class="pf__btns"><label class="btn btn--sm">사진 고르기<input type="file" id="avFile" accept="image/*" hidden></label><button type="button" class="btn btn--sm btn--plain" id="avDel">지우기</button></div></div></div>
        <div class="row2"><label class="field"><span>사이트 닉네임</span><input class="input" name="charName" value="${esc(u.char_name)}" required maxlength="20"></label>
        <label class="field"><span>직업</span><select class="select" name="job"><option value="">안 정함</option>${JOBS.map(j => `<option ${j === u.job ? 'selected' : ''}>${j}</option>`).join('')}</select></label></div>
        <div class="row2"><label class="field"><span>본캐 닉네임</span><input class="input" value="${esc(u.main_char)}" disabled><small>바꾸려면 상회장에게 말해줘</small></label>
        <label class="field"><span>비상연락처</span><input class="input" name="contact" id="contact" maxlength="100" placeholder="비워둬도 돼"><small>상회장만 볼 수 있어</small></label></div>
        <div><button class="btn btn--gold">저장</button></div></form>
      <form class="box form" id="pw"><label class="field"><span>새 비밀번호</span><input class="input" type="password" name="pw" autocomplete="new-password" minlength="${S.live ? 6 : 1}" required></label>
        <div><button class="btn">비밀번호 바꾸기</button></div></form></div>`;
    $('#avFile').onchange = e => { file = e.target.files[0] || null; remove = false; if (file) $('#av').innerHTML = `<img class="avatar avatar--lg" src="${URL.createObjectURL(file)}" alt="">`; };
    $('#avDel').onclick = () => { file = null; remove = true; $('#av').innerHTML = avatar({ char_name: $('[name=charName]').value }, 'avatar--lg'); };
    $('#pf').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
      run(e.submitter, async () => { await S.updateMe({ charName: f.get('charName').trim(), job: f.get('job'), contact: f.get('contact').trim(), avatarFile: file, removeAvatar: remove }); toast('저장했어'); mePage(); }); };
    S.myContact().then(c => { const el = $('#contact'); if (el) el.value = c; }).catch(() => {});
    pushBox();
    $('#pw').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); run(e.submitter, async () => { await S.changePassword(f.get('pw')); e.target.reset(); toast('비밀번호 바꿨어'); }); };
    $('#out').onclick = () => run(null, async () => { await S.signOut(); go('#/home'); });
  }

  // ───── 게시판 ─────
  async function board(cat) {
    const write = isOk() ? `<a class="btn btn--gold" href="#/write${cat ? '?cat=' + cat : ''}">글쓰기</a>` : '';
    view.innerHTML = `<div class="page"><div class="ph"><h1>게시판</h1><div class="ph__act">${write}</div></div>
      <div class="dc__tools"><nav class="seg" ${C.boards.length > 1 ? '' : 'hidden'}><a href="#/board" class="${!cat ? 'on' : ''}">전체</a>${C.boards.map(b => `<a href="#/board/${b.id}" class="${cat === b.id ? 'on' : ''}">${esc(b.name)}</a>`).join('')}</nav>
        <input class="input" id="bq" placeholder="제목·글쓴이 검색" aria-label="게시판 검색"></div>
      <div id="list"><div class="empty">불러오는 중</div></div></div>`;
    const ps = await S.listPosts({ cat, limit: 300 }).catch(e => { toast(e.message, true); return []; });
    if (!$('#list')) return;
    $('#list').innerHTML = ps.length ? `<div class="dc ${C.boards.length > 1 ? '' : 'dc--one'}"><div class="dc__h"><span>번호</span><span>말머리</span><span>제목</span><span>글쓴이</span><span>날짜</span></div>
      ${ps.map((p, i) => `<a class="dc__r" href="#/post/${p.id}" ${p.images?.[0] ? `data-img="${esc(p.images[0])}"` : ''}><span class="num">${ps.length - i}</span><span class="dc__cat">${esc(boardName(p.cat))}</span>
        <span class="dc__t"><b>${esc(p.title)}</b>${p.images?.length ? IC.pic : ''}${p.comment_count ? `<em>[${p.comment_count}]</em>` : ''}</span>
        <span class="dc__w">${avatar(p.author)}${esc(nick(p.author))}</span><span class="num">${shortDate(p.created_at)}</span></a>`).join('')}</div>`
      : `<div class="empty"><b>아직 글이 없어</b>${isOk() ? '첫 글을 올려봐.' : '글쓰기는 상회원만 할 수 있어.'}</div>`;
    $('#bq').oninput = e => { const v = e.target.value.trim().toLowerCase(); $$('.dc__r').forEach(r => r.hidden = v && !r.textContent.toLowerCase().includes(v)); };
  }
  async function post(id) {
    view.innerHTML = `<div class="page page--narrow"><div class="empty">불러오는 중</div></div>`;
    const p = await S.getPost(rid(id)).catch(() => null);
    if (!p) { view.innerHTML = `<div class="page page--narrow"><div class="empty"><b>없는 글이야</b><a class="btn btn--sm" href="#/board" style="margin-top:8px">게시판으로</a></div></div>`; return; }
    const u = me(), mine = u && (p.author_id === u.id || isAdmin());
    view.innerHTML = `<div class="page page--narrow"><article class="post">
      <a class="btn btn--plain btn--sm" href="#/board/${esc(p.cat)}" style="margin-left:-10px">← ${esc(boardName(p.cat))}</a>
      <h1>${esc(p.title)}</h1>
      <div class="meta">${avatar(p.author)}<span style="color:var(--ink);font-weight:700">${esc(nick(p.author))}</span>${p.author?.job ? `<span>${esc(p.author.job)}</span>` : ''}<span>${ago(p.created_at)}</span>${mine ? '<button class="btn btn--plain btn--sm" id="del" style="margin-left:auto">지우기</button>' : ''}</div>
      ${p.body ? `<div class="post__body">${esc(p.body)}</div>` : '<div style="height:16px"></div>'}
      <div class="post__imgs">${(p.images || []).map((s, i) => `<img src="${esc(s)}" alt="${esc(p.title)} 사진 ${i + 1}" loading="lazy">`).join('')}</div>
      <section class="sec"><div class="sec__h"><h2>댓글</h2></div><div id="cmts"></div>
        ${isOk() ? `<form id="cf" style="display:flex;gap:6px;margin-top:12px"><input class="input" name="body" maxlength="1000" required placeholder="댓글" aria-label="댓글"><button class="btn btn--gold">등록</button></form>` : `<p class="mut" style="margin-top:12px">댓글은 상회원만 달 수 있어.</p>`}
      </section></article></div>`;
    async function loadC() {
      const cs = await S.listComments(p.id);
      $('#cmts').innerHTML = cs.length ? cs.map(c => `<div class="cmt">${avatar(c.author)}<div class="cmt__b"><div class="meta"><b style="color:var(--ink)">${esc(nick(c.author))}</b><span>${ago(c.created_at)}</span>${u && (c.author_id === u.id || isAdmin()) ? `<button class="btn btn--plain btn--sm" data-dc="${c.id}" style="margin-left:auto">지우기</button>` : ''}</div><p>${esc(c.body)}</p></div></div>`).join('') : '<p class="empty">아직 댓글이 없어</p>';
      $$('[data-dc]').forEach(b => b.onclick = () => run(b, async () => { await S.deleteComment(rid(b.dataset.dc)); loadC(); }));
    }
    loadC();
    if ($('#del')) $('#del').onclick = () => { if (confirm('이 글을 지울까?')) run($('#del'), async () => { await S.deletePost(p.id); go('#/board/' + p.cat); }); };
    if ($('#cf')) $('#cf').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); run(e.submitter, async () => { await S.addComment(p.id, f.get('body').trim()); e.target.reset(); loadC(); }); };
  }
  function write(q) {
    const block = needMember(), cat0 = q.get('cat') || 'free';
    if (block) { view.innerHTML = `<div class="page page--narrow">${block}</div>`; return; }
    view.innerHTML = `<div class="page page--narrow"><div class="ph"><h1>글쓰기</h1></div>
      <form class="form" id="f">
        <div class="${C.boards.length > 1 ? 'row2' : ''}"><label class="field" ${C.boards.length > 1 ? '' : 'hidden'}><span>게시판</span><select class="select" name="cat">${C.boards.map(b => `<option value="${b.id}" ${b.id === cat0 ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
        <label class="field"><span>제목</span><input class="input" name="title" required maxlength="80" autofocus></label></div>
        <label class="field"><span>내용</span><textarea class="textarea" name="body" maxlength="5000"></textarea></label>
        <div class="field"><span>사진 (6장까지, 붙여넣기도 됨)</span><div><label class="btn btn--sm">사진 고르기<input type="file" id="files" accept="image/*" multiple hidden></label></div><div class="thumbs" id="th"></div></div>
        <div style="display:flex;gap:6px"><button class="btn btn--gold btn--lg">올리기</button><a class="btn btn--lg btn--plain" href="#/board">취소</a></div>
      </form></div>`;
    let files = [];
    const show = () => { $('#th').innerHTML = files.map((f, i) => `<img src="${URL.createObjectURL(f)}" alt="" title="누르면 빼기" data-i="${i}" style="cursor:pointer">`).join(''); $$('#th img').forEach(im => im.onclick = () => { files.splice(Number(im.dataset.i), 1); show(); }); };
    const add = list => { files = files.concat([...list].filter(f => f.type.startsWith('image/'))).slice(0, 6); show(); };
    $('#files').onchange = e => { add(e.target.files); e.target.value = ''; };
    $('#f').addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); add(fs); } });
    $('#f').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
      run(e.submitter, async () => { const id = await S.createPost({ cat: f.get('cat'), title: f.get('title').trim(), body: f.get('body').trim(), files }); go('#/post/' + id); }); };
  }

  // ───── 레이드 모집 (10인 고정, 출발까지 남은 시간이 실시간으로 줄어듦) ─────
  const RAID_SIZE = 10;
  // 출발 시간 고르기: 빠른 버튼 · 날짜 7일 · 시 · 분을 마우스로 누름
  function whenPicker(el, start) {
    let sel = new Date(start); sel.setSeconds(0, 0);
    const WD = '일월화수목금토', pad = n => String(n).padStart(2, '0');
    const day0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
    const at = (addDays, h, m) => { const d = day0(); d.setDate(d.getDate() + addDays); d.setHours(h, m, 0, 0); return d; };
    const quick = [['30분 뒤', () => { const d = new Date(Date.now() + 30 * 60000); d.setMinutes(Math.ceil(d.getMinutes() / 10) * 10, 0, 0); return d; }],
      ['1시간 뒤', () => { const d = new Date(Date.now() + 60 * 60000); d.setMinutes(Math.ceil(d.getMinutes() / 10) * 10, 0, 0); return d; }],
      ['오늘 21시', () => at(0, 21, 0)], ['내일 21시', () => at(1, 21, 0)]];
    function draw() {
      const dayIdx = Math.round((new Date(sel.getFullYear(), sel.getMonth(), sel.getDate()) - day0()) / 86400e3);
      const diff = Math.round((sel - Date.now()) / 60000), past = diff <= 0;
      const rel = past ? '이미 지난 시간이야' : (diff >= 1440 ? Math.floor(diff / 1440) + '일 ' : '') + (diff % 1440 >= 60 ? Math.floor(diff % 1440 / 60) + '시간 ' : '') + (diff % 60) + '분 뒤 출발';
      el.innerHTML = `<div class="when__row when__q">${quick.map((q, i) => `<button type="button" data-q="${i}">${q[0]}</button>`).join('')}</div>
        <span class="when__lb">날짜</span><div class="when__row when__d">${Array.from({ length: 7 }, (_, i) => { const d = at(i, 0, 0); return `<button type="button" data-d="${i}" class="${i === dayIdx ? 'on' : ''}">${i === 0 ? '오늘' : i === 1 ? '내일' : d.getDate() + '일'}<small>${WD[d.getDay()]}</small></button>`; }).join('')}</div>
        <span class="when__lb">시</span><div class="when__row when__h">${Array.from({ length: 24 }, (_, h) => `<button type="button" data-h="${h}" class="${h === sel.getHours() ? 'on' : ''}">${h}</button>`).join('')}</div>
        <span class="when__lb">분</span><div class="when__row when__m">${[0, 10, 20, 30, 40, 50].map(m => `<button type="button" data-m="${m}" class="${m === sel.getMinutes() ? 'on' : ''}">${pad(m)}</button>`).join('')}</div>
        <div class="when__out ${past ? 'past' : ''}">${sel.getMonth() + 1}월 ${sel.getDate()}일 (${WD[sel.getDay()]}) ${pad(sel.getHours())}:${pad(sel.getMinutes())}<small>${rel}</small></div>`;
      el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { sel = quick[b.dataset.q][1](); draw(); });
      el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const d = at(Number(b.dataset.d), sel.getHours(), sel.getMinutes()); sel = d; draw(); });
      el.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { sel.setHours(Number(b.dataset.h)); draw(); });
      el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { sel.setMinutes(Number(b.dataset.m)); draw(); });
    }
    draw();
    return { get: () => new Date(sel) };
  }
  async function raid() {
    const block = needMember();
    if (block) { view.innerHTML = `<div class="page page--mid"><div class="ph"><h1>레이드 모집</h1></div>${block}</div>`; return; }
    view.innerHTML = `<div class="page page--mid"><div class="ph"><div><h1>레이드 모집</h1><p>${RAID_SIZE}인 공대 · 지난 모집은 6시간 뒤 사라져</p></div>
      <div class="ph__act"><a class="btn btn--plain" href="#/me">${IC.bell}알림 설정</a><button class="btn btn--gold" id="openNew">모집 올리기</button></div></div><div id="list"><div class="empty">불러오는 중</div></div></div>`;
    $('#openNew').onclick = () => {
      const pad = n => String(n).padStart(2, '0'), t = new Date(Date.now() + 3600e3); t.setMinutes(0, 0, 0);
      const d = sheet(`<h2>모집 올리기</h2><p>인원은 ${RAID_SIZE}명으로 고정이야.</p><form class="form" id="nf">
        <label class="field"><span>제목</span><input class="input" name="title" required maxlength="60" placeholder="예) 무스펠 2넴 트라이" autofocus></label>
        <div><label class="field"><span>던전</span><select class="select" name="dungeon"><option value="">안 고름</option>${Tools.list.filter(t => t.dungeon).map(t => `<option>${esc(t.dungeon)}</option>`).join('')}</select></label></div>
        <div class="field"><span>출발</span><div class="when" id="when"></div></div>
        <div class="row2"><label class="field"><span>내 역할 (나는 자동으로 참여돼)</span><select class="select" name="role">${ROLES.map(x => `<option ${x === '딜러' ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="field"><span>메모</span><input class="input" name="note" maxlength="200" placeholder="조건, 모이는 곳"></label></div>
        <div class="acts"><button type="button" class="btn btn--plain" data-close>취소</button><button class="btn btn--gold">올리기</button></div></form>`);
      const picker = whenPicker($('#when', d), t);
      $('#nf', d).onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
        if (picker.get() <= Date.now()) { toast('이미 지난 시간이야. 출발 시간을 다시 골라줘', true); return; }
        run(e.submitter, async () => { await S.createRaid({ title: f.get('title').trim(), dungeon: f.get('dungeon'), starts_at: picker.get().toISOString(), slots: RAID_SIZE, note: f.get('note').trim() }).then(id => S.joinRaid(id, f.get('role'))); d.close(); load(); refreshStatus(); }); };
    };
    async function load() {
      const rs = await S.listRaids().catch(e => { toast(e.message, true); return []; });
      if (!$('#list')) return;
      if (!rs.length) { $('#list').innerHTML = `<div class="empty"><b>잡힌 레이드가 없어</b>오른쪽 위 '모집 올리기'로 시작해.</div>`; return; }
      const u = me(), days = {};
      rs.forEach(r => (days[dayKey(r.starts_at)] ||= []).push(r));
      $('#list').innerHTML = Object.values(days).map(list => `<section class="rday"><h2>${fmtDate(list[0].starts_at)}</h2>${list.map(r => {
        const mem = r.members || [], mine = mem.find(m => m.user_id === u.id), full = mem.length >= r.slots;
        const tool = Tools.list.find(t => t.dungeon && t.dungeon === r.dungeon);
        return `<article class="raid" data-spot><div class="raid__t num">${fmtTime(r.starts_at)}</div>
          <div><h3>${esc(r.title)}</h3><div class="meta" style="margin-top:4px">${r.dungeon ? `<span class="tag">${esc(r.dungeon)}</span>` : ''}<span>${esc(nick(r.author))} 모집</span></div>
            ${r.note ? `<p class="note2">${esc(r.note)}</p>` : ''}
            <div class="raid__row">${pips(mem.length, r.slots, !!mine)}<b class="num">${mem.length}/${r.slots}</b>${full ? '<span class="tag tag--red">마감</span>' : ''}</div>
            <div class="who">${mem.map(m => `<span class="${m.user_id === u.id ? 'me2' : ''}">${esc(m.role)} ${esc(nick(m.profile))}</span>`).join('')}</div></div>
          <div class="raid__side"><span class="cdr" data-cd="${esc(r.starts_at)}"></span>
            <div class="raid__act">${mine ? `<button class="btn btn--sm" data-leave="${r.id}">참여 취소</button>` : full ? ''
              : `<select class="select" data-role="${r.id}" aria-label="역할">${ROLES.map(x => `<option ${x === '딜러' ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="btn btn--gold btn--sm" data-join="${r.id}">참여</button>`}
              ${tool ? `<a class="btn btn--sm" href="#/tool/${tool.id}?raid=${r.id}">자리 넣기</a>` : ''}
              ${r.author_id === u.id || isAdmin() ? `<button class="btn btn--plain btn--sm" data-delr="${r.id}">지우기</button>` : ''}</div></div></article>`;
      }).join('')}</section>`).join('');
      Fx.refresh(view);
      $$('[data-join]').forEach(b => b.onclick = () => run(b, async () => { await S.joinRaid(rid(b.dataset.join), $(`[data-role="${b.dataset.join}"]`).value); load(); }));
      $$('[data-leave]').forEach(b => b.onclick = () => run(b, async () => { await S.leaveRaid(rid(b.dataset.leave)); load(); }));
      $$('[data-delr]').forEach(b => b.onclick = () => { if (confirm('이 모집을 지울까?')) run(b, async () => { await S.deleteRaid(rid(b.dataset.delr)); load(); refreshStatus(); }); });
    }
    load();
  }

  // ───── 폰 알림 (내 정보 안) ─────
  async function pushBox() {
    const page = $('.page'); if (!page || !isOk()) return;
    const box = document.createElement('div'); box.className = 'box form'; box.id = 'pushBox';
    let offs = []; try { offs = await S.getPushOffsets(); } catch (e) {}
    const custom = offs.find(o => !Push.OPTIONS.includes(o)) || '';
    box.innerHTML = `<div><b>레이드 알림</b><div class="mut" style="font-size:12.5px">내가 참여한 레이드가 출발하기 전에 이 기기로 알려줘. 언제 받을지 골라.</div></div>
      <div class="checks">${Push.OPTIONS.map(o => `<label><input type="checkbox" value="${o}" ${offs.includes(o) ? 'checked' : ''}>${Push.label(o)} 전</label>`).join('')}
        <label>직접 <input class="input" id="pCustom" type="number" min="1" max="10080" value="${custom}" placeholder="분" style="width:74px;height:24px;padding:0 6px"> 분 전</label></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button type="button" class="btn btn--gold" id="pOn">이 기기에서 알림 켜기</button><button type="button" class="btn btn--plain" id="pTest">시험 알림 보내기</button><span class="mut" id="pState" style="font-size:12.5px"></span></div>
      <div class="howto">
        <details ${Push.isIOS ? 'open' : ''}><summary>아이폰에서 받는 법</summary><ol><li>사파리로 이 사이트를 열어.</li><li>아래 가운데 공유 버튼(네모에 화살표)을 누르고 '홈 화면에 추가'를 눌러.</li><li>홈 화면에 생긴 슈고상회 아이콘으로 다시 들어와서 로그인해.</li><li>내 정보에서 '이 기기에서 알림 켜기'를 누르고 '허용'을 눌러.</li></ol></details>
        <details><summary>갤럭시(안드로이드)에서 받는 법</summary><ol><li>크롬이나 삼성 인터넷으로 이 사이트를 열고 로그인해.</li><li>내 정보에서 '이 기기에서 알림 켜기'를 누르고 '허용'을 눌러.</li><li>앱처럼 쓰고 싶으면 오른쪽 위 메뉴(⋮)에서 '홈 화면에 추가'를 눌러.</li></ol></details>
        <details><summary>PC에서 받는 법</summary><ol><li>'이 기기에서 알림 켜기'를 누르고 '허용'을 눌러.</li><li>브라우저가 켜져 있으면 윈도우 알림으로 떠.</li></ol></details>
      </div>`;
    page.appendChild(box);
    const save = async () => { const a = $$('.checks input[type=checkbox]:checked', box).map(x => Number(x.value)), c = Number($('#pCustom', box).value); if (c > 0) a.push(c); await S.setPushOffsets([...new Set(a)].sort((x, y) => y - x)); toast('알림 시간을 저장했어'); };
    $$('.checks input', box).forEach(x => x.onchange = () => run(null, save));
    const paint = async () => { const st = await Push.state(); $('#pOn', box).textContent = st === 'on' ? '이 기기 알림 끄기' : '이 기기에서 알림 켜기';
      $('#pState', box).textContent = { on: S.live ? '켜져 있어' : '켜져 있어 (데모: 사이트를 켜둔 동안만 울려)', off: '', denied: '브라우저에서 알림이 막혀 있어. 주소창 옆 자물쇠에서 알림을 허용해줘', unsupported: '이 브라우저는 알림을 못 써', 'ios-install': '아이폰은 먼저 홈 화면에 추가해야 해 (아래 방법)' }[st];
      $('#pOn', box).disabled = st === 'unsupported' || st === 'ios-install' || st === 'denied'; };
    $('#pOn', box).onclick = e => run(e.target, async () => { if (await Push.state() === 'on') { await Push.disable(); toast('이 기기 알림을 껐어. 완전히 끄려면 브라우저 설정에서 알림을 차단해'); } else await Push.enable(); paint(); });
    $('#pTest', box).onclick = () => run(null, async () => { if (await Push.state() !== 'on') throw new Error('먼저 알림을 켜줘'); await Push.show('시험 알림', '이렇게 레이드 출발 전에 알려줄게.', 'test'); });
    paint();
  }

  function downloads() {
    const list = C.downloads || [];
    view.innerHTML = `<div class="page page--narrow"><div class="ph"><h1>다운로드</h1></div><div class="list">${list.length ? list.map(d => `<div><span class="t">${esc(d.name)} <span class="mut">v${esc(d.version)}</span></span><span class="m">${esc(d.desc || '')}</span><a class="btn btn--gold btn--sm" href="${esc(d.url)}" download>받기</a></div>`).join('') : '<div class="mut">아직 올라온 게 없어</div>'}</div></div>`;
  }

  // ───── 승인 대기 (보조AI · 관리자) — 명단 보기 + 승인·거절 ─────
  async function pendingPage() {
    if (!isAi() && !isAdmin()) { view.innerHTML = `<div class="page page--narrow"><div class="empty"><b>볼 수 없는 화면이야</b></div></div>`; return; }
    const list = await S.listPending().catch(e => { toast(e.message, true); return []; });
    pendingCount = list.length; renderNav('pending');
    document.title = `승인 대기 ${list.length}명 · 슈고상회`;
    view.innerHTML = `<div class="page page--narrow">
      <div class="ph"><div><h1>승인 대기 <span id="pendN">${list.length}</span>명</h1><p>가입 신청하고 승인을 기다리는 사람. 1분마다 새로 읽어.</p></div></div>
      ${list.length ? `<div class="list">${list.map(u => `<div class="pend"><div><span class="t">${esc(u.char_name || '')}</span><span class="m">본캐 ${esc(u.main_char || '-')} · ${fmtDate(u.created_at)} ${fmtTime(u.created_at)} 신청</span></div><div class="pend__b"><button class="btn btn--gold btn--sm" data-ok="${u.id}" data-nm="${esc(u.char_name || '')}">승인</button><button class="btn btn--sm" data-no="${u.id}" data-nm="${esc(u.char_name || '')}">거절</button></div></div>`).join('')}</div>` : '<div class="empty"><b>승인 대기 0명</b><p>지금 기다리는 사람이 없어.</p></div>'}
    </div>`;
    const decide = (b, yes) => b.onclick = async () => {
      if (!confirm(`${b.dataset.nm} ${yes ? '승인' : '거절'}할까?`)) return;
      b.disabled = true;
      try { await S.decidePending(yes ? b.dataset.ok : b.dataset.no, yes); toast(`${b.dataset.nm} ${yes ? '승인했어' : '거절했어'}`); } catch (e) { toast(e.message, true); }
      pendingPage();
    };
    view.querySelectorAll('[data-ok]').forEach(b => decide(b, true));
    view.querySelectorAll('[data-no]').forEach(b => decide(b, false));
    clearTimeout(pendingPage.t);
    pendingPage.t = setTimeout(() => { if (location.hash.startsWith('#/pending')) pendingPage(); }, 60000);
  }

  // ───── 사이트관리 ─────
  async function admin(tab = 'pending') {
    if (!isAdmin()) { view.innerHTML = `<div class="page page--narrow"><div class="empty"><b>관리자만 볼 수 있어</b></div></div>`; return; }
    const users = await S.listProfiles().catch(e => { toast(e.message, true); return []; });
    const pending = users.filter(u => u.status === 'pending');
    pendingCount = pending.length; renderNav('admin');
    const T = [['pending', '가입 승인', pending.length], ['members', '회원'], ['posts', '게시글'], ['raids', '레이드'], ['notice', '홈 공지']];
    view.innerHTML = `<div class="page"><div class="ph"><div><h1>사이트관리</h1><p>회원 ${users.length} · 상회원 ${users.filter(u => u.status === 'approved').length} · 대기 ${pending.length}</p></div></div>
      <nav class="seg" style="margin-bottom:16px">${T.map(([id, name, n]) => `<a href="#/admin/${id}" class="${tab === id ? 'on' : ''}">${name}${n ? ` <b style="color:var(--red)">${n}</b>` : ''}</a>`).join('')}</nav><div id="body"></div></div>`;
    const body = $('#body');
    const row = u => `<tr><td><b>${esc(u.main_char || '-')}</b></td><td><span style="display:flex;align-items:center;gap:8px">${avatar(u)}${esc(nick(u))}<span class="mut">${esc(u.job)}</span></span></td><td>${esc(u.username)}</td><td>${esc(u.contact || '-')}</td>
      <td>${{ approved: '<span class="tag tag--teal">상회원</span>', pending: '<span class="tag">대기</span>', rejected: '<span class="tag tag--red">거절</span>' }[u.status]} ${roleTag(u)}</td>
      <td class="mut">${ago(u.created_at)}</td><td><div class="acts">
        ${u.status !== 'approved' ? `<button class="btn btn--gold btn--sm" data-st="approved" data-u="${u.id}">승인</button>` : ''}
        ${u.status === 'pending' ? `<button class="btn btn--sm" data-st="rejected" data-u="${u.id}">거절</button>` : ''}
        ${tab === 'members' && u.status === 'approved' && u.id !== me().id ? `<button class="btn btn--sm" data-st="pending" data-u="${u.id}">승인 취소</button>${isOwner() && u.role !== 'owner' && u.role !== 'ai' ? `<button class="btn btn--sm" data-role="${u.role === 'manager' ? 'member' : 'manager'}" data-u="${u.id}">${u.role === 'manager' ? '관리슈고 해제' : '관리슈고 임명'}</button>` : ''}` : ''}
        ${tab === 'members' ? `<button class="btn btn--plain btn--sm" data-pw="${u.id}" data-name="${esc(nick(u))}">비번 초기화</button>` : ''}</div></td></tr>`;
    const table = rows => `<table class="tbl"><thead><tr><th>본캐 닉네임</th><th>사이트 닉네임</th><th>로그인 계정</th><th>비상연락처</th><th>상태</th><th>가입</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    if (tab === 'pending') body.innerHTML = pending.length ? table(pending.map(row).join('')) : `<div class="empty"><b>승인 기다리는 사람이 없어</b></div>`;
    if (tab === 'members') body.innerHTML = `<input class="input" id="q" placeholder="닉네임·아이디 검색" style="max-width:280px;margin-bottom:8px" aria-label="회원 검색">${table(users.map(row).join(''))}`;
    if (tab === 'posts') { const ps = await S.listPosts({ limit: 200 });
      body.innerHTML = ps.length ? `<table class="tbl"><thead><tr><th>제목</th><th>게시판</th><th>글쓴이</th><th>날짜</th><th></th></tr></thead><tbody>${ps.map(p => `<tr><td><a href="#/post/${p.id}"><b>${esc(p.title)}</b></a></td><td>${esc(boardName(p.cat))}</td><td>${esc(nick(p.author))}</td><td class="mut">${ago(p.created_at)}</td><td><div class="acts"><button class="btn btn--sm" data-dp="${p.id}">지우기</button></div></td></tr>`).join('')}</tbody></table>` : `<div class="empty"><b>글이 없어</b></div>`; }
    if (tab === 'raids') { const rs = await S.listRaids();
      body.innerHTML = rs.length ? `<table class="tbl"><thead><tr><th>모집</th><th>출발</th><th>인원</th><th>모집자</th><th></th></tr></thead><tbody>${rs.map(r => `<tr><td><b>${esc(r.title)}</b></td><td>${fmtDate(r.starts_at)} ${fmtTime(r.starts_at)}</td><td class="num">${(r.members || []).length}/${r.slots}</td><td>${esc(nick(r.author))}</td><td><div class="acts"><button class="btn btn--sm" data-dr="${r.id}">지우기</button></div></td></tr>`).join('')}</tbody></table>` : `<div class="empty"><b>잡힌 레이드가 없어</b></div>`; }
    if (tab === 'notice') { const cur = await S.getNotice();
      body.innerHTML = `<form class="form" id="nf" style="max-width:560px"><label class="field"><span>홈 맨 위 공지 (비우면 안 보임)</span><textarea class="textarea" name="t" maxlength="300" style="min-height:100px">${esc(cur)}</textarea></label><div><button class="btn btn--gold">저장</button></div></form>`;
      $('#nf').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { await S.setNotice(new FormData(e.target).get('t').trim()); toast('공지 저장했어'); }); }; }
    const again = () => admin(tab);
    $$('[data-st]', body).forEach(b => b.onclick = () => run(b, async () => { await S.setStatus(b.dataset.u, b.dataset.st); again(); }));
    $$('[data-role]', body).forEach(b => b.onclick = () => { if (confirm(b.textContent.trim() + ' 할까?')) run(b, async () => { await S.setRole(b.dataset.u, b.dataset.role); again(); }); });
    $$('[data-pw]', body).forEach(b => b.onclick = () => {
      const d = sheet(`<h2>비밀번호 재설정</h2><p>${esc(b.dataset.name)} 의 새 비밀번호를 적어줘. 기존 비밀번호는 누구도 볼 수 없고, 새로 정해주는 것만 돼.</p>
        <form id="rp"><input class="input" name="pw" required minlength="${S.live ? 6 : 1}" placeholder="새 비밀번호" autocomplete="off" autofocus><div class="acts"><button type="button" class="btn btn--plain" data-close>취소</button><button class="btn btn--gold">재설정</button></div></form>`);
      $('#rp', d).onsubmit = e => { e.preventDefault(); const pw = new FormData(e.target).get('pw'); run(e.submitter, async () => { await S.resetPassword(b.dataset.pw, pw); d.close(); toast('재설정했어. 본인에게 알려줘'); }); };
    });
    $$('[data-dp]', body).forEach(b => b.onclick = () => { if (confirm('이 글을 지울까?')) run(b, async () => { await S.deletePost(rid(b.dataset.dp)); again(); }); });
    $$('[data-dr]', body).forEach(b => b.onclick = () => { if (confirm('이 모집을 지울까?')) run(b, async () => { await S.deleteRaid(rid(b.dataset.dr)); again(); }); });
    const q = $('#q', body); if (q) q.oninput = () => { const v = q.value.trim().toLowerCase(); $$('tbody tr', body).forEach(tr => tr.hidden = v && !tr.textContent.toLowerCase().includes(v)); };
  }

  // ───── 접속 중인 상회원 · 쪽지 ─────
  const peersEl = document.getElementById('peers'), barMsg = document.getElementById('barMsg');
  let unread = 0, chatPeer = null;
  function renderPeers() {
    const ok = isOk() && !document.body.classList.contains('landing');
    document.body.classList.toggle('has-peers', ok); peersEl.hidden = !ok; barMsg.hidden = !isOk();
    barMsg.innerHTML = IC.mail + (unread ? `<span class="n">${unread}</span>` : '');
    if (!ok) return;
    const on = S.online(), my = me().id;
    peersEl.innerHTML = `<h2>접속 중 <b class="num">${on.length}</b></h2>
      <div class="peers__list">${on.map(p => `<button data-peer="${esc(p.id)}" ${p.id === my ? 'disabled' : ''} title="${p.id === my ? '나' : '쪽지 보내기'}">${avatar(p)}<span>${esc(nick(p))}${p.id === my ? ' <i>나</i>' : ''}</span></button>`).join('')}</div>
      <a class="peers__box" href="#/msg">${IC.mail}<span>쪽지함</span>${unread ? `<b class="n">${unread}</b>` : ''}</a>`;
    $$('[data-peer]', peersEl).forEach(b => b.onclick = () => openChat(on.find(p => p.id === b.dataset.peer)));
  }
  async function refreshUnread() { try { unread = isOk() ? await S.unreadCount() : 0; } catch (e) { unread = 0; } renderPeers(); }
  async function openChat(peer) {
    if (!peer) return;
    chatPeer = peer.id;
    const d = sheet(`<h2 style="display:flex;align-items:center;gap:8px">${avatar(peer)}${esc(nick(peer))}</h2>
      <div class="chat" id="chat"></div>
      <form id="cf" style="display:flex;gap:6px;margin-top:10px"><input class="input" name="body" maxlength="1000" required placeholder="쪽지 쓰기" autocomplete="off" autofocus><button class="btn btn--gold">보내기</button></form>`);
    d.addEventListener('close', () => { chatPeer = null; if (location.hash.startsWith('#/msg')) route(); }, { once: true });
    const load = async () => {
      const ms = await S.listMessages(peer.id), box = $('#chat', d); if (!box) return;
      box.innerHTML = ms.length ? ms.map(m => `<div class="bub ${m.from_id === me().id ? 'mine' : ''}"><p>${esc(m.body)}</p><small>${ago(m.created_at)}</small></div>`).join('') : '<p class="mut" style="margin:auto">아직 주고받은 쪽지가 없어</p>';
      box.scrollTop = box.scrollHeight;
      if (ms.some(m => m.to_id === me().id && !m.read_at)) await S.markRead(peer.id);
    };
    d._reload = load; await load();
    $('#cf', d).onsubmit = e => { e.preventDefault(); const f = e.target, body = f.body.value.trim(); if (!body) return;
      run(e.submitter, async () => { await S.sendMessage(peer.id, body); f.reset(); await load(); f.body.focus(); }); };
  }
  async function msgPage() {
    const block = needMember();
    if (block) { view.innerHTML = `<div class="page page--narrow"><div class="ph"><h1>쪽지함</h1></div>${block}</div>`; return; }
    view.innerHTML = `<div class="page page--narrow"><div class="ph"><h1>쪽지함</h1></div>
      <section class="sec"><div class="sec__h"><h2>주고받은 쪽지</h2></div><div class="list" id="th"><div class="mut">불러오는 중</div></div></section>
      <section class="sec"><div class="sec__h"><h2>상회원에게 보내기</h2></div><div class="list" id="mem"></div></section></div>`;
    const [ths, mem] = await Promise.all([S.listThreads(), S.listMembers()]), on = new Set(S.online().map(p => p.id));
    $('#th').innerHTML = ths.length ? ths.map((t, i) => `<a href="#" data-t="${i}">${avatar(t.peer)}<span class="t">${esc(nick(t.peer))} <span class="mut" style="font-weight:500">${esc(t.last.body.slice(0, 40))}</span></span>${t.unread ? `<b class="tag tag--red">새 쪽지 ${t.unread}</b>` : ''}<span class="m">${ago(t.last.created_at)}</span></a>`).join('') : '<div class="mut">아직 쪽지가 없어</div>';
    const others = mem.filter(p => p.id !== me().id);
    $('#mem').innerHTML = others.length ? others.map((p, i) => `<a href="#" data-m="${i}">${avatar(p)}<span class="t">${esc(nick(p))}</span>${on.has(p.id) ? '<span class="tag tag--teal">접속 중</span>' : ''}<span class="m">${esc(p.job || '')}</span></a>`).join('') : '<div class="mut">다른 상회원이 아직 없어</div>';
    $$('[data-t]').forEach(a => a.onclick = e => { e.preventDefault(); const t = ths[Number(a.dataset.t)]; openChat({ ...t.peer, id: t.peer_id }); });
    $$('[data-m]').forEach(a => a.onclick = e => { e.preventDefault(); openChat(others[Number(a.dataset.m)]); });
  }
  S.onOnline(renderPeers);
  S.onMessage(() => { refreshUnread(); if (chatPeer && sheetEl.open && sheetEl._reload) sheetEl._reload(); });

  // ───── 아래 상태줄 · 게시판 사진 미리보기 ─────
  const stMode = document.getElementById('stMode');
  stMode.classList.toggle('live', S.live);
  stMode.lastElementChild.innerHTML = S.live ? '서버 연결됨' : '데모 모드 (이 브라우저에만 저장) · 상회장 계정 <b>admin / admin</b>';
  async function refreshStatus() {
    const el = document.getElementById('stNext'), cd = document.getElementById('stNextCd');
    if (!isOk()) { el.hidden = true; return; }
    try { const r = (await S.listRaids()).find(x => new Date(x.starts_at) > Date.now()); el.hidden = !r; if (r) { cd.dataset.cd = r.starts_at; Fx.refresh(document); } } catch (e) { el.hidden = true; }
  }
  const peek = document.getElementById('peek');
  if (matchMedia('(pointer: fine)').matches) {
    view.addEventListener('pointermove', e => {
      const r = e.target.closest && e.target.closest('[data-img]');
      if (!r) { peek.hidden = true; return; }
      if (peek.dataset.src !== r.dataset.img) { peek.dataset.src = r.dataset.img; peek.innerHTML = `<img src="${esc(r.dataset.img)}" alt="">`; }
      peek.hidden = false;
      peek.style.left = Math.min(innerWidth - 280, e.clientX + 18) + 'px'; peek.style.top = Math.min(innerHeight - 270, e.clientY + 14) + 'px';
    }, { passive: true });
    view.addEventListener('pointerleave', () => { peek.hidden = true; });
  }

  // ───── 주소 → 화면 ─────
  const enteredKey = 'shugo_entered';
  const entered = () => { try { return localStorage.getItem(enteredKey) === '1'; } catch (e) { return false; } };
  function enter() { try { localStorage.setItem(enteredKey, '1'); } catch (e) {} go('#/home'); }
  const TITLES = { home: '홈', tools: '도구', login: '로그인', signup: '가입', me: '내 정보', board: '게시판', post: '게시판', write: '글쓰기', raid: '레이드 모집', games: '미니게임', game: '미니게임', msg: '쪽지함', downloads: '다운로드', admin: '사이트관리' };

  async function route() {
    Landing.stop(); peek.hidden = true;
    const raw = location.hash.slice(1) || '/';
    const [path, qs] = raw.split('?'), q = new URLSearchParams(qs || ''), parts = path.split('/').filter(Boolean);
    let key = parts[0] || '';
    if (!key) key = 'intro';       // 주소만 치고 들어오면 항상 소개 화면부터
    document.body.classList.toggle('landing', key === 'intro');
    window.scrollTo(0, 0);
    if (key === 'intro') { renderPeers(); document.title = '슈고상회 · 아이온2 레기온'; Landing.render(view, { esc, me, enter, toast }); return; }
    refreshUnread(); refreshStatus();
    const tool = key === 'tool' && Tools.get(parts[1]);
    renderNav(key === 'tool' ? 'tool/' + parts[1] : key === 'post' || key === 'write' ? 'board' : key === 'game' ? 'games' : key);
    const title = tool ? (tool.full || tool.name) : TITLES[key] || '';
    renderBar(title);
    document.title = (title && key !== 'home' ? title + ' · ' : '') + '슈고상회';
    try {
      if (key === 'home') await home();
      else if (key === 'tools') toolsPage();
      else if (key === 'games') gamesPage();
      else if (key === 'game') gamePage(parts[1]);
      else if (key === 'tool') toolPage(parts[1]);
      else if (key === 'login') login();
      else if (key === 'signup') signup();
      else if (key === 'me') mePage();
      else if (key === 'board') await board(parts[1]);
      else if (key === 'post') await post(parts[1]);
      else if (key === 'write') write(q);
      else if (key === 'raid') await raid();
      else if (key === 'msg') await msgPage();
      else if (key === 'downloads') downloads();
      else if (key === 'admin') await admin(parts[1]);
      else if (key === 'pending') await pendingPage();
      else go('#/home');
    } catch (e) { console.error(e); toast('화면을 못 불러왔어: ' + e.message, true); }
    Fx.refresh(view);
  }
  async function refreshPending() {
    if (isAi()) { try { pendingCount = (await S.listPending()).length; } catch (e) {} return; }
    if (!isAdmin()) { pendingCount = 0; return; }
    try { pendingCount = (await S.listProfiles()).filter(u => u.status === 'pending').length; } catch (e) {}
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', route);
  S.onChange(async () => { await refreshPending(); refreshUnread(); if (!document.body.classList.contains('landing')) { renderBar(null); renderNav((location.hash.slice(2).split('?')[0]) || 'home'); } });
  S.init().then(refreshPending).then(route);
})();
