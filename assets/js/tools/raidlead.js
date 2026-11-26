// 공대장 도우미 = 자리 넣기.
// 1팟·2팟 이름과 직업을 넣으면 넴드별 자리가 바로 채워지고, 짧은 공지를 한 번에 복사함.
// 레이드별 내용은 data-*.js 에만 있음.
(function () {
  const JOBS = ['검성', '수호성', '살성', '궁성', '마도성', '정령성', '치유성', '호법성', '권성', '기타'];
  const SIZE = 10, HALF = 5;

  function load(id) {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('seat_' + id)); } catch (e) {}
    s = s && Array.isArray(s.names) ? s : {};
    return { names: Array.from({ length: SIZE }, (_, i) => (s.names || [])[i] || ''), jobs: Array.from({ length: SIZE }, (_, i) => (s.jobs || [])[i] || ''), over: s.over || {}, boss: s.boss || 0 };
  }
  const save = (id, st) => { try { localStorage.setItem('seat_' + id, JSON.stringify(st)); } catch (e) {} };
  const jobOf = t => JOBS.find(j => t && (j === t || j.startsWith(t) || t.startsWith(j.replace('성', '')))) || '';

  function define(R) {
    Tools.add({ id: R.id, group: '공대장 도구', name: R.short + ' 자리', full: R.name + ' 공대장 도우미', icon: R.icon, desc: '1팟·2팟 자리 넣기', dungeon: R.name, render(view, ctx) { mount(view, ctx, R); } });
  }

  function mount(view, ctx, R) {
    const { esc, toast, sheet } = ctx;
    const st = load(R.id);
    const persist = () => save(R.id, st);
    const has = i => !!st.names[i].trim();
    const partyOf = i => i < HALF ? 1 : 2;

    // ── 자리 계산 ──
    function assign(B) {
      const slots = B.slots || [], res = slots.map(() => []), used = new Set();
      const ov = st.over[B.id];
      if (ov) { slots.forEach((s, si) => { res[si] = (ov[si] || []).filter(i => i != null && has(i)); res[si].forEach(i => used.add(i)); }); return res; }
      slots.map((s, si) => si).sort((a, b) => (slots[a].pri ?? 50) - (slots[b].pri ?? 50)).forEach(si => {
        const s = slots[si];
        const score = i => { const j = st.jobs[i]; let v = 20; if (s.jobs) { const k = s.jobs.indexOf(j); if (k >= 0) v = k; } if (s.avoid && s.avoid.includes(j)) v += 30; return v; };
        res[si] = st.names.map((_, i) => i).filter(i => has(i) && !used.has(i) && (!s.party || partyOf(i) === s.party))
          .sort((a, b) => score(a) - score(b) || a - b).slice(0, s.count || 1);
        res[si].forEach(i => used.add(i));
      });
      return res;
    }
    const label = s => s.at ? s.at + '시' : s.label;
    function message(B) {
      if (!B.slots) return B.text;
      const res = assign(B);
      const parts = B.slots.map((s, si) => res[si].length ? `${label(s)} ${res[si].map(i => st.names[i].trim()).join('·')}` : '').filter(Boolean);
      return parts.length ? `${B.prefix} ${parts.join(' / ')}` : '';
    }

    // ── 화면 ──
    function draw() {
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      view.innerHTML = `<div class="page">
        <div class="ph"><h1>${esc(R.short)} 자리</h1>
          <div class="ph__act">${ctx.isOk() ? '<button class="btn btn--sm" id="fromRaid">모집에서 불러오기</button>' : ''}<button class="btn btn--sm" id="paste">한 번에 붙여넣기</button><button class="btn btn--sm btn--plain" id="clear">비우기</button></div></div>
        <div class="seat">
          <div class="pn">
            <div class="pots">${[1, 2].map(p => `<div class="pot pot--${p}"><h2><i></i>${p}팟</h2>${Array.from({ length: HALF }, (_, k) => { const i = (p - 1) * HALF + k; return `<div class="prow">
              <input class="input" data-n="${i}" value="${esc(st.names[i])}" placeholder="닉네임" maxlength="16" aria-label="${p}팟 ${k + 1}번 닉네임" autocomplete="off">
              <select class="select" data-j="${i}" aria-label="${p}팟 ${k + 1}번 직업"><option value="">직업</option>${JOBS.map(j => `<option ${j === st.jobs[i] ? 'selected' : ''}>${j}</option>`).join('')}</select></div>`; }).join('')}</div>`).join('')}</div>
            <p class="mut" style="font-size:12.5px;margin-top:10px">엔터로 다음 칸. 직업을 넣으면 탱·힐 자리를 알아서 맞춰줘. 이 브라우저에 저장돼.</p>
          </div>
          <div class="out" id="out"></div>
        </div></div>`;
      view.querySelectorAll('[data-n]').forEach(el => {
        el.oninput = () => { st.names[el.dataset.n] = el.value; persist(); drawOut(); };
        el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const nx = view.querySelector(`[data-n="${Number(el.dataset.n) + 1}"]`); if (nx) nx.focus(); } };
      });
      view.querySelectorAll('[data-j]').forEach(el => el.onchange = () => { st.jobs[el.dataset.j] = el.value; persist(); drawOut(); });
      view.querySelector('#clear').onclick = () => { if (confirm('이름과 자리를 전부 비울까?')) { st.names.fill(''); st.jobs.fill(''); st.over = {}; persist(); draw(); } };
      view.querySelector('#paste').onclick = pasteSheet;
      const fr = view.querySelector('#fromRaid'); if (fr) fr.onclick = () => raidSheet();
      drawOut();
      if (q.get('raid') && ctx.isOk()) raidSheet(q.get('raid'));
    }

    function drawOut() {
      const out = view.querySelector('#out'); if (!out) return;
      const B = R.bosses[st.boss] || R.bosses[0], res = B.slots ? assign(B) : [], msg = message(B);
      const chip = (si, k, i) => `<button class="cs__n ${i == null ? 'none' : 'p' + partyOf(i)}" data-si="${si}" data-k="${k}">${i == null ? '비어 있음' : esc(st.names[i].trim())}</button>`;
      const slotHtml = (s, si) => Array.from({ length: s.count || 1 }, (_, k) => chip(si, k, res[si][k] ?? null)).join('');
      const clock = B.slots ? B.slots.map((s, si) => { if (!s.at) return ''; const a = s.at * Math.PI / 6, r = 39;
        return `<div class="cs" style="left:${50 + r * Math.sin(a)}%;top:${50 - r * Math.cos(a)}%"><span class="cs__h">${s.at}시${s.note ? ' · ' + esc(s.note) : ''}</span>${slotHtml(s, si)}</div>`; }).join('') : '';
      const rows = B.slots ? B.slots.map((s, si) => s.at ? '' : `<div><span>${esc(s.label)}${s.note ? ` <span class="mut">${esc(s.note)}</span>` : ''}</span><span class="cs">${slotHtml(s, si)}</span></div>`).join('') : '';
      out.innerHTML = `<div class="seg" role="tablist">${R.bosses.map((b, i) => `<button role="tab" data-b="${i}" class="${i === st.boss ? 'on' : ''}">${esc(b.sub)} ${esc(b.name)}</button>`).join('')}</div>
        <div class="pn" style="padding:14px">${B.slots ? `<div class="clock"><div class="clock__c">${esc(B.title)}<small>이름 누르면 바꿀 수 있어</small></div>${clock}</div>${rows ? `<div class="rowslots">${rows}</div>` : ''}` : '<p class="mut">이 넴드는 개인 자리가 없어. 오른쪽 공지만 복사하면 돼.</p>'}</div>
        <div><div class="copy"><pre>${msg ? esc(msg) : '<span class="mut">이름을 넣으면 여기에 공지가 만들어져</span>'}</pre><button id="cp" ${msg ? '' : 'disabled'}>${esc(B.sub)} 공지 복사</button></div>
        ${st.over[B.id] ? '<button class="btn btn--plain btn--sm" id="auto" style="margin-top:8px">자동 배정으로 되돌리기</button>' : ''}
        ${B.tips ? `<div class="tips">${B.tips.map(t => `<details open><summary>${esc(t.t)}</summary><ul>${t.l.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</div>` : ''}</div>`;
      out.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { st.boss = Number(b.dataset.b); persist(); drawOut(); });
      out.querySelector('#cp').onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('복사했어. 게임 채팅에 붙여넣어'); } catch (e) { toast('복사가 막혔어. 글자를 직접 긁어서 복사해', true); } };
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
      const d = sheet(`<h2>한 번에 붙여넣기</h2><p>한 줄에 한 명. 위 5명이 1팟, 아래 5명이 2팟. 직업은 이름 뒤에 써도 되고 빼도 돼.</p>
        <textarea class="textarea" id="pt" style="min-height:220px" placeholder="불고기 수호&#10;마라샹 치유&#10;토니포트 궁성&#10;…"></textarea>
        <div class="acts"><button class="btn btn--plain" data-close>취소</button><button class="btn btn--gold" id="ok">넣기</button></div>`);
      d.querySelector('#pt').focus();
      d.querySelector('#ok').onclick = () => {
        const rows = d.querySelector('#pt').value.split(/[\n,]+/).map(x => x.trim()).filter(Boolean).slice(0, SIZE);
        if (!rows.length) return;
        st.names.fill(''); st.jobs.fill(''); st.over = {};
        rows.forEach((row, i) => { const w = row.split(/[\s/·]+/).filter(Boolean); const j = w.length > 1 ? jobOf(w[w.length - 1]) : ''; st.names[i] = (j ? w.slice(0, -1) : w).join(' ').slice(0, 16); st.jobs[i] = j; });
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
        const next = [0, HALF];                                           // 탱·힐부터 1팟·2팟에 번갈아 넣어서 양쪽에 고르게
        mem.slice(0, SIZE).forEach((m, x) => { let p = x % 2; if (next[p] >= (p ? SIZE : HALF)) p = 1 - p; const i = next[p]++; st.names[i] = m.n.slice(0, 16); st.jobs[i] = JOBS.includes(m.j) ? m.j : ''; });
        persist(); draw(); toast('모집 명단을 넣었어');
      };
      if (pick) { const r = raids.find(x => String(x.id) === String(pick)); history.replaceState(null, '', '#/tool/' + R.id); if (r) fill(r); return; }
      if (!raids.length) { toast('잡힌 레이드가 없어'); return; }
      const d = sheet(`<h2>모집에서 불러오기</h2><p>참여자 닉네임과 직업을 1팟·2팟에 나눠 넣어.</p>
        <div class="list">${raids.map((r, i) => `<a href="#" data-r="${i}"><span class="when num">${ctx.fmtTime(r.starts_at)}</span><span class="t">${esc(r.title)}</span><span class="m">${ctx.fmtDate(r.starts_at)} · ${(r.members || []).length}명</span></a>`).join('')}</div>
        <div class="acts"><button class="btn btn--plain" data-close>닫기</button></div>`);
      d.querySelectorAll('[data-r]').forEach(a => a.onclick = e => { e.preventDefault(); d.close(); fill(raids[Number(a.dataset.r)]); });
    }

    draw();
  }

  window.RaidLead = { define, JOBS };
})();
