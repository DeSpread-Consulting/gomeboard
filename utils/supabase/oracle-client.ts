import { createBrowserClient } from "@supabase/ssr";

export function createOracleClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_ORACLE_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_ORACLE_SUPABASE_ANON_KEY!
  );
}
