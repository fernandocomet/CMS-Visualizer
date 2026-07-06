import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error('Missing TOKEN_ENCRYPTION_KEY env var');
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64)');
  return buf;
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decrypt(payload) {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
