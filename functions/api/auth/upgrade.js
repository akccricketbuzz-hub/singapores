// functions/api/auth/upgrade.js
import { getCORS, res, preflight, supabase, verifyToken, signToken } from './_utils.js';

export async function onRequestPatch({ request, env }) {
  const cors = getCORS(env);
  try {
    const tokenUser = await verifyToken(request, env.JWT_SECRET);
    const { data, ok } = await supabase(env, 'PATCH', `users?id=eq.${tokenUser.id}`, {
      plan:        'pro',
      upgraded_at: new Date().toISOString(),
    });
    if (!ok) return res(500, { error: 'Upgrade failed' }, cors);
    const user  = Array.isArray(data) ? data[0] : data;
    const token = await signToken(
      { id: user.id, email: user.email, name: user.name, plan: user.plan },
      env.JWT_SECRET
    );
    return res(200, { token, user }, cors);
  } catch (e) {
    return res(401, { error: 'Invalid or expired token' }, cors);
  }
}

export async function onRequestOptions({ env }) {
  return preflight(getCORS(env));
}
