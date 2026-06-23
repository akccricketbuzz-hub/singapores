// functions/api/auth/me.js
import { getCORS, res, preflight, supabase, verifyToken } from '../../_utils.js';

export async function onRequestGet({ request, env }) {
  const cors = getCORS(env);
  try {
    const user = await verifyToken(request, env.JWT_SECRET);
    const { data: users } = await supabase(env, 'GET',
      `users?id=eq.${user.id}&select=id,name,email,plan,streak,best_streak,total_minutes,total_sessions,created_at`
    );
    if (!users?.length) return res(404, { error: 'User not found' }, cors);
    return res(200, users[0], cors);
  } catch (e) {
    return res(401, { error: 'Invalid or expired token' }, cors);
  }
}

export async function onRequestOptions({ env }) {
  return preflight(getCORS(env));
}
