import { handleOptions, json } from '../_shared/cors.ts';
import { requireAdminFromRequest, supabaseService } from '../_shared/supabase.ts';
import { asBoolean, isUuid } from '../_shared/validation.ts';

function isCustomerCode(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}$/.test(value);
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method === 'POST') {
    const auth = await requireAdminFromRequest(req);
    if (!auth.ok) return json({ error: auth.message }, auth.status);

    const payload = await req.json().catch(() => null);
    const parkId = payload?.park_id;
    const customerCode = payload?.customer_code;
    const cameraName = typeof payload?.camera_name === 'string' ? payload.camera_name : null;
    const attractionId = isUuid(payload?.attraction_id) ? payload.attraction_id : null;
    const isActive = asBoolean(payload?.is_active, true);

    if (!isUuid(parkId) || !isCustomerCode(customerCode)) {
      return json({ error: 'Invalid payload: park_id and 4-digit customer_code are required' }, 400);
    }

    const { data: existingCamera, error: existingCameraError } = await supabaseService
      .from('park_cameras')
      .select('id')
      .eq('park_id', parkId)
      .eq('customer_code', customerCode)
      .maybeSingle();

    if (existingCameraError) return json({ error: existingCameraError.message }, 400);

    if (existingCamera) {
      const { error: updateError } = await supabaseService
        .from('park_cameras')
        .update({
          camera_name: cameraName,
          attraction_id: attractionId,
          is_active: isActive,
        })
        .eq('id', existingCamera.id);

      if (updateError) return json({ error: updateError.message }, 400);
      return json({ ok: true, data: { id: existingCamera.id } });
    }

    const { data, error } = await supabaseService
      .from('park_cameras')
      .insert({
        id: crypto.randomUUID(),
        park_id: parkId,
        customer_code: customerCode,
        camera_name: cameraName,
        attraction_id: attractionId,
        is_active: isActive,
      })
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

    const { error } = await supabaseService.from('park_cameras').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        return json(
          { error: 'Kamera kann nicht gelöscht werden, solange sie noch in abhängigen Datensätzen referenziert ist.' },
          409,
        );
      }
      return json({ error: error.message }, 400);
    }

    return json({ ok: true, data: { id } });
  }

  return json({ error: 'Method not allowed' }, 405);
});
