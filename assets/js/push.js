// 레이드 알림
// 1) 이 기기에서 알림 허용 → 서비스 워커(sw.js) 등록 → 구독 정보를 서버에 저장 (실제 운영 모드)
// 2) 서버(Supabase)가 1분마다 "곧 출발하는 레이드"를 찾아 구독한 기기로 알림을 보냄 → 폰이 꺼져 있어도 옴
// 3) 사이트를 켜둔 동안에는 서버 없이도 이 파일이 직접 알림을 띄움 (데모 모드에서도 됨)
(function () {
  const C = window.SHUGO_CONFIG, S = window.Store;
  const supported = 'serviceWorker' in navigator && 'Notification' in window;
  const pushable = supported && 'PushManager' in window;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let reg = null;

  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };
  async function register() { if (!supported) return null; if (!reg) reg = await navigator.serviceWorker.register('sw.js'); return reg; }

  async function state() {
    if (!supported) return 'unsupported';
    if (isIOS && !standalone) return 'ios-install';          // 아이폰은 홈 화면에 추가한 뒤에만 알림을 켤 수 있음
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission !== 'granted') return 'off';
    return 'on';
  }
  async function enable() {
    const r = await register();
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('알림이 막혀 있어. 브라우저 설정에서 이 사이트 알림을 허용해줘');
    if (pushable && S.live && C.vapidPublicKey) {
      const sub = await r.pushManager.getSubscription() || await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(C.vapidPublicKey) });
      await S.savePushSub(sub.toJSON());
    }
    await show('알림이 켜졌어', '레이드 출발 전에 여기로 알려줄게.', 'test');
  }
  async function disable() {
    const r = await register(); if (!r) return;
    const sub = pushable ? await r.pushManager.getSubscription() : null;
    if (sub) { try { await S.removePushSub(sub.endpoint); } catch (e) {} await sub.unsubscribe(); }
  }
  async function show(title, body, tag) {
    const r = await register(); if (!r || Notification.permission !== 'granted') return;
    await r.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag, data: { url: './#/raid' } });
  }

  // 사이트를 켜둔 동안의 알림: 내가 참여한 레이드가 설정한 시간 안으로 들어오면 한 번 띄움
  const label = m => m >= 1440 ? Math.round(m / 1440) + '일' : m >= 60 ? Math.round(m / 60) + '시간' : m + '분';
  async function check() {
    const u = S.me(); if (!u || u.status !== 'approved' || !supported || Notification.permission !== 'granted') return;
    let offs = [], raids = [];
    try { offs = await S.getPushOffsets(); raids = await S.listRaids(); } catch (e) { return; }
    let fired = {}; try { fired = JSON.parse(localStorage.getItem('shugo_fired') || '{}'); } catch (e) {}
    const now = Date.now();
    for (const r of raids) {
      if (!(r.members || []).some(m => m.user_id === u.id)) continue;
      const start = new Date(r.starts_at).getTime();
      for (const o of offs) {
        const at = start - o * 60000, key = r.id + ':' + o;
        if (now >= at && now < at + 5 * 60000 && now < start && !fired[key]) {
          fired[key] = now;
          show(`${label(o)} 뒤 출발: ${r.title}`, `${new Date(start).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })} 출발${r.dungeon ? ' · ' + r.dungeon : ''}`, 'raid-' + key);
        }
      }
    }
    Object.keys(fired).forEach(k => { if (now - fired[k] > 3 * 86400e3) delete fired[k]; });
    try { localStorage.setItem('shugo_fired', JSON.stringify(fired)); } catch (e) {}
  }
  if (supported) { register().catch(() => {}); setInterval(check, 30000); setTimeout(check, 4000); }

  window.Push = { supported, isIOS, standalone, state, enable, disable, show, label, OPTIONS: [1440, 180, 60, 30, 10] };
})();
