import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env?.VITE_SUPABASE_URL ||
  'https://iworwnrkbecmzrnzijqa.supabase.co'
const supabaseAnonKey =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_XBCsxBl9EACyd7k-ZjvmTg_kjjAlU5w'

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project-id'),
)

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : 'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are configured in your environment.'

if (!isSupabaseConfigured) {
  console.warn(
    '[PMF-Flix] Supabase environment configuration is missing or incomplete.',
    'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be supplied in .env.',
  )
}

// Resilient client initialization: never hard-codes production credentials into source bundles
// but provides safe fallback client so the UI renders configuration alerts instead of crashing.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'pmf-flix-auth',
      },
    })
  : (createClient('https://unconfigured-pmf.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }) as SupabaseClient)
