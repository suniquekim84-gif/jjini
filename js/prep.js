/* 찌니 대시보드 — 등교·학원·취침 준비
   · 등교: 평일 08:30 출발, 준비물 안경·외투·핸드폰
   · 학원: 수업 시작 10분 전 출발, 수업별 확인 항목
   · 취침: 월·수·금 21:00 샤워 · 22:00 자기, 화·목 21:30 샤워 · 22:30 자기
           (토·일은 정해진 취침 루틴이 없어 참고 시간만 보여 줍니다)
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

  /* 취침 준비 — 요일별 샤워·취침 시간 (토·일은 없음) */
  var BED_TABLE = {
    1: { shower: '21:00', sleep: '22:00' },
    2: { shower: '21:30', sleep: '22:30' },
    3: { shower: '21:00', sleep: '22:00' },
    4: { shower: '21:30', sleep: '22:30' },
    5: { shower: '21:00', sleep: '22:00' }
  };

  var BED_ITEMS = [
    { id: 'shower', label: '샤워하기', emoji: '🚿' },
    { id: 'sleep', label: '자기', emoji: '😴' }
  ];

  /* 주말에 보여 줄 참고 시간 */
  var BED_REF = [
    { label: '월·수·금', shower: '21:00', sleep: '22:00' },
    { label: '화·목', shower: '21:30', sleep: '22:30' }
  ];

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

  function dowOf(dateISO) {
    var p = String(dateISO).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0).getDay();
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
    if (window.FamilySync && typeof window.FamilySync.touch === 'function') {
      try { window.FamilySync.touch(); } catch (e) { /* noop */ }
    }
  }

  function dayOf(all, dateISO, create) {
    if (!all[dateISO]) {
      if (!create) return null;
      all[dateISO] = { school: {}, academy: {}, bed: {} };
    }
    var day = all[dateISO];
    if (!day.school || typeof day.school !== 'object') day.school = {};
    if (!day.academy || typeof day.academy !== 'object') day.academy = {};
    if (!day.bed || typeof day.bed !== 'object') day.bed = {};
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

  /* ---------------- 취침 ---------------- */
  /* 오늘 요일의 취침 계획 (주말이면 null) */
  function bedPlan(dateISO) {
    var dow = dowOf(dateISO);
    var t = BED_TABLE[dow];
    if (!t) return null;
    return {
      dow: dow,
      shower: t.shower,
      sleep: t.sleep,
      showerMin: minutesOf(t.shower),
      sleepMin: minutesOf(t.sleep),
      tag: (dow === 2 || dow === 4) ? '화·목은 조금 늦게' : '월·수·금 시간'
    };
  }

  function bedList(dateISO) {
    var plan = bedPlan(dateISO);
    if (!plan) return [];
    var day = dayOf(read(), dateISO, false);
    var saved = (day && day.bed) || {};
    return BED_ITEMS.map(function (it) {
      return {
        id: it.id,
        label: it.label,
        emoji: it.emoji,
        at: it.id === 'shower' ? plan.shower : plan.sleep,
        atMin: it.id === 'shower' ? plan.showerMin : plan.sleepMin,
        checked: !!saved[it.id]
      };
    });
  }

  function toggleBed(dateISO, itemId) {
    var all = read();
    var day = dayOf(all, dateISO, true);
    if (day.bed[itemId]) delete day.bed[itemId];
    else day.bed[itemId] = true;
    write(all);
    var list = bedList(dateISO);
    var label = '';
    list.forEach(function (it) { if (it.id === itemId) label = it.label; });
    return {
      item: itemId,
      label: label,
      checked: !!day.bed[itemId],
      done: list.length > 0 && list.every(function (it) { return it.checked; }),
      count: list.filter(function (it) { return it.checked; }).length,
      total: list.length
    };
  }

  /* 취침 준비 남은 시간 안내 */
  function bedStatus(atMin, nowMin) {
    var left = atMin - nowMin;
    if (left > 60) {
      var h = Math.floor(left / 60);
      var m = left % 60;
      return { state: 'wait', left: left, text: h + '시간' + (m ? ' ' + m + '분' : '') + ' 남음' };
    }
    if (left > 0) return { state: 'soon', left: left, text: left + '분 남음' };
    if (left > -10) return { state: 'now', left: left, text: '지금이에요!' };
    return { state: 'over', left: left, text: '시간 지났어요' };
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
    BED_ITEMS: BED_ITEMS,
    BED_REF: BED_REF,
    bedPlan: bedPlan,
    bedList: bedList,
    toggleBed: toggleBed,
    bedStatus: bedStatus,
    clear: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
    }
  };
})();
