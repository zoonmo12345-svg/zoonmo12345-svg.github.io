// 무스펠의 성배 (3성역, 10인) 자리
// slots: at = 시계 방향 자리, to = 옮겨 갈 자리, party = 1팟/2팟, jobs = 먼저 넣을 역할, avoid = 되도록 빼는 역할, pri = 채우는 순서(작을수록 먼저), nocopy = 공지에서 뺌
RaidLead.define({
  id: 'muspel', name: '무스펠의 성배', short: '무스펠', icon: 'flame', thumb: 'assets/img/raid-muspel.webp', desc: '1넴 공 옮기기 · 2넴 자리',
  bosses: [
    { id: 'm1', sub: '1넴', name: '이스카리엘', title: '공 옮기기',
      // 팟마다 2명씩. 9시 공 → 12시, 12시 공 → 9시, 3시·6시 공은 제자리. 근딜이 먼저 맡고, 모자라면 원딜. 힐러·탱은 뺌
      legend: '화살표 = 공을 옮기는 방향. <b>9시↔12시는 서로 바꾸고</b>, 3시·6시는 제자리라거.',
      slots: [
        { at: 9, to: 12, party: 1, jobs: ['근딜', '원딜'], avoid: ['서브탱', '힐러', '메인탱'] },
        { at: 12, to: 9, party: 1, jobs: ['근딜', '원딜'], avoid: ['서브탱', '힐러', '메인탱'] },
        { at: 3, to: 3, party: 2, jobs: ['근딜', '원딜'], avoid: ['서브탱', '힐러', '메인탱'] },
        { at: 6, to: 6, party: 2, jobs: ['근딜', '원딜'], avoid: ['서브탱', '힐러', '메인탱'] }
      ] },
    { id: 'm2', sub: '2넴', name: '칼드릭스', title: '자리',
      // 1팟 왼쪽(7·9·11·12시) / 2팟 오른쪽(1·3·5·6시). 3·9시 힐러, 5·7시 탱, 1·11시 근딜. 남는 2명(보통 힐러)은 깍두기 — 공지엔 안 넣음
      slots: [
        { at: 7, party: 1, note: '두줄', jobs: ['메인탱', '서브탱', '근딜'], avoid: ['힐러'], pri: 10 },
        { at: 9, party: 1, note: '힐', jobs: ['힐러'], pri: 1 },
        { at: 11, party: 1, note: '두줄', jobs: ['근딜', '서브탱', '원딜'], avoid: ['힐러'], pri: 20 },
        { at: 12, party: 1, jobs: ['원딜', '근딜'], avoid: ['힐러'], pri: 30 },
        { at: 1, party: 2, note: '두줄', jobs: ['근딜', '서브탱', '원딜'], avoid: ['힐러'], pri: 20 },
        { at: 3, party: 2, note: '힐', jobs: ['힐러'], pri: 1 },
        { at: 5, party: 2, note: '두줄', jobs: ['서브탱', '메인탱', '근딜'], avoid: ['힐러'], pri: 10 },
        { at: 6, party: 2, jobs: ['원딜', '근딜'], avoid: ['힐러'], pri: 30 },
        { label: '깍두기', note: '힐 뒤쪽 구석', count: 2, jobs: ['힐러'], pri: 90, nocopy: true }
      ] }
  ]
});
