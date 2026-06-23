// functions/api/kit.js
import { getCORS, res, preflight, supabase, verifyToken } from './_utils.js';

export async function onRequest({ request, env }) {
  const cors = getCORS(env);
  if (request.method === 'OPTIONS') return preflight(cors);

  let user;
  try { user = await verifyToken(request, env.JWT_SECRET); }
  catch { return res(401, { error: 'Invalid or expired token' }, cors); }

  if (request.method === 'GET') {
    const { data } = await supabase(env, 'GET', `kit_reflections?user_id=eq.${user.id}&select=*`);
    return res(200, data || [], cors);
  }

  if (request.method === 'POST') {
    const { pillar, inputs } = await request.json();
    if (!pillar) return res(400, { error: 'pillar is required' }, cors);

    const { data: existing } = await supabase(env, 'GET',
      `kit_reflections?user_id=eq.${user.id}&pillar=eq.${encodeURIComponent(pillar)}&select=id`
    );

    let result;
    if (existing?.length) {
      result = await supabase(env, 'PATCH',
        `kit_reflections?user_id=eq.${user.id}&pillar=eq.${encodeURIComponent(pillar)}`,
        { inputs: inputs || [], saved_at: new Date().toISOString() }
      );
    } else {
      result = await supabase(env, 'POST', 'kit_reflections', {
        user_id:  user.id,
        pillar,
        inputs:   inputs || [],
        saved_at: new Date().toISOString(),
      });
    }
    const saved = Array.isArray(result.data) ? result.data[0] : result.data;
    return res(200, saved || { pillar, inputs }, cors);
  }

  return res(405, { error: 'Method not allowed' }, cors);
}
