import { handleOptions, json } from '../_shared/cors.ts';
import { requireAdminFromRequest, supabaseService } from '../_shared/supabase.ts';

const columns =
  'id, email, name, firma, attractionstyp, frage, antwort, spalte_1, submitted_at, created_at, updated_at';

type IncomingLead = {
  email?: unknown;
  name?: unknown;
  firma?: unknown;
  attractionstyp?: unknown;
  frage?: unknown;
  antwort?: unknown;
  spalte1?: unknown;
  timestamp?: unknown;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function buildImportKey(payload: {
  email: string;
  timestamp: string;
  name: string;
  frage: string;
  firma: string;
}): string {
  const normalize = (input: string) => input.trim().toLowerCase();
  return [
    normalize(payload.email),
    normalize(payload.timestamp),
    normalize(payload.name),
    normalize(payload.frage),
    normalize(payload.firma),
  ].join('|');
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireAdminFromRequest(req);
  if (!auth.ok) return json({ error: auth.message }, auth.status);

  if (req.method === 'GET') {
    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') || '500'), 2000);

    const { data, error } = await supabaseService
      .from('email_leads')
      .select(columns)
      .order('submitted_at', { ascending: false })
      .limit(Number.isFinite(limit) ? limit : 500);

    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, data: data || [] });
  }

  if (req.method === 'POST') {
    const payload = await req.json().catch(() => null);
    const rows = Array.isArray(payload?.rows) ? (payload.rows as IncomingLead[]) : null;

    if (!rows || rows.length === 0) {
      return json({ error: 'Invalid payload: rows[] is required' }, 400);
    }

    if (rows.length > 5000) {
      return json({ error: 'Too many rows. Maximum 5000 per import.' }, 400);
    }

    const upsertRows = rows.map((row) => {
      const email = asText(row.email);
      const name = asText(row.name);
      const firma = asText(row.firma);
      const attractionstyp = asText(row.attractionstyp);
      const frage = asText(row.frage);
      const antwort = asText(row.antwort);
      const spalte1 = asText(row.spalte1);
      const submittedAt = toTimestamp(row.timestamp);

      return {
        email,
        name,
        firma,
        attractionstyp,
        frage,
        antwort,
        spalte_1: spalte1,
        submitted_at: submittedAt,
        import_key: buildImportKey({ email, timestamp: submittedAt, name, frage, firma }),
      };
    });

    const { data, error } = await supabaseService
      .from('email_leads')
      .upsert(upsertRows, { onConflict: 'import_key' })
      .select(columns);

    if (error) return json({ error: error.message }, 400);

    return json({ ok: true, imported: upsertRows.length, data: data || [] });
  }

  return json({ error: 'Method not allowed' }, 405);
});
