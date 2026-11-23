/* 찌니 대시보드 — 등교·학원 준비
   · 등교: 평일 08:30 출발, 준비물 안경·외투·핸드폰
   · 학원: 수업 시작 10분 전 출발, 수업별 확인 항목
   체크 기록은 이 기기의 localStorage 에 날짜별로 저장합니다. */
(function () {
  'use strict';

  var KEY = 'jjini.prep.v1';
  var KEEP_DAYS = 60;

  var SCHOOL_DEPART = '08:30';
  var LEAD_MIN = 10;

  var SCHOOL_ITEMS = [
    { id: 'glasses', label: '안경', emoji: '👓' },
    { id: 'coat', label: '외투', emoji: '🧥' },
    { id: 'phone', label: '핸드폰', emoji: '📱' }
  ];

  /* 수업 이름별 확인 항목 */
  var SUBJECT_CHECKS = {
    '줄넘기': { id: 'coat', label: '외투 입었는지 확인', emoji: '🧥' },
    '검도': { id: 'coat', label: '외투 입었는지 확인', emoji: '🧥' },
    '영어': { id: 'bag', label: '영어학원 가방 챙겼는지 확인', emoji: '🎒' },
    '재능': { id: 'homework', label: '과제 끝냈는지 확인', emoji: '📝' }
  };

  function minutesOf(hhmm) {
    var p = String(hhmm).split(':');
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function toHHMM(min) {
    var m = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return (h < 10 ? '0' + h : '' + h) + ':' + (mm < 10 ? '0' + mm : '' + mm);
  }

  /* 수업 시작 10분 전 출발 시각 */
  function departOf(start) {
    return toHHMM(minutesOf(start) - LEAD_MIN);
  }

  /* 남은 시간 안내 문구 */
  function status(departMin, endMin, nowMin) {
    var left = departMin - nowMin;
    if (left > 60) {
      var h = Math.floor(left / 60);
      var m = left % 60;
      return { state: 'wait', left: left, text: h + '시간' + (m ? ' ' + m + '분' : '') + ' 남음' };
    }
    if (left > 0) return { state: 'soon', left: left, text: left + '분 남음' };
    if (left > -10) return { state: 'now', left: left, text: '지금 출발!' };
    if (endMin != null && nowMin > endMin) return { state: 'over', left: left, text: '수업 끝' };
    return { state: 'done', left: left, text: '출발 완료' };
  }

  /* ---------------- 저장 ---------------- */
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var data = raw ? JSON.parse(raw) : null;
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function write(all) {
    var keys = Object.keys(all).sort();
    if (keys.length > KEEP_DAYS) {
      keys.slice(0, keys.length - KEEP_DAYS).forEach(function (k) { delete all[k]; });
    }
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* 용량 초과 등 */ }
  }

  function dayOf(all, dateISO, create) {
    if (!all[dateISO]) {
      if (!create) return null;
      all[dateISO] = { school: {}, academy: {} };
    }
    var day = all[dateISO];
    if (!day.school || typeof day.school !== 'object') day.school = {};
    if (!day.academy || typeof day.academy !== 'object') day.academy = {};
    return day;
  }

  /* ---------------- 등교 ---------------- */
  function schoolList(dateISO) {
    var day = dayOf(read(), dateISO, false);
    var checked = (day && day.school) || {};
    return SCHOOL_ITEMS.map(function (it) {
      return { id: it.id, label: it.label, emoji: it.emoji, checked: !!checked[it.id] };
    });
  }

  function toggleSchool(dateISO, itemId) {
    var all = read();
    var day = dayOf(all, dateISO, true);
    if (day.school[itemId]) delete day.school[itemId];
    else day.school[itemId] = true;
    write(all);
    var list = schoolList(dateISO);
    return {
      checked: !!day.school[itemId],
      done: list.every(function (it) { return it.checked; }),
      count: list.filter(function (it) { return it.checked; }).length,
      total: list.length
    };
  }

  /* ---------------- 학원 ---------------- */
  function academyList(dateISO, items) {
    var day = dayOf(read(), dateISO, false);
    var saved = (day && day.academy) || {};
    return (items || []).map(function (it) {
      var meta = SUBJECT_CHECKS[it.name] || {
        id: 'etc',
        label: it.name + ' 준비물 챙겼는지 확인',
        emoji: '🎒'
      };
      var slot = saved[it.start] || {};
      var checked = !!slot[meta.id];
      return {
        name: it.name,
        start: it.start,
        end: it.end,
        depart: departOf(it.start),
        departMin: minutesOf(it.start) - LEAD_MIN,
        endMin: minutesOf(it.end),
        check: { id: meta.id, label: meta.label, emoji: meta.emoji, checked: checked }
      };
    });
  }

  function toggleAcademy(dateISO, start, checkId) {
    var all = read();
    var day = dayOf(all, dateISO, true);
    if (!day.academy[start] || typeof day.academy[start] !== 'object') day.academy[start] = {};
    var slot = day.academy[start];
    if (slot[checkId]) delete slot[checkId];
    else slot[checkId] = true;
    write(all);
    return { checked: !!slot[checkId] };
  }

  window.FamilyPrep = {
    KEY: KEY,
    SCHOOL_DEPART: SCHOOL_DEPART,
    LEAD_MIN: LEAD_MIN,
    minutesOf: minutesOf,
    departOf: departOf,
    status: status,
    schoolList: schoolList,
    toggleSchool: toggleSchool,
    academyList: academyList,
    toggleAcademy: toggleAcademy,
    clear: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
    }
  };
})();
