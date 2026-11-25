/* 찌니 대시보드 — 엄마 일정
   날짜·시간·이름을 기기 localStorage 에 저장합니다.
   처음 열 때는 사용자가 알려 준 11월 일정을 기본으로 채웁니다. */
(function () {
  'use strict';

  var KEY = 'jjini.lectures.v1';

  /* 일정 저장 형식 버전 — 기기마다 한 번만 마이그레이션합니다.
     1 → 2: 기본값에서 뺀 2026-11-24 서부 일정을 이미 저장해 둔 기기에서 정리 */
  var SCHEMA = 2;
  var SCHEMA_KEY = 'jjini.lectures.schema';

  /* 2026-11-24 평택 디지털안전지도사 10회(서부)는 삭제되어 기본 일정에서 뺐습니다.
     예전 버전을 열어 기본값이 기기에 저장된 경우도 아래 마이그레이션에서 함께 지웁니다. */
  var RETIRED = { id: 'lec03', date: '2026-11-24', note: '서부' };

  var SEED = [
    { id: 'lec01', date: '2026-11-23', time: '09:50', title: '화성남양초', note: '' },
    { id: 'lec02', date: '2026-11-24', time: '09:50', title: '남양주도곡초', note: '비대면' },
    { id: 'lec04', date: '2026-11-24', time: '14:00~16:00', title: '평택 디지털안전지도사 10회', note: '북부' },
    { id: 'lec05', date: '2026-11-25', time: '14:00~16:00', title: '평택 디지털안전지도사 10회', note: '남부' },
    { id: 'lec06', date: '2026-11-26', time: '', title: '대전', note: '' },
    { id: 'lec07', date: '2026-11-29', time: '10:30', title: '강사평가', note: '' },
    { id: 'lec08', date: '2026-11-30', time: '13:50', title: '비대면 서울창일초', note: '' }
  ];

  function clone(list) {
    return list.map(function (it) {
      return { id: it.id, date: it.date, time: it.time, title: it.title, note: it.note || '' };
    });
  }

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 용량 초과 등 */ }
    if (window.FamilySync && typeof window.FamilySync.touch === 'function') {
      try { window.FamilySync.touch(); } catch (e) { /* noop */ }
    }
  }

  function storedSchema() {
    try {
      var v = parseInt(localStorage.getItem(SCHEMA_KEY), 10);
      return isNaN(v) ? 1 : v; /* 이전 버전에는 표시가 없었으니 1로 봅니다 */
    } catch (e) {
      return SCHEMA; /* 저장소를 못 읽으면 마이그레이션을 건너뜁니다 */
    }
  }

  function saveSchema() {
    try { localStorage.setItem(SCHEMA_KEY, String(SCHEMA)); } catch (e) { /* noop */ }
  }

  /* 기본값으로 들어 있던 서부 일정인지 — 기본 ID 이거나, 같은 날짜에 '서부' 표기가 붙은 항목 */
  function isRetired(it) {
    if (!it) return false;
    if (it.id === RETIRED.id) return true;
    return it.date === RETIRED.date && String(it.note || '').trim() === RETIRED.note;
  }

  function migrate(list) {
    if (storedSchema() >= SCHEMA) return list;
    var changed = false;
    var next = list.filter(function (it) {
      if (!isRetired(it)) return true;
      changed = true;
      return false;
    });
    if (changed) write(next);
    saveSchema();
    return next;
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        var seed = clone(SEED);
        write(seed);
        saveSchema();
        return seed;
      }
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return clone(SEED);
      return migrate(data.filter(function (it) { return it && it.date && it.title; }));
    } catch (e) {
      return clone(SEED);
    }
  }

  function startMin(time) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
  }

  function byDate(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return startMin(a.time) - startMin(b.time);
  }

  function uid() {
    return 'lec' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function clean(o) {
    return {
      date: String(o.date || '').slice(0, 10),
      time: String(o.time || '').trim().slice(0, 20),
      title: String(o.title || '').trim().slice(0, 40),
      note: String(o.note || '').trim().slice(0, 20)
    };
  }

  window.FamilyLectures = {
    KEY: KEY,

    list: function () {
      return read().sort(byDate);
    },

    onDate: function (dateISO) {
      return read().filter(function (it) { return it.date === dateISO; }).sort(byDate);
    },

    upcoming: function (dateISO, limit) {
      var list = read().filter(function (it) { return it.date > dateISO; }).sort(byDate);
      return limit ? list.slice(0, limit) : list;
    },

    countUpcoming: function (dateISO) {
      return read().filter(function (it) { return it.date > dateISO; }).length;
    },

    get: function (id) {
      var list = read();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },

    add: function (o) {
      var list = read();
      var item = clean(o);
      item.id = uid();
      if (!item.date || !item.title) return null;
      list.push(item);
      write(list.sort(byDate));
      return item;
    },

    update: function (id, o) {
      var list = read();
      var next = clean(o);
      var found = null;
      list.forEach(function (it) {
        if (it.id !== id) return;
        it.date = next.date || it.date;
        it.time = next.time;
        it.title = next.title || it.title;
        it.note = next.note;
        found = it;
      });
      write(list.sort(byDate));
      return found;
    },

    remove: function (id) {
      var list = read();
      var removed = null;
      var next = list.filter(function (it) {
        if (it.id === id) { removed = it; return false; }
        return true;
      });
      write(next);
      return removed;
    },

    restore: function (item) {
      if (!item) return;
      var list = read();
      list.push(item);
      write(list.sort(byDate));
    },

    clear: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
    }
  };
})();
