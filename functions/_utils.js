// functions/_utils.js
// Shared helpers for all Cloudflare Pages Functions

// ── CORS headers ──────────────────────────────────────────
export function getCORS(env) {
  return {
    'Access-Control-Allow-Origin':  env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

// ── Standard JSON response ────────────────────────────────
export function res(statusCode, body, cors) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ── Preflight ─────────────────────────────────────────────
export function preflight(cors) {
  return new Response(null, { status: 204, headers: cors });
}

// ── Supabase fetch helper (no SDK needed in CF Workers) ───
export async function supabase(env, method, path, body = null) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey':        env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        method === 'POST' ? 'return=representation' : 'return=representation',
  };
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const data = await response.json();
  return { data, status: response.status, ok: response.ok };
}

// ── JWT sign (manual, no library needed in CF Workers) ────
export async function signToken(payload, secret) {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const body    = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data    = `${header}.${body}`;
  const key     = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig     = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64  = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sigB64}`;
}

// ── JWT verify ────────────────────────────────────────────
export async function verifyToken(request, secret) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) throw new Error('No token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  // Verify signature
  const key  = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sig  = Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  // Decode payload
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

// ── Hash password using Web Crypto ────────────────────────
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const key     = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits    = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

// ── Verify password ───────────────────────────────────────
export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt    = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const key     = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits    = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const newHash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return newHash === hashHex;
}

// ── Today YYYY-MM-DD ──────────────────────────────────────
export function today() {
  return new Date().toISOString().split('T')[0];
}

// ── Yesterday ─────────────────────────────────────────────
export function yesterday() {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

// ── Streak calculator ─────────────────────────────────────
export function calcStreak(user) {
  const t = today(), y = yesterday();
  if (user.last_active === t)  return user;
  if (user.last_active === y)  user.streak = (user.streak || 0) + 1;
  else                         user.streak = 1;
  user.best_streak = Math.max(user.best_streak || 0, user.streak);
  user.last_active = t;
  return user;
}
