import { handleOptions, json } from '../_shared/cors.ts';
import { supabaseService } from '../_shared/supabase.ts';

const ticketColumns = [
  'id',
  'organization_id',
  'created_by',
  'subject',
  'description',
  'status',
  'priority',
  'created_at',
  'updated_at',
] as const;

const messageColumns = [
  'id',
  'ticket_id',
  'organization_id',
  'author_id',
  'author_role',
  'message',
  'created_at',
  'updated_at',
] as const;

type WebhookEvent = {
  type: string;
  table: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getSyncSecretFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return req.headers.get('x-support-sync-secret') || bearer;
}

function pickColumns<T extends readonly string[]>(
  source: Record<string, unknown> | null | undefined,
  columns: T,
): Partial<Record<T[number], unknown>> {
  if (!source) return {};
  const picked: Partial<Record<T[number], unknown>> = {};
  for (const col of columns) {
    const key = col as T[number];
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      picked[key] = source[key as string];
    }
  }
  return picked;
}

function toEvent(item: unknown): WebhookEvent | null {
  if (!item || typeof item !== 'object') return null;
  const maybe = item as Partial<WebhookEvent>;
  if (typeof maybe.type !== 'string' || typeof maybe.table !== 'string') return null;
  return {
    type: maybe.type,
    table: maybe.table,
    schema: typeof maybe.schema === 'string' ? maybe.schema : undefined,
    record: maybe.record && typeof maybe.record === 'object' ? maybe.record as Record<string, unknown> : null,
    old_record: maybe.old_record && typeof maybe.old_record === 'object'
      ? maybe.old_record as Record<string, unknown>
      : null,
  };
}

function normalizeEvents(body: unknown): WebhookEvent[] {
  const raw = (() => {
    if (Array.isArray(body)) return body;
    if (body && typeof body === 'object' && 'payload' in body) {
      const payload = (body as { payload?: unknown }).payload;
      return Array.isArray(payload) ? payload : [payload];
    }
    return [body];
  })();

  const events: WebhookEvent[] = [];
  for (const item of raw) {
    const event = toEvent(item);
    if (event) events.push(event);
  }
  return events;
}

async function upsertTicket(record: Record<string, unknown>) {
  const row = pickColumns(record, ticketColumns);
  if (typeof row.id !== 'string') {
    return { ok: false as const, message: 'support_tickets event missing id' };
  }

  const { error } = await supabaseService.from('support_tickets').upsert(row, { onConflict: 'id' });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

async function upsertMessage(record: Record<string, unknown>) {
  const row = pickColumns(record, messageColumns);
  if (typeof row.id !== 'string') {
    return { ok: false as const, message: 'support_ticket_messages event missing id' };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await supabaseService.from('support_ticket_messages').upsert(row, { onConflict: 'id' });

    if (!error) return { ok: true as const };
    if (error.code !== '23503' || attempt === 4) {
      return { ok: false as const, message: error.message };
    }

    await wait(250 * (attempt + 1));
  }

  return { ok: false as const, message: 'support_ticket_messages upsert retry exhausted' };
}

async function deleteById(table: 'support_tickets' | 'support_ticket_messages', id: string) {
  const { error } = await supabaseService.from(table).delete().eq('id', id);
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const secret = Deno.env.get('SUPPORT_SYNC_SECRET');
  if (!secret) {
    return json({ error: 'Missing SUPPORT_SYNC_SECRET in environment' }, 500);
  }

  const providedSecret = getSyncSecretFromRequest(req);
  if (!providedSecret || providedSecret !== secret) {
    return json({ error: 'Unauthorized support sync request' }, 401);
  }

  const requestBody = await req.json().catch(() => null);
  if (!requestBody) {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const events = normalizeEvents(requestBody);
  if (!events.length) {
    return json({ error: 'No valid webhook events found in payload' }, 400);
  }

  let processed = 0;
  let ignored = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const event of events) {
    const eventType = event.type.toUpperCase();
    const table = event.table;
    const isPublicSchema = !event.schema || event.schema === 'public';

    if (!isPublicSchema || (table !== 'support_tickets' && table !== 'support_ticket_messages')) {
      ignored += 1;
      continue;
    }

    const record = event.record || null;
    const oldRecord = event.old_record || null;

    let result: { ok: true } | { ok: false; message: string } = { ok: true };

    if (eventType === 'DELETE') {
      const deletedId = (oldRecord?.id ?? record?.id) as string | undefined;
      if (!deletedId) {
        result = { ok: false, message: `${table} DELETE event missing id` };
      } else {
        result = await deleteById(table, deletedId);
      }
    } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (!record) {
        result = { ok: false, message: `${table} ${eventType} event missing record` };
      } else if (table === 'support_tickets') {
        result = await upsertTicket(record);
      } else {
        result = await upsertMessage(record);
      }
    } else {
      ignored += 1;
      continue;
    }

    if (result.ok) {
      processed += 1;
    } else {
      failed += 1;
      failures.push(result.message);
    }
  }

  if (failed > 0) {
    return json({ ok: false, processed, ignored, failed, failures }, 500);
  }

  return json({ ok: true, processed, ignored, failed });
});
