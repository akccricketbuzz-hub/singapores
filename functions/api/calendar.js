// functions/api/calendar.js
import { getCORS, res, preflight, supabase, verifyToken } from './_utils.js';

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
    const { dates } = await request.json();
    if (!Array.isArray(dates)) return res(400, { error: 'dates must be an array' }, cors);

    const { data: existing } = await supabase(env, 'GET', `calendar?user_id=eq.${user.id}&select=id`);
    if (existing?.length) {
      await supabase(env, 'PATCH', `calendar?user_id=eq.${user.id}`, {
        dates, submitted_at: new Date().toISOString(),
      });
    } else {
      await supabase(env, 'POST', 'calendar', {
        user_id: user.id, dates, submitted_at: new Date().toISOString(),
      });
    }
    return res(200, { dates, submitted: true }, cors);
  }

  return res(405, { error: 'Method not allowed' }, cors);
}
