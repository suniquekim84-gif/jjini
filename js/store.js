/* 우리 가족 기록장 — 데이터 저장소
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
  var SCHEMA = 3;

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
  var overrideDate = parseOverride();

  function todayISO() { return overrideDate || iso(new Date()); }
  /** 오늘 날짜. ?today= 로 날짜를 바꿔도 시각은 지금 시각을 그대로 씁니다. */
  function nowDate() {
    if (!overrideDate) return new Date();
    var real = new Date();
    var d = ymd(overrideDate);
    d.setHours(real.getHours(), real.getMinutes(), real.getSeconds(), 0);
    return d;
  }

  /* ---------------- 기본값 ---------------- */
  var MISSIONS = [
    { id: 'cook', emoji: '🥕', text: '저녁 준비 같이 돕기' },
    { id: 'walk', emoji: '🚶', text: '다 같이 동네 한 바퀴 산책하기' },
    { id: 'praise', emoji: '💌', text: '서로 칭찬 한 마디 해주기' },
    { id: 'game', emoji: '🎲', text: '보드게임 한 판 같이 하기' },
    { id: 'read', emoji: '📖', text: '가족이 함께 10분 책 읽기' },
    { id: 'fruit', emoji: '🍎', text: '과일 깎아서 같이 나눠 먹기' },
    { id: 'tidy', emoji: '🧹', text: '거실 10분 같이 정리하기' },
    { id: 'music', emoji: '🎵', text: '좋아하는 노래 같이 듣기' },
    { id: 'photo', emoji: '📷', text: '오늘의 가족 사진 한 장 남기기' },
    { id: 'water', emoji: '🥛', text: '물 한 잔 같이 마시기' },
    { id: 'socks', emoji: '🧦', text: '양말 짝 맞추기 게임 하기' },
    { id: 'thanks', emoji: '🙏', text: '고마웠던 일 한 가지 말하기' },
    { id: 'bedtime', emoji: '🌙', text: '자기 전에 오늘 이야기 나누기' },
    { id: 'snack', emoji: '🍳', text: '간단한 간식 같이 만들기' }
  ];

  function defaultState() {
    return {
      version: SCHEMA,
      createdAt: Date.now(),
      settings: {
        place: { name: '시흥', lat: 37.38, lon: 126.803 }
      },
      members: [
        { id: 'jjini', name: '찌니', sub: '햄찌와 함께', char: 'hamster', role: 'kid', stars: 3 },
        { id: 'naeun', name: '나은찡', sub: '토끼와 함께', char: 'rabbit', role: 'kid', stars: 1 },
        { id: 'mom', name: '엄마', sub: '고양이와 함께', char: 'mom', role: 'parent', stars: 0 },
        { id: 'dad', name: '아빠', sub: '곰돌이와 함께', char: 'dad', role: 'parent', stars: 0 }
      ],
      /* 반복 루틴 — 매일/평일 구분. group 은 찌니 보상 트래커에서 씁니다. */
      routines: {
        jjini: [
          { id: 'r_jj_korean', text: '재능학습지 국어 2장 풀기', repeat: 'daily', group: 'jaeneung' },
          { id: 'r_jj_math', text: '재능학습지 수학 2장 풀기', repeat: 'daily', group: 'jaeneung' },
          { id: 'r_jj_hanja', text: '한자어휘문제집 2장씩 풀기', repeat: 'weekday', group: 'workbook' },
          { id: 'r_jj_history', text: '역사문제집 2장씩 풀기', repeat: 'weekday', group: 'workbook' },
          { id: 'r_jj_read', text: '책 30분 읽기', repeat: 'daily' }
        ],
        naeun: [
          { id: 'r_ne_read', text: '책 30분 읽기', repeat: 'daily' },
          { id: 'r_ne_dictation', text: '받아쓰기 연습 1회', repeat: 'daily' },
          { id: 'r_ne_prep', text: '내일 준비물 챙기기', repeat: 'weekday' },
          { id: 'r_ne_diary', text: '일기 한 편 쓰기', repeat: 'weekday' }
        ],
        mom: [
          { id: 'r_mo_dinner', text: '가족 저녁 준비하기', repeat: 'daily' },
          { id: 'r_mo_market', text: '장보기 목록 정리하기', repeat: 'weekday' },
          { id: 'r_mo_laundry', text: '빨래 정리하기', repeat: 'weekday' },
          { id: 'r_mo_call', text: '할머니께 안부 전화드리기', repeat: 'daily' }
        ],
        dad: [
          { id: 'r_da_homework', text: '아이들 숙제 확인하기', repeat: 'daily' },
          { id: 'r_da_trash', text: '분리수거 내놓기', repeat: 'weekday' },
          { id: 'r_da_talk', text: '가족과 30분 이야기하기', repeat: 'daily' }
        ]
      },
      days: {},
      stamps: { jjini: {}, naeun: {}, mom: {}, dad: {} },
      mission: { date: '', id: '', together: 0, lastDoneDate: '' }
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

  function migrate(data) {
    var base = defaultState();
    if (!data || !Array.isArray(data.members) || !data.members.length) return base;
    // 빠진 항목은 기본값으로 채워요 (이전 버전 기록도 살아남도록)
    var out = {
      version: SCHEMA,
      createdAt: data.createdAt || Date.now(),
      settings: Object.assign({}, base.settings, data.settings || {}),
      members: data.members.map(function (m) {
        return Object.assign({ stars: 0, role: 'kid' }, m);
      }),
      routines: Object.assign({}, base.routines, data.routines || {}),
      days: data.days || {},
      stamps: Object.assign({ jjini: {}, naeun: {}, mom: {}, dad: {} }, data.stamps || {}),
      mission: Object.assign({}, base.mission, data.mission || {})
    };
    out.members.forEach(function (m) { if (!out.stamps[m.id]) out.stamps[m.id] = {}; });
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

  /* ---------------- 미션 ---------------- */
  function hashStr(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return h;
  }
  function missionById(id) {
    for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i];
    return MISSIONS[0];
  }
  function syncMissionDate() {
    var today = todayISO();
    if (state.mission.date !== today) {
      state.mission.date = today;
      state.mission.id = MISSIONS[hashStr(today) % MISSIONS.length].id;
      persist(true);
    }
  }

  /* ---------------- 공개 API ---------------- */
  var api = {
    KEY: KEY,
    MISSIONS: MISSIONS,

    init: function () {
      state = migrate(readLocal());
      syncMissionDate();
      // 원격 어댑터가 있으면 그쪽 기록을 우선 사용
      if (adapter && typeof adapter.load === 'function') {
        return Promise.resolve()
          .then(function () { return adapter.load(); })
          .then(function (remote) {
            if (remote) { state = migrate(remote); syncMissionDate(); notify(); }
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
          syncMissionDate();
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

    mission: function () {
      syncMissionDate();
      var m = missionById(state.mission.id);
      return {
        id: m.id,
        emoji: m.emoji,
        text: m.text,
        together: state.mission.together || 0,
        doneToday: state.mission.lastDoneDate === todayISO()
      };
    },
    completeMission: function () {
      var today = todayISO();
      if (state.mission.lastDoneDate === today) {
        return { ok: false, reason: 'already', together: state.mission.together || 0 };
      }
      state.mission.lastDoneDate = today;
      state.mission.together = (state.mission.together || 0) + 1;
      persist(false);
      return { ok: true, together: state.mission.together };
    },
    shuffleMission: function () {
      var current = state.mission.id;
      var pool = MISSIONS.filter(function (m) { return m.id !== current; });
      var pick = pool[Math.floor(Math.random() * pool.length)];
      state.mission.id = pick.id;
      state.mission.date = todayISO();
      persist(false);
      return missionById(pick.id);
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
      syncMissionDate();
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
      persist(true);
      notify();
    }
  };

  window.FamilyStore = api;
})();
