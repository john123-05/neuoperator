import { handleOptions, json } from '../_shared/cors.ts';
import { requireAdminFromRequest, supabaseService } from '../_shared/supabase.ts';
import { asBoolean, isNonEmptyString, isUuid } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method === 'POST') {
    const auth = await requireAdminFromRequest(req);
    if (!auth.ok) return json({ error: auth.message }, auth.status);

    const payload = await req.json().catch(() => null);
    const parkId = payload?.park_id;
    const pathPrefix = payload?.path_prefix;
    const isActive = asBoolean(payload?.is_active, true);

    if (!isUuid(parkId) || !isNonEmptyString(pathPrefix)) {
      return json({ error: 'Invalid payload: park_id and path_prefix are required' }, 400);
    }

    const normalizedPrefix = pathPrefix.trim();

    const { data: existingPrefix, error: existingPrefixError } = await supabaseService
      .from('park_path_prefixes')
      .select('id')
      .eq('path_prefix', normalizedPrefix)
      .maybeSingle();

    if (existingPrefixError) return json({ error: existingPrefixError.message }, 400);

    if (existingPrefix) {
      const { error: updateError } = await supabaseService
        .from('park_path_prefixes')
        .update({ park_id: parkId, is_active: isActive })
        .eq('id', existingPrefix.id);

      if (updateError) return json({ error: updateError.message }, 400);
      return json({ ok: true, data: { id: existingPrefix.id } });
    }

    const { data, error } = await supabaseService
      .from('park_path_prefixes')
      .insert({ id: crypto.randomUUID(), park_id: parkId, path_prefix: normalizedPrefix, is_active: isActive })
      .select('id')
      .single();

    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, data });
  }

  if (req.method === 'DELETE') {
    const auth = await requireAdminFromRequest(req);
    if (!auth.ok) return json({ error: auth.message }, auth.status);

    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) {
      return json({ error: 'Invalid id' }, 400);
    }

    const { error } = await supabaseService.from('park_path_prefixes').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        return json({ error: 'Prefix kann nicht gelöscht werden, solange abhängige Datensätze bestehen.' }, 409);
      }
      return json({ error: error.message }, 400);
    }

    return json({ ok: true, data: { id } });
  }

  return json({ error: 'Method not allowed' }, 405);
});
