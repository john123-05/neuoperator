import { supabaseBrowser } from './supabase';

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !anonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const resolvedSupabaseUrl = supabaseUrl;
const resolvedAnonKey = anonKey;

const routeMap: Record<string, string> = {
  '/api/admin/parks': 'admin-parks',
  '/api/admin/park-prefixes': 'admin-park-prefixes',
  '/api/admin/attractions': 'admin-attractions',
  '/api/admin/park-cameras': 'admin-park-cameras',
  '/api/admin/preview-parse': 'admin-preview-parse',
  '/api/support-sync': 'support-sync',
};

async function normalizeHeaders(initHeaders?: HeadersInit): Promise<Headers> {
  const headers = new Headers(initHeaders || {});

  if (!headers.has('apikey')) {
    headers.set('apikey', resolvedAnonKey);
  }

  if (!headers.has('authorization')) {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
  }

  return headers;
}

function toEdgeUrl(input: string | URL): string | null {
  const parsed = new URL(typeof input === 'string' ? input : input.toString(), window.location.origin);
  const mappedFunction = routeMap[parsed.pathname];

  if (!mappedFunction) return null;

  return `${resolvedSupabaseUrl}/functions/v1/${mappedFunction}${parsed.search}`;
}

export async function edgeFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const edgeUrl = toEdgeUrl(input);
  if (!edgeUrl) {
    return fetch(input, init);
  }

  const headers = await normalizeHeaders(init.headers);
  return fetch(edgeUrl, { ...init, headers });
}
