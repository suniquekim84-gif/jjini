/* 우리 가족 기록장 — 가족 캐릭터 (인라인 SVG)
   각 캐릭터는 120x120 viewBox 기준으로 그려집니다.
   가족 이름을 바꿔도 그림은 그대로예요. 새 캐릭터를 추가하려면 아래
   CHARACTERS 목록에 키를 하나 더 넣고 함수를 만들면 됩니다. */
(function () {
  'use strict';

  var uid = 0;

  function grad(id, from, to) {
    return '<radialGradient id="' + id + '" cx="50%" cy="38%" r="70%">' +
      '<stop offset="0%" stop-color="' + from + '"/>' +
      '<stop offset="100%" stop-color="' + to + '"/></radialGradient>';
  }

  function wrap(cls, body, bgFrom, bgTo) {
    var id = 'cg' + (++uid);
    return '<svg class="char ' + cls + '" viewBox="0 0 120 120" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' + grad(id, bgFrom, bgTo) +
      '<linearGradient id="' + id + 'h" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#FFFFFF" stop-opacity=".85"/>' +
      '<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      '<circle cx="60" cy="60" r="58" fill="url(#' + id + ')"/>' +
      '<ellipse cx="60" cy="104" rx="30" ry="4.6" fill="#C9A882" opacity=".16"/>' +
      body +
      // 유리처럼 반짝이는 하이라이트
      '<ellipse cx="42" cy="30" rx="20" ry="12" fill="url(#' + id + 'h)" opacity=".9"/>' +
      '</svg>';
  }

  function eyesClosed(cx1, cy, gap, w) {
    var a = cx1, b = cx1 + gap;
    return '<path d="M' + a + ' ' + cy + ' q' + (w / 2) + ' -' + (w * 0.62) + ' ' + w + ' 0" ' +
      'stroke="#6B4B3A" stroke-width="3.4" stroke-linecap="round" fill="none"/>' +
      '<path d="M' + b + ' ' + cy + ' q' + (w / 2) + ' -' + (w * 0.62) + ' ' + w + ' 0" ' +
      'stroke="#6B4B3A" stroke-width="3.4" stroke-linecap="round" fill="none"/>';
  }

  function eyesOpen(cx1, cy, gap, r) {
    return '<ellipse cx="' + cx1 + '" cy="' + cy + '" rx="' + r + '" ry="' + (r * 1.18) + '" fill="#5B4033"/>' +
      '<circle cx="' + (cx1 + r * 0.32) + '" cy="' + (cy - r * 0.4) + '" r="' + (r * 0.34) + '" fill="#fff"/>' +
      '<ellipse cx="' + (cx1 + gap) + '" cy="' + cy + '" rx="' + r + '" ry="' + (r * 1.18) + '" fill="#5B4033"/>' +
      '<circle cx="' + (cx1 + gap + r * 0.32) + '" cy="' + (cy - r * 0.4) + '" r="' + (r * 0.34) + '" fill="#fff"/>';
  }

  function blush(cxL, cxR, cy) {
    return '<ellipse cx="' + cxL + '" cy="' + cy + '" rx="7" ry="4.4" fill="#F8B9C3" opacity=".8"/>' +
      '<ellipse cx="' + cxR + '" cy="' + cy + '" rx="7" ry="4.4" fill="#F8B9C3" opacity=".8"/>';
  }

  function sparkle(x, y, s, color) {
    return '<path d="M' + x + ' ' + (y - s) + ' q' + (s * 0.16) + ' ' + (s * 0.62) + ' ' + s + ' ' + s +
      ' q-' + (s * 0.84) + ' ' + (s * 0.16) + ' -' + s + ' ' + s +
      ' q-' + (s * 0.16) + ' -' + (s * 0.84) + ' -' + s + ' -' + s +
      ' q' + (s * 0.84) + ' -' + (s * 0.16) + ' ' + s + ' -' + s + ' Z" fill="' + color + '"/>';
  }

  function heart(x, y, s, color) {
    return '<path d="M' + x + ' ' + (y + s * 0.85) +
      ' C' + (x - s * 1.5) + ' ' + (y - s * 0.25) + ' ' + (x - s * 0.55) + ' ' + (y - s * 1.15) + ' ' + x + ' ' + (y - s * 0.35) +
      ' C' + (x + s * 0.55) + ' ' + (y - s * 1.15) + ' ' + (x + s * 1.5) + ' ' + (y - s * 0.25) + ' ' + x + ' ' + (y + s * 0.85) + ' Z" ' +
      'fill="' + color + '"/>';
  }

  /* ---------- 찌니 : 햄스터 ---------- */
  function hamster() {
    var b = '';
    // 귀
    b += '<circle cx="37" cy="36" r="10.5" fill="#F7E2C8"/>';
    b += '<circle cx="37" cy="36" r="5.4" fill="#F9C2C9"/>';
    b += '<circle cx="83" cy="36" r="10.5" fill="#F7E2C8"/>';
    b += '<circle cx="83" cy="36" r="5.4" fill="#F9C2C9"/>';
    // 얼굴
    b += '<ellipse cx="60" cy="63" rx="34" ry="31" fill="#FFF8EE" stroke="#EDD5B9" stroke-width="2"/>';
    // 이마 무늬
    b += '<path d="M54 36 q6 5 12 0" stroke="#E9CBA8" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    // 주둥이
    b += '<ellipse cx="60" cy="71" rx="19" ry="14" fill="#FFFDF9"/>';
    b += eyesClosed(42, 61, 24, 12);
    b += blush(36, 84, 70);
    b += '<ellipse cx="60" cy="67.5" rx="3.2" ry="2.5" fill="#E4939C"/>';
    b += '<path d="M60 70.5 q-4.4 5.2 -8 1.2 M60 70.5 q4.4 5.2 8 1.2" stroke="#B98A82" stroke-width="2" fill="none" stroke-linecap="round"/>';
    // 하트를 안은 손
    b += heart(60, 92, 8.2, '#F28F9C');
    b += '<ellipse cx="45" cy="95" rx="7" ry="6" fill="#FFF8EE" stroke="#EDD5B9" stroke-width="1.8"/>';
    b += '<ellipse cx="75" cy="95" rx="7" ry="6" fill="#FFF8EE" stroke="#EDD5B9" stroke-width="1.8"/>';
    b += '<circle cx="57" cy="89.5" r="2" fill="#FFD3DA"/>';
    b += sparkle(97, 44, 5, '#FFD37E');
    b += sparkle(24, 52, 3.4, '#F9C2C9');
    return wrap('char-hamster', b, '#FFFFFF', '#FFF3DF');
  }

  /* ---------- 나은찡 : 토끼 ---------- */
  function rabbit() {
    var b = '';
    // 긴 귀
    b += '<g transform="rotate(-9 45 30)"><ellipse cx="45" cy="28" rx="8.6" ry="19" fill="#FFFDFA" stroke="#EEDCD4" stroke-width="2"/>' +
      '<ellipse cx="45" cy="29" rx="4.4" ry="12" fill="#F9C4CE"/></g>';
    b += '<g transform="rotate(9 76 28)"><ellipse cx="76" cy="26" rx="8.6" ry="19" fill="#FFFDFA" stroke="#EEDCD4" stroke-width="2"/>' +
      '<ellipse cx="76" cy="27" rx="4.4" ry="12" fill="#F9C4CE"/></g>';
    // 얼굴
    b += '<ellipse cx="60" cy="66" rx="29" ry="26.5" fill="#FFFDFA" stroke="#EEDCD4" stroke-width="2"/>';
    b += eyesClosed(44, 64, 22, 11);
    b += blush(38, 82, 73);
    b += '<path d="M60 69.5 l-3.2 2.6 h6.4 Z" fill="#F0919F"/>';
    b += '<path d="M60 73.5 q-4 4.6 -7.4 1 M60 73.5 q4 4.6 7.4 1" stroke="#C79A93" stroke-width="1.9" fill="none" stroke-linecap="round"/>';
    // 당근
    b += '<path d="M60 84 q8 6 6.5 13.5 Q60 101 53.5 97.5 52 90 60 84Z" fill="#F6A24E" stroke="#E08B37" stroke-width="1.6"/>';
    b += '<path d="M60 84 q-3.6 -6 -8 -6.4 1 5.4 5 7.4 M60 84 q3.6 -6 8 -6.4 -1 5.4 -5 7.4" fill="#8CCB7B" stroke="#6FB463" stroke-width="1.4"/>';
    b += heart(92, 44, 6.2, '#F7A8B6');
    b += sparkle(28, 46, 5, '#FFD37E');
    return wrap('char-rabbit', b, '#FFFFFF', '#FFF0F1');
  }

  var CHARACTERS = {
    hamster: hamster,
    rabbit: rabbit
  };

  window.FamilyChars = {
    /** 캐릭터 SVG 문자열을 돌려줍니다. */
    svg: function (key) {
      var fn = CHARACTERS[key] || CHARACTERS.hamster;
      return fn();
    },
    /** 아주 작은 아이콘 크기용 (도장판 원 안) — 같은 그림, 살짝 단순화 */
    tiny: function (key) {
      var fn = CHARACTERS[key] || CHARACTERS.hamster;
      return fn();
    },
    keys: Object.keys(CHARACTERS)
  };
})();
