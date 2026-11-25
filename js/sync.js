/* 찌니 대시보드 — 무료 실시간 동기화 (Supabase)
   ------------------------------------------------------------------
   폰과 태블릿이 같은 기록을 함께 봅니다. Supabase 의 public.jjini_sync
   표에 id = 1 한 줄로 전체 상태를 담아 둡니다.

   · 앱을 열 때 : 서버 기록과 이 기기 기록 중 더 새로운 쪽을 씁니다.
   · 바꿀 때    : 0.3초 쉬었다가(디바운스) updatedAt·deviceId 를 붙여 올립니다.
   · 다른 기기  : Realtime 구독으로 바로, 안 되면 10초마다 확인해서 받아 옵니다.
   · 내가 방금 올린 기록은 되돌아와도 무시해 화면이 깜빡이지 않습니다.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var BASE = 'https://gaqsgvdjbmgfghrttrzf.supabase.co';
  var API_KEY = 'sb_publishable_KS3QMiC54JEt0Z5XhM4i6Q_hivc84M5';
  var TABLE = 'jjini_sync';
  var ROW_ID = 1;

  var META_KEY = 'jjini.sync.v1';        /* { updatedAt, deviceId } */
  var DEVICE_KEY = 'jjini.sync.device';

  /* 함께 맞추는 기록들 */
  var KEYS = {
    store: 'uri-family-dashboard.v3',
    prep: 'jjini.prep.v1',
    books: 'jjini.books.v1',
    lectures: 'jjini.lectures.v1'
  };

  var PUSH_DELAY = 300;      /* 로컬 변경 → 올리기까지 */
  var POLL_MS = 10000;       /* 안전망 확인 주기 */
  var WS_RETRY_MAX = 30000;

  var ready = false;         /* 첫 동기화가 끝났는지 */
  var applying = false;      /* 서버 기록을 쓰는 중 (다시 올리지 않도록) */
  var pushTimer = null;
  var fetchTimer = null;
  var pollTimer = null;
  var ws = null;
  var wsRef = 0;
  var wsRetry = 2000;
  var wsTimer = null;
  var heartbeatTimer = null;
  var statusEl = null;
  var statusTextEl = null;
  var status = 'idle';

  /* ---------------- 작은 도우미 ---------------- */
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 용량 초과 등 */ }
  }

  function meta() {
    var m = readJSON(META_KEY, null);
    return (m && typeof m === 'object') ? m : {};
  }

  function setMeta(next) {
    writeJSON(META_KEY, next || {});
  }

  function deviceId() {
    var id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) { id = null; }
    if (!id) {
      id = 'dev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (e) { /* noop */ }
    }
    return id;
  }

  function headers(extra) {
    var h = {
      'apikey': API_KEY,
      'Authorization': 'Bearer ' + API_KEY,
      'Accept': 'application/json'
    };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  /* ---------------- 화면 표시 ---------------- */
  var LABEL = {
    idle: '동기화 준비 중',
    syncing: '동기화 중…',
    ok: '동기화됨',
    error: '연결 안 됨 · 다시 시도할게요'
  };

  function setStatus(next) {
    status = next;
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.setAttribute('data-status', next);
    if (statusTextEl) statusTextEl.textContent = LABEL[next] || LABEL.idle;
  }

  /* ---------------- 올리기 / 내려받기 ---------------- */
  function snapshot() {
    var store = null;
    if (window.FamilyStore && typeof window.FamilyStore.get === 'function') {
      store = window.FamilyStore.get();
    }
    if (!store) store = readJSON(KEYS.store, null);
    return {
      updatedAt: Date.now(),
      deviceId: deviceId(),
      store: store,
      prep: readJSON(KEYS.prep, null),
      books: readJSON(KEYS.books, null),
      lectures: readJSON(KEYS.lectures, null)
    };
  }

  function fetchRemote() {
    var url = BASE + '/rest/v1/' + TABLE + '?id=eq.' + ROW_ID + '&select=payload';
    return fetch(url, { headers: headers(), cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(function (rows) {
      var row = Array.isArray(rows) ? rows[0] : rows;
      return (row && row.payload) || null;
    });
  }

  function push() {
    var payload = snapshot();
    /* 올린 시각을 이 기기에도 적어 둡니다 (내 기록이 돌아올 때 무시하려고) */
    setMeta({ updatedAt: payload.updatedAt, deviceId: payload.deviceId });
    setStatus('syncing');
    return fetch(BASE + '/rest/v1/' + TABLE, {
      method: 'POST',
      headers: headers({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify([{ id: ROW_ID, payload: payload }])
    }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      setStatus('ok');
      return true;
    }).catch(function () {
      setStatus('error');
      return false;
    });
  }

  function applyRemote(payload) {
    if (!payload || typeof payload !== 'object') return false;
    applying = true;
    try {
      if (payload.prep != null) writeJSON(KEYS.prep, payload.prep);
      if (payload.books != null) writeJSON(KEYS.books, payload.books);
      if (payload.lectures != null) writeJSON(KEYS.lectures, payload.lectures);
      if (payload.store) {
        if (window.FamilyStore && typeof window.FamilyStore.applyRemote === 'function') {
          window.FamilyStore.applyRemote(payload.store);
        } else {
          writeJSON(KEYS.store, payload.store);
        }
      }
    } catch (e) {
      /* 한 부분이 깨져도 나머지는 반영합니다 */
    } finally {
      applying = false;
    }
    setMeta({ updatedAt: Number(payload.updatedAt) || Date.now(), deviceId: payload.deviceId || '' });
    return true;
  }

  /* 한 번 맞추기 — 서버 기록과 이 기기 기록 중 새것을 씁니다 */
  function syncOnce(initial) {
    setStatus('syncing');
    return fetchRemote().then(function (remote) {
      var mine = meta();
      var localAt = Number(mine.updatedAt) || 0;

      /* 서버에 아직 기록이 없으면(처음 한 번) 이 기기 기록을 올립니다 */
      if (!remote || !remote.updatedAt) {
        ready = true;
        return push();
      }

      var remoteAt = Number(remote.updatedAt) || 0;

      /* 방금 내가 올린 기록이면 그대로 둡니다 */
      if (remote.deviceId && remote.deviceId === deviceId() && remoteAt <= localAt) {
        ready = true;
        setStatus('ok');
        return true;
      }

      if (remoteAt > localAt) {
        applyRemote(remote);
        ready = true;
        setStatus('ok');
        return true;
      }

      if (localAt > remoteAt) {
        ready = true;
        return push();
      }

      ready = true;
      setStatus('ok');
      return true;
    }).catch(function () {
      setStatus('error');
      if (initial) ready = true;
      return false;
    });
  }

  function scheduleFetch(delay) {
    if (fetchTimer) return;
    fetchTimer = setTimeout(function () {
      fetchTimer = null;
      syncOnce(false);
    }, delay || 300);
  }

  /* ---------------- 실시간 (WebSocket) ---------------- */
  function wsSend(msg) {
    if (!ws || ws.readyState !== 1) return;
    try { ws.send(JSON.stringify(msg)); } catch (e) { /* noop */ }
  }

  function stopRealtime() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (ws) {
      try { ws.onclose = null; ws.close(); } catch (e) { /* noop */ }
      ws = null;
    }
  }

  function scheduleReconnect() {
    if (wsTimer) return;
    wsTimer = setTimeout(function () {
      wsTimer = null;
      connectRealtime();
    }, wsRetry);
    wsRetry = Math.min(WS_RETRY_MAX, wsRetry * 2);
  }

  function connectRealtime() {
    if (!('WebSocket' in window)) return;
    if (document.hidden) return;           /* 화면이 꺼져 있으면 10초 확인에 맡깁니다 */
    stopRealtime();

    var url = BASE.replace('https://', 'wss://') +
      '/realtime/v1/websocket?apikey=' + encodeURIComponent(API_KEY) + '&vsn=1.0.0';
    try { ws = new WebSocket(url); } catch (e) { scheduleReconnect(); return; }

    ws.onopen = function () {
      wsRetry = 2000;
      wsSend({
        topic: 'realtime:public:' + TABLE,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { self: false },
            presence: { key: '' },
            postgres_changes: [{ event: '*', schema: 'public', table: TABLE }]
          }
        },
        ref: String(++wsRef)
      });
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(function () {
        wsSend({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++wsRef) });
      }, 25000);
    };

    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || !msg.event) return;
      if (msg.event === 'postgres_changes') {
        var rec = msg.payload && (msg.payload.record || msg.payload.new);
        if (rec && rec.id != null && Number(rec.id) !== ROW_ID) return;
        scheduleFetch(250);     /* 값은 REST 로 다시 읽어 정확히 맞춥니다 */
      }
    };

    ws.onclose = function () {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = function () {
      try { if (ws) ws.close(); } catch (e) { /* noop */ }
    };
  }

  /* ---------------- 안전망 (10초 확인) ---------------- */
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      if (document.hidden) return;
      syncOnce(false);
    }, POLL_MS);
  }

  /* ---------------- 로컬 변경 알림 ---------------- */
  function touch() {
    if (applying) return;
    var m = meta();
    m.updatedAt = Date.now();
    m.deviceId = deviceId();
    setMeta(m);
    if (!ready) return;                 /* 첫 동기화 전에는 건너뜁니다 */
    setStatus('syncing');
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      push();
    }, PUSH_DELAY);
  }

  /* ---------------- 시작 ---------------- */
  function init() {
    statusEl = document.getElementById('sync-status');
    statusTextEl = document.getElementById('sync-status-text');
    setStatus('syncing');
    deviceId();

    syncOnce(true).then(function () {
      ready = true;
      connectRealtime();
      startPolling();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopRealtime();
      } else {
        syncOnce(false);
        connectRealtime();
      }
    });

    window.addEventListener('focus', function () { syncOnce(false); });
    window.addEventListener('online', function () {
      syncOnce(false);
      connectRealtime();
    });
    window.addEventListener('offline', function () { setStatus('error'); });
    window.addEventListener('pagehide', function () { stopRealtime(); });
  }

  window.FamilySync = {
    init: init,
    touch: touch,
    syncNow: function () { return syncOnce(false); },
    pushNow: push,
    deviceId: deviceId,
    status: function () { return status; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 저장소가 준비된 다음에 시작합니다 (앱이 기기 기록을 먼저 읽어요) */
  function boot() {
    var tries = 0;
    (function waitStore() {
      var readyStore = window.FamilyStore && typeof window.FamilyStore.get === 'function' && window.FamilyStore.get();
      if (readyStore || tries >= 40) { init(); return; }
      tries++;
      setTimeout(waitStore, 100);
    })();
  }
})();
