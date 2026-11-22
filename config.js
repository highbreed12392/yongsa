// ===== 여기만 채우면 카카오 로그인 + 서버 저장이 켜져요 =====
// 비워 두면 지금처럼 이 기기에만 저장되는 '혼자 하기' 앱으로 동작합니다.
window.YONGSA_CLOUD = {
  // Supabase 대시보드 → Project Settings → API (또는 Connect) 에서 복사
  supabaseUrl: "",        // 예: "https://abcdefghijklmnop.supabase.co"
  supabaseAnonKey: "",    // 'anon public' 또는 'publishable' 키 (공개해도 되는 키예요. service_role 키는 절대 넣지 마세요)

  // 게임을 올린 웹 주소 (마지막 / 포함)
  siteUrl: "https://highbreed12392.github.io/yongsa/",

  // NPC AI 대화를 쓰려면 true (supabase/functions/ai 배포 + ANTHROPIC_API_KEY 등록 필요)
  ai: false,

  // 카카오에서 받을 정보 (카카오 디벨로퍼스 '동의항목'에서 켠 것과 맞춰 주세요)
  kakaoScopes: "profile_nickname profile_image"
};
