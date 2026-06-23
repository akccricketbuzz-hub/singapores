// functions/api/auth/register.js
// Rate Limiting Guidance:
// This endpoint (/api/auth/register) should be protected by a Cloudflare Rate Limiting Rule
// configured in the Cloudflare dashboard to prevent abuse and brute force attacks.

import { getCORS, res, preflight, supabase, signToken, hashPassword, today, parseBody } from '../../_utils.js';

export async function onRequestPost({ request, env }) {
  const cors = getCORS(env);
  try {
    let body;
    try {
      body = await parseBody(request);
    } catch (e) {
      return res(400, { error: e.message }, cors);
    }

    const { name, email, password } = body;
    if (!name || !email || !password)
      return res(400, { error: 'Name, email and password are required' }, cors);
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res(400, { error: 'Invalid email format' }, cors);

    if (password.length < 6)
      return res(400, { error: 'Password must be at least 6 characters' }, cors);

    const hashed = await hashPassword(password);

    const { data, ok, status } = await supabase(env, 'POST', 'users', {
      name:           name.trim(),
      email:          email.toLowerCase().trim(),
      password:       hashed,
      plan:           'free',
      streak:         1,
      best_streak:    1,
      last_active:    today(),
      total_minutes:  0,
      total_sessions: 0,
    });

    if (!ok) {
      if (status === 409) return res(409, { error: 'Email already registered' }, cors);
      return res(500, { error: 'Could not create user' }, cors);
    }
    const user = Array.isArray(data) ? data[0] : data;

    const token = await signToken(
      { id: user.id, email: user.email, name: user.name, plan: user.plan },
      env.JWT_SECRET
    );
    return res(201, {
      token,
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
    }, cors);
  } catch (e) {
    return res(500, { error: e.message }, cors);
  }
}

export async function onRequestOptions({ env }) {
  return preflight(getCORS(env));
}
