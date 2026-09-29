import { randomToken, setCookie, getBaseUrl, STATE_COOKIE } from '../../lib/session.js';

export default function handler(req, res) {
  // La cookie de state solo vale en el dominio donde se crea. Si alguien entra por un
  // dominio distinto al canónico (p. ej. una URL de preview), lo mandamos al canónico primero.
  const canonical = getBaseUrl(req);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (process.env.APP_URL && host && new URL(canonical).host !== host) {
    res.writeHead(302, { Location: `${canonical}/api/auth/start` });
    res.end();
    return;
  }

  const state = randomToken(16);
  setCookie(res, STATE_COOKIE, state, { maxAge: 600 });

  const params = new URLSearchParams({
    client_id: process.env.WEBFLOW_CLIENT_ID,
    redirect_uri: `${getBaseUrl(req)}/api/auth/callback`,
    response_type: 'code',
    scope: 'cms:read sites:read',
    state,
  });

  res.writeHead(302, { Location: `https://webflow.com/oauth/authorize?${params.toString()}` });
  res.end();
}
