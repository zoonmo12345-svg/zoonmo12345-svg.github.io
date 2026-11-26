// 화면 반응 효과 모음 (가볍게: transform·opacity 만 건드림)
//   클릭 불꽃 · 자석 버튼([data-magnet]) · 마우스 따라오는 빛([data-spot]) · 기울기([data-tilt])
//   라이브 타이머([data-cd="시각"]) · 숫자 올라가기([data-count]) · 글자 풀리기(Fx.scramble)
(function () {
  const fine = matchMedia('(pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');

  // ── 클릭하면 금화 불꽃 ──
  if (!reduce) addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('i'); s.className = 'spark';
      const a = (Math.PI * 2 * i) / 7 + Math.random() * .5, d = 22 + Math.random() * 22;
      s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
      document.body.appendChild(s);
      s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 }],
        { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove();
    }
  }, { passive: true });

  // ── 마우스에 반응하는 것들 (한 군데서 처리) ──
  if (fine && !reduce) {
    let tilt = null, mag = null;
    addEventListener('pointermove', e => {
      const t = e.target instanceof Element ? e.target : null; if (!t) return;
      const spot = t.closest('[data-spot]');
      if (spot) { const r = spot.getBoundingClientRect(); spot.style.setProperty('--mx', (e.clientX - r.left) + 'px'); spot.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
      const tl = t.closest('[data-tilt]');
      if (tilt && tilt !== tl) { tilt.style.transform = ''; tilt = null; }
      if (tl) { const r = tl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        tl.style.transform = `perspective(900px) rotateX(${-y * 5}deg) rotateY(${x * 6}deg) translateZ(0)`; tilt = tl; }
      const m = t.closest('[data-magnet]');
      if (mag && mag !== m) { mag.style.transform = ''; mag = null; }
      if (m) { const r = m.getBoundingClientRect(); m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`; mag = m; }
    }, { passive: true });
  }

  // ── 라이브 타이머 ──
  function left(iso) { return Math.floor((new Date(iso).getTime() - Date.now()) / 1000); }
  function paint(el) {
    const s = left(el.dataset.cd), a = Math.abs(s), d = Math.floor(a / 86400), h = Math.floor(a % 86400 / 3600), m = Math.floor(a % 3600 / 60), ss = a % 60;
    el.classList.toggle('go', s <= 0); el.classList.toggle('soon', s > 0 && s <= 1800);
    if (el.dataset.cdf === 'big') {
      const set = (u, v) => { const x = el.querySelector(`[data-u="${u}"]`); if (x && x.textContent !== v) x.textContent = v; };
      set('d', String(d)); set('h', pad(h)); set('m', pad(m)); set('s', pad(ss));
      const dd = el.querySelector('[data-day]'); if (dd) dd.hidden = d === 0;
      const lb = el.querySelector('[data-lb]'); if (lb) lb.textContent = s <= 0 ? '출발하고 지난 시간' : '출발까지';
    } else {
      const t = (d ? d + '일 ' : '') + `${pad(h)}:${pad(m)}:${pad(ss)}`;
      const txt = s <= 0 ? `출발 +${t}` : `${t} 남음`;
      if (el.textContent !== txt) el.textContent = txt;
    }
  }
  function clock() {
    document.querySelectorAll('[data-cd]').forEach(paint);
    const k = document.getElementById('kst');
    if (k) k.textContent = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  }
  setInterval(clock, 1000);

  // ── 숫자 올라가기 ──
  function count(root = document) {
    root.querySelectorAll('[data-count]').forEach(el => {
      const to = Number(el.dataset.count) || 0; el.removeAttribute('data-count');
      if (reduce || !to) { el.textContent = to; return; }
      const t0 = performance.now();
      (function step(now) { const p = Math.min(1, (now - t0) / 600); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
    });
  }
  // ── 글자가 암호처럼 풀리며 나타남 ──
  function scramble(el) {
    if (reduce) return;
    const txt = el.textContent, pool = '가나다라마바사아자차카타파하거라슈고';
    let f = 0; const n = 14;
    (function step() { f++; el.textContent = [...txt].map((c, i) => c === ' ' || i < (f / n) * txt.length ? c : pool[Math.floor(Math.random() * pool.length)]).join(''); if (f < n) setTimeout(step, 32); else el.textContent = txt; })();
  }

  window.Fx = { refresh(root) { clock(); count(root); }, scramble };
})();
