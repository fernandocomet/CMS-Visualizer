import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

let schemaReady;
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS sites (
          site_id TEXT PRIMARY KEY,
          display_name TEXT,
          encrypted_access_token TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          site_id TEXT NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `;
    })();
  }
  return schemaReady;
}

export async function upsertSite(siteId, displayName, encryptedAccessToken) {
  await sql`
    INSERT INTO sites (site_id, display_name, encrypted_access_token)
    VALUES (${siteId}, ${displayName}, ${encryptedAccessToken})
    ON CONFLICT (site_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      encrypted_access_token = EXCLUDED.encrypted_access_token
  `;
}

export async function createSession(sessionId, siteId, expiresAt) {
  await sql`
    INSERT INTO sessions (session_id, site_id, expires_at)
    VALUES (${sessionId}, ${siteId}, ${expiresAt.toISOString()})
  `;
}

export async function getSessionSite(sessionId) {
  const rows = await sql`
    SELECT s.site_id, s.encrypted_access_token
    FROM sessions se
    JOIN sites s ON s.site_id = se.site_id
    WHERE se.session_id = ${sessionId} AND se.expires_at > now()
  `;
  return rows[0];
}

export async function deleteSession(sessionId) {
  await sql`DELETE FROM sessions WHERE session_id = ${sessionId}`;
}

export async function deleteSite(siteId) {
  await sql`DELETE FROM sites WHERE site_id = ${siteId}`;
}
