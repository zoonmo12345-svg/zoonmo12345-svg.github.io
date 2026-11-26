// 소개 화면 (비회원 홍보용). 여기만 화려하게.
// - 첫 화면: 큰 제목(마우스에 반응) + 홍보영상
// - 스크롤: 어둠 속 구멍이 화악 열리면서 카메라가 가게 안으로 들어감 (영상 프레임을 스크롤에 맞춰 그림)
// 문구는 아래 BEATS · END 만 고치면 됨.
(function () {
  const FRAMES = 84;            // assets/fly/001.webp ~ (tools/make_fly_frames.py 가 맞춰 적음). 0 이면 가게 그림 확대로 대신함
  const IMG = 'assets/img/';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const out3 = t => 1 - Math.pow(1 - clamp(t), 3);
  let stop = null;

  const BEATS = [
    { en: 'Raid Lead', h: ['자리는 우리가', '잡아준다거'], p: '어디 설지 몰라도 된다. 이름만 대면 공대장이 자리부터 정해준다.', img: 'g-leader.webp', alt: '지도를 들고 방향을 가리키는 슈고' },
    { en: 'Schedule', h: ['시간 되는 날만', '손 들라거'], p: '모집이 뜨면 참여만 누르면 끝. 누가 오는지는 장부에 다 적힌다.', img: 'g-merchant.webp', alt: '장부를 든 슈고 상인' },
    { en: 'Loot', h: ['먹은 건 다 같이', '호들갑이라거'], p: '혼자 조용히 먹게 안 둔다. 올리면 다 같이 축하한다.', img: 'g-loot.webp', alt: '보석을 번쩍 든 슈고' }
  ];
  const END = { h: ['한 자리', '비워뒀다거'], p: '구경은 누구나. 상회원은 상회장 승인만 받으면 된다거~' };

  const words = lines => lines.map(l => `<span class="ln">${l.split(' ').map(w => `<span class="w"><i>${w}</i></span>`).join(' ')}</span>`).join('');
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ring = `<svg class="lp-ring" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" stroke-width=".6" stroke-dasharray="1 7"/><circle cx="100" cy="100" r="78" fill="none" stroke="currentColor" stroke-width=".5"/><path d="M100 0v14M100 186v14M0 100h14M186 100h14" stroke="currentColor" stroke-width=".8"/></svg>`;

  function render(view, ctx) {
    const C = window.SHUGO_CONFIG, esc = ctx.esc;
    // 디스코드 · 카카오톡 큰 버튼
    const socials = cls => `<div class="lp-socials ${cls}">
      <a class="lp-soc lp-soc--dc" href="${esc(C.discord)}" target="_blank" rel="noopener"><img class="lp-soc__ic" src="assets/img/g-ic-dc.webp" alt="" width="64" height="64"><span class="lp-soc__tx"><small>음성 · 공지 · 모집</small><b>디스코드 들어오기</b></span>${arrow}</a>
      <a class="lp-soc lp-soc--kk" href="${esc(C.kakao)}" target="_blank" rel="noopener"><img class="lp-soc__ic" src="assets/img/g-ic-kk.webp" alt="" width="64" height="64"><span class="lp-soc__tx"><small>가볍게 말 걸기</small><b>카카오톡 오픈채팅</b></span>${arrow}</a></div>`;
    view.innerHTML = `<div class="lp">
    <div class="lp-grain" aria-hidden="true"></div>
    <header class="lp-top">
      <span class="lp-logo">슈고상회<em>Shugo Trading Co.</em></span>
      <div class="lp-top__r">${ctx.me() ? '' : '<a class="lp-login" href="#/login">로그인</a>'}<button class="lp-enter" data-enter data-magnet>입장하기 ${arrow}</button></div>
    </header>

    <section class="lp-hero" id="lpHero">
      <div class="lp-glow" id="lpGlow" aria-hidden="true"></div>
      <div class="lp-hero__in">
        <div class="lp-meta" aria-hidden="true"><span>Aion 2 Legion</span><span>Now Recruiting</span></div>
        <h1 class="lp-title" id="lpTitle" aria-label="슈고상회">${[...'슈고상회'].map((c, i) => `<span style="--i:${i}" aria-hidden="true"><b>${c}</b></span>`).join('')}</h1>
        <div class="lp-film">
          <span class="lp-film__sign"><i></i>홍보영상<i></i></span>
          <i class="lp-cn lp-cn--1"></i><i class="lp-cn lp-cn--2"></i><i class="lp-cn lp-cn--3"></i><i class="lp-cn lp-cn--4"></i>
          <div class="lp-film__in"><iframe src="https://www.youtube.com/embed/${esc(C.youtubeId)}?rel=0" title="슈고상회 홍보영상" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>
        </div>
        ${socials('lp-socials--hero')}
      </div>
    </section>

    <section class="lp-fly" id="lpFly" aria-label="슈고상회는 이런 곳">
      <div class="lp-stage">
        <div class="lp-cam" id="lpCam"><canvas id="lpCanvas"></canvas></div>
        <div class="lp-vig" aria-hidden="true"></div>
        <div class="lp-iris" id="lpIris" aria-hidden="true"></div>
        <div class="lp-dim" id="lpDim"></div>
        ${BEATS.map((b, i) => `<article class="lp-beat ${i % 2 ? 'lp-beat--r' : ''}">
          <span class="lp-beat__no" aria-hidden="true">0${i + 1}</span>
          <div class="lp-beat__t"><span class="lp-beat__en">${b.en}</span><h2>${words(b.h)}</h2><p>${b.p}</p></div>
          <div class="lp-beat__c">${ring}<img src="${IMG}${b.img}" alt="${b.alt}" loading="lazy"></div>
        </article>`).join('')}
        <div class="lp-end" id="lpEnd">
          <span class="lp-beat__en">Join us</span>
          <h2>${words(END.h)}</h2>
          <p>${END.p}</p>
          <button class="lp-enter lp-enter--xl" data-enter data-magnet>입장하기 ${arrow}</button>
          <div class="lp-end__sub"><a href="#/signup">상회원 가입</a></div>
          ${socials('lp-socials--end')}
        </div>
        <nav class="lp-steps" id="lpSteps" aria-hidden="true">${BEATS.map((b, i) => `<span><b>0${i + 1}</b>${b.en}</span>`).join('')}</nav>
        <div class="lp-prog"><i id="lpProg"></i></div>
      </div>
    </section>
    <div class="lp-foot">게임 이미지 © NCSOFT · 슈고상회는 NCSOFT와 관계없는 유저 레기온 사이트</div></div>`;

    view.querySelectorAll('[data-enter]').forEach(b => b.onclick = ctx.enter);
    start(view);
  }


  // ── 시바견 털 버튼 ──
  // 몸통과 아이콘은 털 재질 그림(힉스필드 생성), 코드로는 테두리 솜털과 귀만 그림. 마우스가 지나가면 테두리 털이 살랑 밀림.
  const SHIBA = { top: [214, 150, 84], bottom: [240, 214, 176], earIn: '#f7e4c8' };
  function fur(el) {
    const PAD = 30, cv = document.createElement('canvas'), g = cv.getContext('2d');
    cv.className = 'lp-fur'; el.prepend(cv);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, strands = [], ears = [], mx = -999, my = -999, hot = false, raf = 0, t0 = 0, ruffle = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const mix = (k, d) => { const c = SHIBA.top.map((v, i) => Math.round(Math.min(255, Math.max(0, v + (SHIBA.bottom[i] - v) * k + d)))); return `rgb(${c[0]},${c[1]},${c[2]})`; };
    const tone = y => Math.min(1, Math.max(0, (y / H - .45) / .55));

    function build() {
      const r = el.getBoundingClientRect(); W = r.width; H = r.height;
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = (W + PAD * 2) * dpr; cv.height = (H + PAD * 2) * dpr;
      cv.style.width = (W + PAD * 2) + 'px'; cv.style.height = (H + PAD * 2) + 'px';
      g.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr);
      strands = []; const R = Math.min(26, H / 2);
      const add = (x, y, ang, len, a) => strands.push({ x, y, ang, len, a, c: mix(tone(y), rnd(-16, 18)), b: 0, v: 0, ph: Math.random() * 6.28 });
      ears = [{ x: R + 18, d: -1 }, { x: W - R - 18, d: 1 }];
      // 테두리 솜털: 짧고 가늘게 여러 겹 (안쪽에서 시작해서 살짝만 밖으로)
      const J = () => rnd(-.3, .3), L = () => rnd(3, 6.5), IN = () => rnd(0, 2.5);
      for (let layer = 0; layer < 3; layer++) {
        const step = 1.05 + layer * .15;
        for (let x = R; x <= W - R; x += step) { add(x, IN(), -Math.PI / 2 + J(), L(), rnd(.55, .95)); add(x, H - IN(), Math.PI / 2 + J(), L(), rnd(.55, .95)); }
        for (let y = R; y <= H - R; y += step) { add(IN(), y, Math.PI + J(), L(), rnd(.55, .95)); add(W - IN(), y, J(), L(), rnd(.55, .95)); }
        [[R, R, Math.PI, 1.5 * Math.PI], [W - R, R, 1.5 * Math.PI, 2 * Math.PI], [W - R, H - R, 0, .5 * Math.PI], [R, H - R, .5 * Math.PI, Math.PI]].forEach(([cx, cy, a0, a1]) => {
          for (let a = a0; a < a1; a += step / R) { const rr = R - IN(); add(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, a + J(), L(), rnd(.55, .95)); }
        });
      }
      draw(0);
    }
    function draw(t) {
      g.clearRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
      const wig = hot || ruffle > 0 ? Math.sin(t / 110) * 6 : 0;
      ears.forEach(e => { g.save(); g.translate(e.x, 5); g.rotate(e.d * (8 + wig) * Math.PI / 180);
        g.shadowColor = mix(0, -6); g.shadowBlur = 4;
        g.fillStyle = mix(0, -6); g.beginPath(); g.moveTo(-17, 3); g.quadraticCurveTo(-5, -20, 0, -27); g.quadraticCurveTo(5, -20, 17, 3); g.closePath(); g.fill();
        g.shadowBlur = 0; g.fillStyle = SHIBA.earIn; g.beginPath(); g.moveTo(-8, 3); g.quadraticCurveTo(-2, -10, 0, -16); g.quadraticCurveTo(2, -10, 8, 3); g.closePath(); g.fill(); g.restore(); });
      g.lineCap = 'round'; g.lineWidth = 1;
      for (const s of strands) {
        const a = s.ang + s.b, tx = s.x + Math.cos(a) * s.len, ty = s.y + Math.sin(a) * s.len;
        const ma = s.ang + s.b * .4, qx = s.x + Math.cos(ma) * s.len * .55, qy = s.y + Math.sin(ma) * s.len * .55;
        g.globalAlpha = s.a; g.strokeStyle = s.c;
        g.beginPath(); g.moveTo(s.x, s.y); g.quadraticCurveTo(qx, qy, tx, ty); g.stroke();
      }
      g.globalAlpha = 1;
    }
    function tick(t) {
      raf = 0; const dt = Math.min(40, t - t0 || 16) / 16; t0 = t;
      let busy = false; if (ruffle > 0) ruffle -= dt;
      for (const s of strands) {
        let target = 0;
        const dx = s.x - mx, dy = s.y - my, d = Math.hypot(dx, dy);
        if (hot && d < 80) { const p = 1 - d / 80; let da = Math.atan2(dy, dx) - s.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); target = da * p * .8 + Math.sin(t / 80 + s.ph) * .25 * p; }
        if (ruffle > 0) target += Math.sin(t / 70 + s.ph) * .35 * (ruffle / 40);
        s.v += (target - s.b) * .14 * dt; s.v *= Math.pow(.8, dt); s.b += s.v * dt;
        if (Math.abs(s.v) > .003 || Math.abs(s.b) > .01) busy = true;
      }
      draw(t);
      if (hot || busy || ruffle > 0) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf && !reduce) raf = requestAnimationFrame(tick); };
    const move = e => { const r = el.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; hot = true; kick(); };
    const leave = () => { hot = false; ruffle = 40; kick(); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerdown', () => { ruffle = 40; kick(); });
    const ro = new ResizeObserver(build); ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }

  function start(view) {
    const $ = s => view.querySelector(s), $$ = s => [...view.querySelectorAll(s)];
    const hero = $('#lpHero'), glow = $('#lpGlow'), letters = $$('#lpTitle span');
    const fly = $('#lpFly'), cam = $('#lpCam'), cv = $('#lpCanvas'), g = cv.getContext('2d', { alpha: false });
    const iris = $('#lpIris'), dim = $('#lpDim'), end = $('#lpEnd'), prog = $('#lpProg'), steps = $$('#lpSteps span');
    const endWords = $$('#lpEnd .w i');
    const beats = $$('.lp-beat').map(el => ({ el, t: el.querySelector('.lp-beat__t'), c: el.querySelector('.lp-beat__c'), ring: el.querySelector('.lp-ring'), no: el.querySelector('.lp-beat__no'), w: [...el.querySelectorAll('.w i')], p: el.querySelector('p'), en: el.querySelector('.lp-beat__en') }));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;
    const furOff = $$('.lp-soc').map(el => fur(el));

    const frames = [];
    const still = new Image(); still.src = IMG + 'g-shop.webp';
    for (let i = 0; i < FRAMES; i++) { const im = new Image(); im.decoding = 'async'; im.src = `assets/fly/${String(i + 1).padStart(3, '0')}.webp`; frames.push(im); }
    const ready = im => im && im.complete && im.naturalWidth > 0;

    let cw = 0, ch = 0, last = -1;
    function size() {
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      cw = cv.width = Math.min(1920, Math.round(innerWidth * dpr));
      ch = cv.height = Math.round(cw * innerHeight / innerWidth);
      last = -1;
    }
    function draw(im, zoom) {
      const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight) * zoom, w = im.naturalWidth * s, h = im.naturalHeight * s;
      g.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    // 마우스 (부드럽게 따라옴)
    let px = innerWidth / 2, py = innerHeight / 2, sx = px, sy = py, moved = false;
    const onMove = e => { px = e.clientX; py = e.clientY; moved = true; };
    if (fine && !reduce) addEventListener('pointermove', onMove, { passive: true });

    let cur = 0, prevT = 0, raf = 0, alive = true;
    const inner = letters.map(l => l.firstElementChild);

    function tick(now) {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min(1000, now - prevT || 16); prevT = now;
      const k = 1 - Math.exp(-dt / 120);
      sx += (px - sx) * k; sy += (py - sy) * k;
      const nx = sx / innerWidth - .5, ny = sy / innerHeight - .5;

      // ── 첫 화면: 제목 글자가 마우스에 반응 + 따라다니는 불빛 ──
      const hr = hero.getBoundingClientRect();
      if (hr.bottom > 0 && fine && !reduce) {
        glow.style.transform = `translate3d(${sx - 360}px,${sy - 360}px,0)`;
        glow.style.opacity = String(clamp(hr.bottom / (innerHeight * .6)));
        if (moved) letters.forEach((l, i) => {                      // 매번 지금 위치를 재서 계산 → 스크롤했다 돌아와도 안 어긋남
          const b = l.getBoundingClientRect(), d = Math.hypot(sx - (b.left + b.width / 2), sy - (b.top + b.height / 2)), v = out3(1 - d / 460);
          inner[i].style.transform = `translate3d(0,${-v * 20}px,0) scale(${1 + v * .09})`;
          l.style.setProperty('--s', v.toFixed(3));
        });
      }

      // ── 스크롤 장면 ──
      const r = fly.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50) return;
      const target = clamp(-r.top / (fly.offsetHeight - innerHeight));
      const before = cur;
      cur = reduce ? target : cur + (target - cur) * k;
      if (Math.abs(target - cur) < .0003) cur = target;
      const p = cur, vel = clamp((cur - before) * 60, -1, 1);

      // 카메라: 처음엔 빠르게 훅 들어가고 그 뒤로 천천히
      const kf = clamp(.16 * out3(p / .1) + .84 * smooth((p - .06) / .8));
      if (FRAMES) {
        let i = Math.round(kf * (FRAMES - 1));
        while (i > 0 && !ready(frames[i])) i--;
        if (i !== last && ready(frames[i])) { draw(frames[i], 1); last = i; }
        else if (last < 0 && ready(still)) { draw(still, 1); last = -2; }
      } else if (ready(still)) { const z = Math.round((1 + kf * 1.6) * 400) / 400; if (z !== last) { draw(still, z); last = z; } }

      // 어둠 속 구멍이 화악 열림 (화면에 들어오기 시작할 때부터 조금씩)
      const lead = clamp((innerHeight - r.top) / innerHeight);          // 0 = 막 보이기 시작, 1 = 화면에 꽉 참
      const open = out3(lead * .05 + p / .13);
      iris.style.transform = `translate(-50%,-50%) scale(${1 + open * 9})`;
      iris.style.opacity = open >= 1 ? '0' : '1';
      cam.style.transform = `scale(${1.3 - .3 * open}) translate3d(${-nx * 14}px,${-ny * 10}px,0)`;

      // 설명 3장
      let active = -1;
      beats.forEach((b, i) => {
        const t = (p - (.13 + i * .235)) / .22;
        const a = smooth(t / .3), o = smooth((t - .76) / .24), vis = a * (1 - o), dir = i % 2 ? -1 : 1;
        if (vis > .5) active = i;
        b.el.style.visibility = vis > .002 ? 'visible' : 'hidden';
        if (vis <= .002) return;
        b.w.forEach((w, j) => { const wa = smooth((t - j * .035) / .24); w.style.transform = `translate3d(0,${(1 - wa) * 110 - o * 110}%,0) skewY(${vel * -4}deg)`; });
        const pa = smooth((t - .12) / .2);
        b.en.style.opacity = b.p.style.opacity = String(pa * (1 - o));
        b.p.style.transform = `translate3d(0,${(1 - pa) * 24}px,0)`;
        b.t.style.transform = `translate3d(${nx * 16}px,${ny * 10}px,0)`;
        b.c.style.opacity = String(vis);
        b.c.style.transform = `translate3d(${dir * (1 - out3(t / .3)) * 34 - nx * 2.2}vw,${-o * 14 - ny * 1.6}vh,0) rotate(${dir * (1 - a) * 12 + vel * dir * 3}deg) scale(${.82 + .18 * a})`;
        b.ring.style.transform = `rotate(${p * 900 * dir}deg) scale(${.7 + .3 * a})`;
        b.no.style.opacity = String(vis * .9);
        b.no.style.transform = `translate3d(${-dir * (t - .5) * 12 - nx * 2}vw,0,0)`;
      });
      steps.forEach((s, i) => s.classList.toggle('on', i === active));
      steps[0].parentElement.style.opacity = String(smooth((p - .1) / .05) * (1 - smooth((p - .84) / .05)));

      // 마지막
      const e = smooth((p - .85) / .09);
      dim.style.opacity = String(e * .84);
      end.style.opacity = String(e);
      end.style.visibility = e > .002 ? 'visible' : 'hidden';
      endWords.forEach((w, j) => { w.style.transform = `translate3d(0,${(1 - smooth((p - .86 - j * .012) / .07)) * 110}%,0)`; });
      end.classList.toggle('live', e > .5);
      prog.style.transform = `scaleX(${p})`;
    }
    const onResize = () => { size(); };
    size();
    addEventListener('resize', onResize);
    raf = requestAnimationFrame(tick);
    stop = () => { alive = false; furOff.forEach(f => f()); cancelAnimationFrame(raf); removeEventListener('resize', onResize); removeEventListener('pointermove', onMove); stop = null; };
  }

  window.Landing = { render, stop() { if (stop) stop(); } };
})();
