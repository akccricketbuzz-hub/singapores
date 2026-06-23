// functions/api/sessions.js
import { getCORS, res, preflight, supabase, verifyToken } from './_utils.js';

export async function onRequest({ request, env }) {
  const cors = getCORS(env);
  if (request.method === 'OPTIONS') return preflight(cors);

  let user;
  try { user = await verifyToken(request, env.JWT_SECRET); }
  catch { return res(401, { error: 'Invalid or expired token' }, cors); }

  if (request.method === 'GET') {
    const { data: sessions } = await supabase(env, 'GET',
      `sessions?user_id=eq.${user.id}&order=logged_at.desc&limit=50&select=*`
    );
    const { data: stats } = await supabase(env, 'GET',
      `users?id=eq.${user.id}&select=total_minutes,total_sessions,streak,best_streak`
    );
    return res(200, { sessions: sessions || [], stats: stats?.[0] || {} }, cors);
  }

  if (request.method === 'POST') {
    const { type, minutes = 0, chunk = '' } = await request.json();

    if (type === 'om' && user.plan !== 'pro') {
      return res(403, { error: 'OM Resonance is a Pro feature', upgrade: true }, cors);
    }

    const { data, ok } = await supabase(env, 'POST', 'sessions', {
      user_id:   user.id,
      type,
      minutes,
      chunk,
      logged_at: new Date().toISOString(),
    });
    if (!ok) return res(500, { error: 'Could not log session' }, cors);

    const { data: u } = await supabase(env, 'GET', `users?id=eq.${user.id}&select=total_minutes,total_sessions`);
    if (u?.[0]) {
      await supabase(env, 'PATCH', `users?id=eq.${user.id}`, {
        total_minutes:  (u[0].total_minutes || 0) + minutes,
        total_sessions: (u[0].total_sessions || 0) + 1,
      });
    }
    return res(201, Array.isArray(data) ? data[0] : data, cors);
  }

  return res(405, { error: 'Method not allowed' }, cors);
}
