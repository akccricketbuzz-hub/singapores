// functions/api/admin/users.js
// Rate Limiting Guidance:
// This endpoint (/api/admin/*) should be protected by a Cloudflare Rate Limiting Rule
// configured in the Cloudflare dashboard to prevent abuse and brute force attacks.

import { getCORS, res, preflight, supabase, timingSafeEqual } from '../../_utils.js';

export async function onRequestGet({ request, env }) {
  const cors = getCORS(env);
  const adminKey = request.headers.get('x-admin-key');
  if (!adminKey || !timingSafeEqual(adminKey, env.ADMIN_KEY || '')) {
    return res(403, { error: 'Forbidden' }, cors);
  }

  const { data: users, ok } = await supabase(env, 'GET',
    'users?select=id,name,email,plan,streak,best_streak,total_minutes,total_sessions,created_at,last_login&order=created_at.desc'
  );
  if (!ok) return res(500, { error: 'Could not fetch users' }, cors);

  return res(200, {
    total: users.length,
    free:  users.filter(u => u.plan === 'free').length,
    pro:   users.filter(u => u.plan === 'pro').length,
    users,
  }, cors);
}

export async function onRequestOptions({ env }) {
  return preflight(getCORS(env));
}
