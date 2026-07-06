import crypto from 'node:crypto';
import { serialize, parse } from 'cookie';

export const SESSION_COOKIE = 'session_id';
export const STATE_COOKIE = 'oauth_state';

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  return parse(header)[name];
}

export function setCookie(res, name, value, options = {}) {
  const cookieStr = serialize(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    ...options,
  });
  const existing = res.getHeader('Set-Cookie');
  const cookies = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  cookies.push(cookieStr);
  res.setHeader('Set-Cookie', cookies);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

export function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
