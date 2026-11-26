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
  var SCHEMA = 11;

  /* 매일 독서 루틴 — 기존 기기에도 빠짐없이 들어가도록 마이그레이션에서 확인합니다. */
  var READ_ROUTINE_ID = 'r_jj_read';
  var READ_ROUTINE = { id: READ_ROUTINE_ID, text: '독서 30분', repeat: 'daily', group: 'read' };

  /* 매일 아킬레스건 운동 — 보상 트래커(재능/문제집/독서)와 상관없는 건강 루틴입니다. */
  var ACHILLES_ROUTINE_ID = 'r_jj_achilles';
  var ACHILLES_ROUTINE = { id: ACHILLES_ROUTINE_ID, text: '아킬레스건 운동하기', repeat: 'daily', group: 'health' };

  /* 2026-11-23(월)·2026-11-24(화) 완료 기록 채우기 (사용자 요청 "월화 모든거 다 채워줘")
     그 두 날에 하던 루틴(재능 국어·수학, 한자어휘, 역사, 독서 30분)을 모두 완료로 채웁니다.
     아킬레스건 운동은 그 뒤(11/25)에 생긴 루틴이라 그 두 날에는 넣지 않습니다.
     새 기기 기본값에도 들어가고, 이미 쓰던 기기는 SCHEMA 9 에서 한 번만 채웁니다.
     (seeds 플래그 + 이미 완료된 항목은 건너뛰는 검사로 별이 두 번 더해지지 않아요) */
  var SEED_MON_TUE = {
    key: 'monTue-2026-11-23',
    dates: ['2026-11-23', '2026-11-24'],
    tasks: [
      { id: 'r_jj_korean', text: '재능학습지 국어 2장 풀기', repeat: 'daily', group: 'jaeneung' },
      { id: 'r_jj_math', text: '재능학습지 수학 2장 풀기', repeat: 'daily', group: 'jaeneung' },
      { id: 'r_jj_hanja', text: '한자어휘문제집 2장씩 풀기', repeat: 'weekday', group: 'workbook' },
      { id: 'r_jj_history', text: '역사문제집 2장씩 풀기', repeat: 'weekday', group: 'workbook' },
      { id: READ_ROUTINE_ID, text: READ_ROUTINE.text, repeat: 'daily', group: 'read' }
    ]
  };

  /* 💌 엄마·아빠 한마디 — 날짜마다 작성자별 한 줄을 쌓아 둡니다.
     오늘 화면에는 오늘 자로 남긴 한마디만 보이고, 지난 한마디는 누적 보기에서 모아 봅니다.
     (SCHEMA 10 까지는 parentNotes 한 벌에 덮어쓰던 기록이라 SCHEMA 11 에서 날짜별로 옮겨 보존합니다) */
  var NOTE_TEXT_MAX = 120;
  var NOTE_AUTHORS = ['mom', 'dad'];
  var NOTE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function blankNote() { return { text: '', updatedAt: 0 }; }
  function blankNotes() { return { mom: blankNote(), dad: blankNote() }; }
  function normalizeNotes(src) {
    var out = blankNotes();
    NOTE_AUTHORS.forEach(function (who) {
      var n = src && src[who];
      if (!n || typeof n !== 'object') return;
      var text = typeof n.text === 'string' ? n.text.trim().slice(0, NOTE_TEXT_MAX) : '';
      if (!text) return; // 지운 한마디는 빈 값으로 둡니다
      out[who] = { text: text, updatedAt: Number(n.updatedAt) || 0 };
    });
    return out;
  }

  /* 한 사람·하루치 한마디. 지운 한마디는 빈 text 와 지운 시각(updatedAt)만 남겨,
     다른 기기 기록과 합칠 때 "지웠다"는 사실이 옛 글에 밀리지 않게 합니다. */
  function normalizeNoteEntry(n) {
    if (!n || typeof n !== 'object') return null;
    var text = typeof n.text === 'string' ? n.text.trim().slice(0, NOTE_TEXT_MAX) : '';
    var at = Number(n.updatedAt) || 0;
    if (!text && !at) return null;
    return { text: text, updatedAt: at };
  }

  /** { 'YYYY-MM-DD': { mom: {...}, dad: {...} } } 모양을 깔끔하게 다듬습니다. */
  function normalizeNotesByDate(src) {
    var out = {};
    if (!src || typeof src !== 'object') return out;
    Object.keys(src).forEach(function (date) {
      if (!NOTE_DATE_RE.test(date)) return;
      var day = src[date];
      if (!day || typeof day !== 'object') return;
      var entry = {};
      NOTE_AUTHORS.forEach(function (who) {
        var n = normalizeNoteEntry(day[who]);
        if (n) entry[who] = n;
      });
      if (NOTE_AUTHORS.some(function (who) { return entry[who]; })) out[date] = entry;
    });
    return out;
  }

  /** 두 누적 기록을 합칩니다 — 같은 날 같은 사람 글은 더 최근 것(updatedAt)이 이깁니다. */
  function mergeNotesByDate(a, b) {
    var out = {};
    [a, b].forEach(function (src) {
      if (!src) return;
      Object.keys(src).forEach(function (date) {
        var day = src[date] || {};
        if (!out[date]) out[date] = {};
        NOTE_AUTHORS.forEach(function (who) {
          var n = day[who];
          if (!n) return;
          var cur = out[date][who];
          if (!cur || (Number(n.updatedAt) || 0) >= (Number(cur.updatedAt) || 0)) {
            out[date][who] = { text: n.text || '', updatedAt: Number(n.updatedAt) || 0 };
          }
        });
      });
    });
    return out;
  }

  /** 그날의 한마디 한 벌 (없으면 빈 값) */
  function notesOnDate(byDate, dateISO) {
    var out = blankNotes();
    var day = byDate && byDate[dateISO];
    if (!day) return out;
    NOTE_AUTHORS.forEach(function (who) {
      var n = day[who];
      if (n) out[who] = { text: n.text || '', updatedAt: Number(n.updatedAt) || 0 };
    });
    return out;
  }

  /** 날짜 키를 YYYY-MM-DD 로 다듬습니다 (이상한 값이면 오늘) */
  function notesDateKey(dateISO) {
    var s = String(dateISO || '').slice(0, 10);
    return NOTE_DATE_RE.test(s) ? s : todayISO();
  }

  /* 예전 앱 버전도 같은 한마디를 보도록 오늘치를 parentNotes 에도 함께 적어 둡니다. */
  function syncNotesMirror() {
    if (!state.parentNotesByDate) state.parentNotesByDate = {};
    state.parentNotes = notesOnDate(state.parentNotesByDate, todayISO());
  }

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
  function blankState() {
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
      stamps: { jjini: {} },
      /* 💌 엄마·아빠 한마디 (없으면 빈 값) — 날짜별 누적 기록 + 오늘 화면용 사본 */
      parentNotesByDate: {},
      parentNotes: blankNotes(),
      seeds: {}
    };
  }

  /* 월·화 완료 기록을 한 번만 채웁니다. 이미 체크된 항목은 그대로 두고, 새로 완료로
     바뀐 개수만큼 별을 더합니다. (새 기기 기본값에서도 같은 규칙으로 채워져요) */
  function seedMonTueFill(out) {
    if (!out.seeds) out.seeds = {};
    if (out.seeds[SEED_MON_TUE.key]) return 0;
    var filled = 0;
    (out.members || []).forEach(function (m) {
      if (m.role !== 'kid') return;
      var changed = 0;
      SEED_MON_TUE.dates.forEach(function (d) {
        if (!out.days[d]) out.days[d] = { tasks: {} };
        var day = out.days[d];
        if (!day.tasks) day.tasks = {};
        if (!Array.isArray(day.tasks[m.id])) day.tasks[m.id] = [];
        var list = day.tasks[m.id];

        SEED_MON_TUE.tasks.forEach(function (seed) {
          var found = null;
          for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === seed.id) { found = list[i]; break; }
          }
          if (!found) {
            list.push({ id: seed.id, text: seed.text, repeat: seed.repeat, group: seed.group, done: true });
            changed++;
          } else if (!found.done) {
            found.done = true;
            if (!found.group) found.group = seed.group;
            if (!found.repeat) found.repeat = seed.repeat;
            changed++;
          }
        });

        /* 하나라도 마쳤으니 그날 도장도 찍힙니다. 이미 찍힌 도장은 손대지 않아요. */
        if (!out.stamps[m.id]) out.stamps[m.id] = {};
        if (!out.stamps[m.id][d]) out.stamps[m.id][d] = 'auto';
      });
      if (changed) m.stars = Math.max(0, (m.stars || 0) + changed);
      filled += changed;
    });
    out.seeds[SEED_MON_TUE.key] = true;
    return filled;
  }

  function defaultState() {
    var base = blankState();
    seedMonTueFill(base);
    return base;
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
    var base = blankState();
    if (!data || !Array.isArray(data.members) || !data.members.length) return defaultState();
    // 빠진 항목은 기본값으로 채워요 (이전 버전 기록도 살아남도록)
    var members = data.members.filter(function (m) {
      return m && m.id && !REMOVED_MEMBERS[m.id];
    }).map(function (m) {
      return Object.assign({ stars: 0, role: 'kid' }, m);
    });
    if (!members.length) return defaultState();

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

    /* SCHEMA 11 — 💌 한마디 누적 기록. 예전(parentNotes 한 벌)에 남아 있던 글은
       updatedAt 이 가리키는 날짜의 기록으로 옮겨 보존합니다.
       · 예전 버전 앱(날짜별 보관이 없는 기록)이 올린 것이면 이 기기의 누적 기록과 합칩니다.
       · 새 버전 기록은 그대로 따라갑니다 (전체 지우기도 반영되도록). */
    var hasByDate = !!data.parentNotesByDate && typeof data.parentNotesByDate === 'object';
    var notesByDate = normalizeNotesByDate(data.parentNotesByDate);
    if (!hasByDate && state && state.parentNotesByDate) {
      notesByDate = mergeNotesByDate(notesByDate, normalizeNotesByDate(state.parentNotesByDate));
    }
    var legacyNotes = normalizeNotes(data.parentNotes);
    NOTE_AUTHORS.forEach(function (who) {
      var n = legacyNotes[who];
      if (!n.text) return;
      var day = n.updatedAt ? iso(new Date(n.updatedAt)) : todayISO();
      if (!notesByDate[day]) notesByDate[day] = {};
      var cur = notesByDate[day][who];
      if (!cur || (Number(n.updatedAt) || 0) >= (Number(cur.updatedAt) || 0)) {
        notesByDate[day][who] = { text: n.text, updatedAt: n.updatedAt };
      }
    });

    var out = {
      version: SCHEMA,
      createdAt: data.createdAt || Date.now(),
      settings: settings,
      members: members,
      routines: Object.assign({}, base.routines, routines),
      days: days,
      stamps: Object.assign({}, base.stamps, stamps),
      /* SCHEMA 11 — 💌 엄마·아빠 한마디를 날짜별로 보관합니다 (아래에서 채웁니다) */
      parentNotesByDate: {},
      parentNotes: blankNotes(),
      seeds: Object.assign({}, data.seeds || {})
    };
    out.members.forEach(function (m) { if (!out.stamps[m.id]) out.stamps[m.id] = {}; });
    out.parentNotesByDate = notesByDate;
    out.parentNotes = notesOnDate(notesByDate, todayISO());

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

    // SCHEMA 9 — 2026-11-23(월)·11-24(화) 완료 기록을 한 번만 채웁니다.
    // 이미 쓰던 기기에서 그날 체크해 둔 기록·도장·별은 그대로 두고 빈 곳만 채워요.
    seedMonTueFill(out);
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
      if (window.FamilySync && typeof window.FamilySync.touch === 'function') {
        try { window.FamilySync.touch(); } catch (e) { /* noop */ }
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

    /** 💌 엄마·아빠 한마디 — 날짜별 누적 기록 전체 { 'YYYY-MM-DD': { mom, dad } } */
    parentNotesByDate: function () {
      if (!state.parentNotesByDate) state.parentNotesByDate = {};
      return state.parentNotesByDate;
    },

    /** 그날(기본: 오늘)의 한마디 — { mom: { text, updatedAt }, dad: { ... } } */
    parentNotesOn: function (dateISO) {
      return notesOnDate(api.parentNotesByDate(), notesDateKey(dateISO));
    },

    /** 오늘의 한마디 (오늘 화면) */
    parentNotes: function () {
      return api.parentNotesOn(todayISO());
    },

    /** 글이 남아 있는 날짜 목록 — 최신순 */
    noteDates: function () {
      var byDate = api.parentNotesByDate();
      return Object.keys(byDate).filter(function (date) {
        var day = byDate[date] || {};
        return NOTE_AUTHORS.some(function (who) { return day[who] && day[who].text; });
      }).sort().reverse();
    },

    /** 지금까지 남긴 한마디 개수 (날짜·작성자별 한 줄씩) */
    notesCount: function () {
      var byDate = api.parentNotesByDate();
      var count = 0;
      Object.keys(byDate).forEach(function (date) {
        var day = byDate[date] || {};
        NOTE_AUTHORS.forEach(function (who) { if (day[who] && day[who].text) count++; });
      });
      return count;
    },

    /** 한마디 저장(고치기). dateISO 를 주면 그날 기록으로 남깁니다. 빈 값이면 지우기와 같습니다. */
    setParentNote: function (who, text, dateISO) {
      if (NOTE_AUTHORS.indexOf(who) < 0) return null;
      var date = notesDateKey(dateISO);
      var clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_TEXT_MAX);
      if (!clean) return api.clearParentNote(who, date);
      var byDate = api.parentNotesByDate();
      if (!byDate[date]) byDate[date] = {};
      byDate[date][who] = { text: clean, updatedAt: Date.now() };
      syncNotesMirror();
      persist(false);
      return byDate[date][who];
    },

    clearParentNote: function (who, dateISO) {
      if (NOTE_AUTHORS.indexOf(who) < 0) return null;
      var date = notesDateKey(dateISO);
      var byDate = api.parentNotesByDate();
      if (!byDate[date]) byDate[date] = {};
      /* 지운 시각을 남겨 두면 다른 기기의 옛 글과 합칠 때 되살아나지 않습니다 */
      byDate[date][who] = { text: '', updatedAt: Date.now() };
      syncNotesMirror();
      persist(false);
      return byDate[date][who];
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

    /** 다른 기기에서 온 기록을 그대로 반영합니다 (실시간 동기화). */
    applyRemote: function (data) {
      if (!data || typeof data !== 'object') return state;
      state = migrate(data);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 용량 초과 등 */ }
      notify();
      return state;
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
