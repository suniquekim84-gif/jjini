/* 우리 가족 기록장 — 날씨 & 미세먼지
   Open-Meteo (무료, API 키 없음) 를 씁니다.
   · 예보  https://api.open-meteo.com/v1/forecast
   · 대기  https://air-quality-api.open-meteo.com/v1/air-quality
   · 동네검색 https://geocoding-api.open-meteo.com/v1/search
   인터넷이 없거나 잠시 실패하면 마지막으로 받아둔 값을 보여줍니다. */
(function () {
  'use strict';

  var CACHE_KEY = 'uri-family-dashboard.weather.v1';
  var MAX_AGE = 30 * 60 * 1000;

  var PRESETS = [
    { name: '동탄2신도시', lat: 37.2001, lon: 127.0990 },
    { name: '서울', lat: 37.5665, lon: 126.9780 },
    { name: '인천', lat: 37.4563, lon: 126.7052 },
    { name: '수원', lat: 37.2636, lon: 127.0286 },
    { name: '부천', lat: 37.5034, lon: 126.7660 },
    { name: '안양', lat: 37.3943, lon: 126.9568 },
    { name: '성남', lat: 37.4200, lon: 127.1267 },
    { name: '고양', lat: 37.6584, lon: 126.8320 },
    { name: '용인', lat: 37.2411, lon: 127.1776 },
    { name: '대전', lat: 36.3504, lon: 127.3845 },
    { name: '청주', lat: 36.6424, lon: 127.4890 },
    { name: '전주', lat: 35.8242, lon: 127.1480 },
    { name: '광주', lat: 35.1595, lon: 126.8526 },
    { name: '대구', lat: 35.8714, lon: 128.6014 },
    { name: '울산', lat: 35.5384, lon: 129.3114 },
    { name: '부산', lat: 35.1796, lon: 129.0756 },
    { name: '창원', lat: 35.2279, lon: 128.6817 },
    { name: '제주', lat: 33.4996, lon: 126.5312 }
  ];

  /* WMO 날씨 코드 → 이모지 + 우리말 */
  var SKY = {
    0: { icon: '☀️', text: '맑음' },
    1: { icon: '🌤️', text: '대체로 맑음' },
    2: { icon: '⛅', text: '구름 조금' },
    3: { icon: '☁️', text: '흐림' },
    45: { icon: '🌫️', text: '안개' },
    48: { icon: '🌫️', text: '안개' },
    51: { icon: '🌦️', text: '이슬비' },
    53: { icon: '🌦️', text: '이슬비' },
    55: { icon: '🌦️', text: '이슬비' },
    56: { icon: '🌧️', text: '언 진눈깨비' },
    57: { icon: '🌧️', text: '언 진눈깨비' },
    61: { icon: '🌧️', text: '비' },
    63: { icon: '🌧️', text: '비' },
    65: { icon: '🌧️', text: '강한 비' },
    66: { icon: '🌧️', text: '언 비' },
    67: { icon: '🌧️', text: '언 비' },
    71: { icon: '🌨️', text: '눈' },
    73: { icon: '🌨️', text: '눈' },
    75: { icon: '❄️', text: '많은 눈' },
    77: { icon: '🌨️', text: '싸락눈' },
    80: { icon: '🌦️', text: '소나기' },
    81: { icon: '🌦️', text: '소나기' },
    82: { icon: '⛈️', text: '강한 소나기' },
    85: { icon: '🌨️', text: '소나기 눈' },
    86: { icon: '❄️', text: '소나기 눈' },
    95: { icon: '⛈️', text: '천둥번개' },
    96: { icon: '⛈️', text: '천둥번개' },
    99: { icon: '⛈️', text: '천둥번개' }
  };

  /* 환경부 기준 */
  var PM10 = [
    { max: 30, label: '좋음', level: 0 },
    { max: 80, label: '보통', level: 1 },
    { max: 150, label: '나쁨', level: 2 },
    { max: Infinity, label: '매우나쁨', level: 3 }
  ];
  var PM25 = [
    { max: 15, label: '좋음', level: 0 },
    { max: 35, label: '보통', level: 1 },
    { max: 75, label: '나쁨', level: 2 },
    { max: Infinity, label: '매우나쁨', level: 3 }
  ];

  function grade(table, value) {
    if (value == null || isNaN(value)) return null;
    for (var i = 0; i < table.length; i++) if (value <= table[i].max) return table[i];
    return table[table.length - 1];
  }

  function sky(code) {
    return SKY[code] || { icon: '🌤️', text: '맑음' };
  }

  function round(n) { return Math.round(Number(n)); }

  function cacheGet(key) {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || obj.key !== key) return null;
      return obj;
    } catch (e) { return null; }
  }

  function cacheSet(key, data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ key: key, at: Date.now(), data: data }));
    } catch (e) { /* noop */ }
  }

  function placeKey(place) { return place.lat.toFixed(3) + ',' + place.lon.toFixed(3); }

  function fetchJson(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var controller = null;
      var timer = null;
      var opts = { headers: { Accept: 'application/json' } };
      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        opts.signal = controller.signal;
      }
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error('timeout'));
      }, timeoutMs || 8000);
      fetch(url, opts)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (json) { clearTimeout(timer); resolve(json); })
        .catch(function (err) { clearTimeout(timer); reject(err); });
    });
  }

  function get(place, opts) {
    var key = placeKey(place);
    var cached = cacheGet(key);
    var force = opts && opts.force;
    if (cached && !force && Date.now() - cached.at < MAX_AGE) {
      return Promise.resolve(Object.assign({ cached: true, error: null }, cached.data));
    }
    var forecastUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat +
      '&longitude=' + place.lon +
      '&current=temperature_2m,apparent_temperature,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&timezone=Asia%2FSeoul&forecast_days=1';
    var airUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + place.lat +
      '&longitude=' + place.lon + '&current=pm10,pm2_5&timezone=Asia%2FSeoul';

    return Promise.allSettled([fetchJson(forecastUrl), fetchJson(airUrl)]).then(function (results) {
      var forecast = results[0].status === 'fulfilled' ? results[0].value : null;
      var air = results[1].status === 'fulfilled' ? results[1].value : null;

      if (!forecast && cached) {
        return Object.assign({ cached: true, error: 'fetch-failed' }, cached.data);
      }
      if (!forecast) {
        return Promise.reject(new Error('weather unavailable'));
      }

      var cur = forecast.current || {};
      var daily = forecast.daily || {};
      var code = cur.weather_code != null ? cur.weather_code : (daily.weather_code || [])[0];
      var s = sky(code);
      var pm10 = air && air.current ? air.current.pm10 : null;
      var pm25 = air && air.current ? air.current.pm2_5 : null;
      var g10 = grade(PM10, pm10);
      var g25 = grade(PM25, pm25);
      var dustLevel = Math.max(g10 ? g10.level : -1, g25 ? g25.level : -1);

      var data = {
        temp: round(cur.temperature_2m != null ? cur.temperature_2m : (daily.temperature_2m_max || [])[0]),
        feels: cur.apparent_temperature != null ? round(cur.apparent_temperature) : null,
        code: code,
        icon: s.icon,
        cond: s.text,
        min: round((daily.temperature_2m_min || [])[0]),
        max: round((daily.temperature_2m_max || [])[0]),
        pm10: pm10 != null ? Math.round(pm10) : null,
        pm25: pm25 != null ? Math.round(pm25) : null,
        pm10Label: g10 ? g10.label : null,
        pm25Label: g25 ? g25.label : null,
        pm10Level: g10 ? g10.level : null,
        pm25Level: g25 ? g25.level : null,
        dustLevel: dustLevel,
        airOk: !!air,
        at: Date.now()
      };
      cacheSet(key, data);
      return Object.assign({ cached: false, error: null }, data);
    });
  }

  /** 마스크·우산처럼 오늘 챙길 것을 한 줄로 */
  function tip(data) {
    if (!data) return { emoji: '🌿', text: '오늘 공기 확인 중', tone: 'calm' };
    var dust = data.dustLevel;
    if (dust >= 3) return { emoji: '😷', text: '마스크 꼭 챙겨요', tone: 'bad' };
    if (/비|소나기|천둥|눈/.test(data.cond || '')) return { emoji: '☂️', text: '우산 챙겨요', tone: 'rain' };
    if (dust === 2) return { emoji: '😷', text: '마스크 챙겨요', tone: 'warn' };
    if (data.temp != null && data.temp <= 0) return { emoji: '🧣', text: '따뜻하게 입어요', tone: 'cold' };
    if (data.temp != null && data.temp >= 28) return { emoji: '💧', text: '물 자주 마셔요', tone: 'hot' };
    return { emoji: '🌿', text: '산책하기 좋은 날!', tone: 'good' };
  }

  function search(query) {
    var q = String(query || '').trim();
    if (!q) return Promise.resolve([]);
    var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) +
      '&count=6&language=ko&format=json';
    return fetchJson(url, 7000).then(function (json) {
      return (json.results || []).map(function (r) {
        return {
          name: r.name,
          region: r.admin1 || r.country || '',
          lat: r.latitude,
          lon: r.longitude
        };
      });
    });
  }

  window.FamilyWeather = {
    PRESETS: PRESETS,
    get: get,
    tip: tip,
    search: search,
    sky: sky,
    round: round
  };
})();
