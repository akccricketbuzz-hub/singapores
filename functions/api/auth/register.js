// functions/api/auth/register.js
import { getCORS, res, preflight, supabase, signToken, hashPassword, today } from './_utils.js';

export async function onRequestPost({ request, env }) {
  const cors = getCORS(env);
  try {
    const { name, email, password } = await request.json();
    if (!name || !email || !password)
      return res(400, { error: 'Name, email and password are required' }, cors);
    if (password.length < 6)
      return res(400, { error: 'Password must be at least 6 characters' }, cors);

    const { data: existing } = await supabase(env, 'GET',
      `users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`
    );
    if (existing?.length > 0)
      return res(409, { error: 'Email already registered' }, cors);

    const hashed = await hashPassword(password);

    const { data, ok } = await supabase(env, 'POST', 'users', {
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

    if (!ok) return res(500, { error: 'Could not create user' }, cors);
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
