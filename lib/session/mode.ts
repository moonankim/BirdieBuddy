// 화면 데이터 모드. 기본은 실제 Supabase(루트 .env의 공개 URL·publishable key).
// NEXT_PUBLIC_DATA_MODE=mock 이거나 연결 값이 없으면 목 SDK·더미 계정으로 동작한다(단위 테스트·E2E·오프라인 미리보기).
export type DataMode = 'mock' | 'supabase';
export const dataMode: DataMode =
  process.env.NEXT_PUBLIC_DATA_MODE === 'mock' || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? 'mock'
    : 'supabase';
