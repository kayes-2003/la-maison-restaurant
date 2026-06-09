import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_PROJECT')) {
  console.warn(
    '[Supabase] ⚠️  Missing or placeholder env vars.\n' +
    'Copy .env.example → .env and fill in your credentials.\n' +
    'See README.md → Quick Start for full instructions.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '')
