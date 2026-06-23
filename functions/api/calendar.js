// functions/api/calendar.js
import { getCORS, res, preflight, supabase, verifyToken, parseBody } from '../_utils.js';

export async function onRequest({ request, env }) {
  const cors = getCORS(env);
  if (request.method === 'OPTIONS') return preflight(cors);

  let user;
  try { user = await verifyToken(request, env.JWT_SECRET); }
  catch { return res(401, { error: 'Invalid or expired token' }, cors); }

  if (request.method === 'GET') {
    const { data } = await supabase(env, 'GET', `calendar?user_id=eq.${user.id}&select=dates,submitted_at`);
    return res(200, { dates: data?.[0]?.dates || [] }, cors);
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await parseBody(request);
    } catch (e) {
      return res(400, { error: e.message }, cors);
    }
    const { dates } = body;
    if (!Array.isArray(dates)) return res(400, { error: 'dates must be an array' }, cors);

    await supabase(env, 'POST', 'calendar?on_conflict=user_id', {
      user_id: user.id, dates, submitted_at: new Date().toISOString()
    }, { Prefer: 'resolution=merge-duplicates' });

    return res(200, { dates, submitted: true }, cors);
  }

  return res(405, { error: 'Method not allowed' }, cors);
}
