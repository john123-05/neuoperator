import { handleOptions, json } from '../_shared/cors.ts';
import { isNonEmptyString, isUuid } from '../_shared/validation.ts';
import { requireAdminFromRequest, supabaseService } from '../_shared/supabase.ts';

const ticketColumns = 'id, organization_id, created_by, subject, description, status, priority, created_at, updated_at';
const messageColumns =
  'id, ticket_id, organization_id, author_id, author_role, message, created_at, updated_at';

const allowedStatuses = new Set(['open', 'in_progress', 'resolved', 'closed']);

type SupportSyncEvent = {
  type: 'INSERT' | 'UPDATE';
  table: 'support_tickets' | 'support_ticket_messages';
  schema: 'public';
  record: Record<string, unknown>;
};

async function forwardSupportSync(events: SupportSyncEvent[]) {
  const forwardUrl = Deno.env.get('SUPPORT_FORWARD_URL');
  if (!forwardUrl || !events.length) return null;

  const forwardSecret = Deno.env.get('SUPPORT_FORWARD_SECRET') || Deno.env.get('SUPPORT_SYNC_SECRET');

  try {
    const response = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(forwardSecret ? { 'x-support-sync-secret': forwardSecret } : {}),
      },
      body: JSON.stringify(events),
    });

    if (!response.ok) {
      const text = await response.text();
      return `forward sync failed (${response.status}): ${text.slice(0, 200)}`;
    }
  } catch (error) {
    return error instanceof Error ? `forward sync failed: ${error.message}` : 'forward sync failed';
  }

  return null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireAdminFromRequest(req);
  if (!auth.ok) return json({ error: auth.message }, auth.status);

  if (req.method === 'PATCH') {
    const payload = await req.json().catch(() => null);
    const ticketId = payload?.ticket_id;
    const status = payload?.status;

    if (!isUuid(ticketId) || typeof status !== 'string' || !allowedStatuses.has(status)) {
      return json({ error: 'Invalid payload: ticket_id and valid status are required' }, 400);
    }

    const { data: updatedTicket, error: updateError } = await supabaseService
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)
      .select(ticketColumns)
      .single();

    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    const warning = await forwardSupportSync([
      {
        type: 'UPDATE',
        table: 'support_tickets',
        schema: 'public',
        record: updatedTicket as Record<string, unknown>,
      },
    ]);

    return json({ ok: true, data: updatedTicket, warning });
  }

  if (req.method === 'POST') {
    const payload = await req.json().catch(() => null);
    const ticketId = payload?.ticket_id;
    const message = payload?.message;

    if (!isUuid(ticketId) || !isNonEmptyString(message)) {
      return json({ error: 'Invalid payload: ticket_id and message are required' }, 400);
    }

    const { data: ticket, error: ticketError } = await supabaseService
      .from('support_tickets')
      .select(ticketColumns)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return json({ error: ticketError?.message || 'Ticket not found' }, 404);
    }

    const { data: insertedMessage, error: insertError } = await supabaseService
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        organization_id: ticket.organization_id,
        author_id: auth.userId,
        author_role: 'operator',
        message: message.trim(),
      })
      .select(messageColumns)
      .single();

    if (insertError) {
      return json({ error: insertError.message }, 400);
    }

    let updatedTicket = ticket;
    if (ticket.status === 'open') {
      const { data: statusUpdatedTicket, error: statusError } = await supabaseService
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', ticketId)
        .select(ticketColumns)
        .single();

      if (!statusError && statusUpdatedTicket) {
        updatedTicket = statusUpdatedTicket;
      }
    }

    const syncEvents: SupportSyncEvent[] = [
      {
        type: 'INSERT',
        table: 'support_ticket_messages',
        schema: 'public',
        record: insertedMessage as Record<string, unknown>,
      },
    ];

    if (updatedTicket.status !== ticket.status) {
      syncEvents.push({
        type: 'UPDATE',
        table: 'support_tickets',
        schema: 'public',
        record: updatedTicket as Record<string, unknown>,
      });
    }

    const warning = await forwardSupportSync(syncEvents);

    return json({ ok: true, data: { ticket: updatedTicket, message: insertedMessage }, warning });
  }

  return json({ error: 'Method not allowed' }, 405);
});
