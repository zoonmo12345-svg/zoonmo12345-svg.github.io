// 비탄의 설원 (4성역, 10인) 자리
// 2넴 자리표 = 쐐기 패턴(수정 쐐기 기믹). 안쪽 4명(주시: 줄 받아서 보라 수정만 깨기, 근딜·탱) + 바깥 4명(얼음 쐐기 부수기, 원딜. 모자라면 힐러) + 힐러 2명(자기 팟 두 방향 사이).
// 팟마다 붙어 있는 두 방향을 맡음: 1팟 9시·12시 / 2팟 3시·6시. 2-2 는 전원 한 칸 옆(+1).
// 조사 근거: 디시 '성역 공대장 공략'(내부 주시 4 + 외부 쐐기 4, 팟별 2방향), 인벤 팁 6444 (2246·2249·2276), NC 공식 공략. 방향을 어느 팟이 맡는지는 우리 공대 기준으로 정한 것.
(function () {
  const IN = { jobs: ['근딜', '메인탱', '서브탱'], avoid: ['원딜', '힐러'], pri: 10, cls: 'cs--sm' };
  const OUT = { jobs: ['원딜', '근딜'], avoid: ['서브탱', '메인탱', '힐러'], pri: 20, cls: 'cs--sm' };
  const HEAL = { jobs: ['힐러'], pri: 30, cls: 'cs--sm' };
  RaidLead.define({
    id: 'bitan', name: '비탄의 설원', short: '비탄', icon: 'snow', thumb: 'assets/img/raid-bitan.webp', desc: '2넴 쐐기 자리 · 신뇌사 1414',
    bosses: [
      { id: 'b1', sub: '1넴', name: '트리톤',
        text: '★1팟★ 구슬 9시→12시 ◆ ★2팟★ 구슬 3시→6시' },
      { id: 'b2', sub: '2넴', name: '델트라스', title: '쐐기', copyName: '쐐기 공지', rings: [21, 42],
        legend: '안쪽 원 = <b>주시(근딜·탱)</b>, 바깥 원 = <b>쐐기(원딜)</b>, 사이 = 힐러. <b>2-2 는 전원 한 칸 옆</b>(12→1 · 3→5 · 6→7 · 9→11시)이라거.',
        slots: [
          { key: 'in9', at: 9, r: 21, party: 1, name: '9시 안', ...IN },
          { key: 'in12', at: 12, r: 21, party: 1, name: '12시 안', ...IN },
          { key: 'in3', at: 3, r: 21, party: 2, name: '3시 안', ...IN },
          { key: 'in6', at: 6, r: 21, party: 2, name: '6시 안', ...IN },
          { key: 'out9', at: 9, r: 43, party: 1, name: '9시 밖', ...OUT },
          { key: 'out12', at: 12, r: 43, party: 1, name: '12시 밖', ...OUT },
          { key: 'out3', at: 3, r: 43, party: 2, name: '3시 밖', ...OUT },
          { key: 'out6', at: 6, r: 43, party: 2, name: '6시 밖', ...OUT },
          { key: 'h1', at: 10.5, r: 33, party: 1, name: '1팟 힐', ...HEAL },
          { key: 'h2', at: 4.5, r: 33, party: 2, name: '2팟 힐', ...HEAL }
        ],
        // 한 줄 공지: 안쪽 / 바깥 / 힐 순서, 그 안에서 1팟·2팟
        copy(H) {
          const f = k => H.at(k)[0];
          const part = (lab, items) => { const a = items.filter(x => x[1]).map(x => `${x[0]} ${x[1]}`); return a.length ? `${lab} ${a.join('·')}` : ''; };
          const row = (t, p1, p2) => { const a = [part('1팟', p1), part('2팟', p2)].filter(Boolean); return a.length ? `★${t}★ ${a.join(' / ')}` : ''; };
          const rows = [
            row('안쪽(근딜)', [['9시', f('in9')], ['12시', f('in12')]], [['3시', f('in3')], ['6시', f('in6')]]),
            row('바깥(원딜)', [['9시', f('out9')], ['12시', f('out12')]], [['3시', f('out3')], ['6시', f('out6')]]),
            row('힐', [['10시반', f('h1')]], [['4시반', f('h2')]])
          ].filter(Boolean);
          return rows.length ? rows.join(' ◆ ') + ' ◆ 2-2는 전원 +1칸' : '';
        },
        extras: [
          { name: '신뇌사 1414 공지', text: H => { const mt = H.byRole('메인탱')[0], st = H.byRole('서브탱')[0]; return `★신뇌사 1414★ 11시 1팟 ◆ 5시 2팟 ◆ 1시 메인탱${mt ? ' ' + mt : ''} ◆ 7시 서브탱${st ? ' ' + st : ''}`; } }
        ],
        tips: [
          { t: '쐐기', l: [
            '안쪽 4명: 줄(주시)을 받아서 보라 수정만 깨기. 파란 수정은 피하기',
            '바깥 4명: 얼음 쐐기 부수기. 장판은 깔고 빠지면서 치기',
            '힐러: 자기 팟 두 방향 사이. 원딜이 모자라면 바깥 쐐기에 참여',
            '2-2: 전원 한 칸 옆으로 (12→1 · 3→5 · 6→7 · 9→11시)'
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
