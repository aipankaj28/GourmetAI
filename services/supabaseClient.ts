import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Masked logging for debugging Railway/Production issues
const maskedKey = supabaseAnonKey
    ? `${supabaseAnonKey.substring(0, 4)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 4)}`
    : 'MISSING';

console.log('SUPABASE_CONFIG_CHECK:', {
    url: supabaseUrl ? 'PRESENT' : 'MISSING',
    key: maskedKey,
    origin: window.location.origin
});

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('CRITICAL: Supabase URL or Anon Key is missing. Database features will not work.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
