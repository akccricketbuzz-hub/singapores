// functions/api/sessions.js
import { getCORS, res, preflight, supabase, verifyToken, parseBody } from '../_utils.js';

const ALLOWED_TYPES = ['om', 'breathing', 'meditation', 'focus', 'sleep', 'learning', 'custom'];

export async function onRequest({ request, env }) {
  const cors = getCORS(env);
  if (request.method === 'OPTIONS') return preflight(cors);

  let tokenUser;
  try { tokenUser = await verifyToken(request, env.JWT_SECRET); }
  catch { return res(401, { error: 'Invalid or expired token' }, cors); }

  if (request.method === 'GET') {
    const { data: sessions } = await supabase(env, 'GET',
      `sessions?user_id=eq.${tokenUser.id}&order=logged_at.desc&limit=50&select=*`
    );
    const { data: stats } = await supabase(env, 'GET',
      `users?id=eq.${tokenUser.id}&select=total_minutes,total_sessions,streak,best_streak`
    );
    return res(200, { sessions: sessions || [], stats: stats?.[0] || {} }, cors);
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await parseBody(request);
    } catch (e) {
      return res(400, { error: e.message }, cors);
    }
    const { type, minutes = 0, chunk = '' } = body;

    const mins = Number(minutes);
    if (isNaN(mins) || mins < 0 || mins > 300) {
      return res(400, { error: 'Minutes must be a number between 0 and 300' }, cors);
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return res(400, { error: 'Invalid session type' }, cors);
    }

    const { data: dbUser } = await supabase(env, 'GET', `users?id=eq.${tokenUser.id}&select=plan`);
    const plan = dbUser?.[0]?.plan || 'free';

    if (type === 'om' && plan !== 'pro') {
      return res(403, { error: 'OM Resonance is a Pro feature', upgrade: true }, cors);
    }

    const { data, ok } = await supabase(env, 'POST', 'sessions', {
      user_id:   tokenUser.id,
      type,
      minutes:   mins,
      chunk,
      logged_at: new Date().toISOString(),
    });
    if (!ok) return res(500, { error: 'Could not log session' }, cors);

    await supabase(env, 'POST', 'rpc/increment_user_stats', {
      user_id: tokenUser.id,
      mins: mins
    });

    return res(201, Array.isArray(data) ? data[0] : data, cors);
  }

  return res(405, { error: 'Method not allowed' }, cors);
}
