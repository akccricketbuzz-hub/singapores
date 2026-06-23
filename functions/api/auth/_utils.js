// functions/_utils.js
// Shared helpers for all Cloudflare Pages Functions

export function getCORS(env) {
  return {
    'Access-Control-Allow-Origin':  env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

export function res(statusCode, body, cors) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export function preflight(cors) {
  return new Response(null, { status: 204, headers: cors });
}

// Supabase REST API helper - no SDK needed
export async function supabase(env, method, path, body = null) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey':        env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const data = await response.json();
  return { data, status: response.status, ok: response.ok };
}

// JWT sign using Web Crypto (no library needed)
export async function signToken(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 }));
  const data   = `${header}.${body}`;
  const key    = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64urlBytes(new Uint8Array(sig))}`;
}

function b64url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function b64urlBytes(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

// JWT verify
export async function verifyToken(request, secret) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) throw new Error('No token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')))));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

// Password hash using PBKDF2
export async function hashPassword(password) {
  const salt   = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2,'0')).join('');
  const key    = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits   = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' }, key, 256);
  const hash   = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join('');
  return `${saltHex}:${hash}`;
}

// Password verify
export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt  = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b,16)));
  const key   = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits  = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' }, key, 256);
  const hash  = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join('');
  return hash === hashHex;
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function yesterday() {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

export function calcStreak(user) {
  const t = today(), y = yesterday();
  if (user.last_active === t)  return user;
  if (user.last_active === y)  user.streak = (user.streak || 0) + 1;
  else                         user.streak = 1;
  user.best_streak = Math.max(user.best_streak || 0, user.streak);
  user.last_active = t;
  return user;
}
