/* 찌니 대시보드 — 효과음
   ------------------------------------------------------------------
   오디오 파일을 따로 내려받지 않고, 그 자리에서 소리를 만들어 냅니다.
   (Web Audio API — 오프라인·홈 화면 앱에서도 바로 울려요)

   · 체크      playCheck()   짧고 맑은 '띵' (마림바·벨 느낌, 두 음 상승)
   · 체크 해제 playUncheck() 아주 작고 낮은 '톡' (일부러 조용하게)
   · 축하      playSuccess() 팡파레 화음 + 짧은 박수 소리
   · 박수만    playClap()    박수 소리만

   켜고 끄는 설정은 이 기기의 localStorage('jjini.sound.v1')에 남습니다.
   값이 'off' 일 때만 꺼지고, 그 밖에는 켜짐이 기본이에요.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var KEY = 'jjini.sound.v1';

  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var on = true;

  function readOn() {
    try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; }
  }

  function saveOn(value) {
    try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch (e) { /* 저장 못 해도 소리는 그대로 */ }
  }

  function context() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    master = ctx.createGain();
    master.gain.value = 0.5;             /* 전체를 조금 낮춰 귀에 편하게 */
    master.connect(ctx.destination);
    return ctx;
  }

  /* 모바일 브라우저는 첫 터치 전에 오디오를 잠가 두므로, 소리를 낼 때마다 깨워 둡니다. */
  function live() {
    if (!on) return null;
    var c = context();
    if (!c) return null;
    if (c.state === 'suspended' && typeof c.resume === 'function') {
      try {
        var p = c.resume();
        if (p && typeof p.catch === 'function') p.catch(function () { /* noop */ });
      } catch (e) { /* noop */ }
    }
    return c;
  }

  /* 첫 터치·클릭에서 미리 열어 두면 그다음부터 딜레이가 없습니다. */
  function arm() {
    var c = context();
    if (!c) return;
    if (c.state === 'suspended' && typeof c.resume === 'function') {
      try {
        var p = c.resume();
        if (p && typeof p.catch === 'function') p.catch(function () { /* noop */ });
      } catch (e) { /* noop */ }
    }
  }

  /* ---------------- 소리 만들기 ---------------- */
  function tone(c, opt) {
    var at = opt.at;
    var dur = opt.dur || 0.2;
    var peak = opt.peak == null ? 0.15 : opt.peak;
    var osc = c.createOscillator();
    var gain = c.createGain();

    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.freq, at);
    if (opt.to && opt.to !== opt.freq) {
      osc.frequency.exponentialRampToValueAtTime(opt.to, at + (opt.glide || dur));
    }

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.015, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  }

  /* 마림바·벨 느낌 — 기본음에 두 배·세 배 음을 살짝 얹어 맑게 */
  function bell(c, at, freq, peak, dur) {
    tone(c, { at: at, freq: freq, type: 'sine', peak: peak, dur: dur });
    tone(c, { at: at, freq: freq * 2, type: 'sine', peak: peak * 0.34, dur: dur * 0.55 });
    tone(c, { at: at, freq: freq * 3, type: 'triangle', peak: peak * 0.1, dur: dur * 0.28 });
  }

  function noiseBuffer(c) {
    if (noiseBuf) return noiseBuf;
    var len = Math.max(1, Math.floor(c.sampleRate * 0.5));
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2) - 1;
    return noiseBuf;
  }

  /* 박수 한 번 — 걸러 낸 잡음을 아주 짧게 터뜨립니다. */
  function clap(c, at, peak) {
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(c);

    var band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.9;

    var high = c.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 900;

    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);

    src.connect(band);
    band.connect(high);
    high.connect(gain);
    gain.connect(master);

    src.start(at);
    src.stop(at + 0.14);
  }

  /* 팡파레 — 밝은 화음이 올라가고 마지막에 길게 남습니다. */
  function fanfare(c, at) {
    bell(c, at + 0.00, 523.25, 0.15, 0.22);   /* 도 */
    bell(c, at + 0.09, 659.25, 0.15, 0.22);   /* 미 */
    bell(c, at + 0.18, 783.99, 0.16, 0.26);   /* 솔 */
    bell(c, at + 0.30, 1046.50, 0.19, 0.78);  /* 높은 도 */
    bell(c, at + 0.30, 1318.51, 0.09, 0.62);  /* 미 */
    bell(c, at + 0.30, 1567.98, 0.08, 0.62);  /* 솔 */
  }

  /* ---------------- 바깥에서 쓰는 것들 ---------------- */
  var api = {

    isOn: function () { return on; },

    setOn: function (value) {
      on = !!value;
      saveOn(on);
      if (!on) context();      /* 꺼 두어도 다음에 켤 때 바로 울리도록 준비만 */
      return on;
    },

    toggle: function () {
      var next = api.setOn(!on);
      if (next) api.playCheck();   /* 켤 때 한 번 들려 줘요 */
      return next;
    },

    /** 짧은 체크 소리 — 할 일·준비 항목을 마쳤을 때 */
    playCheck: function () {
      var c = live();
      if (!c) return;
      var t = c.currentTime + 0.02;
      bell(c, t, 1046.50, 0.16, 0.22);        /* 높은 도 */
      bell(c, t + 0.075, 1567.98, 0.13, 0.34); /* 한 음 올라간 솔 */
    },

    /** 체크를 풀 때 — 아주 작게, 거의 들리지 않을 만큼 */
    playUncheck: function () {
      var c = live();
      if (!c) return;
      var t = c.currentTime + 0.01;
      tone(c, { at: t, freq: 300, to: 205, type: 'triangle', peak: 0.045, dur: 0.09 });
    },

    /** 축하 소리 — 팡파레 + 박수 */
    playSuccess: function () {
      var c = live();
      if (!c) return;
      var t = c.currentTime + 0.02;
      fanfare(c, t);
      clap(c, t + 0.10, 0.16);
      clap(c, t + 0.24, 0.14);
      clap(c, t + 0.42, 0.15);
      clap(c, t + 0.56, 0.11);
    },

    /** 박수만 — 짧은 칭찬 */
    playClap: function () {
      var c = live();
      if (!c) return;
      var t = c.currentTime + 0.02;
      clap(c, t + 0.00, 0.15);
      clap(c, t + 0.13, 0.13);
      clap(c, t + 0.28, 0.11);
    }
  };

  on = readOn();

  /* 첫 터치·클릭·키 입력에서 오디오를 미리 열어 둡니다. */
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (name) {
    document.addEventListener(name, arm, { once: true, passive: true });
  });

  window.FamilySound = api;
})();
