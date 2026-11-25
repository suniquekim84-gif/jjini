/* 찌니 대시보드 — 2학기 주간 일정 데이터
   새 학기가 되면 이 파일의 시간만 고치면 대시보드에 바로 반영됩니다.
   days 의 숫자는 요일입니다. 1=월 … 5=금 (토·일은 학교·학원이 없어요) */
(function () {
  'use strict';

  window.FamilySchedule = {
    semester: '2학기',
    kids: {
      jjini: {
        id: 'jjini',
        name: '찌니',
        char: 'pikachu',
        days: {
          1: { school: '13:40', items: [{ name: '영어', start: '16:20', end: '17:30' }] },
          2: { school: '13:40', items: [{ name: '검도', start: '16:30', end: '17:30' }, { name: '줄넘기', start: '18:20', end: '19:20' }] },
          3: { school: '13:40', items: [{ name: '재능', start: '15:30', end: '15:50' }, { name: '영어', start: '16:20', end: '17:30' }] },
          4: { school: '14:30', items: [{ name: '검도', start: '16:30', end: '17:30' }, { name: '줄넘기', start: '18:20', end: '19:20' }] },
          5: { school: '13:40', items: [{ name: '줄넘기', start: '14:10', end: '15:10' }] }
        }
      }
    },
    /** 과목별 파스텔 색 (CSS 클래스 접미사) */
    colors: {
      영어: 'violet',
      줄넘기: 'amber',
      검도: 'mint',
      재능: 'orange'
    }
  };
})();
