// functions/api/auth/login.js
import { getCORS, res, preflight, supabase, signToken, verifyPassword, calcStreak } from './_utils.js';

export async function onRequestPost({ request, env }) {
  const cors = getCORS(env);
  try {
    const { email, password } = await request.json();
    if (!email || !password)
      return res(400, { error: 'Email and password required' }, cors);

    const { data: users } = await supabase(env, 'GET',
      `users?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&select=*`
    );
    if (!users?.length)
      return res(404, { error: 'No account found with this email' }, cors);

    const user = users[0];
    const valid = await verifyPassword(password, user.password);
    if (!valid) return res(401, { error: 'Incorrect password' }, cors);

    const updated = calcStreak({ ...user });
    updated.last_login = new Date().toISOString();

    await supabase(env, 'PATCH', `users?id=eq.${user.id}`, {
      streak:      updated.streak,
      best_streak: updated.best_streak,
      last_active: updated.last_active,
      last_login:  updated.last_login,
    });

    const token = await signToken(
      { id: updated.id, email: updated.email, name: updated.name, plan: updated.plan },
      env.JWT_SECRET
    );
    return res(200, {
      token,
      user: {
        id:             updated.id,
        name:           updated.name,
        email:          updated.email,
        plan:           updated.plan,
        streak:         updated.streak,
        best_streak:    updated.best_streak,
        total_minutes:  updated.total_minutes,
        total_sessions: updated.total_sessions,
      },
    }, cors);
  } catch (e) {
    return res(500, { error: e.message }, cors);
  }
}

export async function onRequestOptions({ env }) {
  return preflight(getCORS(env));
}
