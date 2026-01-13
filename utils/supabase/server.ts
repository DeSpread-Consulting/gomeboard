import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 1. 함수 앞에 'async'를 붙여야 합니다.
export async function createClient() {
  // 2. cookies() 앞에 'await'를 붙여서 다 기다린 뒤에 cookieStore에 담아야 합니다.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 쿠키를 설정하려 할 때 나는 에러 무시 (미들웨어에서 처리됨)
          }
        },
      },
    }
  );
}
