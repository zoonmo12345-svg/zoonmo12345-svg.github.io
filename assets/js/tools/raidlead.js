// 공대장 도우미 = 자리 넣기.
// 1팟·2팟 이름과 역할(메인탱·서브탱·근딜·원딜·힐러)을 넣으면 넴드별 자리가 바로 채워지고, 짧은 공지를 한 번에 복사함.
// 레이드별 내용은 data-*.js 에만 있음. 공지는 게임 채팅에 줄바꿈이 안 먹어서 한 줄로 만듦(★·◆ 로 구분).
(function () {
  const ROLES = ['메인탱', '서브탱', '근딜', '원딜', '힐러'];
  const SIZE = 10, HALF = 5;

  // 글자에서 역할 알아내기 (역할 이름·줄임말·직업 이름)
  function roleOf(t) {
    t = String(t || '').trim(); if (!t) return '';
    if (ROLES.includes(t)) return t;
    if (/^(서브|섭|부탱)/.test(t)) return '서브탱';
    if (/^(메인|메탱|탱|수호)/.test(t)) return '메인탱';
    if (/^(힐|치유)/.test(t)) return '힐러';
    if (/^(근|검성|살성|권성|호법)/.test(t)) return '근딜';
    if (/^(원|궁성|마도|정령)/.test(t)) return '원딜';
    return '';
  }

  function load(id) {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('seat2_' + id)); } catch (e) {}
    s = s && Array.isArray(s.names) ? s : {};
    return { names: Array.from({ length: SIZE }, (_, i) => (s.names || [])[i] || ''), jobs: Array.from({ length: SIZE }, (_, i) => ROLES.includes((s.jobs || [])[i]) ? s.jobs[i] : ''), over: s.over || {}, boss: s.boss || 0 };
  }
  const save = (id, st) => { try { localStorage.setItem('seat2_' + id, JSON.stringify(st)); } catch (e) {} };

  function define(R) {
    Tools.add({ id: R.id, group: '공대장 도구', name: R.short + ' 자리', full: R.name + ' 공대장 도우미', icon: R.icon, thumb: R.thumb, desc: R.desc || '1팟·2팟 자리 넣기', dungeon: R.name, render(view, ctx) { mount(view, ctx, R); } });
  }

  function mount(view, ctx, R) {
    const { esc, toast, sheet } = ctx;
    const st = load(R.id);
    const persist = () => save(R.id, st);
    const has = i => !!st.names[i].trim();
    const partyOf = i => i < HALF ? 1 : 2;
    const nm = i => st.names[i].trim();

    // ── 자리 계산 ──
    function assign(B) {
      const slots = B.slots || [], res = slots.map(() => []), used = new Set();
      const ov = st.over[B.id];
      if (ov) { slots.forEach((s, si) => { res[si] = (ov[si] || []).filter(i => i != null && has(i)); res[si].forEach(i => used.add(i)); }); return res; }
      slots.map((s, si) => si).sort((a, b) => (slots[a].pri ?? 50) - (slots[b].pri ?? 50)).forEach(si => {
        const s = slots[si];
        const score = i => { const j = st.jobs[i]; let v = 20; if (s.jobs) { const k = s.jobs.indexOf(j); if (k >= 0) v = k; } if (s.avoid && s.avoid.includes(j)) v += 30 + s.avoid.indexOf(j); return v; };
        res[si] = st.names.map((_, i) => i).filter(i => has(i) && !used.has(i) && (!s.party || partyOf(i) === s.party) && !(s.never && s.never.includes(st.jobs[i])))
          .sort((a, b) => score(a) - score(b) || a - b).slice(0, s.count || 1);
        res[si].forEach(i => used.add(i));
      });
      return res;
    }
    const label = s => s.name || (s.to ? `${s.at}→${s.to}` : s.at ? s.at + '시' : s.label);
    // 공지 한 줄: ★1팟★ 자리 이름 / 자리 이름 ◆ ★2팟★ …
    function message(B) {
      if (!B.slots) return typeof B.text === 'function' ? B.text(helpers(B, [])) : B.text;
      const res = assign(B);
      if (B.copy) return B.copy(helpers(B, res));
      const seg = p => { const a = B.slots.map((s, si) => s.party === p && !s.nocopy && res[si].length ? `${label(s)} ${res[si].map(nm).join('·')}` : '').filter(Boolean); return a.length ? `★${p}팟★ ${a.join(' / ')}` : ''; };
      const rest = B.slots.map((s, si) => !s.party && !s.nocopy && res[si].length ? `${label(s)} ${res[si].map(nm).join('·')}` : '').filter(Boolean);
      return [seg(1), seg(2), ...rest].filter(Boolean).join(' ◆ ');
    }
    // data 파일의 copy·extras 가 쓰는 도구
    function helpers(B, res) {
      const byRole = (r, p) => st.names.map((_, i) => i).filter(i => has(i) && st.jobs[i] === r && (!p || partyOf(i) === p)).map(nm);
      const at = key => { const si = (B.slots || []).findIndex(s => s.key === key); return si < 0 ? [] : res[si].map(nm); };
      return { names: st.names.map((n, i) => has(i) ? nm(i) : '').filter(Boolean), byRole, at, any: st.names.some((n, i) => has(i)) };
    }

    // ── 화면 ──
    function draw() {
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      view.innerHTML = `<div class="page">
        <div class="ph"><div><h1>${esc(R.short)} 자리</h1><p><a href="#/tools">공대장 도구</a> · ${esc(R.name)}</p></div>
          <div class="ph__act">${ctx.isOk() ? '<button class="btn btn--sm" id="fromRaid">모집에서 불러오기</button>' : ''}<button class="btn btn--sm" id="paste">한 번에 붙여넣기</button><button class="btn btn--sm btn--plain" id="clear">비우기</button></div></div>
        <div class="seat">
          <div class="pn">
            <div class="pots">${[1, 2].map(p => `<div class="pot pot--${p}"><h2><i></i>${p}팟</h2>${Array.from({ length: HALF }, (_, k) => { const i = (p - 1) * HALF + k; return `<div class="prow">
              <input class="input" data-n="${i}" value="${esc(st.names[i])}" placeholder="닉네임" maxlength="16" aria-label="${p}팟 ${k + 1}번 닉네임" autocomplete="off">
              <select class="select" data-j="${i}" aria-label="${p}팟 ${k + 1}번 역할"><option value="">역할</option>${ROLES.map(j => `<option ${j === st.jobs[i] ? 'selected' : ''}>${j}</option>`).join('')}</select></div>`; }).join('')}</div>`).join('')}</div>
            <p class="mut" style="font-size:12.5px;margin-top:10px">엔터 = 다음 칸. 역할을 넣으면 자리를 알아서 맞춘다거. 이 브라우저에 저장된다거.</p>
          </div>
          <div class="out" id="out"></div>
        </div></div>`;
      view.querySelectorAll('[data-n]').forEach(el => {
        el.oninput = () => { st.names[el.dataset.n] = el.value; persist(); drawOut(); };
        el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const nx = view.querySelector(`[data-n="${Number(el.dataset.n) + 1}"]`); if (nx) nx.focus(); } };
      });
      view.querySelectorAll('[data-j]').forEach(el => el.onchange = () => { st.jobs[el.dataset.j] = el.value; persist(); drawOut(); });
      view.querySelector('#clear').onclick = () => { if (confirm('이름과 자리를 전부 비우겠냐거?')) { st.names.fill(''); st.jobs.fill(''); st.over = {}; persist(); draw(); } };
      view.querySelector('#paste').onclick = pasteSheet;
      const fr = view.querySelector('#fromRaid'); if (fr) fr.onclick = () => raidSheet();
      drawOut();
      if (q.get('raid') && ctx.isOk()) raidSheet(q.get('raid'));
    }

    const pos = (at, r) => { const a = at * Math.PI / 6; return [50 + r * Math.sin(a), 50 - r * Math.cos(a)]; };
    // 자리표 밑그림: 이동 화살표(at→to) · 원 · 부채꼴 같은 것
    function underlay(B) {
      let g = '';
      (B.rings || []).forEach(r => { g += `<circle cx="50" cy="50" r="${r}" class="ck-ring"/>`; });
      (B.marks || []).forEach(m => { const [x, y] = pos(m.at, m.r ?? 30); g += `<g class="ck-mark ck-mark--${m.kind || 'dot'}"><circle cx="${x}" cy="${y}" r="${m.size || 4}"/>${m.t ? `<text x="${x}" y="${y + 1.4}">${esc(m.t)}</text>` : ''}</g>`; });
      (B.slots || []).forEach(s => {
        if (!s.to || s.to === s.at) return;
        const [x1, y1] = pos(s.at, 30), [x2, y2] = pos(s.to, 30), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, k = s.bow ?? .22;
        const cx = mx + (y2 - y1) * k, cy = my - (x2 - x1) * k;
        g += `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" class="ck-arrow ck-arrow--${s.party || 0}" marker-end="url(#ckh${s.party || 0})"/>`;
      });
      if (!g) return '';
      return `<svg class="clock__svg" viewBox="0 0 100 100" aria-hidden="true"><defs>${[0, 1, 2].map(p => `<marker id="ckh${p}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ck-head ck-head--${p}"/></marker>`).join('')}</defs>${g}</svg>`;
    }

    function drawOut() {
      const out = view.querySelector('#out'); if (!out) return;
      const B = R.bosses[st.boss] || R.bosses[0], res = B.slots ? assign(B) : [], msg = message(B);
      const H = helpers(B, res);
      const extras = (B.extras || []).map(x => ({ name: x.name, text: typeof x.text === 'function' ? x.text(H) : x.text }));
      const chip = (si, k, i) => `<button class="cs__n ${i == null ? 'none' : 'p' + partyOf(i)}" data-si="${si}" data-k="${k}">${i == null ? '빈 자리' : esc(nm(i))}</button>`;
      const slotHtml = (s, si) => Array.from({ length: s.count || 1 }, (_, k) => chip(si, k, res[si][k] ?? null)).join('');
      const head = s => s.name || (s.to ? (s.to === s.at ? `${s.at}시 제자리` : `${s.at}시→${s.to}시`) : `${s.at}시`);
      const clock = B.slots ? B.slots.map((s, si) => { if (!s.at) return ''; const [x, y] = pos(s.at, s.r ?? 39);
        return `<div class="cs ${s.cls || ''}" style="left:${x}%;top:${y}%"><span class="cs__h">${esc(head(s))}${s.note ? ' · ' + esc(s.note) : ''}</span>${slotHtml(s, si)}</div>`; }).join('') : '';
      const rows = B.slots ? B.slots.map((s, si) => s.at ? '' : `<div><span>${esc(s.label)}${s.note ? ` <span class="mut">${esc(s.note)}</span>` : ''}</span><span class="cs">${slotHtml(s, si)}</span></div>`).join('') : '';
      const copyBox = (id, name, text) => `<div class="copy"><span class="copy__t">${esc(name)}</span><pre>${text ? esc(text) : '<span class="mut">이름을 넣으면 공지가 만들어진다거</span>'}</pre><button data-cp="${id}" ${text ? '' : 'disabled'}>복사</button></div>`;
      out.innerHTML = `<div class="seg" role="tablist">${R.bosses.map((b, i) => `<button role="tab" data-b="${i}" class="${i === st.boss ? 'on' : ''}">${esc(b.sub)} ${esc(b.name)}</button>`).join('')}</div>
        <div class="pn" style="padding:14px">${B.slots ? `<div class="clock">${underlay(B)}<div class="clock__c">${esc(B.title)}<small>이름 누르기 = 교체</small></div>${clock}</div>${B.legend ? `<p class="clock__lg">${B.legend}</p>` : ''}${rows ? `<div class="rowslots">${rows}</div>` : ''}` : '<p class="mut">이 넴드는 개인 자리가 없다거. 아래 공지만 복사하면 된다거.</p>'}</div>
        <div>${copyBox('main', B.copyName || B.sub + ' 공지', msg)}${extras.map((x, i) => copyBox('x' + i, x.name, x.text)).join('')}
        ${st.over[B.id] ? '<button class="btn btn--plain btn--sm" id="auto" style="margin-top:8px">자동 배정으로 되돌리기</button>' : ''}
        ${B.tips ? `<div class="tips">${B.tips.map(t => `<details open><summary>${esc(t.t)}</summary><ul>${t.l.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</div>` : ''}</div>`;
      out.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { st.boss = Number(b.dataset.b); persist(); drawOut(); });
      out.querySelectorAll('[data-cp]').forEach(b => b.onclick = async () => {
        const text = b.dataset.cp === 'main' ? msg : extras[Number(b.dataset.cp.slice(1))].text;
        try { await navigator.clipboard.writeText(text); toast('복사했다거. 게임 채팅에 붙여넣으라거~'); } catch (e) { toast('복사가 막혔다거. 글자를 직접 긁어서 복사하라거', true); }
      });
      const au = out.querySelector('#auto'); if (au) au.onclick = () => { delete st.over[B.id]; persist(); drawOut(); };
      out.querySelectorAll('.cs__n').forEach(b => b.onclick = () => {
        const si = Number(b.dataset.si), k = Number(b.dataset.k), cur = res[si][k] ?? null;
        const sel = document.createElement('select');
        sel.innerHTML = '<option value="">비우기</option>' + st.names.map((n, i) => has(i) ? `<option value="${i}" ${i === cur ? 'selected' : ''}>${partyOf(i)}팟 ${esc(n.trim())}</option>` : '').join('');
        b.replaceWith(sel); sel.focus();
        sel.onblur = () => drawOut();
        sel.onchange = () => {
          const next = sel.value === '' ? null : Number(sel.value);
          const ov = B.slots.map((s, x) => Array.from({ length: s.count || 1 }, (_, y) => res[x][y] ?? null));     // 지금 배치를 그대로 고정한 뒤
          if (next != null) ov.forEach(a => a.forEach((v, y) => { if (v === next) a[y] = cur; }));                   // 고른 사람이 다른 자리에 있으면 서로 바꿈
          ov[si][k] = next; st.over[B.id] = ov; persist(); drawOut();
        };
      });
    }

    // ── 한 번에 붙여넣기 ──
    function pasteSheet() {
      const d = sheet(`<h2>한 번에 붙여넣기</h2><p>한 줄에 한 명. 위 5명 = 1팟, 아래 5명 = 2팟. 역할(메인탱·서브탱·근딜·원딜·힐러)은 이름 뒤에 써도 되고 빼도 된다거.</p>
        <textarea class="textarea" id="pt" style="min-height:220px" placeholder="불고기 메인탱&#10;마라샹 힐러&#10;토니포트 원딜&#10;…"></textarea>
        <div class="acts"><button class="btn btn--plain" data-close>취소</button><button class="btn btn--gold" id="ok">넣기</button></div>`);
      d.querySelector('#pt').focus();
      d.querySelector('#ok').onclick = () => {
        const rows = d.querySelector('#pt').value.split(/[\n,]+/).map(x => x.trim()).filter(Boolean).slice(0, SIZE);
        if (!rows.length) return;
        st.names.fill(''); st.jobs.fill(''); st.over = {};
        rows.forEach((row, i) => { const w = row.split(/[\s/·]+/).filter(Boolean); const j = w.length > 1 ? roleOf(w[w.length - 1]) : ''; st.names[i] = (j ? w.slice(0, -1) : w).join(' ').slice(0, 16); st.jobs[i] = j; });
        persist(); d.close(); draw();
      };
    }

    // ── 레이드 모집 명단에서 불러오기 ──
    async function raidSheet(pick) {
      let raids = [];
      try { raids = await ctx.S.listRaids(); } catch (e) { toast(e.message, true); return; }
      const fill = r => {
        const mem = (r.members || []).map(m => ({ n: (m.profile && (m.profile.main_char || m.profile.char_name)) || '', j: (m.profile && m.profile.job) || '' })).filter(m => m.n);
        const rank = j => ['수호성', '치유성', '검성', '호법성'].indexOf(j) + 1 || 9;
        mem.sort((a, b) => rank(a.j) - rank(b.j));
        st.names.fill(''); st.jobs.fill(''); st.over = {};
        const next = [0, HALF]; let tanks = 0;                            // 탱·힐부터 1팟·2팟에 번갈아 넣어서 양쪽에 고르게
        mem.slice(0, SIZE).forEach((m, x) => { let p = x % 2; if (next[p] >= (p ? SIZE : HALF)) p = 1 - p; const i = next[p]++; st.names[i] = m.n.slice(0, 16);
          let role = roleOf(m.j); if (role === '메인탱' && tanks++ > 0) role = '서브탱'; st.jobs[i] = role; });
        persist(); draw(); toast('모집 명단을 넣었다거');
      };
      if (pick) { const r = raids.find(x => String(x.id) === String(pick)); history.replaceState(null, '', '#/tool/' + R.id); if (r) fill(r); return; }
      if (!raids.length) { toast('잡힌 레이드가 없다거'); return; }
      const d = sheet(`<h2>모집에서 불러오기</h2><p>참여자 닉네임과 역할을 1팟·2팟에 나눠 넣는다거.</p>
        <div class="list">${raids.map((r, i) => `<a href="#" data-r="${i}"><span class="when num">${ctx.fmtTime(r.starts_at)}</span><span class="t">${esc(r.title)}</span><span class="m">${ctx.fmtDate(r.starts_at)} · ${(r.members || []).length}명</span></a>`).join('')}</div>
        <div class="acts"><button class="btn btn--plain" data-close>닫기</button></div>`);
      d.querySelectorAll('[data-r]').forEach(a => a.onclick = e => { e.preventDefault(); d.close(); fill(raids[Number(a.dataset.r)]); });
    }

    draw();
  }

  window.RaidLead = { define, ROLES };
})();
