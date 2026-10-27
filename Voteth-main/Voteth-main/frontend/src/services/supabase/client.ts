/**
 * VotEth 2.0 — Supabase Client
 *
 * This is the single, shared Supabase client instance for the entire frontend.
 *
 * Security rules (from Engineering Standards, Ch. 7 & Architecture, Ch. 4):
 * - Only the anon key is used here — it enforces RLS policies
 * - The service-role key NEVER appears in frontend code
 * - All AI API keys are server-side in Edge Functions only
 *
 * Usage:
 *   import { supabase } from '@services/supabase/client'
 *   const { data, error } = await supabase.from('elections').select('*')
 *
 * Type-safe queries:
 *   Once Volume III schema is complete, generate types:
 *   npx supabase gen types typescript --local > src/types/database.generated.ts
 *   Then use: createClient<Database>(url, key)
 *
 * @see docs/architecture/system-overview.md for Supabase's role
 * @see Volume III, Chapter 9 for schema design
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase.generated'

export type { Database }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PUBLIC_SUPABASE_URL
const supabaseAnonKey = 
  import.meta.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail fast at startup if required environment variables are missing.
// This prevents confusing runtime errors deeper in the application.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[VotEth] Missing Supabase environment variables.\n' +
    'Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY\n' +
    'Copy .env.example to .env.local and fill in your Supabase project values.\n' +
    'See: docs/setup/environment-setup.md'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage across browser refreshes (AUTH-06)
    persistSession: true,
    // Auto-refresh the session token before expiry
    autoRefreshToken: true,
    // Detect session from URL hash (required for magic link + OAuth callbacks)
    detectSessionInUrl: true,
  },
  realtime: {
    // Realtime connection params — used for live vote counts (ANLT-01) and fraud alerts (AI-02)
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      // Optional: add client version header for debugging
      'x-voteth-client': 'voteth-frontend/0.1.0',
    },
  },
})

// Export a typed version once database types are generated (Volume III)
// export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, { ... })
