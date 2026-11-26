// 도구 등록소
// 새 기능을 만들면 Tools.add({...}) 한 번이면 왼쪽 메뉴·메뉴 찾기·홈 도구 목록에 자동으로 들어감.
//   id      : 주소에 쓰는 이름 (#/tool/<id>)
//   name    : 메뉴에 보일 짧은 이름 (예: '무스펠 자리')
//   full    : 마우스 올렸을 때·찾기 창에 보일 전체 이름 (예: '무스펠의 성배 공대장 도우미')
//   icon    : app.js 의 IC 아이콘 이름 (flame, snow, tools …)
//   desc    : 한 줄 설명
//   dungeon : 레이드 모집의 던전 이름과 같으면 모집 글에 '자리 넣기' 버튼이 생김 (선택)
//   render(view, ctx) : 화면 그리기
window.Tools = {
  list: [],
  add(t) { this.list.push(t); },
  get(id) { return this.list.find(t => t.id === id); }
};
