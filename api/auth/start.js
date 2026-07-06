import { randomToken, setCookie, getBaseUrl, STATE_COOKIE } from '../../lib/session.js';

export default function handler(req, res) {
  const state = randomToken(16);
  setCookie(res, STATE_COOKIE, state, { maxAge: 600 });

  const params = new URLSearchParams({
    client_id: process.env.WEBFLOW_CLIENT_ID,
    redirect_uri: `${getBaseUrl(req)}/api/auth/callback`,
    response_type: 'code',
    scope: 'cms:read',
    state,
  });

  res.writeHead(302, { Location: `https://webflow.com/oauth/authorize?${params.toString()}` });
  res.end();
}
