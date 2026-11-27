// 비탄의 설원 (4성역, 10인) 자리
// 2넴 자리표 = 쐐기 패턴(수정 쐐기 기믹).
//   외부(쐐기) 4명은 꼭 필요: 9·12·3·6시. 원딜 먼저, 모자라면 근딜 → 탱, 힐러는 맨 마지막.
//   내부(주시)는 나머지 딜·탱이 겹치지 않게 고르게 벌려 섬. 인원은 명단에 맞춰 자동이고 − + 로 바꿀 수 있음. 자동일 땐 힐러를 내부에 안 넣고, 직접 늘렸을 때만 남는 자리에 힐러가 들어감.
//   2페: 내부는 그대로, 쐐기만 +1시간 (9→10 · 12→1 · 3→4 · 6→7시).
// 조사 근거: 디시 '성역 공대장 공략'(내부 주시 + 외부 쐐기 4), 인벤 팁 6444 (2246·2249·2276), NC 공식 공략. 2페 +1시간·내부 유동은 상회장 지시(2026-11-27).
(function () {
  const hourText = h => { const v = Math.round(((h % 12) + 12) % 12 * 2) / 2; return (Math.floor(v) || 12) + '시' + (v % 1 ? '반' : ''); };
  const side = h => { const v = ((h % 12) + 12) % 12; return v >= 7.5 || v < 1.5 ? 1 : 2; };          // 9·12시 쪽 = 1팟, 3·6시 쪽 = 2팟 (같은 팟끼리 붙게)
  const innerMax = I => Math.max(0, I.n - Math.min(4, I.n));
  const innerAuto = I => { const non = I.n - I.healers; return Math.max(0, non - Math.min(4, non)); };
  const innerN = I => I.opt.inner != null ? Math.min(innerMax(I), Math.max(0, I.opt.inner)) : innerAuto(I);
  const fromNine = h => ((h - 9) % 12 + 12) % 12;
  const fmt = shift => H => {
    const IN = H.each.filter(x => x.s.kind === 'in' && x.names.length).sort((a, b) => fromNine(a.s.hour) - fromNine(b.s.hour)).map(x => `${hourText(x.s.hour)} ${x.names[0]}`);
    const OUT = H.each.filter(x => x.s.kind === 'out' && x.names.length).map(x => `${hourText(x.s.hour + shift)} ${x.names[0]}`);
    return [IN.length ? '[내부] ' + IN.join(' / ') : '', OUT.length ? '[외부] ' + OUT.join(' / ') : ''].filter(Boolean).join(' ◆ ');
  };
  RaidLead.define({
    id: 'bitan', name: '비탄의 설원', short: '비탄', icon: 'snow', thumb: 'assets/img/raid-bitan.webp', desc: '2넴 쐐기 자리 (1페 · 2페)',
    bosses: [
      { id: 'b1', sub: '1넴', name: '트리톤',
        text: '[1팟] 구슬 9시→12시 ◆ [2팟] 구슬 3시→6시' },
      { id: 'b2', sub: '2넴', name: '델트라스', title: '쐐기', copyName: '쐐기 1페', rings: [21, 42],
        legend: '안쪽 원 = <b>내부(주시)</b>, 바깥 원 = <b>외부(쐐기)</b>. <b>2페는 쐐기만 +1시간</b>(9→10 · 12→1 · 3→4 · 6→7시)이라거.',
        ctl: { key: 'inner', label: '내부 인원', value: innerN, max: innerMax },
        slots(I) {
          const n = innerN(I), a = [];
          [9, 12, 3, 6].forEach(h => a.push({ key: 'o' + h, kind: 'out', hour: h, at: h, r: 43, name: h + '시 밖', prefParty: side(h), jobs: ['원딜', '근딜', '서브탱', '메인탱'], avoid: ['힐러'], pri: 10, cls: 'cs--sm' }));
          for (let k = 0; k < n; k++) { const h = 12 * k / n; a.push({ key: 'i' + k, kind: 'in', hour: h, at: h || 12, r: 21, name: hourText(h) + ' 안', prefParty: side(h), ...(I.opt.inner != null ? { avoid: ['힐러'] } : { never: ['힐러'] }), pri: 20, cls: 'cs--sm' }); }
          const free = I.n - Math.min(4, I.n) - n;
          if (free > 0) a.push({ key: 'free', label: '자유', note: '힐러 · 자기 팟 쪽에서 힐', count: free, jobs: ['힐러'], pri: 90, nocopy: true });
          return a;
        },
        copy: fmt(0),
        extras: [{ name: '쐐기 2페 (쐐기만 +1시간)', text: fmt(1) }],
        tips: [
          { t: '쐐기', l: [
            '외부 4명(꼭 필요): 얼음 쐐기 부수기. 장판은 깔고 빠지면서 치기',
            '내부: 줄(주시)을 받아서 보라 수정만 깨기. 파란 수정은 피하기. 겹치지 않게 넓게 서기',
            '힐러: 웬만하면 내부·외부에서 빠짐. 원딜이 모자랄 때만 외부 쐐기',
            '2페: 내부는 그대로, 쐐기만 +1시간 (9→10 · 12→1 · 3→4 · 6→7시)'
          ] },
          { t: '신뇌사 1414', l: [
            '1시 1명 · 5시 4명 · 7시 1명 · 11시 4명',
            '5시·11시는 4명이 붙어서 응집체 녹이기',
            '파도 문양 받은 사람만 한 칸 옆으로 뺐다가 복귀',
            '1시가 1팟을, 7시가 2팟을 한꺼번에 당김',
            '마지막에 1시가 전원 당겨서 1시 집결 (당기기 총 3번)'
          ] }
        ] }
    ]
  });
})();
