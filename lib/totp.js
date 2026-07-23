/* VaultKey — TOTP generation via Web Crypto API */

const BASE32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(str) {
  str = str.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0, output = [];
  for (let i = 0; i < str.length; i++) {
    const idx = BASE32_ALPHA.indexOf(str[i]);
    if (idx === -1) throw new Error(`Invalid Base32 character: ${str[i]}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 0xFF); bits -= 8; }
  }
  return new Uint8Array(output);
}

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = new Uint8Array(buffer);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
}

function uint64ToBeBytes(n) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt.asUintN(64, BigInt(n)), false);
  return new Uint8Array(buf);
}

export function validateBase32(str) {
  const cleaned = str.replace(/[\s=-]/g, '').toUpperCase();
  return /^[A-Z2-7]+$/.test(cleaned);
}

export function totpUrl(account) {
  const secretB32 = (account.secret instanceof Uint8Array) ? base32Encode(account.secret) : account.secret;
  const issuer = account.issuer || '';
  const name = encodeURIComponent(account.name || '');
  const algo = (account.algorithm || 'SHA-1').replace('-', '');
  const digits = String(account.digits || 6);
  const period = String(account.period || 30);
  let params = [`secret=${secretB32}`];
  if (issuer) params.push(`issuer=${encodeURIComponent(issuer)}`);
  if (algo !== 'SHA1') params.push(`algorithm=${algo}`);
  if (digits !== '6') params.push(`digits=${digits}`);
  if (account.period && account.period !== 30) params.push(`period=${period}`);
  const label = issuer ? `${encodeURIComponent(issuer)}:${name}` : name;
  return `otpauth://totp/${label}?${params.join('&')}`;
}

export async function generateTOTP(secret, options = {}) {
  const { algorithm = 'SHA-1', digits = 6, period = 30, counter = 0 } = options;
  const keyBytes = (secret instanceof Uint8Array) ? secret : base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / period);
  const timeBytes = uint64ToBeBytes(timeStep);

  const hashName = algorithm || 'SHA-1';
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: { name: hashName } }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, timeBytes);
  const hash = new Uint8Array(sig);

  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = code % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

export function getTimeRemaining(period = 30) {
  const epoch = Math.floor(Date.now() / 1000);
  return period - (epoch % period);
}

export function getProgress(period = 30) {
  const remaining = getTimeRemaining(period);
  return remaining / period;
}

export { base32Encode };
