import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const anon = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabaseBrowser = createClient(url, anon);
