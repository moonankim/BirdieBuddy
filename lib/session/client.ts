'use client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

// 브라우저에서 Supabase 클라이언트를 하나만 만든다. 세션 저장·토큰 갱신은 supabase-js가 맡는다.
let client: SupabaseClient<Database> | null = null;
export function getBrowserClient(): SupabaseClient<Database> {
  client ??= createBrowserSupabaseClient();
  return client;
}
