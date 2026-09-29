import axios from 'axios';
import { readCookie, setCookie, clearCookie, randomToken, getBaseUrl, SESSION_COOKIE, STATE_COOKIE } from '../../lib/session.js';
import { encrypt } from '../../lib/crypto.js';
import { ensureSchema, upsertSite, createSession } from '../../lib/db.js';

const SESSION_TTL_DAYS = 30;

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  const cookieState = readCookie(req, STATE_COOKIE);

  if (error) {
    res.writeHead(302, { Location: '/?auth_error=' + encodeURIComponent(error) });
    res.end();
    return;
  }

  // Instalación iniciada desde Webflow (botón "Install" del dashboard / marketplace):
  // Webflow llega aquí con ?code= pero SIN state. En vez de fallar, arrancamos
  // nuestro propio flujo con state; como la app ya está autorizada, Webflow
  // devolverá al usuario enseguida con un state válido.
  if (!state) {
    console.warn('[auth/callback] sin state (instalación desde Webflow) → reinicio del flujo');
    res.writeHead(302, { Location: '/api/auth/start' });
    res.end();
    return;
  }

  clearCookie(res, STATE_COOKIE);

  if (!code || !cookieState || state !== cookieState) {
    console.warn('[auth/callback] state inválido', { hasCode: !!code, hasCookie: !!cookieState, host: req.headers.host });
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<p>Invalid or missing OAuth state.</p><p><a href="/api/auth/start">Try connecting again</a></p>');
    return;
  }

  try {
    const tokenRes = await axios.post('https://api.webflow.com/oauth/access_token', {
      client_id: process.env.WEBFLOW_CLIENT_ID,
      client_secret: process.env.WEBFLOW_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${getBaseUrl(req)}/api/auth/callback`,
    });
    const accessToken = tokenRes.data.access_token;

    const sitesRes = await axios.get('https://api.webflow.com/v2/sites', {
      headers: { Authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    });
    const sites = sitesRes.data.sites || sitesRes.data;
    if (!sites?.length) throw new Error('El token no devolvió ningún sitio autorizado');

    await ensureSchema();
    const encrypted = encrypt(accessToken);
    for (const site of sites) {
      await upsertSite(site.id, site.displayName, encrypted);
    }

    const sessionId = randomToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    // Un token puede cubrir varios sitios autorizados; la sesión de este navegador
    // queda asociada al primero (la UI actual visualiza un sitio a la vez).
    await createSession(sessionId, sites[0].id, expiresAt);

    setCookie(res, SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 });
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error('[auth/callback]', err.response?.data || err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error connecting to Webflow. Check the server logs.');
  }
}
