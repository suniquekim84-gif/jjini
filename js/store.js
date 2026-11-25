/* 찌니 대시보드 — 데이터 저장소
   ------------------------------------------------------------------
   모든 기록은 localStorage 에 저장됩니다. 화면 코드는 이 파일의 API만
   쓰기 때문에, 나중에 여러 기기에서 함께 쓰고 싶다면 아래 setAdapter()에
   Supabase / Firebase 어댑터를 끼우기만 하면 됩니다.
   (예시: js/sync-supabase.example.js)

   날짜를 미리 보거나 테스트할 때는 주소 뒤에 ?today=2026-11-16 처럼
   날짜를 붙이면 그날로 열립니다. (기록은 그대로 유지)
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var KEY = 'uri-family-dashboard.v3';
  var SCHEMA = 8;

  /* 매일 독서 루틴 — 기존 기기에도 빠짐없이 들어가도록 마이그레이션에서 확인합니다. */
  var READ_ROUTINE_ID = 'r_jj_read';
  var READ_ROUTINE = { id: READ_ROUTINE_ID, text: '독서 30분', repeat: 'daily', group: 'read' };

  /* 매일 아킬레스건 운동 — 보상 트래커(재능/문제집/독서)와 상관없는 건강 루틴입니다. */
  var ACHILLES_ROUTINE_ID = 'r_jj_achilles';
  var ACHILLES_ROUTINE = { id: ACHILLES_ROUTINE_ID, text: '아킬레스건 운동하기', repeat: 'daily', group: 'health' };

  /* 이제 쓰지 않는 구성원. 예전에 저장된 기록이 남아 있어도
     불러올 때 깔끔히 지워서 찌니 한 명 구성만 남깁니다. */
  var REMOVED_MEMBERS = { mom: true, dad: true, naeun: true };
  /* 예전 기본 동네의 좌표 — 저장된 값이 이 좌표면 새 기본 동네(동탄2신도시)로 바꿉니다. */
  var LEGACY_PLACE = { lat: '37.380', lon: '126.803' };

  /* ---------------- 날짜 도우미 ---------------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ymd(str) {
    var p = String(str).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
  }
  function addDays(str, n) {
    var d = ymd(str);
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function isWeekday(str) {
    var day = ymd(str).getDay(); // 0=일, 6=토
    return day >= 1 && day <= 5;
  }
  function startOfWeek(str) {
    var d = ymd(str);
    var day = d.getDay(); // 0=일
    var diff = day === 0 ? -6 : 1 - day; // 월요일로
    d.setDate(d.getDate() + diff);
    return iso(d);
  }
  function parseOverride() {
    try {
      var v = new URLSearchParams(location.search).get('today');
      if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    } catch (e) { /* 아주 오래된 브라우저 */ }
    return null;
  }
  function parseNowOverride() {
    try {
      var v = new URLSearchParams(location.search).get('now');
      var m = v && /^(\d{1,2}):(\d{2})$/.exec(v);
      if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return { h: Number(m[1]), m: Number(m[2]) };
    } catch (e) { /* 아주 오래된 브라우저 */ }
    return null;
  }
  var overrideDate = parseOverride();
  var overrideNow = parseNowOverride();

  function todayISO() { return overrideDate || iso(new Date()); }
  /** 오늘 날짜·시각. ?today=·?now= 로 바꿔 미리 볼 수 있습니다. */
  function nowDate() {
    var real = new Date();
    var h = overrideNow ? overrideNow.h : real.getHours();
    var mi = overrideNow ? overrideNow.m : real.getMinutes();
    var d = overrideDate ? ymd(overrideDate) : new Date();
    d.setHours(h, mi, overrideNow ? 0 : real.getSeconds(), 0);
    return d;
  }

  /* ---------------- 기본값 ---------------- */
  function defaultState() {
    return {
      version: SCHEMA,
      createdAt: Date.now(),
      settings: {
        place: { name: '동탄2신도시', lat: 37.2001, lon: 127.0990 }
      },
      members: [
        { id: 'jjini', name: '찌니', sub: '오늘도 피카피카 ⚡', char: 'pikachu', role: 'kid', stars: 3 }
      ],
      /* 반복 루틴 — 매일/평일 구분. group 은 찌니 보상 트래커에서 씁니다. */
      routines: {
        jjini: [
          { id: 'r_jj_korean', text: '재능학습지 국어 2장 풀기', repeat: 'daily', group: 'jaeneung' },
          { id: 'r_jj_math', text: '재능학습지 수학 2장 풀기', repeat: 'daily', group: 'jaeneung' },
          { id: 'r_jj_hanja', text: '한자어휘문제집 2장씩 풀기', repeat: 'weekday', group: 'workbook' },
          { id: 'r_jj_history', text: '역사문제집 2장씩 풀기', repeat: 'weekday', group: 'workbook' },
          { id: 'r_jj_read', text: '독서 30분', repeat: 'daily', group: 'read' },
          { id: 'r_jj_achilles', text: '아킬레스건 운동하기', repeat: 'daily', group: 'health' }
        ]
      },
      days: {},
      stamps: { jjini: {} }
    };
  }

  /* ---------------- 상태 로드 ---------------- */
  var state = null;
  var listeners = [];
  var saveTimer = null;

  function readLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function isLegacyPlace(place) {
    if (place.lat == null || place.lon == null) return false;
    return Number(place.lat).toFixed(3) === LEGACY_PLACE.lat &&
      Number(place.lon).toFixed(3) === LEGACY_PLACE.lon;
  }

  function migrate(data) {
    var base = defaultState();
    if (!data || !Array.isArray(data.members) || !data.members.length) return base;
    // 빠진 항목은 기본값으로 채워요 (이전 버전 기록도 살아남도록)
    var members = data.members.filter(function (m) {
      return m && m.id && !REMOVED_MEMBERS[m.id];
    }).map(function (m) {
      return Object.assign({ stars: 0, role: 'kid' }, m);
    });
    if (!members.length) return base;

    var settings = Object.assign({}, base.settings, data.settings || {});
    if (!settings.place || !settings.place.name || isLegacyPlace(settings.place)) {
      settings.place = base.settings.place;
    }

    // 지운 구성원의 루틴·별·도장·할 일이 저장본에 남아 있으면 함께 지워요.
    var routines = Object.assign({}, data.routines || {});
    var stamps = Object.assign({}, data.stamps || {});
    var days = {};
    Object.keys(REMOVED_MEMBERS).forEach(function (id) {
      delete routines[id];
      delete stamps[id];
    });
    Object.keys(data.days || {}).forEach(function (d) {
      var src = data.days[d] || {};
      var tasks = Object.assign({}, src.tasks || {});
      Object.keys(REMOVED_MEMBERS).forEach(function (id) { delete tasks[id]; });
      days[d] = Object.assign({}, src, { tasks: tasks });
    });

    var out = {
      version: SCHEMA,
      createdAt: data.createdAt || Date.now(),
      settings: settings,
      members: members,
      routines: Object.assign({}, base.routines, routines),
      days: days,
      stamps: Object.assign({}, base.stamps, stamps)
    };
    out.members.forEach(function (m) { if (!out.stamps[m.id]) out.stamps[m.id] = {}; });

    // SCHEMA 6 — '독서 30분' 매일 루틴이 빠진 기기에도 넣고, 이미 있던 루틴·할 일 문구도
    // 같은 이름으로 맞춥니다. (앞으로 생기는 날짜에도 같은 이름으로 채워져요)
    out.members.forEach(function (m) {
      if (!Array.isArray(out.routines[m.id])) out.routines[m.id] = [];
      var found = null;
      out.routines[m.id].forEach(function (r) { if (r && r.id === READ_ROUTINE_ID) found = r; });
      if (!found) {
        out.routines[m.id].push(Object.assign({}, READ_ROUTINE));
      } else {
        found.text = READ_ROUTINE.text;
        found.group = 'read';
        found.repeat = 'daily';
      }
    });
    Object.keys(out.days).forEach(function (d) {
      var tasks = out.days[d] && out.days[d].tasks;
      if (!tasks) return;
      out.members.forEach(function (m) {
        (tasks[m.id] || []).forEach(function (t) {
          if (t && t.id === READ_ROUTINE_ID) {
            t.text = READ_ROUTINE.text;
            t.group = 'read';
            t.repeat = 'daily';
          }
        });
      });
    });

    // SCHEMA 7 — '아킬레스건 운동하기' 매일 루틴. 이미 쓰던 기기의 루틴과
    // 오늘 할 일 목록에 한 번만 넣습니다. (내일부터는 루틴에서 자동으로 채워져요)
    var today = todayISO();
    out.members.forEach(function (m) {
      if (!Array.isArray(out.routines[m.id])) out.routines[m.id] = [];
      var hasRoutine = out.routines[m.id].some(function (r) { return r && r.id === ACHILLES_ROUTINE_ID; });
      if (!hasRoutine) out.routines[m.id].push(Object.assign({}, ACHILLES_ROUTINE));

      var day = out.days[today];
      if (!day || !day.tasks || !Array.isArray(day.tasks[m.id])) return;
      var hasTask = day.tasks[m.id].some(function (t) { return t && t.id === ACHILLES_ROUTINE_ID; });
      if (!hasTask) day.tasks[m.id].push(Object.assign({ done: false }, ACHILLES_ROUTINE));
    });

    // SCHEMA 8 — 찌니 캐릭터를 피카츄로. 이미 쓰던 기기의 한 줄 소개도 함께 맞춥니다.
    out.members.forEach(function (m) {
      if (!m.sub || m.sub === '햄찌와 함께') m.sub = '오늘도 피카피카 ⚡';
      m.char = 'pikachu';
    });
    return out;
  }

  /* ---------------- 저장 ---------------- */
  var adapter = null; // 원격 저장소 (Supabase 등) 가 있으면 여기에
  function persist(silent) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 용량 초과 등 */ }
      if (adapter && typeof adapter.save === 'function') {
        try { adapter.save(state); } catch (e) { /* 오프라인 */ }
      }
      if (!silent) notify();
    }, 120);
  }

  function notify() {
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } });
  }

  /* ---------------- 날짜별 할 일 ---------------- */
  function ensureDay(dateISO) {
    var seeded = false;
    if (!state.days[dateISO]) { state.days[dateISO] = { tasks: {} }; seeded = true; }
    var day = state.days[dateISO];
    if (!day.tasks) { day.tasks = {}; seeded = true; }
    var weekday = isWeekday(dateISO);
    state.members.forEach(function (m) {
      if (day.tasks[m.id]) return;
      day.tasks[m.id] = (state.routines[m.id] || [])
        .filter(function (r) { return r.repeat === 'daily' || (r.repeat === 'weekday' && weekday); })
        .map(function (r) {
          return { id: r.id, text: r.text, repeat: r.repeat, group: r.group || null, done: false };
        });
      seeded = true;
    });
    if (seeded) pruneDays();
    return day;
  }

  function pruneDays() {
    var keys = Object.keys(state.days).sort();
    if (keys.length <= 120) return;
    keys.slice(0, keys.length - 120).forEach(function (k) { delete state.days[k]; });
  }

  function tasksFor(memberId, dateISO) {
    var day = ensureDay(dateISO || todayISO());
    if (!day.tasks[memberId]) day.tasks[memberId] = [];
    return day.tasks[memberId];
  }

  function findMember(id) {
    for (var i = 0; i < state.members.length; i++) {
      if (state.members[i].id === id) return state.members[i];
    }
    return null;
  }

  function findTask(memberId, taskId, dateISO) {
    var list = tasksFor(memberId, dateISO);
    for (var i = 0; i < list.length; i++) if (list[i].id === taskId) return list[i];
    return null;
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------------- 도장 ---------------- */
  function stampMap(memberId) {
    if (!state.stamps[memberId]) state.stamps[memberId] = {};
    return state.stamps[memberId];
  }
  function stampSource(memberId, dateISO) { return stampMap(memberId)[dateISO] || null; }

  function setStamp(memberId, dateISO, source) {
    var map = stampMap(memberId);
    if (source) map[dateISO] = source;
    else delete map[dateISO];
    persist(false);
  }

  function syncAutoStamp(memberId, dateISO) {
    var m = findMember(memberId);
    if (!m || m.role !== 'kid') return false;
    var list = tasksFor(memberId, dateISO);
    var anyDone = list.some(function (t) { return t.done; });
    var cur = stampSource(memberId, dateISO);
    if (anyDone && !cur) { stampMap(memberId)[dateISO] = 'auto'; return true; }
    if (!anyDone && cur === 'auto') { delete stampMap(memberId)[dateISO]; return true; }
    return false;
  }

  function streak(memberId, baseISO) {
    var ref = baseISO || todayISO();
    var map = stampMap(memberId);
    var cursor = ref;
    var count = 0;
    if (!map[cursor]) cursor = addDays(cursor, -1);
    while (map[cursor]) { count++; cursor = addDays(cursor, -1); }
    return count;
  }

  function monthStampCount(memberId, year, monthIndex) {
    var map = stampMap(memberId);
    var prefix = year + '-' + pad(monthIndex + 1) + '-';
    return Object.keys(map).filter(function (k) { return k.indexOf(prefix) === 0; }).length;
  }

  /* ---------------- 공개 API ---------------- */
  var api = {
    KEY: KEY,

    init: function () {
      state = migrate(readLocal());
      // 원격 어댑터가 있으면 그쪽 기록을 우선 사용
      if (adapter && typeof adapter.load === 'function') {
        return Promise.resolve()
          .then(function () { return adapter.load(); })
          .then(function (remote) {
            if (remote) { state = migrate(remote); notify(); }
            return state;
          })
          .catch(function () { return state; });
      }
      return Promise.resolve(state);
    },

    /** 원격 저장소의 실시간 변경을 구독합니다 (Supabase Realtime 등) */
    listenRemote: function () {
      if (!adapter || typeof adapter.subscribe !== 'function') return;
      try {
        adapter.subscribe(function (remote) {
          if (!remote || typeof remote !== 'object') return;
          state = migrate(remote);
          persist(true);
          notify();
        });
      } catch (e) { /* 구독 실패는 조용히 넘어감 */ }
    },

    /** Supabase / Firebase 같은 원격 저장소를 붙일 때 사용 */
    setAdapter: function (next) {
      adapter = next || null;
      return api.init();
    },

    get: function () { return state; },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    },
    todayISO: todayISO,
    now: nowDate,
    addDays: addDays,
    isWeekday: isWeekday,
    startOfWeek: startOfWeek,
    parseDate: ymd,

    members: function () { return state.members; },
    member: findMember,

    tasks: function (memberId, dateISO) {
      var list = tasksFor(memberId, dateISO);
      persist(true);
      return list;
    },

    toggleTask: function (memberId, taskId, dateISO) {
      var date = dateISO || todayISO();
      var task = findTask(memberId, taskId, date);
      if (!task) return null;
      var m = findMember(memberId);
      task.done = !task.done;
      if (m) m.stars = Math.max(0, (m.stars || 0) + (task.done ? 1 : -1));
      var stamped = syncAutoStamp(memberId, date);
      persist(false);
      return { done: task.done, stamped: stamped };
    },

    addTask: function (memberId, text, repeat) {
      var clean = String(text || '').trim().slice(0, 40);
      if (!clean) return null;
      var rep = repeat === 'daily' || repeat === 'weekday' ? repeat : 'once';
      var date = todayISO();
      var task = { id: uid('t_'), text: clean, repeat: rep, group: null, done: false };
      // 평일 반복은 주말에 오늘 목록에 넣지 않아요 (월요일부터 자동으로 나타남)
      var addToday = rep !== 'weekday' || isWeekday(date);
      if (addToday) tasksFor(memberId, date).push(task);
      if (rep !== 'once') {
        if (!state.routines[memberId]) state.routines[memberId] = [];
        state.routines[memberId].push({ id: task.id, text: clean, repeat: rep });
      }
      persist(false);
      return Object.assign({}, task, { addedToday: addToday });
    },

    updateTask: function (memberId, taskId, changes) {
      var date = todayISO();
      var task = findTask(memberId, taskId, date);
      if (!task) return null;
      var text = String(changes.text || '').trim().slice(0, 40);
      if (text) task.text = text;
      var nextRepeat = changes.repeat || task.repeat || 'once';
      if (nextRepeat !== 'daily' && nextRepeat !== 'weekday') nextRepeat = 'once';
      task.repeat = nextRepeat;

      var routines = state.routines[memberId] || [];
      var idx = -1;
      for (var i = 0; i < routines.length; i++) if (routines[i].id === task.id) idx = i;
      if (nextRepeat === 'once') {
        if (idx >= 0) routines.splice(idx, 1); // 반복 해제
      } else if (idx >= 0) {
        routines[idx].text = task.text;
        routines[idx].repeat = nextRepeat;
      } else {
        if (!state.routines[memberId]) state.routines[memberId] = routines = [];
        routines.push({ id: task.id, text: task.text, repeat: nextRepeat });
      }
      persist(false);
      return task;
    },

    deleteTask: function (memberId, taskId) {
      var date = todayISO();
      var list = tasksFor(memberId, date);
      var removed = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === taskId) { removed = list.splice(i, 1)[0]; break; }
      }
      if (!removed) return null;
      if (removed.done) {
        var m = findMember(memberId);
        if (m) m.stars = Math.max(0, (m.stars || 0) - 1);
      }
      var routines = state.routines[memberId] || [];
      state.routines[memberId] = routines.filter(function (r) { return r.id !== taskId; });
      syncAutoStamp(memberId, date);
      persist(false);
      return removed;
    },

    /** 같은 할 일이 다시 생기지 않게 기본 루틴 목록에 되돌려 넣기 */
    restoreRoutine: function (memberId, task) {
      if (!task || !task.text) return;
      if (!state.routines[memberId]) state.routines[memberId] = [];
      state.routines[memberId].push({
        id: task.id || uid('r_'),
        text: task.text,
        repeat: task.repeat === 'weekday' ? 'weekday' : 'daily',
        group: task.group || null
      });
      persist(false);
    },

    addStar: function (memberId, delta) {
      var m = findMember(memberId);
      if (!m) return 0;
      m.stars = Math.max(0, (m.stars || 0) + delta);
      persist(false);
      return m.stars;
    },

    stamp: stampSource,
    hasStamp: function (memberId, dateISO) { return !!stampMap(memberId)[dateISO]; },
    setStamp: setStamp,
    toggleStamp: function (memberId, dateISO) {
      var cur = stampSource(memberId, dateISO);
      setStamp(memberId, dateISO, cur ? null : 'manual');
      return !cur;
    },
    streak: streak,
    monthStampCount: monthStampCount,

    /** 찌니 보상 트래커: 오늘의 문제집/재능 진행 상황 */
    rewardProgress: function (memberId, dateISO) {
      var date = dateISO || todayISO();
      var list = tasksFor(memberId, date);
      function group(name) {
        var items = list.filter(function (t) { return t.group === name; });
        var done = items.filter(function (t) { return t.done; }).length;
        return { total: items.length, done: done, all: items.length > 0 && done === items.length, items: items };
      }
      return { workbook: group('workbook'), jaeneung: group('jaeneung') };
    },

    /** 이번 주 평일 문제집 완주 일수 (월~금, 오늘까지만) */
    weekWorkbookDays: function (memberId, baseISO) {
      var today = baseISO || todayISO();
      var monday = startOfWeek(today);
      var result = { days: [], count: 0, total: 5, full: false };
      for (var i = 0; i < 5; i++) {
        var d = addDays(monday, i);
        var future = d > today;
        var list = future ? [] : tasksFor(memberId, d);
        var wb = list.filter(function (t) { return t.group === 'workbook'; });
        var doneCount = wb.filter(function (t) { return t.done; }).length;
        var complete = wb.length > 0 && doneCount === wb.length;
        if (complete) result.count++;
        result.days.push({ date: d, complete: complete, done: doneCount, total: wb.length, future: future });
      }
      result.full = result.count >= 5;
      return result;
    },

    setPlace: function (place) {
      state.settings.place = {
        name: place.name,
        lat: Number(place.lat),
        lon: Number(place.lon)
      };
      persist(false);
    },
    setMember: function (id, changes) {
      var m = findMember(id);
      if (!m) return;
      if (typeof changes.name === 'string' && changes.name.trim()) m.name = changes.name.trim().slice(0, 12);
      if (typeof changes.sub === 'string') m.sub = changes.sub.trim().slice(0, 20);
      persist(false);
    },

    reset: function () {
      state = defaultState();
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
      persist(true);
      notify();
    }
  };

  window.FamilyStore = api;
})();
