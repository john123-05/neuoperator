import { handleOptions, json } from '../_shared/cors.ts';
import { parseFilename } from '../_shared/parser.ts';
import { requireAdminFromRequest, supabaseService } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAdminFromRequest(req);
  if (!auth.ok) return json({ error: auth.message }, auth.status);

  const path = new URL(req.url).searchParams.get('path') || '';
  if (!path) return json({ error: 'Missing ?path=' }, 400);

  const parsed = parseFilename(path);

  let matchedParkId: string | null = null;
  let matchedParkName: string | null = null;
  let matchedCustomerCode: string | null = null;
  let matchedAttractionId: string | null = null;
  let matchedAttractionName: string | null = null;

  if (parsed.prefix) {
    const { data: prefixRow } = await supabaseService
      .from('park_path_prefixes')
      .select('park_id, parks(name)')
      .eq('path_prefix', parsed.prefix)
      .eq('is_active', true)
      .maybeSingle();

    if (prefixRow?.park_id) {
      matchedParkId = prefixRow.park_id;
      matchedParkName = (prefixRow.parks as { name?: string } | null)?.name || null;
    }
  }

  if (matchedParkId) {
    const customerCodeCandidates = [parsed.customerCode, parsed.legacyCustomerCode].filter(
      (value, index, arr): value is string => !!value && arr.indexOf(value) === index,
    );

    for (const candidateCode of customerCodeCandidates) {
      const { data: cameraRow } = await supabaseService
        .from('park_cameras')
        .select('attraction_id')
        .eq('park_id', matchedParkId)
        .eq('customer_code', candidateCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!cameraRow?.attraction_id) continue;
      matchedCustomerCode = candidateCode;
      matchedAttractionId = cameraRow.attraction_id;
      break;
    }

    if (matchedAttractionId) {
      const { data: attrRow } = await supabaseService
        .from('attractions')
        .select('name')
        .eq('id', matchedAttractionId)
        .maybeSingle();
      matchedAttractionName = attrRow?.name || null;
    }
  }

  return json({
    ok: true,
    data: {
      ...parsed,
      matchedParkId,
      matchedParkName,
      matchedCustomerCode,
      matchedAttractionId,
      matchedAttractionName,
    },
  });
});
