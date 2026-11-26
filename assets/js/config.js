// 슈고상회 설정 파일
// ─────────────────────────────────────────────
// supabaseUrl / supabaseAnonKey 를 비워두면 "데모 모드"로 돌아감
// (가입·글·레이드가 이 브라우저에만 저장됨. 실제 운영 전 시험용)
// Supabase 프로젝트 만든 뒤 docs/설정방법.md 순서대로 두 값을 채우면 실제 운영 모드.

// 암호화 안 된 주소(http)로 들어오면 안전한 주소(https)로 바로 옮김
if (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) location.replace('https://' + location.host + location.pathname + location.search + location.hash);

window.SHUGO_CONFIG = {
  supabaseUrl: 'https://vkwxwgcxekxusautwyyg.supabase.co',
  supabaseAnonKey: 'sb_publishable_PGENz-Qvli91FVOwxQsRRg_gAPC9uVy',     // 공개용 키 (비밀 키는 절대 여기 넣지 말 것)

  // 폰 알림용 공개 키 (짝이 되는 비밀 키는 D:\\슈고상회\\keys\\vapid_private.txt, 절대 사이트 폴더에 넣지 말 것)
  vapidPublicKey: 'BIVx1MAz7pr96tUWEOEAYBQABhItuOgFfG-ANrKQzHi0IRgUdKqOUuCddCYw20MYmhiQteszqDTPwPOGhAFoyxg',

  server: '파프니르',
  youtubeId: 'SdYI7jp3-tI',
  kakao: 'https://open.kakao.com/o/gg3LUYhi',
  discord: 'https://discord.gg/v2vCwWvA62',

  // 다운로드 목록. 프로그램 만들면 여기에 한 줄씩 추가.
  // 예) { name: '슈고 시세봇', version: '1.0.0', date: '2026-12-01', size: '12MB',
  //       desc: '거래소 시세 기록·차트', url: 'downloads/shugo-price-1.0.0.zip' }
  // showDownloads 를 true 로 바꾸면 다운로드 탭이 메뉴에 나타남
  showDownloads: false,
  downloads: [],

  // 게시판 분류
  boards: [
    { id: 'free',  name: '자유게시판' },
    { id: 'loot',  name: '득템자랑' },
    { id: 'house', name: '집꾸미기' },
    { id: 'info',  name: '정보공유' }
  ]
};
