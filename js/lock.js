/* 찌니 대시보드 — 잠금 화면
   ------------------------------------------------------------------
   앱을 열면 4자리 비밀번호를 먼저 물어봅니다.
   한 번 맞추면 이 기기(localStorage)에 잠금 해제 상태가 남아서
   다음부터는 바로 열립니다. 설정의 "지금 잠그기"로 다시 잠글 수 있어요.

   비밀번호는 코드에 그대로 쓰지 않고, 소금(salt)을 섞은 값의
   SHA-256 해시와 견줘서 확인합니다. (기기 저장소에는 '열림' 표시만 남아요)
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var FLAG_KEY = 'jjini.lock.v1';
  var FLAG_OK = 'ok';
  var SALT = 'jjini-dashboard';
  var PIN_LEN = 4;

  /* sha256('jjini-dashboard:' + 비밀번호) */
  var PIN_SHA256 = '11d7efd06038d365726b2300a1f106435fa208d571baedf59b53ee04d53f199b';
  /* SHA-256 을 쓸 수 없는 아주 오래된 브라우저용 보조 확인값 */
  var PIN_FALLBACK = '09729a98';

  var input = '';
  var busy = false;
  var shakeTimer = null;

  function el(id) { return document.getElementById(id); }

  function storageGet() {
    try { return localStorage.getItem(FLAG_KEY); } catch (e) { return null; }
  }
  function storageSet(value) {
    try {
      if (value == null) localStorage.removeItem(FLAG_KEY);
      else localStorage.setItem(FLAG_KEY, value);
    } catch (e) { /* 저장소를 못 쓰면 다음에 다시 물어봐요 */ }
  }

  function unlocked() { return storageGet() === FLAG_OK; }

  function toHex(buffer) {
    var bytes = new Uint8Array(buffer);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return out;
  }

  function djb2(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h * 33) + text.charCodeAt(i)) >>> 0;
    var hex = h.toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return hex;
  }

  /** 입력한 비밀번호가 맞는지 (Promise<boolean>) */
  function verify(pin) {
    var text = SALT + ':' + pin;
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest && window.TextEncoder) {
      return window.crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(text))
        .then(function (buf) { return toHex(buf) === PIN_SHA256; })
        .catch(function () { return djb2(text) === PIN_FALLBACK; });
    }
    return Promise.resolve(djb2(text) === PIN_FALLBACK);
  }

  function paintDots() {
    var dots = el('lock-dots');
    if (!dots) return;
    Array.prototype.forEach.call(dots.children, function (dot, i) {
      dot.className = i < input.length ? 'on' : '';
    });
  }

  function message(text) {
    var node = el('lock-msg');
    if (node) node.textContent = text || '';
  }

  function shake() {
    var dots = el('lock-dots');
    if (!dots) return;
    dots.classList.remove('is-wrong');
    // 같은 애니메이션을 다시 틀기 위해 한 번 비웠다가 다시 넣어요
    void dots.offsetWidth;
    dots.classList.add('is-wrong');
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(function () { dots.classList.remove('is-wrong'); }, 520);
  }

  function showLock() {
    document.documentElement.classList.add('is-locked');
    input = '';
    paintDots();
    message('');
  }

  function hideLock() {
    document.documentElement.classList.remove('is-locked');
    input = '';
    paintDots();
    message('');
  }

  function submit() {
    if (busy || input.length !== PIN_LEN) return;
    busy = true;
    message('확인 중…');
    verify(input).then(function (ok) {
      busy = false;
      if (ok) {
        storageSet(FLAG_OK);
        hideLock();
      } else {
        shake();
        message('비밀번호가 맞지 않아요');
        input = '';
        setTimeout(paintDots, 220);
      }
    });
  }

  function press(key) {
    if (busy) return;
    if (key === 'del') {
      input = input.slice(0, -1);
      message('');
      paintDots();
      return;
    }
    if (!/^[0-9]$/.test(key) || input.length >= PIN_LEN) return;
    input += key;
    message('');
    paintDots();
    if (input.length === PIN_LEN) submit();
  }

  function mount() {
    var pad = el('lock-pad');
    if (pad) {
      pad.addEventListener('click', function (e) {
        var key = e.target.closest('[data-key]');
        if (key) press(key.dataset.key);
      });
    }

    // 컴퓨터에서 열었을 때는 키보드 숫자로도 입력할 수 있게
    document.addEventListener('keydown', function (e) {
      if (!document.documentElement.classList.contains('is-locked')) return;
      if (/^[0-9]$/.test(e.key)) { press(e.key); return; }
      if (e.key === 'Backspace') { press('del'); return; }
      if (e.key === 'Enter') submit();
    });

    var avatar = el('lock-avatar');
    if (avatar && window.FamilyChars) avatar.innerHTML = window.FamilyChars.svg('hamster');

    // 이미 열어 둔 기기면 잠금 화면 없이 바로
    if (unlocked()) hideLock();
    else showLock();
  }

  window.FamilyLock = {
    /** 이 기기에서 잠금이 풀려 있는지 */
    isUnlocked: unlocked,
    /** 다시 잠그기 (설정에서 사용) */
    lock: function () {
      storageSet(null);
      showLock();
      var first = el('lock-pad');
      if (first && first.querySelector('[data-key="1"]')) first.querySelector('[data-key="1"]').focus();
    },
    /** 잠금 풀기 (비밀번호 확인 없이; 테스트용) */
    unlock: function () {
      storageSet(FLAG_OK);
      hideLock();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
