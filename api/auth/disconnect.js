import axios from 'axios';
import { readCookie, clearCookie, SESSION_COOKIE } from '../../lib/session.js';
import { getSessionSite, deleteSession, deleteSite } from '../../lib/db.js';
import { decrypt } from '../../lib/crypto.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const sessionId = readCookie(req, SESSION_COOKIE);
  if (sessionId) {
    const session = await getSessionSite(sessionId);
    if (session) {
      try {
        const accessToken = decrypt(session.encrypted_access_token);
        await axios.post('https://webflow.com/oauth/revoke_authorization', {
          client_id: process.env.WEBFLOW_CLIENT_ID,
          client_secret: process.env.WEBFLOW_CLIENT_SECRET,
          access_token: accessToken,
        });
      } catch (err) {
        console.error('[auth/disconnect] revoke_authorization falló', err.response?.data || err.message);
      }
      await deleteSession(sessionId);
      await deleteSite(session.site_id);
    }
  }

  clearCookie(res, SESSION_COOKIE);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}
