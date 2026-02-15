// 싱글톤 패턴 사용 (supabase-client.ts와 동일)
import { createSupabaseBrowserClient as createClient } from '@/supabase/supabase-client'

// 싱글톤 클라이언트 재사용
export const createSupabaseBrowserClient = createClient



    