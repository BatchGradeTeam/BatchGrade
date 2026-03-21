// Set up Supabase client

import { createClient } from '@supabase/supabase-js'

const supabaseURL = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY

if (!supabaseURL || !supabaseKey) {
  throw new Error('Missing Supabase environmental variables.')
}

const supabase = createClient(supabaseURL, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
})

export { supabase }