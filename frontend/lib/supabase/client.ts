import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a client-side Supabase client with cookie/storage session persistence.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your_supabase_anon_key";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
