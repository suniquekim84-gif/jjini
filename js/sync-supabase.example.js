/* ===================================================================
   (예시 파일 · 기본으로는 로드되지 않습니다)
   여러 기기에서 같은 기록장을 함께 쓰고 싶을 때 쓰는 Supabase 어댑터입니다.

   준비
   ---------------------------------------------------------------
   1) supabase.com 에서 프로젝트를 만들고 아래 SQL 로 표를 만듭니다.

      create table family_state (
        id text primary key,             -- 예: '우리집'
        data jsonb not null,             -- 우리 가족 기록장 전체 상태
        updated_at timestamptz default now()
      );

      -- 가족끼리만 열람하도록 RLS 정책을 꼭 걸어주세요.
      alter table family_state enable row level security;

   2) index.html 의 </body> 앞에 아래 두 줄을 추가합니다.

      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      <script src="js/sync-supabase.example.js"></script>

   3) 아래 SUPABASE_URL / SUPABASE_ANON_KEY 를 채웁니다.
      (anon key 는 공개되어도 되는 키이지만, 반드시 RLS 정책으로 보호하세요.)
   =================================================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
  var SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
  var HOUSE_ID = '우리집';

  if (!window.supabase || !window.FamilyStore) {
    console.warn('[동기화] supabase-js 또는 FamilyStore 를 찾을 수 없습니다.');
    return;
  }

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var saveTimer = null;

  window.FamilyStore.setAdapter({
    /* 앱을 열 때 서버 기록을 먼저 가져옵니다 (없으면 이 기기 기록을 사용) */
    load: function () {
      return client
        .from('family_state')
        .select('data')
        .eq('id', HOUSE_ID)
        .maybeSingle()
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data ? res.data.data : null;
        });
    },

    /* 바뀔 때마다 저장 (0.4초 모아서 한 번만) */
    save: function (state) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        client
          .from('family_state')
          .upsert({
            id: HOUSE_ID,
            data: state,
            updated_at: new Date().toISOString()
          })
          .then(function (res) {
            if (res.error) console.warn('[동기화] 저장 실패', res.error.message);
          });
      }, 400);
    },

    /* 다른 기기에서 바뀌면 실시간으로 받아옵니다 */
    subscribe: function (onRemoteState) {
      client
        .channel('family-state-' + HOUSE_ID)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'family_state', filter: 'id=eq.' + HOUSE_ID },
          function (payload) {
            if (payload.new && payload.new.data) onRemoteState(payload.new.data);
          }
        )
        .subscribe();
    }
  });
})();
