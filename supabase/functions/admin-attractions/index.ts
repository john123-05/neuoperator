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
    const slug = payload?.slug;
    const name = payload?.name;
    const isActive = asBoolean(payload?.is_active, true);

    if (!isUuid(parkId) || !isNonEmptyString(slug) || !isNonEmptyString(name)) {
      return json({ error: 'Invalid payload: park_id, slug and name are required' }, 400);
    }

    const normalizedSlug = slug.trim();

    const { data: existingAttraction, error: existingAttractionError } = await supabaseService
      .from('attractions')
      .select('id')
      .eq('park_id', parkId)
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (existingAttractionError) return json({ error: existingAttractionError.message }, 400);

    if (existingAttraction) {
      const { error: updateError } = await supabaseService
        .from('attractions')
        .update({ name: name.trim(), is_active: isActive })
        .eq('id', existingAttraction.id);

      if (updateError) return json({ error: updateError.message }, 400);
      return json({ ok: true, data: { id: existingAttraction.id } });
    }

    const { data, error } = await supabaseService
      .from('attractions')
      .insert({ id: crypto.randomUUID(), park_id: parkId, slug: normalizedSlug, name: name.trim(), is_active: isActive })
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

    const { error } = await supabaseService.from('attractions').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        return json(
          { error: 'Attraktion kann nicht gelöscht werden, solange sie noch verwendet wird (z. B. in Fotos oder Kamera-Mappings).' },
          409,
        );
      }
      return json({ error: error.message }, 400);
    }

    return json({ ok: true, data: { id } });
  }

  return json({ error: 'Method not allowed' }, 405);
});
