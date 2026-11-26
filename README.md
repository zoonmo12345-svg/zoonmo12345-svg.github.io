# 슈고상회 (www.슈고상회.com)
아이온2 파프니르 서버 레기온 사이트. 깃허브 페이지로 배포, 도메인은 가비아.

## 화면 구성
- 소개 화면 (`#/intro`, 비회원 홍보용): 홍보영상 먼저 → 스크롤 연출 → 입장하기. `assets/js/landing.js`
  - 상회원이거나 한 번 입장한 사람은 소개 화면을 건너뛰고 바로 홈으로 감
- 앱 화면: 홈 · 공대장 도구 · 레이드 모집 · 게시판 · 쪽지함 · 내 정보 · 사이트관리. `assets/js/app.js`
- 디자인: `assets/css/site.css`

## 공대장 도구 (자리 넣기)
- 엔진 `assets/js/tools/raidlead.js`, 레이드별 자리 `data-muspel.js` · `data-bitan.js`
- 자리·공지 문구를 고칠 땐 data 파일만 고치면 됨
- 새 레이드 = data 파일 하나 추가 + `index.html` 에 script 한 줄 → 메뉴·찾기·홈에 자동 등록

## 데이터
- 설정(키·링크·게시판): `assets/js/config.js`
- 저장소 `assets/js/store.js`: 키가 비어 있으면 데모 모드(관리자 `admin / admin`), 채우면 Supabase
- DB 설계 `supabase/schema.sql`, 운영 켜는 법 `docs/설정방법.md`

## 이미지
- `assets/img/g-*.webp`, `assets/fly/*.webp`: 아이온2 공식 슈고 이미지를 참고해 힉스필드로 생성
- 스크롤 프레임 다시 만들기: `python ../tools/make_fly_frames.py <영상파일>`
- 게임 이미지 © NCSOFT
