// 무스펠의 성배 (3성역, 10인) 자리
// 복사 공지: 1넴 = 축구(구슬 드리블) 자리만 / 2넴 = 신호등 시간만
// slots: at = 시계 방향, party = 1팟/2팟, jobs = 먼저 넣을 직업, avoid = 되도록 빼는 직업, pri = 채우는 순서(작을수록 먼저)
RaidLead.define({
  id: 'muspel', name: '무스펠의 성배', short: '무스펠', icon: 'flame',
  bosses: [
    { id: 'm1', sub: '1넴', name: '이스카리엘', title: '축구 자리', prefix: '축구',
      // 1팟(빨강) 9시·3시 / 2팟(초록) 12시·6시. 10인은 드리블 4명만 찍고 나머지는 대기
      slots: [
        { at: 12, party: 2, avoid: ['수호성', '치유성'] },
        { at: 3, party: 1, avoid: ['수호성', '치유성'] },
        { at: 6, party: 2, avoid: ['수호성', '치유성'] },
        { at: 9, party: 1, avoid: ['수호성', '치유성'] }
      ] },
    { id: 'm2', sub: '2넴', name: '칼드릭스', title: '신호등',  prefix: '신호등',
      // 1팟 왼쪽(7·9·11·12시) / 2팟 오른쪽(1·3·5·6시). 3·9시 치유, 5·7시 메인 두줄, 1·11시 서브 두줄, 남는 2명은 깍두기
      slots: [
        { at: 12, party: 1, pri: 30 },
        { at: 1, party: 2, note: '두줄', jobs: ['검성', '호법성', '수호성'], avoid: ['치유성'], pri: 20 },
        { at: 3, party: 2, note: '치유', jobs: ['치유성', '호법성'], pri: 1 },
        { at: 5, party: 2, note: '두줄', jobs: ['수호성', '검성', '호법성'], avoid: ['치유성'], pri: 10 },
        { at: 6, party: 2, pri: 30 },
        { at: 7, party: 1, note: '두줄', jobs: ['수호성', '검성', '호법성'], avoid: ['치유성'], pri: 10 },
        { at: 9, party: 1, note: '치유', jobs: ['치유성', '호법성'], pri: 1 },
        { at: 11, party: 1, note: '두줄', jobs: ['검성', '호법성', '수호성'], avoid: ['치유성'], pri: 20 },
        { label: '깍두기', note: '치유 뒤쪽 구석', count: 2, pri: 90 }
      ] }
  ]
});
