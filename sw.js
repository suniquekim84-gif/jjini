/* 찌니 대시보드 — 오프라인 캐시 (서비스 워커)
   홈 화면에 추가한 뒤 인터넷이 잠깐 끊겨도 열리도록 정적 파일만 저장합니다.
   날씨 API 응답은 캐시하지 않습니다. */
var CACHE = 'family-dashboard-v20';

var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/characters.js',
  './js/schedule.js',
  './js/prep.js',
  './js/lectures.js',
  './js/books.js',
  './js/store.js',
  './js/lock.js',
  './js/weather.js',
  './js/app.js',
  './assets/fonts/NanumSquareRound.woff2',
  './assets/fonts/NanumSquareRoundB.woff',
  './assets/fonts/NanumSquareRoundEB.woff',
  './assets/fonts/GmarketSansBold.woff',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // 브라우저 HTTP 캐시에 남은 옛 파일을 받지 않도록 버전 쿼리를 붙여 새로 받습니다.
      var fresh = ASSETS.map(function (p) { return p + (p.indexOf('?') === -1 ? '?' : '&') + 'v=' + CACHE; });
      return cache.addAll(fresh).catch(function () { /* 일부 파일이 없어도 설치는 계속 */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 날씨 API 등은 그대로 네트워크로

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (req.mode === 'navigate') return caches.match('./index.html', { ignoreSearch: true });
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
