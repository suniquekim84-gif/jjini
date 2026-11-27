/* 찌니 대시보드 — 2학기 주간 일정 데이터
   새 학기가 되면 이 파일의 시간만 고치면 대시보드에 바로 반영됩니다.
   days 의 숫자는 요일입니다. 1=월 … 5=금 (토·일은 학교·학원이 없어요)

   아래 schoolWeek 는 그날그날 학교 시간표입니다. 주간학습안내를 받으면
   날짜별로 morning(아침활동) · periods(교시) · prep(준비물)을 적어 두면
   대시보드 '오늘' 탭과 '준비' 탭에 그날 것만 나옵니다. */
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
      재능: 'orange',
      국어: 'pink',
      수학: 'blue',
      과학: 'mint',
      사회: 'orange',
      도덕: 'violet',
      음악: 'amber',
      미술: 'pink',
      체육: 'mint'
    },

    /* 그날그날 학교 시간표 (주간학습안내 기준)
       · periods : 1교시부터 차례로 { subject, note(선택), test(수행평가 이름, 선택) }
       · prep    : 그날 학교에 챙길 준비물 [{ id, label, emoji }] — '준비' 탭 체크 항목이 됩니다 */
    schoolWeek: {
      from: '2026-11-30',
      to: '2026-12-04',
      days: {
        '2026-11-30': {
          morning: [{ text: '세줄 쓰기' }, { text: '독서' }],
          periods: [
            { subject: '도덕' },
            { subject: '국어' },
            { subject: '국어' },
            { subject: '과학' },
            { subject: '음악', note: '음악회 발표 연습' }
          ],
          prep: [
            { id: 'school-instrument-practice', label: '음악회 연습용 개인 악기', emoji: '🎤' }
          ]
        },
        '2026-12-01': {
          morning: [{ text: '세줄 쓰기' }, { text: '독서' }],
          periods: [
            { subject: '국어' },
            { subject: '영어' },
            { subject: '과학' },
            { subject: '과학' },
            { subject: '음악', test: '음악회 발표하기' }
          ],
          prep: [
            { id: 'school-instrument', label: '음악회 발표용 개인 악기', emoji: '🎤' }
          ]
        },
        '2026-12-02': {
          morning: [{ text: '세줄 쓰기' }, { text: '독서' }],
          periods: [
            { subject: '국어' },
            { subject: '체육' },
            { subject: '과학' },
            { subject: '과학' },
            { subject: '과학', test: '실천하는 과학' }
          ],
          prep: [
            { id: 'school-comfy-clothes', label: '활동하기 편한 복장', emoji: '🧥' }
          ]
        },
        '2026-12-03': {
          morning: [{ text: '독서기록장 제출', strong: true }],
          periods: [
            { subject: '과학' },
            { subject: '수학' },
            { subject: '국어' },
            { subject: '국어' },
            { subject: '미술' },
            { subject: '미술', note: '세계 명절 음식 조사·자료집' }
          ],
          prep: [
            { id: 'school-reading-log', label: '독서기록장 제출', emoji: '📖' },
            { id: 'school-holiday-food-art', label: '세계 명절 음식 그림', emoji: '📝' }
          ]
        },
        '2026-12-04': {
          morning: [{ text: '세줄 쓰기' }, { text: '독서' }],
          periods: [
            { subject: '수학' },
            { subject: '체육' },
            { subject: '영어' },
            { subject: '사회' },
            { subject: '사회' }
          ],
          prep: [
            { id: 'school-comfy-clothes', label: '활동하기 편한 복장', emoji: '🧥' }
          ]
        }
      }
    },

    /** 그날의 학교 시간표 (없는 날은 null) */
    schoolDay: function (dateISO) {
      var week = window.FamilySchedule.schoolWeek;
      return (week && week.days && week.days[dateISO]) || null;
    },

    /** 오늘 이후 가장 가까운 학교 시간표 날짜 (없으면 null) */
    nextSchoolDay: function (dateISO) {
      var week = window.FamilySchedule.schoolWeek;
      if (!week || !week.days) return null;
      var keys = Object.keys(week.days).sort();
      for (var i = 0; i < keys.length; i++) {
        if (keys[i] >= dateISO) return keys[i];
      }
      return null;
    }
  };
})();
