import axios from 'axios';
import { readCookie, SESSION_COOKIE } from '../../lib/session.js';
import { getSessionSite } from '../../lib/db.js';
import { decrypt } from '../../lib/crypto.js';

export default async function handler(req, res) {
  const { id } = req.query;
  const sessionId = readCookie(req, SESSION_COOKIE);
  const session = sessionId ? await getSessionSite(sessionId) : null;
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_connected' }));
    return;
  }

  const accessToken = decrypt(session.encrypted_access_token);
  try {
    const webflowRes = await axios.get(`https://api.webflow.com/v2/collections/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(webflowRes.data));
  } catch (err) {
    const status = err.response?.status || 502;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(err.response?.data || { error: 'webflow_error' }));
  }
}
