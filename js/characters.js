/* 찌니 대시보드 — 캐릭터 & 알록달록 일러스트 (인라인 SVG)
   ------------------------------------------------------------------
   · FamilyChars.svg(key)   : 120x120 원형 캐릭터 (프로필·잠금·도장판)
   · FamilyChars.icon(key)  : 100x100 둥근 파스텔 타일 아이콘 (할 일·보상·준비)
   · FamilyChars.iconOf(e)  : 이모지 → 타일 아이콘 (준비물 체크 등)
   전부 인라인 SVG 라서 오프라인에서도, 어떤 해상도에서도 선명합니다. */
(function () {
  'use strict';

  var uid = 0;

  /* ---------------- 공통 도우미 ---------------- */
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
      '<stop offset="0%" stop-color="#FFFFFF" stop-opacity=".8"/>' +
      '<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      '<circle cx="60" cy="60" r="58" fill="' + bgFrom + '"/>' +
      '<circle cx="60" cy="60" r="58" fill="url(#' + id + ')"/>' +
      '<ellipse cx="60" cy="106" rx="30" ry="4.4" fill="#C9A882" opacity=".14"/>' +
      body +
      '<ellipse cx="40" cy="26" rx="19" ry="11" fill="url(#' + id + 'h)" opacity=".85"/>' +
      '</svg>';
  }

  /* 아이콘: 둥근 파스텔 타일 + 일러스트 */
  function tile(key, from, to, body) {
    var id = 'ig' + (++uid);
    return '<svg class="ic ic-' + key + '" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' + from + '"/>' +
      '<stop offset="100%" stop-color="' + to + '"/></linearGradient></defs>' +
      '<rect x="1.5" y="1.5" width="97" height="97" rx="27" fill="' + from + '"/>' +
      '<rect x="1.5" y="1.5" width="97" height="97" rx="27" fill="url(#' + id + ')"/>' +
      '<ellipse cx="33" cy="22" rx="25" ry="13" fill="#FFFFFF" opacity=".38"/>' +
      body + '</svg>';
  }

  function eyesOpen(cx1, cy, gap, r) {
    return '<ellipse cx="' + cx1 + '" cy="' + cy + '" rx="' + r + '" ry="' + (r * 1.2) + '" fill="#5B4033"/>' +
      '<circle cx="' + (cx1 + r * 0.3) + '" cy="' + (cy - r * 0.42) + '" r="' + (r * 0.36) + '" fill="#fff"/>' +
      '<ellipse cx="' + (cx1 + gap) + '" cy="' + cy + '" rx="' + r + '" ry="' + (r * 1.2) + '" fill="#5B4033"/>' +
      '<circle cx="' + (cx1 + gap + r * 0.3) + '" cy="' + (cy - r * 0.42) + '" r="' + (r * 0.36) + '" fill="#fff"/>';
  }

  function eyesHappy(x1, x2, cy, w) {
    return '<path d="M' + x1 + ' ' + cy + ' q' + (w / 2) + ' -' + (w * 0.7) + ' ' + w + ' 0" stroke="#5B4033" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<path d="M' + x2 + ' ' + cy + ' q' + (w / 2) + ' -' + (w * 0.7) + ' ' + w + ' 0" stroke="#5B4033" stroke-width="3" stroke-linecap="round" fill="none"/>';
  }

  function blush(cxL, cxR, cy) {
    return '<ellipse cx="' + cxL + '" cy="' + cy + '" rx="6.6" ry="4.2" fill="#F8AEBE" opacity=".78"/>' +
      '<ellipse cx="' + cxR + '" cy="' + cy + '" rx="6.6" ry="4.2" fill="#F8AEBE" opacity=".78"/>';
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

  /* ==================================================================
     찌니 — 귀여운 꼬마 + 햄찌 펫
     ================================================================== */
  function jjini() {
    var b = '';

    /* 반짝이 */
    b += sparkle(101, 32, 6, '#FFD37E');
    b += sparkle(18, 64, 4.2, '#F9A8C0');
    b += '<circle cx="24" cy="30" r="3.6" fill="#FFE08A"/>';

    /* 몸통(민트 셔츠) */
    b += '<path d="M29 119 c0-21 13-33 30-33 s30 12 30 33 z" fill="#8AD9C6"/>';
    b += '<path d="M29 119 c0-21 13-33 30-33 s30 12 30 33 z" fill="#5FC6AE" opacity=".35"/>';
    b += '<path d="M48 89 q11 9 23 0" stroke="#FFFFFF" stroke-width="3.4" fill="none" stroke-linecap="round"/>';

    /* 목 */
    b += '<rect x="53" y="69" width="12" height="13" rx="5.4" fill="#F6C9A6"/>';

    /* 귀 */
    b += '<circle cx="30" cy="53" r="7" fill="#FFE2C6"/>';
    b += '<circle cx="83" cy="53" r="7" fill="#FFE2C6"/>';

    /* 얼굴 */
    b += '<circle cx="56" cy="50" r="27" fill="#FFE7CE"/>';

    /* 머리카락 */
    b += '<path d="M29 50 c0-18 12-30 28-30 c17 0 27 12 27 29 c-3-8-9-10-14-7 c-6 4-10 7-17 6 c-7-1-9-6-14-5 c-5 1-8 3-10 7z" fill="#5C4033"/>';
    b += '<path d="M35 40 q10-13 23-9 q9 2 13 9 q-8-5-16-2 q-9 3-20 2z" fill="#6E4A37"/>';

    /* 볼 */
    b += blush(37, 76, 61);

    /* 눈 */
    b += eyesOpen(45, 51, 22, 5.1);

    /* 눈썹 */
    b += '<path d="M40 40 q5-3 10 0" stroke="#6E4A37" stroke-width="2.3" fill="none" stroke-linecap="round"/>';
    b += '<path d="M64 40 q5-3 10 0" stroke="#6E4A37" stroke-width="2.3" fill="none" stroke-linecap="round"/>';

    /* 입 */
    b += '<path d="M51 64 q5.6 6 11 0" stroke="#C4746A" stroke-width="2.5" fill="none" stroke-linecap="round"/>';

    /* 햄찌 펫 (오른쪽 아래) */
    b += '<g>' +
      '<ellipse cx="93" cy="96" rx="15" ry="12.6" fill="#FFF4E2" stroke="#EBD0B0" stroke-width="2"/>' +
      '<circle cx="83" cy="85" r="5.4" fill="#FFF4E2" stroke="#EBD0B0" stroke-width="2"/>' +
      '<circle cx="83" cy="85" r="2.4" fill="#F9C2C9"/>' +
      '<circle cx="103" cy="85" r="5.4" fill="#FFF4E2" stroke="#EBD0B0" stroke-width="2"/>' +
      '<circle cx="103" cy="85" r="2.4" fill="#F9C2C9"/>' +
      '<ellipse cx="93" cy="99" rx="9" ry="6.6" fill="#FFFDF9"/>' +
      '<circle cx="88" cy="94" r="1.9" fill="#5B4033"/>' +
      '<circle cx="98" cy="94" r="1.9" fill="#5B4033"/>' +
      '<ellipse cx="93" cy="98" rx="1.9" ry="1.5" fill="#E4939C"/>' +
      '<path d="M93 100 q-3 3.6 -5.6 1 M93 100 q3 3.6 5.6 1" stroke="#B98A82" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="82" cy="99" rx="3.4" ry="2.4" fill="#F8AEBE" opacity=".75"/>' +
      '<ellipse cx="104" cy="99" rx="3.4" ry="2.4" fill="#F8AEBE" opacity=".75"/>' +
      '</g>';

    /* 햄찌를 감싼 손 */
    b += '<ellipse cx="79" cy="100" rx="6.6" ry="5.6" fill="#FFE7CE" stroke="#F4CDA8" stroke-width="1.6"/>';
    b += heart(66, 84, 4.4, '#F28F9C');

    return wrap('char-jjini', b, '#FFFDF6', '#FFEFD8');
  }

  /* ==================================================================
     할 일·보상 일러스트 타일
     ================================================================== */

  /* 재능 국어 — 연필과 펼친 책 */
  function icKorean() {
    return tile('korean', '#FFE8D8', '#FFDCE8',
      '<path d="M16 60 q17-9 33-3 v26 q-16-6-33 3 z" fill="#FFFFFF" stroke="#E7D6C4" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M84 60 q-17-9-33-3 v26 q16-6 33 3 z" fill="#FFFDF8" stroke="#E7D6C4" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M50 57 v26" stroke="#E7D6C4" stroke-width="2.2"/>' +
      '<path d="M24 70 q10-4 20-2 M24 78 q10-4 20-2" stroke="#F3DFCB" stroke-width="2" stroke-linecap="round"/>' +
      '<g transform="rotate(-31 52 38)">' +
        '<rect x="28" y="31" width="38" height="13" rx="3.4" fill="#FFC94D"/>' +
        '<rect x="28" y="31" width="9" height="13" rx="3.4" fill="#FF97AF"/>' +
        '<path d="M66 31 l12 6.5 -12 6.5 z" fill="#F2A65A"/>' +
        '<path d="M78 37.5 l-6 3.2 -6 -3.2 z" fill="#4B3B31"/>' +
        '<path d="M37 31 v13" stroke="#E7A928" stroke-width="1.6"/>' +
      '</g>');
  }

  /* 재능 수학 — 수학 노트 */
  function icMath() {
    return tile('math', '#FFF3C9', '#DFF6EA',
      '<rect x="24" y="15" width="52" height="71" rx="9" fill="#FFFFFF" stroke="#EADFCB" stroke-width="2.2"/>' +
      '<path d="M24 24 a9 9 0 0 1 9-9 h34 a9 9 0 0 1 9 9 v10 h-52 z" fill="#FFE0EA"/>' +
      '<path d="M34 45 h12 M40 39 v12" stroke="#FF8FA3" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M56 41 h15 M56 50 h15" stroke="#6FC7B4" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M34 64 h36 M34 74 h23" stroke="#DCE9F4" stroke-width="3.4" stroke-linecap="round"/>');
  }

  /* 한자어휘 — 두루마리 */
  function icHanja() {
    return tile('hanja', '#EDE6FF', '#FFE6E0',
      '<rect x="26" y="22" width="48" height="56" rx="5" fill="#FFF9EC" stroke="#E8D8BB" stroke-width="2.2"/>' +
      '<rect x="18" y="13" width="64" height="12" rx="6" fill="#B7A0E8"/>' +
      '<rect x="18" y="75" width="64" height="12" rx="6" fill="#B7A0E8"/>' +
      '<path d="M38 34 h24 M38 46 h24 M50 33 v24" stroke="#8A6BB8" stroke-width="3.8" stroke-linecap="round"/>' +
      '<path d="M36 62 h28" stroke="#F3A5B8" stroke-width="3.4" stroke-linecap="round"/>');
  }

  /* 역사문제집 — 지구본 */
  function icHistory() {
    return tile('history', '#DDF1FF', '#E7F8EC',
      '<circle cx="50" cy="43" r="24" fill="#7FC9F2"/>' +
      '<path d="M38 30 q9-5 13 2 q3 6-5 8 q-9 2-9-4 q0-4 1-6z" fill="#8FD98A"/>' +
      '<path d="M53 42 q9-2 9 6 q0 7-8 6 q-6-1-5-7 q1-4 4-5z" fill="#8FD98A"/>' +
      '<path d="M49 19 a24 24 0 0 0 0 48" stroke="#5FB3E5" stroke-width="2" fill="none" opacity=".65"/>' +
      '<ellipse cx="50" cy="43" rx="24" ry="9" stroke="#5FB3E5" stroke-width="2" fill="none" opacity=".55"/>' +
      '<path d="M50 67 v9" stroke="#C9A87C" stroke-width="5" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="79" rx="14" ry="5" fill="#D9BE97"/>');
  }

  /* 독서 30분 — 책 읽는 캐릭터 */
  function icRead() {
    return tile('read', '#DFF6E7', '#DDEEFF',
      '<circle cx="50" cy="33" r="15" fill="#FFE7CE"/>' +
      '<path d="M35 32 q2-15 15-15 q13 0 15 15 q-8-7-15-5 q-7 1-15 5z" fill="#5C4033"/>' +
      eyesHappy(41, 52, 34, 7) +
      blush(39, 62, 41) +
      '<path d="M47 43 q3.4 3.6 7 0" stroke="#C4746A" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M13 59 q18-9 37-3 v25 q-19-6-37 3z" fill="#FFFFFF" stroke="#DCE7F1" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M87 59 q-18-9-37-3 v25 q19-6 37 3z" fill="#FFFDF7" stroke="#DCE7F1" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M50 57 v25" stroke="#DCE7F1" stroke-width="2.2"/>' +
      '<circle cx="20" cy="66" r="4.8" fill="#FFE7CE"/>' +
      '<circle cx="80" cy="66" r="4.8" fill="#FFE7CE"/>' +
      '<path d="M27 70 q8-3 16-1 M57 69 q8-2 16 1" stroke="#EDF3F9" stroke-width="2" stroke-linecap="round"/>');
  }

  /* 아킬레스건 운동 — 스트레칭하는 캐릭터 */
  function icMove() {
    return tile('move', '#FFE6D6', '#FFF7CE',
      '<circle cx="54" cy="26" r="11.5" fill="#FFE7CE"/>' +
      '<path d="M42 25 q3-12 13-12 q10 0 12 12 q-6-6-12-4 q-6 1-13 4z" fill="#5C4033"/>' +
      eyesHappy(46, 57, 27, 5.6) +
      '<path d="M54 38 v24" stroke="#7FD9C4" stroke-width="11" stroke-linecap="round"/>' +
      '<path d="M54 44 L36 30" stroke="#FFE7CE" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M54 44 L70 55" stroke="#FFE7CE" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M54 62 L40 82" stroke="#8FB6E8" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M54 62 L67 82" stroke="#8FB6E8" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M33 84 h12 M62 84 h12" stroke="#E8798F" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M28 40 q-7-8-1-17" stroke="#FFB347" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>' +
      sparkle(84, 32, 4.4, '#FFD37E'));
  }

  /* 영상 30분 — 텔레비전 */
  function icVideo() {
    return tile('video', '#EDE7FF', '#FFE4EE',
      '<rect x="15" y="25" width="70" height="47" rx="11" fill="#7E7BE8"/>' +
      '<rect x="21" y="31" width="58" height="35" rx="7" fill="#DDEBFF"/>' +
      '<path d="M45 41 l11 7.5 -11 7.5 z" fill="#FF8FA3"/>' +
      '<circle cx="70" cy="38" r="3" fill="#FFD34D"/>' +
      '<circle cx="31" cy="39" r="2.2" fill="#FFD34D"/>' +
      '<circle cx="66" cy="57" r="2.4" fill="#9CE3C4"/>' +
      '<path d="M34 77 l-7 9 M66 77 l7 9" stroke="#A9A3EC" stroke-width="4" stroke-linecap="round"/>');
  }

  /* 엔트리코딩 — 노트북 */
  function icCoding() {
    return tile('coding', '#DDEEFF', '#E1F8EE',
      '<rect x="18" y="22" width="64" height="42" rx="7" fill="#5B6EE1"/>' +
      '<rect x="24" y="28" width="52" height="30" rx="4" fill="#EAF3FF"/>' +
      '<path d="M41 36 l-7 7 7 7" stroke="#FF8FA3" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M59 36 l7 7 -7 7" stroke="#4FC0A0" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M53 34 l-5 16" stroke="#FFC94D" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M12 70 h76 l-9 11 h-58 z" fill="#C9D6FF"/>' +
      '<path d="M41 76 h18" stroke="#96A8E8" stroke-width="2.6" stroke-linecap="round"/>');
  }

  /* 냥코 20분 — 귀여운 고양이 + 시계 */
  function icCat() {
    return tile('cat', '#FFF3C9', '#FFE0D6',
      '<path d="M25 37 l3-17 15 10 z" fill="#FFC98A"/>' +
      '<path d="M75 37 l-3-17 -15 10 z" fill="#FFC98A"/>' +
      '<path d="M29 32 l1.4-8 7 4.6 z" fill="#FFAFC4"/>' +
      '<path d="M71 32 l-1.4-8 -7 4.6 z" fill="#FFAFC4"/>' +
      '<ellipse cx="50" cy="52" rx="27" ry="23" fill="#FFD9A8"/>' +
      eyesHappy(40, 54, 48, 7) +
      '<path d="M50 57 l-4 3.6 h8 z" fill="#F58FA3"/>' +
      '<path d="M50 61 q-4 5 -8 2 M50 61 q4 5 8 2" stroke="#B98A82" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M20 52 h-9 M20 59 h-8" stroke="#D9AE7E" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M80 52 h9 M80 59 h8" stroke="#D9AE7E" stroke-width="2.2" stroke-linecap="round"/>' +
      '<ellipse cx="29" cy="59" rx="5.4" ry="3.6" fill="#F8AEBE" opacity=".85"/>' +
      '<ellipse cx="71" cy="59" rx="5.4" ry="3.6" fill="#F8AEBE" opacity=".85"/>' +
      '<circle cx="77" cy="78" r="12" fill="#FFFFFF" stroke="#FFC44D" stroke-width="3"/>' +
      '<path d="M77 71 v7 h5" stroke="#C08A3C" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  }

  /* 닌텐도 — 휴대용 게임기 */
  function icNintendo() {
    return tile('nintendo', '#DFF6E7', '#EDE7FF',
      '<rect x="23" y="16" width="54" height="68" rx="11" fill="#5B6EE1"/>' +
      '<rect x="30" y="23" width="40" height="31" rx="4" fill="#DCEBFF"/>' +
      '<path d="M36 32 h12 M42 27 v10" stroke="#7ED08A" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="66" cy="38" r="5" fill="#FF8FA3"/>' +
      '<circle cx="38" cy="68" r="6" fill="#FFD34D"/>' +
      '<circle cx="50" cy="68" r="6" fill="#9CE3C4"/>' +
      '<circle cx="62" cy="68" r="6" fill="#FFAFC4"/>');
  }

  /* 안경 */
  function icGlasses() {
    return tile('glasses', '#DDF1FF', '#EFF7FF',
      '<circle cx="33" cy="50" r="15" fill="#EAF6FF" stroke="#5C4033" stroke-width="3.6"/>' +
      '<circle cx="67" cy="50" r="15" fill="#EAF6FF" stroke="#5C4033" stroke-width="3.6"/>' +
      '<path d="M48 48 q2-4 4 0" stroke="#5C4033" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M17 44 L7 37 M83 44 L93 37" stroke="#5C4033" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M25 44 q4-4 9-2 M59 44 q4-4 9-2" stroke="#FFFFFF" stroke-width="3" opacity=".95" stroke-linecap="round"/>');
  }

  /* 외투 */
  function icCoat() {
    return tile('coat', '#FFE4EE', '#FFF0E4',
      '<path d="M35 30 q15-8 30 0 l13 11 -7 9 -5-4 v31 q-16 5-32 0 v-31 l-5 4 -7-9z" fill="#FF9FB2"/>' +
      '<path d="M50 32 v45" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M40 27 q10 9 20 0" stroke="#FFFFFF" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="50" cy="48" r="2.6" fill="#FFFFFF"/>' +
      '<circle cx="50" cy="60" r="2.6" fill="#FFFFFF"/>' +
      '<path d="M26 62 h4 M70 62 h4" stroke="#E8798F" stroke-width="2.6" stroke-linecap="round"/>');
  }

  /* 핸드폰 */
  function icPhone() {
    return tile('phone', '#EDE7FF', '#DDF1FF',
      '<rect x="31" y="13" width="38" height="74" rx="10" fill="#6E66D8"/>' +
      '<rect x="35" y="20" width="30" height="57" rx="5" fill="#E4F2FF"/>' +
      '<circle cx="50" cy="82" r="2.8" fill="#FFFFFF"/>' +
      heart(50, 48, 6.2, '#FF8FA3') +
      '<path d="M41 32 h18" stroke="#C4DDF5" stroke-width="2.6" stroke-linecap="round"/>');
  }

  /* 가방 */
  function icBag() {
    return tile('bag', '#DFF6E7', '#FFF3C9',
      '<path d="M38 30 q0-11 12-11 q12 0 12 11" stroke="#4FB99A" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
      '<rect x="23" y="28" width="54" height="54" rx="15" fill="#6FD3B0"/>' +
      '<rect x="23" y="28" width="54" height="20" rx="12" fill="#8CE0C3"/>' +
      '<rect x="33" y="56" width="34" height="20" rx="8" fill="#FFF8E8"/>' +
      '<path d="M41 56 v-4 h18 v4" stroke="#4FB99A" stroke-width="2.6" fill="none"/>' +
      '<circle cx="50" cy="66" r="2.6" fill="#FFB347"/>');
  }

  /* 숙제 */
  function icHomework() {
    return tile('homework', '#FFF3C9', '#FFE4EE',
      '<rect x="22" y="14" width="46" height="62" rx="7" fill="#FFFFFF" stroke="#EADFCB" stroke-width="2.2"/>' +
      '<path d="M32 30 h26 M32 42 h26 M32 54 h17" stroke="#DCE9F4" stroke-width="3.2" stroke-linecap="round"/>' +
      '<g transform="rotate(38 70 60)">' +
        '<rect x="56" y="54" width="30" height="11" rx="3.4" fill="#FFC94D"/>' +
        '<rect x="56" y="54" width="8" height="11" rx="3.4" fill="#FF97AF"/>' +
        '<path d="M86 54 l8 5.5 -8 5.5 z" fill="#F2A65A"/>' +
        '<path d="M94 59.5 l-4 2.7 -3-2.7 z" fill="#4B3B31"/>' +
      '</g>');
  }

  /* 학교 */
  function icSchool() {
    return tile('school', '#DDF1FF', '#FFF3C9',
      '<path d="M50 18 l32 21 h-64z" fill="#FF9FB2"/>' +
      '<rect x="20" y="39" width="60" height="40" rx="6" fill="#FFF6E4" stroke="#E9D9BE" stroke-width="2"/>' +
      '<rect x="43" y="59" width="14" height="20" rx="2" fill="#8FB6E8"/>' +
      '<rect x="26" y="48" width="11" height="10" rx="2" fill="#BFE3FF"/>' +
      '<rect x="63" y="48" width="11" height="10" rx="2" fill="#BFE3FF"/>' +
      '<path d="M50 18 v-8 h12 v5" stroke="#C9A87C" stroke-width="2.6" fill="none" stroke-linecap="round"/>');
  }

  /* 학원 */
  function icAcademy() {
    return tile('academy', '#DFF6E7', '#EDE7FF',
      '<path d="M50 25 l30 13 -30 13 -30-13z" fill="#5B6EE1"/>' +
      '<path d="M34 44 v12 q16 7 32 0 v-12 z" fill="#8A96F2"/>' +
      '<path d="M50 51 v16" stroke="#FFC94D" stroke-width="3.4" stroke-linecap="round"/>' +
      '<circle cx="50" cy="70" r="5" fill="#FFC94D"/>' +
      '<path d="M24 30 l-4 8" stroke="#FFB347" stroke-width="3" stroke-linecap="round"/>');
  }

  /* 책 (독서 기록) */
  function icBook() {
    return tile('book', '#E6F7EE', '#DDEEFF',
      '<rect x="26" y="16" width="46" height="66" rx="7" fill="#FF9FB2"/>' +
      '<rect x="26" y="16" width="12" height="66" rx="6" fill="#E8798F"/>' +
      '<rect x="46" y="34" width="16" height="4" rx="2" fill="#FFF6E4"/>' +
      '<rect x="46" y="45" width="16" height="4" rx="2" fill="#FFF6E4"/>' +
      '<path d="M64 22 v20 l-6-4.6 -6 4.6 V22z" fill="#FFD34D"/>');
  }

  /* 마이크 (강의) */
  function icMic() {
    return tile('mic', '#FFE4EE', '#EDE7FF',
      '<rect x="41" y="16" width="18" height="36" rx="9" fill="#8E86E8"/>' +
      '<path d="M41 26 h18 M41 36 h18" stroke="#C9C2F7" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M31 47 q0 18 19 18 q19 0 19-18" stroke="#6E66D8" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 65 v13 M38 82 h24" stroke="#6E66D8" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M23 33 q-6 7 0 15 M77 33 q6 7 0 15" stroke="#FFB347" stroke-width="3" fill="none" stroke-linecap="round"/>');
  }

  /* ================================================================== */
  var CHARACTERS = {
    jjini: jjini,
    hamster: jjini,
    char: jjini
  };

  var ICONS = {
    korean: icKorean,
    math: icMath,
    hanja: icHanja,
    history: icHistory,
    read: icRead,
    move: icMove,
    video: icVideo,
    coding: icCoding,
    cat: icCat,
    nintendo: icNintendo,
    glasses: icGlasses,
    coat: icCoat,
    phone: icPhone,
    bag: icBag,
    homework: icHomework,
    school: icSchool,
    academy: icAcademy,
    book: icBook,
    mic: icMic
  };

  var EMOJI = {
    '👓': 'glasses',
    '🧥': 'coat',
    '📱': 'phone',
    '🎒': 'bag',
    '📝': 'homework',
    '📖': 'book',
    '📚': 'read',
    '💻': 'coding',
    '📺': 'video',
    '🐱': 'cat',
    '🎮': 'nintendo',
    '🎤': 'mic',
    '🏫': 'school',
    '🎓': 'academy'
  };

  window.FamilyChars = {
    /** 캐릭터 SVG 문자열 (프로필·잠금·도장판). */
    svg: function (key) {
      var fn = CHARACTERS[key] || CHARACTERS.jjini;
      return fn();
    },
    /** 아주 작은 크기용 — 같은 그림을 그대로 씁니다. */
    tiny: function (key) {
      return window.FamilyChars.svg(key);
    },
    /** 알록달록 일러스트 타일 아이콘. */
    icon: function (key) {
      var fn = ICONS[key] || ICONS.cat;
      return fn();
    },
    /** 이모지로 아이콘 찾기 (준비물 체크 등). */
    iconOf: function (emoji) {
      var key = EMOJI[emoji];
      return key ? window.FamilyChars.icon(key) : '';
    },
    has: function (key) { return !!ICONS[key]; },
    keys: Object.keys(CHARACTERS),
    iconKeys: Object.keys(ICONS)
  };
})();
