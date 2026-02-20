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
    const name = payload?.name;
    const slug = payload?.slug;
    const isActive = asBoolean(payload?.is_active, true);

    if (!isNonEmptyString(name) || !isNonEmptyString(slug)) {
      return json({ error: 'Invalid payload: name and slug are required' }, 400);
    }

    const normalizedSlug = slug.trim();

    const { data: existingPark, error: existingParkError } = await supabaseService
      .from('parks')
      .select('id')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (existingParkError) return json({ error: existingParkError.message }, 400);

    let parkId: string;

    if (existingPark) {
      const { error: updateError } = await supabaseService
        .from('parks')
        .update({ name: name.trim(), is_active: isActive })
        .eq('id', existingPark.id);

      if (updateError) return json({ error: updateError.message }, 400);
      parkId = existingPark.id;
    } else {
      const { data: insertedPark, error: insertError } = await supabaseService
        .from('parks')
        .insert({ id: crypto.randomUUID(), name: name.trim(), slug: normalizedSlug, is_active: isActive })
        .select('id')
        .single();

      if (insertError) return json({ error: insertError.message }, 400);
      parkId = insertedPark.id;
    }

    const { data: existingPrefix, error: existingPrefixError } = await supabaseService
      .from('park_path_prefixes')
      .select('id')
      .eq('path_prefix', normalizedSlug)
      .maybeSingle();

    if (existingPrefixError) return json({ error: existingPrefixError.message }, 400);

    if (existingPrefix) {
      const { error: updatePrefixError } = await supabaseService
        .from('park_path_prefixes')
        .update({ park_id: parkId, is_active: true })
        .eq('id', existingPrefix.id);

      if (updatePrefixError) return json({ error: updatePrefixError.message }, 400);
    } else {
      const { error: insertPrefixError } = await supabaseService
        .from('park_path_prefixes')
        .insert({ id: crypto.randomUUID(), park_id: parkId, path_prefix: normalizedSlug, is_active: true });

      if (insertPrefixError) return json({ error: insertPrefixError.message }, 400);
    }

    return json({ ok: true, data: { id: parkId } });
  }

  if (req.method === 'DELETE') {
    const auth = await requireAdminFromRequest(req);
    if (!auth.ok) return json({ error: auth.message }, auth.status);

    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) {
      return json({ error: 'Invalid id' }, 400);
    }

    const { error } = await supabaseService.from('parks').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        return json(
          { error: 'Park kann nicht gelöscht werden, solange abhängige Datensätze existieren (z. B. Fotos, Attraktionen, Kameras).' },
          409,
        );
      }
      return json({ error: error.message }, 400);
    }

    return json({ ok: true, data: { id } });
  }

  return json({ error: 'Method not allowed' }, 405);
});
