/* 찌니 대시보드 — 화면 동작
   데이터는 모두 FamilyStore 를 통해서만 읽고 씁니다. */
(function () {
  'use strict';

  var Store = window.FamilyStore;
  var Chars = window.FamilyChars;
  var Sched = window.FamilySchedule;
  var Prep = window.FamilyPrep;
  var Lectures = window.FamilyLectures;
  var Books = window.FamilyBooks;
  var Weather = window.FamilyWeather;
  var Sound = window.FamilySound;

  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  var TINTS = { jjini: '' };
  var SHEETS = ['sheet-settings', 'sheet-calendar', 'sheet-timetable', 'sheet-task', 'sheet-star', 'sheet-lecture', 'sheet-book', 'sheet-note', 'sheet-book-archive', 'sheet-note-archive'];
  var TABS = ['today', 'prep', 'todo', 'lecture'];
  var currentTab = 'today';

  /* 💌 엄마·아빠 한마디 — 보여 주는 순서와 이름 */
  var NOTE_AUTHORS = [
    { who: 'mom', emoji: '👩', name: '엄마' },
    { who: 'dad', emoji: '👨', name: '아빠' }
  ];
  var noteCtx = { who: 'mom', saved: '', date: null, fromArchive: false };

  var state = null;
  var weather = null;
  var weatherFailed = false;
  var stampKid = 'jjini';
  var timetableKid = 'jjini';
  var calCursor = null;
  var starMember = 'jjini';
  var taskCtx = { mode: 'add', memberId: 'jjini', taskId: null, repeat: 'once' };
  var lectureCtx = { mode: 'add', id: null, manual: false, lecture: false };
  var lectureExpanded = false;
  var bookCtx = { mode: 'add', id: null, fromArchive: false };
  var lastToday = null;
  var toastTimer = null;
  var weatherTimer = null;

  /* ---------------- 작은 도우미 ---------------- */
  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function minutesOf(hhmm) {
    var p = String(hhmm).split(':');
    return Number(p[0]) * 60 + Number(p[1]);
  }
  function nowMinutes() {
    var d = Store.now();
    return d.getHours() * 60 + d.getMinutes();
  }
  function tone(name) { return (Sched.colors && Sched.colors[name]) || 'blue'; }

  /* 알록달록 일러스트 아이콘 (js/characters.js) */
  function ric(key) {
    return (Chars && Chars.icon) ? Chars.icon(key) : '';
  }

  /* 할 일마다 어울리는 그림을 골라요 */
  function taskIcon(t) {
    var text = String((t && t.text) || '');
    if (t && t.group === 'jaeneung') return /수학/.test(text) ? 'math' : 'korean';
    if (t && t.group === 'workbook') return /역사/.test(text) ? 'history' : 'hanja';
    if (t && t.group === 'read') return 'read';
    if (t && t.group === 'health') return 'move';
    if (/독서|책 읽|읽기/.test(text)) return 'read';
    if (/운동|스트레칭|줄넘기/.test(text)) return 'move';
    if (/수학/.test(text)) return 'math';
    if (/한자/.test(text)) return 'hanja';
    if (/역사/.test(text)) return 'history';
    if (/코딩|엔트리/.test(text)) return 'coding';
    return 'korean';
  }
  function shortDate(dateISO, withWeekday) {
    var d = Store.parseDate(dateISO);
    var s = (d.getMonth() + 1) + '/' + d.getDate();
    return withWeekday === false ? s : s + ' ' + DAYS[d.getDay()];
  }

  /* ---------------- 헤더 ---------------- */
  function renderHeader() {
    var d = Store.now();
    byId('brand-mark').innerHTML = Chars.svg('pikachu');
    byId('header-date').textContent = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + DAYS[d.getDay()] + '요일';
    renderSoundUI();
  }

  /* ---------------- 효과음 켜기/끄기 ---------------- */
  function renderSoundUI() {
    if (!Sound) return;
    var on = Sound.isOn();
    var btn = byId('btn-sound');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? '효과음 끄기' : '효과음 켜기');
      btn.title = on ? '효과음 켜짐 · 눌러서 끄기' : '효과음 꺼짐 · 눌러서 켜기';
    }
    var icon = byId('btn-sound-icon');
    if (icon) icon.textContent = on ? '🔊' : '🔇';
    var setting = byId('btn-sound-setting');
    if (setting) {
      setting.setAttribute('aria-pressed', on ? 'true' : 'false');
      setting.textContent = on ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐';
    }
  }

  /* ---------------- 날씨 ---------------- */
  function airText(label, value, labelName) {
    if (value == null) return label + ' –';
    return label + ' ' + (labelName || '');
  }

  function renderWeather() {
    var place = state.settings.place;
    byId('wx-city').textContent = place.name;
    var tip;

    if (!weather) {
      byId('wx-icon').textContent = '🌤️';
      byId('wx-temp').textContent = '–°';
      byId('wx-cond').textContent = weatherFailed ? '날씨 정보 없음' : '불러오는 중';
      byId('wx-range').textContent = '최저 –° · 최고 –°';
      setAir('wx-pm10', '미세먼지', null, null, null);
      setAir('wx-pm25', '초미세먼지', null, null, null);
      byId('wx-tip').textContent = weatherFailed ? '🌿 잠시 뒤 다시 확인해요' : '🌿 오늘 공기 확인 중';
      return;
    }

    byId('wx-icon').textContent = weather.icon;
    byId('wx-temp').textContent = weather.temp + '°';
    byId('wx-cond').textContent = weather.cond;
    byId('wx-range').textContent = '최저 ' + weather.min + '° · 최고 ' + weather.max + '°';
    setAir('wx-pm10', '미세먼지', weather.pm10, weather.pm10Label, weather.pm10Level);
    setAir('wx-pm25', '초미세먼지', weather.pm25, weather.pm25Label, weather.pm25Level);

    tip = Weather.tip(weather);
    byId('wx-tip').textContent = tip.emoji + ' ' + tip.text;
  }

  function setAir(id, label, value, labelName, level) {
    var node = byId(id);
    node.className = 'badge badge-air' + (level != null ? ' level-' + level : '');
    node.textContent = airText(label, value, labelName);
    node.title = value != null ? label + ' ' + value + '㎍/㎥ · ' + (labelName || '') : label + ' 정보 없음';
  }

  function loadWeather(force) {
    if (!state) return;
    weatherFailed = false;
    Weather.get(state.settings.place, { force: !!force })
      .then(function (data) {
        weather = data;
        renderWeather();
      })
      .catch(function () {
        weatherFailed = true;
        renderWeather();
      });
  }

  /* ---------------- 오늘의 학교·학원 일정 ---------------- */
  function kidStatus(day, now) {
    var schoolEnd = minutesOf(day.school);
    var schoolStart = Prep ? Prep.minutesOf(Prep.SCHOOL_DEPART) : 8 * 60 + 30;
    if (now < schoolStart) return { text: '일정 시작 전', now: false };
    if (now < schoolEnd) return { text: '학교 다니는 중', now: true };
    var i, cur;
    for (i = 0; i < day.items.length; i++) {
      cur = day.items[i];
      if (now >= minutesOf(cur.start) && now <= minutesOf(cur.end)) {
        return { text: '지금 ' + cur.name + ' 중', now: true };
      }
    }
    var next = null;
    for (i = 0; i < day.items.length; i++) {
      if (minutesOf(day.items[i].start) > now) { next = day.items[i]; break; }
    }
    if (next) return { text: '다음 ' + next.name + ' ' + next.start, now: false };
    return { text: '오늘 일정 끝! 🎉', now: false };
  }

  function scheduleRow(key) {
    var kid = Sched.kids[key];
    if (!kid) return '';
    var dow = Store.parseDate(Store.todayISO()).getDay();
    var day = kid.days[dow];
    if (!day) return '';
    var now = nowMinutes();
    var st = kidStatus(day, now);

    var chips = '<span class="chip-subject chip-school">🏫 하교 <b>' + day.school + '</b></span>';
    chips += day.items.map(function (it) {
      var isNow = now >= minutesOf(it.start) && now <= minutesOf(it.end);
      return '<span class="chip-subject tone-' + tone(it.name) + (isNow ? ' is-now' : '') + '">' +
        esc(it.name) + ' <b>' + it.start + '~' + it.end + '</b></span>';
    }).join('');
    if (!day.items.length) chips += '<span class="chip-subject">방과후 일정 없음</span>';

    return '<div class="schedule-row">' +
      '<div class="schedule-kid">' +
        '<span class="schedule-avatar">' + Chars.svg(kid.char) + '</span>' +
        '<span class="schedule-name">' + esc(kid.name) + '</span>' +
        '<span class="schedule-status' + (st.now ? ' is-now' : '') + '">' +
          (st.now ? '<span class="now-dot"></span>' : '') + esc(st.text) + '</span>' +
      '</div>' +
      '<div class="schedule-items">' + chips + '</div>' +
    '</div>';
  }

  function renderSchedule() {
    if (!state) return;
    var d = Store.parseDate(Store.todayISO());
    var dow = d.getDay();
    byId('schedule-day').textContent = DAYS[dow] + '요일';

    if (dow === 0 || dow === 6) {
      byId('schedule-sub').textContent = '주말은 온 가족이 느긋하게';
      byId('schedule-body').innerHTML =
        '<div class="schedule-free">' +
          '<div class="free-emoji">🎉</div>' +
          '<p class="free-title">주말엔 학교·학원 쉬는 날!</p>' +
          '<p class="free-sub">오늘은 푹 쉬고, 내일 시간표를 미리 확인해 볼까요?</p>' +
        '</div>';
      byId('btn-timetable').textContent = '🗓️ 평일 시간표 미리 보기';
      return;
    }

    var rows = ['jjini'].map(scheduleRow).join('');
    byId('schedule-sub').textContent = '오늘 찌니의 하루 시간표예요';
    byId('schedule-body').innerHTML = rows;
    byId('btn-timetable').textContent = '🗓️ 주간 시간표 보기';
  }

  /* ---------------- 가족 카드 ---------------- */
  function renderMembers() {
    byId('member-list').innerHTML = state.members.map(function (m) {
      return '<article class="member-card">' +
        '<div class="member-avatar">' + Chars.svg(m.char) + '</div>' +
        '<div class="member-info">' +
          '<p class="member-name">' + esc(m.name) + '</p>' +
          '<p class="member-sub">' + esc(m.sub || '') + '</p>' +
        '</div>' +
        '<button class="member-stars" data-action="open-star" data-member="' + m.id + '" ' +
          'aria-label="' + esc(m.name) + ' 별 ' + (m.stars || 0) + '개, 별 저금통 열기">' +
          '<span class="star-big"><span class="star-emoji">⭐️</span><b>' + (m.stars || 0) + '</b></span>' +
          '<span class="piggy">돼지저금통 🐷</span>' +
        '</button>' +
      '</article>';
    }).join('');
  }

  /* ---------------- 오늘 할 일 ---------------- */
  function taskRow(m, t) {
    var tag = '';
    if (t.repeat === 'daily') tag = '<span class="task-tag" data-repeat="daily">매일</span>';
    else if (t.repeat === 'weekday') tag = '<span class="task-tag" data-repeat="weekday">평일</span>';

    return '<li class="task' + (t.done ? ' is-done' : '') + '" data-icon="' + taskIcon(t) + '">' +
      '<button class="task-check" data-action="toggle-task" data-member="' + m.id + '" data-task="' + t.id + '" ' +
        'role="checkbox" aria-checked="' + (t.done ? 'true' : 'false') + '" aria-label="' + esc(t.text) + '">✓</button>' +
      '<span class="task-ic" aria-hidden="true">' + ric(taskIcon(t)) + '</span>' +
      '<span class="task-text">' + esc(t.text) + '</span>' + tag +
      '<span class="task-actions">' +
        (t.group === 'read'
          ? '<button class="mini-btn" data-action="add-book" aria-label="오늘 읽은 책 기록하기" title="독서 기록 남기기">📚</button>'
          : '') +
        '<button class="mini-btn" data-action="edit-task" data-member="' + m.id + '" data-task="' + t.id + '" aria-label="' + esc(t.text) + ' 고치기">✏️</button>' +
        '<button class="mini-btn del" data-action="delete-task" data-member="' + m.id + '" data-task="' + t.id + '" aria-label="' + esc(t.text) + ' 지우기">✕</button>' +
      '</span>' +
    '</li>';
  }

  function renderTodos() {
    var today = Store.todayISO();
    byId('todo-list').innerHTML = state.members.map(function (m) {
      var tasks = Store.tasks(m.id, today);
      var done = tasks.filter(function (t) { return t.done; }).length;
      var rows = tasks.length
        ? tasks.map(function (t) { return taskRow(m, t); }).join('')
        : '<li class="task-empty">아직 할 일이 없어요. 아래에서 추가해 보세요</li>';

      return '<div class="todo-card" data-tint="' + (TINTS[m.id] || '') + '">' +
        '<div class="todo-head">' +
          '<span class="todo-avatar">' + Chars.svg(m.char) + '</span>' +
          '<div><p class="todo-name">' + esc(m.name) + '</p>' +
          '<p class="todo-progress">' + done + '/' + tasks.length + '개 완료</p></div>' +
        '</div>' +
        '<ul class="task-list">' + rows + '</ul>' +
        '<button class="task-add" data-action="add-task" data-member="' + m.id + '">+ ' + esc(m.name) + ' 할 일 추가</button>' +
      '</div>';
    }).join('');

    byId('todo-sub').textContent = '오늘 할 일을 하나씩 체크해요';
  }

  /* ---------------- 찌니 보상 트래커 ---------------- */
  function rewardKid() {
    var found = null;
    state.members.forEach(function (m) { if (m.id === 'jjini') found = m; });
    return found || state.members[0];
  }

  function renderRewards() {
    var kid = rewardKid();
    if (!kid) return;
    byId('reward-name').textContent = kid.name;

    var today = Store.todayISO();
    var todayDow = Store.parseDate(today).getDay();
    byId('reward-today').textContent = DAYS[todayDow] + '요일';

    var prog = Store.rewardProgress(kid.id, today);
    var bookCount = Books && Books.countOn ? Books.countOn(today) : 0;
    var bookBonus = bookCount > 0;
    var baseOn = !!prog.jaeneung.all;
    var codingMin = (baseOn ? 30 : 0) + (bookBonus ? 10 : 0);

    function pips(g) {
      return g.total
        ? '<span class="reward-pips">' + g.items.map(function (t) {
            return '<i class="' + (t.done ? 'on' : '') + '"></i>';
          }).join('') + '</span>'
        : '';
    }

    /* 1) 영상 30분 — 평일 문제집 */
    var wb = prog.workbook;
    var videoState;
    var videoCond;
    if (wb.total === 0) {
      videoState = '쉬는 날';
      videoCond = '오늘은 문제집 없는 날이에요';
    } else if (wb.all) {
      videoState = '해금! 🎉';
      videoCond = '문제집 ' + wb.total + '개 모두 완료!';
    } else {
      videoState = '잠금';
      videoCond = '문제집 ' + wb.done + '/' + wb.total + ' 완료';
    }

    var videoRow = '<div class="reward-row' + (wb.all ? ' is-unlocked' : '') + '" data-reward="video">' +
      '<span class="reward-icon">' + ric('video') + '</span>' +
      '<div class="reward-info">' +
        '<p class="reward-name">영상 30분 보기</p>' +
        '<p class="reward-cond">' + videoCond + pips(wb) + '</p>' +
      '</div>' +
      '<span class="reward-state">' + videoState + '</span>' +
    '</div>';

    /* 2) 노트북(엔트리코딩) — 재능 30분 + 오늘 독서 +10분 */
    var j = prog.jaeneung;
    var codingCond = j.total === 0
      ? '오늘은 재능학습지 없는 날'
      : '재능학습지 ' + j.done + '/' + j.total + ' 완료';
    var codingState;
    var codingStateCls = '';
    if (codingMin >= 40) {
      codingState = '40분 해금 🎉';
    } else if (codingMin === 30) {
      codingState = '30분 해금!';
    } else if (codingMin === 10) {
      codingState = '책 10분 🎁';
      codingStateCls = ' is-bonus';
    } else {
      codingState = '잠금';
    }

    var codingRow = '<div class="reward-row' + (codingMin > 0 ? ' is-unlocked' : '') + '" data-reward="coding">' +
      '<span class="reward-icon">' + ric('coding') + '</span>' +
      '<div class="reward-info">' +
        '<p class="reward-name">노트북(엔트리코딩)</p>' +
        '<p class="reward-cond">' + codingCond + pips(j) + '</p>' +
        '<p class="reward-math">' +
          '<span class="reward-term' + (baseOn ? ' is-on' : '') + '">재능 30분</span>' +
          '<span class="reward-op">+</span>' +
          '<span class="reward-term reward-term-book' + (bookBonus ? ' is-on' : '') + '">책 10분</span>' +
          '<span class="reward-op">=</span>' +
          '<b class="reward-total' + (codingMin > 0 ? ' is-on' : '') + '">' + (codingMin > 0 ? codingMin + '분' : '아직 0분') + '</b>' +
        '</p>' +
      '</div>' +
      '<span class="reward-state' + codingStateCls + '">' + codingState + '</span>' +
    '</div>';

    /* 3) 냥코 20분 — 오늘 독서 기록을 남기면 함께 해금 */
    var catRow = '<div class="reward-row reward-row-cat' + (bookBonus ? ' is-unlocked' : '') + '" data-reward="cat">' +
      '<span class="reward-icon">' + ric('cat') + '</span>' +
      '<div class="reward-info">' +
        '<p class="reward-name">🐱 냥코 20분 하기</p>' +
        '<p class="reward-cond">' +
          (bookBonus ? '오늘 책 ' + bookCount + '권 기록 완료! 🎉' : '오늘 독서 기록 남기면 해금!') +
        '</p>' +
      '</div>' +
      '<span class="reward-state' + (bookBonus ? ' is-cat' : '') + '">' +
        (bookBonus ? '20분 해금 🎉' : '잠금') +
      '</span>' +
    '</div>';

    byId('reward-list').innerHTML = videoRow + codingRow + catRow;

    var noteEl = byId('reward-book-note');
    if (noteEl) {
      noteEl.className = 'reward-book-note' + (bookBonus ? ' is-on' : '');
      noteEl.textContent = bookBonus
        ? '📚 오늘 책 ' + bookCount + '권 기록! 엔트리코딩 +10분 · 냥코 20분이 열렸어요'
        : '📚 오늘 책을 기록하면 엔트리코딩 +10분 · 냥코 20분!';
    }

    var wk = Store.weekWorkbookDays(kid.id, today);
    var dots = wk.days.map(function (day, i) {
      return '<div class="week-dot' + (day.complete ? ' on' : '') + (day.date === today ? ' today' : '') + '">' +
        '<span></span><em>' + DAYS[i + 1] + '</em></div>';
    }).join('');
    var pct = Math.round((wk.count / wk.total) * 100);

    var week = byId('reward-week');
    week.className = 'reward-week' + (wk.full ? ' is-full' : '');
    week.innerHTML =
      '<div class="reward-week-head"><span class="rw-head">' +
        '<span class="rw-ic" aria-hidden="true">' + ric('nintendo') + '</span>' +
        '<span>주5일 문제집 완주</span>' +
      '</span><b>' + wk.count + '/' + wk.total + '일</b></div>' +
      '<div class="week-dots">' + dots + '</div>' +
      '<div class="reward-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="reward-week-foot">' +
        '<span>이번 주말 닌텐도 <b>토·일 각 ' + (wk.full ? '4시간 30분' : '4시간') + '</b></span>' +
        '<span>' + (wk.full ? '+30분 받았어요 🎮' : '5일 완주하면 +30분') + '</span>' +
      '</div>';

    byId('reward-note').textContent = wk.full
      ? '5일 완주 성공! 이번 주말은 닌텐도 4시간 30분이에요 🎮'
      : '평일 문제집 5일 완주 → 주말 닌텐도 +30분 (기본 4시간 → 4시간 30분)';
  }

  /* ---------------- 도장판 ---------------- */
  function kids() {
    return state.members.filter(function (m) { return m.role === 'kid'; });
  }

  function renderStamps() {
    var kidList = kids();
    if (!kidList.length) return;
    if (!kidList.some(function (k) { return k.id === stampKid; })) stampKid = kidList[0].id;

    var kid = Store.member(stampKid) || kidList[0];
    byId('stamp-tabs').setAttribute('role', 'tablist');
    byId('stamp-tabs').hidden = kidList.length < 2; // 혼자면 탭 없이 바로 보여요
    byId('stamp-tabs').innerHTML = kidList.map(function (k) {
      var active = k.id === stampKid;
      return '<button class="stamp-tab' + (active ? ' is-active' : '') + '" data-action="stamp-kid" data-kid="' + k.id + '" ' +
        'role="tab" aria-selected="' + (active ? 'true' : 'false') + '">' +
        '<span class="tab-avatar">' + Chars.svg(k.char) + '</span>' + esc(k.name) + '</button>';
    }).join('');

    byId('stamp-title').textContent = kid.name;
    byId('stamp-desc').textContent = kid.name + '가 그날 공부나 루틴을 하나라도 마치면 도장이 찍혀요';

    var today = Store.todayISO();
    var monday = Store.startOfWeek(today);
    var html = '';
    for (var i = 0; i < 7; i++) {
      var d = Store.addDays(monday, i);
      var dow = Store.parseDate(d).getDay();
      var stamped = Store.hasStamp(kid.id, d);
      var cls = 'stamp-circle' + (stamped ? ' is-stamped' : '') + (d === today ? ' is-today' : '');
      var inner = stamped
        ? '<span class="stamp-char">' + Chars.svg(kid.char) + '</span>'
        : '<span class="stamp-empty-dot"></span>';
      html += '<div class="stamp-day' + (d === today ? ' is-today' : '') + '">' +
        '<span class="stamp-day-label">' + DAYS[dow] + '</span>' +
        '<button class="' + cls + '" data-action="stamp-day" data-date="' + d + '" ' +
          'aria-label="' + (d.slice(5).replace('-', '월 ')) + '일 도장 ' + (stamped ? '지우기' : '찍기') + '">' +
          inner + '</button></div>';
    }
    byId('stamp-week').innerHTML = html;

    byId('stamp-streak').textContent = '🔥 ' + Store.streak(kid.id, today) + '일 연속';

    var now = Store.now();
    var monthCount = Store.monthStampCount(kid.id, now.getFullYear(), now.getMonth());
    var todayNote = Store.hasStamp(kid.id, today)
      ? '오늘 찍음'
      : (Store.isWeekday(today) ? '오늘 아직' : '오늘은 주말');
    byId('stamp-summary').textContent = '이번 달 도장 ' + monthCount + '개 · ' + todayNote;
  }

  /* ---------------- 등교·학원 준비 ---------------- */
  function prepBlockState(name) {
    return name ? ' data-state="' + name + '"' : '';
  }

  function prepCheckButton(opts) {
    var icon = (Chars && Chars.iconOf) ? Chars.iconOf(opts.emoji) : '';
    return '<button class="prep-check' + (opts.checked ? ' is-on' : '') + '" type="button" ' +
      'data-action="' + opts.action + '" data-item="' + opts.id + '"' +
      (opts.start ? ' data-start="' + opts.start + '"' : '') +
      ' aria-pressed="' + (opts.checked ? 'true' : 'false') + '">' +
      '<span class="prep-box" aria-hidden="true">✓</span>' +
      (icon ? '<span class="prep-ic" aria-hidden="true">' + icon + '</span>' : '') +
      '<span class="prep-check-label">' + esc(opts.label) + '</span>' +
    '</button>';
  }

  function renderPrep() {
    if (!state || !Prep) return;
    var dateISO = Store.todayISO();
    var d = Store.parseDate(dateISO);
    var dow = d.getDay();
    byId('prep-day').textContent = DAYS[dow] + '요일';

    var kid = Sched.kids.jjini;
    var day = kid && kid.days[dow];
    var now = nowMinutes();
    var schoolHtml = '';
    var academyHtml = '';
    var freeHtml = '';

    if (!day) {
      byId('prep-sub').textContent = '주말은 등교·학원 준비가 없어요';
      freeHtml +=
        '<div class="prep-free">' +
          '<div class="prep-free-emoji">🌈</div>' +
          '<p class="prep-free-title">주말엔 등교·학원 준비가 없어요</p>' +
          '<p class="prep-free-sub">내일 준비물은 주간 시간표를 보고 미리 챙겨 둬요</p>' +
        '</div>';
    } else {
      byId('prep-sub').textContent = '오늘 준비물과 취침 시간을 확인해요';

      var schoolDep = Prep.minutesOf(Prep.SCHOOL_DEPART);
      var sState = Prep.status(schoolDep, null, now);
      var items = Prep.schoolList(dateISO);
      var doneCount = items.filter(function (it) { return it.checked; }).length;
      var allDone = doneCount === items.length;

      schoolHtml += '<div class="prep-block prep-block-school" data-prep-dep="' + schoolDep + '"' +
          prepBlockState(sState.state) + '>' +
        '<div class="prep-head">' +
          '<span class="prep-title"><span class="prep-title-ic" aria-hidden="true">' + ric('school') + '</span>등교 준비</span>' +
          '<span class="prep-left" data-prep-left>' + esc(sState.text) + '</span>' +
        '</div>' +
        '<div class="prep-depart-row">' +
          '<span class="prep-depart">' + Prep.SCHOOL_DEPART + '</span>' +
          '<span class="prep-depart-label">출발</span>' +
          '<span class="prep-check-count' + (allDone ? ' is-done' : '') + '">' + doneCount + '/' + items.length + '</span>' +
        '</div>' +
        '<div class="prep-checks">' + items.map(function (it) {
          return prepCheckButton({
            action: 'prep-school-toggle',
            id: it.id,
            label: it.label,
            emoji: it.emoji,
            checked: it.checked
          });
        }).join('') + '</div>' +
        '<p class="prep-note' + (allDone ? ' is-done' : '') + '">' +
          (allDone ? '다 챙겼어요! 등교 준비 완료 🎉' : '안경·외투·핸드폰을 하나씩 체크해요') +
        '</p>' +
      '</div>';

      var list = Prep.academyList(dateISO, day.items);
      academyHtml += '<div class="prep-block prep-block-academy">' +
        '<div class="prep-head">' +
          '<span class="prep-title"><span class="prep-title-ic" aria-hidden="true">' + ric('academy') + '</span>학원 준비</span>' +
          '<span class="prep-count-sub">' + (list.length ? '수업 ' + list.length + '개 · 10분 전 출발' : '오늘은 없음') + '</span>' +
        '</div>';

      if (!list.length) {
        academyHtml += '<p class="prep-empty">오늘은 학원 일정이 없어요 😌</p>';
      } else {
        academyHtml += list.map(function (it) {
          var st = Prep.status(it.departMin, it.endMin, now);
          return '<div class="prep-academy-row" data-prep-dep="' + it.departMin + '" data-prep-end="' + it.endMin + '"' +
              prepBlockState(st.state) + '>' +
            '<div class="prep-head">' +
              '<span class="chip-subject tone-' + tone(it.name) + '">' + esc(it.name) + ' <b>' + it.start + '~' + it.end + '</b></span>' +
              '<span class="prep-left" data-prep-left>' + esc(st.text) + '</span>' +
            '</div>' +
            '<div class="prep-depart-row">' +
              '<span class="prep-depart">' + it.depart + '</span>' +
              '<span class="prep-depart-label">출발</span>' +
            '</div>' +
            '<div class="prep-checks">' + prepCheckButton({
              action: 'prep-academy-toggle',
              id: it.check.id,
              start: it.start,
              label: it.check.label,
              emoji: it.check.emoji,
              checked: it.check.checked
            }) + '</div>' +
          '</div>';
        }).join('');
      }

      academyHtml += '</div>';
    }

    /* 등교·학원 준비를 왼쪽, 학원 준비를 오른쪽 열에 놓고
       취침 준비는 왼쪽 열에서 등교 준비 아래에 붙입니다. */
    var bedHtml = bedBlockHtml(dateISO, now);
    var html = day
      ? '<div class="prep-col">' + schoolHtml + bedHtml + '</div>' +
        '<div class="prep-col">' + academyHtml + '</div>'
      : '<div class="prep-col prep-col-wide">' + freeHtml + bedHtml + '</div>';
    byId('prep-body').innerHTML = html;
  }

  /* ---------------- 취침 준비 ---------------- */
  function bedRowHtml(it, now) {
    var icon = (Chars && Chars.iconOf) ? Chars.iconOf(it.emoji) : '';
    var st = Prep.bedStatus(it.atMin, now);
    return '<div class="bed-row' + (it.checked ? ' is-on' : '') + '" data-bed-at="' + it.atMin + '"' +
        ' data-state="' + (it.checked ? 'done' : st.state) + '">' +
      (icon ? '<span class="bed-ic" aria-hidden="true">' + icon + '</span>' : '') +
      '<div class="bed-main">' +
        '<span class="bed-time">' + it.at + '</span>' +
        '<span class="bed-name">' + esc(it.label) + '</span>' +
      '</div>' +
      '<span class="bed-left" data-bed-left>' + esc(it.checked ? '완료 ✓' : st.text) + '</span>' +
      '<button class="bed-check" type="button" data-action="prep-bed-toggle" data-item="' + it.id + '" ' +
        'aria-pressed="' + (it.checked ? 'true' : 'false') + '" ' +
        'aria-label="' + esc(it.label) + (it.checked ? ' 체크 풀기' : ' 체크하기') + '">' +
        '<span aria-hidden="true">✓</span>' +
      '</button>' +
    '</div>';
  }

  function bedBlockHtml(dateISO, now) {
    var plan = Prep.bedPlan(dateISO);
    var head = '<div class="prep-head">' +
      '<span class="prep-title"><span class="prep-title-ic" aria-hidden="true">' + ric('bed') + '</span>취침 준비</span>' +
      '<span class="prep-count-sub">' + (plan ? plan.tag : '주말은 정해진 시간 없음') + '</span>' +
    '</div>';

    if (!plan) {
      return '<div class="prep-block prep-block-bed prep-block-bed-rest">' + head +
        '<p class="prep-empty">주말엔 정해진 취침 시간이 없어요 😴 평일 시간은 이래요</p>' +
        '<div class="bed-ref">' + Prep.BED_REF.map(function (r) {
          return '<div class="bed-ref-row"><b>' + r.label + '</b>' +
            '<span>🚿 ' + r.shower + '</span>' +
            '<span>😴 ' + r.sleep + '</span></div>';
        }).join('') + '</div>' +
      '</div>';
    }

    var list = Prep.bedList(dateISO);
    var doneCount = list.filter(function (it) { return it.checked; }).length;
    var allDone = doneCount > 0 && doneCount === list.length;

    return '<div class="prep-block prep-block-bed">' + head +
      '<div class="bed-rows">' + list.map(function (it) { return bedRowHtml(it, now); }).join('') + '</div>' +
      '<p class="prep-note' + (allDone ? ' is-done' : '') + '">' +
        (allDone ? '취침 준비 끝! 잘 자요 🌙' : '샤워하고 이를 닦은 뒤 눕기까지 하나씩 체크해요') +
      '</p>' +
    '</div>';
  }

  function refreshPrepTimers() {
    if (!Prep) return;
    var now = nowMinutes();
    var nodes = document.querySelectorAll('[data-prep-dep]');
    Array.prototype.forEach.call(nodes, function (node) {
      var dep = Number(node.getAttribute('data-prep-dep'));
      var endAttr = node.getAttribute('data-prep-end');
      var st = Prep.status(dep, endAttr ? Number(endAttr) : null, now);
      node.setAttribute('data-state', st.state);
      var label = node.querySelector('[data-prep-left]');
      if (label) label.textContent = st.text;
    });

    /* 취침 준비 남은 시간 */
    var beds = document.querySelectorAll('[data-bed-at]');
    Array.prototype.forEach.call(beds, function (node) {
      var at = Number(node.getAttribute('data-bed-at'));
      var on = node.classList.contains('is-on');
      var st2 = Prep.bedStatus(at, now);
      node.setAttribute('data-state', on ? 'done' : st2.state);
      var label2 = node.querySelector('[data-bed-left]');
      if (label2) label2.textContent = on ? '완료 ✓' : st2.text;
    });
  }

  /* ---------------- 엄마 일정 ---------------- */
  /* 강의·수업 성격의 낱말 — 제목이나 메모에 있으면 🎤로 보여 줍니다 */
  var LECTURE_WORDS = /(디지털안전지도사|지도사|강의|특강|교육|강사|수업|비대면|초등|중등|고등|학교|초\s|초$|중\s|중$|고\s|고$)/;
  function looksLikeLecture(title, note) {
    return LECTURE_WORDS.test(String(title || '') + ' ' + String(note || ''));
  }
  /* 저장된 표시(lecture)가 있으면 그걸 따르고, 없으면 낱말로 알아봅니다 */
  function isLecture(it) {
    if (!it) return false;
    if (typeof it.lecture === 'boolean') return it.lecture;
    return looksLikeLecture(it.title, it.note);
  }
  function lectureIcon(it) {
    return isLecture(it) ? '🎤' : '📅';
  }

  function lectureRow(it, withDate, noActions) {
    return '<div class="lecture-row">' +
      '<div class="lecture-top">' +
        '<span class="lecture-ic' + (isLecture(it) ? ' is-lecture' : '') + '" aria-hidden="true">' + lectureIcon(it) + '</span>' +
        '<span class="lecture-time' + (it.time ? '' : ' is-empty') + '">' +
          (it.time ? esc(it.time) : '시간 미정') + '</span>' +
        '<span class="lecture-title">' + esc(it.title) + '</span>' +
      '</div>' +
      '<div class="lecture-meta">' +
        (withDate ? '<span class="lecture-date">' + esc(shortDate(it.date)) + '</span>' : '') +
        (it.note ? '<span class="lecture-note">' + esc(it.note) + '</span>' : '') +
        (noActions ? '' :
          '<span class="lecture-actions">' +
            '<button class="mini-btn" data-action="edit-lecture" data-id="' + it.id + '" ' +
              'aria-label="' + esc(it.title) + ' 고치기">✏️</button>' +
            '<button class="mini-btn del" data-action="delete-lecture" data-id="' + it.id + '" ' +
              'aria-label="' + esc(it.title) + ' 지우기">✕</button>' +
          '</span>') +
      '</div>' +
    '</div>';
  }

  function renderLectures() {
    if (!Lectures) return;
    var today = Store.todayISO();
    var all = Lectures.list();
    var monday = Store.startOfWeek(today);
    var sunday = Store.addDays(monday, 6);
    /* 다가오는 일정은 다음 주 일요일까지만 보여 줍니다(그 뒤 일정은 저장만 하고 화면에는 안 냅니다) */
    var nextSunday = Store.addDays(monday, 13);
    var todayList = all.filter(function (it) { return it.date === today; });
    var weekList = all.filter(function (it) { return it.date > today && it.date <= sunday; });
    var upcomingAll = all.filter(function (it) { return it.date > sunday && it.date <= nextSunday; });
    var upcoming = lectureExpanded ? upcomingAll : upcomingAll.slice(0, 6);

    /* 오늘 탭 — 오늘 날짜의 일정만 짧게 */
    byId('lecture-mini-sub').textContent = todayList.length
      ? '오늘 ' + todayList.length + '개 일정이 있어요'
      : '오늘은 일정이 없어요';
    byId('lecture-mini').innerHTML = todayList.length
      ? '<div class="lecture-list">' + todayList.map(function (it) { return lectureRow(it, false, true); }).join('') + '</div>'
      : '<p class="lecture-mini-empty">오늘은 일정이 없어요 ☕</p>';

    /* 일정 탭 — 이번 주 + 다가오는 일정 */
    byId('lecture-sub').textContent = (weekList.length + upcomingAll.length)
      ? '이번 주 ' + weekList.length + '개 · 다가오는 일정 ' + upcomingAll.length + '개'
      : '이번 주와 다가오는 일정을 모아 봐요';

    var html = '<div class="lecture-head">' +
        '<span class="lecture-head-title">오늘 · ' + esc(shortDate(today)) + '</span>' +
        '<span class="pill pill-soft">' + (todayList.length ? todayList.length + '개' : '없음') + '</span>' +
      '</div>';
    html += todayList.length
      ? '<div class="lecture-list">' + todayList.map(function (it) { return lectureRow(it, false); }).join('') + '</div>'
      : '<p class="lecture-empty">오늘은 일정이 없어요 ☕</p>';
    byId('lecture-today').innerHTML = html;

    var wk = '<div class="lecture-head">' +
        '<span class="lecture-head-title">이번 주 · ' + esc(shortDate(monday, false)) + '~' + esc(shortDate(sunday, false)) + '</span>' +
        '<span class="pill pill-soft">' + (weekList.length ? weekList.length + '개' : '없음') + '</span>' +
      '</div>';
    wk += weekList.length
      ? '<div class="lecture-list">' + weekList.map(function (it) { return lectureRow(it, true); }).join('') + '</div>'
      : '<p class="lecture-empty">이번 주에는 남은 일정이 없어요</p>';
    byId('lecture-week').innerHTML = wk;

    var up = '<div class="lecture-head">' +
        '<span class="lecture-head-title">다가오는 일정 · 다음 주까지</span>' +
        (upcomingAll.length > 6
          ? '<button class="lecture-more" type="button" data-action="toggle-lecture-more">' +
              (lectureExpanded ? '접기 ▴' : '외 ' + (upcomingAll.length - upcoming.length) + '개 더 보기 ▾') +
            '</button>'
          : '') +
      '</div>';
    up += upcoming.length
      ? '<div class="lecture-list">' + upcoming.map(function (it) { return lectureRow(it, true); }).join('') + '</div>'
      : '<p class="lecture-empty">다가오는 일정은 아직 없어요</p>';
    byId('lecture-upcoming').innerHTML = up;
  }

  /* ---------------- 독서 기록 ---------------- */
  /* 책 한 권 카드 — 오늘 목록과 누적 보기에서 같이 씁니다. arch=1 이면 누적 보기에서 연 것 */
  function bookRow(b, arch) {
    return '<article class="book-row">' +
      '<div class="book-top">' +
        '<span class="book-emoji" aria-hidden="true">' + ric('book') + '</span>' +
        '<div class="book-info">' +
          '<p class="book-title">' + esc(b.title) + '</p>' +
          '<p class="book-date">' + esc(shortDate(b.date, false)) + '</p>' +
        '</div>' +
        '<span class="book-actions">' +
          '<button class="mini-btn" data-action="edit-book" data-id="' + b.id + '"' + (arch ? ' data-arch="1"' : '') + ' ' +
            'aria-label="' + esc(b.title) + ' 고치기">✏️</button>' +
          '<button class="mini-btn del" data-action="delete-book" data-id="' + b.id + '" ' +
            'aria-label="' + esc(b.title) + ' 지우기">✕</button>' +
        '</span>' +
      '</div>' +
      (b.review ? '<p class="book-review">' + esc(b.review) + '</p>' : '') +
    '</article>';
  }

  function todayBooks() {
    if (!Books) return [];
    var today = Store.todayISO();
    return Books.list().filter(function (b) { return String(b.date || '').slice(0, 10) === today; });
  }

  function renderBooks() {
    if (!Books) return;
    var today = Store.todayISO();
    var list = Books.list();
    var todayList = list.filter(function (b) { return String(b.date || '').slice(0, 10) === today; });
    var todayCount = todayList.length;
    byId('book-sub').textContent = list.length
      ? '오늘 ' + todayCount + '권 · 지금까지 ' + list.length + '권'
      : '읽은 책과 짧은 감상평을 남겨요';

    /* 오늘 기록을 남기면 엔트리코딩 +10분 — 지금 상태를 안내해요 */
    var bonus = byId('book-bonus');
    if (bonus) {
      var bonusIcons = byId('book-bonus-icons');
      if (bonusIcons && !bonusIcons.firstChild) {
        bonusIcons.innerHTML = '<span class="bb-ic">' + ric('coding') + '</span>' +
          '<span class="bb-ic">' + ric('cat') + '</span>';
      }
      var kid = rewardKid();
      var jaeneungDone = kid ? !!Store.rewardProgress(kid.id, today).jaeneung.all : false;
      var codingMin = (jaeneungDone ? 30 : 0) + (todayCount > 0 ? 10 : 0);
      bonus.className = 'book-bonus' + (todayCount > 0 ? ' is-on' : '');
      byId('book-bonus-title').textContent = todayCount > 0
        ? '오늘 책 기록 완료! 엔트리코딩 +10분 · 냥코 20분 해금'
        : '오늘 책 기록 남기면 엔트리코딩 +10분 · 냥코 20분!';
      byId('book-bonus-sub').textContent = todayCount > 0
        ? (jaeneungDone
            ? '지금 엔트리코딩 ' + codingMin + '분 + 냥코 20분 완료!'
            : '지금 엔트리코딩 10분 + 냥코 20분 · 재능까지 끝내면 40분')
        : '오늘 날짜로 책을 남기면 두 보상이 함께 열려요';
    }

    /* 오늘 남긴 책만 보여 주고, 지난 기록은 '누적 N권 보기'에서 모아 봐요 */
    byId('book-list').innerHTML = todayList.length
      ? todayList.map(function (b) { return bookRow(b, false); }).join('')
      : '<div class="book-empty-card">' +
          '<span class="book-empty-emoji" aria-hidden="true">📚</span>' +
          '<p class="book-empty-text">오늘 읽은 책이 아직 없어요</p>' +
          '<button class="book-empty-btn" type="button" data-action="add-book">오늘 읽은 책 남기기</button>' +
        '</div>';

    var archBtn = byId('btn-book-archive');
    if (archBtn) {
      archBtn.hidden = list.length <= 0;
      archBtn.textContent = '📚 누적 ' + list.length + '권 보기';
    }
  }

  /* ---------------- 💌 엄마·아빠 한마디 ---------------- */
  function noteAuthor(who) {
    for (var i = 0; i < NOTE_AUTHORS.length; i++) {
      if (NOTE_AUTHORS[i].who === who) return NOTE_AUTHORS[i];
    }
    return NOTE_AUTHORS[0];
  }

  function noteWhen(n) {
    if (!n || !n.updatedAt) return '';
    var d = new Date(n.updatedAt);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  /* 누적 보기에서 쓰는 시각 표시 */
  function noteClock(n) {
    if (!n || !n.updatedAt) return '';
    var d = new Date(n.updatedAt);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function notesNow() {
    if (Store.parentNotesOn) return Store.parentNotesOn(Store.todayISO());
    return Store.parentNotes() || { mom: { text: '' }, dad: { text: '' } };
  }

  function notesOn(dateISO) {
    return Store.parentNotesOn ? Store.parentNotesOn(dateISO) : notesNow();
  }

  /* '11월 26일 (수)' — 해가 다르면 연도도 붙입니다 */
  function archiveDayLabel(dateISO) {
    var d = Store.parseDate(dateISO);
    var thisYear = Store.parseDate(Store.todayISO()).getFullYear();
    var head = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DAYS[d.getDay()] + ')';
    return d.getFullYear() === thisYear ? head : d.getFullYear() + '년 ' + head;
  }

  function renderNotes() {
    var list = byId('note-list');
    if (!list) return;
    var notes = notesNow();
    var filled = NOTE_AUTHORS.filter(function (a) { return notes[a.who] && notes[a.who].text; });
    var sub = byId('note-sub');
    renderNoteArchiveBtn();

    /* 오늘 남긴 한마디가 하나도 없으면 어제 글이 남지 않고 새 화면으로 뜹니다 */
    if (!filled.length) {
      if (sub) sub.textContent = '오늘의 응원을 짧게 남겨요';
      list.innerHTML =
        '<div class="note-empty">' +
          '<span class="note-empty-emoji" aria-hidden="true">💌</span>' +
          '<p class="note-empty-text">오늘 남겨진 한마디가 아직 없어요 ✨</p>' +
          '<button class="note-empty-btn" type="button" data-action="edit-note">✏️ 첫 한마디 남기기</button>' +
        '</div>';
      return;
    }

    if (sub) sub.textContent = filled.length + '개의 한마디가 찌니를 응원해요';
    list.innerHTML = NOTE_AUTHORS.map(function (a) {
      var n = notes[a.who] || { text: '', updatedAt: 0 };
      var has = !!n.text;
      return '<article class="note-row' + (has ? ' is-filled' : ' is-empty') + '" data-who="' + a.who + '">' +
        '<span class="note-face" aria-hidden="true">' + a.emoji + '</span>' +
        '<div class="note-main">' +
          '<p class="note-who">' + a.name + ' 한마디' +
            (has ? '<span class="note-when">' + noteWhen(n) + '</span>' : '') +
          '</p>' +
          '<p class="note-text">' + (has ? esc(n.text) : '아직 한마디가 없어요') + '</p>' +
        '</div>' +
        '<button class="mini-btn" type="button" data-action="edit-note" data-who="' + a.who + '" ' +
          'aria-label="' + a.name + ' 한마디 ' + (has ? '고치기' : '남기기') + '">✏️</button>' +
      '</article>';
    }).join('');
  }

  function renderNoteArchiveBtn() {
    var btn = byId('btn-note-archive');
    if (!btn) return;
    var total = Store.notesCount ? Store.notesCount() : 0;
    btn.hidden = total <= 0;
    btn.textContent = '💌 지난 한마디 보기 · 누적 ' + total + '개';
  }

  /* 지난 한마디 — 날짜별(최신순) 누적 보기 */
  function renderNoteArchive() {
    var box = byId('note-archive-list');
    if (!box) return;
    var dates = Store.noteDates ? Store.noteDates() : [];
    var total = Store.notesCount ? Store.notesCount() : 0;
    byId('note-archive-count').textContent = total ? '누적 ' + total + '개' : '아직 한마디가 없어요';
    var today = Store.todayISO();

    if (!dates.length) {
      box.innerHTML = '<div class="archive-empty">' +
        '<span class="archive-empty-emoji" aria-hidden="true">💌</span>' +
        '<p class="archive-empty-text">아직 쌓인 한마디가 없어요.<br />오늘 첫 한마디를 남겨 볼까요?</p>' +
        '</div>';
      return;
    }

    box.innerHTML = dates.map(function (date) {
      var notes = notesOn(date);
      var rows = NOTE_AUTHORS.filter(function (a) { return notes[a.who] && notes[a.who].text; })
        .map(function (a) {
          var n = notes[a.who];
          return '<article class="note-row archive-note" data-who="' + a.who + '">' +
            '<span class="note-face" aria-hidden="true">' + a.emoji + '</span>' +
            '<div class="note-main">' +
              '<p class="note-who">' + a.name + ' 한마디' +
                (n.updatedAt ? '<span class="note-when">' + noteClock(n) + '</span>' : '') +
              '</p>' +
              '<p class="note-text">' + esc(n.text) + '</p>' +
            '</div>' +
            '<span class="archive-actions">' +
              '<button class="mini-btn" type="button" data-action="edit-note-arch" data-who="' + a.who + '" ' +
                'data-date="' + date + '" aria-label="' + a.name + ' ' + date + ' 한마디 고치기">✏️</button>' +
              '<button class="mini-btn del" type="button" data-action="delete-note-arch" data-who="' + a.who + '" ' +
                'data-date="' + date + '" aria-label="' + a.name + ' ' + date + ' 한마디 지우기">✕</button>' +
            '</span>' +
          '</article>';
        }).join('');
      return '<section class="archive-day">' +
        '<h3 class="archive-day-title"><span>' + esc(archiveDayLabel(date)) + '</span>' +
          (date === today ? '<span class="archive-today">오늘</span>' : '') +
        '</h3>' +
        rows +
      '</section>';
    }).join('');
  }

  /* 누적 독서 기록 — 날짜별(최신순) */
  function renderBookArchive() {
    var box = byId('book-archive-list');
    if (!box) return;
    var all = Books ? Books.list() : [];
    byId('book-archive-count').textContent = all.length ? '지금까지 ' + all.length + '권' : '아직 기록이 없어요';
    var today = Store.todayISO();

    if (!all.length) {
      box.innerHTML = '<div class="archive-empty">' +
        '<span class="archive-empty-emoji" aria-hidden="true">📚</span>' +
        '<p class="archive-empty-text">아직 읽은 책이 없어요.<br />오늘 읽은 책을 남겨 볼까요?</p>' +
        '</div>';
      return;
    }

    var order = [];
    var byDate = {};
    all.forEach(function (b) {
      var date = String(b.date || '').slice(0, 10) || today;
      if (!byDate[date]) { byDate[date] = []; order.push(date); }
      byDate[date].push(b);
    });

    box.innerHTML = order.map(function (date) {
      return '<section class="archive-day">' +
        '<h3 class="archive-day-title"><span>' + esc(archiveDayLabel(date)) + '</span>' +
          (date === today ? '<span class="archive-today">오늘</span>' : '') +
          '<span class="archive-day-count">' + byDate[date].length + '권</span>' +
        '</h3>' +
        byDate[date].map(function (b) { return bookRow(b, true); }).join('') +
      '</section>';
    }).join('');
  }

  /* 한마디 시트 — 작성자를 고르고 한 줄을 적습니다 */
  function noteSheetPick(who, keepTyped) {
    noteCtx.who = who;
    var date = noteCtx.date || Store.todayISO();
    var n = notesOn(date)[who] || { text: '', updatedAt: 0 };
    var ta = byId('note-text');
    var sameAsSaved = !keepTyped || ta.value.trim() === String(noteCtx.saved || '').trim();
    if (sameAsSaved) ta.value = n.text || '';
    noteCtx.saved = n.text || '';

    Array.prototype.forEach.call(byId('note-who-chips').children, function (b) {
      b.setAttribute('aria-pressed', b.dataset.who === who ? 'true' : 'false');
    });
    byId('note-sheet-title').textContent = '💌 ' + noteAuthor(who).name + ' 한마디';
    var hint = byId('note-date-hint');
    if (hint) {
      var past = date !== Store.todayISO();
      hint.hidden = !past;
      hint.textContent = past ? archiveDayLabel(date) + '에 남긴 한마디를 고쳐요' : '';
    }
    byId('note-delete').hidden = !n.text;
    renderNoteCount();
  }

  function renderNoteCount() {
    var el = byId('note-count');
    var ta = byId('note-text');
    if (el && ta) el.textContent = ta.value.length + '/120';
  }

  function openNoteSheet(who, dateISO, opts) {
    var raw = String(dateISO || '').slice(0, 10);
    noteCtx.date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : Store.todayISO();
    noteCtx.fromArchive = !!(opts && opts.fromArchive);
    var notes = notesOn(noteCtx.date);
    var target = who;
    if (!target) {
      /* 아직 비어 있는 사람을 먼저 고릅니다 (둘 다 비었으면 엄마) */
      var empty = NOTE_AUTHORS.filter(function (a) { return !(notes[a.who] && notes[a.who].text); });
      target = empty.length ? empty[0].who : 'mom';
    }
    noteCtx.saved = '';
    noteSheetPick(target, false);
    openSheet('sheet-note');
    setTimeout(function () { byId('note-text').focus(); }, 120);
  }

  /* ---------------- 설정 ---------------- */
  function renderSettings() {
    byId('city-current').textContent = state.settings.place.name;
    renderSoundUI();

    byId('city-presets').innerHTML = Weather.PRESETS.map(function (p) {
      var active = p.name === state.settings.place.name;
      return '<button class="chip' + (active ? ' is-active' : '') + '" data-action="pick-city" ' +
        'data-name="' + esc(p.name) + '" data-lat="' + p.lat + '" data-lon="' + p.lon + '">' + esc(p.name) + '</button>';
    }).join('');

    byId('member-edit-list').innerHTML = state.members.map(function (m) {
      return '<div class="member-edit-row">' +
        '<span class="member-edit-avatar">' + Chars.svg(m.char) + '</span>' +
        '<div class="member-edit-fields">' +
          '<input class="name" type="text" maxlength="12" value="' + esc(m.name) + '" ' +
            'data-member-field="name" data-member="' + m.id + '" aria-label="' + esc(m.name) + ' 이름">' +
          '<input class="sub" type="text" maxlength="20" value="' + esc(m.sub || '') + '" ' +
            'data-member-field="sub" data-member="' + m.id + '" aria-label="' + esc(m.name) + ' 한 줄 소개">' +
        '</div></div>';
    }).join('');
  }

  /* ---------------- 시트 ---------------- */
  function openSheet(id) {
    byId('sheet-backdrop').hidden = false;
    SHEETS.forEach(function (s) { byId(s).hidden = (s !== id); });
    document.body.style.overflow = 'hidden';
  }
  function closeSheets() {
    byId('sheet-backdrop').hidden = true;
    SHEETS.forEach(function (s) { byId(s).hidden = true; });
    document.body.style.overflow = '';
  }

  /* ---------------- 달력 ---------------- */
  function openCalendar() {
    var now = Store.now();
    calCursor = { y: now.getFullYear(), m: now.getMonth() };
    renderCalendar();
    openSheet('sheet-calendar');
  }

  function renderCalendar() {
    var kid = Store.member(stampKid) || kids()[0];
    if (!kid) return;
    byId('calendar-kid').textContent = kid.name;
    var y = calCursor.y, m = calCursor.m;
    byId('cal-month').textContent = y + '년 ' + (m + 1) + '월';

    byId('cal-head').innerHTML = ['일', '월', '화', '수', '목', '금', '토'].map(function (d) {
      return '<span>' + d + '</span>';
    }).join('');

    var startDow = new Date(y, m, 1, 12).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var today = Store.todayISO();
    var html = '';
    var count = 0;
    var i, day;

    for (i = 0; i < startDow; i++) html += '<span class="cal-cell is-empty"></span>';
    for (day = 1; day <= daysInMonth; day++) {
      var ds = y + '-' + pad(m + 1) + '-' + pad(day);
      var stamped = Store.hasStamp(kid.id, ds);
      if (stamped) count++;
      var future = ds > today;
      var cls = 'cal-cell' + (stamped ? ' is-stamped' : '') + (ds === today ? ' is-today' : '') + (future ? ' is-future' : '');
      var inner = '<span>' + day + '</span>' +
        (stamped ? '<span class="cal-char">' + Chars.svg(kid.char) + '</span>' : '');
      html += future
        ? '<span class="' + cls + '">' + inner + '</span>'
        : '<button class="' + cls + '" data-action="cal-day" data-date="' + ds + '">' + inner + '</button>';
    }
    byId('cal-grid').innerHTML = html;
    byId('cal-summary').textContent = (m + 1) + '월 도장 ' + count + '개';
  }

  /* ---------------- 주간 시간표 ---------------- */
  function renderTimetable() {
    var kidList = kids();
    var tabRow = byId('timetable-tabs');
    tabRow.hidden = kidList.length < 2; // 혼자면 탭 없이 바로 보여요
    tabRow.innerHTML = kidList.map(function (k) {
      var active = k.id === timetableKid;
      return '<button class="stamp-tab' + (active ? ' is-active' : '') + '" data-action="tt-kid" data-kid="' + k.id + '">' +
        '<span class="tab-avatar">' + Chars.svg(k.char) + '</span>' + esc(k.name) + '</button>';
    }).join('');

    var kid = Sched.kids[timetableKid] || Sched.kids.jjini;
    var todayDow = Store.parseDate(Store.todayISO()).getDay();
    var html = '';

    for (var dow = 1; dow <= 5; dow++) {
      var day = kid.days[dow];
      var isToday = dow === todayDow;
      var items = '';
      if (day) {
        items += '<div class="timetable-line"><span class="school">🏫 학교 <b>' + day.school + '</b> 하교</span></div>';
        day.items.forEach(function (it) {
          items += '<div class="timetable-line">' +
            '<span class="chip-subject tone-' + tone(it.name) + '">' + esc(it.name) + ' <b>' + it.start + '~' + it.end + '</b></span>' +
          '</div>';
        });
        if (!day.items.length) items += '<div class="timetable-line">방과후 일정 없음</div>';
      } else {
        items = '<div class="timetable-line">일정 없음</div>';
      }
      html += '<div class="timetable-row' + (isToday ? ' is-today' : '') + '">' +
        '<span class="timetable-day">' + DAYS[dow] + '</span>' +
        '<div class="timetable-items">' + items + '</div>' +
      '</div>';
    }
    byId('timetable-body').innerHTML = html;
    byId('timetable-hint').textContent = Sched.semester + ' · ' + kid.name + ' 평일 시간표';
  }

  /* ---------------- 할 일 시트 ---------------- */
  function openTaskSheet(opts) {
    taskCtx = {
      mode: opts.mode || 'add',
      memberId: opts.memberId || state.members[0].id,
      taskId: opts.taskId || null,
      repeat: opts.repeat || 'once'
    };
    byId('task-title').textContent = taskCtx.mode === 'edit' ? '✏️ 할 일 고치기' : '+ 할 일 추가';

    byId('task-member-chips').innerHTML = state.members.map(function (m) {
      var active = m.id === taskCtx.memberId;
      return '<button class="chip chip-choice" data-action="task-member" data-member="' + m.id + '" ' +
        'aria-pressed="' + (active ? 'true' : 'false') + '">' + esc(m.name) + '</button>';
    }).join('');

    Array.prototype.forEach.call(byId('task-repeat-chips').children, function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-repeat') === taskCtx.repeat ? 'true' : 'false');
    });

    var input = byId('task-text');
    input.value = opts.text || '';
    byId('task-delete').hidden = taskCtx.mode !== 'edit';

    if (taskCtx.mode === 'edit') {
      input.value = opts.text || '';
    }

    openSheet('sheet-task');
    setTimeout(function () { input.focus(); }, 120);
  }

  /* ---------------- 별 시트 ---------------- */
  function openStarSheet(memberId) {
    starMember = memberId;
    var m = Store.member(memberId);
    if (!m) return;
    byId('star-name').textContent = m.name;
    byId('star-count').textContent = m.stars || 0;
    byId('star-avatar').innerHTML = Chars.svg(m.char);
    openSheet('sheet-star');
  }

  /* ---------------- 일정 시트 ---------------- */
  function openLectureSheet(opts) {
    lectureCtx = {
      mode: opts.mode || 'add',
      id: (opts.item && opts.item.id) || null,
      manual: false,
      lecture: false
    };
    var it = opts.item || { date: Store.todayISO(), time: '', title: '', note: '' };

    byId('lecture-sheet-title').textContent = lectureCtx.mode === 'edit' ? '👩 일정 고치기' : '👩 일정 추가';
    byId('lecture-date').value = it.date || Store.todayISO();
    byId('lecture-time').value = it.time || '';
    byId('lecture-name').value = it.title || '';
    byId('lecture-note').value = it.note || '';
    /* 이미 정해 둔 종류가 있으면 그대로, 없으면 낱말로 알아본 값을 보여 줍니다 */
    lectureCtx.manual = typeof it.lecture === 'boolean';
    lectureCtx.lecture = lectureCtx.manual ? it.lecture : looksLikeLecture(it.title, it.note);
    renderLectureKind();
    byId('lecture-name').oninput = renderLectureKind;
    byId('lecture-note').oninput = renderLectureKind;
    byId('lecture-delete').hidden = lectureCtx.mode !== 'edit';

    openSheet('sheet-lecture');
    setTimeout(function () { byId('lecture-name').focus(); }, 120);
  }

  /* 시트의 '일정 종류' 버튼 — 직접 고른 뒤에는 낱말보다 그 선택을 따릅니다 */
  function currentLectureKind() {
    if (lectureCtx.manual) return !!lectureCtx.lecture;
    return looksLikeLecture(byId('lecture-name').value, byId('lecture-note').value);
  }
  function renderLectureKind() {
    var btn = byId('lecture-kind-toggle');
    if (!btn) return;
    var on = currentLectureKind();
    btn.textContent = on ? '🎤 강의 일정' : '📅 일반 일정';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.className = 'btn btn-light btn-wide lecture-kind' + (on ? ' is-lecture' : '');
  }

  /* ---------------- 독서 기록 시트 ---------------- */
  function openBookSheet(opts) {
    bookCtx = {
      mode: opts.mode || 'add',
      id: (opts.item && opts.item.id) || null,
      fromArchive: !!opts.fromArchive
    };
    var b = opts.item || { date: Store.todayISO(), title: '', review: '' };

    byId('book-sheet-title').textContent = bookCtx.mode === 'edit' ? '✏️ 독서 기록 고치기' : '+ 독서 기록 추가';
    byId('book-date').value = b.date || Store.todayISO();
    byId('book-title').value = b.title || '';
    byId('book-review').value = b.review || '';
    byId('book-delete').hidden = bookCtx.mode !== 'edit';

    openSheet('sheet-book');
    setTimeout(function () { byId('book-title').focus(); }, 120);
  }

  /* ---------------- 토스트 / 축하 ---------------- */
  function toast(message, opts) {
    var t = byId('toast');
    t.hidden = false;
    t.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = message;
    t.appendChild(span);
    var hasAction = !!(opts && opts.label);
    if (hasAction) {
      var btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = opts.label;
      btn.addEventListener('click', function () {
        t.classList.remove('is-show');
        if (opts.onAction) opts.onAction();
      });
      t.appendChild(btn);
    }
    t.style.pointerEvents = hasAction ? 'auto' : 'none';
    requestAnimationFrame(function () { t.classList.add('is-show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-show'); }, (opts && opts.duration) || 2800);
  }

  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var layer = byId('confetti');
    var colors = ['#F6C24A', '#E98DA0', '#8FD3A0', '#8FB8E8', '#F0A96A'];
    for (var i = 0; i < 16; i++) {
      (function (n) {
        var p = document.createElement('span');
        p.className = 'confetti-piece';
        p.style.left = (18 + Math.random() * 64) + '%';
        p.style.top = (28 + Math.random() * 24) + '%';
        p.style.background = colors[n % colors.length];
        p.style.animationDelay = (Math.random() * 140) + 'ms';
        p.style.borderRadius = n % 3 === 0 ? '50%' : '2px';
        layer.appendChild(p);
        setTimeout(function () { p.remove(); }, 1400);
      })(i);
    }
  }

  /* ---------------- 전체 그리기 ---------------- */
  function renderAll() {
    state = Store.get();
    lastToday = Store.todayISO();
    renderHeader();
    renderWeather();
    renderSchedule();
    renderMembers();
    renderTodos();
    renderRewards();
    renderStamps();
    renderPrep();
    renderLectures();
    renderBooks();
    renderNotes();
  }

  function renderAfterTaskChange() {
    renderMembers();
    renderTodos();
    renderBooks();
    renderRewards();
    renderStamps();
  }

  /* ---------------- 페이지(탭) 전환 ---------------- */
  function applyTab(name, silent) {
    if (TABS.indexOf(name) < 0) name = 'today';
    var changed = name !== currentTab;
    currentTab = name;

    TABS.forEach(function (t) {
      var page = byId('page-' + t);
      if (page) page.hidden = (t !== name);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.tabbar [data-tab]'), function (btn) {
      var on = btn.getAttribute('data-tab') === name;
      btn.classList.toggle('is-active', on);
      if (on) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    /* 탭마다 필요한 부분만 새로 그려요 */
    if (name === 'prep') {
      renderPrep();
      refreshPrepTimers();
    } else if (name === 'todo') {
      renderTodos();
      renderBooks();
      renderRewards();
      renderStamps();
    } else if (name === 'lecture') {
      renderLectures();
    } else {
      renderSchedule();
      renderMembers();
      renderLectures();
      renderNotes();
    }

    if (changed && !silent) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 동작 ---------------- */
  var actions = {

    'switch-tab': function (el) {
      applyTab(el.dataset.tab);
    },

    'open-settings': function () {
      renderSettings();
      openSheet('sheet-settings');
    },

    'toggle-sound': function () {
      if (!Sound) return;
      var on = Sound.toggle();
      renderSoundUI();
      toast(on ? '효과음을 켰어요 🔊' : '효과음을 껐어요 🔇');
    },

    'share': function () {
      var payload = {
        title: '찌니 대시보드',
        text: '찌니 대시보드 — 오늘도 함께 기록해요 ✨',
        url: location.href
      };
      if (navigator.share) {
        navigator.share(payload).catch(function () { /* 사용자가 취소 */ });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload.text + ' ' + payload.url)
          .then(function () { toast('주소를 복사했어요 📋'); })
          .catch(function () { toast(payload.text); });
        return;
      }
      toast(payload.text);
    },

    'toggle-task': function (el) {
      var memberId = el.dataset.member;
      var before = Store.rewardProgress(memberId);
      var res = Store.toggleTask(memberId, el.dataset.task);
      if (!res) return;
      renderAfterTaskChange();
      if (!res.done) {
        if (Sound) Sound.playUncheck();
        return;
      }

      confetti();
      var after = Store.rewardProgress(memberId);
      var bookBonus = Books && Books.countOn ? Books.countOn(Store.todayISO()) > 0 : false;
      var codingTotal = (after.jaeneung.all ? 30 : 0) + (bookBonus ? 10 : 0);
      var codingText = codingTotal > 30 ? '노트북(엔트리코딩) 40분(책 +10분 포함)' : '노트북(엔트리코딩) 30분';
      var unlockedVideo = !before.workbook.all && after.workbook.all;
      var unlockedLaptop = !before.jaeneung.all && after.jaeneung.all;
      var todayList = Store.tasks(memberId, Store.todayISO());
      var allDoneToday = todayList.length > 0 && todayList.every(function (t) { return t.done; });
      if (unlockedVideo && unlockedLaptop) {
        toast('🎉 문제집·재능 모두 완료! 영상 30분 + ' + codingText + ' 해금!');
      } else if (unlockedVideo) {
        toast('🎉 문제집 완료! 영상 30분 보기 해금!');
      } else if (unlockedLaptop) {
        toast('🎉 재능 완료! ' + codingText + ' 해금!');
      } else if (allDoneToday) {
        toast('🎉 오늘 할 일 모두 완료! 정말 잘했어요');
      } else {
        toast('할 일 완료! 별 1개를 모았어요 ⭐️');
      }

      /* 보상 해금·올클리어·도장은 축하 소리, 그냥 체크는 짧은 소리 */
      if (Sound) {
        if (unlockedVideo || unlockedLaptop || allDoneToday || res.stamped) Sound.playSuccess();
        else Sound.playCheck();
      }

      var wk = Store.weekWorkbookDays(memberId);
      if (wk.full) setTimeout(function () { toast('🎮 5일 완주! 주말 닌텐도 4시간 30분!'); }, 3200);
    },

    'add-task': function (el) {
      openTaskSheet({ mode: 'add', memberId: el.dataset.member || state.members[0].id, repeat: 'once' });
    },

    'edit-task': function (el) {
      var memberId = el.dataset.member;
      var taskId = el.dataset.task;
      var task = Store.tasks(memberId).filter(function (t) { return t.id === taskId; })[0];
      if (!task) return;
      openTaskSheet({
        mode: 'edit',
        memberId: memberId,
        taskId: taskId,
        text: task.text,
        repeat: task.repeat || 'once'
      });
    },

    'delete-task': function (el) {
      var memberId = el.dataset.member;
      var taskId = el.dataset.task;
      var task = Store.tasks(memberId).filter(function (t) { return t.id === taskId; })[0];
      if (!task) return;
      Store.deleteTask(memberId, taskId);
      renderAfterTaskChange();
      toast('할 일을 지웠어요', {
        label: '되돌리기',
        onAction: function () {
          Store.addTask(memberId, task.text, task.repeat === 'once' ? 'once' : task.repeat);
          renderAfterTaskChange();
          toast('할 일을 되돌렸어요');
        }
      });
    },

    'task-member': function (el) {
      taskCtx.memberId = el.dataset.member;
      Array.prototype.forEach.call(byId('task-member-chips').children, function (b) {
        b.setAttribute('aria-pressed', b.dataset.member === taskCtx.memberId ? 'true' : 'false');
      });
    },

    'task-repeat': function (el) {
      taskCtx.repeat = el.dataset.repeat;
      Array.prototype.forEach.call(byId('task-repeat-chips').children, function (b) {
        b.setAttribute('aria-pressed', b.dataset.repeat === taskCtx.repeat ? 'true' : 'false');
      });
    },

    'task-save': function () {
      var text = byId('task-text').value.trim();
      if (!text) {
        toast('할 일 내용을 적어주세요 ✏️');
        byId('task-text').focus();
        return;
      }
      if (taskCtx.mode === 'edit') {
        Store.updateTask(taskCtx.memberId, taskCtx.taskId, { text: text, repeat: taskCtx.repeat });
        toast('할 일을 고쳤어요');
      } else {
        var added = Store.addTask(taskCtx.memberId, text, taskCtx.repeat);
        var who = Store.member(taskCtx.memberId);
        var whoName = who ? who.name : '가족';
        if (added && added.addedToday === false) {
          toast('평일(월~금)에 ' + whoName + ' 할 일로 나타나요');
        } else {
          toast(whoName + ' 할 일을 추가했어요');
        }
      }
      closeSheets();
      renderAfterTaskChange();
    },

    'task-delete': function () {
      if (taskCtx.mode !== 'edit') return;
      Store.deleteTask(taskCtx.memberId, taskCtx.taskId);
      closeSheets();
      renderAfterTaskChange();
      toast('할 일을 지웠어요');
    },

    'open-star': function (el) {
      openStarSheet(el.dataset.member);
    },

    'star-plus': function () {
      Store.addStar(starMember, 1);
      openStarSheet(starMember);
      renderMembers();
      if (Sound) Sound.playCheck();
      toast('⭐️ 별을 하나 더 모았어요');
      confetti();
    },

    'star-minus': function () {
      Store.addStar(starMember, -1);
      openStarSheet(starMember);
      renderMembers();
      toast('별을 하나 줄였어요');
    },

    'stamp-kid': function (el) {
      stampKid = el.dataset.kid;
      renderStamps();
      if (!byId('sheet-calendar').hidden) renderCalendar();
    },

    'stamp-day': function (el) {
      if (el.dataset.date > Store.todayISO()) {
        toast('아직 오지 않은 날이에요 😊');
        return;
      }
      var on = Store.toggleStamp(stampKid, el.dataset.date);
      renderStamps();
      if (on) {
        if (Sound) Sound.playSuccess();
        confetti();
        toast('도장을 찍었어요! 🎉');
      } else {
        if (Sound) Sound.playUncheck();
        toast('도장을 지웠어요');
      }
    },

    'open-calendar': function () {
      openCalendar();
    },

    'cal-prev': function () {
      calCursor.m--;
      if (calCursor.m < 0) { calCursor.m = 11; calCursor.y--; }
      renderCalendar();
    },

    'cal-next': function () {
      calCursor.m++;
      if (calCursor.m > 11) { calCursor.m = 0; calCursor.y++; }
      renderCalendar();
    },

    'cal-day': function (el) {
      var on = Store.toggleStamp(stampKid, el.dataset.date);
      renderCalendar();
      renderStamps();
      if (on) {
        if (Sound) Sound.playSuccess();
        toast('도장을 찍었어요! 🎉');
      } else {
        if (Sound) Sound.playUncheck();
        toast('도장을 지웠어요');
      }
    },

    'open-timetable': function () {
      renderTimetable();
      openSheet('sheet-timetable');
    },

    'tt-kid': function (el) {
      timetableKid = el.dataset.kid;
      renderTimetable();
    },

    'prep-school-toggle': function (el) {
      var res = Prep.toggleSchool(Store.todayISO(), el.dataset.item);
      renderPrep();
      refreshPrepTimers();
      if (res.done) {
        if (Sound) Sound.playSuccess();
        confetti();
        toast('등교 준비 완료! 잘 다녀와요 🎒');
      } else if (res.checked) {
        if (Sound) Sound.playCheck();
        toast('챙겼어요 ' + res.count + '/' + res.total + ' ✓');
      } else {
        if (Sound) Sound.playUncheck();
        toast('체크를 풀었어요');
      }
    },

    'prep-academy-toggle': function (el) {
      var res = Prep.toggleAcademy(Store.todayISO(), el.dataset.start, el.dataset.item);
      renderPrep();
      refreshPrepTimers();
      if (res.checked) {
        if (Sound) Sound.playCheck();
        confetti();
        toast('학원 준비 확인 완료 ✓');
      } else {
        if (Sound) Sound.playUncheck();
        toast('체크를 풀었어요');
      }
    },

    'prep-bed-toggle': function (el) {
      var res = Prep.toggleBed(Store.todayISO(), el.dataset.item);
      renderPrep();
      refreshPrepTimers();
      if (res.done) {
        if (Sound) Sound.playSuccess();
        confetti();
        toast('취침 준비 완료! 잘 자요 🌙');
      } else if (res.checked) {
        if (Sound) Sound.playCheck();
        toast(res.item === 'shower' ? '샤워 완료 ✓ 이제 잘 준비!' : '체크 완료 ✓');
      } else {
        if (Sound) Sound.playUncheck();
        toast('체크를 풀었어요');
      }
    },

    'toggle-lecture-more': function () {
      lectureExpanded = !lectureExpanded;
      renderLectures();
    },

    'add-lecture': function () {
      openLectureSheet({ mode: 'add' });
    },

    'edit-lecture': function (el) {
      var it = Lectures.get(el.dataset.id);
      if (!it) return;
      openLectureSheet({ mode: 'edit', item: it });
    },

    'toggle-lecture-kind': function () {
      var on = currentLectureKind();
      lectureCtx.manual = true;
      lectureCtx.lecture = !on;
      renderLectureKind();
    },

    'delete-lecture': function (el) {
      var it = Lectures.remove(el.dataset.id);
      if (!it) return;
      renderLectures();
      toast('일정을 지웠어요', {
        label: '되돌리기',
        onAction: function () {
          Lectures.restore(it);
          renderLectures();
          toast('일정을 되돌렸어요');
        }
      });
    },

    'lecture-save': function () {
      var date = byId('lecture-date').value;
      var title = byId('lecture-name').value.trim();
      if (!date) {
        toast('날짜를 골라 주세요 📅');
        return;
      }
      if (!title) {
        toast('일정 이름을 적어 주세요 ✏️');
        byId('lecture-name').focus();
        return;
      }
      var payload = {
        date: date,
        time: byId('lecture-time').value.trim(),
        title: title,
        note: byId('lecture-note').value.trim(),
        lecture: currentLectureKind()
      };
      if (lectureCtx.mode === 'edit') {
        Lectures.update(lectureCtx.id, payload);
        toast('일정을 고쳤어요');
      } else {
        Lectures.add(payload);
        toast('일정을 추가했어요');
      }
      closeSheets();
      renderLectures();
    },

    'lecture-delete': function () {
      if (lectureCtx.mode !== 'edit') return;
      Lectures.remove(lectureCtx.id);
      closeSheets();
      renderLectures();
      toast('일정을 지웠어요');
    },

    /* 💌 엄마·아빠 한마디 */
    'edit-note': function (el) {
      openNoteSheet(el.dataset.who || null);
    },

    'open-note-archive': function () {
      renderNoteArchive();
      openSheet('sheet-note-archive');
    },

    'edit-note-arch': function (el) {
      openNoteSheet(el.dataset.who || null, el.dataset.date, { fromArchive: true });
    },

    'delete-note-arch': function (el) {
      var who = el.dataset.who;
      var date = el.dataset.date;
      var before = (notesOn(date)[who] || {}).text || '';
      if (!before) return;
      Store.clearParentNote(who, date);
      renderNoteArchive();
      renderNotes();
      toast(noteAuthor(who).name + ' ' + archiveDayLabel(date) + ' 한마디를 지웠어요', {
        label: '되돌리기',
        onAction: function () {
          Store.setParentNote(who, before, date);
          renderNoteArchive();
          renderNotes();
          toast('한마디를 되돌렸어요');
        }
      });
    },

    'note-who': function (el) {
      var who = el.dataset.who;
      if (!who || who === noteCtx.who) return;
      noteSheetPick(who, true);
      byId('note-text').focus();
    },

    'note-save': function () {
      var who = noteCtx.who;
      var whoName = noteAuthor(who).name;
      var date = noteCtx.date || Store.todayISO();
      var backToArchive = noteCtx.fromArchive;
      var text = byId('note-text').value.trim();
      if (!text) {
        toast('한마디를 적어 주세요 ✏️');
        byId('note-text').focus();
        return;
      }
      Store.setParentNote(who, text, date);
      closeSheets();
      renderNotes();
      if (backToArchive) { renderNoteArchive(); openSheet('sheet-note-archive'); }
      renderNoteArchiveBtn();
      if (Sound) Sound.playCheck();
      toast(date === Store.todayISO()
        ? '💌 ' + whoName + ' 한마디를 남겼어요'
        : '💌 ' + archiveDayLabel(date) + ' ' + whoName + ' 한마디를 고쳤어요');
    },

    'note-delete': function () {
      var who = noteCtx.who;
      var whoName = noteAuthor(who).name;
      var date = noteCtx.date || Store.todayISO();
      var before = (notesOn(date)[who] || {}).text || '';
      if (!before) return;
      Store.clearParentNote(who, date);
      closeSheets();
      renderNotes();
      renderNoteArchiveBtn();
      toast(whoName + ' 한마디를 지웠어요', {
        label: '되돌리기',
        onAction: function () {
          Store.setParentNote(who, before, date);
          renderNotes();
          renderNoteArchiveBtn();
          toast('한마디를 되돌렸어요');
        }
      });
    },

    'add-book': function () {
      openBookSheet({ mode: 'add' });
    },
    'edit-book': function (el) {
      var b = Books.get(el.dataset.id);
      if (!b) return;
      openBookSheet({ mode: 'edit', item: b, fromArchive: el.dataset.arch === '1' });
    },

    'open-book-archive': function () {
      renderBookArchive();
      openSheet('sheet-book-archive');
    },

    'delete-book': function (el) {
      var b = Books.remove(el.dataset.id);
      if (!b) return;
      renderBooks();
      renderRewards();
      if (!byId('sheet-book-archive').hidden) renderBookArchive();
      toast('독서 기록을 지웠어요', {
        label: '되돌리기',
        onAction: function () {
          Books.restore(b);
          renderBooks();
          renderRewards();
          if (!byId('sheet-book-archive').hidden) renderBookArchive();
          toast('기록을 되돌렸어요');
        }
      });
    },

    'book-save': function () {
      var title = byId('book-title').value.trim();
      if (!title) {
        toast('책 제목을 적어 주세요 📖');
        byId('book-title').focus();
        return;
      }
      var payload = {
        date: byId('book-date').value || Store.todayISO(),
        title: title,
        review: byId('book-review').value.trim()
      };
      var todayISO = Store.todayISO();
      var before = Books.countOn(todayISO);
      var wasEdit = bookCtx.mode === 'edit';
      var backToArchive = wasEdit && bookCtx.fromArchive;
      if (wasEdit) {
        Books.update(bookCtx.id, payload);
      } else {
        Books.add(payload);
      }
      closeSheets();
      renderBooks();
      renderRewards();
      if (backToArchive || (!byId('sheet-book-archive').hidden)) { renderBookArchive(); }
      if (backToArchive) openSheet('sheet-book-archive');
      var after = Books.countOn(todayISO);
      if (payload.date === todayISO && after > before) {
        if (Sound) Sound.playSuccess();
        toast('📚 오늘 기록 완료! 엔트리코딩 +10분 & 냥코 20분이 열렸어요');
        confetti();
      } else if (wasEdit) {
        toast('독서 기록을 고쳤어요');
      } else {
        if (Sound) Sound.playCheck();
        toast('독서 기록을 남겼어요 📚');
        confetti();
      }
    },

    'book-delete': function () {
      if (bookCtx.mode !== 'edit') return;
      var backToArchive = bookCtx.fromArchive;
      Books.remove(bookCtx.id);
      closeSheets();
      renderBooks();
      renderRewards();
      if (backToArchive) { renderBookArchive(); openSheet('sheet-book-archive'); }
      toast('독서 기록을 지웠어요');
    },

    'pick-city': function (el) {
      applyPlace({ name: el.dataset.name, lat: el.dataset.lat, lon: el.dataset.lon });
    },

    'pick-result': function (el) {
      applyPlace({ name: el.dataset.name, lat: el.dataset.lat, lon: el.dataset.lon });
      byId('city-results').innerHTML = '';
      byId('city-search').value = '';
    },

    'close': function () {
      closeSheets();
    },

    'lock-now': function () {
      closeSheets();
      if (window.FamilyLock) window.FamilyLock.lock();
    },

    'reset': function () {
      if (!window.confirm('모든 기록을 지울까요?\n할 일, 별, 도장, 준비 체크, 독서 기록, 엄마·아빠 한마디가 모두 사라지고 엄마 일정은 처음 기본 일정으로 들어가요. 되돌릴 수 없어요.')) return;
      if (Prep && Prep.clear) Prep.clear();
      if (Books && Books.clear) Books.clear();
      if (Lectures && Lectures.clear) Lectures.clear();
      lectureExpanded = false;
      Store.reset();
      closeSheets();
      renderAll();
      loadWeather(true);
      toast('기록을 모두 지웠어요');
    }
  };

  function applyPlace(place) {
    if (!place || !place.name) return;
    Store.setPlace(place);
    renderSettings();
    loadWeather(true);
    toast(place.name + ' 날씨로 바뀌었어요');
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (el) {
      var fn = actions[el.dataset.action];
      if (fn) {
        e.preventDefault();
        fn(el, e);
        return;
      }
    }
    var closer = e.target.closest('[data-close]');
    if (closer) {
      closeSheets();
      return;
    }
    if (e.target === byId('sheet-backdrop')) closeSheets();
  });

  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-member-field]');
    if (!input) return;
    var changes = {};
    changes[input.dataset.memberField] = input.value;
    Store.setMember(input.dataset.member, changes);
    renderMembers();
    renderTodos();
    renderRewards();
    renderStamps();
    renderSchedule();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !byId('sheet-backdrop').hidden) closeSheets();
    if (e.key === 'Enter' && !byId('sheet-task').hidden && e.target === byId('task-text')) {
      e.preventDefault();
      actions['task-save']();
    }
  });

  byId('btn-city-search').addEventListener('click', function () {
    var q = byId('city-search').value.trim();
    var box = byId('city-results');
    if (!q) return;
    box.innerHTML = '<p class="field-hint">찾는 중…</p>';
    Weather.search(q).then(function (list) {
      if (!list.length) {
        box.innerHTML = '<p class="field-hint">그 이름의 동네를 찾지 못했어요. 다른 이름으로 해보세요.</p>';
        return;
      }
      box.innerHTML = list.map(function (r) {
        return '<button class="search-result" data-action="pick-result" data-name="' + esc(r.name) + '" ' +
          'data-lat="' + r.lat + '" data-lon="' + r.lon + '"><b>' + esc(r.name) + '</b>' +
          (r.region ? '<span>' + esc(r.region) + '</span>' : '') + '</button>';
      }).join('');
    }).catch(function () {
      box.innerHTML = '<p class="field-hint">검색이 잠시 안 되네요. 목록에서 골라주세요.</p>';
    });
  });

  byId('city-search').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      byId('btn-city-search').click();
    }
  });

  byId('weather-card').addEventListener('click', function () {
    loadWeather(true);
    toast('날씨를 새로 확인했어요');
  });

  /* 한마디 글자 수 */
  var noteTextInput = byId('note-text');
  if (noteTextInput) noteTextInput.addEventListener('input', renderNoteCount);

  /* ---------------- 시작 ---------------- */
  function tick() {
    if (!state) return;
    var t = Store.todayISO();
    if (t !== lastToday) {
      renderAll();
      loadWeather(false);
    } else {
      renderSchedule();
      refreshPrepTimers();
    }
  }

  function start() {
    Store.init().then(function () {
      state = Store.get();
      renderAll();
      applyTab('today', true);
      loadWeather(false);
      Store.listenRemote();
      // 다른 기기에서 기록이 바뀌면 다시 그립니다 (시트가 열려 있을 땐 잠시 미룸)
      Store.subscribe(function () {
        if (!byId('sheet-backdrop').hidden) return;
        var tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        renderAll();
      });
      setInterval(tick, 30000);
      setInterval(refreshPrepTimers, 15000);
      weatherTimer = setInterval(function () { loadWeather(false); }, 20 * 60 * 1000);
    });

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 캐시는 없어도 괜찮아요 */ });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
