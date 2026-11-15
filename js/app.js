/* 우리 가족 기록장 — 화면 동작
   데이터는 모두 FamilyStore 를 통해서만 읽고 씁니다. */
(function () {
  'use strict';

  var Store = window.FamilyStore;
  var Chars = window.FamilyChars;
  var Sched = window.FamilySchedule;
  var Weather = window.FamilyWeather;

  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  var TINTS = { jjini: '', naeun: 'pink' };
  var SHEETS = ['sheet-settings', 'sheet-calendar', 'sheet-timetable', 'sheet-task', 'sheet-star'];

  var state = null;
  var weather = null;
  var weatherFailed = false;
  var stampKid = 'jjini';
  var timetableKid = 'naeun';
  var calCursor = null;
  var starMember = 'jjini';
  var taskCtx = { mode: 'add', memberId: 'jjini', taskId: null, repeat: 'once' };
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

  /* ---------------- 헤더 ---------------- */
  function renderHeader() {
    var d = Store.now();
    byId('brand-mark').innerHTML = Chars.svg('hamster');
    byId('header-date').textContent = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + DAYS[d.getDay()] + '요일';
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
    if (now < 8 * 60) return { text: '일정 시작 전', now: false };
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

    var rows = ['naeun', 'jjini'].map(scheduleRow).join('');
    byId('schedule-sub').textContent = '오늘 하루 두 아이의 시간표예요';
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

    return '<li class="task' + (t.done ? ' is-done' : '') + '">' +
      '<button class="task-check" data-action="toggle-task" data-member="' + m.id + '" data-task="' + t.id + '" ' +
        'role="checkbox" aria-checked="' + (t.done ? 'true' : 'false') + '" aria-label="' + esc(t.text) + '">✓</button>' +
      '<span class="task-text">' + esc(t.text) + '</span>' + tag +
      '<span class="task-actions">' +
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

    byId('todo-sub').textContent = '가족이 각자 할 일을 체크해요';
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
    var rows = [
      { icon: '📺', name: '영상 30분 보기', g: prog.workbook, unit: '문제집' },
      { icon: '💻', name: '노트북(엔트리코딩) 30분', g: prog.jaeneung, unit: '재능학습지' }
    ];

    byId('reward-list').innerHTML = rows.map(function (row) {
      var g = row.g;
      var unlocked = !!g.all;
      var stateText;
      var cond;
      if (g.total === 0) {
        stateText = '쉬는 날';
        cond = '오늘은 ' + row.unit + ' 없는 날이에요';
      } else if (unlocked) {
        stateText = '해금! 🎉';
        cond = row.unit + ' ' + g.total + '개 모두 완료!';
      } else {
        stateText = '잠금';
        cond = row.unit + ' ' + g.done + '/' + g.total + ' 완료';
      }
      var pips = g.total
        ? '<span class="reward-pips">' + g.items.map(function (t) {
            return '<i class="' + (t.done ? 'on' : '') + '"></i>';
          }).join('') + '</span>'
        : '';

      return '<div class="reward-row' + (unlocked ? ' is-unlocked' : '') + '">' +
        '<span class="reward-icon">' + row.icon + '</span>' +
        '<div class="reward-info">' +
          '<p class="reward-name">' + row.name + '</p>' +
          '<p class="reward-cond">' + cond + pips + '</p>' +
        '</div>' +
        '<span class="reward-state">' + stateText + '</span>' +
      '</div>';
    }).join('');

    var wk = Store.weekWorkbookDays(kid.id, today);
    var dots = wk.days.map(function (day, i) {
      return '<div class="week-dot' + (day.complete ? ' on' : '') + (day.date === today ? ' today' : '') + '">' +
        '<span></span><em>' + DAYS[i + 1] + '</em></div>';
    }).join('');
    var pct = Math.round((wk.count / wk.total) * 100);

    var week = byId('reward-week');
    week.className = 'reward-week' + (wk.full ? ' is-full' : '');
    week.innerHTML =
      '<div class="reward-week-head"><span>주5일 문제집 완주</span><b>' + wk.count + '/' + wk.total + '일</b></div>' +
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

  /* ---------------- 미션 ---------------- */
  function renderMission() {
    var mission = Store.mission();
    byId('mission-emoji').textContent = mission.emoji;
    byId('mission-text').textContent = mission.text;
    byId('mission-count').textContent = '함께 ' + mission.together + '번';
    byId('btn-mission-done').textContent = mission.doneToday ? '✅ 오늘 함께했어요' : '✅ 다 같이 했어요';
    byId('mission-note').textContent = mission.doneToday
      ? '오늘 미션 완료! 내일 또 새로운 미션이 찾아와요 😊'
      : '가족이 다 함께 하는 미션이에요. 하루에 한 번 가볍게 해봐요!';
  }

  /* ---------------- 설정 ---------------- */
  function renderSettings() {
    byId('city-current').textContent = state.settings.place.name;

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
    byId('timetable-tabs').innerHTML = kidList.map(function (k) {
      var active = k.id === timetableKid;
      return '<button class="stamp-tab' + (active ? ' is-active' : '') + '" data-action="tt-kid" data-kid="' + k.id + '">' +
        '<span class="tab-avatar">' + Chars.svg(k.char) + '</span>' + esc(k.name) + '</button>';
    }).join('');

    var kid = Sched.kids[timetableKid] || Sched.kids.naeun;
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
    renderMission();
  }

  function renderAfterTaskChange() {
    renderMembers();
    renderTodos();
    renderRewards();
    renderStamps();
  }

  /* ---------------- 동작 ---------------- */
  var actions = {

    'open-settings': function () {
      renderSettings();
      openSheet('sheet-settings');
    },

    'share': function () {
      var payload = {
        title: '우리 가족 기록장',
        text: '우리 가족 기록장 — 오늘도 함께 기록해요 ✨',
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
      if (!res.done) return;

      confetti();
      var after = Store.rewardProgress(memberId);
      var unlockedVideo = !before.workbook.all && after.workbook.all;
      var unlockedLaptop = !before.jaeneung.all && after.jaeneung.all;
      if (unlockedVideo && unlockedLaptop) {
        toast('🎉 문제집·재능 모두 완료! 영상 30분 + 노트북 30분 해금!');
      } else if (unlockedVideo) {
        toast('🎉 문제집 완료! 영상 30분 보기 해금!');
      } else if (unlockedLaptop) {
        toast('🎉 재능 완료! 노트북(엔트리코딩) 30분 해금!');
      } else {
        toast('할 일 완료! 별 1개를 모았어요 ⭐️');
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
        confetti();
        toast('도장을 찍었어요! 🎉');
      } else {
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
      if (on) toast('도장을 찍었어요! 🎉');
      else toast('도장을 지웠어요');
    },

    'open-timetable': function () {
      renderTimetable();
      openSheet('sheet-timetable');
    },

    'tt-kid': function (el) {
      timetableKid = el.dataset.kid;
      renderTimetable();
    },

    'mission-done': function () {
      var res = Store.completeMission();
      renderMission();
      if (res.ok) {
        confetti();
        toast('오늘의 미션 완료! 함께 ' + res.together + '번째 🎉');
      } else {
        toast('오늘은 이미 함께했어요. 내일 또 만나요 😊');
      }
    },

    'mission-shuffle': function () {
      var m = Store.shuffleMission();
      renderMission();
      toast(m.emoji + ' 새로운 미션이에요!');
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

    'reset': function () {
      if (!window.confirm('모든 기록을 지울까요?\n할 일, 별, 도장, 미션 기록이 모두 사라지고 되돌릴 수 없어요.')) return;
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

  /* ---------------- 시작 ---------------- */
  function tick() {
    if (!state) return;
    var t = Store.todayISO();
    if (t !== lastToday) {
      renderAll();
      loadWeather(false);
    } else {
      renderSchedule();
    }
  }

  function start() {
    Store.init().then(function () {
      state = Store.get();
      renderAll();
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
